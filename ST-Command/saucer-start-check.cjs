const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
  const result=await page.evaluate(()=>{
   const sim=STCommand,m=sim.away.state,s=sim.state;for(const g of sim.games)g.loop.sleep();
   const start={phase:m.phase,freeSpace:!!m.freeSpace,shuttleMode:document.body.classList.contains('shuttle-mode'),power:s.throttle,speed:s.speed,paused:s.paused,target:s.target.id,mapVisible:document.getElementById('map-view').getBoundingClientRect().width>0};
   const position=[s.x,s.y,s.z];for(let i=0;i<100;i++)sim.tick(.05);const stationary=position.every((v,i)=>v===[s.x,s.y,s.z][i]);
   sim.reset();const bridge=m.phase==='bridge'&&s.throttle===0&&s.speed===0;sim.away.launchShuttle();
   const launch={phase:m.phase,attached:m.launchAttached,y:m.y,lift:m.launchLiftRemaining,speed:s.speed};
   sim.tick(1.5);const hovering=m.launchLiftRemaining===0&&s.speed===0;
   return {start,stationary,bridge,launch,hovering};
  });
  assert.equal(result.start.phase,'bridge');assert(!result.start.freeSpace&&!result.start.shuttleMode&&result.start.mapVisible);assert.equal(result.start.power,0);assert.equal(result.start.speed,0);assert(!result.start.paused&&result.stationary);assert.equal(result.start.target,'vulcan');
  assert(result.bridge&&result.hovering);assert.equal(result.launch.phase,'flight');assert(result.launch.attached&&result.launch.y<0&&result.launch.lift===1.5&&result.launch.speed===0);
  assert.deepEqual(errors,[]);console.log('Passed: startup and reset stop Enterprise in space, idle flight stays stationary, and manual shuttle launch remains available.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
