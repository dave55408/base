const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(game=>game.isBooted));
 for(const model of ['movie','original']){
  await page.locator('#enterprise-model').selectOption(model);
  const landing=await page.evaluate(async()=>{
   const a=STCommand,m=a.away.state,s=a.state;a.reset();s.throttle=0;s.speed=0;a.away.launchShuttle();s.paused=true;for(const game of a.games)game.loop.stop();
   const b=ShuttleBayFlight.dimensions(),scene=a.games[0].scene.getScene('Forward');
   window.choiceStep=seconds=>{const n=Math.ceil(seconds/.02);for(let i=0;i<n;i++)a.away.tick(seconds/n);a.away.updateUI();};
   window.choiceFrame=async()=>{a.away.render(scene,900,600);await scene.enterpriseRenderer.ready;a.away.render(scene,900,600);return scene.enterpriseRenderer;};
   window.choiceDock=()=>{Object.assign(m,{phase:'flight',x:.025,y:-.17,z:b.floor+.025,bank:0,roll:0,turnBank:0,pitchBob:0,launchLiftRemaining:0,launchStage:null,launchAttached:false,departureCameraPending:false,departureCameraFade:null,entranceCameraFade:null,landingChoicePending:false,landingCameraFade:null});Object.assign(s,{heading:0,pitch:0,throttle:0,speed:0});a.away.dock();s.paused=true;};
   choiceDock();await choiceFrame();choiceStep(5.2);await choiceFrame();choiceStep(.12);
   const fades=m.phase==='landed'&&m.landingCameraFade!=null&&!document.getElementById('shuttle-choice').open;
   const snapshot=scene.landingSnapshot,elapsed=m.landingCameraFade;m.landingCameraFade=null;const renderer=await choiceFrame();
   const context=scene.awayTexture.getContext(),live=context.getImageData(450,360,1,1).data,outgoing=snapshot.getContext('2d').getImageData(450,360,1,1).data;
   scene.landingSnapshot=snapshot;m.landingCameraFade=ShuttleBayFlight.departureFadeDuration/2;await choiceFrame();
   const blended=context.getImageData(450,360,1,1).data,crossfade=[0,1,2].every(k=>Math.abs(blended[k]-(live[k]+outgoing[k])/2)<3);
   m.landingCameraFade=elapsed;choiceStep(.46);await choiceFrame();
   window.choiceCamera=renderer.excursionCamera.position.toArray();
   return {fades,crossfade,phase:m.phase,heading:s.heading,onDeck:Math.abs(m.z-b.floor)<1e-8,launchView:Math.abs(renderer.excursionCamera.position.z-(m.y-.12))<1e-8,dialog:document.getElementById('shuttle-choice').open};
  });
  assert(landing.fades&&landing.crossfade&&landing.onDeck&&landing.launchView&&landing.dialog);assert.equal(landing.phase,'landed');assert.equal(landing.heading,180);
  await page.keyboard.press('w');assert.equal(await page.evaluate(()=>{choiceStep(.1);return STCommand.away.state.phase;}),'landed');
  await page.locator('#shuttle-choice-launch').click();
  const launched=await page.evaluate(async()=>{const m=STCommand.away.state,s=STCommand.state;await choiceFrame();const renderer=STCommand.games[0].scene.getScene('Forward').enterpriseRenderer,fixed=JSON.stringify(choiceCamera)===JSON.stringify(renderer.excursionCamera.position.toArray()),floor=m.z;choiceStep(.75);const lifts=m.z>floor&&s.speed===0;choiceStep(.8);return {fixed,lifts,hover:m.phase==='flight'&&m.launchLiftRemaining===0&&s.speed===0&&s.throttle===0,dialog:document.getElementById('shuttle-choice').open};});
  assert(launched.fixed&&launched.lifts&&launched.hover&&!launched.dialog);
  await page.evaluate(async()=>{choiceDock();await choiceFrame();choiceStep(5.9);});
  assert(await page.locator('#shuttle-choice').evaluate(dialog=>dialog.open));await page.locator('#shuttle-choice-power-down').click();
  const shutdown=await page.evaluate(async()=>{const a=STCommand,m=a.away.state,phase=m.phase;choiceStep(2.99);await choiceFrame();const c=a.games[0].scene.getScene('Forward').awayTexture.getContext(),pixel=c.getImageData(450,360,1,1).data,black=[0,1,2].every(k=>pixel[k]<=3);choiceStep(.2);return {phase,black,bridge:m.phase==='bridge',modal:document.getElementById('shuttle-choice').open,shuttleMode:document.body.classList.contains('shuttle-mode')};});
  assert.equal(shutdown.phase,'powerdown');assert(shutdown.black&&shutdown.bridge&&!shutdown.modal&&!shutdown.shuttleMode);
 }
 assert.deepEqual(errors,[]);console.log('Passed: both models finish turnaround, crossfade to fixed launch view, show choices, block flight keys, relaunch into hover with fixed camera, and fade to black before returning to bridge.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(error=>{console.error(error);process.exitCode=1;});
