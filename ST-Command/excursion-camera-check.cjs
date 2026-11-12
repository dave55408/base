const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:2048,height:1152}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
 assert(await page.locator('#excursion-view').isHidden());await page.locator('#stop').click();await page.locator('#launch-shuttle').click();
 await page.evaluate(()=>{const a=STCommand;Object.assign(a.state,{paused:true,throttle:0,speed:0,heading:0,pitch:5});Object.assign(a.away.state,{x:.45,y:3,z:110.3,clock:12});a.away.updateUI();});
 assert(await page.locator('#excursion-view').isVisible(),JSON.stringify(await page.evaluate(()=>({phase:STCommand.away.state.phase,freeSpace:STCommand.away.state.freeSpace,buttonHidden:document.getElementById('excursion-view').hidden,controlsHidden:document.getElementById('camera-controls').hidden})))+' / '+JSON.stringify(errors));
 await page.locator('#excursion-view').click();assert.equal(await page.locator('#excursion-view').textContent(),'COCKPIT VIEW');
 async function frame(){return page.evaluate(async()=>{const a=STCommand,scene=a.games[0].scene.getScene('Forward');a.away.render(scene,scene.scale.width,scene.scale.height);const ship=scene.enterpriseRenderer;await ship.ready;a.away.render(scene,scene.scale.width,scene.scale.height);const craft=ship.excursionShuttle,parked=ship.model.getObjectByName('parked-class-f-shuttle');
  const cameraDirection=new AlpineThree.Vector3(0,0,-1).applyQuaternion(ship.excursionCamera.quaternion).toArray(),d=SpaceMath.direction(a.state.heading+(a.away.state.lookYaw||0),Math.max(-89,Math.min(89,a.state.pitch+(a.away.state.lookPitch||0))));
  return {cameraDirection,expectedDirection:[d.x,d.z,d.y],framing:ship.excursionFraming,visible:craft.visible,rotation:craft.rotation.toArray(),hasParked:!!parked,heading:a.state.heading,pitch:a.state.pitch};});}
 function fits(result,rolled=false){assert(result.visible);const points=result.framing.shuttle;assert(points.every(p=>Math.abs(p[0])<.98&&Math.abs(p[1])<.98&&p[2]>-1&&p[2]<1),'shuttle remains fully visible');const width=(Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0])))/2;assert(rolled?width>0&&width<=.205:Math.abs(width-.20)<.005,'shuttle maintains its target screen size, fitting vertical space during rolls');assert(result.cameraDirection.every((v,i)=>Math.abs(v-result.expectedDirection[i])<1e-5),'exterior camera preserves the shuttle viewpoint');}
 const initial=await frame();fits(initial);assert.equal(initial.hasParked,false,'the bay has no second parked shuttle');
 if(!process.argv.includes('--no-images'))await page.locator('.viewscreen-shell').screenshot({path:path.join(__dirname,'preview-excursion-camera.png')});
 await page.evaluate(()=>{STCommand.away.state.lookYaw=30;STCommand.away.state.lookPitch=10;});const orbit=await frame();fits(orbit);assert.deepEqual(orbit.rotation,initial.rotation,'camera orbit does not rotate the shuttle');assert.equal(orbit.heading,initial.heading);assert.equal(orbit.pitch,initial.pitch);
 await page.evaluate(()=>{Object.assign(STCommand.away.state,{x:0,y:25,z:110,lookYaw:0,lookPitch:0});});fits(await frame());
 await page.evaluate(()=>{Object.assign(STCommand.away.state,{x:0,y:.8,z:110});});fits(await frame());
 await page.evaluate(()=>{STCommand.state.heading=90;STCommand.state.pitch=-12;});fits(await frame());
 await page.evaluate(()=>{STCommand.away.state.bank=Math.PI;});fits(await frame());
 assert(await page.evaluate(()=>{const s=STCommand.games[0].scene.getScene('Forward').enterpriseRenderer;const up=new AlpineThree.Vector3(0,1,0).applyQuaternion(s.excursionShuttle.quaternion);return up.y<-.9&&s.excursionCamera.up.y>.9;}),'shuttle renders inverted while the excursion camera keeps Enterprise level');
 if(!process.argv.includes('--no-images'))await page.locator('.viewscreen-shell').screenshot({path:path.join(__dirname,'preview-inverted-shuttle.png')});
 await page.evaluate(()=>{STCommand.away.state.bank=Math.PI/2;});fits(await frame(),true);await page.evaluate(()=>{STCommand.away.state.bank=0;});
 await page.locator('#enterprise-model').selectOption('original');fits(await frame());await page.locator('#enterprise-model').selectOption('movie');fits(await frame());
 await page.evaluate(()=>{Object.assign(STCommand.away.state,{freeSpace:false,planet:STCommand.systems[0],z:110,lookYaw:0,lookPitch:0});});
 await frame();const planetFrame=await page.evaluate(()=>{const a=STCommand,scene=a.games[0].scene.getScene('Forward');return {rect:scene.enterpriseRenderer.planetExcursionFraming,w:scene.scale.width,h:scene.scale.height};});
 assert(planetFrame.rect.liveModel);assert(Math.abs((planetFrame.rect.x+planetFrame.rect.width/2)/planetFrame.w-.46)<.001&&Math.abs((planetFrame.rect.y+planetFrame.rect.height/2)/planetFrame.h-.456)<.001,'planet excursion matches reference placement');assert(Math.abs(Math.max(planetFrame.rect.width/(planetFrame.w*.84),planetFrame.rect.height/(planetFrame.h*.86))-1)<.001,'planet excursion fills reference size');
 assert(await page.evaluate(()=>{const l=STCommand.games[0].scene.getScene('Forward').enterpriseRenderer.scene.getObjectByName('planet-bounce');return l.intensity>0&&l.color.b>l.color.r&&l.position.y<0;}),'blue planet casts colored fill onto the hull from below');
 if(!process.argv.includes('--no-images'))await page.locator('.viewscreen-shell').screenshot({path:path.join(__dirname,'preview-planet-excursion.png')});
 await page.evaluate(()=>{STCommand.away.state.freeSpace=true;});fits(await frame());
 assert(await page.evaluate(()=>STCommand.games[0].scene.getScene('Forward').enterpriseRenderer.scene.getObjectByName('planet-bounce').intensity===0),'planet bounce switches off in open space');
 await page.locator('#excursion-view').click();assert.equal(await page.locator('#excursion-view').textContent(),'EXCURSION VIEW');
 assert(await page.evaluate(()=>{const a=STCommand,s=a.games[0].scene.getScene('Forward');a.away.render(s,s.scale.width,s.scale.height);return !s.enterpriseRenderer.excursionShuttle.visible&&a.away.state.cameraView==='cockpit';}));
 await page.locator('#excursion-view').click();await page.locator('#look-forward').click();assert(await page.evaluate(()=>STCommand.away.state.cameraView==='cockpit'),'Forward View restores cockpit camera');
 await page.evaluate(()=>{STCommand.away.reset();STCommand.away.updateUI();});assert(await page.locator('#excursion-view').isHidden());assert.deepEqual(errors,[]);
 console.log('Passed: no parked duplicate, shuttle POV, 20 percent screen width near/far and through turns, both Enterprise models, mouse look, cockpit return and reset.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
