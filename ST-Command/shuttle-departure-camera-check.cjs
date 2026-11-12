const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
 for(const model of ['movie','original']){
  await page.locator('#enterprise-model').selectOption(model);
  const result=await page.evaluate(async()=>{
   const a=STCommand,s=a.state,m=a.away.state;a.reset();s.throttle=0;s.speed=0;a.away.launchShuttle();s.paused=true;
   const start=m.cameraView,launchY=m.y,launchZ=m.z,opened=m.bayDoorOpen===1&&m.hangarDoorTarget===1&&m.launchStage==='lift'&&s.throttle===0;let premature=false,triggered=false;
   a.away.tick(.75);
   const lift=m.z>launchZ&&m.y===launchY&&s.speed===0;
   const scene=a.games[0].scene.getScene('Forward');a.away.render(scene,900,600);await scene.enterpriseRenderer.ready;a.away.render(scene,900,600);
   const renderer=scene.enterpriseRenderer,behind=renderer.excursionFraming.departureCamera&&renderer.landingTelemetry.camera[2]<m.y;
   const fixedPosition=renderer.excursionCamera.position.clone(),fixedRotation=renderer.excursionCamera.quaternion.clone(),fixedFov=renderer.excursionCamera.fov;
   a.away.tick(.75);const airborne=m.launchLiftRemaining===0&&m.z>launchZ+.024&&m.y===launchY;
   for(let i=0;i<100;i++)a.away.tick(.02);
   const hover=m.y===launchY&&s.speed===0&&s.throttle===0;
   const rearLimit=ShuttleBayFlight.dimensions().launchRearLimitY;s.throttle=-25;
   for(let i=0;i<200&&s.throttle<0;i++)a.away.tick(.02);
   const reverseStopped=Math.abs(m.y-rearLimit)<1e-10&&s.speed===0&&s.throttle===0;
   for(let i=0;i<20;i++)a.away.tick(.02);
   const reverseHolds=Math.abs(m.y-rearLimit)<1e-10&&s.speed===0;
   s.throttle=25;
   for(let i=0;i<300;i++){
    a.away.tick(.02);
    if(m.departureCameraFade!=null){triggered=Math.abs(m.y-ShuttleBayFlight.dimensions().cabinTransitionY)<.004;break;}
    if(m.cameraView!=='excursion')premature=true;
   }
   const fadeStart=m.cameraView;
   const fade=m.departureCameraFade,half=ShuttleBayFlight.departureFadeDuration/2;m.departureCameraFade=half-1e-8;
   a.away.render(scene,900,600);
   const aligned=renderer.excursionCamera.position.distanceTo(fixedPosition)<1e-10&&renderer.excursionCamera.quaternion.angleTo(fixedRotation)<1e-7&&renderer.excursionCamera.fov===fixedFov;
   m.cameraView='cockpit';m.departureCameraFade=half;a.away.render(scene,900,600);
   m.cameraView='excursion';m.departureCameraFade=fade;
   a.away.tick(.02);
   const midpoint=m.cameraView;
   const entry=ShuttleBayFlight.cockpitEntryPose(),referencePose=Math.abs(m.x-entry.x)<1e-8&&Math.abs(m.y-entry.y)<1e-8&&Math.abs(m.z-entry.z)<1e-8&&s.heading===180&&s.pitch===0;
   const elapsed=m.departureCameraFade,snapshot=scene.departureSnapshot;
   m.departureCameraFade=null;a.away.render(scene,900,600);
   const context=scene.awayTexture.getContext(),live=context.getImageData(450,360,1,1).data,outgoing=snapshot.getContext('2d').getImageData(450,360,1,1).data;
   scene.departureSnapshot=snapshot;m.departureCameraFade=ShuttleBayFlight.departureFadeDuration/2;a.away.render(scene,900,600);
   const blended=context.getImageData(450,360,1,1).data,crossfade=[0,1,2].every(k=>Math.abs(blended[k]-(live[k]+outgoing[k])/2)<3);
   m.departureCameraFade=elapsed;
   for(let i=0;i<23;i++)a.away.tick(.02);
   const finished=m.departureCameraFade===null&&m.cameraView==='cockpit';
   const unrestrictedAfterLaunch=m.y<rearLimit&&s.speed>0;
   const b=ShuttleBayFlight.dimensions();Object.assign(m,{x:0,y:b.mouth+.01,z:110.01});Object.assign(s,{heading:0,pitch:0,speed:.1,throttle:25});
   a.away.render(scene,900,600);
   let entranceTrigger=false;
   for(let i=0;i<10;i++){
    const before={x:m.x,y:m.y,z:m.z};a.away.tick(.02);
    if(m.entranceCameraFade!=null){const viewer=document.getElementById('main-view');entranceTrigger=ShuttleBayFlight.lipOutsideView(m.entranceCameraPose,viewer.clientWidth,viewer.clientHeight)&&Math.abs(m.y-before.y+.002)<1e-8;break;}
   }
   const returnView=m.cameraView;
   const entranceSnapshot=scene.entranceSnapshot;m.entranceCameraFade=null;a.away.render(scene,900,600);
   const returnLive=context.getImageData(450,360,1,1).data,returnOutgoing=entranceSnapshot.getContext('2d').getImageData(450,360,1,1).data;
   scene.entranceSnapshot=entranceSnapshot;m.entranceCameraFade=ShuttleBayFlight.departureFadeDuration/2;a.away.render(scene,900,600);
   const returnBlended=context.getImageData(450,360,1,1).data,returnCrossfade=[0,1,2].every(k=>Math.abs(returnBlended[k]-(returnLive[k]+returnOutgoing[k])/2)<3);
   for(let i=0;i<25;i++)a.away.tick(.02);
   const entranceFinished=m.entranceCameraFade===null&&m.cameraView==='excursion';
   a.reset();a.away.tick(.02);
   return {start,opened,lift,airborne,hover,reverseStopped,reverseHolds,unrestrictedAfterLaunch,behind,aligned,referencePose,crossfade,premature,triggered,fadeStart,midpoint,finished,returnView,entranceTrigger,returnCrossfade,entranceFinished,reset:!m.departureCameraPending&&m.departureCameraFade===null&&m.entranceCameraFade===null};
  });
  assert.equal(result.start,'excursion');assert(result.opened,'doors already open at launch');assert(result.lift,'lift before forward motion');assert(result.airborne);assert(result.hover,'hover until pilot thrust');assert(result.behind,'launch camera starts behind');assert(result.aligned,'launch camera holds its position, rotation and field of view through departure and fade');assert(!result.premature);assert(result.triggered,'fade starts at second side door from space');
  assert(result.reverseStopped&&result.reverseHolds,'launch reverse stops at the reference position');assert(result.unrestrictedAfterLaunch,'reverse limit only applies during launch');
  assert.equal(result.fadeStart,'excursion');assert.equal(result.midpoint,'cockpit');assert(result.referencePose,'cockpit starts at the supplied reference viewpoint');assert(result.crossfade,'transition blends the views without blacking out');assert(result.finished);assert.equal(result.returnView,'excursion');assert(result.reset);
  assert(result.entranceTrigger,'entrance transition follows lip visibility and preserves flight position');assert(result.returnCrossfade,'entrance uses the same smooth crossfade');assert(result.entranceFinished,'entrance fade completes in excursion view');
 }
 assert.deepEqual(errors,[]);console.log('Passed: both models open doors before lifting, hover until thrust, fade at the second side door, enter cockpit at the reference position, complete the quick fade, return approach and reset.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
