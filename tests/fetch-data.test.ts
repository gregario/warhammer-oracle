import { afterEach, describe, expect, it, vi } from "vitest";
import { fetch11e } from "../scripts/fetch-data.js";

afterEach(() => vi.unstubAllGlobals());

describe("11e catalogue unit selection", () => {
  it("omits an orphaned shared model while retaining the same-named root-linked unit", async () => {
    // Mirrors the two Runtherd definitions in BSData's Orks catalogue: a
    // stale shared model with no roster link, and a new standalone character.
    const catalogue = {
      catalogue: {
        id: "orks-cat",
        name: "Orks",
        library: false,
        sharedSelectionEntries: [
          { id: "orphan-runtherd", name: "Runtherd", type: "model", profiles: [] },
          {
            id: "standalone-runtherd",
            name: "Runtherd",
            type: "model",
            costs: [{ name: "pts", typeId: "51b2-306e-1021-d207", value: 10 }],
            categoryLinks: [
              { name: "Infantry" },
              { name: "Character" },
              { name: "Faction: Orks" },
              { name: "Support" },
            ],
          },
        ],
        entryLinks: [
          { id: "roster-runtherd", name: "Runtherd", targetId: "standalone-runtherd", type: "selectionEntry" },
        ],
      },
    };
    const blobs = new Map([
      ["game-system-sha", { gameSystem: { id: "system", name: "Warhammer 40,000 11th Edition" } }],
      ["orks-sha", catalogue],
    ]);
    vi.stubGlobal("fetch", async (url: string) => {
      const path = url.replace("https://api.github.com/", "");
      const data = path.endsWith("/git/trees/main?recursive=1")
        ? { tree: [
            { path: "Warhammer 40,000.json", sha: "game-system-sha", type: "blob" },
            { path: "Orks.json", sha: "orks-sha", type: "blob" },
          ] }
        : { content: Buffer.from(JSON.stringify(blobs.get(path.split("/").at(-1)!))).toString("base64") };
      return { ok: true, json: async () => data };
    });

    const { units } = await fetch11e();
    const runtherds = units.filter((unit) => unit.faction === "Orks" && unit.name === "Runtherd");

    expect(runtherds).toHaveLength(1);
    expect(runtherds[0]).toMatchObject({
      id: "roster-runtherd",
      points: 10,
      keywords: ["Infantry", "Character", "Orks", "Support"],
    });
  });
});

describe("11e catalogue-conditional content and wargear", () => {
  it("keeps a chapter-only rule on that chapter's copy of a shared datasheet, and resolves linked wargear", async () => {
    // Mirrors BSData/wh40k-11e: the Space Marines catalogue owns the Captain
    // (shared by every chapter via catalogueLink), whose "Templar Vows" rule
    // infoLink is hidden unless the primary catalogue is Black Templars.
    const gameSystem = {
      gameSystem: {
        id: "system",
        name: "Warhammer 40,000 11th Edition",
        sharedRules: [
          {
            id: "rule-vows",
            name: "Templar Vows",
            hidden: true,
            description: "Black Templars vow text.",
            modifiers: [
              {
                type: "set",
                field: "hidden",
                value: true,
                conditions: [{ type: "notInstanceOf", scope: "primary-catalogue", childId: "bt-cat", field: "selections", value: 1 }],
              },
            ],
          },
        ],
      },
    };
    const spaceMarines = {
      catalogue: {
        id: "sm-cat",
        name: "Imperium - Adeptus Astartes - Space Marines",
        library: false,
        sharedSelectionEntries: [
          { id: "w-bolter", name: "Master-crafted bolter", type: "upgrade", profiles: [{ id: "p-b", name: "Master-crafted bolter", typeId: "f77d-b953-8fa4-b762" }] },
          { id: "w-pistol", name: "Plasma pistol", type: "upgrade", profiles: [{ id: "p-p", name: "Plasma pistol", typeId: "f77d-b953-8fa4-b762" }] },
          {
            id: "captain",
            name: "Captain",
            type: "model",
            profiles: [{ id: "p-cap", name: "Captain", typeId: "c547-1836-d8a-ff4f" }],
            infoLinks: [{ id: "il-vows", name: "Templar Vows", targetId: "rule-vows", type: "rule" }],
            selectionEntryGroups: [
              {
                id: "g-ranged",
                name: "Ranged Weapon",
                defaultSelectionEntryId: "l-bolter",
                constraints: [
                  { type: "min", value: 1, field: "selections", scope: "parent" },
                  { type: "max", value: 1, field: "selections", scope: "parent" },
                ],
                entryLinks: [
                  { id: "l-bolter", name: "Master-crafted bolter", targetId: "w-bolter", type: "selectionEntry" },
                  { id: "l-pistol", name: "Plasma pistol", targetId: "w-pistol", type: "selectionEntry" },
                ],
              },
            ],
          },
        ],
        entryLinks: [{ id: "root-captain", name: "Captain", targetId: "captain", type: "selectionEntry" }],
      },
    };
    const blackTemplars = {
      catalogue: {
        id: "bt-cat",
        name: "Imperium - Adeptus Astartes - Black Templars",
        library: false,
        catalogueLinks: [{ id: "cl-sm", name: "Space Marines", targetId: "sm-cat", type: "catalogue" }],
      },
    };
    const blobs = new Map<string, unknown>([
      ["gs-sha", gameSystem],
      ["sm-sha", spaceMarines],
      ["bt-sha", blackTemplars],
    ]);
    vi.stubGlobal("fetch", async (url: string) => {
      const path = url.replace("https://api.github.com/", "");
      const data = path.endsWith("/git/trees/main?recursive=1")
        ? {
            tree: [
              { path: "Warhammer 40,000.json", sha: "gs-sha", type: "blob" },
              { path: "Imperium - Space Marines.json", sha: "sm-sha", type: "blob" },
              { path: "Imperium - Black Templars.json", sha: "bt-sha", type: "blob" },
            ],
          }
        : { content: Buffer.from(JSON.stringify(blobs.get(path.split("/").at(-1)!))).toString("base64") };
      return { ok: true, json: async () => data };
    });

    const { units } = await fetch11e();
    const captain = (faction: string) => units.find((u) => u.name === "Captain" && u.faction === faction);
    const sm = captain("Adeptus Astartes - Space Marines");
    const bt = captain("Adeptus Astartes - Black Templars");

    expect(sm?.abilities.map((a) => a.name)).not.toContain("Templar Vows");
    expect(bt?.abilities.map((a) => a.name)).toContain("Templar Vows");
    expect(sm?.unitSize).toEqual({ min: 1, max: 1 });
    expect(sm?.composition).toEqual([{ model: "Captain", min: 1, max: 1 }]);
    expect(sm?.wargear).toEqual([
      {
        model: "Captain",
        default: ["Master-crafted bolter"],
        options: ["Master-crafted bolter can be replaced with Plasma pistol"],
      },
    ]);
  });
});
