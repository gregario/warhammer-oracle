import type { TurnSequence, Phase } from "../types.js";

const PHASES_40K: Phase[] = [
  {
    name: "Command",
    order: 1,
    gameMode: "40k",
    steps: [
      "Both players gain 1 Command Point (Core CP) — the same CP used to pay for Stratagems.",
      "Resolve any 'start of Command phase' abilities (the Command Abilities step).",
      "Battle-shock rolls: the active player makes a battle-shock roll (2D6 vs. the unit's Leadership) for every unit that is currently Battle-shocked, or is at or below Half-strength. Failing leaves it (or makes it) Battle-shocked; passing clears an existing Battle-shocked status.",
    ],
    tips: [
      "Don't forget your free CP — it's easy to miss on turn 1.",
      "A unit rolls for two separate reasons: being at/below Half-strength, or already being Battle-shocked. A full-strength unit that's still Battle-shocked from a prior round still has to test to shake it off.",
      "While Battle-shocked, a unit's Objective Control drops to '-', it can't be targeted by Stratagems, and it can't start or complete actions. Resolve strong start-of-Command abilities before Battle-shock rolls.",
    ],
  },
  {
    name: "Movement",
    order: 2,
    gameMode: "40k",
    steps: [
      "Move each unit up to its Movement (M) characteristic, or select another eligible move type.",
      "Advance: add a D6 roll to the unit's M characteristic. Assault weapons can still be fired afterward (as Assault shooting); otherwise the unit can't shoot, and it can't declare a charge or start an action this turn.",
      "Fall Back: move a unit out of Engagement Range. Choose Ordered Retreat if it isn't Battle-shocked, or Desperate Escape (mandatory if it is) — Desperate Escape requires a hazard roll per model, and afterward the unit can't shoot, charge, or start an action this turn.",
      "Reinforcements: units in Strategic Reserves arrive with an Ingress move, set up within 6\" of a battlefield edge and more than 8\" horizontally from all enemy units — only from the second battle round onward.",
    ],
    tips: [
      "Plan movement with shooting in mind — check whether you want Normal or Assault shooting before deciding to Advance.",
      "Measure from and to the closest part of each model's base.",
      "Reserves now only need to clear 8\" from the enemy (not 9\") but can't arrive until battle round 2 — reinforcements are always at least a round away.",
      "Engagement Range is 2\" horizontally (and 5\" vertically), not 1\" — it's easier than you might expect for units to end up Engaged.",
    ],
  },
  {
    name: "Shooting",
    order: 3,
    gameMode: "40k",
    steps: [
      "Select a unit to shoot with, then pick a shooting type: Normal, Assault ([ASSAULT] weapons only, after Advancing), Indirect ([INDIRECT FIRE] weapons at unseen targets), or Close Quarters (Engaged units firing [CLOSE QUARTERS] weapons, or any Monster/Vehicle unit).",
      "Roll to hit (compare to BS, apply modifiers such as Heavy's +1).",
      "Roll to wound (compare weapon Strength vs target Toughness).",
      "Target makes saving throws (armour save modified by AP, or the invulnerable save if better).",
      "Apply damage — each failed save inflicts wounds equal to the weapon's Damage characteristic; once the unit is destroyed, any remaining attacks are lost.",
      "Repeat for each unit.",
    ],
    tips: [
      "You can split fire — different weapons in the same unit can target different enemies.",
      "Wound roll chart: S ≥ 2×T is 2+, S > T is 3+, S = T is 4+, S < T is 5+, S ≤ half T is 6+.",
      "An Engaged unit normally can't shoot at all — it needs Close Quarters shooting, which requires a [CLOSE QUARTERS] weapon or Monster/Vehicle status.",
      "Save-roll allocation groups models by Character vs non-Character, then by matching Wounds/Save/Invulnerable-save — a damaged non-Character group must be allocated to first.",
    ],
  },
  {
    name: "Charge",
    order: 4,
    gameMode: "40k",
    steps: [
      "Declare a charge with an eligible unit — it must be within 12\" of an enemy unit, unengaged, and must not have Advanced or Fallen Back this turn.",
      "Make a charge roll: 2D6, the result is the maximum distance for the charge move.",
      "Attempt the charge if it's possible: every moved model must end closer to a charge target, must end within 1\" of one if it can, and the unit must finish Engaged with every declared charge target.",
      "Repeat for each unit that chooses to charge, then resolve end-of-phase triggers.",
    ],
    tips: [
      "Engagement Range is 2\", so a charge roll of 2 (double 1s) can never succeed — you can't already be within 2\" when you attempt the charge.",
      "Fire Overwatch isn't used here anymore — it's a Core Stratagem used at the end of your opponent's Movement phase, before the Charge phase even starts.",
      "A charging unit gets the Fights First ability until the end of the turn — a big advantage in the Fight phase.",
      "Multi-charges are risky — the unit must end Engaged with every declared target, or the whole charge move fails.",
    ],
  },
  {
    name: "Fight",
    order: 5,
    gameMode: "40k",
    steps: [
      "Pile in: eligible units (Engaged, charged this turn, or making an overrun fight) move up to 3\" closer to their pile-in targets. The active player resolves all their pile-ins first, then their opponent.",
      "Resolve Fights First combats: starting with the active player, alternate selecting an eligible Fights First unit to fight until none remain.",
      "Resolve remaining combats: alternate selecting any other eligible unit to fight. If a Fights First unit becomes eligible mid-sequence (e.g. via an overrun fight), go back to resolving Fights First units first.",
      "Make melee attacks (hit → wound → save → damage, same as shooting but using WS instead of BS).",
      "Consolidate: eligible units move up to 3\" using Ongoing, Engaging, or Objective consolidation — Engaging consolidation can drag a not-yet-fought enemy unit into the fight.",
    ],
    tips: [
      "Charging units always fight first — and can be joined by units granted Fights First mid-phase (e.g. by the Counteroffensive Stratagem).",
      "You must fight with every eligible unit, but pile-in and consolidate moves are optional per unit.",
      "An overrun fight lets a unit that was Engaged at the start of the step, but destroyed its only target, make an extra pile-in and still fight — watch for this after a Monster/Vehicle wipes a unit in one blow.",
      "Engaging consolidation can pull a fresh enemy unit into the fight, forcing your opponent to fight back with it — think about who that helps before consolidating aggressively.",
    ],
  },
];

const PHASES_COMBAT_PATROL: Phase[] = [
  {
    name: "Command",
    order: 1,
    gameMode: "combat_patrol",
    steps: [
      "Both players gain 1 Command Point (Core CP) — Combat Patrol uses the same CP system but with a fixed Stratagem set for your army.",
      "Resolve any 'start of Command phase' abilities specific to your Combat Patrol.",
      "Battle-shock rolls for every unit that is currently Battle-shocked, or is at or below Half-strength (same as full 40k).",
    ],
    tips: [
      "Combat Patrol Stratagems are printed on your army's Combat Patrol card — you don't use the full Core Stratagem list.",
      "You still get 1 CP per turn, same as full 40k. Spend it on your patrol-specific Stratagems.",
      "Each Combat Patrol has a unique enhancement or ability that may trigger here — read your patrol's rules card carefully.",
    ],
  },
  {
    name: "Movement",
    order: 2,
    gameMode: "combat_patrol",
    steps: [
      "Move each unit up to its Movement characteristic, or select another eligible move type.",
      "Advance (add a D6): Assault weapons can still fire afterward; otherwise the unit can't shoot, charge, or start an action this turn.",
      "Fall Back if needed (Ordered Retreat or Desperate Escape) — the unit can't shoot, charge, or start an action afterward.",
      "Reinforcements arrive via an Ingress move if your patrol has any Strategic Reserves units, more than 8\" from all enemy units, from the second battle round onward.",
    ],
    tips: [
      "The board is smaller in Combat Patrol (44\" x 30\"), so units are in range faster than you'd expect.",
      "Objectives are closer together — sometimes holding still is better than advancing.",
      "With fewer units, each model's position matters a lot. Don't leave objectives unguarded.",
    ],
  },
  {
    name: "Shooting",
    order: 3,
    gameMode: "combat_patrol",
    steps: [
      "Select a unit, pick a shooting type (Normal, Assault, Indirect, or Close Quarters), declare targets, and resolve shooting (hit → wound → save → damage).",
      "Same sequence as full 40k — no simplification here.",
      "Repeat for each unit that's eligible to shoot.",
    ],
    tips: [
      "With smaller armies, every failed save hurts more. Focus fire on one unit at a time rather than spreading damage.",
      "Check your Combat Patrol Stratagem card — you may have a shooting-phase Stratagem that buffs a key unit.",
      "Weapon abilities work identically to full 40k (Blast, Heavy, Rapid Fire, etc.).",
    ],
  },
  {
    name: "Charge",
    order: 4,
    gameMode: "combat_patrol",
    steps: [
      "Declare a charge with a unit within 12\" of an enemy unit that hasn't Advanced or Fallen Back this turn.",
      "Roll 2D6 — the unit must end Engaged (within 2\") with every declared charge target.",
      "Failed charge = no movement.",
    ],
    tips: [
      "On the smaller board, charges are more reliable since you're closer to begin with.",
      "Fire Overwatch is used at the end of your opponent's Movement phase, before the Charge phase — not as a reaction to the charge itself.",
      "Charging is often the way to win in Combat Patrol since armies are small and melee can wipe units quickly.",
    ],
  },
  {
    name: "Fight",
    order: 5,
    gameMode: "combat_patrol",
    steps: [
      "Pile in (up to 3\") toward eligible targets, active player first.",
      "Fights First units fight first, then players alternate picking remaining eligible units to fight.",
      "Attack (WS to hit), then consolidate (up to 3\").",
    ],
    tips: [
      "Wiping a unit in Combat Patrol is a huge swing since there are fewer units total. Commit to fights you can win.",
      "Pile in and consolidate toward objectives if you can — positioning wins games.",
      "Some Combat Patrol armies are much stronger in melee — know your matchup.",
    ],
  },
];

const PHASES_KILL_TEAM: Phase[] = [
  {
    name: "Initiative",
    order: 1,
    gameMode: "kill_team",
    steps: [
      "Each player rolls off — the winner chooses who has initiative this Turning Point.",
      "The player with initiative activates first, but the other player gets to react.",
      "On the first Turning Point, the attacker (determined during setup) wins ties.",
    ],
    tips: [
      "Initiative is huge in Kill Team — going first lets you shoot before the enemy can react.",
      "Sometimes you WANT to go second so you can see what your opponent does and respond. Consider this before automatically choosing first.",
      "Unlike 40k, initiative is re-rolled every Turning Point. No one 'owns' the first turn all game.",
    ],
  },
  {
    name: "Strategy",
    order: 2,
    gameMode: "kill_team",
    steps: [
      "Players alternate using Strategic Ploys or passing. These are team-wide abilities that last for the Turning Point.",
      "Resolve any 'start of Strategy phase' abilities.",
      "Ready all your operatives (flip their tokens to the Ready side).",
    ],
    tips: [
      "Strategic Ploys are like Stratagems in 40k but they last the whole Turning Point instead of one moment.",
      "You can pass to see what your opponent does before committing your ploys.",
      "Command Points work differently in Kill Team — you typically get a fixed amount and must budget them across all Turning Points.",
    ],
  },
  {
    name: "Firefight",
    order: 3,
    gameMode: "kill_team",
    steps: [
      "Players alternate activating one operative at a time.",
      "Each operative gets a number of Action Points (APL) to spend on actions: Move, Shoot, Fight, Dash, Pick Up, Mission actions, etc.",
      "Shooting: roll attack dice, compare to BS, opponent rolls defence dice. Attacker resolves successful hits, defender uses successful saves to block or parry.",
      "Fighting (melee): both players roll simultaneously. Attacker and defender each pick dice to resolve — strikes deal damage, parries cancel enemy strikes.",
      "An operative can only be activated once per Turning Point. Once activated, flip its token to the activated side.",
    ],
    tips: [
      "This is the core of Kill Team — everything happens here. There's no separate Charge or Fight phase.",
      "Kill Team combat uses simultaneous dice resolution — both sides roll and then choose how to spend their dice. This is very different from 40k.",
      "In melee, you pick one die at a time: use a crit to strike (deal crit damage) or parry (cancel an enemy crit). Normal hits strike for normal damage or parry normal hits. This back-and-forth is the tactical heart of Kill Team.",
      "Activation order matters a lot. Activate your most at-risk operatives first if they need to shoot before being shot. Save operatives in safe positions for later.",
      "Dashing into engagement range forces the opponent to fight you instead of shooting — this can protect your other operatives.",
    ],
  },
];

export const TURN_SEQUENCES: TurnSequence[] = [
  {
    gameMode: "40k",
    phases: PHASES_40K,
  },
  {
    gameMode: "combat_patrol",
    phases: PHASES_COMBAT_PATROL,
  },
  {
    gameMode: "kill_team",
    phases: PHASES_KILL_TEAM,
  },
];
