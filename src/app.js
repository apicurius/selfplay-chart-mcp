/** Interactive bits-per-byte chart as an MCP App view. */
import { App, applyDocumentTheme, applyHostStyleVariables, applyHostFonts } from "@modelcontextprotocol/ext-apps";

const app = new App({ name: "Self-play loss chart", version: "1.0.0" });
const root = document.getElementById("root");

let data = null;
let selected = null;
let mode = "absolute"; // "absolute" | "percent"

function fmt(v) { return v.toFixed(2); }

function render() {
  if (!data) return;
  const maxVal = Math.max(...data.runs.map((r) => r.bitsPerByte), 8.0);
  const sel = data.runs.find((r) => r.id === selected);
  root.innerHTML = `
    <h1>${data.title}</h1>
    <p class="sub">${data.unit} — lower is better</p>
    <div class="toggle" role="group" aria-label="Scale mode">
      <button data-mode="absolute" class="${mode === "absolute" ? "active" : ""}">Bits/byte</button>
      <button data-mode="percent" class="${mode === "percent" ? "active" : ""}">% of 8-bit max</button>
    </div>
    <div class="chart">
      ${data.runs.map((r) => {
        const pct = (r.bitsPerByte / maxVal) * 100;
        const shown = mode === "absolute" ? `${fmt(r.bitsPerByte)} b/b` : `${((r.bitsPerByte / 8) * 100).toFixed(1)}%`;
        return `
          <button class="bar-row ${selected === r.id ? "selected" : ""}" data-id="${r.id}" aria-pressed="${selected === r.id}">
            <span class="bar-label"><span>${r.label}</span><span class="bar-value">${shown}</span></span>
            <span class="bar-track"><span class="bar-fill" style="width:${pct}%;display:block"></span></span>
          </button>`;
      }).join("")}
    </div>
    <div class="detail">
      ${sel
        ? `<strong>${sel.label}</strong> — ${fmt(sel.bitsPerByte)} ${data.unit}. ${sel.note}`
        : `Difference: ${fmt(data.difference)} ${data.unit} between random init and the trained checkpoint. Tap a bar for details.`}
    </div>
    <p class="caveat">${data.caveat}<br>Checkpoint: ${data.source}</p>
  `;
  root.querySelectorAll(".bar-row").forEach((el) =>
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-id");
      selected = selected === id ? null : id;
      render();
    }),
  );
  root.querySelectorAll(".toggle button").forEach((el) =>
    el.addEventListener("click", () => {
      mode = el.getAttribute("data-mode");
      render();
    }),
  );
}

function handleHostContext(ctx) {
  if (ctx?.theme) applyDocumentTheme(ctx.theme);
  if (ctx?.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx?.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
}

app.ontoolresult = (result) => {
  if (result.structuredContent) {
    data = result.structuredContent;
    selected = data.runs?.[1]?.id ?? null; // preselect the trained run
    render();
  }
};
app.onteardown = async () => ({});
app.onerror = console.error;
app.onhostcontextchanged = handleHostContext;

// Dev preview outside an MCP host: open the HTML with window.__PREVIEW_DATA__ set.
if (window.__PREVIEW_DATA__) {
  data = window.__PREVIEW_DATA__;
  selected = data.runs?.[1]?.id ?? null;
  render();
} else {
  app.connect().then(() => {
    handleHostContext(app.getHostContext());
    // Fallback for hosts that deliver the result only via notification already
    // handled above; if no data arrived yet, ask the server directly.
    if (!data) {
      app.callServerTool({ name: "show-selfplay-loss-chart", arguments: {} })
        .then((result) => {
          if (!data && result.structuredContent) {
            data = result.structuredContent;
            selected = data.runs?.[1]?.id ?? null;
            render();
          }
        })
        .catch(console.error);
    }
  });
}
