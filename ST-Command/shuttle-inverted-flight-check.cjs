const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]})),{createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
 await page.evaluate(()=>{for(const game of STCommand.games)game.loop.stop();STCommand.away.launchShuttle();const m=STCommand.away.state;Object.assign(m,{x:3,y:4,z:111,clock:10,launchAttached:false,launchLiftRemaining:0,departureCameraPending:false,departureCameraFade:null,entranceCameraFade:null,departureRamp:false,cameraView:'cockpit',lookYaw:0,lookPitch:0});Object.assign(STCommand.state,{heading:0,pitch:0,throttle:20,speed:0,autopilot:false,paused:false});m.carrier.manual=false;m.carrier.moving=false;});
 for(const key of ['q','e','z','x']){
  const before=await page.evaluate(()=>({heading:STCommand.state.heading,pitch:STCommand.state.pitch,roll:STCommand.away.state.roll}));
  await page.keyboard.down(key);await page.evaluate(()=>STCommand.away.tick(.1));await page.keyboard.up(key);
  assert.deepEqual(await page.evaluate(()=>({heading:STCommand.state.heading,pitch:STCommand.state.pitch,roll:STCommand.away.state.roll})),before,key+' no longer steers the shuttle');
 }
 for(const [key,sign] of [['a',-1],['d',1]]){
  await page.evaluate(()=>{STCommand.away.state.roll=0;STCommand.away.state.bank=0;});
  const heading=await page.evaluate(()=>STCommand.state.heading);
  await page.keyboard.down(key);await page.evaluate(()=>STCommand.away.tick(.1));await page.keyboard.up(key);
  assert(await page.evaluate(sign=>STCommand.away.state.roll*sign>.01,sign),key+' rolls in the requested direction');
  assert.equal(await page.evaluate(()=>STCommand.state.heading),heading,key+' does not yaw');
 }
 await page.evaluate(()=>{STCommand.away.state.roll=0;STCommand.away.state.bank=0;});
 const tick=()=>page.evaluate(()=>{for(let i=0;i<120;i++)STCommand.away.tick(.05);});
 await page.keyboard.down('ArrowDown');await tick();await page.keyboard.up('ArrowDown');
 const inverted=await page.evaluate(()=>({pitch:STCommand.state.pitch,roll:STCommand.away.state.roll,y:STCommand.away.state.y}));
 assert(Math.abs(inverted.pitch)<1e-7&&Math.cos(inverted.roll)<-.999,'pitch through vertical into inverted flight');
 await page.evaluate(()=>{for(let i=0;i<20;i++)STCommand.away.tick(.05);});
 assert(await page.evaluate(y=>STCommand.away.state.y>y&&Math.cos(STCommand.away.state.roll)<-.999,inverted.y),'inverted flight holds and moves along the nose');
 await page.keyboard.down('ArrowDown');await tick();await page.keyboard.up('ArrowDown');
 assert(await page.evaluate(()=>Math.abs(STCommand.state.pitch)<1e-7&&Math.cos(STCommand.away.state.roll)>.999),'second half of loop returns upright');
 await page.keyboard.down('a');await tick();await page.keyboard.up('a');
 await page.evaluate(()=>{STCommand.away.state.roll=Math.PI;STCommand.away.state.bank=Math.PI;STCommand.state.pitch=0;});
 await page.keyboard.down('ArrowDown');await page.evaluate(()=>STCommand.away.tick(.1));await page.keyboard.up('ArrowDown');
 assert(await page.evaluate(()=>STCommand.state.pitch<0),'inverted pitch follows the shuttle up vector');
 const camera=await page.evaluate(async()=>{const a=STCommand,m=a.away.state,T=AlpineThree,ship=EnterpriseModels.rendererFor(a.games[0].scene.getScene('Forward'));await ship.ready;const ctx=document.createElement('canvas').getContext('2d');Object.assign(a.state,{heading:37,pitch:90});Object.assign(m,{roll:0,bank:0,pitchBob:0,cameraView:'cockpit'});ship.draw(ctx,640,360,m,a.state);const direction=ship.camera.getWorldDirection(new T.Vector3()),up=new T.Vector3(0,1,0).applyQuaternion(ship.camera.quaternion);m.cameraView='excursion';ship.draw(ctx,640,360,m,a.state);const craftUp=new T.Vector3(0,1,0).applyQuaternion(ship.excursionShuttle.quaternion);return {vertical:direction.y,match:up.dot(craftUp),glError:ship.renderer.getContext().getError()};});
 assert(camera.vertical>.99999&&camera.match>.99999,'cockpit and craft agree through vertical');assert.equal(camera.glError,0);assert.deepEqual(errors,[]);
 console.log('Passed: full pitch loop, sustained inverted flight, inverted pitch controls, roll, and cockpit/model alignment at vertical.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
