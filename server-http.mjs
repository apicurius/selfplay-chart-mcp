/** Remote, stateless Streamable HTTP transport for the chart MCP App.
 * The static chart is intentionally unauthenticated. Do not add private data.
 * Host behind a public HTTPS proxy (e.g. Render) and use its /mcp URL.
 */
import { createServer } from 'node:http';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createChartServer } from './server.mjs';

const handler = createMcpHandler(() => createChartServer(), { responseMode: 'json' });
const nodeHandler = toNodeHandler(handler);
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
const allowedHost = process.env.PUBLIC_HOSTNAME; // Optional, e.g. my-service.onrender.com

const httpServer = createServer((req, res) => {
  if (allowedHost && req.headers.host?.split(':')[0] !== allowedHost) {
    res.writeHead(403).end('Forbidden'); return;
  }
  // Cross-origin browser requests are not part of this server's usage.
  if (req.headers.origin) {
    res.writeHead(403).end('Forbidden'); return;
  }
  if (req.url === '/healthz' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'text/plain' }).end('ok'); return;
  }
  if (req.url !== '/mcp') {
    res.writeHead(404).end('Not found'); return;
  }
  void nodeHandler(req, res);
});
httpServer.listen(port, host, () => console.log(`MCP chart at http://${host}:${port}/mcp`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  httpServer.close(); void handler.close();
});
