const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(game=>game.isBooted));
 await page.evaluate(()=>{STCommand.stop();STCommand.away.launchShuttle();STCommand.state.paused=true;for(const game of STCommand.games)game.loop.stop();});
 for(const model of ['movie','original','third']){
  await page.locator('#enterprise-model').selectOption(model);
  for(const [code,key,field,sign] of [['Numpad1','1','turnBank',-1],['Numpad3','3','turnBank',1],['Numpad0','0','manualRoll',-1],['NumpadDecimal','.','manualRoll',1]]){
   const before=await page.evaluate(async()=>{
    const a=STCommand,m=a.away.state,s=a.state;Object.assign(s,{paused:true,heading:180,pitch:0,throttle:0,speed:0,autopilot:false});Object.assign(m,{phase:'flight',freeSpace:true,cameraView:'cockpit',x:.2,y:.8,z:110.3,bank:0,roll:0,turnBank:0,pitchBob:0,lastVisualPitch:0,departureRamp:false,launchStage:null,launchLiftRemaining:0,departureCameraPending:false,departureCameraFade:null,entranceCameraFade:null,landingChoicePending:false,lookYaw:0,lookPitch:0,cameraZoom:1});Object.assign(m.carrier,{x:0,y:0,z:0,heading:0,pitch:0,roll:0,manualRoll:0,turnBank:0,speed:0,moving:false,manual:false});Object.assign(m.bridgeState,{heading:90,pitch:0,throttle:0,speed:0,roll:0});
    const renderer=EnterpriseModels.rendererFor(a.games[0].scene.getScene('Forward'));await renderer.ready;const context=document.createElement('canvas').getContext('2d');
    window.bankFrame=()=>{
     renderer.draw(context,640,360,m,s);renderer.camera.updateWorldMatrix(true,false);
     const T=AlpineThree,c=m.carrier,pivot=new T.Group();pivot.rotation.set(c.pitch*Math.PI/180,-c.heading*Math.PI/180,-c.roll,'YXZ');
     return {up:new T.Vector3(0,1,0).applyQuaternion(renderer.camera.quaternion).applyQuaternion(pivot.quaternion).toArray(),nose:new T.Vector3(0,0,-1).applyQuaternion(renderer.camera.quaternion).applyQuaternion(pivot.quaternion).toArray(),carrier:{...c},bank:m.bank};
    };return bankFrame();
   });
   await page.dispatchEvent('body','keydown',{code,key});await page.evaluate(()=>{for(let i=0;i<20;i++)STCommand.away.tick(.05);});await page.dispatchEvent('body','keyup',{code,key});
   const after=await page.evaluate(()=>bankFrame());assert(after.carrier[field]*sign>0,code+' banks or rolls in commanded direction');
   for(const axis of ['up','nose'])assert(after[axis].every((value,i)=>Math.abs(value-before[axis][i])<1e-7),model+' main cockpit preserves inertial '+axis+' while Enterprise '+code+' matches tactical attitude');
  }
 }
 assert.deepEqual(errors,[]);console.log('Passed: both main-view renderers match tactical carrier attitude for left/right turn banking and left/right manual roll, preserving shuttle camera world up and heading.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(error=>{console.error(error);process.exitCode=1;});
