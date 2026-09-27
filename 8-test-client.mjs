/**
 * Drives server.mjs over stdio with raw JSON-RPC, the way an MCP host would.
 * Verifies: initialize, tools/list (with _meta.ui.resourceUri),
 * resources/read (HTML with mcp-app MIME type), tools/call (data payload).
 */
import { spawn } from "node:child_process";

const server = spawn("node", ["server.mjs"], { stdio: ["pipe", "pipe", "inherit"] });
let buf = "";
const pending = new Map();
let nextId = 1;

server.stdout.on("data", (chunk) => {
  buf += chunk.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id != null && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

function request(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, (msg) => (msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)));
    server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
const notify = (method, params = {}) =>
  server.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");

const PROTOCOL = "2025-06-18";

const init = await request("initialize", {
  protocolVersion: PROTOCOL,
  capabilities: {
    extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } },
  },
  clientInfo: { name: "test-client", version: "1.0.0" },
});
console.log("initialize -> server:", init.serverInfo, "protocol:", init.protocolVersion);
notify("notifications/initialized");

const tools = await request("tools/list");
const tool = tools.tools.find((t) => t.name === "show-selfplay-loss-chart");
console.log("tools/list -> names:", tools.tools.map((t) => t.name));
console.log("tool _meta:", JSON.stringify(tool._meta));

const resources = await request("resources/list");
console.log("resources/list ->", resources.resources.map((r) => `${r.uri} (${r.mimeType})`));

const uri = tool._meta.ui.resourceUri;
const read = await request("resources/read", { uri });
const html = read.contents[0];
console.log(`resources/read -> mimeType=${html.mimeType}, html bytes=${html.text.length}, has chart markup=${html.text.includes("bar-track")}`);

const call = await request("tools/call", { name: "show-selfplay-loss-chart", arguments: {} });
console.log("tools/call -> text:", call.content[0].text.split("\n").slice(0, 3).join(" | "));
console.log("tools/call -> structuredContent:", JSON.stringify(call.structuredContent?.runs));

server.kill();
console.log("ALL CHECKS PASSED");
