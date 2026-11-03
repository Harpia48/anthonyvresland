// Local-only adapter for the same Pages handlers. It does not deploy or change existing files.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {onRequestGet as essays} from '../functions/essays.js';
import {onRequestGet as api} from '../functions/api/essays.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.xml':'application/xml'};
async function asset(url){
  let name=decodeURIComponent(new URL(url).pathname);
  if(name==='/')name='/index.html';
  if(!path.extname(name))name+='.html';
  const full=path.resolve(root,'.'+name);
  if(!full.startsWith(root+path.sep)||name.includes('/.'))return new Response('Not found',{status:404});
  try{
    let bytes=await readFile(full);
    return new Response(bytes,{headers:{'Content-Type':types[path.extname(name)]||'application/octet-stream'}});
  }catch{return new Response('Not found',{status:404});}
}
http.createServer(async(req,res)=>{
  try{
    const request=new Request('http://127.0.0.1:4173'+req.url);
    const context={request,env:{ASSETS:{fetch:asset}},waitUntil:p=>p.catch(()=>{})};
    const pathname=new URL(request.url).pathname;
    const response=pathname==='/api/essays'?await api(context):/^\/essays\/?$/.test(pathname)?await essays(context):await asset(request.url);
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(e){console.error(e.message);res.writeHead(500);res.end('Preview unavailable');}
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173/essays'));
