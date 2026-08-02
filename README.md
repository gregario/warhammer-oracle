<!-- mcp-name: io.github.gregario/warhammer-oracle -->
<p align="center">
  <h1 align="center">Warhammer Oracle</h1>
  <p align="center">Warhammer 40K rules, unit stats, and game flow. An MCP server.</p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/warhammer-oracle"><img src="https://img.shields.io/npm/v/warhammer-oracle.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/warhammer-oracle"><img src="https://img.shields.io/npm/dm/warhammer-oracle.svg" alt="npm downloads"></a>
  <a href="https://github.com/gregario/warhammer-oracle/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT Licence"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="Node.js 18+"></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-compatible-purple.svg" alt="MCP Compatible"></a>
  <a href="https://github.com/sponsors/gregario"><img src="https://img.shields.io/badge/sponsor-♥-ea4aaa.svg" alt="Sponsor"></a>
  <a href="https://glama.ai/mcp/servers/gregario/warhammer-oracle"><img src="https://glama.ai/mcp/servers/gregario/warhammer-oracle/badges/score.svg" alt="warhammer-oracle MCP server"></a>
</p>

---

Ask your AI assistant about datasheets, stratagems, detachments, enhancements, keywords, phase sequences, wound math, and more. Covers Warhammer 40,000 (10th and 11th Edition), Combat Patrol, and Kill Team.

[![warhammer-oracle MCP server](https://glama.ai/mcp/servers/gregario/warhammer-oracle/badges/card.svg)](https://glama.ai/mcp/servers/gregario/warhammer-oracle)

**Editions:** 40K unit/detachment/enhancement lookups default to **11th Edition**. Pass `game_mode: "40k_10e"` to any tool for 10th Edition data instead — 10th Edition support isn't going away. Turn sequences/phases, core keywords, and Core Stratagems are hand-curated from the 11th Edition Core Rules. Detachment-specific stratagems are hand-curated per faction, layered the same way the tabletop rules are layered: an 11th Edition Faction Pack detachment overrides the base Codex where the pack details it in full, and the unrevised Codex baseline applies everywhere else.

## Installation

```bash
npx warhammer-oracle
```

Or install globally:

```bash
npm install -g warhammer-oracle
```

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "warhammer-oracle": {
      "command": "npx",
      "args": ["-y", "warhammer-oracle"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add warhammer-oracle -- npx -y warhammer-oracle
```

## Tools

### `lookup_unit`

Look up a unit datasheet by name. Returns stat profiles, unit size (model count), ranged and melee weapons, abilities, and keywords.

```
"Look up the Intercessor Squad datasheet"
"What are the stats for a Leman Russ Battle Tank?"
```

**Parameters:** `unit_name` (required), `faction` (optional), `game_mode` (optional: `40k`/`40k_11e` (default, 11th Edition), `40k_10e`, `combat_patrol`, `kill_team`)

### `lookup_keyword`

Look up a keyword or rule. Returns the official definition, a plain English explanation, examples, and which game modes it applies to.

```
"What does Devastating Wounds do?"
"Explain the Feel No Pain keyword"
```

**Parameters:** `keyword` (required), `game_mode` (optional)

### `lookup_phase`

Look up a game phase by name. Returns step-by-step instructions and tips.

```
"Walk me through the Shooting phase"
"How does the Firefight phase work in Kill Team?"
```

**Parameters:** `phase_name` (required), `game_mode` (optional, default: `40k`)

### `search_units`

Search units by name, faction, keywords, or ability text. Returns a compact list (max 10 results) with faction, points, and keywords.

```
"Find all Necron units under 100 points"
"Search for units with the Fly keyword"
"Show me units with Deep Strike"
```

**Parameters:** `query` (required), `faction` (optional), `ability` (optional), `max_points` (optional), `game_mode` (optional: `40k`/`40k_11e` (default), `40k_10e`, `combat_patrol`, `kill_team`)

### `compare_units`

Compare 2-4 units side by side. Shows full datasheets for each unit in a single response.

```
"Compare Intercessors vs Tactical Marines"
"Compare the Leman Russ, Predator, and Hammerhead side by side"
```

**Parameters:** `units` (required, array of 2-4 unit names), `game_mode` (optional: `40k`/`40k_11e` (default), `40k_10e`, `combat_patrol`, `kill_team`)

### `game_flow`

Show the full turn sequence for a game mode, or highlight where you are in the turn and what comes next.

```
"Show me the 40K turn sequence"
"I'm in the Shooting phase — what's next?"
"Show the Kill Team turn sequence"
```

**Parameters:** `current_phase` (optional), `game_mode` (optional, default: `40k`)

### `lookup_stratagem`

Look up a Warhammer 40,000 stratagem by name. Returns CP cost, phase timing, target, and effect.

```
"What does Fire Overwatch do?"
"Show me the Command Re-roll stratagem"
```

**Parameters:** `name` (required), `faction` (optional), `phase` (optional), `detachment` (optional)

### `search_stratagems`

Search stratagems by name, faction, phase, or detachment. Returns a compact list (max 10).

```
"What stratagems can I use in the Fight phase?"
"Show me Gladius Task Force stratagems"
```

**Parameters:** `query` (required), `faction` (optional), `phase` (optional), `detachment` (optional)

### `lookup_detachment`

Look up a detachment by name. Returns the detachment ability, available enhancements, and associated stratagems.

```
"Show me the Gladius Task Force detachment"
"What does the Warhost detachment do for Aeldari?"
```

**Parameters:** `name` (required), `faction` (optional), `game_mode` (optional: `40k`/`40k_11e` (default), `40k_10e`)

### `lookup_enhancement`

Look up a character enhancement by name. Returns points cost, detachment, and effect.

```
"What does Adept of the Codex do?"
"Show me Aeldari enhancements"
```

**Parameters:** `name` (required), `faction` (optional), `detachment` (optional), `game_mode` (optional: `40k`/`40k_11e` (default), `40k_10e`)

### `lookup_ploy`

Look up a Kill Team ploy by name. Returns type (strategic/tactical), CP cost, timing, and effect.

```
"What does the Bolster ploy do in Kill Team?"
"Show me Legionaries ploys"
```

**Parameters:** `name` (required), `faction` (optional), `type` (optional: `strategic`, `tactical`)

### `wound_calculator`

Calculate expected damage output for an attack profile against a target. Handles re-rolls, weapon keywords (Lethal Hits, Devastating Wounds, Sustained Hits, Torrent), invulnerable saves, and Feel No Pain.

```
"Calculate damage: 10 attacks, BS3+, S5 AP-1 D2 vs T4 Sv3+"
"How much damage does a lascannon do to a Leman Russ?"
```

**Parameters:** `attacks`, `hit_skill`, `strength`, `toughness`, `armour_save`, `damage` (all required); `armour_penetration`, `invulnerable_save`, `feel_no_pain`, `reroll_hits`, `reroll_wounds`, `weapon_keywords`, `wounds_per_model`, `game_mode` (all optional)

### `determine_primary_mission`

Determine each player's Primary Mission from their Force Dispositions (11th Edition Matched Play). Each player's mission is looked up from their *opponent's* Force Disposition — in a non-mirror matchup, the two players get different missions. Returns mission names only, not full scoring/objective text.

```
"I picked Take and Hold, my opponent picked Purge the Foe — what are our missions?"
"What's my Primary Mission if I'm Reconnaissance and they're Priority Assets?"
```

**Parameters:** `your_disposition`, `opponent_disposition` (both required, one of: `Take and Hold`, `Purge the Foe`, `Reconnaissance`, `Priority Assets`, `Disruption`)

### `lookup_crusade`

Look up Crusade content (narrative play). Returns Crusade rules, relics, battle traits, and upgrades.

```
"What Crusade relics can Space Marines take?"
"Show me the Crusade battle traits"
```

**Parameters:** `query` (required), `faction` (optional)

## Data

All data is embedded at build time — no network calls at runtime. Data is synced daily from BSData via GitHub Actions.

| Category | Count | Source |
|---|---|---|
| 40K unit datasheets (11th Edition, default) | 2,695 | [BSData/wh40k-11e](https://github.com/BSData/wh40k-11e) |
| 40K unit datasheets (10th Edition) | 2,666 | [BSData/wh40k-10e](https://github.com/BSData/wh40k-10e) |
| Kill Team operatives | 519 | [BSData/wh40k-killteam](https://github.com/BSData/wh40k-killteam) |
| Detachments (11th / 10th Edition) | 259 / 208 | BSData (auto-extracted) |
| Enhancements (11th / 10th Edition) | 895 / 827 | BSData (auto-extracted) |
| Stratagems | 1,316 | Hand-curated (Core Rules + detachment-specific per faction) |
| Kill Team ploys | 14 | Hand-curated (universal + popular factions) |
| Shared rules (11th / 10th Edition) | 35 / 33 | BSData |
| Shared rules (Kill Team) | 22 | BSData |
| Curated keywords | 25 | Hand-written, plain English, 11th Edition Core Rules |
| Game mode sequences | 3 | Hand-curated (40K, Combat Patrol, Kill Team) |
| Force Disposition mission matchups | 15 | Hand-curated (5 dispositions, full grid) |

### Game modes

- **Warhammer 40,000** (`40k` / `40k_11e`, default) — full-scale battles, 11th Edition rules
- **Warhammer 40,000, 10th Edition** (`40k_10e`) — full-scale battles, 10th Edition rules (permanently supported)
- **Combat Patrol** (`combat_patrol`) — smaller, starter-friendly format
- **Kill Team** (`kill_team`) — squad-level skirmish game

10th Edition support isn't going away when a newer edition is added — every `game_mode` value, once added, keeps working.

## Development

```bash
npm install
npm run build
npm test
```

To refresh unit data from BSData:

```bash
npm run fetch-data
npm run build
```

## License

MIT (for the MCP server code).

Unit data sourced from the [BSData](https://github.com/BSData) community project — [wh40k-10e](https://github.com/BSData/wh40k-10e), [wh40k-11e](https://github.com/BSData/wh40k-11e), and [wh40k-killteam](https://github.com/BSData/wh40k-killteam). Game rules and army rules are the intellectual property of Games Workshop. This tool provides reference data for personal use during gameplay.
