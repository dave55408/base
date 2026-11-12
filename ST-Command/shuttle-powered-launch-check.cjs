const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(game=>game.isBooted));
 for(const model of ['movie','original']){
  await page.locator('#enterprise-model').selectOption(model);
  const traces=[];
  for(const power of [0,14])traces.push(await page.evaluate(async power=>{
   const a=STCommand,m=a.away.state,s=a.state;a.reset();Object.assign(s,{throttle:power,speed:power/25});a.away.launchShuttle();s.paused=true;for(const game of a.games)game.loop.stop();
   const samples=[],anchor={...m.departureCameraAnchor},scene=a.games[0].scene.getScene('Forward');
   const sample=()=>samples.push([m.x,m.y,m.z,s.heading,s.pitch,m.bank,s.speed,s.throttle,m.launchLiftRemaining,m.cameraView,m.departureCameraFade,m.launchAttached]);sample();
   for(let i=0;i<75;i++)a.away.tick(.02);sample();
   const atHover={x:m.x,y:m.y,z:m.z};for(let i=0;i<100;i++)a.away.tick(.02);sample();
   const holds=Object.keys(atHover).every(axis=>m[axis]===atHover[axis])&&s.throttle===0&&s.speed===0;
   a.away.render(scene,640,400);await scene.enterpriseRenderer.ready;a.away.render(scene,640,400);const camera=scene.enterpriseRenderer.excursionCamera;
   const view=[...camera.position.toArray(),...camera.quaternion.toArray(),camera.fov];
   s.throttle=25;let detached=false;
   for(let i=0;i<1000;i++){a.away.tick(.02);sample();if(!m.launchAttached){detached=true;break;}}
   const continued=m.carrier.moving&&Math.hypot(m.carrier.x,m.carrier.y,m.carrier.z)>0;
   return {samples,anchor,holds,view,detached,continued,cleared:ShuttleBayFlight.clearedEntrance(m,s)};
  },power));
  assert.deepEqual(traces[0].samples,traces[1].samples,'stopped and powered launches use identical bay-relative motion and camera transitions');assert.deepEqual(traces[0].view,traces[1].view,'same fixed launch camera');assert.deepEqual(traces[0].anchor,traces[1].anchor);assert(traces.every(trace=>trace.holds&&trace.detached&&trace.cleared));assert(!traces[0].continued&&traces[1].continued,'Enterprise keeps moving while its launch sequence stays consistent');
 }
 assert.deepEqual(errors,[]);console.log('Passed: both models have identical stopped/powered liftoff, fixed camera, zero-thrust hover, departure and cockpit crossfade; Enterprise continues moving and the shuttle detaches only after full door clearance.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(error=>{console.error(error);process.exitCode=1;});
