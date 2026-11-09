const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
await page.locator('#warp').click();await page.locator('#throttle').fill('100');await page.locator('#engage').click();
const arrival=await page.evaluate(()=>{const sim=STCommand;for(let n=0;n<5000&&sim.away.state.phase==='bridge';n++)sim.tick(.05);return {phase:sim.away.state.phase,distance:SpaceMath.distance(sim.state,sim.state.target)};});assert.equal(arrival.phase,'orbit');assert(arrival.distance<1);if(process.argv.includes('--screenshots'))await page.screenshot({path:path.join(__dirname,'preview-orbit.png'),fullPage:true});
const rotation=await page.evaluate(()=>{
  const scene=STCommand.games[0].scene.getScene('Forward');STCommand.away.render(scene,1296,331);
  const canvas=document.createElement('canvas');canvas.width=1296;canvas.height=331;const c=canvas.getContext('2d');
  scene.detailedPlanet.draw(c,1296,331,0);const before=c.getImageData(0,0,1296,331).data;c.clearRect(0,0,1296,331);scene.detailedPlanet.draw(c,1296,331,6.25);const after=c.getImageData(0,0,1296,331).data;
  let best={error:Infinity,x:0,y:0};
  for(let dy=-60;dy<=60;dy+=4)for(let dx=-60;dx<=60;dx+=4){let error=0;for(let y=170;y<270;y+=8)for(let x=170;x<650;x+=8)error+=Math.abs(after[(y*1296+x)*4+1]-before[((y+dy)*1296+x+dx)*4+1]);if(error<best.error)best={error,x:dx,y:dy};}
  return best;
});assert(rotation.x>0&&rotation.y<0,'planet surface visibly rotates left and down with a fixed limb: '+JSON.stringify(rotation));
const palettes=await page.evaluate(()=>{
  const planet=STCommand.games[0].scene.getScene('Forward').detailedPlanet,canvas=document.createElement('canvas');canvas.width=1296;canvas.height=331;const c=canvas.getContext('2d');
  return ['vulcan','andoria'].map(id=>{c.clearRect(0,0,1296,331);planet.draw(c,1296,331,0,STCommand.systems.find(p=>p.id===id).color);const pixels=c.getImageData(170,170,480,120).data,sum=[0,0,0];for(let i=0;i<pixels.length;i+=4)for(let k=0;k<3;k++)sum[k]+=pixels[i+k];return sum;});
});assert(palettes[0][0]>palettes[0][1]&&palettes[0][1]>palettes[0][2],'Vulcan close-up matches its orange icon');assert(palettes[1][2]>palettes[1][0],'Andoria close-up matches its icy blue icon, including when time is unchanged');
const coverage=await page.evaluate(()=>{
  const scene=STCommand.games[0].scene.getScene('Forward'),canvas=document.createElement('canvas');canvas.width=1296;canvas.height=331;const c=canvas.getContext('2d');
  return [0,-30,-60].map(pitch=>{c.clearRect(0,0,1296,331);scene.detailedPlanet.draw(c,1296,331,0,STCommand.state.target.color,pitch);const pixels=c.getImageData(0,0,1296,331).data;let count=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>128)count++;return count;});
});assert(coverage[0]<coverage[1]&&coverage[1]<coverage[2],'pitching down progressively fills more of the viewscreen with planet: '+JSON.stringify(coverage));
await page.locator('#launch-craft').click();assert.equal(await page.locator('#destination option').count(),2);assert(await page.locator('#warp').isDisabled());
await page.setViewportSize({width:2560,height:1440});await page.waitForTimeout(200);assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),'shuttle controls fit the large display');for(const id of ['#launch-craft','#retrieve-beacon','#manual']){if(await page.locator(id).isVisible()){const box=await page.locator(id).boundingBox();assert(box.y+box.height<=1440,id+' fits on screen');}}
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no mobile horizontal overflow');await page.setViewportSize({width:1440,height:1050});
const heading=await page.evaluate(()=>STCommand.state.heading);await page.locator('#port').click();assert(Math.abs(await page.evaluate(()=>STCommand.state.heading)-heading)>10,'same helm steers landing craft');
await page.locator('#retrieve-beacon').click({trial:true,timeout:300}).then(()=>assert.fail('retrieval allowed from orbit'),()=>{});
await page.locator('#engage').click();
const descent=await page.evaluate(()=>{const sim=STCommand,seen=new Set();for(let i=0;i<20000&&sim.state.autopilot;i++){sim.tick(.05);const z=sim.away.state.z;seen.add(z>65?'upper':z>4?'cloud':'lower');}return {seen:[...seen],range:sim.away.range(),alt:sim.away.state.z,auto:sim.state.autopilot,message:document.getElementById('message').textContent};});console.log('Descent:',descent);assert.deepEqual(descent.seen,['upper','cloud','lower']);assert(descent.range<.45,JSON.stringify(descent));
await page.waitForFunction(()=>STCommand.games[0].scene.getScene('Forward').surfaceWorld?.renderer.info.render.triangles>10000);
assert(await page.evaluate(()=>STCommand.games[0].scene.getScene('Forward').surfaceWorld.trees>2000),'surface uses the Alpine Flight 3D forest renderer');
assert(await page.evaluate(()=>{const geo=STCommand.games[0].scene.getScene('Forward').surfaceWorld.terrain.geometry,p=geo.attributes.position,c=geo.attributes.color;for(let i=0;i<p.count;i++)if(p.getY(i)<100)return c.getX(i)>c.getY(i)&&c.getY(i)>c.getZ(i);return false;}),'Vulcan surface terrain matches its warm orange icon');
if(process.argv.includes('--screenshots')){
  const saved=await page.evaluate(()=>({mission:{...STCommand.away.state},heading:STCommand.state.heading,pitch:STCommand.state.pitch}));
  await page.evaluate(()=>{Object.assign(STCommand.away.state,{x:7.5,y:-9,z:.65});Object.assign(STCommand.state,{heading:0,pitch:-6});});await page.waitForTimeout(250);await page.screenshot({path:path.join(__dirname,'preview-valley.png'),fullPage:true});
  await page.evaluate(saved=>{Object.assign(STCommand.away.state,saved.mission);Object.assign(STCommand.state,{heading:saved.heading,pitch:saved.pitch});},saved);
}
const surfaceAttitude=await page.evaluate(()=>({heading:STCommand.state.heading,pitch:STCommand.state.pitch}));
for(const slider of ['#heading','#pitch','#throttle'])for(const key of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']){
  await page.evaluate(()=>Object.assign(STCommand.state,{heading:180,pitch:0,throttle:0,speed:0}));await page.locator(slider).focus();
  await page.keyboard.down(key);await page.evaluate(()=>STCommand.tick(.15));await page.keyboard.up(key);
  const attitude=await page.evaluate(()=>({heading:STCommand.state.heading,pitch:STCommand.state.pitch,throttle:STCommand.state.throttle}));
  assert.equal(attitude.throttle,0,'focused '+slider+' does not steal '+key+' for throttle');
  if(key==='ArrowLeft'||key==='ArrowRight'){assert.equal(attitude.pitch,0);assert(key==='ArrowLeft'?attitude.heading<175:attitude.heading>185,'focused '+slider+' preserves yaw control');}
  else{assert.equal(attitude.heading,180);assert(key==='ArrowUp'?attitude.pitch< -4:attitude.pitch>4,'focused '+slider+' preserves pilot pitch control: up dives, down climbs');}
}
for(const slider of ['#heading','#pitch','#throttle']){
  await page.locator(slider).focus();await page.keyboard.down('w');await page.evaluate(()=>STCommand.tick(.15));await page.keyboard.up('w');assert(await page.evaluate(()=>STCommand.state.throttle>4),'W adds power with '+slider+' focused');
  await page.keyboard.down('s');await page.evaluate(()=>STCommand.tick(.3));await page.keyboard.up('s');assert.equal(await page.evaluate(()=>STCommand.state.throttle),0,'S reduces power with '+slider+' focused');
}
await page.evaluate(attitude=>Object.assign(STCommand.state,attitude),surfaceAttitude);
await page.waitForTimeout(150);if(process.argv.includes('--screenshots'))await page.screenshot({path:path.join(__dirname,'preview-surface.png'),fullPage:true});await page.locator('#retrieve-beacon').click();assert(await page.evaluate(()=>STCommand.away.state.recovered));assert.equal(await page.locator('#destination').inputValue(),'ship');await page.locator('#engage').click();
const ascent=await page.evaluate(()=>{const sim=STCommand;for(let i=0;i<30000&&sim.state.autopilot;i++)sim.tick(.05);return {range:sim.away.range(),heading:sim.state.heading,pitch:sim.state.pitch,phase:sim.away.state.phase,message:document.getElementById('message').textContent};});console.log('Return:',ascent);assert(ascent.range<.65,JSON.stringify(ascent));await page.waitForTimeout(150);
assert((await page.locator('.galaxy .display-title h2').textContent()).includes('3D SHUTTLE ATTITUDE'));
const mapAttitude=await page.evaluate(()=>{
  const sim=STCommand,scene=sim.games[2].scene.getScene('Map'),draw=()=>{sim.away.renderNav(scene,scene.scale.width,scene.scale.height,'map');return {...scene.shuttleMapTelemetry};};
  const original={heading:sim.state.heading,pitch:sim.state.pitch,bank:sim.away.state.bank},before=draw();sim.state.heading=45;sim.state.pitch=20;sim.away.state.bank=-.25;const after=draw();sim.state.heading=original.heading;sim.state.pitch=original.pitch;sim.away.state.bank=original.bank;draw();return {before,after};
});assert.equal(mapAttitude.after.heading,45);assert.equal(mapAttitude.after.pitch,20);assert(mapAttitude.after.bank< -14);assert(Math.hypot(mapAttitude.after.nose.x-mapAttitude.before.nose.x,mapAttitude.after.nose.y-mapAttitude.before.nose.y)>3,'3D shuttle nose follows heading and pitch');assert(Math.hypot(mapAttitude.after.wing.x-mapAttitude.before.wing.x,mapAttitude.after.wing.y-mapAttitude.before.wing.y)>3,'3D wing follows bank');
await page.locator('#map-view canvas').scrollIntoViewIfNeeded();const mapBox=await page.locator('#map-view canvas').boundingBox(),yawBefore=await page.evaluate(()=>STCommand.games[2].scene.getScene('Map').yaw);
await page.mouse.move(mapBox.x+mapBox.width/2,mapBox.y+90);await page.mouse.down();await page.mouse.move(mapBox.x+mapBox.width/2+40,mapBox.y+110,{steps:4});await page.mouse.up();assert(await page.evaluate(yaw=>STCommand.games[2].scene.getScene('Map').yaw>yaw+10,yawBefore),'drag orbits the shuttle approach map');
const zoomBefore=await page.evaluate(()=>STCommand.games[2].scene.getScene('Map').zoom);await page.locator('#map-zoom-in').click();assert(await page.evaluate(zoom=>STCommand.games[2].scene.getScene('Map').zoom>zoom,zoomBefore));await page.locator('#map-home').click();await page.waitForTimeout(100);
if(process.argv.includes('--screenshots'))await page.screenshot({path:path.join(__dirname,'preview-aft-bay.png'),fullPage:true});
await page.locator('#land-bay').click();const docking=await page.evaluate(()=>{const sim=STCommand,scene=sim.games[2].scene.getScene('Map'),draw=()=>{sim.away.renderNav(scene,scene.scale.width,scene.scale.height,'map');return scene.shuttleMapTelemetry.range;};const before=draw();for(let i=0;i<40;i++)sim.tick(.05);return {before,mid:draw()};});assert(docking.mid<docking.before&&docking.mid>0,'3D landing guidance moves shuttle into the bay');
await page.evaluate(()=>{for(let i=0;i<60;i++)STCommand.tick(.05);const scene=STCommand.games[2].scene.getScene('Map');STCommand.away.renderNav(scene,scene.scale.width,scene.scale.height,'map');});assert.equal(await page.evaluate(()=>STCommand.away.state.phase),'landed');assert.equal(await page.evaluate(()=>STCommand.games[2].scene.getScene('Map').shuttleMapTelemetry.range),0,'touchdown is aligned at the bay');
await page.locator('#power-down').click();await page.evaluate(()=>{for(let i=0;i<70;i++)STCommand.tick(.05);});assert.equal(await page.evaluate(()=>STCommand.away.state.phase),'orbit');assert(await page.evaluate(()=>STCommand.away.state.completed));assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('shuttle-mode')),false);
await page.keyboard.press('r');assert.equal(await page.evaluate(()=>STCommand.away.state.phase),'bridge');assert.equal(await page.locator('#destination option').count(),11);assert.deepEqual(errors,[]);console.log('Full sortie passed: orbit, launch, atmospheric descent, retrieval, ascent, aft bay landing, power down, bridge return and reset.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
