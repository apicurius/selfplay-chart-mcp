/**
 * MCP App server (stdio transport).
 *
 * Serves one tool, `show-selfplay-loss-chart`, linked to an interactive UI
 * resource (ui://selfplay-chart/mcp-app.html) that renders a bits-per-byte
 * comparison from a small local CPU experiment with the self-play pretraining
 * repo (98k-parameter learner, final-round checkpoint vs random init).
 *
 * Run:  node server.mjs
 * (stdio is the only transport; MCP desktop clients launch it directly)
 */
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import appHtml from "../dist/mcp-app.html";
import { z } from "zod";


// The experiment data. Source: local CPU run, ~98k-parameter final-round
// learner checkpoint from https://huggingface.co/nourya-cohen/solomonoff-paper
// vs the same model with random initialization, scored on one short text
// sample. Small local experiment, not a paper benchmark.
const EXPERIMENT = {
  title: "Self-play vs random init: bits per byte",
  unit: "bits/byte",
  runs: [
    {
      id: "random",
      label: "Random init (untrained)",
      bitsPerByte: 8.56,
      note: "Same model, random initialization weights, same text sample.",
    },
    {
      id: "trained",
      label: "Trained (98k params, final round)",
      bitsPerByte: 6.16,
      note: "Final-round learner checkpoint from self-play training, same text sample.",
    },
  ],
  difference: 2.4,
  caveat:
    "Small local CPU experiment on one short text sample. Not a result from the paper and not a benchmark.",
  source: "https://huggingface.co/nourya-cohen/solomonoff-paper",
};

function textSummary() {
  const [a, b] = EXPERIMENT.runs;
  return (
    `${EXPERIMENT.title}\n` +
    EXPERIMENT.runs.map((r) => `- ${r.label}: ${r.bitsPerByte} ${EXPERIMENT.unit}`).join("\n") +
    `\nDifference: ${EXPERIMENT.difference} ${EXPERIMENT.unit} (${a.label} -> ${b.label}).\n` +
    EXPERIMENT.caveat
  );
}

export function createChartServer() {
const server = new McpServer({
  name: "selfplay-loss-chart",
  version: "1.0.0",
});

const resourceUri = "ui://selfplay-chart/mcp-app.html";

registerAppTool(
  server,
  "show-selfplay-loss-chart",
  {
    title: "Self-play loss chart",
    description:
      "Shows an interactive chart comparing bits per byte of a self-play-trained tiny model " +
      "vs random initialization, from a local CPU experiment.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      title: z.string(),
      unit: z.string(),
      runs: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          bitsPerByte: z.number(),
          note: z.string(),
        }),
      ),
      difference: z.number(),
      caveat: z.string(),
      source: z.string(),
    }),
    _meta: { ui: { resourceUri } }, // links the tool to its interactive UI
  },
  async () => ({
    content: [{ type: "text", text: textSummary() }],
    structuredContent: EXPERIMENT,
  }),
);

registerAppResource(
  server,
  resourceUri,
  resourceUri,
  { mimeType: RESOURCE_MIME_TYPE },
  async () => {
    return { contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: appHtml }] };
  },
);

return server;
}


export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/healthz" && request.method === "GET") {
      return new Response("ok", { headers: { "content-type": "text/plain" } });
    }
    if (url.pathname !== "/mcp") return new Response("Not found", { status: 404 });
    return createMcpHandler(createChartServer, { route: "/mcp", responseMode: "json", corsOptions: false })(request, env, ctx);
  },
};
