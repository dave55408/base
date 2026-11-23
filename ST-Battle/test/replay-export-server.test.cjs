const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {createReplayExportHandler}=require('../replay-export-server.cjs');
async function expectCleanup(root){
 const directory=path.join(root,'exports','.tmp');
 for(let attempt=0;attempt<100;attempt++){if(!(await fs.readdir(directory)).length)return;await new Promise(resolve=>setTimeout(resolve,10));}
 assert.deepEqual(await fs.readdir(directory),[]);
}
async function fixture(t,execute){
 const root=await fs.mkdtemp(path.join(__dirname,'export-test-'));const handler=createReplayExportHandler({root,ffmpegPath:'test-encoder',execute});
 const server=http.createServer(async(req,res)=>{if(!await handler(req,res)){res.writeHead(404);res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});});
 return {root,url:'http://127.0.0.1:'+server.address().port};
}
test('MP4 endpoint invokes H264/AAC conversion and returns the actual encoded file',async t=>{
 const calls=[],{root,url}=await fixture(t,async(command,args)=>{calls.push({command,args});assert.equal((await fs.readFile(args[args.indexOf('-i')+1])).toString(),'webm-data');await fs.writeFile(args.at(-1),'encoded-mp4');});
 const res=await fetch(url+'/api/replay/mp4',{method:'POST',headers:{'Content-Type':'video/webm'},body:'webm-data'});
 assert.equal(res.status,200);assert.equal(res.headers.get('content-type'),'video/mp4');assert.equal(await res.text(),'encoded-mp4');assert(calls[0].args.includes('libx264'));assert(calls[0].args.includes('aac'));
 // Response can arrive just before finally removes the temporary directory.
 await expectCleanup(root);
});
test('HD conversion preserves source frame rate and resolution with a higher-quality H264 encode',async t=>{
 let encoded;const {url}=await fixture(t,async(command,args)=>{encoded=args;await fs.writeFile(args.at(-1),'hd-mp4');});
 const response=await fetch(url+'/api/replay/mp4',{method:'POST',headers:{'Content-Type':'video/webm','X-Replay-Quality':'hd'},body:'hd-frames'});assert.equal(await response.text(),'hd-mp4');
 assert.equal(encoded[encoded.indexOf('-crf')+1],'16');assert.equal(encoded[encoded.indexOf('-preset')+1],'medium');assert.equal(encoded[encoded.indexOf('-b:a')+1],'320k');assert(!encoded.includes('-r'),'keeps the recorded frame timestamps');
});
test('export endpoints reject foreign origins, unsupported inputs, oversized and empty uploads',async t=>{
 const {url}=await fixture(t,()=>{throw Error('must not encode');});
 for(const [options,status] of [
  [{method:'GET'},405],
  [{method:'POST',headers:{Origin:'https://foreign.example','Content-Type':'video/webm'},body:'x'},403],
  [{method:'POST',headers:{'Content-Type':'text/plain'},body:'x'},415],
  [{method:'POST',headers:{'Content-Type':'video/webm'},body:''},400],
 ]){const response=await fetch(url+'/api/replay/mp4',options);assert.equal(response.status,status);await response.text();}
 const response=await fetch(url+'/api/replay/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(8193)});assert.equal(response.status,410);await response.text();
 const capabilities=await (await fetch(url+'/api/replay/capabilities')).json();assert.equal(capabilities.speech,false);
});
test('encoding failures report a useful error and remove temporary media',async t=>{
 const {root,url}=await fixture(t,async()=>{throw Error('encoder failed');});
 const response=await fetch(url+'/api/replay/mp4',{method:'POST',headers:{'Content-Type':'video/webm'},body:'input'});assert.equal(response.status,500);assert.match((await response.json()).error,/Replay export failed/);
 await expectCleanup(root);
});
