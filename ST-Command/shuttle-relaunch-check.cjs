const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));await page.locator('#stop').click();await page.locator('#launch-shuttle').click();
 const recall=await page.evaluate(()=>{const app=STCommand,m=app.away.state,s=app.state;s.paused=true;Object.assign(m,{x:-4,y:-7,z:108,bank:Math.PI,target:'beacon'});Object.assign(s,{heading:135,pitch:-60,throttle:100,speed:.4});app.away.updateUI();const enabled=!document.getElementById('land-bay').disabled;app.away.dock();s.paused=true;const duration=m.landing.duration,route=m.landing.route.length;for(let i=0;i<Math.ceil((duration+1.3)/.05)+1;i++)app.away.tick(.05);return {enabled,route,phase:m.phase,target:m.target,pad:m.landing.pad,position:{x:m.x,y:m.y,z:m.z},speed:s.speed};});
 assert(recall.enabled&&recall.route>=3);assert.equal(recall.phase,'landed');assert.equal(recall.target,'ship');assert.deepEqual(recall.position,recall.pad);assert.equal(recall.speed,0);
 await page.locator('#throttle').fill('25');
 const powered=await page.evaluate(()=>{const a=STCommand;a.away.tick(.05);const start={phase:a.away.state.phase,y:a.away.state.y,z:a.away.state.z,heading:a.state.heading};for(let i=0;i<80;i++)a.away.tick(.05);return {start,y:a.away.state.y,z:a.away.state.z,landing:a.away.state.landing};});
 assert.equal(powered.start.phase,'flight');assert.equal(powered.start.heading,180);assert(powered.z>recall.pad.z+.015&&powered.y>0,'power raises the shuttle and carries it out of the bay');assert.equal(powered.landing,null);
 await page.evaluate(()=>{const a=STCommand;a.away.dock();a.state.paused=true;for(let i=0;i<Math.ceil((a.away.state.landing.duration+1.3)/.05)+1;i++)a.away.tick(.05);});
 await page.locator('#starboard').click();
 const attitude=await page.evaluate(()=>{const a=STCommand;a.away.tick(.05);for(let i=0;i<30;i++)a.away.tick(.05);return {phase:a.away.state.phase,z:a.away.state.z,heading:a.state.heading,speed:a.state.speed};});
 assert.equal(attitude.phase,'flight');assert.equal(attitude.heading,195);assert(attitude.z>recall.pad.z+.015);assert.equal(attitude.speed,0,'attitude input lifts into a hover without adding power');
 await page.evaluate(()=>{const a=STCommand;a.away.dock();a.state.paused=true;for(let i=0;i<Math.ceil((a.away.state.landing.duration+1.3)/.05)+1;i++)a.away.tick(.05);});
 await page.keyboard.down('ArrowUp');await page.evaluate(()=>STCommand.away.tick(.05));await page.keyboard.up('ArrowUp');assert.equal(await page.evaluate(()=>STCommand.away.state.phase),'flight','keyboard attitude also takes off');
 assert.deepEqual(errors,[]);console.log('Passed: recall from remote inverted flight, physical arrival at the rear berth, power departure, attitude hover and keyboard takeoff.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
