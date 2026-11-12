const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:2048,height:1152}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(game=>game.isBooted));
 for(const model of ['movie','original']){
  await page.locator('#enterprise-model').selectOption(model);
  const result=await page.evaluate(async()=>{
   const a=STCommand,m=a.away.state,s=a.state,T=AlpineThree;a.reset();s.throttle=0;s.speed=0;a.away.launchShuttle();s.paused=true;for(const game of a.games)game.loop.stop();
   const b=ShuttleBayFlight.dimensions(),viewer=document.getElementById('main-view'),w=viewer.clientWidth,h=viewer.clientHeight;
   Object.assign(m,{cameraView:'cockpit',x:.005,z:b.floor+.0253,roll:.3,bank:.3,turnBank:0,pitchBob:0,lastVisualPitch:2,lookYaw:1.5,lookPitch:-1,cameraZoom:1.35,launchLiftRemaining:0,launchStage:null,departureRamp:false,departureCameraPending:false,departureCameraFade:null});
   Object.assign(s,{heading:-3,pitch:2,throttle:25,speed:.1,autopilot:false});Object.assign(m.carrier,{moving:false,manual:false,speed:0});
   function threshold(zoom){for(let i=500;i>=1;i--){const view={...ShuttleBayFlight.cockpitView(m,s),y:b.mouth+i*.001,zoom};if(ShuttleBayFlight.lipOutsideView(view,w,h))return i*.001;}return 0;}
   const wide=threshold(.5),narrow=threshold(2),distance=threshold(m.cameraZoom);m.y=b.mouth+distance+.006;
   const reference=ShuttleBayFlight.cockpitView(m,s),offAxis=!ShuttleBayFlight.lipOutsideView({...reference,x:.12},w,h),backward=!ShuttleBayFlight.lipOutsideView({...reference,heading:180},w,h);
   let respectsLip=true,noTeleport=true,triggered=false;
   for(let i=0;i<20;i++){
    const y=m.y,dy=-Math.cos(s.heading*Math.PI/180)*Math.cos(s.pitch*Math.PI/180)*s.speed*.02;a.away.tick(.02);const gone=ShuttleBayFlight.lipOutsideView(ShuttleBayFlight.cockpitView(m,s),w,h);
    if(Math.abs(m.y-y-dy)>1e-8)noTeleport=false;
    if(m.cameraView==='excursion'){triggered=gone;break;}
    if(gone)respectsLip=false;
   }
   const entry=m.entranceCameraPose,lookPreserved=m.lookYaw===1.5&&m.lookPitch===-1&&m.cameraZoom===1.35;
   const scene=a.games[0].scene.getScene('Forward');a.away.render(scene,900,600);await scene.enterpriseRenderer.ready;a.away.render(scene,900,600);const renderer=scene.enterpriseRenderer;
   function attitude(heading,pitch,bank){const q=new T.PerspectiveCamera(),ha=heading*Math.PI/180,pa=pitch*Math.PI/180;q.lookAt(Math.sin(ha)*Math.cos(pa),Math.sin(pa),-Math.cos(ha)*Math.cos(pa));q.rotateZ(-bank);return q.quaternion;}
   const cameraAligned=renderer.excursionCamera.quaternion.angleTo(attitude(entry.heading,entry.pitch,entry.bank))<1e-7;
   const craft=renderer.excursionShuttle,expected=attitude(s.heading,s.pitch,m.bank),up=new T.Vector3(0,1,0).applyQuaternion(craft.quaternion),nose=new T.Vector3(0,0,1).applyQuaternion(craft.quaternion);
   const craftAligned=up.distanceTo(new T.Vector3(0,1,0).applyQuaternion(expected))<1e-7&&nose.distanceTo(new T.Vector3(0,0,-1).applyQuaternion(expected))<1e-7;
   for(let i=0;i<25;i++)a.away.tick(.02);
   return {wide,narrow,distance,offAxis,backward,respectsLip,noTeleport,triggered,lookPreserved,cameraAligned,craftAligned,finished:m.cameraView==='excursion'&&m.entranceCameraFade===null};
  });
  assert(result.narrow>result.wide&&result.wide>0,'lip trigger follows zoom');assert(result.offAxis&&result.backward);assert(result.respectsLip&&result.triggered&&result.noTeleport,'switches when lip leaves the viewport without moving the shuttle: '+JSON.stringify(result));assert(result.lookPreserved&&result.cameraAligned,'external view inherits cockpit heading, pitch, roll and zoom');assert(result.craftAligned,'external shuttle attitude matches cockpit');assert(result.finished);
 }
 assert.deepEqual(errors,[]);console.log('Passed: both models use viewport and zoom for bay-lip visibility, reject off-axis/backward views, preserve flight position and cockpit attitude, render matching craft attitude and finish the crossfade.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(error=>{console.error(error);process.exitCode=1;});
