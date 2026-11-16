const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]})),{createServer}=require('./server.cjs');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
  const result=await page.evaluate(async()=>{
   const a=STCommand;a.games.forEach(g=>g.loop.stop());const scene={},ship=EnterpriseModels.rendererFor(scene);await ship.ready;
   const T=AlpineThree,port=ship.model.getObjectByName('aft-bridge-docking-port'),room=port.getObjectByName('bridge-circular-room'),info=room.userData.circularRoom;
   const p=port.localToWorld(new T.Vector3(0,info.floorY-.531+.004,info.centerZ));
   const inside={x:p.x,y:p.z,z:110+p.y},s=a.state,m=a.away.state;
   const setup=(where=inside,moving=true)=>{
    a.reset();Object.assign(s,{heading:0,pitch:0,speed:0,throttle:0,paused:false,autopilot:false});
    Object.assign(m,{phase:'flight',freeSpace:true,...where,clock:8,target:'ship',returnLeg:1,launchAttached:false,launchLiftRemaining:0,liftRemaining:0,departureRamp:false,cameraView:'cockpit',returningNeutral:false,roll:0,turnBank:0,bank:0,pitchBob:0,lastVisualPitch:0,
     carrier:{x:0,y:0,z:0,heading:25,pitch:12,roll:.2,manualRoll:.2,turnBank:0,manual:true,moving,speed:moving?.32:0},bridgeState:{...s,heading:90,pitch:0,roll:.2,throttle:moving?40:0,speed:moving?3.2:0}});
   };
   const snapshot=()=>({position:[m.x,m.y,m.z],heading:s.heading,pitch:s.pitch,bank:m.bank});
   const advance=seconds=>{for(let i=0;i<Math.round(seconds/.01);i++)a.tick(.01);};
   const key=(code,key,type='keydown')=>window.dispatchEvent(new KeyboardEvent(type,{code,key,bubbles:true}));
   const world=()=>{const c=m.carrier,pose=new T.Group();pose.rotation.set(c.pitch*Math.PI/180,-c.heading*Math.PI/180,-c.roll,'YXZ');return new T.Vector3(m.x,m.z-110,m.y).applyQuaternion(pose.quaternion).add(new T.Vector3(c.x,c.z,c.y)).toArray();};
   setup();const detected=EnterpriseModels.isInsideBridge(m),before=snapshot(),worldBefore=world();advance(1);const translated=snapshot(),worldAfter=world();
   key('Numpad9','9');key('Numpad8','8');key('NumpadDecimal','.');key('NumpadSubtract','-');advance(.6);
   key('Numpad9','9','keyup');key('Numpad8','8','keyup');key('NumpadDecimal','.','keyup');key('NumpadSubtract','-','keyup');const turning=snapshot(),carrierAfter={...m.carrier};
   setup(inside,false);s.throttle=.5;s.heading=90;s.pitch=5;const localStart=snapshot();advance(.4);const stoppedWalk=snapshot();
   setup();s.throttle=.5;s.heading=90;s.pitch=5;advance(.4);const movingWalk=snapshot(),stillInside=EnterpriseModels.isInsideBridge(m);
   setup({x:.2,y:1,z:110.4});const outsideDetected=EnterpriseModels.isInsideBridge(m),outsideBefore=world();advance(.5);const outsideAfter=world();
   setup();const paused=snapshot(),pausedCarrier={...m.carrier};s.paused=true;a.tick(.5);const pauseStable=JSON.stringify(paused)===JSON.stringify(snapshot())&&JSON.stringify(pausedCarrier)===JSON.stringify(m.carrier);
   ship.dispose();return {detected,before,translated,turning,worldBefore,worldAfter,carrierAfter,localStart,stoppedWalk,movingWalk,stillInside,outsideDetected,outsideBefore,outsideAfter,pauseStable};
  });
  assert(result.detected&&result.stillInside);assert.deepEqual(result.translated,result.before);assert.deepEqual(result.turning,result.before);
  assert(result.worldAfter.some((v,i)=>Math.abs(v-result.worldBefore[i])>.01),'occupant travels with Enterprise');
  assert(result.carrierAfter.heading>25&&result.carrierAfter.pitch>12&&result.carrierAfter.roll>.2);
  assert.deepEqual(result.stoppedWalk,result.movingWalk,'local movement must be identical while Enterprise moves');assert(result.movingWalk.position[0]>result.localStart.position[0]);
  assert(!result.outsideDetected);assert(result.outsideAfter.every((v,i)=>Math.abs(v-result.outsideBefore[i])<1e-8),'exterior flight stays inertial');assert(result.pauseStable);assert.deepEqual(errors,[]);
  console.log('Passed: bridge occupants follow Enterprise translation, turns, pitch and roll; local movement stays relative; exterior flight and pause are preserved.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
