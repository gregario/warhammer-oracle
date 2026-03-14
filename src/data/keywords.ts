import type { KeywordDefinition } from "../types.js";

export const KEYWORDS: KeywordDefinition[] = [
  // === Weapon Keywords ===
  {
    name: "Devastating Wounds",
    description:
      "Critical wounds (unmodified wound roll of 6) inflict mortal wounds equal to the weapon's Damage characteristic instead of normal damage. These mortal wounds bypass the target's armour save entirely.",
    plainEnglish:
      "When you roll a 6 to wound (before any modifiers), the hit skips the enemy's armour save completely and deals mortal wounds equal to the weapon's damage value. This is huge against tough targets with great saves — they just take the damage, no save allowed. The confusing part: it replaces the normal damage for that hit, it doesn't add extra on top.",
    gameModes: ["40k", "combat_patrol"],
    examples: [
      "A weapon with Damage 2 and Devastating Wounds rolls a 6 to wound — the target takes 2 mortal wounds with no save.",
      "An assault cannon with Dev Wounds can punch through Terminators' 2+ save on lucky rolls.",
    ],
  },
  {
    name: "Lethal Hits",
    description:
      "Critical hits (unmodified hit roll of 6) automatically wound the target — no wound roll required.",
    plainEnglish:
      "When you roll a natural 6 to hit, you skip the wound roll entirely — it just wounds automatically. This is great against really tough targets where you'd normally need a 5+ or 6 to wound, because you bypass that bad wound roll completely.",
    gameModes: ["40k", "combat_patrol"],
    examples: [
      "Shooting Strength 4 weapons into Toughness 10? Normally you need 6s to wound. With Lethal Hits, every 6 to hit just wounds automatically.",
    ],
  },
  {
    name: "Sustained Hits",
    description:
      "Critical hits (unmodified hit roll of 6) generate extra hits. Sustained Hits X generates X additional hits; Sustained Hits without a number generates 1 extra hit.",
    plainEnglish:
      "Every time you roll a natural 6 to hit, you score bonus hits on top of the one you already landed. 'Sustained Hits 1' means one extra hit per 6. 'Sustained Hits 2' means two extra. These bonus hits still need to roll to wound as normal — they're not auto-wounds.",
    gameModes: ["40k", "combat_patrol"],
    examples: [
      "A unit with Sustained Hits 1 rolls three 6s out of ten shots — that's 13 hits total (10 original + 3 bonus).",
    ],
  },
  {
    name: "Anti-X",
    description:
      "Improves the critical wound threshold against targets with a specific keyword. Anti-Infantry 4+ means unmodified wound rolls of 4+ are critical wounds against Infantry.",
    plainEnglish:
      "This weapon is specialised against a particular type of target. 'Anti-Infantry 4+' means when shooting at Infantry, your wound rolls of 4+ count as critical wounds (6s). Why does that matter? Because critical wounds trigger things like Devastating Wounds and Sustained Hits. On its own, Anti-X doesn't change your wound roll — but paired with Dev Wounds, it's devastating.",
    gameModes: ["40k", "combat_patrol"],
    examples: [
      "A weapon with Anti-Vehicle 4+ and Devastating Wounds against a tank: every wound roll of 4+ becomes mortal wounds.",
    ],
  },
  {
    name: "Blast",
    description:
      "When targeting a unit with 6+ models, add 1 to the Attacks characteristic for each 5 models in the target unit (minimum +1). Cannot be used for Overwatch.",
    plainEnglish:
      "Blast weapons get bonus shots when shooting at big groups — the bigger the mob, the more shots you get. For every 5 models in the target unit, add 1 attack. A unit of 10 models gives you +2 attacks. The catch: you can never use Blast weapons during Overwatch (the reactive shooting when someone charges you).",
    gameModes: ["40k", "combat_patrol"],
    examples: [
      "A frag missile (Blast, D6 attacks) shoots at a 20-model unit: roll D6 and add 4 attacks.",
    ],
  },
  {
    name: "Heavy",
    description:
      "If the bearer's unit Remained Stationary this phase, add 1 to hit rolls made with this weapon.",
    plainEnglish:
      "Stand still and you shoot better — you get +1 to your hit rolls. If you moved at all this turn, you shoot at normal accuracy. This rewards a 'hold your ground and shoot' playstyle. The +1 can make a big difference: a 4+ to hit becomes a 3+.",
    gameModes: ["40k", "combat_patrol"],
  },
  {
    name: "Rapid Fire",
    description:
      "When targeting a unit within half the weapon's range, increase the Attacks characteristic by the Rapid Fire value.",
    plainEnglish:
      "Get close and you fire more shots. 'Rapid Fire 1' on a 24\" weapon means at 12\" or closer, you get +1 attack per model. 'Rapid Fire 2' means +2 attacks up close. The classic bolter is Rapid Fire 1 — at long range you fire one shot, up close you fire two.",
    gameModes: ["40k", "combat_patrol"],
    examples: [
      "A bolt rifle (Rapid Fire 1, 30\" range, 2 attacks) fires at 15\" or closer: each model gets 3 attacks instead of 2.",
    ],
  },
  {
    name: "Assault",
    description:
      "This weapon can be fired even if the bearer's unit Advanced this turn, but hit rolls suffer a -1 penalty if the unit Advanced.",
    plainEnglish:
      "You can shoot this weapon even after Advancing (the extra-fast move). Normally, if you Advance you can't shoot at all. Assault weapons let you — but you take a -1 to hit as a trade-off. Great for aggressive play where you want to close distance fast while still shooting.",
    gameModes: ["40k", "combat_patrol"],
  },
  {
    name: "Pistol",
    description:
      "This weapon can be fired even if the bearer's unit is within Engagement Range of enemy models, but it must target one of those enemy units and can only be fired if the unit is not eligible to shoot other weapons.",
    plainEnglish:
      "Pistols are the only ranged weapons you can fire while locked in melee combat. If your unit is in close combat (within Engagement Range), you can still shoot your pistol at whoever you're fighting. You can't shoot any other guns though — it's pistols or nothing when you're in melee.",
    gameModes: ["40k", "combat_patrol"],
  },
  {
    name: "Torrent",
    description:
      "This weapon automatically hits the target — no hit roll required.",
    plainEnglish:
      "Flamers and similar weapons — you don't roll to hit at all, every attack automatically hits. This makes Torrent weapons extremely reliable. A Torrent weapon with D6 attacks will always land D6 hits. Ballistic Skill doesn't matter; modifiers to hit don't matter. Just point and burn.",
    gameModes: ["40k", "combat_patrol"],
    examples: [
      "A heavy flamer (Torrent, D6 attacks) always scores D6 hits — no rolling to hit needed.",
    ],
  },
  {
    name: "Twin-linked",
    description:
      "This weapon can re-roll its wound rolls.",
    plainEnglish:
      "You can re-roll any failed wound rolls with this weapon. Not hit rolls — wound rolls. This makes the weapon much more consistent at actually dealing damage. If you roll badly on your wound step, just pick up those dice and roll them again.",
    gameModes: ["40k", "combat_patrol"],
  },
  {
    name: "Melta",
    description:
      "When targeting a unit within half the weapon's range, increase the Damage characteristic by the Melta value.",
    plainEnglish:
      "Get close and the weapon hits way harder. 'Melta 2' on a 12\" weapon means at 6\" or less, add 2 to the damage of each hit. Melta weapons are the classic tank-busters — already strong at range, absolutely devastating up close. The risk-reward is real: you have to get dangerously close.",
    gameModes: ["40k", "combat_patrol"],
    examples: [
      "A multi-melta (Melta 2, Damage D6, 18\" range) at 9\" or less: each hit deals D6+2 damage.",
    ],
  },
  {
    name: "Hazardous",
    description:
      "After resolving attacks with this weapon, roll one D6 for each Hazardous weapon fired. On a 1, the bearer's unit suffers 3 mortal wounds (or the bearer is destroyed if it's a Character, Monster, or Vehicle).",
    plainEnglish:
      "Powerful but risky — after shooting, you roll a die for each Hazardous weapon you fired. On a 1, your own unit takes 3 mortal wounds (or the model just dies if it's a Character/Monster/Vehicle). Think of plasma guns overheating. Usually worth the risk, but sometimes your own guy explodes.",
    gameModes: ["40k", "combat_patrol"],
    examples: [
      "A squad fires 3 plasma guns (Hazardous). After resolving shots, roll 3 dice — each 1 means 3 mortal wounds to your own unit.",
    ],
  },
  {
    name: "Precision",
    description:
      "Critical hits (unmodified hit roll of 6) can target an attached Leader or Character model instead of the unit.",
    plainEnglish:
      "Normally, you can't snipe Characters who are leading a unit — your hits get allocated to the bodyguard models first. Precision weapons can bypass this on a natural 6 to hit: those critical hits can be allocated directly to the Character. This is how you pick off enemy leaders hiding behind their squads.",
    gameModes: ["40k", "combat_patrol"],
  },
  {
    name: "Indirect Fire",
    description:
      "This weapon can target units that are not visible to the bearer. When doing so, subtract 1 from hit rolls and the target gets the Benefit of Cover.",
    plainEnglish:
      "You can shoot at enemies you can't see — hidden behind walls, in buildings, whatever. But it's less accurate (-1 to hit) and the target gets cover (usually +1 to their save). Still very useful because some units hide all game; this forces them to move or take damage. Your opponent might not realise you can hit their hidden units.",
    gameModes: ["40k", "combat_patrol"],
  },

  // === Unit Keywords ===
  {
    name: "Feel No Pain",
    description:
      "Each time this model would lose a wound, roll one D6: if the result equals or exceeds the Feel No Pain value, that wound is not lost.",
    plainEnglish:
      "An extra saving throw after all your other saves have failed. Your model is about to lose a wound? Roll a die — on the FNP value or higher, you shrug it off. 'Feel No Pain 5+' means you ignore each wound on a 5 or 6 (a 1-in-3 chance). This even works against mortal wounds, which is rare and very powerful. It stacks on top of your armour save — it's a completely separate roll.",
    gameModes: ["40k", "combat_patrol"],
    examples: [
      "A model with FNP 5+ takes 3 wounds — roll 3 dice, each 5+ prevents one wound.",
      "Death Guard plague marines famously have FNP 5+, making them annoyingly tough to kill.",
    ],
  },
  {
    name: "Lone Operative",
    description:
      "Unless it is within 12\" of an enemy unit, this unit can only be selected as the target of a ranged attack if the attacking model is within 12\".",
    plainEnglish:
      "This model is hard to shoot at range — enemies can only target it with ranged weapons if they're within 12\". Beyond that, it's basically invisible to enemy guns. Great for sneaky characters moving up the board. But once an enemy gets within 12\", the protection vanishes completely.",
    gameModes: ["40k", "combat_patrol"],
  },
  {
    name: "Stealth",
    description:
      "When targeted by ranged attacks, subtract 1 from the hit roll.",
    plainEnglish:
      "Enemies shooting at this unit take a -1 penalty to their hit rolls. Simple but effective — it turns a 3+ to hit into a 4+ to hit, which means roughly 17% fewer hits. Stacks with other to-hit penalties like cover, making the unit surprisingly hard to pin down at range.",
    gameModes: ["40k", "combat_patrol"],
  },
  {
    name: "Scouts",
    description:
      "At the start of the first battle round, before the first turn, units with Scouts X can make a Normal move of up to X inches. Cannot end closer to enemy models.",
    plainEnglish:
      "Before the game even starts, this unit gets a free move — 'Scouts 6\"' means a free 6\" move at the very beginning. This lets you grab objectives early or get into a better position. You can't move closer to the enemy than you started, but it's still a big advantage for board control on turn 1.",
    gameModes: ["40k", "combat_patrol"],
  },
  {
    name: "Deep Strike",
    description:
      "During the Declare Battle Formations step, this unit can be set up in Reserves instead of on the battlefield. In the Reinforcements step of your Movement phase, set it up anywhere more than 9\" from enemy models.",
    plainEnglish:
      "Instead of deploying on the table at the start, this unit waits off-board and drops in later — anywhere you want, as long as it's more than 9\" from enemies. This is incredibly flexible for getting behind enemy lines or grabbing undefended objectives. The downside: 9\" is far for a charge (you need a 9 on 2D6), so shooting units benefit more than melee units unless you have charge bonuses.",
    gameModes: ["40k", "combat_patrol"],
  },
  {
    name: "Deadly Demise",
    description:
      "When this model is destroyed, roll one D6. On a 6, each unit within 6\" suffers D3 mortal wounds (Deadly Demise D3) or D6 mortal wounds (Deadly Demise D6).",
    plainEnglish:
      "When this model dies, it might explode and hurt everyone nearby. Roll a D6 — on a 6, every unit within 6\" (friend and foe!) takes mortal wounds. This mainly applies to vehicles and big monsters. It means your opponent should think twice about killing your tank in melee, and you should think about where your own models are standing.",
    gameModes: ["40k", "combat_patrol"],
    examples: [
      "A Rhino with Deadly Demise D3 gets destroyed — on a 6, all units within 6\" take D3 mortal wounds, including your own nearby infantry.",
    ],
  },
  {
    name: "Fights First",
    description:
      "Units with this ability that are eligible to fight do so in the Fights First step, before other units.",
    plainEnglish:
      "In the Fight phase, this unit swings before almost everyone else. Normally, the player whose turn it is picks first, but Fights First overrides that. If you charge a unit with Fights First, they hit you before you get to attack — which can be nasty. If both sides have Fights First, it goes back to normal alternating order.",
    gameModes: ["40k", "combat_patrol"],
  },
  {
    name: "Infiltrators",
    description:
      "During deployment, this unit can be set up anywhere on the battlefield more than 9\" from enemy models and the enemy deployment zone.",
    plainEnglish:
      "Deploy this unit almost anywhere on the board instead of just your deployment zone — as long as it's 9\" from enemy models and their deployment zone. This is amazing for grabbing mid-board objectives on turn 1 or setting up early threat pressure. Unlike Deep Strike, Infiltrators are on the board from the start, so they score objectives immediately.",
    gameModes: ["40k", "combat_patrol"],
  },
  {
    name: "Invulnerable Save",
    description:
      "An unmodifiable save that can be used instead of the model's normal armour save. Not affected by the Armour Penetration characteristic of the attack.",
    plainEnglish:
      "A backup save that ignores AP (armour penetration). Normally, weapons with high AP shred your armour save — AP -3 turns a 3+ save into a 6+. But an invulnerable save (like 4++) stays at 4+ no matter how much AP the weapon has. You always choose the better option: your modified armour save or your invuln. Against low-AP weapons, use your armour save; against high-AP weapons, use the invuln.",
    gameModes: ["40k", "combat_patrol"],
    examples: [
      "A Terminator has a 2+ armour save and a 4+ invulnerable save. Against AP 0, use the 2+. Against AP -3, the armour becomes 5+ so use the 4+ invuln instead.",
    ],
  },
  {
    name: "Leader",
    description:
      "This model can be attached to a compatible Bodyguard unit during deployment. While leading, the Leader's abilities apply to the combined unit.",
    plainEnglish:
      "This Character can join a specific squad (its Bodyguard unit) to form one combined unit. The squad protects the leader — wounds go on the bodyguard models first. The leader's special abilities buff the whole squad while attached. Check the leader's datasheet for which squads they can join. Leaders can't join just any unit — the compatible units are listed specifically.",
    gameModes: ["40k", "combat_patrol"],
  },
];
