const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));await page.locator('#stop').click();await page.locator('#launch-shuttle').click();
 const result=await page.evaluate(async()=>{
  const a=STCommand,m=a.away.state,s=a.state,scene=a.games[0].scene.getScene('Forward');s.paused=true;
  Object.assign(m,{x:0,y:-.080,z:110.005,cameraView:'cockpit',cockpitFromBerth:false});Object.assign(s,{heading:0,pitch:0,speed:0,throttle:0});a.away.render(scene,900,450);const ship=scene.enterpriseRenderer;await ship.ready;a.away.render(scene,900,450);const before=ship.camera.position.toArray();a.away.dock();s.paused=true;
  const sheet=document.createElement('canvas');sheet.width=1800;sheet.height=1350;const c=sheet.getContext('2d'),frames=[];let elapsed=0;
  for(const [i,time] of [0,2,4.05,4.35,4.85,5.3].entries()){
   const dt=time-elapsed;for(let j=0;j<Math.ceil(dt/.05);j++)a.away.tick(dt/Math.ceil(dt/.05));elapsed=time;a.away.render(scene,900,450);
   const direction=new AlpineThree.Vector3(0,0,-1).applyQuaternion(ship.camera.quaternion);
   frames.push({phase:m.phase,x:m.x,y:m.y,z:m.z,heading:s.heading,camera:ship.camera.position.toArray(),direction:direction.toArray(),exterior:!!ship.excursionShuttle?.visible});c.drawImage(scene.awayTexture.getCanvas(),i%2*900,Math.floor(i/2)*450);
  }
  return {inside:m.landing.inside,route:m.landing.route.length,before,frames,image:sheet.toDataURL('image/png')};
 });
 assert(result.inside&&result.route===0);assert.deepEqual(result.frames[0].camera,result.before,'cockpit position does not jump when landing starts');assert(result.frames.every(f=>!f.exterior),'exterior landing camera never takes over');assert(result.frames.every(f=>f.y<0),'shuttle remains inside the bay');assert(result.frames[1].x>0&&result.frames[1].y<-.080,'shuttle moves toward the back-right berth');assert.equal(result.frames[2].heading,0,'original cockpit heading is retained through setdown');assert.equal(result.frames[5].phase,'landed');assert.equal(result.frames[5].heading,180);assert(result.frames[5].direction[2]>.99,'final cockpit faces the tail');assert(Math.abs(result.frames[5].x-.03)<1e-6&&Math.abs(result.frames[5].y+.17225)<1e-6&&Math.abs(result.frames[5].z-109.9847)<1e-6,'touchdown reaches the right berth deck');assert.deepEqual(errors,[]);
 fs.writeFileSync('preview-inside-bay-landing.png',Buffer.from(result.image.split(',')[1],'base64'));console.log('Passed: continuous cockpit POV, in-bay back-right positioning, setdown, heading change under fade and outward-facing cockpit.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
