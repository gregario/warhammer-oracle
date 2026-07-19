import { describe, it, expect } from "vitest";
import {
  parseCatalogue,
  parseKillTeamCatalogue,
  parseGameSystem,
  parseKillTeamGameSystem,
  parseEntryNode,
  normalizeJsonNode,
  extractFaction,
  extractUnitSize,
  collectAllProfiles,
  xmlParser,
} from "./xml-parser.js";

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

    // Unit size (no composition sub-entries in this minimal fixture — defaults to 1)
    expect(unit.unitSize).toEqual({ min: 1, max: 1 });
  });
});

describe("extractUnitSize", () => {
  it("defaults to exactly 1 model for a unit with no composition sub-entries (vehicle/single character)", () => {
    const xml = `<selectionEntry id="u1" name="Rhino" type="unit" hidden="false"></selectionEntry>`;
    const entry = xmlParser.parse(xml).selectionEntry[0];
    expect(extractUnitSize(entry)).toEqual({ min: 1, max: 1 });
  });

  it("sums an explicit min/max 'selections' constraint scoped to parent (fixed-size unit, e.g. Obliterators)", () => {
    const xml = `<selectionEntry id="u1" name="Obliterators" type="unit" hidden="false">
      <selectionEntries>
        <selectionEntry id="m1" name="Obliterator" type="model" hidden="false">
          <constraints>
            <constraint type="min" value="2" field="selections" scope="parent"/>
            <constraint type="max" value="2" field="selections" scope="parent"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </selectionEntry>`;
    const entry = xmlParser.parse(xml).selectionEntry[0];
    expect(extractUnitSize(entry)).toEqual({ min: 2, max: 2 });
  });

  it("sums a mandatory champion (1) plus a variable troop group (4-9) into a 5-10 total (e.g. Legionaries)", () => {
    const xml = `<selectionEntry id="u1" name="Legionaries" type="unit" hidden="false">
      <selectionEntries>
        <selectionEntry id="c1" name="Aspiring Champion" type="model" hidden="false">
          <constraints>
            <constraint type="min" value="1" field="selections" scope="parent"/>
            <constraint type="max" value="1" field="selections" scope="parent"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
      <selectionEntryGroups>
        <selectionEntryGroup id="g1" name="4 - 9 Legionaries" hidden="false">
          <constraints>
            <constraint type="min" value="4" field="selections" scope="parent"/>
            <constraint type="max" value="9" field="selections" scope="parent"/>
          </constraints>
        </selectionEntryGroup>
      </selectionEntryGroups>
    </selectionEntry>`;
    const entry = xmlParser.parse(xml).selectionEntry[0];
    expect(extractUnitSize(entry)).toEqual({ min: 5, max: 10 });
  });

  it("treats an unconstrained group with inline content as exactly 1 model (e.g. a champion's weapon-option wrapper)", () => {
    const xml = `<selectionEntry id="u1" name="Chaos Terminator Squad" type="unit" hidden="false">
      <selectionEntryGroups>
        <selectionEntryGroup id="g1" name="Terminator Champion" hidden="false">
          <selectionEntries>
            <selectionEntry id="w1" name="Power fist" type="upgrade" hidden="false"/>
          </selectionEntries>
        </selectionEntryGroup>
      </selectionEntryGroups>
    </selectionEntry>`;
    const entry = xmlParser.parse(xml).selectionEntry[0];
    expect(extractUnitSize(entry)).toEqual({ min: 1, max: 1 });
  });

  it("ignores an unconstrained group with no inline content (pure entryLink reference, e.g. Crusade rules)", () => {
    const xml = `<selectionEntry id="u1" name="Fabius Bile" type="unit" hidden="false">
      <selectionEntries>
        <selectionEntry id="c1" name="Fabius Bile" type="model" hidden="false">
          <constraints>
            <constraint type="min" value="1" field="selections" scope="parent"/>
            <constraint type="max" value="1" field="selections" scope="parent"/>
          </constraints>
        </selectionEntry>
        <selectionEntry id="c2" name="Surgeon Acolyte" type="model" hidden="false">
          <constraints>
            <constraint type="min" value="1" field="selections" scope="parent"/>
            <constraint type="max" value="1" field="selections" scope="parent"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
      <selectionEntryGroups>
        <selectionEntryGroup id="g1" name="Crusade" hidden="false">
          <entryLinks>
            <entryLink id="l1" name="Mighty Champions" type="selectionEntryGroup" targetId="x" hidden="false" import="true"/>
          </entryLinks>
        </selectionEntryGroup>
      </selectionEntryGroups>
    </selectionEntry>`;
    const entry = xmlParser.parse(xml).selectionEntry[0];
    expect(extractUnitSize(entry)).toEqual({ min: 2, max: 2 });
  });

  it("skips hidden children entirely", () => {
    const xml = `<selectionEntry id="u1" name="Test Unit" type="unit" hidden="false">
      <selectionEntries>
        <selectionEntry id="c1" name="Model" type="model" hidden="false">
          <constraints>
            <constraint type="min" value="1" field="selections" scope="parent"/>
            <constraint type="max" value="1" field="selections" scope="parent"/>
          </constraints>
        </selectionEntry>
        <selectionEntry id="c2" name="Hidden Bookkeeping Entry" type="upgrade" hidden="true">
          <constraints>
            <constraint type="min" value="5" field="selections" scope="parent"/>
            <constraint type="max" value="5" field="selections" scope="parent"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </selectionEntry>`;
    const entry = xmlParser.parse(xml).selectionEntry[0];
    expect(extractUnitSize(entry)).toEqual({ min: 1, max: 1 });
  });

  it("ignores roster-selection-limit constraints scoped to force (unrelated to model count)", () => {
    const xml = `<selectionEntry id="u1" name="Test Unit" type="unit" hidden="false">
      <constraints>
        <constraint type="max" value="3" field="selections" scope="force"/>
      </constraints>
      <selectionEntries>
        <selectionEntry id="c1" name="Model" type="model" hidden="false">
          <constraints>
            <constraint type="min" value="2" field="selections" scope="parent"/>
            <constraint type="max" value="2" field="selections" scope="parent"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </selectionEntry>`;
    const entry = xmlParser.parse(xml).selectionEntry[0];
    expect(extractUnitSize(entry)).toEqual({ min: 2, max: 2 });
  });
});

describe("rule-type infoLink resolution into abilities", () => {
  const ruleIndex = new Map<string, any>([
    [
      "rule-deep-strike",
      { "@_name": "Deep Strike", description: "Can be set up anywhere more than 9\" from the enemy." },
    ],
    ["rule-pistol", { "@_name": "Pistol", description: "This weapon can be used even in melee." }],
    ["rule-no-description", { "@_name": "Stub Rule" }],
  ]);

  it("resolves a unit-level rule infoLink (e.g. Deep Strike) into an ability", () => {
    const xml = `<selectionEntry id="u1" name="Test Unit" type="unit" hidden="false">
      <infoLinks>
        <infoLink id="l1" name="Deep Strike" hidden="false" type="rule" targetId="rule-deep-strike"/>
      </infoLinks>
    </selectionEntry>`;
    const entry = xmlParser.parse(xml).selectionEntry[0];
    const profiles = collectAllProfiles(entry, ruleIndex);
    const unit = parseEntryNode(entry, "Test Faction", profiles);

    expect(unit!.abilities.map((a) => a.name)).toContain("Deep Strike");
    expect(unit!.abilities.find((a) => a.name === "Deep Strike")!.description).toContain("9\"");
  });

  it("does not treat a nested weapon entry's rule infoLink (e.g. Pistol) as a unit ability", () => {
    const xml = `<selectionEntry id="u1" name="Test Unit" type="unit" hidden="false">
      <infoLinks>
        <infoLink id="l1" name="Deep Strike" hidden="false" type="rule" targetId="rule-deep-strike"/>
      </infoLinks>
      <selectionEntries>
        <selectionEntry id="w1" name="Bolt pistol" type="upgrade" hidden="false">
          <profiles>
            <profile id="wp1" name="Bolt pistol" typeId="f77d-b953-8fa4-b762">
              <characteristics>
                <characteristic name="Range">12"</characteristic>
              </characteristics>
            </profile>
          </profiles>
          <infoLinks>
            <infoLink id="l2" name="Pistol" hidden="false" type="rule" targetId="rule-pistol"/>
          </infoLinks>
        </selectionEntry>
      </selectionEntries>
    </selectionEntry>`;
    const entry = xmlParser.parse(xml).selectionEntry[0];
    const profiles = collectAllProfiles(entry, ruleIndex);
    const unit = parseEntryNode(entry, "Test Faction", profiles);

    expect(unit!.abilities.map((a) => a.name)).toContain("Deep Strike");
    expect(unit!.abilities.map((a) => a.name)).not.toContain("Pistol");
  });

  it("resolves rule infoLinks on nested model-type sub-entries (e.g. a champion)", () => {
    const xml = `<selectionEntry id="u1" name="Test Unit" type="unit" hidden="false">
      <selectionEntries>
        <selectionEntry id="m1" name="Champion" type="model" hidden="false">
          <infoLinks>
            <infoLink id="l1" name="Deep Strike" hidden="false" type="rule" targetId="rule-deep-strike"/>
          </infoLinks>
        </selectionEntry>
      </selectionEntries>
    </selectionEntry>`;
    const entry = xmlParser.parse(xml).selectionEntry[0];
    const profiles = collectAllProfiles(entry, ruleIndex);
    const unit = parseEntryNode(entry, "Test Faction", profiles);

    expect(unit!.abilities.map((a) => a.name)).toContain("Deep Strike");
  });

  it("skips hidden infoLinks and rules with no description text", () => {
    const xml = `<selectionEntry id="u1" name="Test Unit" type="unit" hidden="false">
      <infoLinks>
        <infoLink id="l1" name="Deep Strike" hidden="true" type="rule" targetId="rule-deep-strike"/>
        <infoLink id="l2" name="Stub Rule" hidden="false" type="rule" targetId="rule-no-description"/>
      </infoLinks>
    </selectionEntry>`;
    const entry = xmlParser.parse(xml).selectionEntry[0];
    const profiles = collectAllProfiles(entry, ruleIndex);
    const unit = parseEntryNode(entry, "Test Faction", profiles);

    expect(unit!.abilities).toHaveLength(0);
  });

  it("does not resolve rule infoLinks when no ruleIndex is given (backward compatible)", () => {
    const xml = `<selectionEntry id="u1" name="Test Unit" type="unit" hidden="false">
      <infoLinks>
        <infoLink id="l1" name="Deep Strike" hidden="false" type="rule" targetId="rule-deep-strike"/>
      </infoLinks>
    </selectionEntry>`;
    const entry = xmlParser.parse(xml).selectionEntry[0];
    const profiles = collectAllProfiles(entry);
    const unit = parseEntryNode(entry, "Test Faction", profiles);

    expect(unit!.abilities).toHaveLength(0);
  });
});

// === BSData/wh40k-11e JSON fixture (same schema, JSON-native shapes) ===

const FIXTURE_11E_CAT_JSON = {
  catalogue: {
    id: "test-cat-11e",
    name: "Imperium - Space Marines",
    gameSystemId: "sys1",
    selectionEntries: [
      {
        id: "unit-1",
        name: "Intercessor Squad",
        type: "unit",
        hidden: false,
        categoryLinks: [
          { id: "cl-1", name: "Infantry", hidden: false },
          { id: "cl-2", name: "Faction: Imperium", hidden: false },
        ],
        costs: [{ name: "pts", typeId: "51b2-306e-1021-d207", value: 80 }],
        profiles: [
          {
            id: "p1",
            name: "Intercessor",
            typeId: "c547-1836-d8a-ff4f",
            characteristics: [
              { name: "M", typeId: "e703-ecb6-5ce7-aec1", $text: '6"' },
              { name: "T", typeId: "d29d-cf75-fc2d-34a4", $text: "4" },
              { name: "SV", typeId: "450a-a17e-9d5e-29da", $text: "3+" },
              { name: "W", typeId: "750a-a2ec-90d3-21fe", $text: "2" },
              { name: "LD", typeId: "58d2-b879-49c7-43bc", $text: "6+" },
              { name: "OC", typeId: "bef7-942a-1a23-59f8", $text: "2" },
            ],
          },
          {
            id: "p2",
            name: "Bolt Rifle",
            typeId: "f77d-b953-8fa4-b762",
            characteristics: [
              { name: "Range", $text: '24"' },
              { name: "A", $text: "2" },
              { name: "BS", $text: "3+" },
              { name: "S", $text: "4" },
              { name: "AP", $text: "-1" },
              { name: "D", $text: "1" },
              { name: "Keywords", $text: "Assault, Heavy" },
            ],
          },
          {
            id: "p4",
            name: "Shock Assault",
            typeId: "9cc3-6d83-4dd3-9b64",
            characteristics: [
              {
                name: "Description",
                $text: "Each time this unit makes a charge move, until end of turn, add 1 to Attacks.",
              },
            ],
          },
        ],
      },
    ],
  },
};

describe("normalizeJsonNode (BSData 11e JSON)", () => {
  it("normalizes a JSON catalogue node into the same shape parseEntryNode expects from XML", () => {
    const normalized = normalizeJsonNode(FIXTURE_11E_CAT_JSON);
    const catNode = normalized.catalogue;
    const faction = extractFaction(catNode["@_name"]);
    const entry = catNode.selectionEntries.selectionEntry[0];

    const unit = parseEntryNode(entry, faction);
    expect(unit).not.toBeNull();
    expect(unit!.name).toBe("Intercessor Squad");
    expect(unit!.faction).toBe("Space Marines");
    expect(unit!.points).toBe(80);

    expect(unit!.profiles).toHaveLength(1);
    expect(unit!.profiles[0].movement).toBe('6"');
    expect(unit!.profiles[0].toughness).toBe("4");
    expect(unit!.profiles[0].save).toBe("3+");
    expect(unit!.profiles[0].wounds).toBe("2");

    expect(unit!.rangedWeapons).toHaveLength(1);
    expect(unit!.rangedWeapons[0].name).toBe("Bolt Rifle");
    expect(unit!.rangedWeapons[0].keywords).toEqual(["Assault", "Heavy"]);

    expect(unit!.abilities).toHaveLength(1);
    expect(unit!.abilities[0].name).toBe("Shock Assault");

    expect(unit!.keywords).toContain("Infantry");
    expect(unit!.keywords).not.toContain("Faction: Imperium");

    expect(unit!.unitSize).toEqual({ min: 1, max: 1 });
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
