const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
 const result=await page.evaluate(async()=>{
  const a=STCommand,m=a.away.state,s=a.state,out=[],scene=a.games[0].scene.getScene('Forward');s.throttle=0;a.away.launchShuttle();s.paused=true;for(const game of a.games)game.loop.stop();
  const sheet=document.createElement('canvas');sheet.width=2400;sheet.height=1000;const ctx=sheet.getContext('2d');
  function check(name,ok){out.push({name,ok});}
  function step(seconds){const n=Math.ceil(seconds/.05);for(let i=0;i<n;i++)a.away.tick(seconds/n);a.away.updateUI();}
  async function frame(){a.away.render(scene,800,500);const ship=scene.enterpriseRenderer;await ship.ready;a.away.render(scene,800,500);return {camera:[...ship.excursionCamera.position.toArray(),...ship.excursionCamera.quaternion.toArray()],craft:ship.excursionShuttle?.quaternion.toArray(),fixed:!!ship.excursionFraming?.fixedBayCamera,glError:ship.renderer.getContext().getError()};}
  function image(row,col,label){ctx.drawImage(scene.awayTexture.getCanvas(),col*800,row*500,800,500);ctx.fillStyle='#dfd2b6';ctx.font='15px Consolas';ctx.fillText(label,col*800+14,row*500+24);}
  for(const [row,model] of ['movie','original'].entries()){
   EnterpriseModels.selected=model;const b=ShuttleBayFlight.dimensions();
function place(extra={},helm={}){Object.assign(m,{phase:'flight',freeSpace:true,target:'ship',cameraView:'cockpit',x:.01,y:-.14,z:b.floor+.02,bank:0,roll:0,turnBank:0,pitchBob:0,lastVisualPitch:0,cockpitFromBerth:false,landing:null,liftRemaining:0,departureRamp:false,...extra});Object.assign(s,{paused:true,heading:0,pitch:0,speed:0,throttle:0,autopilot:false,...helm});Object.assign(m.carrier,{x:0,y:0,z:0,heading:0,pitch:0,roll:0,manualRoll:0,turnBank:0,speed:0,moving:false,manual:true});a.away.updateUI();}
   place({y:b.mouth+.0035});step(.01);check(model+' remains cockpit beyond 10 feet',m.cameraView==='cockpit');
   place({y:b.mouth+.0029});step(.01);check(model+' switches within 10 feet',m.cameraView==='excursion');
   place({y:b.mouth+.02},{heading:0,speed:.4,throttle:100});step(.1);check(model+' swept approach cannot skip camera threshold',m.cameraView==='excursion');
   place({x:.5,y:b.mouth+.002});step(.01);check(model+' off-axis flight does not trigger bay camera',m.cameraView==='cockpit');
   for(const test of [{name:'distant',pose:{y:800}},{name:'outside entrance',pose:{y:.1}},{name:'off center',pose:{x:.2}},{name:'behind wall',pose:{y:-.4}},{name:'above ceiling',pose:{z:b.ceiling+.02}},{name:'too fast',helm:{speed:.2}},{name:'inverted',pose:{bank:Math.PI}},{name:'steep',helm:{pitch:50}}]){place(test.pose,test.helm);a.away.dock();check(model+' rejects '+test.name,m.phase==='flight');}
   place();await frame();m.cameraView='excursion';const fixed=await frame();
   s.heading=90;m.x=-.01;const rotating=await frame();check(model+' fixed bay camera allows independent rotation',fixed.fixed&&rotating.fixed&&JSON.stringify(fixed.camera)===JSON.stringify(rotating.camera)&&JSON.stringify(fixed.craft)!==JSON.stringify(rotating.craft));
   s.heading=180;m.x=.01;m.y=-.14;a.away.dock();s.paused=true;check(model+' hover landing begins',m.phase==='docking'&&m.cameraView==='excursion');const z=m.z;step(.9);check(model+' lowers gradually without turning',m.z<z&&m.z>b.floor&&s.heading===180);const mid=await frame();check(model+' camera stays fixed during descent',JSON.stringify(mid.camera)===JSON.stringify(fixed.camera));const pausedClock=m.clock;a.tick(1);check(model+' pause freezes descent',m.clock===pausedClock);step(1);check(model+' touches down',m.phase==='landed'&&Math.abs(m.z-b.floor)<1e-8&&s.heading===180&&m.x===.01&&m.y===-.14);
   s.throttle=10;step(.05);check(model+' remains secured until launch choice',m.phase==='landed'&&s.throttle===0);step(.5);document.getElementById('shuttle-choice-launch').click();check(model+' Launch Again lifts off',m.phase==='flight'&&m.cameraView==='excursion');
   place({x:.025,y:-.17,z:b.floor+.025});await frame();m.cameraView='excursion';const before=await frame();a.away.dock();s.paused=true;image(row,0,model+' / LANDING START');step(1.2);const centered=ShuttleBayFlight.padRoot(0);check(model+' centers over circular pad before descent',Math.abs(m.x-centered.x)<1e-8&&Math.abs(m.y-centered.y)<1e-8);step(1.6);check(model+' lands before rotating',Math.abs(m.z-b.floor)<1e-8&&Math.abs(s.heading)<1e-6&&m.phase==='docking');await frame();image(row,1,model+' / ON PAD');step(1.25);check(model+' rotates on deck',Math.abs(s.heading-90)<1e-5&&Math.abs(m.z-b.floor)<1e-8);const turned=await frame();check(model+' camera holds through pad rotation',JSON.stringify(turned.camera)===JSON.stringify(before.camera));step(1.3);const pad=ShuttleBayFlight.padRoot(180);check(model+' finishes on pad facing bay exit',m.phase==='landed'&&s.heading===180&&Math.abs(m.x-pad.x)<1e-8&&Math.abs(m.y-pad.y)<1e-8&&Math.abs(m.z-pad.z)<1e-8);const landed=await frame();image(row,2,model+' / FACING EXIT');check(model+' rendered without WebGL errors',landed.glError===0);
   a.away.powerDown();step(3.1);check(model+' shutdown returns bridge',m.phase==='bridge');s.throttle=0;a.away.launchShuttle();s.paused=true;
  }
  a.away.reset();return {checks:out,image:sheet.toDataURL('image/jpeg',.85)};
 });
 for(const r of result.checks)assert(r.ok,r.name);assert.deepEqual(errors,[]);
 console.log(process.argv.includes('--image')?'IMG:'+result.image.split(',')[1]:'Passed: 10-foot and swept camera transition, stationary bay camera, independent shuttle rotation, hover descent, circular-pad touchdown and turn to exit, pause, relaunch, shutdown and both models.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
