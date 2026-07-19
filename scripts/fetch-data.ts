/**
 * Fetch BSData/wh40k-10e, BSData/wh40k-11e, and BSData/wh40k-killteam data
 * and generate embedded TypeScript data files.
 *
 * Usage: npx tsx scripts/fetch-data.ts
 *
 * Uses the public GitHub REST API directly (no `gh` CLI required). Set
 * GITHUB_TOKEN to raise the rate limit above the 60 req/hr anonymous cap
 * (GitHub Actions provides this automatically).
 */

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  parseKillTeamGameSystem,
  parseKillTeamCatalogue,
  parseDetachments,
  parseEnhancements,
  buildRuleIndex,
  xmlParser,
  ensureArray,
  parseEntryNode,
  extractFaction,
  normalizeJsonNode,
} from "../src/lib/xml-parser.js";
import type { Unit, Detachment, Enhancement, KillTeamOperative } from "../src/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

const REPO_40K = "BSData/wh40k-10e";
const REPO_40K_11E = "BSData/wh40k-11e";
const REPO_KT = "BSData/wh40k-killteam";

// ── GitHub API helpers ───────────────────────────────────────────────────

interface TreeEntry {
  path: string;
  sha: string;
}

async function ghApi(path: string): Promise<any> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(`https://api.github.com/${path}`, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function fetchTree(repo: string, branch = "main"): Promise<TreeEntry[]> {
  const data = await ghApi(`repos/${repo}/git/trees/${branch}?recursive=1`);
  const tree = (data.tree ?? []) as Array<{ path: string; sha: string; type: string }>;
  return tree
    .filter((e) => e.type === "blob" && /\.(cat|gst|json)$/.test(e.path))
    .map((e) => ({ path: e.path, sha: e.sha }));
}

async function fetchBlob(repo: string, sha: string): Promise<string> {
  const data = await ghApi(`repos/${repo}/git/blobs/${sha}`);
  // A short delay avoids tripping GitHub's secondary (burst) rate limit,
  // which is separate from — and much stricter than — the hourly quota.
  await new Promise((resolve) => setTimeout(resolve, 200));
  return Buffer.from(data.content as string, "base64").toString("utf-8");
}

// BSData catalogues often ship as a thin "roster" file plus a same-named
// "Library" file holding the faction's actual detachments/units (e.g.
// "Chaos - Chaos Daemons.json" catalogueLinks into "Chaos - Chaos Daemons
// Library.json", which is where Daemons' own Detachment group actually
// lives). That's the only case where following a catalogueLink to source
// detachments/enhancements is correct. The same library files are ALSO
// catalogueLinked by many unrelated factions purely to grant access to
// allied units (e.g. every Space Marine chapter links "Imperial Knights -
// Library" so a Marines army can include Knight allies) — walking those
// links for detachments/enhancements too would wrongly attribute another
// faction's entire detachment list to the importing faction. This checks
// whether a linked library "belongs" to the importing catalogue's own
// faction (by name), which is the only signal available — BattleScribe's
// `importRootEntries` flag doesn't distinguish the two cases (it's `true`
// on both a faction's own library link and its ally-unit library links).
//
// Match is substring-based, not exact: BSData's own filename and internal
// `name` attribute disagree for at least one library ("Chaos - Chaos
// Daemons Library.json"'s filename vs. its internal name "Chaos - Daemons
// Library", missing the repeated "Chaos") — exact string equality rejected
// that as a false mismatch and silently dropped Chaos Daemons' own 9
// detachments. Substring matching tolerates that inconsistency while still
// correctly rejecting unrelated pairs (e.g. "chaos space marines" contains
// neither "chaos knights" nor "daemons", and vice versa).
function libraryBelongsToFaction(catalogueName: string, libraryName: string): boolean {
  const stripToFaction = (name: string) =>
    extractFaction(name)
      .replace(/\s*-?\s*Library$/i, "")
      .trim()
      .toLowerCase();
  const a = stripToFaction(catalogueName);
  const b = stripToFaction(libraryName);
  return a === b || a.includes(b) || b.includes(a);
}

// ── Fetch 40K data (with cross-catalogue entryLink resolution) ──────────
// Shared between BSData/wh40k-10e (XML) and BSData/wh40k-11e (JSON) — both
// repos use the same underlying BattleScribe catalogue schema, just a
// different file encoding, so `parseNode` is the only thing that varies.

interface ParsedCatalogue {
  id: string;
  name: string;
  isLibrary: boolean;
  raw: any; // parsed catalogue node, normalized to the XML-parser shape
}

async function fetchCatalogueRepo(
  repo: string,
  gameSystemFiles: TreeEntry[],
  catFiles: TreeEntry[],
  parseNode: (raw: string) => any,
  gameSystem: "wh40k-10e" | "wh40k-11e",
): Promise<{
  units: Unit[];
  detachments: Detachment[];
  enhancements: Enhancement[];
  rules: { name: string; description: string }[];
}> {
  // ── Phase 0: Parse game system file(s) for rules ──
  const allRules: { name: string; description: string }[] = [];
  // Also build a global shared entry index from the game system file
  const globalSharedIndex = new Map<string, any>();

  for (const gst of gameSystemFiles) {
    console.log(`  Fetching ${gst.path}...`);
    const raw = await fetchBlob(repo, gst.sha);
    const parsed = parseNode(raw);
    const gs = parsed.gameSystem;
    if (!gs) continue;

    const directRules = ensureArray(gs.rules?.rule);
    const sharedRules = ensureArray(gs.sharedRules?.rule);
    let skipped = 0;
    for (const r of [...directRules, ...sharedRules]) {
      // Skip stub rules with no description text yet (seen in the actively-developing
      // wh40k-11e repo) — an empty definition would look broken to a user querying it.
      if (!r.description) {
        skipped++;
        continue;
      }
      allRules.push({ name: r["@_name"], description: r.description });
    }
    console.log(
      `    → ${directRules.length + sharedRules.length - skipped} rules from ${gs["@_name"]}` +
        (skipped > 0 ? ` (${skipped} skipped: no description yet)` : ""),
    );

    // Index shared entries from game system file too
    indexSharedEntries(gs, globalSharedIndex);
  }

  // ── Phase 1: Fetch and parse ALL catalogues (including libraries) ──
  const catalogues: ParsedCatalogue[] = [];

  for (const cat of catFiles) {
    console.log(`  Fetching ${cat.path}...`);
    const raw = await fetchBlob(repo, cat.sha);
    const parsed = parseNode(raw);
    const catNode = parsed.catalogue;

    const isLibrary = catNode["@_library"] === "true" || cat.path.includes("Library");

    catalogues.push({
      id: catNode["@_id"],
      name: catNode["@_name"],
      isLibrary,
      raw: catNode,
    });

    // Index all shared entries from every catalogue into the global map
    indexSharedEntries(catNode, globalSharedIndex);

    if (isLibrary) {
      console.log(`    → Library catalogue (${globalSharedIndex.size} global entries so far)`);
    }
  }

  console.log(`\n  Global shared entry index: ${globalSharedIndex.size} entries`);

  // Build a global rule index for resolving infoLinks in detachment entries
  // Some factions (e.g. Necrons) use infoLinks to reference shared rules instead of inline rules
  const globalRuleIndex = new Map<string, any>();
  for (const cat of catalogues) {
    const catRules = buildRuleIndex(cat.raw);
    for (const [id, rule] of catRules) {
      if (!globalRuleIndex.has(id)) {
        globalRuleIndex.set(id, rule);
      }
    }
  }
  console.log(`  Global rule index: ${globalRuleIndex.size} rules`);

  // Build a lookup from catalogue ID → ParsedCatalogue for catalogueLink resolution
  const catalogueById = new Map<string, ParsedCatalogue>();
  for (const cat of catalogues) {
    catalogueById.set(cat.id, cat);
  }

  // ── Phase 2: For each non-library catalogue, resolve units, detachments, enhancements ──
  const allUnits: Unit[] = [];
  const allDetachments: Detachment[] = [];
  const allEnhancements: Enhancement[] = [];

  for (const cat of catalogues) {
    if (cat.isLibrary) {
      console.log(`  Skipping library (units): ${cat.name}`);
      continue;
    }

    const faction = extractFaction(cat.name);
    const catUnits: Unit[] = [];

    // 2-pre: Extract detachments and enhancements from this catalogue
    const catDetachments = parseDetachments(cat.raw, faction, globalSharedIndex, globalRuleIndex);
    allDetachments.push(...catDetachments);

    const catEnhancements = parseEnhancements(cat.raw, faction, globalSharedIndex);
    allEnhancements.push(...catEnhancements);

    // Also check linked library catalogues for detachments/enhancements —
    // but only the catalogue's OWN dedicated library (see libraryBelongsToFaction),
    // not every ally-unit library it links to for roster-building purposes.
    const catLinks = ensureArray(cat.raw.catalogueLinks?.catalogueLink);
    for (const catLink of catLinks) {
      const targetCatId = catLink["@_targetId"];
      if (!targetCatId) continue;
      const linkedCat = catalogueById.get(targetCatId);
      if (!linkedCat) continue;
      if (!libraryBelongsToFaction(cat.name, linkedCat.name)) continue;

      const linkedDetachments = parseDetachments(linkedCat.raw, faction, globalSharedIndex, globalRuleIndex);
      allDetachments.push(...linkedDetachments);

      const linkedEnhancements = parseEnhancements(linkedCat.raw, faction, globalSharedIndex);
      allEnhancements.push(...linkedEnhancements);
    }

    if (catDetachments.length > 0 || catEnhancements.length > 0) {
      console.log(`    → ${catDetachments.length} detachments, ${catEnhancements.length} enhancements`);
    }

    // 2a: Direct inline units from this catalogue (selectionEntries + own sharedSelectionEntries)
    const directEntries = ensureArray(cat.raw.selectionEntries?.selectionEntry);
    const ownSharedEntries = ensureArray(cat.raw.sharedSelectionEntries?.selectionEntry);
    for (const entry of [...directEntries, ...ownSharedEntries]) {
      const unit = parseEntryWithLinks(entry, faction, globalSharedIndex);
      if (unit) catUnits.push(unit);
    }

    // 2b: Resolve top-level entryLinks → look up in global shared index
    // Use unitOnly=true to skip model-type entries (wargear options) from shared pools
    const topEntryLinks = ensureArray(cat.raw.entryLinks?.entryLink);
    for (const link of topEntryLinks) {
      const targetId = link["@_targetId"];
      const hidden = link["@_hidden"] === "true";
      if (hidden || !targetId) continue;

      const target = globalSharedIndex.get(targetId);
      if (!target) continue;

      const unit = parseEntryWithLinks(target, faction, globalSharedIndex, true);
      if (unit) {
        // Use the link's id to avoid collisions with other factions using same shared entry
        const linkId = link["@_id"] || unit.id;
        catUnits.push({ ...unit, id: linkId });
      }
    }

    // 2c: Resolve catalogueLinks — import units from linked catalogues
    // (catLinks already declared above for detachment/enhancement resolution)
    for (const catLink of catLinks) {
      const targetCatId = catLink["@_targetId"];
      if (!targetCatId) continue;

      const linkedCat = catalogueById.get(targetCatId);
      if (!linkedCat) continue;

      // Import the linked catalogue's own direct selectionEntries
      const linkedDirect = ensureArray(linkedCat.raw.selectionEntries?.selectionEntry);
      for (const entry of linkedDirect) {
        const unit = parseEntryWithLinks(entry, faction, globalSharedIndex);
        if (unit) catUnits.push(unit);
      }

      // Resolve the linked catalogue's entryLinks (unitOnly for shared entries)
      const linkedEntryLinks = ensureArray(linkedCat.raw.entryLinks?.entryLink);
      for (const link of linkedEntryLinks) {
        const targetId = link["@_targetId"];
        const hidden = link["@_hidden"] === "true";
        if (hidden || !targetId) continue;

        const target = globalSharedIndex.get(targetId);
        if (!target) continue;

        const unit = parseEntryWithLinks(target, faction, globalSharedIndex, true);
        if (unit) {
          const linkId = link["@_id"] || unit.id;
          catUnits.push({ ...unit, id: linkId });
        }
      }
    }

    // Deduplicate within this faction by unit ID
    const dedupedUnits: Unit[] = [];
    const factionSeen = new Set<string>();
    for (const unit of catUnits) {
      if (!factionSeen.has(unit.id)) {
        factionSeen.add(unit.id);
        dedupedUnits.push(unit);
      }
    }

    console.log(`  ${cat.name} → ${dedupedUnits.length} units`);
    allUnits.push(...dedupedUnits);
  }

  // Global dedup by ID (in case multiple factions share exact same ID — unlikely but safe).
  // Also stamp the gameSystem here: parseEntryNode/parseDetachments/parseEnhancements
  // hardcode "wh40k-10e", so the 11e caller's value is applied on the way out.
  const finalUnits: Unit[] = [];
  const globalSeen = new Set<string>();
  for (const unit of allUnits) {
    const key = `${unit.faction}::${unit.id}`;
    if (!globalSeen.has(key)) {
      globalSeen.add(key);
      finalUnits.push({ ...unit, gameSystem });
    }
  }

  // Global dedup detachments and enhancements by ID+faction
  const finalDetachments: Detachment[] = [];
  const detachmentSeen = new Set<string>();
  for (const det of allDetachments) {
    const key = `${det.faction}::${det.id}`;
    if (!detachmentSeen.has(key)) {
      detachmentSeen.add(key);
      finalDetachments.push({ ...det, gameSystem });
    }
  }

  const finalEnhancements: Enhancement[] = [];
  const enhancementSeen = new Set<string>();
  for (const enh of allEnhancements) {
    const key = `${enh.faction}::${enh.id}`;
    if (!enhancementSeen.has(key)) {
      enhancementSeen.add(key);
      finalEnhancements.push({ ...enh, gameSystem });
    }
  }

  console.log(`\n${gameSystem} Total: ${finalUnits.length} units, ${finalDetachments.length} detachments, ${finalEnhancements.length} enhancements, ${allRules.length} shared rules`);

  // Log per-faction breakdown
  const factionCounts = new Map<string, number>();
  for (const unit of finalUnits) {
    factionCounts.set(unit.faction, (factionCounts.get(unit.faction) ?? 0) + 1);
  }
  const sortedFactions = [...factionCounts.entries()].sort((a, b) => b[1] - a[1]);
  console.log("\nPer-faction unit breakdown:");
  for (const [faction, count] of sortedFactions) {
    console.log(`  ${faction}: ${count}`);
  }

  // Log detachment/enhancement breakdown
  const detFactionCounts = new Map<string, number>();
  for (const det of finalDetachments) {
    detFactionCounts.set(det.faction, (detFactionCounts.get(det.faction) ?? 0) + 1);
  }
  const enhFactionCounts = new Map<string, number>();
  for (const enh of finalEnhancements) {
    enhFactionCounts.set(enh.faction, (enhFactionCounts.get(enh.faction) ?? 0) + 1);
  }
  console.log("\nPer-faction detachment/enhancement breakdown:");
  const allFactions = new Set([...detFactionCounts.keys(), ...enhFactionCounts.keys()]);
  for (const faction of [...allFactions].sort()) {
    const dets = detFactionCounts.get(faction) ?? 0;
    const enhs = enhFactionCounts.get(faction) ?? 0;
    console.log(`  ${faction}: ${dets} detachments, ${enhs} enhancements`);
  }

  return { units: finalUnits, detachments: finalDetachments, enhancements: finalEnhancements, rules: allRules };
}

export async function fetch40k() {
  console.log("Fetching file tree from BSData/wh40k-10e...");
  const tree = await fetchTree(REPO_40K);

  const gstFiles = tree.filter((e) => e.path.endsWith(".gst"));
  const catFiles = tree.filter((e) => e.path.endsWith(".cat"));
  console.log(`Found ${gstFiles.length} .gst file(s), ${catFiles.length} .cat file(s)`);

  return fetchCatalogueRepo(
    REPO_40K,
    gstFiles,
    catFiles,
    (xml) => xmlParser.parse(xml),
    "wh40k-10e",
  );
}

export async function fetch11e() {
  console.log("\nFetching file tree from BSData/wh40k-11e...");
  const tree = await fetchTree(REPO_40K_11E);
  const jsonFiles = tree.filter((e) => e.path.endsWith(".json"));

  const gameSystemFiles = jsonFiles.filter((e) => e.path === "Warhammer 40,000.json");
  const catFiles = jsonFiles.filter((e) => e.path !== "Warhammer 40,000.json");
  console.log(`Found ${catFiles.length} catalogue file(s), ${gameSystemFiles.length} game system file(s)`);

  return fetchCatalogueRepo(
    REPO_40K_11E,
    gameSystemFiles,
    catFiles,
    (raw) => normalizeJsonNode(JSON.parse(raw)),
    "wh40k-11e",
  );
}

/** Index all shared selection entries from a catalogue/gameSystem node into the global map */
function indexSharedEntries(node: any, index: Map<string, any>): void {
  const sharedEntries = ensureArray(node.sharedSelectionEntries?.selectionEntry);
  for (const entry of sharedEntries) {
    if (entry["@_id"]) {
      index.set(entry["@_id"], entry);
    }
  }

  // Also index entries from sharedSelectionEntryGroups
  const sharedGroups = ensureArray(node.sharedSelectionEntryGroups?.selectionEntryGroup);
  for (const group of sharedGroups) {
    if (group["@_id"]) {
      index.set(group["@_id"], group);
    }
    const groupEntries = ensureArray(group.selectionEntries?.selectionEntry);
    for (const entry of groupEntries) {
      if (entry["@_id"]) {
        index.set(entry["@_id"], entry);
      }
    }
  }
}

/** Parse an entry node, resolving its internal entryLinks against the global shared index.
 *  unitOnly: if true, only accept type="unit" (skip type="model"). Used for entryLink-resolved entries
 *  to avoid pulling in individual weapon loadout options marked as "model". */
function parseEntryWithLinks(
  entry: any,
  faction: string,
  globalIndex: Map<string, any>,
  unitOnly = false
): Unit | null {
  const type = entry["@_type"];
  const hidden = entry["@_hidden"] === "true";
  if (hidden) return null;
  if (unitOnly) {
    if (type !== "unit") return null;
  } else {
    if (type !== "unit" && type !== "model") return null;
  }

  // Collect all profiles including from entryLinks (resolved against global index)
  const profiles = collectAllProfilesWithGlobalLinks(entry, globalIndex);

  return parseEntryNode(entry, faction, profiles);
}

/**
 * entryLinks whose name matches one of these patterns point to a broad
 * shared option pool (an entire faction's Enhancements catalogue, every
 * Warlord Trait in the book, every Crusade Relic, every universal weapon-
 * customization option in the game) rather than content specific to the
 * unit that references it. Following these causes massive unrelated bloat
 * — confirmed: one unit's "abilities" count ballooned from ~5 to ~397 by
 * pulling in an entire shared Enhancements catalogue this way, because
 * that link ("Dark Age Arsenal Enhancements") sat alongside the unit's own
 * real content rather than being a node's sole content, so a purely
 * structural "is this the only thing here" check doesn't reliably catch
 * it either (a wanted reference, e.g. Astra Militarum's "Shock Trooper
 * Sergeant", can legitimately sit alongside other real content too).
 * These specific categories are already tracked as their own first-class
 * data elsewhere in this project (Enhancements has its own parseEnhancements
 * pipeline) or are out of scope (Crusade narrative rules, Warlord Trait
 * eligibility) — this project doesn't need their content mixed into unit
 * weapon/ability profiles.
 *
 * "boon" covers each Chaos legion's "Boons of <God>" / "Chaos Boons" group
 * (confirmed via BSData/wh40k-11e: every such link resolves to a target
 * whose own `comment` is "Crusade content") — without it, units like Chosen
 * and Cultist Mob picked up mutation-flavoured abilities (Mutant Form,
 * Massive Fangs, Scorpion Tail, Daemonic Flesh, Warp Stalker, Dark Blessing)
 * that only apply after a Crusade boon roll, not on the base datasheet.
 */
const UNIVERSAL_OPTION_POOL_LINK_NAME_PATTERN =
  /enhancement|warlord|crusade|weapon modifications?|battle trait|battle scar|requisition|boons?/i;

/** Hard ceiling on profiles collected for one unit — a circuit breaker against
 * any *other* unanticipated broad-shared-pool link category slipping through
 * the denylist above and silently blowing up the output (as happened once
 * already). A real datasheet never legitimately has this many profiles. */
const MAX_PROFILES_PER_UNIT = 100;

/**
 * Like collectAllProfiles but also resolves entryLinks (references to
 * shared content elsewhere by id) against a global cross-catalogue index,
 * skipping links that match UNIVERSAL_OPTION_POOL_LINK_NAME_PATTERN.
 * `visited` guards against a cyclical entryLink chain turning into infinite
 * recursion (not expected in real BSData, but this walks external
 * references from a separately-fetched index rather than a pure inline
 * tree, so it's cheap insurance).
 */
function collectAllProfilesWithGlobalLinks(
  entry: any,
  globalIndex: Map<string, any>,
  visited: Set<string> = new Set(),
): any[] {
  const direct = ensureArray(entry.profiles?.profile);

  const entryLinks = ensureArray(entry.entryLinks?.entryLink);
  const linkedProfiles = entryLinks.flatMap((link: any) => {
    const targetId = link["@_targetId"];
    const linkName = link["@_name"] ?? "";
    if (!targetId || visited.has(targetId)) return [];
    if (UNIVERSAL_OPTION_POOL_LINK_NAME_PATTERN.test(linkName)) return [];
    const target = globalIndex.get(targetId);
    if (!target) return [];
    visited.add(targetId);
    return collectAllProfilesWithGlobalLinks(target, globalIndex, visited);
  });

  const subEntries = ensureArray(entry.selectionEntries?.selectionEntry);
  const subEntryProfiles = subEntries.flatMap((sub: any) =>
    collectAllProfilesWithGlobalLinks(sub, globalIndex, visited),
  );

  const groups = ensureArray(entry.selectionEntryGroups?.selectionEntryGroup);
  const groupProfiles = groups.flatMap((group: any) =>
    collectAllProfilesWithGlobalLinks(group, globalIndex, visited),
  );

  const all = [...direct, ...linkedProfiles, ...subEntryProfiles, ...groupProfiles];
  if (all.length > MAX_PROFILES_PER_UNIT) {
    console.warn(
      `  ⚠ ${entry["@_name"] ?? "?"}: ${all.length} profiles collected, exceeds ${MAX_PROFILES_PER_UNIT} — likely an unanticipated shared-pool link category; truncating`,
    );
    return all.slice(0, MAX_PROFILES_PER_UNIT);
  }
  return all;
}

// ── Fetch Kill Team data ────────────────────────────────────────────────

async function fetchKillTeam(): Promise<{
  operatives: KillTeamOperative[];
  rules: { name: string; description: string }[];
}> {
  console.log("\nFetching file tree from BSData/wh40k-killteam...");
  const tree = await fetchTree(REPO_KT, "master");

  // Only 2024 edition files
  const gstFiles = tree.filter(
    (e) => e.path.endsWith(".gst") && e.path.startsWith("2024 - ")
  );
  const catFiles = tree.filter(
    (e) => e.path.endsWith(".cat") && e.path.startsWith("2024 - ")
  );

  console.log(
    `Found ${gstFiles.length} .gst file(s), ${catFiles.length} .cat file(s) (2024 edition)`
  );

  const allRules: { name: string; description: string }[] = [];

  for (const gst of gstFiles) {
    console.log(`  Fetching ${gst.path}...`);
    const xml = await fetchBlob(REPO_KT, gst.sha);
    const result = parseKillTeamGameSystem(xml);
    console.log(`    → ${result.rules.length} rules from ${result.name}`);
    for (const r of result.rules) {
      allRules.push({ name: r.name, description: r.description });
    }
  }

  const allOperatives: KillTeamOperative[] = [];

  for (const cat of catFiles) {
    if (cat.path.includes("Library")) {
      console.log(`  Skipping library: ${cat.path}`);
      continue;
    }

    console.log(`  Fetching ${cat.path}...`);
    const xml = await fetchBlob(REPO_KT, cat.sha);
    const operatives = parseKillTeamCatalogue(xml);
    console.log(`    → ${operatives.length} operatives`);
    allOperatives.push(...operatives);
  }

  console.log(
    `\nKill Team Total: ${allOperatives.length} operatives, ${allRules.length} shared rules`
  );
  return { operatives: allOperatives, rules: allRules };
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const { units, detachments, enhancements, rules: rules40k } = await fetch40k();
  const {
    units: units11e,
    detachments: detachments11e,
    enhancements: enhancements11e,
    rules: rules11e,
  } = await fetch11e();
  const { operatives, rules: rulesKT } = await fetchKillTeam();

  // ── Write src/data/units.ts ──
  const unitsPath = join(ROOT, "src", "data", "units.ts");
  const unitsContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: https://github.com/${REPO_40K}`,
    "",
    'import type { Unit } from "../types.js";',
    "",
    `export const UNITS: Unit[] = ${JSON.stringify(units, null, 2)};`,
    "",
  ].join("\n");

  writeFileSync(unitsPath, unitsContent, "utf-8");
  console.log(`Wrote ${unitsPath} (${units.length} units)`);

  // ── Write src/data/detachments.ts ──
  const detachmentsPath = join(ROOT, "src", "data", "detachments.ts");
  const detachmentsContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: https://github.com/${REPO_40K}`,
    "",
    'import type { Detachment } from "../types.js";',
    "",
    `export const DETACHMENTS: Detachment[] = ${JSON.stringify(detachments, null, 2)};`,
    "",
  ].join("\n");

  writeFileSync(detachmentsPath, detachmentsContent, "utf-8");
  console.log(`Wrote ${detachmentsPath} (${detachments.length} detachments)`);

  // ── Write src/data/enhancements.ts ──
  const enhancementsPath = join(ROOT, "src", "data", "enhancements.ts");
  const enhancementsContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: https://github.com/${REPO_40K}`,
    "",
    'import type { Enhancement } from "../types.js";',
    "",
    `export const ENHANCEMENTS: Enhancement[] = ${JSON.stringify(enhancements, null, 2)};`,
    "",
  ].join("\n");

  writeFileSync(enhancementsPath, enhancementsContent, "utf-8");
  console.log(`Wrote ${enhancementsPath} (${enhancements.length} enhancements)`);

  // ── Write src/data/rules.ts ──
  const rulesPath = join(ROOT, "src", "data", "rules.ts");
  const rulesContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: https://github.com/${REPO_40K}`,
    "",
    "export const SHARED_RULES: { name: string; description: string }[] = " +
      JSON.stringify(rules40k, null, 2) +
      ";",
    "",
  ].join("\n");

  writeFileSync(rulesPath, rulesContent, "utf-8");
  console.log(`Wrote ${rulesPath} (${rules40k.length} rules)`);

  // ── Write src/data/units-11e.ts ──
  const units11ePath = join(ROOT, "src", "data", "units-11e.ts");
  const units11eContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: https://github.com/${REPO_40K_11E}`,
    "",
    'import type { Unit } from "../types.js";',
    "",
    `export const UNITS_11E: Unit[] = ${JSON.stringify(units11e, null, 2)};`,
    "",
  ].join("\n");

  writeFileSync(units11ePath, units11eContent, "utf-8");
  console.log(`Wrote ${units11ePath} (${units11e.length} units)`);

  // ── Write src/data/detachments-11e.ts ──
  const detachments11ePath = join(ROOT, "src", "data", "detachments-11e.ts");
  const detachments11eContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: https://github.com/${REPO_40K_11E}`,
    "",
    'import type { Detachment } from "../types.js";',
    "",
    `export const DETACHMENTS_11E: Detachment[] = ${JSON.stringify(detachments11e, null, 2)};`,
    "",
  ].join("\n");

  writeFileSync(detachments11ePath, detachments11eContent, "utf-8");
  console.log(`Wrote ${detachments11ePath} (${detachments11e.length} detachments)`);

  // ── Write src/data/enhancements-11e.ts ──
  const enhancements11ePath = join(ROOT, "src", "data", "enhancements-11e.ts");
  const enhancements11eContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: https://github.com/${REPO_40K_11E}`,
    "",
    'import type { Enhancement } from "../types.js";',
    "",
    `export const ENHANCEMENTS_11E: Enhancement[] = ${JSON.stringify(enhancements11e, null, 2)};`,
    "",
  ].join("\n");

  writeFileSync(enhancements11ePath, enhancements11eContent, "utf-8");
  console.log(`Wrote ${enhancements11ePath} (${enhancements11e.length} enhancements)`);

  // ── Write src/data/rules-11e.ts ──
  const rules11ePath = join(ROOT, "src", "data", "rules-11e.ts");
  const rules11eContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: https://github.com/${REPO_40K_11E}`,
    "",
    "export const SHARED_RULES_11E: { name: string; description: string }[] = " +
      JSON.stringify(rules11e, null, 2) +
      ";",
    "",
  ].join("\n");

  writeFileSync(rules11ePath, rules11eContent, "utf-8");
  console.log(`Wrote ${rules11ePath} (${rules11e.length} rules)`);

  // ── Write src/data/kill-team-operatives.ts ──
  const ktPath = join(ROOT, "src", "data", "kill-team-operatives.ts");
  const ktContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: https://github.com/${REPO_KT}`,
    "",
    'import type { KillTeamOperative } from "../types.js";',
    "",
    `export const KILL_TEAM_OPERATIVES: KillTeamOperative[] = ${JSON.stringify(operatives, null, 2)};`,
    "",
  ].join("\n");

  writeFileSync(ktPath, ktContent, "utf-8");
  console.log(`Wrote ${ktPath} (${operatives.length} operatives)`);

  // ── Write src/data/kill-team-rules.ts ──
  const ktRulesPath = join(ROOT, "src", "data", "kill-team-rules.ts");
  const ktRulesContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: https://github.com/${REPO_KT}`,
    "",
    "export const KILL_TEAM_SHARED_RULES: { name: string; description: string }[] = " +
      JSON.stringify(rulesKT, null, 2) +
      ";",
    "",
  ].join("\n");

  writeFileSync(ktRulesPath, ktRulesContent, "utf-8");
  console.log(`Wrote ${ktRulesPath} (${rulesKT.length} rules)`);
}

// Only auto-run when this file is the process entrypoint (`npx tsx scripts/fetch-data.ts`),
// so it can also be imported for testing individual fetch functions (e.g. fetch11e()).
const isMainModule = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;
if (isMainModule) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
