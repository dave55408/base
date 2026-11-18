const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
 await page.locator('#welcome-close').click();
 const button=page.locator('#find-enterprise');assert(await button.isHidden());
 await page.evaluate(()=>{STCommand.state.throttle=0;STCommand.away.launchShuttle();STCommand.state.paused=true;for(const g of STCommand.games)g.loop.stop();});
 for(const [x,y,z]of [[2,3,111],[-3,-2,109],[0,-4,110]]){
  await page.evaluate(([x,y,z])=>{const a=STCommand;Object.assign(a.away.state,{x,y,z,phase:'flight',cameraView:'excursion',lookYaw:70,lookPitch:-15,cameraZoom:3,departureCameraPending:true,departureCameraFade:.1,entranceCameraFade:.2,entranceCameraPose:{},roll:.3,bank:.5,turnBank:.2,pitchBob:.02});Object.assign(a.state,{heading:42,pitch:30,throttle:23,speed:.04,autopilot:true});a.away.updateUI();},[x,y,z]);
  assert(await button.isVisible());await button.click();
  const r=await page.evaluate(()=>{const a=STCommand,m=a.away.state,s=a.state,d=SpaceMath.direction(s.heading,s.pitch),v={x:-m.x,y:-m.y,z:110-m.z},length=Math.hypot(v.x,v.y,v.z);return {dot:(d.x*v.x+d.y*v.y+d.z*v.z)/length,camera:m.cameraView,look:[m.lookYaw,m.lookPitch,m.cameraZoom],power:s.throttle,speed:s.speed,autopilot:s.autopilot,fade:[m.departureCameraPending,m.departureCameraFade,m.entranceCameraFade,m.entranceCameraPose]};});
  assert(r.dot>1-1e-10);assert.equal(r.camera,'cockpit');assert.deepEqual(r.look,[0,0,1]);assert.equal(r.power,23);assert.equal(r.speed,.04);assert(!r.autopilot);assert.deepEqual(r.fade,[false,null,null,null]);
 }
 await page.setViewportSize({width:600,height:900});await button.scrollIntoViewIfNeeded();const b=await button.boundingBox();assert(b.width>50&&b.x>=0&&b.x+b.width<=600);
 await page.evaluate(()=>{STCommand.away.state.phase='landed';STCommand.away.state.landing={heading:180,pitch:0,bank:0};STCommand.away.updateUI();});assert(await button.isHidden());
 await page.evaluate(()=>STCommand.reset());assert(await button.isHidden());assert.deepEqual(errors,[]);
 console.log('Passed: Find Enterprise points the shuttle at the ship, restores forward view, clears camera fades, preserves power/speed, and fits desktop/mobile controls.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
