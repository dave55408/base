const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.m4a':'audio/mp4','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'};
function createServer(){
  return http.createServer((req,res)=>{
    let file;
    try { file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':new URL(req.url,'http://localhost').pathname)); }
    catch { res.writeHead(400).end(); return; }
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.stat(file,(error,stat)=>{
      if(error||!stat.isFile()){res.writeHead(404).end('Not found');return;}
      const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes'};
      let start=0,end=stat.size-1,code=200;
      if(req.headers.range){
        const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if(!range||(!range[1]&&!range[2])){res.writeHead(416,{'Content-Range':'bytes */'+stat.size}).end();return;}
        if(!range[1])start=Math.max(0,stat.size-Number(range[2]));
        else{start=Number(range[1]);if(range[2])end=Math.min(end,Number(range[2]));}
        if(start>=stat.size||start>end){res.writeHead(416,{'Content-Range':'bytes */'+stat.size}).end();return;}
        code=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
      }
      headers['Content-Length']=end-start+1;
      res.writeHead(code,headers);
      if(req.method==='HEAD'){res.end();return;}
      const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
    });
  });
}
if(require.main===module)createServer().listen(Number(process.env.PORT)||8090,'127.0.0.1',()=>console.log('ST Command: http://127.0.0.1:8090'));
module.exports={createServer};
