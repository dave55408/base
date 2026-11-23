/* Run explicitly: node test/replay-hd-smoke.cjs (requires local Chrome/Playwright). */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[path.resolve(__dirname,'../../elf-adventure')]}));
const server=require('../server.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL/i.test(m.text()))errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!window.battleScene);
  await page.click('#quick-battle');
  const before=await page.evaluate(()=>{
   const s=window.battle;s.running=true;for(let i=0;i<35;i++)s.tick(.05);s.finishPass();s.running=false;
   // Keep the browser recording short while still replaying recorded movement and audio.
   const r=s.lastReplay;r.duration=Math.min(r.duration,1.5);r.frames=r.frames.filter(f=>f.at<=r.duration);r.events=r.events.filter(e=>e.at<=r.duration);
   r.events.push({at:.2,event:{type:'beam',from:'Enterprise',to:'Yorktown',duration:.7}},{at:.4,event:{type:'bridge-dialogue',order:'Come to port.',speaker:'captain'}});r.events.sort((a,b)=>a.at-b.at);
   window.__liveBefore=JSON.stringify([s.player,s.enemy,s.time,s.seed]);
   window.__effects=0;window.__voiceCaptured=false;
   const capture=BattleReplayCapture,trackNode=capture.trackNode.bind(capture),trackMedia=capture.trackMedia.bind(capture);
   capture.trackNode=(...args)=>{if(capture.active)window.__effects++;return trackNode(...args);};
   capture.trackMedia=audio=>{trackMedia(audio);if(capture.active&&/Declan|voices/.test(audio.src)&&capture.sources.get(audio))window.__voiceCaptured=true;};
   BattleReplayExporter.prototype.download=async function(blob,turn,options){window.__hdBlob=blob;window.__hdDownload={type:blob.type,size:blob.size,turn,options};};
   const start=BattleReplayExporter.prototype.start;BattleReplayExporter.prototype.start=function(canvas){const done=start.call(this,canvas);window.__quality={fps:this.frameRate,captureFPS:this.stream.getVideoTracks()[0].getSettings().frameRate,bitrate:this.recorder.videoBitsPerSecond};return done;};
   return r.frames.length;
  });
  assert(before>1);
  await page.click('#replay-last-pass');
  await page.click('#replay-record-hd');await page.waitForFunction(()=>window.battleReplay.hd&&!window.battleReplay.hdRequest);
  assert.equal(await page.evaluate(()=>!!window.__hdDownload||!!window.battleReplay.exporter),false,'HD playback does not record or download');
  const hd=await page.evaluate(()=>{
   const view=window.battleReplay,scene=view.scene;let vertices=0,meshes=0;
   scene.ships.Enterprise.traverse(o=>{if(o.isMesh){meshes++;vertices+=o.geometry.attributes.position.count;}});
   window.__hdCanvas=[scene.renderer.domElement.width,scene.renderer.domElement.height];
   const materials=[].concat(scene.ships.Yorktown.userData.saucer.material),hull=materials.find(m=>m.userData.hdGunmetalHull);
   return {vertices,meshes,size:window.__hdCanvas,hd:scene.ships.Enterprise.userData.hd,nacelles:!!scene.ships.Yorktown.userData.nacelles.port,gunmetal:hull?.color.getHex(),metalness:hull?.metalness,roughness:hull?.roughness,anisotropy:hull?.map?.anisotropy,maxAnisotropy:scene.renderer.capabilities.getMaxAnisotropy(),textureWidth:hull?.map?.image.width,glError:scene.renderer.getContext().getError()};
  });
  assert(hd.hd&&hd.nacelles);assert(hd.vertices>100000);assert.deepEqual(hd.size,[3840,2160]);assert.equal(hd.glError,0);assert.equal(hd.anisotropy,hd.maxAnisotropy);assert(hd.textureWidth>=2048);
  assert.equal(hd.gunmetal,0x3b4249);assert.equal(hd.metalness,.72);assert.equal(hd.roughness,.38);
  await page.screenshot({path:path.resolve(__dirname,'../exports/replay-hd-preview.png')});
  const portrait=await page.evaluate(()=>{
   const scene=battleReplay.scene,T=scene.T,target=scene.ships.Yorktown.position.clone().add(new T.Vector3(0,16,-25)),camera=new T.PerspectiveCamera(40,16/9,.5,65000);
   camera.position.copy(target).add(new T.Vector3(120,100,-150));camera.lookAt(target);scene.renderer.render(scene.scene,camera);return scene.renderer.domElement.toDataURL().split(',')[1];
  });fs.writeFileSync(path.resolve(__dirname,'../exports/replay-hd-yorktown.png'),Buffer.from(portrait,'base64'));
  await page.click('#replay-download');
  await page.waitForFunction(()=>!!window.__hdDownload,null,{timeout:180000});
  await page.waitForFunction(()=>!window.battleReplay.exporter);
  const result=await page.evaluate(()=>({download:window.__hdDownload,retainedHD:window.battleReplay.scene.ships.Enterprise.userData.hd,unchanged:window.__liveBefore===JSON.stringify([battle.player,battle.enemy,battle.time,battle.seed]),effects:window.__effects,voiceCaptured:window.__voiceCaptured}));
  console.log(JSON.stringify(result));assert(result.download.size>1000);assert.match(result.download.type,/mp4/);assert(result.download.options.hd);assert(result.retainedHD&&result.unchanged);assert(result.effects>0&&result.voiceCaptured,'effects and captain voice join the recording');
  const video=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__hdBlob.arrayBuffer())));fs.writeFileSync(path.resolve(__dirname,'../exports/replay-hd-smoke.mp4'),Buffer.from(video));
  const media=await page.evaluate(async()=>{
   const audio=await BattleReplayCapture.context.decodeAudioData(await window.__hdBlob.arrayBuffer());let peak=0;for(const value of audio.getChannelData(0))peak=Math.max(peak,Math.abs(value));
   const video=document.createElement('video');video.src=URL.createObjectURL(window.__hdBlob);await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=reject;});
   const result={width:video.videoWidth,height:video.videoHeight,duration:video.duration,audioPeak:peak};URL.revokeObjectURL(video.src);return result;
  });
  assert.deepEqual([media.width,media.height],[3840,2160]);assert(media.audioPeak>.001);console.log(JSON.stringify({media}));
  const quality=await page.evaluate(()=>window.__quality);assert.equal(quality.fps,60);assert.equal(quality.captureFPS,60);assert(quality.bitrate>=50000000);console.log(JSON.stringify({quality}));
  await page.click('#replay-close');await page.click('#replay-last-pass');assert.equal(await page.evaluate(()=>!!battleReplay.hd||!!battleReplay.scene.ships.Enterprise.userData.hd),false,'reopening the replay restores the standard model');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({hd,result,errors}));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
