import { describe, it, expect } from "vitest";
import { parseCatalogue, parseGameSystem } from "../src/lib/xml-parser.js";

// === Inline XML Fixtures ===

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<gameSystem id="sys-123" name="Warhammer 40,000: 10th Edition" revision="5"
  xmlns="http://www.battlescribe.net/schema/gameSystemSchema">
  <rules>
    <rule id="rule-001" name="Feel No Pain" hidden="false">
      <description>Each time this model would lose a wound, roll one D6: if the result equals or exceeds the Feel No Pain value, that wound is not lost.</description>
    </rule>
    <rule id="rule-002" name="Deadly Demise" hidden="false">
      <description>When this model is destroyed, roll one D6. On a 6, each unit within 6&quot; suffers D3 mortal wounds.</description>
    </rule>
    <rule id="rule-hidden" name="Hidden Rule" hidden="true">
      <description>This should still be parsed.</description>
    </rule>
  </rules>
</gameSystem>`;

const GAME_SYSTEM_SINGLE_RULE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<gameSystem id="sys-456" name="Warhammer 40,000: 10th Edition" revision="1"
  xmlns="http://www.battlescribe.net/schema/gameSystemSchema">
  <rules>
    <rule id="rule-solo" name="Lone Operative" hidden="false">
      <description>Unless part of an Attached unit, this unit can only be selected as the target of a ranged attack if the attacking model is within 12&quot;.</description>
    </rule>
  </rules>
</gameSystem>`;

const GAME_SYSTEM_NO_RULES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<gameSystem id="sys-789" name="Warhammer 40,000: 10th Edition" revision="1"
  xmlns="http://www.battlescribe.net/schema/gameSystemSchema">
</gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<catalogue id="cat-001" name="Imperium - Space Marines" revision="3"
  xmlns="http://www.battlescribe.net/schema/catalogueSchema">
  <selectionEntries>
    <selectionEntry id="unit-001" name="Intercessor Squad" type="unit" hidden="false">
      <costs>
        <cost name="pts" typeId="51b2-306e-1021-d207" value="75"/>
      </costs>
      <categoryLinks>
        <categoryLink id="cl-1" name="Infantry" targetId="cat-inf" hidden="false"/>
        <categoryLink id="cl-2" name="Faction: Adeptus Astartes" targetId="cat-faction" hidden="false"/>
        <categoryLink id="cl-3" name="Imperium" targetId="cat-imp" hidden="false"/>
        <categoryLink id="cl-hidden" name="HiddenKeyword" targetId="cat-hid" hidden="true"/>
      </categoryLinks>
      <profiles>
        <profile id="prof-001" name="Intercessor" typeId="c547-1836-d8a-ff4f" typeName="Unit" hidden="false">
          <characteristics>
            <characteristic name="M" typeId="char-m">6&quot;</characteristic>
            <characteristic name="T" typeId="char-t">4</characteristic>
            <characteristic name="SV" typeId="char-sv">3+</characteristic>
            <characteristic name="W" typeId="char-w">2</characteristic>
            <characteristic name="LD" typeId="char-ld">6+</characteristic>
            <characteristic name="OC" typeId="char-oc">2</characteristic>
          </characteristics>
        </profile>
        <profile id="prof-002" name="Bolt rifle" typeId="f77d-b953-8fa4-b762" typeName="Ranged Weapons" hidden="false">
          <characteristics>
            <characteristic name="Range" typeId="char-range">30&quot;</characteristic>
            <characteristic name="A" typeId="char-a">2</characteristic>
            <characteristic name="BS" typeId="char-bs">3+</characteristic>
            <characteristic name="S" typeId="char-s">4</characteristic>
            <characteristic name="AP" typeId="char-ap">-1</characteristic>
            <characteristic name="D" typeId="char-d">1</characteristic>
            <characteristic name="Keywords" typeId="char-kw">Assault, Heavy</characteristic>
          </characteristics>
        </profile>
        <profile id="prof-003" name="Close combat weapon" typeId="8a40-4aaa-c780-9046" typeName="Melee Weapons" hidden="false">
          <characteristics>
            <characteristic name="Range" typeId="char-range">Melee</characteristic>
            <characteristic name="A" typeId="char-a">3</characteristic>
            <characteristic name="WS" typeId="char-ws">3+</characteristic>
            <characteristic name="S" typeId="char-s">4</characteristic>
            <characteristic name="AP" typeId="char-ap">0</characteristic>
            <characteristic name="D" typeId="char-d">1</characteristic>
            <characteristic name="Keywords" typeId="char-kw"></characteristic>
          </characteristics>
        </profile>
        <profile id="prof-004" name="Oath of Moment" typeId="9cc3-6d83-4dd3-9b64" typeName="Abilities" hidden="false">
          <characteristics>
            <characteristic name="Description" typeId="char-desc">At the start of your Command phase, select one enemy unit. Until the start of your next Command phase, each time a model in this unit makes an attack that targets that enemy unit, you can re-roll the Hit roll and you can re-roll the Wound roll.</characteristic>
          </characteristics>
        </profile>
      </profiles>
      <selectionEntries>
        <selectionEntry id="sub-001" name="Astartes grenade launcher" type="upgrade" hidden="false">
          <profiles>
            <profile id="sub-prof-001" name="Astartes grenade launcher - frag" typeId="f77d-b953-8fa4-b762" typeName="Ranged Weapons" hidden="false">
              <characteristics>
                <characteristic name="Range" typeId="char-range">24&quot;</characteristic>
                <characteristic name="A" typeId="char-a">D6</characteristic>
                <characteristic name="BS" typeId="char-bs">3+</characteristic>
                <characteristic name="S" typeId="char-s">4</characteristic>
                <characteristic name="AP" typeId="char-ap">0</characteristic>
                <characteristic name="D" typeId="char-d">1</characteristic>
                <characteristic name="Keywords" typeId="char-kw">Blast</characteristic>
              </characteristics>
            </profile>
          </profiles>
        </selectionEntry>
      </selectionEntries>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

const CATALOGUE_XENOS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<catalogue id="cat-002" name="Xenos - Leagues of Votann" revision="1"
  xmlns="http://www.battlescribe.net/schema/catalogueSchema">
  <selectionEntries>
    <selectionEntry id="unit-002" name="Hearthkyn Warriors" type="unit" hidden="false">
      <costs>
        <cost name="pts" typeId="51b2-306e-1021-d207" value="120"/>
      </costs>
      <categoryLinks>
        <categoryLink id="cl-10" name="Infantry" targetId="cat-inf" hidden="false"/>
        <categoryLink id="cl-11" name="Faction: Leagues of Votann" targetId="cat-fac" hidden="false"/>
      </categoryLinks>
      <profiles>
        <profile id="prof-010" name="Hearthkyn Warriors" typeId="c547-1836-d8a-ff4f" typeName="Unit" hidden="false">
          <characteristics>
            <characteristic name="M" typeId="char-m">5&quot;</characteristic>
            <characteristic name="T" typeId="char-t">5</characteristic>
            <characteristic name="SV" typeId="char-sv">4+</characteristic>
            <characteristic name="W" typeId="char-w">1</characteristic>
            <characteristic name="LD" typeId="char-ld">7+</characteristic>
            <characteristic name="OC" typeId="char-oc">2</characteristic>
          </characteristics>
        </profile>
      </profiles>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

const CATALOGUE_NO_POINTS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<catalogue id="cat-003" name="Imperium - Agents of the Imperium" revision="1"
  xmlns="http://www.battlescribe.net/schema/catalogueSchema">
  <selectionEntries>
    <selectionEntry id="unit-003" name="Vindicare Assassin" type="model" hidden="false">
      <categoryLinks>
        <categoryLink id="cl-20" name="Character" targetId="cat-char" hidden="false"/>
      </categoryLinks>
      <profiles>
        <profile id="prof-020" name="Vindicare Assassin" typeId="c547-1836-d8a-ff4f" typeName="Unit" hidden="false">
          <characteristics>
            <characteristic name="M" typeId="char-m">7&quot;</characteristic>
            <characteristic name="T" typeId="char-t">4</characteristic>
            <characteristic name="SV" typeId="char-sv">6+</characteristic>
            <characteristic name="W" typeId="char-w">4</characteristic>
            <characteristic name="LD" typeId="char-ld">6+</characteristic>
            <characteristic name="OC" typeId="char-oc">1</characteristic>
          </characteristics>
        </profile>
      </profiles>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

const CATALOGUE_WITH_ENTRY_GROUPS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<catalogue id="cat-004" name="Imperium - Space Marines" revision="1"
  xmlns="http://www.battlescribe.net/schema/catalogueSchema">
  <selectionEntries>
    <selectionEntry id="unit-004" name="Terminator Squad" type="unit" hidden="false">
      <costs>
        <cost name="pts" typeId="51b2-306e-1021-d207" value="185"/>
      </costs>
      <categoryLinks>
        <categoryLink id="cl-30" name="Infantry" targetId="cat-inf" hidden="false"/>
      </categoryLinks>
      <profiles>
        <profile id="prof-030" name="Terminator" typeId="c547-1836-d8a-ff4f" typeName="Unit" hidden="false">
          <characteristics>
            <characteristic name="M" typeId="char-m">5&quot;</characteristic>
            <characteristic name="T" typeId="char-t">5</characteristic>
            <characteristic name="SV" typeId="char-sv">2+</characteristic>
            <characteristic name="W" typeId="char-w">3</characteristic>
            <characteristic name="LD" typeId="char-ld">6+</characteristic>
            <characteristic name="OC" typeId="char-oc">1</characteristic>
          </characteristics>
        </profile>
      </profiles>
      <selectionEntryGroups>
        <selectionEntryGroup id="group-001" name="Weapon options" hidden="false">
          <selectionEntries>
            <selectionEntry id="sub-010" name="Storm bolter" type="upgrade" hidden="false">
              <profiles>
                <profile id="sub-prof-010" name="Storm bolter" typeId="f77d-b953-8fa4-b762" typeName="Ranged Weapons" hidden="false">
                  <characteristics>
                    <characteristic name="Range" typeId="char-range">24&quot;</characteristic>
                    <characteristic name="A" typeId="char-a">2</characteristic>
                    <characteristic name="BS" typeId="char-bs">3+</characteristic>
                    <characteristic name="S" typeId="char-s">4</characteristic>
                    <characteristic name="AP" typeId="char-ap">0</characteristic>
                    <characteristic name="D" typeId="char-d">1</characteristic>
                    <characteristic name="Keywords" typeId="char-kw">Rapid Fire 2</characteristic>
                  </characteristics>
                </profile>
              </profiles>
            </selectionEntry>
          </selectionEntries>
        </selectionEntryGroup>
      </selectionEntryGroups>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

const CATALOGUE_MULTIPLE_PROFILES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<catalogue id="cat-005" name="Imperium - Space Marines" revision="1"
  xmlns="http://www.battlescribe.net/schema/catalogueSchema">
  <selectionEntries>
    <selectionEntry id="unit-005" name="Dreadnought" type="model" hidden="false">
      <costs>
        <cost name="pts" typeId="51b2-306e-1021-d207" value="160"/>
      </costs>
      <categoryLinks>
        <categoryLink id="cl-40" name="Vehicle" targetId="cat-veh" hidden="false"/>
      </categoryLinks>
      <profiles>
        <profile id="prof-040" name="Dreadnought" typeId="c547-1836-d8a-ff4f" typeName="Unit" hidden="false">
          <characteristics>
            <characteristic name="M" typeId="char-m">6&quot;</characteristic>
            <characteristic name="T" typeId="char-t">9</characteristic>
            <characteristic name="SV" typeId="char-sv">2+</characteristic>
            <characteristic name="W" typeId="char-w">8</characteristic>
            <characteristic name="LD" typeId="char-ld">6+</characteristic>
            <characteristic name="OC" typeId="char-oc">3</characteristic>
          </characteristics>
        </profile>
        <profile id="prof-041" name="Assault cannon" typeId="f77d-b953-8fa4-b762" typeName="Ranged Weapons" hidden="false">
          <characteristics>
            <characteristic name="Range" typeId="char-range">24&quot;</characteristic>
            <characteristic name="A" typeId="char-a">6</characteristic>
            <characteristic name="BS" typeId="char-bs">3+</characteristic>
            <characteristic name="S" typeId="char-s">6</characteristic>
            <characteristic name="AP" typeId="char-ap">0</characteristic>
            <characteristic name="D" typeId="char-d">1</characteristic>
            <characteristic name="Keywords" typeId="char-kw">Devastating Wounds</characteristic>
          </characteristics>
        </profile>
        <profile id="prof-042" name="Dreadnought combat weapon" typeId="8a40-4aaa-c780-9046" typeName="Melee Weapons" hidden="false">
          <characteristics>
            <characteristic name="Range" typeId="char-range">Melee</characteristic>
            <characteristic name="A" typeId="char-a">5</characteristic>
            <characteristic name="WS" typeId="char-ws">3+</characteristic>
            <characteristic name="S" typeId="char-s">12</characteristic>
            <characteristic name="AP" typeId="char-ap">-3</characteristic>
            <characteristic name="D" typeId="char-d">3</characteristic>
            <characteristic name="Keywords" typeId="char-kw"></characteristic>
          </characteristics>
        </profile>
        <profile id="prof-043" name="Duty Eternal" typeId="9cc3-6d83-4dd3-9b64" typeName="Abilities" hidden="false">
          <characteristics>
            <characteristic name="Description" typeId="char-desc">Each time an attack is allocated to this model, subtract 1 from the Damage characteristic of that attack.</characteristic>
          </characteristics>
        </profile>
        <profile id="prof-044" name="Unyielding Ancient" typeId="9cc3-6d83-4dd3-9b64" typeName="Abilities" hidden="false">
          <characteristics>
            <characteristic name="Description" typeId="char-desc">The first time this model is destroyed, roll one D6: on a 4+, set it back up with D3 wounds remaining.</characteristic>
          </characteristics>
        </profile>
      </profiles>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

// === Tests ===

describe("parseGameSystem", () => {
  it("extracts shared rules from a game system", () => {
    const result = parseGameSystem(GAME_SYSTEM_XML);

    expect(result.id).toBe("sys-123");
    expect(result.name).toBe("Warhammer 40,000: 10th Edition");
    expect(result.rules).toHaveLength(3);
    expect(result.rules[0]).toEqual({
      id: "rule-001",
      name: "Feel No Pain",
      description:
        'Each time this model would lose a wound, roll one D6: if the result equals or exceeds the Feel No Pain value, that wound is not lost.',
    });
    expect(result.rules[1]).toEqual({
      id: "rule-002",
      name: "Deadly Demise",
      description:
        'When this model is destroyed, roll one D6. On a 6, each unit within 6" suffers D3 mortal wounds.',
    });
  });

  it("handles a single rule (not wrapped in array by parser)", () => {
    const result = parseGameSystem(GAME_SYSTEM_SINGLE_RULE_XML);

    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].name).toBe("Lone Operative");
  });

  it("handles no rules gracefully", () => {
    const result = parseGameSystem(GAME_SYSTEM_NO_RULES_XML);

    expect(result.rules).toEqual([]);
  });
});

describe("parseCatalogue", () => {
  it("extracts unit name and id", () => {
    const units = parseCatalogue(CATALOGUE_XML);

    expect(units).toHaveLength(1);
    expect(units[0].id).toBe("unit-001");
    expect(units[0].name).toBe("Intercessor Squad");
  });

  it("extracts faction name from catalogue name (strips prefix)", () => {
    const units = parseCatalogue(CATALOGUE_XENOS_XML);

    expect(units[0].faction).toBe("Leagues of Votann");
  });

  it("extracts faction name from catalogue with Imperium prefix", () => {
    const units = parseCatalogue(CATALOGUE_XML);

    expect(units[0].faction).toBe("Space Marines");
  });

  it("sets gameSystem to wh40k-10e", () => {
    const units = parseCatalogue(CATALOGUE_XML);

    expect(units[0].gameSystem).toBe("wh40k-10e");
  });

  it("extracts unit profiles (M, T, SV, W, LD, OC)", () => {
    const units = parseCatalogue(CATALOGUE_XML);
    const profiles = units[0].profiles;

    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toEqual({
      name: "Intercessor",
      movement: '6"',
      toughness: "4",
      save: "3+",
      wounds: "2",
      leadership: "6+",
      objectiveControl: "2",
    });
  });

  it("extracts ranged weapons from direct profiles", () => {
    const units = parseCatalogue(CATALOGUE_XML);
    const ranged = units[0].rangedWeapons;

    // Should include bolt rifle from direct profiles + grenade launcher from sub-entry
    const boltRifle = ranged.find((w) => w.name === "Bolt rifle");
    expect(boltRifle).toEqual({
      name: "Bolt rifle",
      range: '30"',
      attacks: "2",
      ballisticSkill: "3+",
      strength: "4",
      armourPenetration: "-1",
      damage: "1",
      keywords: ["Assault", "Heavy"],
    });
  });

  it("extracts ranged weapons from sub-entries", () => {
    const units = parseCatalogue(CATALOGUE_XML);
    const ranged = units[0].rangedWeapons;

    const grenadeLauncher = ranged.find(
      (w) => w.name === "Astartes grenade launcher - frag"
    );
    expect(grenadeLauncher).toBeDefined();
    expect(grenadeLauncher!.range).toBe('24"');
    expect(grenadeLauncher!.keywords).toEqual(["Blast"]);
  });

  it("extracts melee weapons", () => {
    const units = parseCatalogue(CATALOGUE_XML);
    const melee = units[0].meleeWeapons;

    expect(melee).toHaveLength(1);
    expect(melee[0]).toEqual({
      name: "Close combat weapon",
      range: "Melee",
      attacks: "3",
      weaponSkill: "3+",
      strength: "4",
      armourPenetration: "0",
      damage: "1",
      keywords: [],
    });
  });

  it("extracts abilities", () => {
    const units = parseCatalogue(CATALOGUE_XML);
    const abilities = units[0].abilities;

    expect(abilities).toHaveLength(1);
    expect(abilities[0].name).toBe("Oath of Moment");
    expect(abilities[0].description).toContain("re-roll the Hit roll");
  });

  it("extracts points", () => {
    const units = parseCatalogue(CATALOGUE_XML);

    expect(units[0].points).toBe(75);
  });

  it("returns null points when no cost entry", () => {
    const units = parseCatalogue(CATALOGUE_NO_POINTS_XML);

    expect(units[0].points).toBeNull();
  });

  it("extracts keywords, filtering out Faction: prefix and hidden", () => {
    const units = parseCatalogue(CATALOGUE_XML);
    const keywords = units[0].keywords;

    expect(keywords).toContain("Infantry");
    expect(keywords).toContain("Imperium");
    expect(keywords).not.toContain("Faction: Adeptus Astartes");
    expect(keywords).not.toContain("HiddenKeyword");
  });

  it("extracts weapons from selectionEntryGroups", () => {
    const units = parseCatalogue(CATALOGUE_WITH_ENTRY_GROUPS_XML);
    const ranged = units[0].rangedWeapons;

    expect(ranged).toHaveLength(1);
    expect(ranged[0].name).toBe("Storm bolter");
    expect(ranged[0].keywords).toEqual(["Rapid Fire 2"]);
  });

  it("handles multiple abilities on a single unit", () => {
    const units = parseCatalogue(CATALOGUE_MULTIPLE_PROFILES_XML);
    const abilities = units[0].abilities;

    expect(abilities).toHaveLength(2);
    expect(abilities[0].name).toBe("Duty Eternal");
    expect(abilities[1].name).toBe("Unyielding Ancient");
  });

  it("handles model type selection entries", () => {
    const units = parseCatalogue(CATALOGUE_MULTIPLE_PROFILES_XML);

    expect(units[0].name).toBe("Dreadnought");
    expect(units[0].profiles[0].toughness).toBe("9");
  });

  it("skips hidden selection entries", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<catalogue id="cat-099" name="Imperium - Test" revision="1"
  xmlns="http://www.battlescribe.net/schema/catalogueSchema">
  <selectionEntries>
    <selectionEntry id="unit-hidden" name="Hidden Unit" type="unit" hidden="true">
      <profiles>
        <profile id="prof-h" name="Hidden" typeId="c547-1836-d8a-ff4f" typeName="Unit" hidden="false">
          <characteristics>
            <characteristic name="M">5"</characteristic>
            <characteristic name="T">4</characteristic>
            <characteristic name="SV">3+</characteristic>
            <characteristic name="W">1</characteristic>
            <characteristic name="LD">6+</characteristic>
            <characteristic name="OC">1</characteristic>
          </characteristics>
        </profile>
      </profiles>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

    const units = parseCatalogue(xml);
    expect(units).toHaveLength(0);
  });

  it("handles empty catalogue", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<catalogue id="cat-empty" name="Test - Empty" revision="1"
  xmlns="http://www.battlescribe.net/schema/catalogueSchema">
</catalogue>`;

    const units = parseCatalogue(xml);
    expect(units).toEqual([]);
  });

  it("parses weapon keywords correctly when empty", () => {
    const units = parseCatalogue(CATALOGUE_MULTIPLE_PROFILES_XML);
    const melee = units[0].meleeWeapons;

    expect(melee[0].keywords).toEqual([]);
  });
});
