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
