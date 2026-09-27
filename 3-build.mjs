/** Bundles src/app.js and inlines it into a single self-contained HTML file. */
import { buildSync } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const result = buildSync({
  entryPoints: [path.join(HERE, "src", "app.js")],
  bundle: true,
  minify: true,
  format: "iife",
  write: false,
});

const js = result.outputFiles[0].text;
let html = fs.readFileSync(path.join(HERE, "src", "app.html"), "utf-8");
html = html.replace("/*APP_JS*/", () => js);

fs.mkdirSync(path.join(HERE, "dist"), { recursive: true });
fs.writeFileSync(path.join(HERE, "dist", "mcp-app.html"), html);
console.log(`Wrote dist/mcp-app.html (${html.length} bytes)`);
