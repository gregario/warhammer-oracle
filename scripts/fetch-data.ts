/**
 * Fetch BSData/wh40k-10e and BSData/wh40k-killteam data and generate
 * embedded TypeScript data files.
 *
 * Usage: npx tsx scripts/fetch-data.ts
 *
 * Requires `gh` CLI authenticated with GitHub.
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseGameSystem,
  parseKillTeamGameSystem,
  parseKillTeamCatalogue,
  xmlParser,
  ensureArray,
  parseEntryNode,
  extractFaction,
  collectAllProfiles,
} from "../src/lib/xml-parser.js";
import type { Unit, KillTeamOperative } from "../src/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

const REPO_40K = "BSData/wh40k-10e";
const REPO_KT = "BSData/wh40k-killteam";

// ── Helpers ──────────────────────────────────────────────────────────────

interface TreeEntry {
  path: string;
  sha: string;
}

function fetchTree(repo: string, branch = "main"): TreeEntry[] {
  const raw = execSync(
    `gh api repos/${repo}/git/trees/${branch} --jq '.tree[] | select(.path | test("\\\\.(cat|gst)$")) | "\\(.path)\\t\\(.sha)"'`,
    { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
  );
  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [path, sha] = line.split("\t");
      return { path, sha };
    });
}

function fetchBlob(repo: string, sha: string): string {
  const b64 = execSync(
    `gh api repos/${repo}/git/blobs/${sha} --jq '.content'`,
    { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 }
  );
  return Buffer.from(b64.trim(), "base64").toString("utf-8");
}

// ── Fetch 40K data (with cross-catalogue entryLink resolution) ──────────

interface ParsedCatalogue {
  id: string;
  name: string;
  isLibrary: boolean;
  raw: any; // raw parsed XML catalogue node
}

async function fetch40k(): Promise<{
  units: Unit[];
  rules: { name: string; description: string }[];
}> {
  console.log("Fetching file tree from BSData/wh40k-10e...");
  const tree = fetchTree(REPO_40K);

  const gstFiles = tree.filter((e) => e.path.endsWith(".gst"));
  const catFiles = tree.filter((e) => e.path.endsWith(".cat"));

  console.log(`Found ${gstFiles.length} .gst file(s), ${catFiles.length} .cat file(s)`);

  // ── Phase 0: Parse .gst files for rules ──
  const allRules: { name: string; description: string }[] = [];
  // Also build a global shared entry index from the .gst (game system) file
  const globalSharedIndex = new Map<string, any>();

  for (const gst of gstFiles) {
    console.log(`  Fetching ${gst.path}...`);
    const xml = fetchBlob(REPO_40K, gst.sha);
    const result = parseGameSystem(xml);
    console.log(`    → ${result.rules.length} rules from ${result.name}`);
    for (const r of result.rules) {
      allRules.push({ name: r.name, description: r.description });
    }

    // Index shared entries from game system file too
    const parsed = xmlParser.parse(xml);
    const gs = parsed.gameSystem;
    if (gs) {
      indexSharedEntries(gs, globalSharedIndex);
    }
  }

  // ── Phase 1: Fetch and parse ALL catalogues (including libraries) ──
  const catalogues: ParsedCatalogue[] = [];

  for (const cat of catFiles) {
    console.log(`  Fetching ${cat.path}...`);
    const xml = fetchBlob(REPO_40K, cat.sha);
    const parsed = xmlParser.parse(xml);
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

  // Build a lookup from catalogue ID → ParsedCatalogue for catalogueLink resolution
  const catalogueById = new Map<string, ParsedCatalogue>();
  for (const cat of catalogues) {
    catalogueById.set(cat.id, cat);
  }

  // ── Phase 2: For each non-library catalogue, resolve units ──
  const allUnits: Unit[] = [];

  for (const cat of catalogues) {
    if (cat.isLibrary) {
      console.log(`  Skipping library (units): ${cat.name}`);
      continue;
    }

    const faction = extractFaction(cat.name);
    const catUnits: Unit[] = [];

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
    const catLinks = ensureArray(cat.raw.catalogueLinks?.catalogueLink);
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

  // Global dedup by ID (in case multiple factions share exact same ID — unlikely but safe)
  const finalUnits: Unit[] = [];
  const globalSeen = new Set<string>();
  for (const unit of allUnits) {
    const key = `${unit.faction}::${unit.id}`;
    if (!globalSeen.has(key)) {
      globalSeen.add(key);
      finalUnits.push(unit);
    }
  }

  console.log(`\n40K Total: ${finalUnits.length} units, ${allRules.length} shared rules`);

  // Log per-faction breakdown
  const factionCounts = new Map<string, number>();
  for (const unit of finalUnits) {
    factionCounts.set(unit.faction, (factionCounts.get(unit.faction) ?? 0) + 1);
  }
  const sortedFactions = [...factionCounts.entries()].sort((a, b) => b[1] - a[1]);
  console.log("\nPer-faction breakdown:");
  for (const [faction, count] of sortedFactions) {
    console.log(`  ${faction}: ${count}`);
  }

  return { units: finalUnits, rules: allRules };
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

/** Like collectAllProfiles but resolves entryLinks against a global cross-catalogue index */
function collectAllProfilesWithGlobalLinks(entry: any, globalIndex: Map<string, any>): any[] {
  const profiles = collectAllProfiles(entry);

  // Resolve entryLinks on the entry itself
  const entryLinks = ensureArray(entry.entryLinks?.entryLink);
  for (const link of entryLinks) {
    const targetId = link["@_targetId"];
    if (targetId) {
      const target = globalIndex.get(targetId);
      if (target) {
        profiles.push(...ensureArray(target.profiles?.profile));
        // Also recurse into sub-entries of resolved target
        const targetSubEntries = ensureArray(target.selectionEntries?.selectionEntry);
        for (const sub of targetSubEntries) {
          profiles.push(...ensureArray(sub.profiles?.profile));
        }
      }
    }
  }

  // Resolve entryLinks inside selectionEntryGroups
  const groups = ensureArray(entry.selectionEntryGroups?.selectionEntryGroup);
  for (const group of groups) {
    const groupLinks = ensureArray(group.entryLinks?.entryLink);
    for (const link of groupLinks) {
      const targetId = link["@_targetId"];
      if (targetId) {
        const target = globalIndex.get(targetId);
        if (target) {
          profiles.push(...ensureArray(target.profiles?.profile));
          const targetSubEntries = ensureArray(target.selectionEntries?.selectionEntry);
          for (const sub of targetSubEntries) {
            profiles.push(...ensureArray(sub.profiles?.profile));
          }
        }
      }
    }

    // Also resolve entryLinks inside sub-selectionEntries of groups
    const groupEntries = ensureArray(group.selectionEntries?.selectionEntry);
    for (const ge of groupEntries) {
      const geLinks = ensureArray(ge.entryLinks?.entryLink);
      for (const link of geLinks) {
        const targetId = link["@_targetId"];
        if (targetId) {
          const target = globalIndex.get(targetId);
          if (target) {
            profiles.push(...ensureArray(target.profiles?.profile));
          }
        }
      }
    }
  }

  return profiles;
}

// ── Fetch Kill Team data ────────────────────────────────────────────────

async function fetchKillTeam(): Promise<{
  operatives: KillTeamOperative[];
  rules: { name: string; description: string }[];
}> {
  console.log("\nFetching file tree from BSData/wh40k-killteam...");
  const tree = fetchTree(REPO_KT, "master");

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
    const xml = fetchBlob(REPO_KT, gst.sha);
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
    const xml = fetchBlob(REPO_KT, cat.sha);
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
  const { units, rules: rules40k } = await fetch40k();
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

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
