import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const port = 40000 + Math.floor(Math.random() * 20000);
const child = spawn(process.execPath, ['server-http.mjs'], { env: { ...process.env, PORT: `${port}` }, stdio: ['ignore', 'pipe', 'inherit'] });
const base = `http://127.0.0.1:${port}`;
try {
  await new Promise((resolve,reject) => {
    const timer=setTimeout(()=>reject(new Error('server startup timeout')),10000);
    child.stdout.once('data',()=>{clearTimeout(timer);resolve()});
    child.once('exit', code=>reject(new Error(`server exited ${code}`)));
  });
  const rpc = async (id,method,params={}) => {
    const r=await fetch(`${base}/mcp`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id,method,params})});
    assert.equal(r.status,200);
    const raw=await r.text();
    const payload=raw.startsWith('event:') ? JSON.parse(raw.split('\n').find(line=>line.startsWith('data: ')).slice(6)) : JSON.parse(raw);
    if (payload.error) throw Error(JSON.stringify(payload.error));
    return payload.result;
  };
  const init=await rpc(1,'initialize',{protocolVersion:'2025-06-18',capabilities:{extensions:{'io.modelcontextprotocol/ui':{mimeTypes:['text/html;profile=mcp-app']}}},clientInfo:{name:'test-http',version:'1.0.0'}});
  assert(init.serverInfo);
  const tools=await rpc(2,'tools/list');
  const tool=tools.tools.find(x=>x.name==='show-selfplay-loss-chart');
  assert.equal(tool._meta.ui.resourceUri,'ui://selfplay-chart/mcp-app.html');
  const resource=await rpc(3,'resources/read',{uri:tool._meta.ui.resourceUri});
  assert.equal(resource.contents[0].mimeType,'text/html;profile=mcp-app');
  assert(resource.contents[0].text.includes('bar-track'));
  const result=await rpc(4,'tools/call',{name:tool.name,arguments:{}});
  assert.deepEqual(result.structuredContent.runs.map(x=>x.bitsPerByte),[8.56,6.16]);
  const health=await fetch(`${base}/healthz`); assert.equal(health.status,200);
  const blocked=await fetch(`${base}/mcp`,{headers:{Origin:'https://example.org'}}); assert.equal(blocked.status,403);
  console.log('HTTP checks passed: initialize, tool discovery, HTML resource, chart data, health, Origin rejection');
} finally { child.kill(); }
