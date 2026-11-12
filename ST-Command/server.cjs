const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.m4a':'audio/mp4','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'};
const {notesDocument,readNotesDocument}=require('./project-notes-format.js');
function createServer({notesFile=path.join(root,'project-notes.html'),legacyNotesFile=path.join(path.dirname(notesFile),'project-notes.txt')}={}){
  const htmlNotes=path.extname(notesFile).toLowerCase()==='.html',notesName=path.basename(notesFile);
  async function writeNotes(notes){const temp=notesFile+'.tmp';await fs.promises.writeFile(temp,htmlNotes?notesDocument(notes):notes,'utf8');await fs.promises.rename(temp,notesFile);}
  async function readNotes(){
    try{const source=await fs.promises.readFile(notesFile,'utf8');return htmlNotes?readNotesDocument(source):source;}
    catch(error){
      if(error.code!=='ENOENT')throw error;
      let notes='';
      if(htmlNotes&&legacyNotesFile){try{notes=await fs.promises.readFile(legacyNotesFile,'utf8');}catch(legacyError){if(legacyError.code!=='ENOENT')throw legacyError;}}
      await writeNotes(notes);return notes;
    }
  }
  let notesWrites=Promise.resolve();
  return http.createServer((req,res)=>{
    if(req.url==='/api/project-notes'){
      const reply=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
      if(req.method==='GET'){
        const read=notesWrites.then(readNotes);notesWrites=read.catch(()=>{});
        read.then(notes=>reply(200,{notes})).catch(()=>reply(500,{error:'Could not read '+notesName+'.'}));return;
      }
      if(req.method!=='PUT'){reply(405,{error:'Method not allowed.'});return;}
      if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){reply(403,{error:'Origin not allowed.'});return;}
      if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')){reply(415,{error:'Expected JSON.'});return;}
      const chunks=[];let size=0,tooLarge=false;
      req.on('data',chunk=>{size+=chunk.length;if(size>65536){if(!tooLarge)reply(413,{error:'Notes must be smaller than 64 KB.'});tooLarge=true;}else chunks.push(chunk);});
      req.on('end',()=>{
        if(tooLarge)return;
        let notes;try{notes=JSON.parse(Buffer.concat(chunks).toString('utf8')).notes;if(typeof notes!=='string')throw Error();}catch{reply(400,{error:'Expected notes text.'});return;}
        const write=notesWrites.then(()=>writeNotes(notes));
        notesWrites=write.catch(()=>{});
        write.then(()=>reply(200,{saved:true})).catch(()=>reply(500,{error:'Could not save '+notesName+'. Your text is still in the notepad.'}));
      });return;
    }
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
