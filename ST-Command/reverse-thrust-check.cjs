const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:2048,height:1152}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
 await page.locator('#stop').click();await page.evaluate(()=>{Object.assign(STCommand.state,{paused:true,x:500,y:500,z:0,heading:90,pitch:20,throttle:50,speed:2,drive:'impulse'});});
 await page.locator('#throttle').fill('-50');assert.equal(await page.evaluate(()=>STCommand.state.speed),2,'power input preserves forward momentum');
 assert.equal(await page.locator('#throttle-output').textContent(),'-50%');
 const bridge=await page.evaluate(()=>{const s=STCommand.state,before={x:s.x,z:s.z},history=[];s.paused=false;for(let n=0;n<50;n++){STCommand.tick(.05);history.push(s.speed);}s.paused=true;return {before,x:s.x,z:s.z,heading:s.heading,pitch:s.pitch,history};});
 const firstReverse=bridge.history.findIndex(v=>v<0);assert(firstReverse>0&&bridge.history[firstReverse-1]===0,'forward momentum reaches zero before reversing');
 assert(bridge.x<bridge.before.x&&bridge.z<bridge.before.z,'reverse moves opposite the unchanged 3D heading/pitch');assert.equal(bridge.heading,90);assert.equal(bridge.pitch,20);
 assert.equal(await page.locator('#eta').textContent(),'REVERSING');assert.equal(await page.locator('#power-dial-mode').textContent(),'REV IMPULSE');
 await page.locator('#stop').click();assert.equal(await page.evaluate(()=>STCommand.state.speed),0);
 // Keyboard can cross zero; All Stop remains an immediate brake.
 await page.locator('#throttle').focus();await page.keyboard.down('s');await page.evaluate(()=>{STCommand.state.paused=false;STCommand.tick(.2);STCommand.state.paused=true;});await page.keyboard.up('s');
 assert(await page.evaluate(()=>STCommand.state.throttle<0&&STCommand.state.speed<0),'S selects astern below zero with slider focused');await page.locator('#stop').click();
 await page.locator('#launch-shuttle').click();await page.evaluate(()=>{STCommand.state.paused=true;Object.assign(STCommand.state,{heading:0,pitch:0,speed:.4,throttle:100});});
 await page.locator('#throttle').fill('-50');assert.equal(await page.evaluate(()=>STCommand.state.speed),.4,'shuttle power input does not flip momentum');
 const shuttle=await page.evaluate(()=>{const s=STCommand.state,m=STCommand.away.state,history=[];s.paused=false;for(let n=0;n<80;n++){STCommand.tick(.05);history.push(s.speed);}const before=m.y;for(let n=0;n<20;n++)STCommand.tick(.05);s.paused=true;return {history,before,y:m.y,speed:s.speed,heading:s.heading,bank:m.bank};});
 const reverse=shuttle.history.findIndex(v=>v<0);assert(reverse>0&&shuttle.history[reverse-1]===0);assert(shuttle.y>shuttle.before&&shuttle.speed<0);assert.equal(shuttle.heading,0);assert.equal(shuttle.bank,0);
 await page.locator('#stop').click();const dial=await page.locator('#power-dial').boundingBox();
 await page.mouse.move(dial.x+dial.width/2,dial.y+dial.height/2);await page.mouse.down();await page.mouse.move(dial.x+dial.width/2,dial.y+dial.height/2+35,{steps:5});await page.mouse.up();
 assert(await page.evaluate(()=>STCommand.state.throttle<0),'dragging the power dial below zero selects reverse');
 await page.evaluate(()=>{Object.assign(STCommand.away.state,{x:0,y:.4,z:110,phase:'flight',target:'ship'});Object.assign(STCommand.state,{paused:false,heading:0,pitch:0,throttle:-100,speed:-.4});STCommand.tick(.001);STCommand.state.paused=true;});
 assert(await page.locator('#land-bay').isDisabled(),'reverse speed also obeys docking speed limit');await page.evaluate(()=>STCommand.away.dock());assert.equal(await page.evaluate(()=>STCommand.away.state.phase),'flight','direct docking gate rejects fast reverse movement');
 await page.locator('#stop').click();assert.equal(await page.evaluate(()=>STCommand.state.speed),0);
 assert.deepEqual(errors,[]);console.log('Passed: signed slider/dial/keyboard power, forward braking through zero, ship and shuttle reverse travel, unchanged attitude, immediate stop and reverse docking speed limit.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});

