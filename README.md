# warhammer-oracle

Warhammer 40K rules, unit stats, and game flow — as an MCP server.

Ask your AI assistant about datasheets, keywords, phase sequences, and more. Covers Warhammer 40,000, Combat Patrol, and Kill Team.

[![Warhammer Oracle MCP server](https://glama.ai/mcp/servers/gregario/warhammer-oracle/badges/card.svg)](https://glama.ai/mcp/servers/gregario/warhammer-oracle)

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

Look up a unit datasheet by name. Returns stat profiles, ranged and melee weapons, abilities, and keywords.

```
"Look up the Intercessor Squad datasheet"
"What are the stats for a Leman Russ Battle Tank?"
```

**Parameters:** `unit_name` (required), `faction` (optional), `game_mode` (optional: `40k`, `combat_patrol`, `kill_team`)

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

Search units by name, faction, or keywords. Returns a compact list (max 10 results) with faction, points, and keywords.

```
"Find all Necron units under 100 points"
"Search for units with the Fly keyword"
```

**Parameters:** `query` (required), `faction` (optional), `max_points` (optional), `game_mode` (optional)

### `compare_units`

Compare 2-4 units side by side. Shows full datasheets for each unit in a single response.

```
"Compare Intercessors vs Tactical Marines"
"Compare the Leman Russ, Predator, and Hammerhead side by side"
```

**Parameters:** `units` (required, array of 2-4 unit names)

### `game_flow`

Show the full turn sequence for a game mode, or highlight where you are in the turn and what comes next.

```
"Show me the 40K turn sequence"
"I'm in the Shooting phase — what's next?"
"Show the Kill Team turn sequence"
```

**Parameters:** `current_phase` (optional), `game_mode` (optional, default: `40k`)

## Data

All data is embedded at build time — no network calls at runtime.

| Category | Count | Source |
|---|---|---|
| Unit datasheets | 1,066 | [BSData](https://github.com/BSData/wh40k-10e) community project |
| Shared rules | 33 | BSData |
| Curated keywords | 25 | Hand-written, plain English |
| Game mode sequences | 3 | Hand-curated (40K, Combat Patrol, Kill Team) |

### Game modes

- **Warhammer 40,000** (40k) — full-scale battles
- **Combat Patrol** (combat_patrol) — smaller, starter-friendly format
- **Kill Team** (kill_team) — squad-level skirmish game

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

Unit data sourced from the [BSData](https://github.com/BSData/wh40k-10e) community project. Game rules and army rules are the intellectual property of Games Workshop. This tool provides reference data for personal use during gameplay.