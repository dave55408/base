const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1800,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
 await page.locator('#stop').click();await page.locator('#launch-shuttle').click();
 const result=await page.evaluate(async(excursion)=>{
  const app=STCommand,m=app.away.state,s=app.state,scene=app.games[0].scene.getScene('Forward');s.paused=true;
  Object.assign(m,{x:.025,y:.35,z:110.01,bank:0,cameraView:excursion?'excursion':'cockpit'});Object.assign(s,{heading:0,pitch:0,speed:0,throttle:0});app.away.dock();
  const takeover=!s.autopilot&&s.throttle===0&&s.speed===0&&!s.paused;s.paused=true;
  app.away.render(scene,900,450);const ship=scene.enterpriseRenderer;await ship.ready;
  const sheet=document.createElement('canvas');sheet.width=1800;sheet.height=2250;const c=sheet.getContext('2d'),frames=[];let elapsedTime=0;
  for(const [i,time] of [0,.8,1.6,2.6,3.6,4.05,4.65,5.3].entries()){
   const elapsed=time-elapsedTime;for(let j=0;j<Math.ceil(elapsed/.05);j++)app.away.tick(elapsed/Math.ceil(elapsed/.05));elapsedTime=time;
   app.away.render(scene,900,450);const craft=ship.excursionShuttle,cam=ship.excursionCamera,T=AlpineThree;craft.updateWorldMatrix(true,true);
   const points=[[-1.602,0,-3.66],[1.602,1.888,3.4]].map(p=>craft.localToWorld(new T.Vector3(...p)).project(cam).toArray());
   frames.push({time,phase:m.phase,heading:s.heading,...ship.landingTelemetry,visible:craft.visible,points});c.fillStyle='#01050e';c.fillRect(i%2*900,Math.floor(i/2)*450,900,450);c.drawImage(scene.awayTexture.getCanvas(),i%2*900,Math.floor(i/2)*450);c.fillStyle='#ffffff';c.font='16px Arial';c.fillText(time.toFixed(1)+' s',i%2*900+12,Math.floor(i/2)*450+70);
  }
  app.away.updateUI();const ready=m.phase==='landed'&&!document.getElementById('power-down').hidden;
  app.away.powerDown();app.away.tick(1);app.away.render(scene,900,450);c.drawImage(scene.awayTexture.getCanvas(),0,1800);const shutdownPhase=m.phase;
  app.away.tick(2.1);return {takeover,frames,ready,shutdownPhase,finalPhase:m.phase,glError:ship.renderer.getContext().getError(),image:sheet.toDataURL('image/png')};
 },process.argv.includes('--excursion'));
 assert(result.takeover,'landing takes over stopped controls and unpauses');assert(result.frames.slice(0,6).every(f=>f.visible),'Class F remains visible while turning in flight and touching down');
 assert(result.frames[0].position[2]>.3&&Math.abs(result.frames[5].position[2]+.17225)<1e-6,'shuttle backs into the free berth');assert(result.frames[4].position[1]>result.frames[5].position[1]+.003,'shuttle settles vertically onto the deck');
 assert(Math.abs(result.frames[5].position[1]+.0153)<1e-6&&result.frames[5].touchdown,'touchdown rests on the deck');assert(result.frames[2].heading>80&&result.frames[2].heading<105&&result.frames[2].position[1]>.005,'shuttle turns through ninety degrees while airborne');assert.equal(result.frames[3].heading,180,'nose faces out before descent');assert.equal(result.frames[7].heading,180);assert(!result.frames[7].visible,'cockpit POV hides the exterior craft');assert(result.ready,'controls return after facing outward, touchdown and cockpit fade');assert.equal(result.shutdownPhase,'powerdown');assert.equal(result.finalPhase,'bridge');assert.equal(result.glError,0);assert.deepEqual(errors,[]);
 if(process.argv.includes('--excursion'))assert(result.frames[2].heading>result.frames[1].heading+40&&result.frames[2].position[2]<result.frames[1].position[2]-.04,'excursion landing turns while continuing toward the bay');
 fs.writeFileSync(process.argv.includes('--excursion')?'preview-excursion-landing.png':'preview-automatic-landing.png',Buffer.from(result.image.split(',')[1],'base64'));console.log('Passed: automatic Class F entry, airborne reversal during excursion approach, deck settling, cockpit fade, shutdown and bridge return.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
