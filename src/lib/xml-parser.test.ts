import { describe, it, expect } from "vitest";
import { parseCatalogue, parseKillTeamCatalogue, parseGameSystem, parseKillTeamGameSystem } from "./xml-parser.js";

// === 40K XML fixture ===

const FIXTURE_40K_CAT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<catalogue id="test-cat" name="Imperium - Space Marines" gameSystemId="sys1" xmlns="http://www.battlescribe.net/schema/catalogueSchema">
  <selectionEntries>
    <selectionEntry id="unit-1" name="Intercessor Squad" type="unit" hidden="false">
      <categoryLinks>
        <categoryLink id="cl-1" name="Infantry" hidden="false"/>
        <categoryLink id="cl-2" name="Faction: Imperium" hidden="false"/>
      </categoryLinks>
      <costs>
        <cost name="pts" typeId="51b2-306e-1021-d207" value="80"/>
      </costs>
      <profiles>
        <profile id="p1" name="Intercessor" typeId="c547-1836-d8a-ff4f">
          <characteristics>
            <characteristic name="M" typeId="e703-ecb6-5ce7-aec1">6"</characteristic>
            <characteristic name="T" typeId="d29d-cf75-fc2d-34a4">4</characteristic>
            <characteristic name="SV" typeId="450a-a17e-9d5e-29da">3+</characteristic>
            <characteristic name="W" typeId="750a-a2ec-90d3-21fe">2</characteristic>
            <characteristic name="LD" typeId="58d2-b879-49c7-43bc">6+</characteristic>
            <characteristic name="OC" typeId="bef7-942a-1a23-59f8">2</characteristic>
          </characteristics>
        </profile>
        <profile id="p2" name="Bolt Rifle" typeId="f77d-b953-8fa4-b762">
          <characteristics>
            <characteristic name="Range">24"</characteristic>
            <characteristic name="A">2</characteristic>
            <characteristic name="BS">3+</characteristic>
            <characteristic name="S">4</characteristic>
            <characteristic name="AP">-1</characteristic>
            <characteristic name="D">1</characteristic>
            <characteristic name="Keywords">Assault, Heavy</characteristic>
          </characteristics>
        </profile>
        <profile id="p3" name="Close Combat Weapon" typeId="8a40-4aaa-c780-9046">
          <characteristics>
            <characteristic name="Range">Melee</characteristic>
            <characteristic name="A">3</characteristic>
            <characteristic name="WS">3+</characteristic>
            <characteristic name="S">4</characteristic>
            <characteristic name="AP">0</characteristic>
            <characteristic name="D">1</characteristic>
            <characteristic name="Keywords"></characteristic>
          </characteristics>
        </profile>
        <profile id="p4" name="Shock Assault" typeId="9cc3-6d83-4dd3-9b64">
          <characteristics>
            <characteristic name="Description">Each time this unit makes a charge move, until end of turn, add 1 to Attacks.</characteristic>
          </characteristics>
        </profile>
      </profiles>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

// === Kill Team XML fixture ===

const FIXTURE_KT_CAT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<catalogue id="kt-cat" name="2024 - Space Marine" gameSystemId="kt-sys" xmlns="http://www.battlescribe.net/schema/catalogueSchema">
  <selectionEntries>
    <selectionEntry id="op-1" name="Intercessor Warrior" type="model" hidden="false">
      <categoryLinks>
        <categoryLink id="cl-1" name="Operative" hidden="false"/>
        <categoryLink id="cl-2" name="Faction: Space Marine" hidden="false"/>
      </categoryLinks>
      <profiles>
        <profile id="kp1" name="Intercessor Warrior" typeId="5156-3fb9-39ce-7bdb">
          <characteristics>
            <characteristic name="APL" typeId="0e9b-37ec-27e0-389b">3</characteristic>
            <characteristic name="Move" typeId="a5e6-083e-6276-218c">3⬤</characteristic>
            <characteristic name="Save" typeId="8583-4e3e-3d0f-4e38">3+</characteristic>
            <characteristic name="Wounds" typeId="d8e1-674f-1563-ca01">13</characteristic>
          </characteristics>
        </profile>
        <profile id="kp2" name="⌖ Bolt Rifle" typeId="f25f-4b13-b724-d5a8">
          <characteristics>
            <characteristic name="ATK">4</characteristic>
            <characteristic name="HIT">3+</characteristic>
            <characteristic name="DMG">4/5</characteristic>
            <characteristic name="WR">Rng ⬟</characteristic>
          </characteristics>
        </profile>
        <profile id="kp3" name="⚔ Combat Knife" typeId="f25f-4b13-b724-d5a8">
          <characteristics>
            <characteristic name="ATK">4</characteristic>
            <characteristic name="HIT">3+</characteristic>
            <characteristic name="DMG">4/5</characteristic>
            <characteristic name="WR">Lethal 5+</characteristic>
          </characteristics>
        </profile>
        <profile id="kp4" name="Tactical Awareness" typeId="f887-5881-0e6d-755c">
          <characteristics>
            <characteristic name="Ability" typeId="3467-0678-083e-eb50">This operative can perform a mission action for one less AP.</characteristic>
          </characteristics>
        </profile>
        <profile id="kp5" name="Bolter Discipline" typeId="0ef1-ffa2-bd78-c722">
          <characteristics>
            <characteristic name="Description">1AP: This operative can re-roll one attack die during a shooting attack.</characteristic>
          </characteristics>
        </profile>
      </profiles>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

const FIXTURE_KT_GST = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<gameSystem id="kt-gst" name="2024 - Kill Team" xmlns="http://www.battlescribe.net/schema/gameSystemSchema">
  <rules>
    <rule id="r1" name="Normal Move">
      <description>Move the operative up to its Move characteristic.</description>
    </rule>
  </rules>
  <sharedRules>
    <rule id="r2" name="Dash">
      <description>Move the operative up to 1⬤.</description>
    </rule>
  </sharedRules>
</gameSystem>`;

describe("parseCatalogue (40K)", () => {
  it("parses a unit with profiles, weapons, and abilities", () => {
    const units = parseCatalogue(FIXTURE_40K_CAT);
    expect(units).toHaveLength(1);

    const unit = units[0];
    expect(unit.name).toBe("Intercessor Squad");
    expect(unit.faction).toBe("Space Marines");
    expect(unit.points).toBe(80);
    expect(unit.gameSystem).toBe("wh40k-10e");

    // Profile
    expect(unit.profiles).toHaveLength(1);
    expect(unit.profiles[0].movement).toBe('6"');
    expect(unit.profiles[0].toughness).toBe("4");
    expect(unit.profiles[0].save).toBe("3+");
    expect(unit.profiles[0].wounds).toBe("2");

    // Ranged weapon
    expect(unit.rangedWeapons).toHaveLength(1);
    expect(unit.rangedWeapons[0].name).toBe("Bolt Rifle");
    expect(unit.rangedWeapons[0].keywords).toEqual(["Assault", "Heavy"]);

    // Melee weapon
    expect(unit.meleeWeapons).toHaveLength(1);
    expect(unit.meleeWeapons[0].name).toBe("Close Combat Weapon");

    // Abilities
    expect(unit.abilities).toHaveLength(1);
    expect(unit.abilities[0].name).toBe("Shock Assault");

    // Keywords (Faction: filtered out)
    expect(unit.keywords).toContain("Infantry");
    expect(unit.keywords).not.toContain("Faction: Imperium");
  });
});

describe("parseKillTeamCatalogue", () => {
  it("parses an operative with KT profiles, weapons, abilities, and unique actions", () => {
    const operatives = parseKillTeamCatalogue(FIXTURE_KT_CAT);
    expect(operatives).toHaveLength(1);

    const op = operatives[0];
    expect(op.name).toBe("Intercessor Warrior");
    expect(op.faction).toBe("Space Marine");
    expect(op.gameSystem).toBe("wh40k-killteam");

    // Operative profile
    expect(op.profile.apl).toBe("3");
    expect(op.profile.movement).toBe("3\u2B24");
    expect(op.profile.save).toBe("3+");
    expect(op.profile.wounds).toBe("13");
  });

  it("extracts ranged and melee weapons from prefix symbols", () => {
    const operatives = parseKillTeamCatalogue(FIXTURE_KT_CAT);
    const op = operatives[0];

    expect(op.weapons).toHaveLength(2);

    const ranged = op.weapons.find((w) => w.type === "ranged");
    expect(ranged).toBeDefined();
    expect(ranged!.name).toBe("Bolt Rifle");
    expect(ranged!.attacks).toBe("4");
    expect(ranged!.hit).toBe("3+");
    expect(ranged!.damage).toBe("4/5");
    expect(ranged!.weaponRules).toBe("Rng \u2B1F");

    const melee = op.weapons.find((w) => w.type === "melee");
    expect(melee).toBeDefined();
    expect(melee!.name).toBe("Combat Knife");
    expect(melee!.weaponRules).toBe("Lethal 5+");
  });

  it("extracts abilities and unique actions", () => {
    const operatives = parseKillTeamCatalogue(FIXTURE_KT_CAT);
    const op = operatives[0];

    expect(op.abilities).toHaveLength(1);
    expect(op.abilities[0].name).toBe("Tactical Awareness");
    expect(op.abilities[0].description).toContain("mission action");

    expect(op.uniqueActions).toHaveLength(1);
    expect(op.uniqueActions[0].name).toBe("Bolter Discipline");
    expect(op.uniqueActions[0].description).toContain("re-roll");
  });

  it("extracts faction from 2024 catalogue name", () => {
    const operatives = parseKillTeamCatalogue(FIXTURE_KT_CAT);
    expect(operatives[0].faction).toBe("Space Marine");
  });
});

describe("parseKillTeamGameSystem", () => {
  it("parses rules from a Kill Team .gst file", () => {
    const result = parseKillTeamGameSystem(FIXTURE_KT_GST);
    expect(result.name).toBe("2024 - Kill Team");
    expect(result.rules).toHaveLength(2);
    expect(result.rules.map((r) => r.name)).toContain("Normal Move");
    expect(result.rules.map((r) => r.name)).toContain("Dash");
  });
});
