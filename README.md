# Self-play chart: MCP App for local or remote Claude

One tool, `show-selfplay-loss-chart`, returns a small interactive chart as an MCP App. Its `ui://selfplay-chart/mcp-app.html` resource is bundled HTML. Local stdio remains supported (`npm start`); `npm run start:remote` exposes Streamable HTTP at `/mcp` for a publicly reachable HTTPS deployment. Node.js 20+.

## Data and privacy

The chart shows 8.56 bits/byte (random initialization) versus 6.16 bits/byte (trained ~98k-parameter final-round learner), a 2.40 difference. These were reported from a **small local CPU run on one short text sample**, not from the paper and not a benchmark. The model repo is https://huggingface.co/nourya-cohen/solomonoff-paper . The full text sample was not included in this package and the run has not been reproduced here.

The server serves only this hard-coded, non-private chart. It uses **no authentication**. Anyone who knows/discovers the public endpoint can request the chart and HTML; do not add personal data or private tools to it without implementing proper OAuth. If you upload the source to a public GitHub repository, the source and embedded chart are also public. Do not commit secrets or `node_modules/`.

## Run and test locally

```bash
npm ci
npm test               # local stdio MCP protocol smoke test
npm run test:remote    # remote HTTP protocol smoke test on localhost
npm run start:remote   # local HTTP endpoint http://127.0.0.1:3000/mcp
```

The `dist/mcp-app.html` file is prebuilt. If you edit `src/app.js` or `src/app.html`, run `npm run build` and include the updated dist file in the deployment. For local desktop clients, run `npm start` and use the previous stdio setup (command `node`, args with the absolute path to `server.mjs`).

## Publish to Render, then add to Claude for iPhone

The iPhone app cannot use your laptop's local stdio server. Remote connectors connect from Anthropic's cloud, so the server needs a public HTTPS URL. One straightforward hobby-demo route:

1. Put this extracted folder in a **new GitHub repository** (GitHub Desktop's "Add existing repository" and "Publish repository" works, or use git from a terminal). A public repo is easiest to link to Render, but note the source and data become public. Do not upload `node_modules/`, secrets or personal data.
2. Sign in at https://dashboard.render.com/ . Choose **New > Web Service**, connect the GitHub repo and choose the branch. Language/runtime: Node. Build command: `npm ci`; Start command: `npm run start:remote`. Choose the **Free** instance if the dashboard offers it. No environment variables are needed: Render supplies `PORT`. This program binds to `0.0.0.0` on Render when `PORT` is set.
3. When Render shows the HTTPS service URL, append `/mcp` to the actual URL, for example `https://YOUR-REAL-SERVICE.onrender.com/mcp`. Do not use `/healthz` as the connector URL. A browser GET to `/mcp` is not a full MCP connection test; `npm run test:remote` tests HTTP locally.
4. In Claude on the web (signed into the **same account** as the iPhone app), open **Customize > Connectors > + > Add custom connector**. Name it "Self-play chart" and paste the real HTTPS `/mcp` URL; add it and enable it for your conversation through the **+ > Connectors** menu. On Team/Enterprise, an Owner or Primary Owner must first add it under **Organization settings > Connectors**, then members connect. The Free plan allows one custom connector. For iPhone, open/update the Claude app on the same account and enable the connector if needed. Ask Claude: "Show the self-play loss chart".

This is a remote MCP connector with an interactive MCP App UI, not just a static HTML link. The actual Claude iOS rendering and account-to-device sync have **not** been tested with a live Claude account. Anthropic documents interactive connectors on Claude iOS/Android and cloud-backed custom connectors across mobile apps, but use the fallback standalone hosted page if your particular setup does not show the UI: https://files.instinct.com/file-01M3HYF3J13P2QY73DGHA1Z8CJ . That page is private to its owner and is **not** the MCP connector. If Claude fails to connect, check Render logs, confirm the service woke up, and remove/re-add the connector if its URL changed.

Render Free web services spin down after 15 minutes idle and can take about one minute to wake. They have monthly usage limits; check Render's current pricing and limits before selecting a plan. Never assume a free plan means a private endpoint.

## Source and implementation notes

- Claude custom connectors, setup, account plans and network requirements: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- Claude interactive connectors explicitly available on iOS and Android: https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude
- MCP Apps extension and UI resource semantics: https://modelcontextprotocol.io/docs/extensions/apps
- Streamable HTTP server and stateless handler recipe: https://ts.sdk.modelcontextprotocol.io/v2/serving/http
- Render Node deployment: https://render.com/docs/deploy-node-express-app
- Render free-tier limits: https://render.com/docs/free

`server-http.mjs` creates one MCP server per HTTP request with `createMcpHandler`. It allows only `/mcp` and `/healthz`, blocks browser Origin requests, and optionally validates `PUBLIC_HOSTNAME` if set. TLS termination belongs to the HTTPS host. The deployment is authless by design for public, non-private demo data. `server.mjs` remains the stdio entry point.

## Cloudflare Workers deployment

The `cloudflare/` subfolder is a standalone Worker implementation of the same MCP App. It bundles the prebuilt `dist/mcp-app.html` as a text module. From that folder, run `npm ci`, then `npm run dev` for a local `/mcp` endpoint and `npm run deploy` after signing in to Cloudflare. The live connector URL is the URL Wrangler returns with `/mcp` appended; check the actual URL rather than guessing the workers.dev subdomain. Cloudflare's stateless MCP handler needs no Durable Object or OAuth for this non-private demo chart. Its public endpoint is intentionally unauthenticated.

The Cloudflare Worker has been smoke-tested locally for initialize, tools/list, resources/list, resources/read, tools/call, and rejection of an unrelated browser Origin. Live Cloudflare/Claude iOS use is unverified until deployed and tested.
