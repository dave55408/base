const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
 await page.evaluate(()=>{STCommand.stop();STCommand.away.launchShuttle();STCommand.state.paused=true;for(const game of STCommand.games)game.loop.stop();});
 for(const model of ['movie','original']){
  await page.locator('#enterprise-model').selectOption(model);
  for(const [key,sign] of [['ArrowLeft',-1],['ArrowRight',1],['z',-1],['x',1]]){
   await page.evaluate(model=>{const a=STCommand,m=a.away.state;Object.assign(a.state,{paused:true,heading:model==='movie'?0:180,pitch:0,throttle:0,speed:0,autopilot:false});Object.assign(m,{phase:'flight',x:.3,y:1,z:110.3,roll:0,bank:0,turnBank:0,pitchBob:0,lastVisualPitch:0,departureRamp:false,launchAttached:false,launchStage:null,launchLiftRemaining:0,departureCameraPending:false,departureCameraFade:null,entranceCameraPose:null,entranceCameraFade:null,landingChoicePending:false,lookYaw:0,lookPitch:0,cameraZoom:1});Object.assign(m.carrier,{manual:true,heading:0,pitch:0,roll:0,manualRoll:0,turnBank:0,returningNeutral:false,speed:0,moving:false});Object.assign(m.bridgeState,{throttle:0,speed:0});},model);
   await page.dispatchEvent('body','keydown',{key,code:key.length===1?'Key'+key.toUpperCase():key});await page.evaluate(()=>{for(let i=0;i<10;i++)STCommand.away.tick(.05);});await page.dispatchEvent('body','keyup',{key,code:key.length===1?'Key'+key.toUpperCase():key});
   const result=await page.evaluate(async()=>{
    const a=STCommand,m=a.away.state,s=a.state,T=AlpineThree,renderer=EnterpriseModels.rendererFor(a.games[0].scene.getScene('Forward'));await renderer.ready;
    const context=document.createElement('canvas').getContext('2d'),h=s.heading*Math.PI/180,right=new T.Vector3(Math.cos(h),0,Math.sin(h));
    m.cameraView='cockpit';renderer.draw(context,640,360,m,s);const cockpit=new T.Vector3(0,1,0).applyQuaternion(renderer.camera.quaternion).dot(right);
    m.cameraView='excursion';renderer.draw(context,640,360,m,s);const exterior=new T.Vector3(0,1,0).applyQuaternion(renderer.excursionShuttle.quaternion).dot(right);
    return {bank:m.bank,cockpit,exterior};
   });
   assert(result.bank*sign>.03,model+' '+key+' banks in the commanded direction');
   assert(result.cockpit*sign>.03&&result.exterior*sign>.03,model+' '+key+' cockpit and exterior lean into the commanded bank: '+JSON.stringify(result));
   assert(Math.abs(result.cockpit-result.exterior)<1e-7,'cockpit and shuttle model agree');
  }
 }
 assert.deepEqual(errors,[]);console.log('Passed: left/right steering and Z/X roll bank in the correct direction in cockpit and exterior views for both Enterprise models.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
