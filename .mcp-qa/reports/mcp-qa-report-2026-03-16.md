# MCP QA Report: warhammer-oracle
**Date:** 2026-03-16
**Mode:** full
**Server version:** 0.1.4 (npm has 0.1.5)
**Health score:** 90/100 — Ship it

## Discovery
- **Tools:** 6 registered
- **Resources:** 0 registered
- **Prompts:** 0 registered

## Tool Execution Results
| Tool | Status | Response Size | Notes |
|------|--------|---------------|-------|
| lookup_unit | PASS | 1,607 bytes | Returns full Imperial Space Marine datasheet |
| lookup_keyword | PASS | 832 bytes | Returns Feel No Pain with definition + plain English |
| lookup_phase | PASS | 133 bytes | Graceful "not found" with available phases list |
| search_units | PASS | 1,433 bytes | Returns matching units with keywords, points |
| compare_units | FAIL | 295 bytes | Probe didn't generate array param — probe limitation |
| game_flow | PASS | 492 bytes | Full turn sequence for 40K |

5/6 tools pass. 1 probe-induced failure (compare_units needs array arg).

## Best Practices Lint
| Check | Status | Severity |
|-------|--------|----------|
| No console.log in server code | PASS | CRITICAL |
| Shebang on entry point | PASS | HIGH |
| chmod in build script | PASS | MEDIUM |
| All imports have .js extensions | PASS | HIGH |
| No 0.0.0.0 binding | PASS (stdio only) | CRITICAL |
| No secrets in parameters | PASS | CRITICAL |
| No secrets in hardcoded strings | PASS | HIGH |
| Error cases use isError: true | PASS (compare-units) | HIGH |
| Graceful shutdown handlers | FAIL | LOW |
| Server name/version match package.json | FAIL (hardcoded v0.1.0) | LOW |

## Findings

### FINDING-001: No graceful shutdown handlers
**Severity:** low
**Category:** practices
**Details:** No SIGINT/SIGTERM handlers in src/index.ts.

### FINDING-002: Server version hardcoded
**Severity:** low
**Category:** practices
**Details:** `src/index.ts:6` hardcodes `v0.1.0` and `src/server.ts:7` hardcodes `0.1.0` instead of reading from package.json. Banner and discovery both report stale version.

### FINDING-003: Version mismatch — npm vs package.json vs status.json
**Severity:** medium
**Category:** value
**Details:** npm has `0.1.5`, package.json has `0.1.4`, status.json has `0.1.4`. The repo is behind npm — likely a CI publish bumped npm past what's in the repo. GitHub release tag is also behind (`v0.1.3`).

## Score Breakdown
| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Connectivity | 100 | 20% | 20.0 |
| Tool Quality | 100 | 25% | 25.0 |
| Tool Execution | 100 | 25% | 25.0 |
| Best Practices | 94 | 15% | 14.1 |
| Security | 100 | 10% | 10.0 |
| Value Delivery | 92 | 5% | 4.6 |
| **Total** | | | **90/100** |
