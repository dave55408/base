const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(native=false){
 const tracks=[],fetches=[],created=[],track=()=>{const t={stopped:false,stop(){this.stopped=true;},clone(){return track();}};tracks.push(t);return t;};
 class Stream{constructor(ts=[track()]){this.ts=ts;}getTracks(){return this.ts;}getAudioTracks(){return this.ts;}addTrack(t){this.ts.push(t);}}
 const node=()=>({connections:new Set(),connect(target){this.connections.add(target);return target;},disconnect(target){if(target)this.connections.delete(target);else this.connections.clear();}});
 class Context{constructor(){this.destination={};}async resume(){}createMediaStreamDestination(){return {...node(),stream:new Stream()};}createMediaElementSource(audio){return {...node(),audio};}createMediaStreamSource(){return node();}createConstantSource(){return {...node(),offset:{value:1},start(){this.started=true;},stop(){this.stopped=true;}};}}
 class Recorder{static isTypeSupported(type){return native?type==='video/mp4':type==='video/webm;codecs=vp8,opus';}constructor(stream,options){this.options=options;this.mimeType=options.mimeType;this.state='inactive';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable({data:new Blob(['frames'],{type:this.mimeType})});this.onstop();}}
 const document={createElement(type){const element=type==='canvas'?{getContext:()=>({drawImage(){}}),captureStream(fps){this.fps=fps;return new Stream();}}:{};created.push(element);return element;}};
 const window={AudioContext:Context,MediaRecorder:Recorder,HTMLCanvasElement:{prototype:{captureStream(){}}},location:{protocol:'http:'}};
 const c={window,document,Blob,AbortController,setTimeout,clearTimeout,URL:{createObjectURL:()=> 'blob:speech',revokeObjectURL(){}},fetch:async(url,options)=>{fetches.push({url,options});return {ok:true,json:async()=>({mp4:true,speech:true}),blob:async()=>new Blob(['mp4'],{type:url.endsWith('speech')?'audio/mpeg':'video/mp4'})};}};
 vm.runInNewContext(fs.readFileSync('replay-export.js','utf8'),c);return {window,document,tracks,fetches,created,node,Exporter:window.BattleReplayExporter};
}
test('replay export captures bounded even-sized video and audio and converts WebM to real MP4',async()=>{
 const f=fixture(),e=new f.Exporter();await e.prepare({events:[]});const done=e.start({width:3841,height:2161});assert.equal(f.created[0].width%2,0);assert(f.created[0].width<=1920);assert(f.created[0].height<=1080);assert.equal(e.stream.getTracks().length,2);
 e.stop();const video=await done;assert.match(video.type,/webm/);const output=await e.mp4(video);assert.equal(output.type,'video/mp4');assert(f.fetches.some(call=>call.url.endsWith('/mp4')&&call.options.body===video));
 e.dispose();assert(e.stream.getTracks().every(t=>t.stopped));assert(!f.window.BattleReplayCapture.mix.stream.getTracks()[0].stopped,'shared audio destination survives repeated exports');
});
test('HD export preserves 4K, requests 60 fps and uses the high-quality encoder settings',async()=>{
 const f=fixture(),e=new f.Exporter({hd:true});await e.prepare({events:[]});const canvas=f.document.createElement('canvas');canvas.width=3840;canvas.height=2160;const done=e.start(canvas);
 assert.equal(e.canvas,canvas,'records the GPU canvas directly');assert.equal(e.paint,undefined,'avoids a 4K CPU copy for each frame');
 assert.equal(e.canvas.width,3840);assert.equal(e.canvas.height,2160);assert.equal(e.canvas.fps,60);assert.equal(e.recorder.options.videoBitsPerSecond,50000000);assert.equal(e.recorder.options.audioBitsPerSecond,320000);
 e.stop();await e.mp4(await done);assert.equal(f.fetches.find(c=>c.url.endsWith('/mp4')).options.headers['X-Replay-Quality'],'hd');e.dispose();
});
test('native MP4 passes through and missing synthesized lines are cached by speaker',async()=>{
 const f=fixture(true),e=new f.Exporter(),event={type:'bridge-dialogue',speaker:'allison',reply:"They're back in range."};
 await e.prepare({events:[{event},{event}]});assert.equal(f.fetches.filter(call=>call.url.endsWith('/speech')).length,1);assert.equal(e.clipFor(event),'blob:speech');
 const blob=new Blob(['native'],{type:'video/mp4'});assert.equal(await e.mp4(blob),blob);assert(!f.fetches.some(call=>call.url.endsWith('/mp4')));e.dispose();
});
test('cancelling a recording releases its tracks and prevents conversion',async()=>{
 const f=fixture(),e=new f.Exporter();await e.prepare({events:[]});const finished=e.start({width:640,height:360});e.cancel();await finished;await assert.rejects(e.mp4(new Blob()),/cancelled/);e.dispose();assert(e.stream.getTracks().every(t=>t.stopped));
});

test('effects and voice recordings reach the audio track on consecutive exports',async()=>{
 const f=fixture(),capture=f.window.BattleReplayCapture,context=capture.getContext();
 const voice={paused:false,loop:false},music={paused:false,loop:true};capture.trackMedia(music);
 let previousSource;
 for(let pass=0;pass<2;pass++){
  const e=new f.Exporter();await e.prepare({events:[]});const done=e.start({width:640,height:360});
  assert.equal(capture.context,context,'recording uses the same context as game effects');
  const silence=capture.silence;assert(silence.started);assert.equal(silence.offset.value,0);assert(silence.connections.has(capture.mix));
  capture.trackMedia(voice);const source=capture.sources.get(voice);
  assert(source.connections.has(capture.mix),'voice joins the recording after it has started');
  assert(source.connections.has(context.destination),'voice remains audible in the game');
  if(previousSource)assert.equal(source,previousSource,'a media element source is reused on the second recording');
  previousSource=source;
  const effect=f.node();effect.connect(context.destination);capture.trackNode(effect,context);
  assert(effect.connections.has(capture.mix),'weapon effect feeds the recording directly');
  assert.equal(capture.buses.size,0,'no cross-context stream is needed for game effects');
  assert(capture.sources.get(music).connections.has(capture.mix));
  e.stop();await done;e.dispose();
  assert(silence.stopped);assert.equal(silence.connections.size,0);
  assert(!source.connections.has(capture.mix));assert(source.connections.has(context.destination));
  assert(!effect.connections.has(capture.mix));assert(effect.connections.has(context.destination));
 }
});

test('MP4 recording prefers explicit H.264 and AAC over unspecified codecs',async()=>{
 const f=fixture(true);f.window.MediaRecorder.isTypeSupported=type=>type.startsWith('video/mp4');
 const e=new f.Exporter();await e.prepare({events:[]});assert.equal(e.mime,'video/mp4;codecs=avc1.42001E,mp4a.40.2');e.dispose();
});
