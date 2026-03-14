import type { TurnSequence, Phase } from "../types.js";

const PHASES_40K: Phase[] = [
  {
    name: "Command",
    order: 1,
    gameMode: "40k",
    steps: [
      "Both players gain 1 Command Point (CP).",
      "The active player resolves any 'start of Command phase' abilities.",
      "Battle-shock tests: roll 2D6 for each unit below Half-strength — if the roll is greater than the unit's Leadership, the unit is Battle-shocked (no objective control, can't use Stratagems on it).",
    ],
    tips: [
      "Don't forget your free CP — it's easy to miss on turn 1.",
      "Battle-shock only applies to units at half strength or below. A full unit never tests.",
      "Some powerful abilities trigger at the start of the Command phase (like Oath of Moment). Resolve these before Battle-shock tests.",
    ],
  },
  {
    name: "Movement",
    order: 2,
    gameMode: "40k",
    steps: [
      "Move each unit up to its Movement characteristic in inches.",
      "Units can Advance instead: add D6\" to their move, but they can't shoot (unless Assault weapons) or charge this turn.",
      "Units can Fall Back out of Engagement Range (melee), but can't shoot or charge unless they have special rules.",
      "Set up Reinforcements (Deep Strike, etc.) — must be more than 9\" from enemy models.",
    ],
    tips: [
      "Plan your movement with shooting in mind — Heavy weapons get +1 to hit if you don't move.",
      "Measure from and to the closest part of the model's base.",
      "Advancing is great for grabbing objectives but locks you out of most shooting. Check for Assault weapons first.",
      "Reinforcements come in during this phase. Place them carefully — 9\" is a long charge.",
    ],
  },
  {
    name: "Shooting",
    order: 3,
    gameMode: "40k",
    steps: [
      "Select a unit to shoot with and declare targets for each weapon.",
      "Roll to hit (compare to BS, apply modifiers like Heavy +1 or cover -1).",
      "Roll to wound (compare weapon Strength vs target Toughness).",
      "Target makes saving throws (armour save modified by AP, or use invulnerable save).",
      "Apply damage — each failed save causes wounds equal to the weapon's Damage characteristic.",
      "Repeat for each unit.",
    ],
    tips: [
      "You can split fire — different weapons in the same unit can target different enemies.",
      "Remember the wound roll chart: S >= 2×T is 2+, S > T is 3+, S = T is 4+, S < T is 5+, S <= T/2 is 6+.",
      "Pistols can fire in melee but only at the unit you're engaged with. Other weapons can't fire if the unit is in Engagement Range.",
      "Allocate wounds to models that already have damage first — this is how the defender chooses.",
    ],
  },
  {
    name: "Charge",
    order: 4,
    gameMode: "40k",
    steps: [
      "Select a unit and declare which enemy unit(s) it's charging.",
      "The target can fire Overwatch (Stratagem, 1 CP): shoot at the charging unit, hitting on 6s only.",
      "Roll 2D6 — the charging unit must move within Engagement Range (1\") of all declared targets using that roll.",
      "If the roll is too low to reach all targets, the charge fails and the unit doesn't move.",
    ],
    tips: [
      "You need a 9 on 2D6 to charge from Deep Strike (about 28% chance). Plan accordingly.",
      "Overwatch costs your opponent 1 CP each time. Sometimes it's better to charge with a sacrificial unit first to drain their CP.",
      "Multi-charges are risky — you must reach ALL declared targets or the whole charge fails.",
      "Charging gives you a big advantage in the Fight phase: charging units fight first.",
    ],
  },
  {
    name: "Fight",
    order: 5,
    gameMode: "40k",
    steps: [
      "Fights First step: units that charged this turn fight first. Resolve any Fights First abilities.",
      "Remaining combats: players alternate picking eligible units to fight, starting with the active player.",
      "Pile in: move up to 3\" to get closer to the nearest enemy model.",
      "Make melee attacks (same hit→wound→save sequence as shooting, but use WS instead of BS).",
      "Consolidate: move up to 3\" toward the nearest enemy model after fighting.",
    ],
    tips: [
      "Charging units always fight first — this is one of the biggest advantages of charging.",
      "Pile in and consolidate moves must end closer to the nearest enemy model. Use these to tag objectives or pull models into engagement.",
      "Units with Fights First that didn't charge still fight in the Fights First step — be careful charging them.",
      "The non-active player gets to fight back even if their unit didn't charge. Melee is a two-way street.",
    ],
  },
];

const PHASES_COMBAT_PATROL: Phase[] = [
  {
    name: "Command",
    order: 1,
    gameMode: "combat_patrol",
    steps: [
      "Both players gain 1 Command Point (CP) — Combat Patrol uses the same CP system but with a fixed Stratagem set for your army.",
      "Resolve any 'start of Command phase' abilities specific to your Combat Patrol.",
      "Battle-shock tests for units below Half-strength (same as full 40k).",
    ],
    tips: [
      "Combat Patrol Stratagems are printed on your army's Combat Patrol card — you don't use the full Stratagem list.",
      "You still get 1 CP per turn, same as full 40k. Spend them on your patrol-specific Stratagems.",
      "Each Combat Patrol has a unique enhancement or ability that may trigger here — read your patrol's rules card carefully.",
    ],
  },
  {
    name: "Movement",
    order: 2,
    gameMode: "combat_patrol",
    steps: [
      "Move each unit up to its Movement characteristic.",
      "Units can Advance (add D6\"), but can't shoot or charge unless they have Assault weapons or special rules.",
      "Fall Back if needed (can't shoot or charge afterward without special rules).",
      "Reinforcements arrive if your patrol has any Deep Strike units.",
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
      "Select a unit, declare targets, and resolve shooting (hit → wound → save → damage).",
      "Same sequence as full 40k — no simplification here.",
      "Repeat for each unit that's eligible to shoot.",
    ],
    tips: [
      "With smaller armies, every failed save hurts more. Focus fire on one unit at a time rather than spreading damage.",
      "Check your Combat Patrol Stratagem card — you may have a shooting-phase Stratagem that buffs a key unit.",
      "Weapon keywords work identically to full 40k (Blast, Heavy, Rapid Fire, etc.).",
    ],
  },
  {
    name: "Charge",
    order: 4,
    gameMode: "combat_patrol",
    steps: [
      "Declare a charge, opponent can Overwatch (if they have the CP and Stratagem).",
      "Roll 2D6 to charge — must reach Engagement Range of all declared targets.",
      "Failed charge = no movement.",
    ],
    tips: [
      "On the smaller board, charges are more reliable since you're closer to begin with.",
      "Overwatch still costs 1 CP — with limited CP in Combat Patrol, your opponent may not want to spend it.",
      "Charging is often the way to win in Combat Patrol since armies are small and melee can wipe units quickly.",
    ],
  },
  {
    name: "Fight",
    order: 5,
    gameMode: "combat_patrol",
    steps: [
      "Charging units fight first.",
      "Alternate picking remaining units to fight.",
      "Pile in (3\"), attack (WS to hit), consolidate (3\").",
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
