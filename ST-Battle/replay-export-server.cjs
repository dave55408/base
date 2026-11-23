const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {spawn,spawnSync}=require('node:child_process');

function findFfmpeg(){
  if(process.env.FFMPEG_PATH)return process.env.FFMPEG_PATH;
  if(spawnSync('ffmpeg',['-version'],{windowsHide:true,stdio:'ignore'}).status===0)return 'ffmpeg';
  if(process.platform==='win32'){
    const root=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'Microsoft','WinGet','Packages');
    try{for(const name of require('node:fs').readdirSync(root).filter(name=>name.startsWith('Gyan.FFmpeg_'))){
      const folder=path.join(root,name);
      for(const version of require('node:fs').readdirSync(folder)){
        const file=path.join(folder,version,'bin','ffmpeg.exe');if(require('node:fs').existsSync(file))return file;
      }
    }}catch{}
  }
  return null;
}
function run(command,args,{signal,timeout=120000}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{windowsHide:true,stdio:['ignore','ignore','pipe'],signal});let errors='';
    const timer=setTimeout(()=>child.kill(),timeout);
    child.stderr.on('data',chunk=>{if(errors.length<4000)errors+=chunk;});
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(errors||'Media conversion failed'));});
  });
}
async function receive(req,file,limit){
  if(Number(req.headers['content-length'])>limit){const error=new Error('Replay exceeds the export size limit.');error.status=413;throw error;}
  const handle=await fs.open(file,'wx');let size=0;
  try{for await(const chunk of req){size+=chunk.length;if(size>limit){const error=new Error('Replay exceeds the export size limit.');error.status=413;throw error;}await handle.write(chunk);}}
  finally{await handle.close();}
  if(!size){const error=new Error('No replay data received.');error.status=400;throw error;}
}
function createReplayExportHandler({root=__dirname,ffmpegPath,execute=run}={}){
  let ffmpeg;
  const encoder=()=>ffmpeg??=(ffmpegPath||findFfmpeg()||false);
  return async(req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(!['/api/replay/capabilities','/api/replay/mp4','/api/replay/speech'].includes(pathname))return false;
    const json=(status,value)=>{if(!res.destroyed){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}};
    if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host){json(403,{error:'Replay export requires the local game page.'});return true;}}catch{json(403,{error:'Invalid origin.'});return true;}}
    if(pathname==='/api/replay/capabilities'&&req.method==='GET'){json(200,{mp4:!!encoder(),speech:process.platform==='win32'&&!!encoder()});return true;}
    if(req.method!=='POST'){json(405,{error:'Method not allowed.'});return true;}
    if(!encoder()){json(503,{error:'MP4 conversion needs FFmpeg on this computer. Set FFMPEG_PATH or install FFmpeg.'});return true;}
    const speech=pathname.endsWith('/speech'),hd=req.headers['x-replay-quality']==='hd',type=(req.headers['content-type']||'').split(';')[0];
    if(type!==(speech?'application/json':'video/webm')){json(415,{error:'Unsupported replay media type.'});return true;}
    if(speech&&process.platform!=='win32'){json(503,{error:'Local synthesized replay dialogue requires Windows speech.'});return true;}
    let directory;const controller=new AbortController();
    const abort=()=>{if(!res.writableEnded)controller.abort();};res.on('close',abort);
    try{
      const tempRoot=path.join(root,'exports','.tmp');await fs.mkdir(tempRoot,{recursive:true});directory=await fs.mkdtemp(path.join(tempRoot,'replay-'));
      const input=path.join(directory,speech?'speech.json':'input.webm'),output=path.join(directory,speech?'voice.mp3':'replay.mp4');
      await receive(req,input,speech?8192:(hd?512:256)*1024*1024);
      if(speech){
        let data;try{data=JSON.parse(await fs.readFile(input,'utf8'));}catch{const error=new Error('Invalid speech request.');error.status=400;throw error;}
        if(typeof data.text!=='string'||!data.text.trim()||data.text.length>300||!['captain','helm','allison'].includes(data.speaker)){const error=new Error('Invalid replay dialogue.');error.status=400;throw error;}
        const wave=path.join(directory,'voice.wav');
        await execute('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(__dirname,'replay-speech.ps1'),'-InputFile',input,'-OutputFile',wave],{signal:controller.signal,timeout:20000});
        await execute(encoder(),['-hide_banner','-loglevel','error','-i',wave,'-af','loudnorm=I=-18:TP=-2:LRA=7','-c:a','libmp3lame','-q:a','2',output],{signal:controller.signal});
      }else{
        await execute(encoder(),['-hide_banner','-loglevel','error','-i',input,'-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2','-c:v','libx264','-preset',hd?'medium':'veryfast','-crf',hd?'16':'20','-pix_fmt','yuv420p','-c:a','aac','-b:a',hd?'320k':'160k','-movflags','+faststart',output],{signal:controller.signal});
      }
      const data=await fs.readFile(output);res.writeHead(200,{'Content-Type':speech?'audio/mpeg':'video/mp4','Content-Length':data.length,'Cache-Control':'no-store',...(!speech?{'Content-Disposition':'attachment; filename="ST-Battle-Replay.mp4"'}:{})});res.end(data);
    }catch(error){if(!controller.signal.aborted)json(error.status||500,{error:error.status?error.message:'Replay export failed. Check that FFmpeg and local speech are available.'});}
    finally{res.off('close',abort);if(directory)await fs.rm(directory,{recursive:true,force:true});}
    return true;
  };
}
module.exports={createReplayExportHandler,findFfmpeg};
