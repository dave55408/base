const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const replayExport=require('./replay-export-server.cjs').createReplayExportHandler({root});
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg','.wav':'audio/wav'};
const server = http.createServer(async(req,res)=>{
  if(await replayExport(req,res))return;
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);return res.end();}
  let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}
  if(name==='/')name='/index.html';
  const file=path.resolve(root,'.'+name);
  if(!file.startsWith(root+path.sep)||!Object.hasOwn(types,path.extname(file))){res.writeHead(404);return res.end();}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);});
});
if(require.main===module)server.listen(process.env.PORT||3188,'127.0.0.1',()=>console.log('ST Battle ready at http://localhost:'+(process.env.PORT||3188)));
module.exports=server;
