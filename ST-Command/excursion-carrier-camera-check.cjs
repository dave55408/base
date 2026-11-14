const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
 await page.evaluate(()=>{STCommand.state.throttle=0;STCommand.away.launchShuttle();STCommand.state.paused=true;for(const g of STCommand.games)g.loop.stop();});
 const results=[];
 for(const view of ['cockpit','excursion'])for(const look of view==='cockpit'?[[0,0]]:[[0,0],[27,-12]])for(const input of ['Numpad3','Numpad2','NumpadDecimal','forward','reverse']){
  await page.evaluate(async([yaw,pitch,view])=>{
   const a=STCommand,m=a.away.state,s=a.state;Object.assign(m,{phase:'flight',freeSpace:true,x:1,y:3,z:111,roll:0,bank:0,turnBank:0,pitchBob:0,lastVisualPitch:0,launchAttached:false,launchLiftRemaining:0,departureCameraPending:false,departureCameraFade:null,entranceCameraFade:null,entranceCameraPose:null,cameraView:view,lookYaw:yaw,lookPitch:pitch,cameraZoom:1});
   Object.assign(s,{paused:true,heading:180,pitch:0,throttle:0,speed:0,autopilot:false,turn:0,pitchTurn:0});Object.assign(m.carrier,{x:0,y:0,z:0,heading:0,pitch:0,roll:0,manualRoll:0,turnBank:0,manual:true,moving:false,speed:0,returningNeutral:false});Object.assign(m.bridgeState,{throttle:0,speed:0});
   const scene=a.games[0].scene.getScene('Forward');a.away.render(scene,900,600);await scene.enterpriseRenderer.ready;
  },[...look,view]);
  async function snapshot(){return page.evaluate(()=>{
   const a=STCommand,m=a.away.state,scene=a.games[0].scene.getScene('Forward'),ctx=scene.awayTexture.getContext(),fillRect=ctx.fillRect,stars=[];
   const starColor=m.cameraView==='cockpit'?'#d2e7ff':'#c3d8e7';
   ctx.fillRect=function(x,y,w,h){if(this.fillStyle===starColor&&w>0&&w<2&&h>0&&h<2)stars.push([x,y]);return fillRect.call(this,x,y,w,h);};
   try{a.away.render(scene,900,600);}finally{ctx.fillRect=fillRect;}
   const ship=scene.enterpriseRenderer,T=AlpineThree,c=m.carrier,pose=new T.Group();pose.rotation.set(c.pitch*Math.PI/180,-c.heading*Math.PI/180,-c.roll,'YXZ');
   const camera=m.cameraView==='cockpit'?ship.camera:ship.excursionCamera;
   const position=camera.position.clone().applyQuaternion(pose.quaternion).add(new T.Vector3(c.x,c.z,c.y));
   const rotation=camera.quaternion.clone().premultiply(pose.quaternion);
   return {position:position.toArray(),rotation:rotation.toArray(),framing:m.cameraView==='cockpit'?[]:ship.excursionFraming.shuttle,stars,bank:m.bank,bob:m.pitchBob,heading:a.state.heading,pitch:a.state.pitch};
  });}
  const before=await snapshot();
  if(input.startsWith('Numpad'))await page.dispatchEvent('body','keydown',{code:input,key:input==='NumpadDecimal'?'.':input.slice(-1)});
  else await page.evaluate(value=>STCommand.away.setEnterprisePower(value),input==='forward'?60:-60);
  await page.evaluate(()=>{STCommand.state.paused=false;for(let n=0;n<40;n++)STCommand.tick(.05);STCommand.state.paused=true;});
  if(input.startsWith('Numpad'))await page.dispatchEvent('body','keyup',{code:input,key:input==='NumpadDecimal'?'.':input.slice(-1)});
  const after=await snapshot();const positionError=Math.max(...before.position.map((v,i)=>Math.abs(v-after.position[i]))),rotationDot=Math.abs(before.rotation.reduce((sum,v,i)=>sum+v*after.rotation[i],0)),framingError=Math.max(...before.framing.flat().map((v,i)=>Math.abs(v-after.framing.flat()[i])));
  if(positionError>=1e-5)console.log(JSON.stringify({input,look,positionError,rotationDot,framingError,before,after}));
  assert(positionError<1e-5,input+' preserves camera world position '+positionError);assert(rotationDot>1-1e-8,view+' '+input+' preserves camera orientation');assert(framingError<1e-5,input+' preserves shuttle framing '+framingError);
  assert(before.stars.length>20,'capture the '+view+' starfield');assert.equal(after.stars.length,before.stars.length,view+' '+input+' keeps the same stars visible');
  const starError=Math.max(...before.stars.flat().map((v,i)=>Math.abs(v-after.stars.flat()[i])));assert(starError<1e-5,view+' '+input+' keeps stars fixed in inertial space '+starError);results.push({view,input,look,positionError,framingError,starError});
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify(results));console.log('Passed: camera and stars stay fixed through Enterprise yaw, pitch, roll, forward and reverse motion, including mouse look.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
