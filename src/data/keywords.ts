import type { KeywordDefinition } from "../types.js";

export const KEYWORDS: KeywordDefinition[] = [
  // === Weapon Keywords ===
  {
    name: "Devastating Wounds",
    description:
      "Each time an attack made with a Devastating Wounds weapon results in a critical wound, the attack sequence for that attack ends and the target unit suffers a number of mortal wounds equal to the weapon's Damage characteristic, inflicted after resolving any normal damage from those attacks. These mortal wounds can damage a maximum of one model per critical wound; any excess is lost.",
    plainEnglish:
      "When you roll a 6 to wound (before any modifiers), that hit skips the enemy's armour save completely and deals mortal wounds equal to the weapon's damage value. This is huge against tough targets with great saves — they just take the damage, no save allowed. One catch to remember: each critical wound can only kill up to one model's worth of mortal wounds — if the Damage characteristic would overkill a model, the leftover mortal wounds are wasted rather than splashing onto the next model.",
    gameModes: ["40k", "combat_patrol"],
    examples: [
      "A weapon with Damage 2 and Devastating Wounds rolls a 6 to wound — the target takes 2 mortal wounds with no save.",
      "A weapon with Damage 6 and Devastating Wounds scores a critical wound against a model with 3 wounds remaining — 3 of those mortal wounds kill the model, and the other 3 are lost rather than carrying over to the next model.",
    ],
  },
  {
    name: "Lethal Hits",
    description:
      "Each time an attack made with a Lethal Hits weapon results in a critical hit, you can choose for that attack to automatically wound the target instead of making a wound roll.",
    plainEnglish:
      "When you roll a natural 6 to hit, you can choose to skip the wound roll entirely — it just wounds automatically. This is great against really tough targets where you'd normally need a 5+ or 6 to wound. The trade-off: it's optional, and choosing it means no wound roll is made for that attack, so it can never count as a critical wound — which means it can't also trigger Devastating Wounds. Against a target you'd want to critically wound anyway, it's sometimes better to just roll normally.",
    gameModes: ["40k", "combat_patrol"],
    examples: [
      "Shooting Strength 4 weapons into Toughness 10? Normally you need 6s to wound. With Lethal Hits, every 6 to hit can just wound automatically instead of rolling.",
      "A weapon with both Lethal Hits and Devastating Wounds is usually better off rolling to wound anyway on a critical hit — an automatic wound from Lethal Hits skips the chance of also rolling a critical wound.",
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
      "Each time you gather attack dice for a Blast weapon, add one additional attack dice for every five models that were in the target unit in the Select Targets step (rounding down).",
    plainEnglish:
      "Blast weapons get bonus shots when shooting at big groups — the bigger the mob, the more shots you get. For every 5 models in the target unit (rounding down), add 1 attack. A unit of 10 models gives you +2 attacks, but a unit of only 4 models gives you no bonus at all — there's no minimum +1 anymore.",
    gameModes: ["40k", "combat_patrol"],
    examples: [
      "A frag missile (Blast, D6 attacks) shoots at a 20-model unit: roll D6 and add 4 attacks.",
      "A Blast weapon shooting at a unit with only 4 models remaining gets no bonus attack dice (4 models / 5, rounded down, is 0).",
    ],
  },
  {
    name: "Heavy",
    description:
      "In your Shooting phase, each time an attack is made with a Heavy weapon, add 1 to the hit roll if the attacking unit is unengaged, was not set up on the battlefield this turn, and has had no model move more than 3\" this turn.",
    plainEnglish:
      "You get +1 to hit with Heavy weapons as long as your unit hasn't moved more than 3\" this turn, isn't Engaged, and wasn't just set up (e.g. from Reserves) this turn. Unlike older editions, you don't have to be perfectly stationary — a small 3\" shuffle still qualifies. The +1 can make a big difference: a 4+ to hit becomes a 3+.",
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
      "A unit containing one or more models with an Assault weapon can shoot using assault shooting: eligible if unengaged and it made an advance move this turn, and only Assault weapons can be selected.",
    plainEnglish:
      "You can shoot this weapon even after Advancing (the extra-fast move). Normally, if you Advance you can't shoot at all — Assault weapons let you, and only Assault weapons can be fired that way. Unlike older editions, there's no accuracy penalty for shooting after Advancing — it's a clean, no-downside exception. Great for aggressive play where you want to close distance fast while still shooting.",
    gameModes: ["40k", "combat_patrol"],
  },
  {
    name: "Pistol",
    description:
      "Functionally identical to Close Quarters: a unit containing one or more models with a Pistol/Close Quarters weapon can shoot using close quarters shooting, targeting an enemy unit it's engaged with (or, for non-Monster/Vehicle models, only that weapon).",
    plainEnglish:
      "Pistols are one of the few ranged weapons you can fire while locked in melee combat, by using close quarters shooting to target whoever you're engaged with. The Core Rules note that Pistol is being phased out in favour of the clearer name Close Quarters — they work exactly the same way, so treat them as the same ability under two names.",
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
      "Each time a unit is selected to shoot or fight, after it resolves all of its attacks, make a hazard roll for that unit for each Hazardous weapon selected. A hazard roll fails on a 1-2, inflicting 1 mortal wound on the unit — or 3 mortal wounds if every model in the unit is a Monster/Vehicle.",
    plainEnglish:
      "Powerful but risky — after shooting or fighting, you make a hazard roll (D6) for each Hazardous weapon you used. It fails on a 1 or 2 (about a 1-in-3 chance), and your own unit takes 1 mortal wound — or 3 mortal wounds if the whole unit is Monsters/Vehicles. Think of plasma guns overheating. There's no automatic instant-kill for Characters anymore; it's always mortal wounds to the unit.",
    gameModes: ["40k", "combat_patrol"],
    examples: [
      "A squad fires 3 plasma guns (Hazardous). After resolving shots, make 3 hazard rolls — each 1-2 means 1 mortal wound to your own unit.",
    ],
  },
  {
    name: "Precision",
    description:
      "While resolving attacks made with one or more Precision weapons, at the start of the Allocation Order step, if the target unit contains a Character model visible to an attacking model, the attacker can select that Character's allocation group to be the current allocation group.",
    plainEnglish:
      "Normally, you can't snipe Characters who are leading a unit — wounds get allocated to the bodyguard models first. Precision weapons let you jump the queue and allocate straight to a visible Character's group instead. Unlike earlier editions, this isn't tied to critical hits at all — any attack made with a Precision weapon can do this, as long as one of the weapons involved has the ability.",
    gameModes: ["40k", "combat_patrol"],
  },
  {
    name: "Indirect Fire",
    description:
      "This weapon can target units that are not visible to the bearer using indirect shooting. The target gets the benefit of cover, you cannot reroll hit rolls, and an unmodified hit roll of 1-5 fails — unless the shooting unit Remained Stationary and the target is visible to another friendly unit, in which case only an unmodified hit roll of 1-3 fails.",
    plainEnglish:
      "You can shoot at enemies you can't see — hidden behind walls, buildings, whatever. It's much less reliable than it sounds, though: normally only a natural 6 to hit actually lands (rolls of 1-5 all fail), and the target still gets cover. Your one way to improve those odds is to stay stationary and have another one of your units actually see the target — then only 1-3 fail, meaning 4, 5, or 6 all hit. You also can't reroll indirect-fire hit rolls at all.",
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
      "Unless part of an attached unit, this unit is not visible to enemy models unless they are within 12\" of it, and it cannot be targeted by Indirect Fire weapons unless the attacking model is within 12\".",
    plainEnglish:
      "This model is hard to shoot at range — beyond 12\", enemies simply can't see it (and that also blocks Indirect Fire from hitting it at range). Great for sneaky characters moving up the board. But once an enemy gets within 12\", the protection vanishes completely — and if the model joins a unit as an attached Leader, it loses Lone Operative entirely while attached.",
    gameModes: ["40k", "combat_patrol"],
  },
  {
    name: "Stealth",
    description:
      "If every model in a unit has this ability, each time a ranged attack targets that unit, it has the benefit of cover against that attack.",
    plainEnglish:
      "This unit gets the benefit of cover against ranged attacks, on top of any cover it gets from terrain. It's no longer a flat -1 to the enemy's hit roll — it's the same 'Benefit of Cover' bonus terrain gives (typically +1 to the unit's armour save, capped so an unmodified 3+ is as good as it gets). It still stacks with actual terrain cover in the sense that being in cover doesn't grant it twice, but Stealth guarantees the bonus even in the open.",
    gameModes: ["40k", "combat_patrol"],
  },
  {
    name: "Scouts",
    description:
      "In the Resolve Pre-battle Abilities step, if every model in a unit has Scouts X\", it can make a Normal move (or a scout move) of up to X inches, ending more than 8\" horizontally from all enemy units. Units in strategic reserves can instead be set up wholly within your deployment zone.",
    plainEnglish:
      "Before the game even starts, this unit gets a free move — 'Scouts 6\"' means a free move of up to 6\" at the very beginning. This lets you grab objectives early or get into a better position, as long as you end more than 8\" from every enemy unit. A unit embarked in a Dedicated Transport can use this too, moving the transport itself, if every embarked model has Scouts.",
    gameModes: ["40k", "combat_patrol"],
  },
  {
    name: "Deep Strike",
    description:
      "Each time this unit makes an ingress move, if every model in the unit has this ability, it can be set up anywhere on the battlefield more than 8\" horizontally from all enemy units, even within your opponent's deployment zone.",
    plainEnglish:
      "Instead of deploying on the table at the start, this unit waits in strategic reserves and drops in later via an ingress move — anywhere you want, as long as it's more than 8\" from enemies (not 9\" like older editions). This is incredibly flexible for getting behind enemy lines or grabbing undefended objectives. Like all Reserves now, it can't arrive before the second battle round.",
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
      "During deployment, if every model in a unit has this ability, it can be set up anywhere on the battlefield more than 8\" horizontally from your opponent's deployment zone and all enemy units.",
    plainEnglish:
      "Deploy this unit almost anywhere on the board instead of just your deployment zone — as long as it's more than 8\" from enemy models and their deployment zone (not 9\" like older editions). This is amazing for grabbing mid-board objectives on turn 1 or setting up early threat pressure. Unlike Deep Strike, Infiltrators are on the board from the start, so they score objectives immediately.",
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
