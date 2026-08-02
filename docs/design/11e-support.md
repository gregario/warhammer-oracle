# Design: 11th Edition Support

**Status:** Implemented 2026-07-10. `BSData/wh40k-11e` appeared (Trigger 1) with substantial coverage (~40 faction files, Trigger 2) and was picked up directly.
**Author:** Captured 2026-04-26 during fleet QA session.
**Scope:** Adding Warhammer 40,000 11th Edition support to `warhammer-oracle` without breaking existing 10e users, and establishing edition-disambiguation discipline that scales to future editions and game variants.

## Implementation notes (2026-07-10)

What shipped, and where it deviated from the plan below:

- **Phases 1–3 landed together**, not sequentially, since BSData/wh40k-11e already had full coverage by the time this was picked up — there was no empty-schema interim period to ship separately.
- **Rule 4 (default flip) happened immediately instead of waiting for a separately-documented parity milestone.** The original plan was to stay on `40k_10e` as default until autumn 2026. By the time this was implemented, wh40k-11e already covered all major factions, so the default flipped to `40k_11e` in the same change that added 11e support at all, rather than as a later, second event. This is still a documented event (this note, plus the README and CHANGELOG), just collapsed into one step instead of two.
- **Mode taxonomy is `40k_10e` / `40k_11e`, not fully mirrored for Combat Patrol/Kill Team.** Rule 5 anticipated `combat_patrol_10e`/`combat_patrol_11e` — that wasn't done because there's no 11e Combat Patrol BSData source yet. `combat_patrol` and `kill_team` are untouched.
- **BSData/wh40k-11e ships JSON, not BattleScribe XML** — a wrinkle this doc didn't anticipate (it assumed both repos would be the same `.cat`/`.gst` format). The underlying schema (profile-type UUIDs, catalogue/entryLink/library structure) is identical to 10e, just JSON-native instead of XML-attribute-encoded, so a normalization step (`normalizeJsonNode` in `src/lib/xml-parser.ts`) reshapes it into the same node shape the existing 10e extractors already expect. One genuine schema difference was found and fixed: 11e renamed the `SV` characteristic to `Sv`.
- **Hand-curated content (stratagems, phases, keywords, Kill Team ploys) was initially left as 10th-edition-only** — there was no 11e rulebook to author from at the time. Affected tool output carried a disclosure note. This wasn't one of the five rules above, but followed the same "don't silently blend editions" spirit.
- Rule 1 (mode-stamping) shipped as `[Mode: 40k 10e]` / `[Mode: 40k 11e]` / `[Mode: Kill Team]` headers on `lookup_unit`, `search_units`, `compare_units`, `lookup_detachment`, and `lookup_enhancement`.

## Follow-up (2026-07-10): Core Rules update

Once the official 11th Edition Core Rules PDF became available, `phases.ts`, the Core Stratagems in `stratagems.ts`, and the core abilities in `keywords.ts` were updated in place against that source (treating the existing 10e-authored content as a baseline to diff, not a wholesale rewrite — most mechanics carried over unchanged). Concrete rules deltas found and applied: Engagement Range is now 2" (was 1"); Reserves/Deep Strike/Infiltrators/Scouts distances dropped from 9" to 8" and Reserves can't arrive before battle round 2; Fire Overwatch moved from a charge-reaction to a Stratagem used at the end of the opponent's Movement phase; the 10e Battle Tactic/Strategic Ploy/Epic Deed/Wargear stratagem taxonomy was dropped in favour of a single "Core Stratagem" type (`type: "core"` added to the `Stratagem` union); Stealth now grants Benefit of Cover instead of a hit-roll penalty; Lethal Hits became optional; Precision no longer requires a critical hit; and Hazardous now uses the shared hazard-roll mechanic (fails on 1-2, no auto-destroy of Characters).

**Still 10th Edition-only, deliberately out of scope for this pass:** detachment-specific stratagems (`GLADIUS_TASK_FORCE_STRATAGEMS`, `SLAVES_TO_DARKNESS_STRATAGEMS` in `stratagems.ts`) — those come from Codexes/detachment packs, not the Core Rules PDF, and the scoping decision for this update was "Core Rules PDF only." `lookup_stratagem`/`search_stratagems` carry a disclosure note conditioned on `faction !== "Core"` rather than a blanket one.

## Follow-up (2026-07-10): faction pack stratagems (Space Marines, Chaos Space Marines)

Extended the above pass to detachment-specific stratagems using two 11th Edition Faction Pack PDFs the user provided (Space Marines, Chaos Space Marines) plus a pre-existing user-authored reference doc (`csm_11e_complete_reference_v4.md`) for corroboration on the Chaos Space Marines side. `GLADIUS_TASK_FORCE_STRATAGEMS` and `SLAVES_TO_DARKNESS_STRATAGEMS` were fully replaced (not just extended) — neither "Gladius Task Force" nor "Slaves to Darkness" is a detachment the 11e faction packs actually detail (they only turn up as legacy FAQ references), so keeping them would have meant showing stratagems for detachments that no longer exist in this form.

Coverage achieved: **all 15 Space Marines detachments** (`SPACE_MARINES_STRATAGEMS`, 78 stratagems) — the pack details every SM detachment, so this is complete. **9 of 17 Chaos Space Marines detachments** from the Faction Pack itself (Cabal of Chaos, Devotees of Destruction, Murdertalon Raiders, Warpstrike Champions, Cult of the Arkifane, Creations of Bile, Nightmare Hunt, Huron's Marauders, Renegade Warband); the other 8 CSM detachments are unrevised base-Codex content the Faction Pack doesn't reprint.

`lookup_detachment`'s Stratagems section and the `formatStratagem`/`search_stratagems` disclosure logic were both changed from "10e-vs-11e" branching to "does this specific detachment have data yet" branching, since detachment-specific coverage is now genuinely mixed by faction rather than uniformly absent for 11e.

## Follow-up (2026-07-10): CSM Codex-baseline layer via Wahapedia

Per user direction, established an explicit two-layer sourcing model for detachment-specific stratagems: an 11th Edition Faction Pack overrides the base Codex for any detachment it fully details; every other detachment still runs on the unrevised 10th Edition Codex baseline, since 11e hasn't touched it. For Chaos Space Marines, that baseline layer (the 8 detachments not in the Faction Pack — Chaos Cult, Deceptors, Dread Talons, Fellhammer Siege-Host, Pactbound Zealots, Renegade Raiders, Soulforged Warpack, Veterans Of The Long War) was sourced from Wahapedia's CSM page (`wahapedia.ru/wh40k10ed/factions/chaos-space-marines`), which hosts the current 10e Codex text. `CHAOS_SPACE_MARINES_STRATAGEMS` now covers all 17 CSM detachments (92 stratagems total), and its header comment documents which detachments belong to which layer, with a note that a future Faction Pack revision covering any of the 8 Codex-layer detachments should move them to the Faction Pack layer and re-source from that document instead. `STRATAGEMS` now totals 180 entries (10 Core + 78 SM + 92 CSM).

This same two-layer approach (Faction Pack overrides Codex-via-Wahapedia baseline) is the template to reuse for the remaining factions.

## Follow-up (2026-07-11): remaining 7 faction packs (Tau Empire, Chaos Daemons, Chaos Knights, Death Guard, Emperor's Children, Thousand Sons, World Eaters)

Applied the same two-layer sourcing model to every other faction pack sitting in the user's source folder. Each faction was handled by an independent background agent (PDF extraction via `pdftotext -layout`, cross-referenced against `detachments-11e.ts` for the current canonical detachment list, Faction Pack layer first, Wahapedia 10e Codex baseline layer for the rest), then reviewed and merged into `stratagems.ts` by hand. Results:

- **Chaos Daemons** (`CHAOS_DAEMONS_STRATAGEMS`, `faction: "Legiones Daemonica"` — the army-wide keyword used in the source text, not the BSData catalogue string): all 9 current detachments fully detailed in the Faction Pack itself, so no Wahapedia baseline layer was needed. 46 stratagems.
- **Chaos Knights** (`CHAOS_KNIGHTS_STRATAGEMS`): 4 detachments from the Faction Pack (Bastions of Tyranny, Hunting Warpack, Iconoclast Fiefdom — wholesale replaced, not patched — and Helhunt Lance), 4 from the Wahapedia Codex baseline (Traitoris Lance, Houndpack Lance, Infernal Lance, Lords of Dread). 39 stratagems.
- **Death Guard** (`DEATH_GUARD_STRATAGEMS`): 3 detachments from the Faction Pack (Contagion Engines, Flyblown Host, Paragons of Putrescence), 6 from the Wahapedia baseline (Virulent Vectorium, Mortarion's Hammer, Champions of Contagion, Tallyband Summoners, Shamblerot Vectorium, Death Lord's Chosen). 45 stratagems.
- **Emperor's Children** (`EMPERORS_CHILDREN_STRATAGEMS`): 4 detachments from the Faction Pack (Elegant Brutes, Frenzied Host, Spectacle of Slaughter, Court of the Phoenician), 6 from the Wahapedia baseline (Mercurial Host, Peerless Bladesmen, Rapid Evisceration, Carnival of Excess, Coterie of the Conceited, Slaanesh's Chosen), with a few Faction Pack "Rules Updates" errata folded into the baseline entries. 51 stratagems.
- **Thousand Sons** (`THOUSAND_SONS_STRATAGEMS`): 4 detachments from the Faction Pack (Ritual of Regeneration, Sekhetar Cohort, Servants of Change, Hexwarp Thrallband), 5 from the Wahapedia baseline (Grand Coven, Changehost of Deceit, Warpmeld Pact, Rubricae Phalanx, Warpforged Cabal). 45 stratagems.
- **World Eaters** (`WORLD_EATERS_STRATAGEMS`): 3 detachments from the Faction Pack (Brazen Engines, Butchers of Khorne, Vessels of Wrath), 5 from the Wahapedia baseline (Berzerker Warband, Cult of Blood, Khorne Daemonkin, Possessed Slaughterband, Goretrack Onslaught). 39 stratagems.
- **T'au Empire** (`TAU_EMPIRE_STRATAGEMS`): 3 detachments from the Faction Pack (Advanced Acquisition Cadre, Auxiliary Cadre, Experimental Prototype Cadre), 4 from the Wahapedia baseline (Kauyon, Mont'ka, Retaliation Cadre, Kroot Hunting Pack). Kroot Raiding Party and Starfire Cadre were skipped — both are Boarding Actions-only detachments with no matched-play stratagem section in either source. 31 stratagems.

**Data-quality finding, not fixed here:** four of the seven agents independently found and flagged the same issue in `detachments-11e.ts` — Chaos Daemons, Chaos Knights, and every Chaos Space Marines legion sub-faction (Death Guard, Emperor's Children, Thousand Sons, World Eaters, plus generic CSM) all carry an identical 25-34-entry superset of detachment names under their own `"faction"` tag, most of which actually belong to one of the other Chaos factions (e.g. "Daemonic Incursion" is tagged under all of them but is genuinely only a Chaos Daemons detachment). This looks like a BSData ingestion artifact — likely a shared "Chaos" detachment library catalogue being cross-attributed to every faction that imports it — worth a closer look at `fetch-data.ts`'s library-resolution logic if `lookup_detachment` accuracy for these factions becomes a concern. It did not block this stratagems pass: each agent cross-referenced against the Faction Pack's own table of contents and/or Wahapedia to identify the real detachment list per faction rather than trusting that tag.

`STRATAGEMS` now totals **476 entries** (10 Core + 78 Space Marines + 92 Chaos Space Marines + 46 Chaos Daemons + 39 Chaos Knights + 45 Death Guard + 51 Emperor's Children + 45 Thousand Sons + 39 World Eaters + 31 T'au Empire), covering 92 detachments across 9 factions.

**Not done:** the Event Companion PDF (supplementary matched-play rules, not a faction pack) sitting in the user's source folder hasn't been reviewed. Every other faction in the user's folder is now covered.

## Follow-up (2026-07-11): hardening pass on the 7-faction expansion

After the batch above, a self-review turned up gaps worth closing before calling it done: no automated tests covered the hand-curated `STRATAGEMS` array at all (not even the pre-existing Core/SM/CSM content), a handful of stratagem names collide across unrelated factions, and roughly 67 of the newly-added stratagems had a best-guess `type` field rather than a source-confirmed one. Addressed all three:

- **`tests/data-integrity.test.ts`** gained a `STRATAGEMS data integrity` block (10 tests): substantial count, required fields non-empty, valid `type` enum, non-negative CP cost, `gameModes` includes `"40k"`, Core Stratagems have `faction: "Core"`/`detachment: null`, detachment-specific stratagems never use `type: "core"`, no duplicate `(faction, detachment, name)` combos, spot-checks that every hand-curated faction is represented, and every non-Core stratagem has a non-null detachment.
- **`src/tools/lookup-stratagem.ts`**: fixed a real bug — 6 stratagem names recur across unrelated factions/detachments (e.g. "Spiteful Demise" exists for both Chaos Daemons and Chaos Knights), and an unscoped `lookup_stratagem` call would silently return whichever one happened to sort first in the array. Now, when the query exactly matches more than one distinct stratagem by name, the tool returns a disambiguation message listing each option's faction/detachment instead of guessing. Covered by two new tests in `tests/lookup-stratagem.test.ts`.
- **Stratagem `type` verification**: first tried visually inspecting the Faction Pack PDFs' stratagem-card icons (rendered to PNG via a locally-installed PyMuPDF, since this Windows box has `pdftotext` but not the rest of poppler-utils) on the theory that the icon shape might encode type even where the text label doesn't extract. Disproved that empirically — the same crosshair icon was used for a confirmed Battle Tactic (CSM's "Empyric Dislocation") and a confirmed Strategic Ploy ("Siegebreaker Strike") on the same page, so the icon encodes theme (shooting/movement/charge-phase flavour), not type. Pivoted to a secondary-source research pass instead: one background agent per faction searched Goonhammer, Tabletop Battles, Warhammer Community's Faction Focus articles, Frontline Gaming, Spikeybits, Bell of Lost Souls, 1d6chan, Wahapedia, and 40k.app for explicit type labels on the ~67 unconfirmed stratagems. Result: **11 confirmed** (2 in Tau's Auxiliary Cadre via a verified-identical 10e predecessor, 6 in Emperor's Children's Court of the Phoenician via 40k.app, 3 in Death Guard's Flyblown Host via Goonhammer) — one of which (Death Guard's "Eye of the Swarm") turned out to correct an actual wrong guess, from `battle_tactic` to `strategic_ploy`. The other 56 remain genuinely unconfirmed anywhere online as of this pass — notably, 40k.app itself (a site that structures stratagems into a `category` field) has that field explicitly empty for several of these, independent confirmation this is a real gap in community/official coverage right now, not a limitation of this project's extraction. Each affected faction's header comment in `stratagems.ts` documents exactly which stratagems are now confirmed (with source) and which remain best-effort, so a future pass can re-check the unconfirmed ones once community coverage (e.g. a Goonhammer Detachment Focus article) catches up.

## Follow-up (2026-07-11): fixed BSData detachment/enhancement cross-faction contamination

The four independent research agents in the previous entry all flagged the same thing: `detachments-11e.ts` tagged Chaos Daemons, Chaos Knights, and every Chaos Space Marines legion sub-faction with an identical, wildly oversized superset of detachment names, most of which belonged to a different faction. Root-caused it properly this time, by pulling the raw BSData catalogue JSON directly via the GitHub API rather than reasoning from the generated output.

**What's true and by design in BSData:** some factions ship as a thin "roster" catalogue plus a same-named "Library" catalogue holding their actual detachments (e.g. `Chaos - Chaos Daemons.json` is a stub that `catalogueLink`s into `Chaos - Chaos Daemons Library.json`, where Daemons' real 9-detachment group lives — same pattern for Chaos Knights and Imperial Knights). Separately, and also by design, Warhammer 40K lets armies field allied Knight/Daemon units, so BattleScribe also links dozens of *unrelated* faction catalogues into those same two library files purely for unit access — e.g. every Chaos legion links into "Chaos Knights Library"; **every Imperium faction** (Custodes, Sororitas, AdMech, Astra Militarum, every Space Marine chapter, Grey Knights) links into "Imperial Knights Library".

**The actual bug:** `scripts/fetch-data.ts`'s `fetchCatalogueRepo()` walked every `catalogueLink` on a catalogue unconditionally when extracting detachments/enhancements, with no way to tell "this is my own dedicated library" apart from "this is a shared library I only link to for allied units." It tagged everything it found in either case with the *importing* faction. Confirmed the scale directly against the live generated file before touching anything: `grep -c '"name": "Valourstrike Lance"' src/data/detachments-11e.ts` (one of Imperial Knights' own 8 detachments) returned **17** — one copy under every Imperium faction that links to that library, not just Imperial Knights.

Notably, this same mechanism is *correct* for **units** — an allied Imperial Knight genuinely is a selectable unit option in an Ultramarines list, so "Canis Rex" legitimately appearing under 17 different Imperium factions in `units-11e.ts` is accurate, not a bug. The fix only needed to touch detachment/enhancement extraction, since a 40K army only ever has one detachment of its own — it doesn't inherit an ally's.

**The fix:** added `libraryBelongsToFaction()` to `scripts/fetch-data.ts` — before walking a catalogueLink for detachments/enhancements, it checks whether the linked library's name corresponds to the importing catalogue's own faction (BattleScribe's `importRootEntries` flag doesn't distinguish the two cases — it's `true` on both a faction's own library link and its ally-unit library links, so it wasn't usable as the signal). First attempt used exact string equality after stripping catalogue-name prefixes and a trailing "Library" suffix, and shipped a real bug: BSData's own filename/internal-name pair disagree for the Daemons library (`Chaos - Chaos Daemons Library.json`'s internal `name` attribute is actually `"Chaos - Daemons Library"`, missing the repeated "Chaos"), so exact-match silently zeroed out Chaos Daemons' own 9 detachments. Caught it in verification (re-checking `DETACHMENTS_11E` per-faction after the first regen run, not just spot-checking the case that was already known-bad) and switched to substring matching, which tolerates the naming inconsistency while still correctly rejecting every unrelated pair.

**Regeneration:** ran a scoped one-off script (`fetch11e()` only, not the full `fetch40k()` + `fetchKillTeam()` pipeline) to stay within the anonymous GitHub REST API's 60-requests/hour cap — no `GITHUB_TOKEN` is configured in this environment, and a full three-repo refetch (10e's ~47 catalogue files + 11e's ~40 + Kill Team) would exceed it. Kill Team's fetch path doesn't use `parseDetachments`/`parseEnhancements` at all, so it was unaffected by the bug regardless. Result: `DETACHMENTS_11E` dropped from 1,246 to **259** entries, `ENHANCEMENTS_11E` from 4,192 to **895** — `UNITS_11E` unchanged at 2,695, as expected. Every Chaos/Knights faction's post-fix detachment list matches exactly what the independent stratagem research agents had already established by hand from the Faction Pack PDFs and Wahapedia, which is strong cross-validation that both passes landed on the same ground truth independently.

**10th Edition follow-up (2026-07-12):** confirmed the same bug existed in `detachments.ts`/`enhancements.ts` and fixed it too, once the user supplied a `GITHUB_TOKEN` (raising the cap from 60 to 5,000 req/hour) to get past the anonymous rate limit. `DETACHMENTS` dropped from 991 to **208**, `ENHANCEMENTS` from 3,908 to **827**; `UNITS` moved from 2,642 to 2,666 as an unrelated side effect of the source data having moved on since the last sync (unit extraction logic wasn't touched by this fix). Both regenerations used a temporary scoped script (`fetch40k()`/`fetch11e()` only, bypassing `fetchKillTeam()` since that pipeline never touches `parseDetachments`/`parseEnhancements` and was never affected) rather than the full `npm run fetch-data`, deleted after use.

## Follow-up (2026-07-12): Black Templars — first Space Marine chapter-specific Faction Pack

User downloaded 20 more Faction Packs (6 Space Marine chapters, 7 Xenos, 7 more Imperium) plus Doubles/Teams/Dominatus variants of the Event Companion, and asked for them to be processed one at a time rather than in a parallel batch like the original 7-faction push, to keep per-session resource usage down. Started with Black Templars (smallest file).

Structurally different from every faction covered so far: Black Templars isn't its own BSData faction the way Death Guard or Chaos Knights are — it still draws from the shared "Adeptus Astartes" pool of 15 generic Space Marines detachments already fully covered by `SPACE_MARINES_STRATAGEMS`. This Faction Pack only adds **chapter-exclusive** detachments on top of that shared pool, so `BLACK_TEMPLARS_STRATAGEMS` covers only those: Marshal's Household (3 stratagems) and Wrathful Procession (3 stratagems, wholesale replacing a different pre-11e stratagem set of the same detachment name — "replace, don't fork") from the Faction Pack itself; The Living Miracle is also a Faction Pack detachment but has zero stratagems by design (confirmed via full-document read, not an extraction gap — its whole toolkit is its detachment ability and enhancement). Three more detachments (Companions of Vehemence, Vindication Task Force, Godhammer Assault Force, 6 stratagems each) are 10e-Codex-baseline, sourced from **40k.app rather than Wahapedia** — Wahapedia's Black Templars page turned out to be significantly stale (listing only 3 of each detachment's real 6 stratagems, and missing "Heresy Begets Retribution" entirely, a stratagem this Faction Pack's own Rules Updates section confirms currently exists). This is the second time in this project 40k.app has proven more current than Wahapedia for a Space Marines-family detachment (Chaos Knights was the first) — worth defaulting to 40k.app first for future factions and treating Wahapedia as the fallback, rather than the reverse.

`STRATAGEMS` now totals **500 entries** (10 Core + 490 detachment-specific).

**Also investigated while reading the Event Companion PDF, not yet acted on:**
- **Base Size Guide** (~1,400 lines, base size per unit across every faction) — user approved adding this as a `baseSize` field on `Unit`, queued as the next task after faction packs are done.
- **Mission Sequence** (the pre-battle setup procedure — muster army → determine mission → deploy → etc.) — user clarified this is intentionally a *different layer* from `game_flow`/`phases.ts` (which cover in-battle-round phases only), not extraneous tournament fluff as I'd assumed. There are Matched Play, Doubles, Teams, and Dominatus variants of this layer, each in its own Event Companion PDF the user already has. Queued as the third task, after faction packs and base sizes.
- **Chapter Approved Mission Deck Errata/FAQ** — still not actionable; this project has no Mission Deck card data (Primary/Secondary Missions, Twist cards) to attach rulings to. Found two candidate sources for that underlying card data if the missions layer gets built out: [gdmissions.app/11th](https://gdmissions.app/11th/primary-missions) and [game-datamissions.com/11th](https://game-datamissions.com/11th), both fan-maintained databases with per-card detail pages (not just navigation stubs — confirmed by fetching one).
- **Pairings & Rankings** — pure tournament-organizer advice, not a game rule. Still out of scope.

## Follow-up (2026-07-12): continuing faction packs linearly, no subagents

User downloaded the remaining 20 Faction Packs and asked to process them one at a time in the main conversation (PDF extraction, sourcing, writing) rather than via background agents, to keep per-session usage down. Also added two memories capturing corrections from this stretch: [[reference-wahapedia-10e-only]] (Wahapedia is currently 10e-only, not permanently — re-check periodically) and [[feedback-11e-detachment-supersession]] (an 11e Faction Pack detachment fully replaces its 10e version even with a smaller stratagem count — don't backfill).

**Adepta Sororitas** (`ADEPTA_SORORITAS_STRATAGEMS`, 36 stratagems): 4 Faction Pack detachments (Chorus of Condemnation 3, Sacred Champions 3, Sanctified Orators 0 — enhancement-only by design, Champions of Faith 6 with confirmed types printed in the pack) + 4 Codex-baseline detachments via 40k.app (Hallowed Martyrs, Penitent Host, Bringers of Flame, Army of Faith — 6 each). All three baseline detachments the Faction Pack's Rules Updates section patches were already current on 40k.app, so no manual patching needed.

`STRATAGEMS` now totals **536 entries**.

**Genestealer Cults** (`GENESTEALER_CULTS_STRATAGEMS`, 45 stratagems, 9 of 11 detachments): 4 Faction Pack detachments (Heroes of the Uprising 3, Purestrain Broodswarm 3, Xenocult Masses 3, Final Day 6 with confirmed types) + 5 Codex-baseline detachments via 40k.app (Host of Ascension, Biosanctic Broodsurge, Brood Brothers Auxilia, Xenocreed Congregation, Outlander Claw — 6 each), all Rules Updates errata already reflected in 40k.app's current text. Skipped Cult Unveiled and Genespawn Onslaught — confirmed via BSData's own ability text that both are Boarding Actions scaffolding only (same as Tau's skipped detachments), not matched-play detachments with stratagems.

Caught and discarded one hallucinated source this pass: a WebFetch of Wahapedia's Genestealer Cults page for these two skipped detachments returned stratagem names copy-pasted from an unrelated detachment (Host of Ascension) paired with vague, non-mechanical effect text ("gains stealth benefits and improved concealment") — a clear tell that WebFetch's summarization model fabricated plausible-sounding content rather than extracting real page text. Verified against BSData's ability text directly instead of trusting it. Worth staying alert to this failure mode generally, not just for Wahapedia.

`STRATAGEMS` now totals **581 entries**.

**Aeldari** (`AELDARI_STRATAGEMS`, 78 stratagems, 15 detachments): first faction where BSData's 11e "Aeldari" faction string turned out to be a merged pool of four separate tabletop army identities — Asuryani (Craftworlds), Harlequins, Aeldari Corsairs (Anhrathe), and Ynnari — plus Drukhari, whose detachments (Covenite Coterie, Kabalite Cartel, Spectacle of Spite, Exhibition of Slaughter, Kabalite Agonysts, Tools of Torment, and the Drukhari/Harlequins-alliance Realspace Raiders, Skysplinter Assault, Reaper's Wager) were deliberately excluded from this pass since Drukhari has its own separate Faction Pack PDF and will be processed as its own faction. 7 Faction Pack detachments (Armoured Warhost 3, Fateful Performance 3, Path of the Outcast 3, Twilight Flickers 3, Serpent's Brood 6, Eldritch Raiders 6, Corsair Coterie 6) + 8 Codex-baseline detachments via 40k.app (Warhost, Windrider Host, Spirit Conclave, Guardian Battlehost, Ghosts of the Webway, Seer Council, Aspect Host, Devoted of Ynnead — 6 each). 40k.app already reflected every errata checked (Skyborne Sanctuary's patched Target/Effect, Windrider Host's Daring Riders/Overflight distance changes). Confirmed "Skyborne Sanctuary" is a genuine shared-name stratagem appearing in both Warhost's and Aspect Host's stratagem lists (not a scrape artifact — the Faction Pack's own errata section references it under both detachment headers too). Four of the seven Faction Pack detachments (Armoured Warhost, Fateful Performance, Path of the Outcast, Twilight Flickers) don't print a stratagem type in the source PDF, unlike every other faction covered so far — type was inferred from WHEN wording instead.

`STRATAGEMS` now totals **659 entries**.

**Necrons** (`NECRONS_STRATAGEMS`, 63 stratagems, 12/12 detachments): 7 Faction Pack detachments (Hand of the Dynasty 3, Skyshroud Spearhead 3, The Phaeron's Armoury 3, Starshatter Arsenal 6, Cryptek Conclave 6, Cursed Legion 6, Pantheon of Woe 6) + 5 Codex-baseline detachments via 40k.app (Awakened Dynasty, Annihilation Legion, Canoptek Court, Obeisance Phalanx, Hypercrypt Legion — 6 each). Same pattern as Aeldari: the three smallest Faction Pack detachments don't print a stratagem type in the source PDF, so type was inferred from WHEN wording. No BSData faction-merging wrinkle this time — Necrons is a single clean faction in both BSData and 40k.app.

`STRATAGEMS` now totals **722 entries**.

**Space Wolves** (`SPACE_WOLVES_STRATAGEMS`, 33 stratagems, 7 chapter-exclusive detachments): same structural pattern as Black Templars — not its own BSData faction, draws from the shared "Adeptus Astartes - Space Marines" 15-detachment pool already covered by `SPACE_MARINES_STRATAGEMS`. 4 Faction Pack detachments (Champions of Fenris 3, Legends of Saga and Song 3, Veterans of the Fang 3, Saga of the Great Wolf 6) + 3 Codex-baseline detachments via 40k.app (Saga of the Beastslayer 6, Saga of the Bold 6, Saga of the Hunter 6) — the 7 together match 40k.app's Space Wolves detachment list exactly once its 15 shared-pool entries are excluded. Notable: Saga of the Bold's 6 stratagems are all genuinely Epic Deed type (unusual — most detachments mix types), re-verified by asking 40k.app to quote its literal per-stratagem type label rather than trust a single summarized pass, per the WebFetch hallucination-tells memory.

`STRATAGEMS` now totals **755 entries**.

**Drukhari** (`DRUKHARI_STRATAGEMS`, 45 stratagems, 9/9 detachments): the faction deferred out of the Aeldari pass — BSData's 11e "Aeldari" faction string covers Drukhari's detachments too, but Drukhari has its own Faction Pack PDF and Codex identity, so it's processed here on its own. Covers all 9 BSData-tagged Drukhari detachments, matching 40k.app's Drukhari detachment list exactly. 4 Faction Pack detachments (Exhibition of Slaughter 3, Kabalite Agonysts 3, Tools of Torment 3, Reaper's Wager 6) + 5 Codex-baseline detachments via 40k.app (Covenite Coterie, Kabalite Cartel, Spectacle of Spite, Realspace Raiders, Skysplinter Assault — 6 each), the latter two being Drukhari/Harlequins-alliance detachments. 40k.app already reflected every errata checked (Covenite Coterie's Connoisseurs of Pain/Enfolding Nightmare rewrite, Skysplinter Assault's Swooping Mockery 8"-not-9" change, Spectacle of Spite's A Challenge Met rewrite).

`STRATAGEMS` now totals **800 entries**.

**Dark Angels** (`DARK_ANGELS_STRATAGEMS`, 39 stratagems, 8 chapter-exclusive detachments): same structural pattern as Black Templars and Space Wolves — not its own BSData faction, draws from the shared "Adeptus Astartes - Space Marines" 15-detachment pool. 5 Faction Pack detachments (Dark Age Arsenal 3, Darkflight Pursuit 3, Interrogation Conclave 3, Lion's Blade Task Force 6, Wrath of the Rock 6) + 3 Codex-baseline detachments via 40k.app (Company of Hunters, Inner Circle Task Force, Unforgiven Task Force — 6 each). "Armour of Contempt" is a genuine shared-name stratagem with identical text appearing across five of the eight detachments — confirmed via the Faction Pack's own text, not a scrape artifact.

`STRATAGEMS` now totals **839 entries**.

**Imperial Knights** (`IMPERIAL_KNIGHTS_STRATAGEMS`, 39 stratagems, 8/8 detachments): its own BSData faction, not shared with another army. 4 Faction Pack detachments (Dominus Foebreakers 3, Questor Forgepact 3, Throne-bonded Outriders 3, Freeblade Company 6) + 4 Codex-baseline detachments via 40k.app (Gate Warden Lance, Questoris Companions, Spearhead-at-Arms, Valourstrike Lance — 6 each). Questoris Companions is another all-Epic-Deed detachment (its whole theme is single-Knight heroics/duels), verified the same way as Space Wolves' Saga of the Bold rather than assumed.

`STRATAGEMS` now totals **878 entries**.

**Adeptus Mechanicus** (`ADEPTUS_MECHANICUS_STRATAGEMS`, 51 stratagems, 10/10 detachments): its own BSData faction. 5 Faction Pack detachments (Cohort Acquisitus 3, Lords of the Forge 3, Luminen Auto-choir 3, Eradication Cohort 6, Haloscreed Battle Clade 6) + 5 Codex-baseline detachments via 40k.app (Cohort Cybernetica, Data-psalm Conclave, Explorator Maniple, Rad-Zone Corps, Skitarii Hunter Cohort — 6 each). Two things worth a second look, both re-verified rather than assumed: Cohort Cybernetica's all-Command-phase stratagem list, and Rad-Zone Corps' repeated "if BATTLELINE, you can also target a second Skitarii unit" clause across every stratagem (the first fetch truncated these, so each was re-queried individually).

`STRATAGEMS` now totals **929 entries**.

**Leagues of Votann** (`LEAGUES_OF_VOTANN_STRATAGEMS`, 51 stratagems, 10/10 detachments): its own BSData faction. 5 Faction Pack detachments (Armoured Trailblazers 3, Farseekers 3, Hearthguard Covenant 3, Hearthband 6, Mercenary Oathband 6) + 5 Codex-baseline detachments via 40k.app (Brandfast Oathband, Dêlve Assault Shift, Hearthfyre Arsenal, Needgaârd Oathband, Persecution Prospect — 6 each). "Brøkkeknots", "Fury of the Hearth" and "Materialisation Matrices" are shared-name stratagems appearing with identical text in both Hearthguard Covenant and Hearthband — confirmed via the source PDF (same pattern seen in several prior factions), not a hallucination. This closes out the last of this session's four-faction batch (Dark Angels, Imperial Knights, Adeptus Mechanicus, Leagues of Votann).

`STRATAGEMS` now totals **980 entries**.

**Adeptus Titanicus** — skipped, not a stratagem-bearing faction. Its Faction Pack (290 lines, almost entirely Titan datasheets) states outright that Adeptus Titanicus armies "ignore the Select Detachment Rules step" when mustering — Titans are attached to other Imperium armies via the Titanic Support army rule rather than fielded as their own detachment-based force. Confirmed BSData's 11e `detachments-11e.ts` has zero entries with `faction: "Adeptus Titanicus"`, matching. No stratagems exist to source for this faction.

## Follow-up (2026-07-12): resuming the linear faction-pack batch — Adeptus Custodes

**Adeptus Custodes** (`ADEPTUS_CUSTODES_STRATAGEMS`, 45 stratagems, 9/9 detachments): first faction in this project where BSData ships units but **no detachments at all** — both `detachments.ts` (10e) and `detachments-11e.ts` (11e) have zero `"Adeptus Custodes"` entries, so every detachment here (Faction Pack and baseline alike) is hand-sourced from the Faction Pack PDF and 40k.app with no BSData cross-check available. 5 Faction Pack detachments (Might of the Moritoi 3, Silent Hunters 3, Tharanatoi Hammerblow 3, Lions of the Emperor 6, Solar Spearhead 6) + 4 Codex-baseline detachments via 40k.app (Auric Champions 6 — confirmed genuinely all-Epic-Deed via literal per-stratagem query, a character-only detachment consistent with that pattern, Null Maiden Vigil 6, Shield Host 6, Talons of the Emperor 6). Talons of the Emperor's "Taloned Pincer" 9"-to-8" errata was already reflected on 40k.app.

Notable: Silent Hunters and Null Maiden Vigil are both ANATHEMA PSYKANA/Sisters-of-Silence-flavoured detachments folded into the Adeptus Custodes faction rather than tracked separately — 40k.app lists both under the Custodes faction page, and the Faction Pack itself presents Silent Hunters as a full-detail Custodes detachment. "Unleash the Lions" is a genuine shared-name stratagem with identical text in both Tharanatoi Hammerblow and Lions of the Emperor, and "Flawless Construction" appears in both Might of the Moritoi and Solar Spearhead with the same mechanical concept (S>T attacks suffer -1 to wound) reworded for WALKER vs Vehicle scope — both confirmed directly from the source PDF, same shared-name pattern seen in several prior factions. Lions of the Emperor and Solar Spearhead print explicit type labels for all 12 of their stratagems; the other three Faction Pack detachments (8 stratagems net of the shared "Unleash the Lions") don't, so type was inferred from WHEN wording, consistent with the confirmed Solar Spearhead "Flawless Construction" being labelled battle_tactic.

`STRATAGEMS` now totals **1,025 entries**.

**Grey Knights** (`GREY_KNIGHTS_STRATAGEMS`, 45 stratagems, 9/9 detachments): its own BSData faction. 4 Faction Pack detachments (Argent Assault 3, Fires of Purgation 3, Immaterial Interdiction 3, Warpbane Task Force 6 with confirmed types printed in the pack) + 5 Codex-baseline detachments via 40k.app (Augurium Task Force 6, Banishers 6 — confirmed genuinely all-Epic-Deed via literal per-stratagem query, a PSYKER-only detachment consistent with that pattern, Brotherhood Strike 6, Hallowed Conclave 6, Sanctic Spearhead 6). Brotherhood Strike's "Combat Manifestation" 3"-to-6" errata was already reflected on 40k.app. The three smallest Faction Pack detachments don't print a stratagem type in the source PDF, so type was inferred from WHEN wording, same pattern as most factions covered so far.

`STRATAGEMS` now totals **1,070 entries**.

**Deathwatch** (`DEATHWATCH_STRATAGEMS`, 6 stratagems, 1 chapter-exclusive detachment): same structural pattern as Black Templars, Space Wolves and Dark Angels — not its own BSData detachments faction (units tagged "Adeptus Astartes - Deathwatch" but no separate detachment catalogue), draws from the shared "Adeptus Astartes - Space Marines" 15-detachment pool. Unlike those three chapters, the Faction Pack details only a single detachment, Black Spear Task Force — usable by any all-Deathwatch Adeptus Astartes army — with all 6 stratagems' types printed explicitly in the pack (Battle Tactic, Strategic Ploy, 3x Wargear, Strategic Ploy). No Rules Updates errata for any baseline detachment, unlike every other chapter-exclusive faction so far, consistent with there being no Deathwatch-exclusive Codex detachment to patch. "Armour of Contempt" reuses the same name and effect as Dark Angels' shared stratagem of the same name — no key collision since `(faction, detachment, name)` differs.

`STRATAGEMS` now totals **1,076 entries**.

**Blood Angels** (`BLOOD_ANGELS_STRATAGEMS`, 39 stratagems, 8 chapter-exclusive detachments): same structural pattern as Black Templars, Space Wolves, Dark Angels and Deathwatch — not its own BSData detachments faction, draws from the shared "Adeptus Astartes - Space Marines" 15-detachment pool. 5 Faction Pack detachments (Legacy of Grace 3, Encarmine Speartip 3, Wrath of the Doomed 3, Angelic Inheritors 6 with confirmed types printed in the pack, Rage-cursed Onslaught 6 — unusually, the pack prints no type for any of these 6, unlike every other 6-stratagem detachment covered so far, but all were confirmed via 40k.app) + 3 Codex-baseline detachments via 40k.app (The Angelic Host 6, with the Descent of Angels 3"-to-6" and Armour of Contempt errata both already reflected, The Lost Brethren 6, Liberator Assault Group 6). "Armour of Contempt" is a genuine shared-name stratagem appearing across all three baseline detachments plus Rage-cursed Onslaught — the Faction Pack's own Rules Updates section confirms this explicitly, patching its Effect text once "for The Angelic Host, The Lost Brethren, Liberator Assault Group Detachments" as a group, same pattern as Dark Angels and Deathwatch's shared use of the same stratagem name. This closes out this session's four-faction batch (Adeptus Custodes, Grey Knights, Deathwatch, Blood Angels).

`STRATAGEMS` now totals **1,115 entries**.

**Orks** (`ORKS_STRATAGEMS`, 63 stratagems, 12/12 detachments): its own BSData faction. 6 Faction Pack detachments (Rollin' Deff 3, More Dakka! 3, Taktikal Brigade 3, Speedwaaagh! 6, Blitz Brigade 6, Freebooter Krew 6 — all three 6-stratagem detachments with confirmed types printed in the pack) + 6 Codex-baseline detachments via 40k.app (War Horde, Da Big Hunt, Dread Mob, Green Tide, Bully Boyz, Kult of Speed — 6 each). Skipped Ramship Raiders and Kaptin Killers: confirmed via BSData's own ability text ("Mustering A Boarding Patrol") that both are Boarding Actions scaffolding only, same pattern as the skipped Tau and Genestealer Cults detachments. Dread Mob's "push it" gamble mechanic (present on 3 of its 6 stratagems) needed extra care — 40k.app's default summary collapsed the opening/closing clauses that define the gamble, so each was re-queried individually for full verbatim text rather than trusting the first summarized pass, per the WebFetch hallucination-tells memory.

`STRATAGEMS` now totals **1,178 entries**.

**Agents of the Imperium** (`AGENTS_OF_THE_IMPERIUM_STRATAGEMS`, 30 stratagems, 5/5 detachments): its own BSData faction (named "Agents of the Imperium" there and in units.ts; the Faction Pack file itself is titled "Imperial Agents", same GW naming split seen elsewhere). 1 Faction Pack detachment (Veiled Blade Elimination Force, 6 stratagems, all with confirmed types printed in the pack) + 4 Codex-baseline detachments via 40k.app (Alien Hunters (Ordo Xenos), Purgation Force (Ordo Hereticus), Daemon Hunters (Ordo Malleus), Imperialis Fleet — 6 each), matching both BSData's and 40k.app's 5-detachment total exactly. Alien Hunters' Rapid Tactical Relocation 9"-to-8" and Daemon Hunters' Truesilver Armour errata were both already reflected on 40k.app. "Armour of Contempt" reuses the same name and effect as Dark Angels', Deathwatch's and Blood Angels' shared stratagems of the same name.

`STRATAGEMS` now totals **1,208 entries**.

**Tyranids** (`TYRANIDS_STRATAGEMS`, 51 stratagems, 10/13 detachments): its own BSData faction. 4 Faction Pack detachments (Ambush Predators 3, Talons of the Norn Queen 3, Warrior Bioform Onslaught 3, Subterranean Assault 6 with confirmed types printed in the pack) + 6 Codex-baseline detachments via 40k.app (Invasion Fleet, Assimilation Swarm, Crusher Stampede, Synaptic Nexus, Unending Swarm, Vanguard Onslaught — 6 each), matching 40k.app's 10-detachment total exactly. Skipped Tyranid Attack, Boarding Swarm and Biotide: confirmed via BSData's own ability text ("Forming Boarding Squads") that all three are Boarding Actions scaffolding only, same pattern as the skipped Orks/Tau/Genestealer Cults detachments — the third faction where this specific skip pattern has recurred.

`STRATAGEMS` now totals **1,259 entries**.

**Astra Militarum** (`ASTRA_MILITARUM_STRATAGEMS`, 57 stratagems, 11/13 detachments): its own BSData faction. 6 Faction Pack detachments (Abhuman Auxiliaries 3, Bridgehead Strike 3, Designation Force 3, Steel Hammer 6 with confirmed types printed in the pack, Armoured Infantry 6 with confirmed types, Grizzled Company 6 — prints no type for any of its 6 in the pack, unlike Steel Hammer and Armoured Infantry, but all confirmed via 40k.app, same pattern as Blood Angels' Rage-cursed Onslaught and Deathwatch's Black Spear Task Force) + 5 Codex-baseline detachments via 40k.app (Combined Arms, Siege Regiment, Mechanised Assault, Hammer of the Emperor, Recon Element — 6 each), matching 40k.app's 11-detachment total exactly. Skipped Tempestus Boarding Regiment and Embarked Regiment: confirmed via BSData's own ability text ("Mustering A Boarding Patrol") that both are Boarding Actions scaffolding only — the fourth faction this session where this specific skip pattern has recurred (after Orks, Tau, Genestealer Cults, Tyranids).

`STRATAGEMS` now totals **1,316 entries**.

This closes out the eight-faction queue from this session's `/opsx` continuation (Adeptus Custodes, Grey Knights, Deathwatch, Blood Angels, Orks, Agents of the Imperium, Tyranids, Astra Militarum). Every 11th Edition Faction Pack GW has released to date is now covered in `stratagems.ts`.

## Follow-up (2026-07-13): Force Dispositions and the `determine_primary_mission` tool

User asked whether this project tracks 11th Edition Force Dispositions and the disposition-matchup mechanic used to determine each player's Primary Mission — it didn't; the `Detachment` type has no such field and there was no missions/dispositions data at all. Also raised, correctly, that the actual Chapter Approved Mission Deck isn't freely available from GW, so it can't just be copied in.

Investigation found a legitimate free source already on hand: GW's own "Warhammer Event Companion" PDF (already in the user's Dropbox, already `pdftotext`-extracted to scratchpad from earlier work). It documents the mechanic directly (pick a Force Disposition when mustering; look up your *opponent's* disposition to find your own Primary Mission) and gives terrain layouts per matchup — but the designer's note in the PDF itself says it's a deliberately reduced subset of the full Mission Deck (no Deployment or Twist cards), and it only covers 7 of the 15 unique disposition pairings across 3 of the 5 known dispositions (Take and Hold, Purge the Foe, Disruption — "Reconnaissance" and "Priority Assets" only partially appear).

For full coverage, checked game-datamissions.com/11th (a fan compilation, one of the two candidate sources noted in the April 2026 doc's original investigation). Its fetched matrix page had a real defect: every cross-pairing row's "Opponent Mission" column was wrong — a table-alignment artifact of WebFetch's HTML→markdown conversion, not necessarily an error in the underlying site. Caught it by cross-referencing the site's own reversed-order row for the same pairing (e.g. "Purge the Foe vs Take and Hold" contradicted "Take and Hold vs Purge the Foe" on the same fact) and by cross-checking against the 7 pairings already verified from GW's own PDF. Fix: reconstruct the grid using only each row's "Your Mission" column (verified correct in every case checked), read from both directions of each pairing — this produced a full, internally consistent 5×5 grid that matched the 7 GW-verified cells with zero discrepancies.

Also checked whether full Primary Mission scoring/VP text is available anywhere (e.g. `https://game-datamissions.com/11th/primary-missions/take-and-hold/battlefield-dominance`) — it isn't; that page doesn't render the actual card text, just navigation/header info. Confirms the full Chapter Approved text genuinely isn't freely available anywhere found, so scope was deliberately kept to mission *names* only, never their scoring rules.

Added: `Disposition` and `MissionMatchup` types ([types.ts](../../src/types.ts)); `DISPOSITIONS` and `MISSION_MATCHUPS` (15 entries, full grid) in [dispositions.ts](../../src/data/dispositions.ts), with the sourcing/verification story recorded in the file's header comment; a new `determine_primary_mission` tool ([determine-primary-mission.ts](../../src/tools/determine-primary-mission.ts)) that takes both players' dispositions and returns each one's Primary Mission name, with an explicit disclosure that this is names only. 277 tests passing (added `tests/determine-primary-mission.test.ts` plus updates to `tests/server.test.ts`'s tool count/list).

**Not yet possible:** which Force Disposition(s) a given detachment/army can pick. Checked the Space Marines Faction Pack's text extraction for a "Disposition: X" label and found none — like the Event Companion's matchup pages, this appears to be conveyed by an icon in the PDF, not text, so it isn't recoverable via this project's usual `pdftotext` extraction. Would need either the Warhammer 40,000 App, the physical Force Disposition cards, or PDF page-image rendering plus manual icon identification (poppler-utils is now installed locally, per the earlier GitHub-install-fix session, so the tooling exists if this gets revisited).

## Follow-up (2026-07-13): `unitSize` — per-unit model-count range

Motivated by a real failure: a user testing the MCP server in Claude Desktop had the connected AI suggest adding a third model to Obliterators, which are actually a fixed 2-model unit. Root cause: `Unit` had no model-count field at all, so any AI advice about squad composition necessarily came from its own (apparently wrong) general knowledge, not from tool data. Separately, investigating the raw BSData constraint that would answer this surfaced a real pitfall worth its own memory ([[feedback-bsdata-constraint-semantics]]): a unit's outer `selectionEntry` and a nested child `selectionEntry` can both carry `min`/`max` constraints that look like candidates for "model count" but answer different questions — the outer one is often the generic Force Organization roster-selection limit (e.g. "max 3 copies of this non-Battleline datasheet at Strike Force"), unrelated to how many models are in one instance of the unit.

**Algorithm** (`extractUnitSize` in [xml-parser.ts](../../src/lib/xml-parser.ts)): sum the model-count contribution of each of a unit's direct child `selectionEntries`/`selectionEntryGroups`. A child contributes its own explicit `min`/`max` "selections" constraint (scoped to `parent`, not `force` — force-scoped constraints are always a roster limit, not model count) if it has one; otherwise it contributes exactly 1 if it has its own inline content (a champion's weapon-option wrapper group, representing one mandatory model slot expressed via nested choices), or 0 if it's a pure reference to shared content elsewhere (e.g. a character's "Crusade" group, which only links out to universal narrative-play rules and describes no model at all). A unit whose own top-level type is "model" rather than "unit" (a single named character or vehicle with no wrapping container, e.g. a Sorcerer) starts from a baseline of 1 for itself before summing children, since its children are typically wargear/psychic-power choice groups, not additional models.

Validated in three passes before trusting it at scale. First, against ~40 hand-picked units spanning every structural pattern found (fixed-size squads, variable squads, champion+variable-troop composites, single characters with attached companions, vehicles, Legends datasheets), including two live cross-checks against Wahapedia's 11e pages for values that looked surprising but turned out correct (Khorne Berzerkers 10-20, Noise Marines fixed 6). Second, after wiring into the real fetch pipeline and regenerating both editions' full unit data, a `data-integrity.test.ts` check across all ~5,300 units caught 42-43 real units computing to an invalid `{min:0, max:0}` — all single-model characters/vehicles whose top-level entry is typed `"model"` (e.g. Sorcerer, Land Raider Crusader), which the original algorithm never gave a baseline of 1 to. Fixed by the type="model" baseline rule above. Third, after re-regenerating, exactly one remaining case (Space Wolves' "Wolf Guard Headtakers", the only unit found whose entire composition is expressed via `entryLink`s to shared library content rather than inline entries — indistinguishable from an unrelated reference like "Crusade" using this function's local-only view) still computed to `{0,0}`. Properly resolving it would mean threading fetch-data.ts's global shared-entry index into `extractUnitSize`, judged not worth it for one unit; added a floor instead — a computed 0 always falls back to `{1,1}`, since no real unit has zero models, even where its true (possibly larger) composition isn't recoverable here. Re-validated clean at `0` invalid entries across both editions after that.

Getting the real data regenerated with these fixes took three attempts. Anonymous GitHub API access is 60 req/hr; a full 10e+11e unit refetch needs ~95, so the first attempt was split across two hourly windows using one-off `fetch-10e-only.ts`/`fetch-11e-only.ts` scripts (each writes its own output immediately, unlike the combined `fetch-data.ts`, which only writes anything after 10e+11e+Kill Team *all* succeed). The second attempt (after the type="model" baseline fix needed a full re-regeneration) mistakenly ran the combined script instead of reusing the split ones — it failed partway through 11e and, because of that all-or-nothing write behavior, produced zero output, wasting an entire fresh window. The user then provided a `GITHUB_TOKEN` (5000 req/hr), which fixed the underlying constraint for good — but pasting the raw token into the chat tripped an automated credential-exposure check when handed to a Bash command directly. Resolved by having the user save it to a local file themselves and loading it by path (`export GITHUB_TOKEN=$(cat path)`), so the literal value never appeared in any tool call; the file was deleted immediately after use, and the user was advised to revoke/regenerate the token regardless, since it had already touched the chat transcript once.

Added: `UnitSize` type and `unitSize: UnitSize` field on `Unit` ([types.ts](../../src/types.ts)); `extractUnitSize`/`extractCountConstraint`/`hasOwnInlineContent` in `xml-parser.ts`, wired into `parseEntryNode` and `parseCatalogue`; `formatUnitSize` in [format.ts](../../src/lib/format.ts), surfaced in `lookup_unit`, `search_units`, and `compare_units`. Regenerated `units.ts`/`units-11e.ts` (2,666 / 2,695 units, unchanged counts) plus detachments/enhancements/rules/Kill Team data as a side effect of the full re-fetch (Kill Team operatives 506 → 519, reflecting upstream BSData additions since the last sync, not a regression). 291 tests passing.

**Not yet done:** exposing the roster-selection-limit constraint (the outer, battle-size-dependent "max N copies" field) as its own piece of data — deliberately out of scope for this pass, which was about fixing the model-count bug specifically, not building out the full army-construction ruleset. Also not done: resolving `entryLink`-only compositions like Wolf Guard Headtakers to their true size rather than the `{1,1}` floor.

## Follow-up (2026-07-14): fixed a separate, pre-existing bug — deeply-nested weapon profiles weren't being collected at all

User asked why the chat showed no weapons for Obliterators' and Warp Talons' datasheets. Not caused by anything from the `unitSize` work — a real, pre-existing bug in `collectAllProfiles`/`collectAllProfilesWithGlobalLinks` (`xml-parser.ts` / `fetch-data.ts`), unrelated to this session's other changes, just discovered by coincidence while looking at the same unit family.

**Bug 1 — inline profiles nested deeper than 2 hardcoded levels.** `collectAllProfiles` only ever walked `entry.profiles`, `entry.selectionEntries[].profiles`, and `entry.selectionEntryGroups[].selectionEntries[].profiles` — three hardcoded shapes. Obliterators' actual weapon profiles live at `unit -> "Obliterator" model sub-entry -> "Wargear" group -> "Crushing fists"/"Fleshmetal guns" entries -> profiles`, one level past what the old function reached. Fixed by rewriting it as a straightforward recursive walk of `selectionEntries`/`selectionEntryGroups` at any depth (not following `entryLinks` — that's a separate concern, see below).

**Bug 2 — some weapons are referenced via `entryLink` rather than defined inline.** Chaos Daemons' Bloodletters, for instance: the "Bloodletter" model sub-entry has zero inline content at all — its "Hellblade" weapon is purely a reference-by-id (`entryLink`) to a shared library entry. The existing `collectAllProfilesWithGlobalLinks` only checked three hardcoded spots for `entryLinks` (the top-level unit, a group, a group's sub-entries) — never a *direct* sub-entry of the unit, which is exactly where Bloodletters' link lives.

Fixing bug 2 was more dangerous than it looked. First attempt: made `entryLink` resolution fully recursive, matching bug 1's fix. This caused a real production incident — regenerating the data produced a 2.4-million-line `units-11e.ts` (up from ~250K) and OOM-crashed the test suite. Root cause: BSData's `entryLink`s aren't all narrow references like "Hellblade" — many (`Enhancements`, `Warlord`, `Crusade`, universal `Weapon Modifications`, `Crusade Relic Upgrades`, `Battle Traits`) point to broad shared option pools (an entire faction's Enhancements catalogue, every Warlord Trait in the book), and one unit's "abilities" count ballooned to ~397 by pulling one of those in wholesale. Tried a structural fix first ("only follow a link if it's a node's *sole* content") — this correctly excluded the bloat sources but also wrongly excluded legitimate cases like Astra Militarum's Cadian Shock Troops, where a wanted link (`Shock Trooper Sergeant`) legitimately coexists with other real content on the same node. Landed on a name-based denylist instead (`UNIVERSAL_OPTION_POOL_LINK_NAME_PATTERN` in `fetch-data.ts`, matching enhancement/warlord/crusade/weapon-modification/battle-trait/battle-scar/requisition in the link's own name, case-insensitive) plus a hard ceiling (`MAX_PROFILES_PER_UNIT = 100`) as a circuit breaker against any *other* unanticipated shared-pool category — which did in fact catch one during regeneration (Death Guard's Poxwalkers linked to "Battle Traits", not yet in the denylist at that point; added it, re-ran, zero warnings after).

Verified before and after against a hand-picked set spanning both bug patterns: Obliterators/Warp Talons (bug 1), Bloodletters/Ravenwing Command Squad/Cadian Shock Troops (bug 2, including the denylist's precision), Poxwalkers (the circuit-breaker catch). Dataset-wide: units with zero weapons dropped from 148 (10e) / 148 (11e, before any fix) to 15 (11e) — the remaining 15 confirmed legitimately unarmed (terrain/fortification datasheets, Tyranid mine-units that detonate rather than attack, a Drop Pod). Added regression tests in `data-integrity.test.ts`: explicit weapon-presence checks for all five hand-picked units, a dataset-wide "fewer than 30 zero-weapon units" ceiling, and a dataset-wide "no unit has ≥100 abilities" ceiling (guards against a repeat of the blowup). 298 tests passing.

**Known remaining gap, deliberately not chased further:** a *third* BattleScribe reference mechanism, `infoLinks` (structurally similar to `entryLinks` — `{id, name, targetId, type: "profile"|"rule"}` — but semantically "this entry's profile IS this reference," used for weapons like World Eaters' Exalted Eightbound's "Chainblades"). Not handled — doing so safely would need the same bloat-risk analysis just done for `entryLinks` (an `infoLink` could plausibly point to shared pools too), and this was already a deeper rabbit hole than expected for what started as "why no weapons." Affects a small remaining slice of units (Exalted Eightbound confirmed; likely a few others sharing this exact pattern).

---

## Follow-up (2026-07-22): Chaos Space Marines Faction Pack v1.1 errata, applied ahead of BSData

GW released Faction Pack v1.1 for Chaos Space Marines (legal from 22nd July 2026) the same day this was worked. Checked `BSData/wh40k-11e` directly via the GitHub API first — no bulk update reflecting it yet (just routine pre-existing point-fix issues), and per user direction this project deliberately doesn't duplicate BSData's own MFM/Faction-Pack-reading work, so a normal `npm run fetch-data` pull was out of scope. Instead, manually patched the small set of known, PDF-verified deltas directly into `detachments-11e.ts`, `enhancements-11e.ts`, and `stratagems.ts`, each marked with a `[MANUAL PATCH 2026-07-22: ...]` note pointing back here — reconcile/remove those notes once BSData actually syncs and the real `fetch-data.ts` regeneration would naturally supersede them (`detachments-11e.ts`/`enhancements-11e.ts` — do-not-edit-manually generated files, so these patches are intentionally temporary and fragile to the next real regen; `stratagems.ts` is hand-curated anyway, so its patches are permanent until the next Faction Pack revision).

**Applied (confirmed real deltas against the pack's own "What's New?" and "Rules Updates" pages):**
- `detachments-11e.ts` — Cabal of Chaos's **Empyric Wellspring**: Fight-phase bonus now also triggers off DAEMON PRINCE WITH WINGS, not just DAEMON PRINCE. Chaos Cult's detachment rule: added the previously-unmodeled "TRAITOR GUARDSMEN SQUAD units gain BATTLELINE" keyword grant.
- `enhancements-11e.ts` — Nightmare Hunt's **Sorrowscent Vulture** and Veterans Of The Long War's **Eager for Vengeance** were both missing their bearer-restriction clause entirely (`CHAOS LORD WITH JUMP PACK model only.` / `HERETIC ASTARTES model only (excluding DAMNED models).`) even though 506 other entries in the same file do carry this clause — a real pre-existing gap, not new. Chaos Cult's **Warped Foresight** was missing its `DARK APOSTLE or DAMNED model only.` restriction the same way. Deceptors' **Falsehood** had its third sentence corrected: it now selects an entire unit, not "a model in" a unit.
- `stratagems.ts` (already hand-curated from the Faction Pack, but sourced from the earlier v1.0/20-June pack per its own header comments, so genuinely stale) — 6 stratagems fixed: **Relentless Pursuit** and **Millennia of Experience** (9"→8"), **Bringers of Despair** (2CP→1CP, "Start of the Fight phase"→"Fight phase"), **Contemptuous Disregard** and **Unfailingly Obdurate** (both reworded to GW's newer "worsen the Armour Penetration characteristic" phrasing), and all three Soulforged Warpack stratagems (**Feeding Frenzy**, **Unstoppable Rampage**, **Predatory Pursuit**) — the target line was missing the `HERETIC ASTARTES DAEMON` qualifier (previously read as any `VEHICLE`, which is broader than intended), Predatory Pursuit was also missing an Engagement Range restriction and had the wrong range (9"→8").

**Confirmed already correct, no change needed:** Defiler's Daemonforge ability (`units-11e.ts`), Chaos Lord in Terminator Armour's `CHAOS LORD` keyword, Warp Talons' Warp Strike ability, and Pactbound Zealots' Marks of Chaos restrictions all already matched the pack's text — reassuring, since it means the bulk of the CSM Faction-Pack-layer content was already current before this pass.

**Deliberately not chased in this pass — flagged as a larger follow-up:** the pack's "Rules Updates" page lists roughly a dozen more datasheet-level items (Abaddon's Dark Destiny, Cypher's Agent of Discord, Fabius Bile's Chirurgeon, Accursed Cultists' Howling Horde, Obliterators' Warp Rift Firepower, several Vashtorr the Arkifane abilities and weapon profiles, Lord Discordant on Helstalker's move/invuln/abilities, Chaos Predator Annihilator/Destructor changes, Heldrake's profile and keywords, a `FRAME` keyword addition across 7 unit types, Chaos Rhino/Land Raider transport-capacity wording). Checked one of these (Fabius Bile) and found the same named ability duplicated across 4 separate per-allying-faction copies of the unit in `units-11e.ts` (Chaos Daemons, Chaos Knights, and two Chaos Space Marines copies) — meaning a correct fix isn't one edit but potentially several per item, since each faction's copy needs the same correction and it's not obvious from text alone which of the "Rules Updates" page's cumulative list is genuinely new in v1.1 vs. already-applied since the pack's first iteration (the page marks new-this-version changes in red, which is lost in PDF text extraction). This is realistically its own dedicated pass, same shape as the per-faction stratagem sessions logged above — not something to rush through inline.

Also noted, not yet acted on: GW released a companion **"Universal Rules Updates v1.0"** document (separate PDF, applies across all factions — CP-cost-reduction wording for named stratagems, once-per-phase wording, a 12"→18" targeting-immunity range change, and a one-per-battle cap on "add an identical unit" stratagems). Not cross-checked against any specific stratagem in this project yet.

Rebuilt (`npm run build`) and ran the full suite (`npm test`, 309/309 passing) after applying the above.

## Follow-up (2026-07-24): routine BSData sync clobbered the v1.1 manual patches — restored, still not synced

Ran a normal `npm run fetch-data` update (per user request, no known issue driving it — just picking up whatever's landed on BSData since 2026-07-19). Confirmed via the GitHub API that BSData had picked up 7 small routine fixes since then (Astra Militarum Scouts wording, Drukhari Mandrake/Dark Vitality points, Necrons Ophydian Destroyers points, Adepta Sororitas Chorus of Condemnation card-consistency, Chaos Daemons Prince enhancement-eligibility) — none of them the CSM v1.1 errata logged above.

As expected from the note in that entry (these patches live only in the generated files, "intentionally temporary and fragile to the next real regen"), the regeneration silently reverted all 6 of the manual patches back to the stale BSData text: Dark Pacts' BATTLELINE keyword grant, Cabal of Chaos's DAEMON PRINCE WITH WINGS trigger, and the four enhancement bearer-restriction/wording fixes (Eager for Vengeance, Falsehood, Warped Foresight, Sorrowscent Vulture). Caught this by diffing the regenerated files against the pre-regen commit rather than just trusting the fetch output, since the design doc itself flagged this exact risk. Confirmed directly from the freshly-fetched content (not just a commit-message search) that BSData genuinely still hasn't synced any of these — the reverted text is the same stale wording the original 2026-07-22 patch described, not some independently-changed variant.

Restored all 6 patches on top of the fresh regeneration, updating each `[MANUAL PATCH ...]` note to record it was reconfirmed still-needed on this date rather than dating them as new. `stratagems.ts` (hand-curated, not touched by `fetch-data.ts`) was unaffected — its 6 patched stratagems were never at risk.

**Process note for next time:** hand-editing the generated `.ts` files directly (rather than via a script) hit a real footgun — passing literal `\n` sequences through a `node -e` inline argument via the Bash tool did not survive as the intended two-character `\` + `n` escape; it collapsed to an actual newline character, which corrupted `detachments-11e.ts`'s JSON-in-TS syntax badly enough to fail `tsc` outright (caught immediately by running it, not left unnoticed). Recovered by writing a small standalone `.mjs` script to disk (via the Write tool, which isn't subject to that shell-escaping layer) that merged the corrupted physical lines back into one logical line using `String.fromCharCode(92) + "n"` to construct the literal escape unambiguously, then re-verified with `tsc --noEmit` before proceeding. **Lesson: when a generated data file needs a literal `\n` (or similar escape) inserted via a shell command, don't trust an inline `node -e`/similar one-liner's escaping through this Bash tool — write the transform to a script file first, or use the Edit tool's exact-string-match (safe, not shell-processed) instead.**

This will keep happening on every `fetch-data` pull until BSData actually syncs the CSM v1.1 errata — worth checking `Chaos - Chaos Space Marines.json` specifically (Dark Pacts / Empyric Wellspring / the four enhancements above) before future routine syncs, and removing the manual patches for good once it does.

Rebuilt and ran the full suite (309/309 passing) after restoring the patches.

## Follow-up (2026-07-27): fixed a real bug — every unit was missing its army-wide keyword (Heretic Astartes, Adeptus Astartes, ...)

User reported the MCP-connected AI couldn't confirm Predator/Defiler/Helbrute have the HERETIC ASTARTES keyword. Root cause was much broader than those three vehicles: `extractKeywords()` (`xml-parser.ts`) dropped every categoryLink whose name started with `"Faction: "` outright, on the assumption it was redundant bookkeeping duplicating the catalogue-derived `faction` field (e.g. a generic "Faction: Imperium" grouping tag). Checked the actual raw BSData JSON directly rather than trusting that assumption: for every catalogue checked (Chaos Space Marines, Space Marines, Necrons, Orks), the *only* `"Faction: X"` categoryLink value used is the real per-unit army-wide rules keyword — `"Faction: Heretic Astartes"`, `"Faction: Adeptus Astartes"`, `"Faction: Necrons"`, `"Faction: Orks"` — the exact keyword ability/enhancement/stratagem text constantly gates on (`"HERETIC ASTARTES model only"`, etc.), never a throwaway umbrella label. Confirmed via 10e's CSM catalogue that this same categoryLink mechanism is also how a unit embedded in a shared catalogue gets its own sub-tag (Emperor's Children units inside the old shared CSM catalogue carry `"Faction: Emperor's Children"` alongside `"Faction: Heretic Astartes"`), so dropping the entry outright rather than just its label prefix was never correct for any catalogue checked. Result before the fix: **all 137 Chaos Space Marines units** (not just vehicles) had zero army keyword.

Fix: strip only the `"Faction: "` prefix, keep the value as a normal keyword, rather than filtering the categoryLink out. Verified in the freshly-regenerated data: Predator/Defiler/Helbrute/Chosen all now carry `"Heretic Astartes"`; 114 of 137 CSM units do overall — the 23 that don't are legitimately Chaos Daemons-ally units embedded in the CSM catalogue for army-list access (Nurglings, Bloodletters, Plaguebearers, etc. — tagged `"Legiones Daemonica"` instead, correctly, since they're Daemons not Space Marines), matching the user's own framing ("anything not an ally should have the keyword"). Added 3 regression tests to `data-integrity.test.ts` (exact check on the 5 units the user named, a >70% CSM-wide threshold accounting for the Daemon-ally exceptions, and a cross-faction check for Space Marines/"Adeptus Astartes" and Necrons/"Necrons") plus updated the pre-existing keyword-extraction unit tests in both `xml-parser.test.ts` files, which previously only asserted the raw `"Faction: X"` string was absent (still trivially true) rather than that the unprefixed keyword was actually present.

**Separate, narrower bug found but not fixed this pass:** while investigating, found ~25 units across ~8 factions (Fabius Bile, Traitor Enforcer, several Adepta Sororitas/Orks/Space Wolves/Deathwatch entries) with suspiciously sparse keyword lists (1-2 keywords, missing even their own name as a keyword). Root cause for Fabius Bile specifically: it's structured in BSData as a `type: "unit"` wrapper carrying only `["Epic Hero"]` on itself, with the real keyword set (`Infantry`, `Character`, `Chaos`, etc.) living on its single nested `type: "model"` child — `extractKeywords()` only reads the top-level entry passed to it, never descends into children the way `collectAllProfiles` does for profiles/abilities. This is a distinct pattern from the fix above (not every "Faction:" categoryLink being dropped, but the whole keyword set living one level down for this specific "thin unit wrapper around one named-character model" shape), affects a different structural case per faction, and wasn't what the user asked about — flagged here as a real follow-up rather than expanding this pass's scope.

Also ran the CSM points-update sync the user asked for in the same session: picked up 22 point changes on Chaos Space Marines units (Abaddon 285→295, Chosen 125→135, Chaos Predator Annihilator/Destructor +10 each, Chaos Rhino 75→65, Khorne Berzerkers 180→170, etc.) plus 13 units removed upstream (`Vanguard Veteran Squad (Armageddon)` across every Space Marine chapter — a Legends datasheet BSData dropped, not a bug here). Re-checked and re-applied the 6 CSM Faction Pack v1.1 manual patches from the 2026-07-22/07-24 entries above against this newest pull: BSData has now synced **one** of the six (Cabal of Chaos's Empyric Wellspring DAEMON PRINCE WITH WINGS trigger — patch removed, no longer needed), the other five are still stale and were re-applied with an updated reconfirmation date. Sorrowscent Vulture's upstream text also newly dropped its second sentence (the Warp Talons attachment clause) in this pull, independent of the restriction-clause gap — restored both.

Rebuilt and ran the full suite (309/309 passing, includes the 3 new regression tests) after all of the above.

## Follow-up (2026-07-27, continued): deep dive on the ~25 sparse-keyword units — two distinct bugs, both fixed

User asked to deep-dive the "separate, narrower bug" flagged above. Turned out to be **two** distinct root causes, not one, distinguishable by checking each sparse unit's raw BSData structure directly against the catalogue's own top-level `entryLinks` (the real "roster access" mechanism) vs. nested entryLinks buried inside some other unit's wargear-option groups:

**Bug 1 (the majority — ~23 of the ~25): phantom duplicate "units" that were never real, independently-fieldable datasheets at all.** `fetch-data.ts`'s "2a" step swept every top-level `sharedSelectionEntries` entry unconditionally, regardless of whether BSData actually exposes it as a selectable roster entry. Confirmed against raw BSData for Wolf Scout/Wolf Scout w/ plasma gun/Wolf Scout Pack Leader, Burna Boy, Sister Novitiate (both loadouts), Celestian Sacresant (both loadouts), Geminae Superia, Cyber-mastiff, the Deathwatch Veteran/Gravis Veteran/Kill Team Sergeant family, and Jakhal: every one of them is `type: "model"`, carries only a bare wargear-tag (or nothing) as its own `categoryLinks`, is **never** referenced by its catalogue's own root-level `entryLinks`, and is **only** ever reached via a nested `entryLink` inside the real squad's own wargear-selection groups (e.g. "Wolf Scouts"'s "12 Models"/"6 Models" upgrade entries link to "Wolf Scout w/ plasma gun" etc.). The real squad unit ("Wolf Scouts", "Burna Boyz", ...) already carries its full, correct keyword set directly — these components were pure noise duplicating what the real unit already models, not missing data to backfill.

Fix: added `collectNestedEntryLinkTargets()` (`fetch-data.ts`) to collect every entryLink target referenced from within any top-level candidate's own descendant tree, and excluded a 2a candidate if something else consumes it that way — unless it's *also* independently reachable via the catalogue's own root `entryLinks` (which is exactly how bug 2's units correctly stay included, see below). Verified: all ~23 phantom entries are gone from both `UNITS` and `UNITS_11E`; the real squads (Wolf Scouts, Burna Boyz, Celestian Sacresants, Deathwatch Veterans) are untouched and still fully tagged.

**Bug 2 (2 units: Fabius Bile, Traitor Enforcer): genuinely standalone units whose real keyword set lived one level down, unmerged.** Both are legitimately reachable via their catalogue's root `entryLinks` (real, independently-fieldable named characters) — but structured as a thin top-level `"unit"` wrapper (own categoryLinks: just `["Epic Hero"]` or `["Character", "Damned"]`) around one or more nested `"model"` children that carry the real `Infantry`/`Character`/`Chaos`/faction tags. Fabius Bile specifically has *two* such children (himself plus an attached "Surgeon Acolyte" companion model) — an initial fix requiring exactly one child missed this and had to be relaxed.

Fix: `extractKeywords()` (`xml-parser.ts`) now merges keywords from every visible `type: "model"` child living directly under a `type: "unit"` entry's own `selectionEntries` (deduped). Deliberately scoped to that exact shape — a normal squad's weapon-option variants live nested inside `selectionEntryGroups` instead (Chosen, Nurglings, Wolf Scouts, ...), which this doesn't touch, and those squads already carry their full keyword set directly regardless. Also added a defensive dedup to the base categoryLink reader after finding one unrelated pre-existing duplicate (Grey Knights' Rhino listing "Rhino" twice in BSData itself).

Added 5 regression tests: 3 unit tests in `xml-parser.test.ts` (single-child merge, multi-child merge, and confirming squad weapon-option children in `selectionEntryGroups` do *not* leak in) and 4 dataset-wide checks in `data-integrity.test.ts` (zero sparse-keyword units remain; the specific phantom names are gone while their real squads stay fully tagged; Fabius Bile/Traitor Enforcer inherit correctly; no keyword-list runaway or duplicates dataset-wide). `UNITS_11E` dropped from 2,682 to 2,651 and `UNITS` from 2,666 to 2,634 (the phantom removals), both counts otherwise unaffected. Full suite: 320/320 passing.

## Follow-up (2026-07-27, continued again): added Detachment Points and Force Disposition to `Detachment`

User asked for two more 11th-Edition-only facts per detachment: its **Detachment Points** (DP) cost (1-3, a list-building resource — Incursion-sized games cap total DP across all detachments used at 2, Strike Force at 3; a single detachment whose own DP exceeds that cap is still legal on its own, the cap only stops combining multiple detachments past the limit) and which **Force Disposition(s)** (the existing `Disposition` union already used by `determine_primary_mission` — Take and Hold, Purge the Foe, Reconnaissance, Priority Assets, Disruption) it's eligible for.

Confirmed both are present in BSData/wh40k-11e directly (checked Chaos Space Marines and Space Marines catalogues): each detachment's `selectionEntry` carries a `<cost name="Detachment Points" typeId="82ae-1066-5107-6ae0">` (read the same way unit points already are) and a `categoryLink` naming its disposition, alongside a `3DP Detachment` redundancy flag and (see next entry) mutual-exclusion tags like `Doomed`/`Grace`/`Nightmare` that had to be filtered out by only keeping names matching one of the five known `Disposition` values. Confirmed neither exists at all in BSData/wh40k-10e (zero matches for the cost type; the concept postdates 10th Edition) — both new `Detachment` fields (`detachmentPoints: number | null`, `dispositions: Disposition[]`) are always `null`/`[]` for 10e data, by design.

Added `extractDetachmentPoints`/`extractDetachmentDispositions` (`xml-parser.ts`), wired into `parseDetachments`. `lookup_detachment`'s output now shows both in the header line plus a short disclosure note on the Incursion/Strike Force DP cap whenever `detachmentPoints` is set. Of 271 11e detachments, 258 have both fields populated; the remaining 13 are Boarding Actions-only detachments (a separate ruleset with no DP/Disposition system at all — e.g. Tyranid Attack, Embarked Regiment), not a data gap. Added regression tests at three levels: a fixture-based `parseDetachments` unit test (confirms extraction and the decorative-tag filter), `lookup_detachment` integration tests (11e shows both fields + the cap disclosure, 10e shows neither), and dataset-wide `data-integrity` checks (DP always 1-3 when set, dispositions never empty when DP is set, only the five known disposition values ever appear, 10e always null/empty). 327/327 tests passing.

## Follow-up (2026-07-27, continued a third time): detachment mutual-exclusion tags (`restrictionTags`)

User asked to also surface detachment "unique tags" — e.g. Chaos Space Marines' Murdertalon Raiders and Nightmare Hunt can't both be used in the same army — after noticing "Nightmare" sitting alongside a real disposition in the previous entry's raw-data dump.

Confirmed directly in BSData's own rule text: Murdertalon Raiders' ability literally states "This detachment has the NIGHTMARE tag and cannot be taken with another NIGHTMARE detachment." A repo-wide scan (all 45 catalogue files, fetched once and cached locally to stay within the anonymous API rate limit) for that exact phrasing turned up 10 confirmed tags on first pass (War Dogs, Nightmare, Flyblown, Engines, Lions, Grace, Doomed, Dynasty, Hypercrypt, plus one the regex initially missed) — but a broader pass listing *every* non-disposition categoryLink on a Detachment turned up 26 distinct tags across 12 factions, nearly all in matching pairs (Space Marines' "Doomed" is a rare 3-way group: The Lost Brethren/Rage-Cursed Onslaught/Wrath of the Doomed). Spot-checked several of the ones the initial regex missed (Covens, Kabal) directly against their own rule text and found the identical "has the X tag and cannot be taken with another X detachment" phrasing — the regex had failed only because GW's PDF-sourced text bolds the tag name (`**COVENS**`), and separately because some instances use a Unicode non-breaking space (` `) instead of a plain space mid-phrase, both of which silently broke a naive `[A-Z\s]` character class. Concluded every non-disposition, non-"NDP Detachment" categoryLink on a Detachment follows this same mechanic — no further per-tag confirmation needed.

One real gotcha found while implementing the extraction: 10th Edition's own "Gladius Task Force" carries a stray `Grenades` categoryLink on its Detachment entry (leftover/unrelated BSData structure, not a real tag), which a naive "not a known disposition ⇒ must be a restriction tag" rule would have wrongly reported for every 10e detachment. Fixed by gating `extractDetachmentRestrictionTags` on `extractDetachmentPoints(entry) !== null` — the same reliable "is this actually an 11e-tagged detachment" signal already established two entries above, rather than inferring it from disposition-matching alone.

Added `restrictionTags: string[]` to `Detachment` and `extractDetachmentRestrictionTags` (`xml-parser.ts`), wired into `parseDetachments`. `lookup_detachment` now cross-references the full detachment pool and names the *specific* other detachment(s) sharing a tag (not just the tag name) — e.g. looking up Murdertalon Raiders shows "**Mutually exclusive** (tag: Nightmare) — cannot be used in the same army as: **Nightmare Hunt**," and vice versa. Of the 49 detachments carrying a restriction tag, the large majority pair up with a same-faction partner as expected; a handful (e.g. Adepta Sororitas' "Reverend", Leagues of Votann's "Hearthguard") are currently singletons — BSData just hasn't published their exclusion partner yet, not a bug, and `lookup_detachment` says so explicitly when it happens. Added tests at the same three levels as the previous entry (fixture unit test covering both the happy path and the 10e stray-categoryLink gate, `lookup_detachment` integration tests naming both sides of the Murdertalon/Nightmare Hunt pair plus a no-tag detachment showing no note, dataset-wide checks that tags are well-formed and mostly paired). 336/336 tests passing.

## Follow-up (2026-07-27, continued a fourth time): fixed a major bug — standalone named characters (The Changeling, Skulltaker, ...) were missing from BOTH editions entirely

User reported the MCP couldn't find Chaos Daemons' The Changeling (or its CSM-ally appearance). First-pass investigation wrongly concluded BSData/wh40k-11e simply didn't have the unit yet (a regex missing `\s*` after `"name":` in a manual `grep` produced a false negative) — corrected that before going further: it's present in both BSData/wh40k-10e and wh40k-11e. The real bug was entirely in this project's own pipeline.

**Root cause:** `parseEntryWithLinks` (`fetch-data.ts`) took a `unitOnly` flag, passed as `true` for every entryLink resolved from a catalogue's own root-level `entryLinks` (step 2b) or a linked library's root-level `entryLinks` (step 2c) — rejecting any target whose type wasn't exactly `"unit"`. The Changeling, Skulltaker, Skullmaster, and every other standalone one-model Chaos Daemon character are `type="model"` at the top level with no wrapping `"unit"` container (same BattleScribe shape a squad's per-model wargear-loadout option uses) — so `unitOnly` silently dropped all of them, at both entryLink resolution sites, across every edition. Verified via raw BSData: `Chaos - Daemons Library.cat`'s own root `entryLinks` list "The Changeling" (`targetId` resolving to a `type="model"` `selectionEntry`), imported into the main "Chaos - Chaos Daemons" catalogue via `catalogueLink` exactly like every other unit.

Confirmed via the phantom-unit investigation two entries above that a root-level entryLink (this catalogue's own, or a linked library's own) is already BSData's reliable "independently fieldable" signal — every real wargear-loadout phantom found there was reached only through a *nested* entryLink, never a root one. So the `unitOnly` type check was gating on the wrong thing entirely: fixed by dropping it and accepting both `"unit"` and `"model"` uniformly at both call sites (matching how step 2a and 2c's own direct-selectionEntries import already behaved).

**This surfaced two further, previously-dormant bugs** — both existed already, just never triggered because `unitOnly` had always thrown these entries away before any of this code ran:

1. **Crusade-only ability bloat via a wrapper *group* name, not a link name.** The Changeling's abilities ballooned with duplicated "Front-line/Inspirational/Logistical/Nemesis/Restorative/Strategic/Subtle Champions" text. Root cause: nearly every named character has a `"Crusade"`-named `selectionEntryGroup` wrapping a single entryLink to "Mighty Champions" — a universal, non-datasheet-specific pool of generic Crusade narrative content used by virtually every Epic Hero in the game. `UNIVERSAL_OPTION_POOL_LINK_NAME_PATTERN` (which already excludes "crusade"-named things) was only ever checked against the *link's own* name ("Mighty Champions", no match) — never the *enclosing group's* name ("Crusade", a match). Fixed by applying the same pattern check to `group["@_name"]` before recursing into a `selectionEntryGroup` at all in `collectAllProfilesWithGlobalLinks`.
2. **`extractUnitSize` counted a standalone character's own weapons as model slots.** The Changeling's two top-level weapon children ("The Trickster's Staff", "Infernal Flames") each carry the exact same mandatory `min=1/max=1 selections` constraint shape a real model slot (e.g. Legionaries' "Aspiring Champion") uses — so a single-model character came out as `{min: 3, max: 3}` (1 baseline + 2 "model" weapons). Fixed with `isPureWeaponChild()`: a child carrying a Ranged/Melee weapon profile but no "Unit" profile of its own is wargear, never a model slot, regardless of its constraint shape.

**Validated against Wahapedia's 10e pages** (per user request) rather than trusting only internal tests: The Changeling's profile, both weapon profiles, and ability list matched Wahapedia's page essentially exactly (points differ, 105 vs Wahapedia's 90 — a real 10e→11e cost change, already established as normal from the CSM points-sync entry above). Fabius Bile's newly-corrected `unitSize: {min: 2, max: 2}` was independently confirmed against Wahapedia too — Wahapedia's own datasheet states "2 models" (Fabius Bile + a Surgeon Acolyte companion), and every other field (points: 100, all 4 weapons, all 6 abilities) matched exactly.

**Blast radius:** far larger than anticipated — `UNITS_11E` grew from 2,651 to 7,097 and `UNITS` (10e) from 2,634 to 7,076 (~2.7×). This is legitimate, not a new duplication bug: fixing `unitOnly` correctly surfaced every standalone named character (and shared terrain/fortification unit, e.g. "Searchlight") that any allied faction can field — the exact same already-established, intentional pattern as Imperial Knights' Canis Rex appearing under 17 Imperium factions, just applied to a category of content (`type="model"` root-linked entries) that used to be blanket-excluded. Verified the previously-fixed phantom-wargear-loadout exclusion (Wolf Scout w/ plasma gun, Burna Boy, etc.) still holds — none of them reappeared.

Five pre-existing tests had to be updated, all for the same underlying reason (more complete, more accurate data, not a regression): `lookup_unit`/`compare_units` tests that queried "Abaddon the Despoiler"/"Haarken Worldclaimer" without a faction filter and asserted the result would be "Chaos Space Marines" — both are now *also* legitimately ally-importable into Chaos Daemons/Chaos Knights (same pattern as Abaddon's own home-faction ambiguity), so an unfiltered lookup can resolve to any of their faction copies; pinned `faction: "Chaos Space Marines"` where a test could (`lookup_unit`), relaxed to a generic `"**Faction:**"` check where the tool has no per-unit faction filter (`compare_units`, which takes a flat unit-name array). Three `data-integrity` threshold tests (zero-weapon-unit count, CSM Heretic Astartes ratio, sparse-keyword check) were calibrated against the old, incomplete dataset and needed updating to reflect the new, more complete one — verified each specific case behind the failure was legitimate (Horus Heresy `[Legends]` vehicles not yet keyword-retagged by BSData, "Searchlight" a real minimal shared-terrain unit, shared fortifications like "Skyshield Landing Pad" now correctly multiplying across every allowed faction) before loosening anything.

Added regression tests for all three fixes: `xml-parser.test.ts` fixture tests for `isPureWeaponChild` (both the bug case and a real-model-slot-with-inline-weapon control case), and dataset-wide `data-integrity` checks (The Changeling/Skulltaker/Skullmaster/Blue Scribes present with real profiles/weapons/correct `unitSize`; no unit anywhere in the dataset has any of the "Champions" bloat ability names). 341/341 tests passing.

## Follow-up (2026-07-30): added a `/crusade`-style feature — Crusade Battle Traits, Relics, Battle Scars, and Boon tables as a separate queryable domain

User asked to include Crusade-only characters (`[Crucible]`-tagged), flagged as such. Investigating that first: already correctly handled — `[Crucible]` is baked into the unit's own name (e.g. "Exalted Champion [Crucible]") and its `Crucible` categoryLink keyword, both already surfaced by the existing pipeline. No code change needed there.

Mid-conversation, the user redirected: rather than adding *Crusade abilities* to every unit's `abilities` array (their concern: "the amount of crusade abilities would bloat the dataset immensely if each character got them"), model Crusade content as its own feature — mirroring their own experience building a Crusade roster in-app, where they see three tiers of Battle Honours: **generic**, **faction-specific**, and **campaign-specific** (Tyrannic War, Armageddon, etc.). Asked them to confirm this is genuinely BSData-native content (not something we'd need to hand-curate from the rulebook); they confirmed, and direct inspection of `Warhammer 40,000.json` (game system) and `Chaos - Chaos Space Marines.json` (catalogue) validated it in full.

**Confirmed BSData structure** (same `selectionEntry`/`selectionEntryGroup`/profile shape as everywhere else in this project — an Abilities-typed profile with a `Description` characteristic holds the rule text, identical to how Enhancements already work):

- **Generic (universal):** game-system-level `Main Rules Battle Scars` — 6 named entries (Battle-weary, Crippling Damage, Deep Scars, Disgraced, Fatigued, Mark of Shame), gated by neither faction nor campaign.
- **Faction-specific:** each catalogue's own top-level shared groups, reliably marked with `comment: "Crusade content"` — e.g. CSM's `Codex Battle Traits` (14 named traits), `Codex Crusade Relics` (tiered Antiquity/Legendary/Artificer), and `Chaos Boons` (a Chaos-only corruption table). Used the `comment` tag rather than hardcoding "Codex " as a name prefix, since not every faction necessarily uses that exact wording.
- **Campaign-specific:** game-system-level `<Campaign> Battle Traits` / `<Campaign> Crusade Relics` for Tyrannic War, Pariah Nexus, Nachmund Gauntlet, and Armageddon — inconsistently nested in BSData (three reachable only as subgroups of a generic "Battle Traits"/"Crusade Relics" wrapper, Armageddon's reachable as its own top-level group instead), so both are found by recursively walking every shared group's subgroups rather than assuming a fixed depth.

**One correction to the user's expectation:** Crusade Requisitions have no enumerable text in BSData. `Requisition Points` there is only a spendable-point counter (`defaultAmount: 5`, `max: 10`), not a list of named Requisition options — this makes sense once you consider that Requisitions are one-time battle-prep actions (Rearm and Resupply, etc.), not persistent unit rules, so BattleScribe never needed to encode their text the way it does for a Battle Trait a unit keeps permanently. Scoped Requisitions out of v1 for this reason, not as a shortcut.

**Implementation**, deliberately mirroring the existing Enhancement/Detachment pipeline shape:
- New `CrusadeHonour` type (`types.ts`): `{ id, name, description, category: "battleTrait"|"relic"|"battleScar"|"boon", scope: "generic"|"faction"|"campaign", faction, campaign, relicTier: "Antiquity"|"Legendary"|"Artificer"|null, gameSystem }`.
- New `parseGenericCrusadeHonours(gameSystemNode)` and `parseFactionCrusadeHonours(catNode, faction)` in `xml-parser.ts`, reusing the existing `extractEnhancementDescription` helper unchanged (same profile shape).
- Wired into `fetch-data.ts` behind a new `extractCrusade` flag on `fetchCatalogueRepo`, set `true` only from `fetch11e()` — 11th Edition only, same scoping precedent as Detachment Points/Force Disposition two entries above (BSData/wh40k-10e's XML schema wasn't separately investigated for this content).
- New `src/data/crusade-11e.ts` (627 entries: 155 generic/campaign + 472 faction-specific across 20 factions) and a new `lookup_crusade` MCP tool — a filterable list/search tool (`faction`, `campaign`, `category`, `name`), not a single-name lookup, since the user's own mental model was "show me everything my faction's Crusade army can pick from," matching their in-app experience. Requires at least one filter (627 entries is too many to dump unfiltered).

370/370 tests passing (39 new fixture tests in `xml-parser.test.ts`, 8 new integration tests in `tests/lookup-crusade.test.ts`, 11 new dataset-wide checks in `tests/data-integrity.test.ts`). Verified end-to-end against the real built server via `scripts/smoke-test.ts`-style manual queries (CSM's 14 Battle Traits, Armageddon's Crusade Relics) before reporting done.

## Follow-up (2026-07-31): Wahapedia data-quality audit found and fixed a real, dataset-wide ability-loss bug — found a second, unrelated bug too big to fix in the same pass

User asked for a systematic comparison of stored unit data against Wahapedia (acknowledged edition drift is expected, but wanted to catch *large chunks* of lost data specifically). Wahapedia currently still reflects 10th Edition content (confirmed via a live fetch) — 11e is too new for it to have updated — so the comparison baseline was `UNITS` (10e), not `UNITS_11E`.

**Method:** rather than trying to diff all ~7,000 units, used cheap dataset-wide heuristics first (units with zero weapons, zero abilities, `<=1` keyword) to rule out the obvious cases, then hand-compared a small sample of real, well-known datasheets (Intercessor Squad, Hive Tyrant, Skorpekh Destroyers, Custodian Guard, Meganobz) against live Wahapedia pages field-by-field (stat line, every weapon, every named ability, every keyword).

**Bug found — real, dataset-wide:** `ruleLinksToAbilityProfiles` (the function that resolves `<infoLink type="rule">` abilities like Deep Strike or Oath of Moment, added in an earlier session) only ever handled `type="rule"`. BSData has a second, parallel indirection — `<infoLink type="profile">` — pointing at a profile in a catalogue's own `<profiles>`/`<sharedProfiles>` instead of a `<rule>`. Confirmed via Custodian Guard (missing "Praesidium Shield" and "Vexilla", both wargear-linked abilities) and Hive Tyrant (missing "Will of the Hive Mind"): both silently dropped entirely, with no error or warning, because nothing in the pipeline ever resolved that link type.

Fix: added `buildProfileIndex` (the profile-based counterpart to the existing `buildRuleIndex`) and extended `ruleLinksToAbilityProfiles` to also resolve `type="profile"` infoLinks against it, gated to targets whose own `typeId` is Abilities-typed (so a non-ability profile referenced this way, e.g. a battle-damage-tier stat profile, can't leak in as a fake ability). Wired a `globalProfileIndex` through `fetch-data.ts` exactly parallel to `globalRuleIndex` — seeded from the game system file, extended per-catalogue, so profiles defined anywhere in the repo resolve correctly.

**Tried and reverted:** initially also allowed `type="profile"` resolution on `type="upgrade"` wrapper entries (not just `type="unit"`/`"model"`) to catch Vexilla, whose own infoLink sits one level deeper on a nested wargear-choice entry rather than directly on the model. This fixed Vexilla but also caused a real regression: Crucible/made-to-order characters (e.g. "Champion of the Chapter [Crucible]") reach a shared "Abilities" entryLinkGroup — a pick-one-of-many menu spanning every chapter's signature wargear — via the exact same `type="upgrade"` + `type="profile"` shape, and relaxing the gate resolved the *entire* menu at once (one unit's ability count went 6 → 42, mixing in Ravenwing Bike, Thunderwolf Mount, Death Company gear, Curse of the Wulfen, none of which apply to that specific character). This is the same class of bug `UNIVERSAL_OPTION_POOL_LINK_NAME_PATTERN` already exists to catch, just under a name ("Abilities") that doesn't match the existing denylist. Reverted to unit/model-only; Vexilla stays unresolved as a narrower, accepted gap rather than risk that regression. Documented directly in `ruleLinksToAbilityProfiles`'s doc comment so the next person doesn't re-try the same relaxation without re-discovering why.

**Impact, measured** (diffed against the pre-fix committed data): 3,564 of 7,076 units in `UNITS` (10e) gained at least one previously-missing ability, +5,665 ability entries total; 3,342 of 7,097 in `UNITS_11E`, +5,052. This is the single largest data-completeness fix made to the unit dataset so far this project.

**Second, unrelated bug found — NOT fixed, reported instead:** while investigating the above, discovered that every `[Crucible]`-tagged unit (195 across the dataset, one per chapter/faction copy) reaches a shared "Abilities" *and* "Weapons" entryLinkGroup the same way — a pool representing every possible named persona a made-to-order character can be customized into. The result: "Champion of the Chapter [Crucible]" shows 40 abilities and 29 ranged + 20 melee weapons flattened together, spanning wargear from Space Wolves, Blood Angels, Dark Angels, Black Templars, and Deathwatch simultaneously — none of which could coexist on one real model. This is pre-existing (confirmed unrelated to this session's changes: the count barely moved when the `type="upgrade"` relaxation above was reverted). Root cause is structurally clear (same "Abilities"/"Weapons" entryLinkGroup pattern, name-based, 100% correlated with the `Crucible` keyword), but a correct fix needs a design decision this session didn't have scope for: either exclude the pool entirely (leaving Crucible characters with almost no data), or model "this datasheet represents several selectable named personas" as its own concept, which the current `Unit` type has no room for. Flagged to the user as a separate follow-up rather than patched hastily.

Added regression tests: `xml-parser.test.ts` fixture tests for `type="profile"` infoLink resolution (positive case: Praesidium-Shield-style unit/model-level resolution; negative case: the reverted upgrade-wrapper relaxation stays reverted; a non-ability profile target is correctly excluded; backward-compatible with no `profileIndex` argument) and for `extractAbilities`'s new name+description dedup (collapses a true duplicate, but correctly keeps two same-named-but-different-text "Leader" entries — confirmed via Hive Tyrant that this is legitimate BSData content, not a bug, once actually compared: one "Leader" node names which unit it can join, the other is the shared core-rules Leader/Bodyguard text). 376/376 tests passing.

## Follow-up (2026-08-01): fixed the Crucible bloat flagged in the entry above — REVERTED same day, see the entry below

User asked for the Crucible-character bloat to be fixed rather than left as a documented gap.

**Root cause, confirmed precisely:** every `[Crucible]` character's own top-level `entryLinks` include four generic-sounding names — `Specialisms`, `Abilities`, `Weapons`, `Chapter` — each pointing at a shared `selectionEntryGroup` holding every possible named persona's complete kit. Checked across every downloaded catalogue (Space Marines, Adeptus Custodes) for non-Crucible occurrences of these exact entryLink names: zero. They're used exclusively by this one mechanism. Inspecting "Champion of the Chapter [Crucible]"'s own inline content confirmed the real signal: it already carries its own genuine stat profile, one real inline ability ("Exemplar Warrior"), and a "Leader" ability whose description is conditionally rewritten by `<modifier field="hidden">`/`<modifier type="set">` blocks depending on which persona-selection child was picked elsewhere in the tree — i.e. BSData's own data model *does* encode "only one persona's content is active at a time," just via a conditional-modifier evaluation this project's extractors have never implemented (and reasonably shouldn't just for this one case — it'd mean building a small constraint/modifier engine).

**Fix:** added `^weapons$`, `^abilities$`, `^specialisms$`, `^chapter$` to `UNIVERSAL_OPTION_POOL_LINK_NAME_PATTERN` in `fetch-data.ts` — anchored (exact match), unlike the pattern's existing substring terms, specifically because these are common English words a genuine per-unit link name could otherwise contain (a real "Chapter Tactics" ability link, for instance, must not be caught). This is the same denylist mechanism already used for Crusade/Enhancement/Boon pools, just extended to a fifth shared-pool family.

**Result:** "Champion of the Chapter [Crucible]" now shows 6 abilities (Exemplar Warrior, Leader, Oath of Moment, Templar Vows, Leader ×2 — a legitimate distinct-description pair, see the entry above — and Crucible) and 0 weapons, down from 40 abilities and 29+20 weapons. Across the whole dataset, units with ≥15 abilities dropped from 195 (every one `[Crucible]`-tagged) to 8 (all Genestealer Cults/Grey Knights characters with real, thematically-consistent faction abilities — legitimately rich characters, not bloat). No `MAX_PROFILES_PER_UNIT` warnings fired.

**Trade-off, accepted deliberately:** Crucible characters now have zero weapons, since every weapon they show came from the excluded pool with no non-pool fallback. This is intentionally a real, honest, sparse datasheet rather than a mashup of 5 unrelated chapters' gear — the `Crucible` keyword (already present on `unit.keywords`, unchanged by this fix) remains the existing signal for a caller to know why. Confirmed correct rather than a regression: this pre-existing entryLink pattern is BSData's *only* source for these units' weapons, so there was never a "real" weapon list to fall back to.

**Test-writing note:** the first attempt at a regression test used a denylist of specific bloat ability/weapon *names* (mirroring the "Mighty Champions" test above) and immediately caught two false positives — "Blood Chalice" (a real Sanguinary Priest ability) and "Curse of the Wulfen" (a real Wulfen ability) both legitimately exist elsewhere in the dataset under their own correct unit, which is exactly why they were in the shared persona pool to begin with. A name-based denylist can't distinguish "this name is bloat here" from "this name is correct there" when it's the same real ability text either way. Replaced with a count-bound check on every `Crucible`-keyword-tagged unit instead (abilities < 20, weapons < 10 — actual post-fix max is 17 abilities / 1 weapon), which tests the actual invariant that matters.

378/378 tests passing.

## Follow-up (2026-08-01, continued): the Crucible "fix" above was wrong — reverted, with official rules pages as proof

User pushed back on the entry above: "doesn't Champion of the Chapter having 0 weapons seem incorrect? these Crucible characters are supposed to be highly configurable" — and provided photos of leaked official rules pages, "Crucible Champions — Adeptus Astartes," covering exactly this content.

The pages show the real build process: **01 Archetype** (fixed base stat line + one built-in ability, e.g. "Champion of the Chapter," 6"/4/3+/4/6+/1, "Exemplar Warrior"), **02 Specialisms** ("Choose up to one of the following," 7 options — Conversion Field, Heavy Jump Pack and Mk X Gravis Armour, Jump Pack, Mk X Gravis Armour, Mk X Phobos Armour, Raider-pattern Bike, Terminator Armour), **03 Ability** ("Choose one of the following abilities," 7 options — Adamantine Will, Astartes Banner, Blessing of the Omnissiah, Litany of Hate, Narthecium, Rites of Battle, Tactical Precision), **04 Weapons** ("choose the weapons your model is equipped with... up to one ranged weapon, up to two pistols, one or two melee weapons" from real ~9-item ranged/pistol/melee tables). Every one of these is a real, GW-intended menu a player picks from — not "become an entirely different, incompatible hero." The previous entry's "impossible mashup" framing was wrong: it's the exact same shape as an ordinary squad's wargear options (list every choice; a real model only takes one or two), just a bigger menu because a Crucible character has more build steps than a normal unit.

Re-verified directly against the regenerated (reverted) data: "Champion of the Chapter [Crucible]"'s 29 ranged + 20 melee weapons match the rulebook's weapon tables almost item-for-item (Combi-weapon, Forge bolter, Master-crafted bolt carbine/bolter/heavy bolt rifle, Storm bolter, Twin bolt rifle, Smite variants, Absolvor/Bolt/Heavy Bolt/Neo-volkite/Inferno pistols, Grav pistol, Hand flamer, Boltstorm gauntlet, Plasma pistol variants on the ranged/pistol side; Close-combat weapon, Crozius arcanum, Force weapon, Master-crafted chainsword/power weapon, Omnissian power axe, Power fist, Servo-arm, Thunder hammer, Twin lightning claws on the melee side — plus chapter-supplement additions like Calibanite greatsword, Encarmine blade/spear, Black Sword, Eviscerator, Great weapon of the Unforgiven, which aren't on the generic Adeptus Astartes chart shown but are exactly the kind of per-chapter supplement addition to the same weapon menu that chart implies exists).

**Reverted:** removed the `^weapons$|^abilities$|^specialisms$|^chapter$` additions to `UNIVERSAL_OPTION_POOL_LINK_NAME_PATTERN` from the entry above, restoring the original (pre-2026-08-01) behavior. Regenerated data (Champion of the Chapter back to 40 abilities / 29+20 weapons; dataset-wide zero-weapon count back to the ~22 baseline; ≥15-ability units back to 195, all Crucible-tagged as expected). Reverted the two data-integrity tests that asserted the now-wrong small counts, replacing them with a test asserting the *opposite* — that Crucible characters keep their full menu (abilities > 15, weapons > 15) alongside their own always-true content (e.g. "Exemplar Warrior" still present). Restored the original `<30` zero-weapon-distinct-name threshold in both `UNITS` and `UNITS_11E` versions of that test (was temporarily raised to `<100` to accommodate the wrong fix).

**Lesson, for next time:** a large, cross-referenced option count isn't inherently a bug signal on its own — this project already treats "list every wargear option a unit could take" as correct for ordinary squads, and the same standard needed to apply here. The tell that should have prompted more skepticism before "fixing" anything: excluding the pool made the data *sparser and less useful* (0 weapons) rather than converging toward an independently-verifiable ground truth — Wahapedia comparison works for that (as in the entry two above), but Wahapedia doesn't carry Crucible content, so this specific claim went unverified until the user supplied a better source (official rules pages) directly.

377/377 tests passing.

---

## Why this doc exists

Games Workshop announced **Warhammer 40,000 11th Edition** at AdeptiCon 2026 (March), launching **June 2026**. We're not making changes yet — there's no source data and the launch is weeks away — but the design decisions need to be captured now while the thinking is fresh, so the future session that picks this up doesn't have to re-derive it.

This doc is the answer to: "how do we add 11e without breaking 10e, and without the oracle starting to give 'diffuse' answers that mash editions together?"

---

## Triggers — when to act on this doc

Pick this up when **any** of the following becomes true:

1. **`BSData/wh40k-11e` repo appears on GitHub.** BSData typically creates a new edition's repo 2–6 weeks after GW launch. Check `https://github.com/orgs/BSData/repositories`.
2. **First 11e codex datafiles land in the new BSData repo with non-trivial coverage** (more than just core rules — at least 2–3 factions).
3. **Community-tournament / players' demand surfaces in issues or comments** asking for 11e support.

The triggers are deliberately about **data availability**, not GW's launch date. We can't ship 11e support before there's data to ship, and BSData's coverage lags GW by ~2–3 months historically.

Realistic timeline as of writing:
- GW launches: June 2026
- BSData wh40k-11e repo created: mid-June to late-July 2026
- BSData "ship-ready" coverage: September–October 2026
- We'd start the work then, ship by end of 2026.

---

## Foundational principles (non-negotiable)

### 1. 10e support is permanent. Period.

People will play 10e for **10 more years.** Tournament scenes lag editions by 1–2 cycles, codex investment is sticky, painted armies don't expire, and there's permanent demand. More importantly, **permanently supporting old editions is a competitive moat** — most fan-data tools die when the next edition launches because they pivot. Ours sticks around.

**Implication:** every `game_mode` value, once added, lives forever. The mode taxonomy is **append-only**. No deprecation, no removal, no "expires after Q1 2027". Anyone pinned to `40k_10e` keeps working unchanged for the lifetime of the package.

### 2. One package, both editions

`warhammer-oracle` stays a single npm package. Both 10e and 11e (and Combat Patrol, Kill Team, etc.) coexist behind the `mode` parameter. Reasoning:
- Players run mixed armies during transition periods.
- Doubling the package count doubles the discoverability cost and the maintenance burden.
- Schema-per-edition is cleanly modelable in one DB; SQLite/JSON layer can keep each edition's rows partitioned cleanly.

### 3. Additive changes only

New editions add to the API surface; never remove, rename, or repurpose existing fields. A user who installed `warhammer-oracle@0.1.x` and queries `mode: "40k"` should keep getting 10e answers indefinitely (with a soft default-flip note — see Rule 4 below).

No 1.0.0 breaking pivot. No major-version reset. **The product is the long-tail support; breaking changes destroy the moat.**

---

## The core product problem: edition disambiguation

This is the actual hard problem 11e introduces — not the data ingestion, not the storage choice. It has three failure modes:

1. **Wrong default.** User asks about "Tactical Marines" with no edition context. Oracle picks 10e silently. User assumes it's 11e because that's what they're playing this week. Confidently wrong answer.
2. **Cross-mode pollution.** User asks "what changed in Shooting phase?" Oracle returns a mash of 10e steps + 11e steps + Kill Team's Firefight phase. Useless soup.
3. **Combat Patrol spillage.** User asks for a Tactical Squad datasheet. Oracle returns the Combat Patrol point cost / restricted profile. They build a 2000-pt list using CP's reduced kit. Tournament disaster.

Currently the oracle has `game_mode: "40k" | "combat_patrol" | "kill_team"` with `default: "40k"`. Once 11e exists, **"40k" alone is meaningless** — it could mean either edition.

### Five rules that fix this

These are testable, not philosophical. The proposal that picks up this work should treat them as acceptance criteria.

**Rule 1 — Every response is mode-stamped at the top.**

```
# Tactical Marines  [Mode: 40k 11e]
M:6"  T:4  SV:3+  W:2  LD:6+  OC:2
…
```

Even if the LLM forgot to set the mode, the user reads the reply and sees the mode in the header. Wrong defaults get caught at the point of use, not days later when someone notices the army list is illegal.

**Rule 2 — Within a single response, never mix modes.**

A `lookup_unit` call answers from exactly one mode. Period. If the user wants a comparison across modes, they use `compare_units` with mode pinned per item:

```ts
compare_units({
  items: [
    { name: "Tactical Marines", mode: "40k_10e" },
    { name: "Tactical Marines", mode: "40k_11e" },
  ]
})
```

This makes cross-mode comparison *possible* but *explicit*. No silent mash-ups.

**Rule 3 — Defaults are explicit, declared in tool descriptions.**

> "Defaults to `40k_10e` if `mode` is not specified. For 11th edition, pass `mode: '40k_11e'`. For Combat Patrol, pass `mode: 'combat_patrol_10e'` or `'combat_patrol_11e'`."

The LLM client sees this. If the user said "I'm playing 10e", a competent LLM pins the mode. If the LLM picks wrong, Rule 1 surfaces it.

**Rule 4 — The default tracks the live edition, but only after BSData has parity.**

When 11e launches in June 2026, the default stays `40k_10e` until BSData's wh40k-11e repo is rich enough to be authoritative — probably autumn 2026. We can flip the default in a minor version with a CHANGELOG note. Anyone pinned to `40k_10e` keeps working unchanged. **Default flips are documented events**, not silent.

**Rule 5 — Combat Patrol and Kill Team get their own edition suffixes.**

When 11e ships, Combat Patrol will get an 11e revision. So `combat_patrol_10e` and `combat_patrol_11e` are distinct modes from day one. Same for Kill Team seasons (`kill_team_2024`, etc., when GW reboots). **Never assume a sub-format inherits its parent's edition automatically** — make it explicit in the mode string.

### Mode taxonomy at maturity

Given Rule 1's permanence, here's where the mode list ends up after a decade of additions:

```
40k_10e            kill_team_2024
40k_11e            kill_team_2027    (hypothetical next reboot)
40k_12e (future)   necromunda_house_of (future expansion)
combat_patrol_10e  horus_heresy_2_0   (future expansion)
combat_patrol_11e
```

Append-only. After 10 years, maybe 15–20 modes. That's fine — they're an enum, not a tool surface explosion. **The 6 tools stay 6.** The expansion is in the data and the mode parameter, not in the tool count.

---

## Architecture decisions

| Decision | Choice | Why |
|---|---|---|
| Edition coexistence model | **A — one package, both editions** | Mixed armies during transition; lower install friction; lower maintenance burden than two packages. |
| Versioning | **Additive minor versions** | Adding `40k_11e` is a 0.x → 0.(x+1) change, not 1.0.0. Breaking changes destroy the long-tail moat. |
| 10e lifecycle | **Permanent** | Append-only mode taxonomy; never remove. |
| Default mode flip | **Soft, documented event** | Stay `40k_10e` until BSData's 11e coverage is authoritative; flip in a minor version with a CHANGELOG note. Pinned consumers unaffected. |
| Cross-mode behaviour | **Explicit only** | Per Rule 2 — `compare_units` accepts per-item mode; everything else is single-mode per response. |
| Storage migration to SQLite | **Deferred, separate work** | The disambiguation rules are higher leverage. Storage refactor is internal; users don't see it. Bundle with 11e if convenient at the time, otherwise its own milestone. |

---

## Implementation phases (when triggered)

```
Phase 1 — Disambiguation discipline (1-2 days)
  Add explicit `mode` parameter to every tool, default `40k_10e`.
  Stamp every response with `[Mode: ...]` header (Rule 1).
  Reword tool descriptions per Rule 3.
  Existing 3 modes get edition suffixes: 40k_10e, combat_patrol_10e,
  kill_team_2024 (rename current kill_team to be edition-specific).
  Ship as 0.2.0 — additive, no break for current users.
  Deprecation note: the bare strings ("40k", "combat_patrol") still
  resolve to their *_10e equivalent for one minor version, then warn,
  then remove from the enum at 0.4.0 or so. Soft transition.

Phase 2 — 11e mode plumbing (1 day, when BSData repo created)
  Add 40k_11e and combat_patrol_11e to the mode enum.
  Empty data, but schema and tests in place.
  Ship as 0.3.0 — additive.

Phase 3 — 11e data wiring (2-3 days, when BSData has coverage)
  Update fetch-data.ts to pull from BSData/wh40k-11e.
  Map 11e XML to whatever schema we have (TS modules currently;
  SQLite if migrated).
  Daily sync workflow (sync-data.yml) starts auto-publishing.
  Ship as 0.4.0 — additive, 11e data populated.

Phase 4 — Default flip (when 11e parity solid)
  Default `mode` flips from 40k_10e to 40k_11e.
  CHANGELOG entry. Minor version (0.5.0).
  Pinned 10e consumers unaffected.

Phase 5 — Optional: SQLite migration
  Replace 6.5 MB hand-coded `units.ts` with SQLite. Internal.
  Bring warhammer in line with the rest of the fleet.
  Standalone work, can happen any time after Phase 1.
```

Phases 1, 2, 5 are independent of GW's calendar. Phase 1 is the highest-leverage work.

---

## Open questions for the implementation session

These weren't decided in April 2026; the proposal that picks this up should resolve them:

1. **Soft transition for bare mode strings.** When `mode: "40k"` (no edition) is sent — should we (a) silently resolve to current default, (b) resolve + add a soft deprecation note in the response, (c) reject with a clear error? Socrates' lean: (b) initially, (c) after one minor version.

2. **What's authoritative if BSData has 10e and 11e versions of the same unit?** Are they distinct rows keyed by `(name, mode)`? Probably yes, but worth confirming.

3. **`game_flow` tool — does it generalise across editions, or do we have separate flows per edition?** Probably distinct, because 11e's 70+ new Detachments may shift phase emphasis. Worth checking GW's preview rules when 11e launches.

4. **Do we add `Necromunda` and `Horus Heresy` modes at the same time?** They're 40k-family, BSData maintains both. Tempting to bundle. Counter-argument: scope creep on what's already a high-traffic product. Decide at proposal time.

5. **Storage: stay on TS modules or migrate to SQLite?** TS modules hit limits eventually (`units.ts` is already 6.5 MB). Migration is a 2–3 day refactor. Bundle with 11e if convenient, otherwise its own milestone.

---

## How to use this doc when triggered

1. Read this doc end-to-end.
2. Run `/opsx:propose` with the directional answers above (model A, additive, append-only, 5 rules).
3. The proposal generates `proposal.md` + `design.md` + `specs/` + `tasks.md` in `openspec/changes/11e-support/`.
4. Resolve the open questions in section above as part of the proposal's design step.
5. Hand off to Superpowers for implementation per the Phase plan.
6. Sync back to the master spec via `/opsx:archive` after each phase ships.

**Do not skip the proposal step.** This doc is the directional input, not a substitute for OpenSpec. The detailed task breakdown is what OpenSpec produces — this is just to ensure the proposal goes in pre-aligned, not green-field.

---

## Why this is captured now and not later

Two reasons:

1. **The "10 more years" insight is an architectural commitment, not a feature note.** Permanent edition support isn't a thing you decide casually mid-implementation; it shapes the schema, the API surface, and the upgrade story from day one. Capturing it now means the future session can't accidentally design it away.

2. **The disambiguation rules are easy to half-implement.** "Add a `mode` parameter and an enum" is the surface fix. "Mode-stamp every response, reject cross-mode mixing, flip defaults as documented events" is the actual product discipline. Without this doc, only the surface fix lands.

When the future session reads this, it should feel slightly opinionated — that's the point. The opinions were paid for in this April 2026 conversation.
