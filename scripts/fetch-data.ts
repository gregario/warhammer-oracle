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
  parseCatalogue,
  parseKillTeamGameSystem,
  parseKillTeamCatalogue,
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

// ── Codegen helpers ──────────────────────────────────────────────────────

function escapeForTemplate(s: string): string {
  // Escape backticks and ${} inside template literals
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function serializeUnit(u: Unit): string {
  return JSON.stringify(u, null, 2);
}

// ── Fetch 40K data ──────────────────────────────────────────────────────

async function fetch40k(): Promise<{
  units: Unit[];
  rules: { name: string; description: string }[];
}> {
  console.log("Fetching file tree from BSData/wh40k-10e...");
  const tree = fetchTree(REPO_40K);

  const gstFiles = tree.filter((e) => e.path.endsWith(".gst"));
  const catFiles = tree.filter((e) => e.path.endsWith(".cat"));

  console.log(`Found ${gstFiles.length} .gst file(s), ${catFiles.length} .cat file(s)`);

  const allRules: { name: string; description: string }[] = [];

  for (const gst of gstFiles) {
    console.log(`  Fetching ${gst.path}...`);
    const xml = fetchBlob(REPO_40K, gst.sha);
    const result = parseGameSystem(xml);
    console.log(`    → ${result.rules.length} rules from ${result.name}`);
    for (const r of result.rules) {
      allRules.push({ name: r.name, description: r.description });
    }
  }

  const allUnits: Unit[] = [];

  for (const cat of catFiles) {
    if (cat.path.includes("Library")) {
      console.log(`  Skipping library: ${cat.path}`);
      continue;
    }

    console.log(`  Fetching ${cat.path}...`);
    const xml = fetchBlob(REPO_40K, cat.sha);
    const units = parseCatalogue(xml);
    console.log(`    → ${units.length} units`);
    allUnits.push(...units);
  }

  console.log(`\n40K Total: ${allUnits.length} units, ${allRules.length} shared rules`);
  return { units: allUnits, rules: allRules };
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
