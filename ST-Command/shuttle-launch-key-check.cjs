const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]})),{createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
 const guards=await page.evaluate(async()=>{
  const a=STCommand,m=a.away.state,s=a.state;for(const game of a.games)game.loop.stop();
  const saved=EnterpriseModels.prepareLaunch;EnterpriseModels.prepareLaunch=async()=>null;
  const settle=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const press=(extra={},target=document.body)=>target.dispatchEvent(new KeyboardEvent('keydown',{key:'l',code:'KeyL',bubbles:true,cancelable:true,...extra}));
  s.throttle=80;press({ctrlKey:true});press({repeat:true});const modifiers=m.phase==='bridge';
  const input=document.createElement('input');document.body.append(input);press({},input);input.remove();const typing=m.phase==='bridge';
  const dialog=document.createElement('dialog');document.body.append(dialog);dialog.showModal();press();const modal=m.phase==='bridge';dialog.close();dialog.remove();
  press({},document.getElementById('throttle'));await settle();
  const jumped=m.phase==='flight'&&m.freeSpace&&m.cameraView==='cockpit'&&m.launchLiftRemaining===0&&s.heading===0&&s.pitch===0&&s.throttle===0&&s.speed===0&&m.bridgeState.throttle===80;
  const carrier=m.carrier,bridgeState=m.bridgeState;Object.assign(m,{x:3,y:4,z:111,lookYaw:40,lookPitch:20,bank:.7,roll:.7,cameraView:'excursion'});press();await new Promise(resolve=>setTimeout(resolve,3100));
  const ended=m.phase==='bridge'&&!m.freeSpace&&m.carrier===null&&m.bridgeState===null&&s.throttle===bridgeState.throttle&&s.heading===bridgeState.heading&&!document.body.classList.contains('shuttle-mode')&&document.getElementById('shuttle-ended-hud').hidden;
  Object.assign(m,{phase:'landed',freeSpace:true,landing:{pad:{x:0,y:0,z:110}},landingChoicePending:true});document.getElementById('shuttle-choice').showModal();press();await new Promise(resolve=>setTimeout(resolve,3100));
  const landed=m.phase==='bridge'&&!document.getElementById('shuttle-choice').open&&document.getElementById('shuttle-ended-hud').hidden;
  a.reset();m.phase='orbit';m.planet={name:'Test'};press();await settle();const orbital=m.freeSpace&&m.cameraView==='cockpit'&&m.planet===null;
  a.reset();a.away.launchShuttle();const bayLaunch=m.launchLiftRemaining===1.5&&m.cameraView==='excursion'&&s.heading===180;
  a.reset();EnterpriseModels.prepareLaunch=saved;return {modifiers,typing,modal,jumped,ended,landed,orbital,bayLaunch};
 });
 for(const [name,value]of Object.entries(guards))assert(value,name);
 const preparation=await page.locator('#shuttle-preparing-hud').evaluate(el=>({text:el.textContent,animation:getComputedStyle(el).animationName}));
 assert.equal(preparation.text,'Preparing Shuttle');assert.equal(preparation.animation,'none');
 const models=[];
 for(const model of ['third']){
  await page.evaluate(model=>{STCommand.reset();EnterpriseModels.selected=model;},model);
  await page.keyboard.press('l');await page.waitForFunction(()=>STCommand.away.state.phase==='flight'&&STCommand.away.state.cameraView==='cockpit',null,{timeout:180000});
  const result=await page.evaluate(()=>{
   const a=STCommand,m=a.away.state,s=a.state,T=AlpineThree,scene=a.games[0].scene.getScene('Forward'),ship=EnterpriseModels.rendererFor(scene),tube=ship.model.getObjectByName('starboard-engine-outer-tube');
   ship.model.updateWorldMatrix(true,true);const engineY=tube.getWorldPosition(new T.Vector3()).y,p=tube.geometry.attributes.position;let front=Infinity,rear=-Infinity;
   for(let i=0;i<p.count;i++){const axial=tube.localToWorld(new T.Vector3().fromBufferAttribute(p,i)).z;front=Math.min(front,axial);rear=Math.max(rear,axial);}
   const start=[m.x,m.y,m.z];a.tick(1);const stationary=start.every((v,i)=>v===[m.x,m.y,m.z][i]);
   const canvas=document.createElement('canvas');canvas.width=800;canvas.height=450;ship.draw(canvas.getContext('2d'),800,450,m,s);
   const direction=ship.camera.getWorldDirection(new T.Vector3());window.engineHeightPreview=ship.renderer.domElement.toDataURL('image/png');
   return {model:EnterpriseModels.selected,height:m.z-110,engineY,midpointError:m.y-(front+rear)/2,cockpit:m.cameraView==='cockpit',stationary,heading:s.heading,pitch:s.pitch,forward:direction.z<-.99999&&Math.abs(direction.y)<1e-6,lift:m.launchLiftRemaining,attached:m.launchAttached,transition:m.departureCameraPending||m.departureCameraFade!=null||m.entranceCameraFade!=null,glError:ship.renderer.getContext().getError()};
  });
  assert(Math.abs(result.height-result.engineY)<1e-8);assert(Math.abs(result.midpointError)<1e-8);assert(result.cockpit&&result.stationary&&result.forward);assert.equal(result.heading,0);assert.equal(result.pitch,0);assert.equal(result.lift,0);assert(!result.attached&&!result.transition);assert.equal(result.glError,0);models.push(result);
 }
 fs.writeFileSync(path.join(os.tmpdir(),'st-command-engine-height-cockpit.png'),Buffer.from((await page.evaluate(()=>engineHeightPreview)).split(',')[1],'base64'));
 const savedBridge=await page.evaluate(()=>({...STCommand.away.state.bridgeState}));
 await page.evaluate(()=>STCommandView.toggle());await page.keyboard.press('l');
 assert.equal(await page.evaluate(()=>STCommand.away.state.phase),'flight');
 assert(await page.evaluate(()=>STCommandView.active),'shuttle fullscreen remains during ending');
 const hud=await page.locator('#shuttle-ended-hud').evaluate(el=>({hidden:el.hidden,screen:!!el.closest('.screen-glass'),animation:getComputedStyle(el).animationName}));
 assert(!hud.hidden&&hud.screen);assert.equal(hud.animation,'shuttle-message-flash');
 await page.waitForFunction(()=>STCommand.away.state.phase==='bridge'&&!STCommandView.active,null,{timeout:6000});
 assert.equal(await page.locator('#shuttle-ended-hud').textContent(),'End Shuttle Mission');
 const restored=await page.evaluate(()=>({x:STCommand.state.x,y:STCommand.state.y,z:STCommand.state.z,heading:STCommand.state.heading,throttle:STCommand.state.throttle,speed:STCommand.state.speed,shuttle:document.body.classList.contains('shuttle-mode'),map:STCommand.away.state.mapMode}));
 for(const key of ['x','y','z','heading','throttle','speed'])assert.equal(restored[key],savedBridge[key],'ending restores Enterprise '+key);assert(!restored.shuttle);assert.equal(restored.map,'galaxy');
 await page.waitForFunction(()=>document.getElementById('shuttle-ended-hud').hidden,null,{timeout:6000});
 await page.evaluate(()=>{STCommand.away.orbit(STCommand.systems[1]);STCommand.away.launch();});await page.keyboard.press('l');await page.waitForFunction(()=>STCommand.away.state.phase==='bridge',null,{timeout:6000});assert.equal(await page.evaluate(()=>STCommand.away.state.phase),'bridge');assert.equal(await page.evaluate(()=>STCommand.state.speed),0);
 await page.evaluate(()=>{const a=STCommand,m=a.away.state;a.reset();a.away.launchShuttle();Object.assign(m,{phase:'landed',clock:10,landingChoicePending:true,landingCameraFade:null,landing:{pad:ShuttleBayFlight.padRoot(180),heading:180,pitch:0,bank:0}});EnterpriseModels.prepareLaunch=()=>new Promise(resolve=>window.finishCanceledRelaunch=resolve);a.away.updateUI();});
 await page.locator('#shuttle-choice-launch').click();await page.waitForFunction(()=>!!window.finishCanceledRelaunch);await page.keyboard.press('l');await page.waitForFunction(()=>STCommand.away.state.phase==='bridge',null,{timeout:6000});assert.equal(await page.evaluate(()=>STCommand.away.state.phase),'bridge');assert(!(await page.locator('#shuttle-choice').isVisible()));assert(!(await page.locator('#shuttle-preparing-hud').isVisible()));await page.evaluate(()=>finishCanceledRelaunch());await page.waitForFunction(()=>!document.getElementById('launch-shuttle').disabled);assert.equal(await page.evaluate(()=>STCommand.away.state.phase),'bridge');
 assert.deepEqual(errors,[]);console.log(JSON.stringify(models));console.log('Passed: L jumps to the forward cockpit at the actual engine height and fore/aft midpoint on the current ship; L ends active sorties, restores Enterprise, shows the ending HUD, exits fullscreen, handles surface/landed missions and cancels queued relaunches.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});