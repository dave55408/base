const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
 await page.evaluate(()=>{for(const g of STCommand.games)g.loop.stop();NightMode.enabled=false;});
 await page.locator('#night-mode-toggle').click();assert.equal(await page.locator('#night-mode-toggle').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#night-mode-toggle').evaluate(el=>document.activeElement===el),false,'toggle returns keyboard control to flight');
 await page.evaluate(()=>{STCommand.state.throttle=25;STCommand.state.speed=.1;});
 for(let i=0;i<3;i++)await page.keyboard.press('Space');
 assert.equal(await page.locator('#night-mode-toggle').getAttribute('aria-pressed'),'true','Space must not toggle night mode after clicking');
 assert.equal(await page.evaluate(()=>STCommand.state.throttle),0,'Space still stops the craft');
 const result=await page.evaluate(async()=>{
  const T=AlpineThree,scene=new T.Scene(),model=new T.Group();scene.add(model);const sun=new T.DirectionalLight(0xffffff,2),fill=new T.HemisphereLight(0xffffff,0,1),spot=new T.Light(0xffffff,.4),lamp=new T.Light(0xff0000,.2),bayFill=new T.DirectionalLight(0xffffff,1.2),ownSpot=new T.Light(0xffffff,.3);spot.isSpotLight=ownSpot.isSpotLight=true;scene.add(sun,fill,spot);model.add(lamp,bayFill,ownSpot);
  let during,fail=false;const fake={scene,model,renderer:{render(){during=[sun.intensity,fill.intensity,spot.intensity,lamp.intensity,bayFill.intensity,ownSpot.intensity];if(fail)throw Error('expected test failure');}}};NightMode.attach(fake);NightMode.attach(fake);fake.renderer.render(scene);
  const dimmed=during.slice(),restored=[sun.intensity,fill.intensity,spot.intensity,lamp.intensity,bayFill.intensity,ownSpot.intensity];fail=true;try{fake.renderer.render(scene);}catch{}const errorRestored=sun.intensity===2&&lamp.intensity===.2;
  const reflectionMaterial=new T.MeshStandardMaterial();reflectionMaterial.envMapIntensity=1.1;reflectionMaterial.userData.externalReflection=true;
  for(let i=0;i<2;i++)model.add(new T.Mesh(new T.BoxGeometry(1,1,1),reflectionMaterial));
  let reflectionDuring;const reflectionShip={model,renderer:{render(){reflectionDuring=reflectionMaterial.envMapIntensity;if(fail)throw Error('expected reflection failure');}}};NightMode.attach(reflectionShip);
  fail=false;reflectionShip.renderer.render(scene);if(reflectionDuring!==1.1*.025||reflectionMaterial.envMapIntensity!==1.1)throw Error('Shared external reflections must dim once and restore');
  fail=true;try{reflectionShip.renderer.render(scene);}catch{}if(reflectionMaterial.envMapIntensity!==1.1)throw Error('External reflections must restore after render failure');
  const frames=[],host=STCommand.games[0].scene.getScene('Forward'),canvas=document.createElement('canvas');canvas.width=700;canvas.height=450;const ctx=canvas.getContext('2d'),sheet=document.createElement('canvas');sheet.width=1400;sheet.height=1350;const out=sheet.getContext('2d');
  for(const [row,variant]of ['movie','third','original'].entries()){
   EnterpriseModels.selected=variant;const ship=EnterpriseModels.rendererFor(host);await ship.ready;const aim=new T.Vector3(0,.1,-.8),camera=new T.PerspectiveCamera(38,700/450,.01,20);camera.position.set(3,1.8,2.8);camera.lookAt(aim);camera.updateWorldMatrix(true,false);
   const emission=ship.model.getObjectByName('shuttle-bay-green-light').material,emissionBefore=emission.emissiveIntensity;if(!(emissionBefore>0))throw Error('Onboard beacon must have emissive lighting');
   const impulse=ship.model.getObjectByName('recessed-impulse-grates');
   if(impulse){
    for(const room of impulse.getObjectByName('impulse-interior-room').children){
     const spec=room.userData,time=(spec.pulsePeriod*.75-spec.phaseOffset)/spec.timeDirection;
     impulse.userData.updateGlow(time);
     const back=room.getObjectByName('impulse-room-back-wall'),emitter=room.getObjectByName('impulse-room-red-emitter');
     if(back.material.uniforms.uPulse.value<.65||emitter.intensity<.00000010)throw Error('Impulse engines must retain a red glow at pulse minimum');
     const before=emitter.intensity;NightMode.enabled=true;ship.renderer.render(ship.scene,camera);
     if(back.material.uniforms.uPulse.value<.65||emitter.intensity!==before)throw Error('Night mode must preserve impulse standby glow');
    }
    impulse.userData.updateGlow(0);
   }
   const hatch=ship.model.getObjectByName('docking-hatch-left'),rim=ship.model.getObjectByName('docking-port-metal-rim'),lamp=ship.model.getObjectByName('docking-side-light');
   for(const part of [hatch,rim]){
    const intensity=part.material.envMapIntensity;let observed=false;
    part.onBeforeRender=()=>{observed=true;if(part.material.envMapIntensity!==intensity*.025)throw Error('Hatch reflection must dim during night rendering');};
    NightMode.enabled=true;ship.renderer.render(ship.scene,camera);part.onBeforeRender=()=>{};
    if(!observed||part.material.envMapIntensity!==intensity)throw Error('Hatch reflection must render and restore');
   }
   if(lamp.material.emissiveIntensity!==1.3)throw Error('Hatch indicator lamps must stay lit');
   let before;for(const enabled of [false,true]){NightMode.enabled=enabled;ship.renderer.setSize(700,450,false);ship.renderer.render(ship.scene,camera);ctx.clearRect(0,0,700,450);ctx.drawImage(ship.renderer.domElement,0,0);out.drawImage(canvas,enabled?700:0,row*450);const data=ctx.getImageData(0,0,700,450).data;if(!enabled)before=data;else{let day=0,night=0,count=0;for(let i=0;i<data.length;i+=4)if(before[i+3]>250){day+=before[i]+before[i+1]+before[i+2];night+=data[i]+data[i+1]+data[i+2];count++;}frames.push({variant,ratio:night/Math.max(1,day),count,emissionUnchanged:emission?.emissiveIntensity===emissionBefore,glError:ship.renderer.getContext().getError()});}}
  }
  NightMode.enabled=true;return {dimmed,restored,errorRestored,frames,image:sheet.toDataURL('image/png').split(',')[1]};
 });
 assert.deepEqual(result.dimmed,[2*.025,1*.025,.4*.025,.2,1.2*.025,.3]);assert.deepEqual(result.restored,[2,1,.4,.2,1.2,.3]);assert(result.errorRestored);
 for(const frame of result.frames){assert(frame.count>1000);assert(frame.ratio<.45,'night view must be substantially darker');assert(frame.emissionUnchanged);assert.equal(frame.glError,0);}
 await page.locator('#night-mode-toggle').focus();await page.keyboard.press('Space');assert.equal(await page.locator('#night-mode-toggle').getAttribute('aria-pressed'),'false');
 await page.locator('#night-mode-toggle').click();await page.reload();await page.waitForFunction(()=>window.NightMode);assert.equal(await page.locator('#night-mode-toggle').getAttribute('aria-pressed'),'true');
 await page.screenshot({path:path.join(require('node:os').tmpdir(),'st-command-night-mode-toolbar.png')});
 const preview=path.join(require('node:os').tmpdir(),'st-command-night-mode.png');require('node:fs').writeFileSync(preview,Buffer.from(result.image,'base64'));assert.deepEqual(errors,[]);console.log(JSON.stringify(result.frames));console.log(preview);console.log('Passed: toolbar toggle, persisted setting, low external lights, preserved onboard lights, exact restoration, keyboard activation and all three models.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
