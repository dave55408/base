const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:2048,height:1152}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
 assert(await page.locator('#hangar-door').isHidden());await page.locator('#stop').click();await page.locator('#launch-shuttle').click();
 await page.evaluate(()=>{STCommand.state.paused=true;STCommand.state.throttle=0;STCommand.state.speed=0;});
 const door=page.locator('#hangar-door');assert.equal(await door.textContent(),'CLOSE HANGAR DOOR');
 for(const width of [2048,1280]){await page.setViewportSize({width,height:1152});const a=await page.locator('#land-bay').boundingBox(),b=await door.boundingBox();assert(b.x>=a.x+a.width&&Math.abs(a.y-b.y)<1,'door button is immediately right of Land in Bay');}
 await page.setViewportSize({width:2048,height:1152});await door.click();assert.equal(await door.textContent(),'OPEN HANGAR DOOR');
 async function advance(frames){return page.evaluate(frames=>{const app=STCommand;for(let i=0;i<frames;i++){app.away.tick(.1);app.state.time+=.1;}app.away.updateUI();const scene=app.games[0].scene.getScene('Forward');app.away.render(scene,scene.scale.width,scene.scale.height);return {open:app.away.state.bayDoorOpen,rendered:scene.enterpriseRenderer.model.getObjectByName('shuttle-bay-clamshell-doors').userData.open};},frames);}
 const halfway=await advance(12);assert(halfway.open>.4&&halfway.open<.6,'door animates through an intermediate state');const closed=await advance(14);assert.equal(closed.open,0);assert.equal(closed.rendered,0);
 // A nearby shuttle would automatically open the doors; manual closure holds.
 assert.equal((await advance(10)).rendered,0);
 await page.locator('#enterprise-model').selectOption('original');assert.equal((await advance(1)).rendered,0,'manual setting follows model selection');
 await door.click();assert.equal(await door.textContent(),'CLOSE HANGAR DOOR');assert.equal((await advance(26)).rendered,1);
 await page.locator('#enterprise-model').selectOption('movie');assert.equal((await advance(1)).rendered,1);
 await door.click();await advance(26);
 await page.evaluate(()=>{const app=STCommand;Object.assign(app.away.state,{x:0,y:.4,z:110,target:'ship'});Object.assign(app.state,{heading:0,pitch:0,speed:0});app.away.updateUI();});
 await page.locator('.mission-console').screenshot({path:path.join(__dirname,'preview-hangar-door-control.png')});
 await page.locator('#land-bay').click();assert(await page.evaluate(()=>STCommand.away.state.hangarDoorTarget===1),'landing opens the hangar door');
 assert.equal((await advance(26)).rendered,1);
 await advance(17);assert(await door.isVisible(),'landed shuttle can close the doors');
 await page.evaluate(()=>{STCommand.away.reset();STCommand.away.updateUI();});assert(await door.isHidden());assert(await page.evaluate(()=>STCommand.away.state.hangarDoorTarget===null));
 assert.deepEqual(errors,[]);console.log('Passed: adjacent responsive button, animated toggle, persistent manual control, both models, docking reopen and sortie reset.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
