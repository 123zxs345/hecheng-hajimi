import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist'),port=Number(process.env.PORT||4196);
const prefix=process.env.PREVIEW_BASE||'/hecheng-hajimi/';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.wav':'audio/wav','.mp3':'audio/mpeg'};
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    if(path===prefix.slice(0,-1)){res.writeHead(302,{location:prefix});res.end();return;}
    if(!path.startsWith(prefix)){res.writeHead(404);res.end();return;}
    const relative=path.slice(prefix.length)||'index.html';
    if(relative.split('/').some(part=>part.startsWith('.'))){res.writeHead(404);res.end();return;}
    const file=resolve(root,relative);
    if(!file.startsWith(root+sep)||!(await stat(file)).isFile()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
});
server.listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port+prefix));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
