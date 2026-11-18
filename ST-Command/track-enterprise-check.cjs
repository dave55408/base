const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]})),{createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));await page.locator('#welcome-close').click();const button=page.getByRole('button',{name:'Track Enterprise',exact:true});assert(await button.isHidden());
 await page.evaluate(async()=>{const a=STCommand;a.state.throttle=0;a.away.launchShuttle();a.games.forEach(g=>g.loop.stop());a.state.paused=true;Object.assign(a.away.state,{phase:'flight',freeSpace:true,target:'ship',x:4,y:5,z:112,cameraView:'excursion',lookYaw:17,lookPitch:-8,cameraZoom:1.3,launchAttached:false,departureCameraPending:false,departureCameraFade:null,entranceCameraPose:null,entranceCameraFade:null});Object.assign(a.state,{heading:42,pitch:20,throttle:23,speed:.04,autopilot:false});a.away.updateUI();await EnterpriseModels.rendererFor(a.games[0].scene.getScene('Forward')).ready;});
 assert(await button.isVisible());assert(await button.evaluate(e=>e.previousElementSibling.id==='find-enterprise'));const initialView=await page.evaluate(()=>{const m=STCommand.away.state;return [m.cameraView,m.cameraZoom,m.lookYaw,m.lookPitch];});await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true');assert.deepEqual(await page.evaluate(()=>{const m=STCommand.away.state;return [m.cameraView,m.cameraZoom,m.lookYaw,m.lookPitch];}),initialView,'tracking activation preserves selected shuttle view and zoom');
 for(const view of ['cockpit','excursion'])for(const freeSpace of [true,false]){
  const result=await page.evaluate(([view,freeSpace])=>{
   const a=STCommand,m=a.away.state,s=a.state,T=AlpineThree,scene=a.games[0].scene.getScene('Forward');
   EnterpriseTracking.reset(m);
   Object.assign(m,{freeSpace,planet:freeSpace?null:a.systems[0],x:4,y:8,z:112,bank:.2,pitchBob:0,cameraView:view,lookYaw:17,lookPitch:-8,cameraZoom:1.3,trackingEnterprise:false});
   Object.assign(s,{heading:42,pitch:10});
   a.away.render(scene,300,200);const ship=scene.enterpriseRenderer,camera=view==='cockpit'?ship.camera:ship.excursionCamera,before=camera.quaternion.clone();
   m.trackingEnterprise=true;a.away.render(scene,300,200);
   // Allow the camera operator to acquire the subject without rendering every step.
   for(let i=0;i<180;i++){s.time+=1/60;EnterpriseTracking.aim(camera,ship.model,m,s);}
   const target=EnterpriseTracking.target(ship.model);
   const initial=camera.quaternion.clone(),position=camera.position.clone(),fov=camera.fov,look=[m.lookYaw,m.lookPitch],helm=[s.heading,s.pitch,s.throttle,s.speed,s.autopilot],screenStart=target.clone().project(camera);
   let maxTurn=0;
   for(let i=0;i<8;i++){
    s.time+=.1;m.x+=.4;m.y+=.3;m.z+=.1;a.away.render(scene,300,200);maxTurn=Math.max(maxTurn,initial.angleTo(camera.quaternion));
   }
   const translation=camera.position.clone().sub(position).toArray(),screenEnd=target.clone().project(camera),unmovedLook=look.every((v,i)=>Math.abs(v-[m.lookYaw,m.lookPitch][i])<1e-10),sameHelm=helm.every((v,i)=>v===[s.heading,s.pitch,s.throttle,s.speed,s.autopilot][i]);
   s.heading+=20;s.pitch-=5;m.bank+=.2;s.time+=.1;a.away.render(scene,300,200);
   const aimError=camera.getWorldDirection(new T.Vector3()).angleTo(target.clone().sub(camera.position).normalize()),finalScreen=target.clone().project(camera);
   return {activation:before.angleTo(initial),maxTurn,translation,fov,finalFov:camera.fov,unmovedLook,sameHelm,aimError,screenStart:screenStart.toArray(),screenEnd:screenEnd.toArray(),finalScreen:finalScreen.toArray(),zoom:m.cameraZoom,view:m.cameraView};
  },[view,freeSpace]);
  assert(result.maxTurn>.001,view+' tracking turns the camera as the relative position changes');
  assert(result.translation.every((v,i)=>Math.abs(v-[3.2,.8,2.4][i])<1e-8),'camera travels with the shuttle');
  assert(result.unmovedLook&&result.sameHelm,'tracking preserves mouse look and flight controls');
  assert(result.aimError<.3,'camera keeps Enterprise framed after helm turns');
  for(const point of [result.screenStart,result.screenEnd,result.finalScreen])assert(Math.hypot(point[0],point[1])<.75&&point[2]>-1&&point[2]<1,'Enterprise stays in view with room for motion');
  assert.equal(result.finalFov,result.fov);assert.equal(result.zoom,1.3);assert.equal(result.view,view);
 }
 const stable=await page.evaluate(()=>{const a=STCommand,m=a.away.state,scene=a.games[0].scene.getScene('Forward');EnterpriseTracking.reset(m);Object.assign(m,{x:0,y:15,z:110.4,bank:.3,pitchBob:0,cameraView:'cockpit',lookYaw:6,lookPitch:-3,cameraZoom:1.3,trackingEnterprise:true});Object.assign(a.state,{heading:0,pitch:0});a.away.render(scene,900,600);return [m.lookYaw,m.lookPitch];});assert.deepEqual(stable,[6,-3],'tracking activation preserves current framing before time advances');
 await button.click();assert.equal(await button.getAttribute('aria-pressed'),'false');await button.click();await page.locator('#look-forward').click();assert.equal(await button.getAttribute('aria-pressed'),'false');
 await button.click();await page.locator('#excursion-view').click();assert.equal(await button.getAttribute('aria-pressed'),'false');await button.click();await page.locator('#find-enterprise').click();assert.equal(await button.getAttribute('aria-pressed'),'false');
 await button.click();const view=page.locator('#main-view');await view.scrollIntoViewIfNeeded();const b=await view.boundingBox();await page.mouse.move(b.x+b.width*.4,b.y+b.height*.5);await page.mouse.down();await page.mouse.move(b.x+b.width*.45,b.y+b.height*.55,{steps:4});await page.mouse.up();assert.equal(await button.getAttribute('aria-pressed'),'false','dragging releases tracking');
 for(const width of [600,390]){await page.setViewportSize({width,height:900});await button.scrollIntoViewIfNeeded();const b=await button.boundingBox();assert(b.x>=0&&b.x+b.width<=width,'tracking button fits small viewports');}
 await page.evaluate(()=>{STCommand.away.state.phase='landed';STCommand.away.state.landing={heading:180,pitch:0,bank:0};STCommand.away.updateUI();});assert(await button.isHidden());await page.evaluate(()=>STCommand.reset());assert(await button.isHidden());assert.equal(await page.evaluate(()=>STCommand.away.state.trackingEnterprise),false);assert.deepEqual(errors,[]);console.log('Passed: camera operator keeps Enterprise framed through translation and helm turns, cockpit/excursion and space/planet views, preserved zoom and flight controls, cancellation, lifecycle, and mobile fit.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
