const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:2048,height:1152}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(game=>game.isBooted));
 const styles=()=>page.evaluate(()=>Object.fromEntries(['#impulse','#engage','#stop','.power-dial','.compass','#throttle','#destination','#project-notes-open','.helm'].map(selector=>{const style=getComputedStyle(document.querySelector(selector));return [selector,{background:style.backgroundImage,color:style.color,border:style.borderColor}];})));
 const bridge=await styles();await page.locator('#launch-shuttle').click();await page.evaluate(()=>{STCommand.state.paused=true;for(const game of STCommand.games)game.loop.stop();});
 assert(await page.locator('body').evaluate(body=>body.classList.contains('shuttle-mode')));const shuttle=await styles();
 for(const selector of Object.keys(bridge))assert.notEqual(shuttle[selector].background,bridge[selector].background,selector+' switches to the shuttle palette');
 const labels=await page.locator('.section-label,.select-label').evaluateAll(elements=>elements.map(element=>getComputedStyle(element).color.match(/\d+/g).map(Number)));
 assert(labels.every(([r,g,b])=>r>b&&g>b),'control labels remain amber');
 const captions=await page.locator('button,.heading-control button small').evaluateAll(elements=>elements.map(element=>getComputedStyle(element).color));assert(captions.every(color=>color==='rgb(255, 255, 255)'),'shuttle button captions are white');
 const value=await page.locator('#throttle-output').evaluate(element=>getComputedStyle(element).color.match(/\d+/g).map(Number));assert(value[2]>value[0],'readouts use cool blue');
 if(process.argv.includes('--preview')){const file=path.join(os.tmpdir(),'st-command-shuttle-blue.png');await page.screenshot({path:file,fullPage:true});console.log('Preview: '+file);}
 await page.setViewportSize({width:390,height:844});assert(await page.locator('#stop').isVisible());assert(await page.locator('#engage').isVisible());
 await page.evaluate(()=>{const a=STCommand,m=a.away.state;Object.assign(m,{phase:'landed',landingChoicePending:false,landingCameraFade:null,landing:{pad:{x:m.x,y:m.y,z:m.z},heading:180,pitch:0,bank:0}});a.away.powerDown();for(let i=0;i<65;i++)a.away.tick(.05);a.away.updateUI();});
 assert(!await page.locator('body').evaluate(body=>body.classList.contains('shuttle-mode')));assert.deepEqual(await styles(),bridge,'bridge colors restore after shuttle power-down');assert.deepEqual(errors,[]);
 console.log('Passed: shuttle-only blue buttons, dials, sliders and selectors; amber labels and blue readouts; mobile controls; bridge palette restored after power-down.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(error=>{console.error(error);process.exitCode=1;});
