import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DISPOSITIONS, MISSION_MATCHUPS } from "../data/dispositions.js";
import type { Disposition } from "../types.js";

function findMatchup(
  yours: Disposition,
  opponents: Disposition,
): { yourMission: string; opponentMission: string } | undefined {
  const direct = MISSION_MATCHUPS.find(
    (m) => m.dispositionA === yours && m.dispositionB === opponents,
  );
  if (direct) return { yourMission: direct.missionA, opponentMission: direct.missionB };

  const reversed = MISSION_MATCHUPS.find(
    (m) => m.dispositionA === opponents && m.dispositionB === yours,
  );
  if (reversed) return { yourMission: reversed.missionB, opponentMission: reversed.missionA };

  return undefined;
}

export function registerDeterminePrimaryMission(server: McpServer): void {
  server.tool(
    "determine_primary_mission",
    "Determine each player's Primary Mission from their Force Dispositions, per Warhammer 40,000 11th Edition Matched Play. Each player's mission is looked up from their OPPONENT's Force Disposition — in a non-mirror matchup, the two players get different missions.",
    {
      your_disposition: z
        .enum(["Take and Hold", "Purge the Foe", "Reconnaissance", "Priority Assets", "Disruption"])
        .describe("Your army's Force Disposition, selected when mustering."),
      opponent_disposition: z
        .enum(["Take and Hold", "Purge the Foe", "Reconnaissance", "Priority Assets", "Disruption"])
        .describe("Your opponent's Force Disposition, selected when mustering."),
    },
    async ({ your_disposition, opponent_disposition }) => {
      const result = findMatchup(your_disposition, opponent_disposition);

      if (!result) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No mission matchup found for "${your_disposition}" vs "${opponent_disposition}".\n\nAvailable Force Dispositions: ${DISPOSITIONS.join(", ")}.`,
            },
          ],
        };
      }

      const lines = [
        `# Primary Mission: ${your_disposition} vs ${opponent_disposition}`,
        `**Your Primary Mission:** ${result.yourMission}`,
        `**Opponent's Primary Mission:** ${result.opponentMission}`,
        "",
        "> This gives mission names only, not full scoring/objective text — that lives in the Chapter Approved Mission Deck or the Warhammer 40,000 App. Reflects a curated subset of pairings verified from GW's free Warhammer Event Companion, extended with cross-validated fan-sourced data for the rest.",
      ];

      return {
        content: [
          {
            type: "text" as const,
            text: lines.join("\n"),
          },
        ],
      };
    },
  );
}
