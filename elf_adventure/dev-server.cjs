const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const mime={'.html':'text/html','.js':'text/javascript','.cjs':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
function createServer(){
  return http.createServer((request,response)=>{
    let relative;
    try{relative=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch{response.writeHead(400).end();return;}
    const file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));
    if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
    fs.stat(file,(error,stat)=>{
      if(error||!stat.isFile()){response.writeHead(404).end();return;}
      response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
      fs.createReadStream(file).pipe(response);
    });
  });
}
if(require.main===module){const port=Number(process.env.PORT)||8080;createServer().listen(port,'127.0.0.1',()=>console.log('Elf Adventure: http://127.0.0.1:'+port));}
module.exports={createServer};
