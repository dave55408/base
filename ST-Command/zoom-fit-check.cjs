const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    const page=await browser.newPage({viewport:{width:2048,height:1152},deviceScaleFactor:1.25});
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
    async function check(phase){
      const fit=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
      assert(fit.width<=2048&&fit.height<=1152,phase+' fits the viewport');
      const helm=await page.locator('.helm').boundingBox();
      for(const selector of ['#stop','#engage','#manual','#throttle','#pitch','#destination','#launch-craft','#leave-orbit','#retrieve-beacon','#land-bay','#power-down']){
        const el=page.locator(selector);if(!await el.isVisible())continue;
        const box=await el.boundingBox();assert(box.y>=helm.y&&box.y+box.height<=helm.y+helm.height-2,phase+' '+selector+' fits inside helm');
      }
      const screen=await page.locator('.forward').boundingBox();assert(Math.abs(screen.height-1152*.575)<2,'retains the taller viewscreen');
    }
    await check('bridge');
    await page.locator('#warp').click();await page.locator('#throttle').fill('100');await page.locator('#engage').click();
    await page.evaluate(()=>{for(let n=0;n<5000&&STCommand.away.state.phase==='bridge';n++)STCommand.tick(.05);});
    await check('orbit');
    const launch=await page.locator('#launch-craft').boundingBox(),leave=await page.locator('#leave-orbit').boundingBox();
    assert(Math.abs(launch.y-leave.y)<1&&leave.x>launch.x,'Leave Orbit sits beside Launch');
    const position=await page.evaluate(()=>({x:STCommand.state.x,y:STCommand.state.y,z:STCommand.state.z}));
    await page.locator('#leave-orbit').click();
    await page.evaluate(()=>{for(let n=0;n<40;n++)STCommand.tick(.05);});
    assert.equal(await page.evaluate(()=>STCommand.away.state.phase),'bridge','leaving orbit stays in galaxy mode');
    assert.equal(await page.evaluate(()=>STCommand.state.throttle),2,'leaving orbit sets engines to 2%');
    const departureDistance=await page.evaluate(position=>SpaceMath.distance(STCommand.state,position),position);
    assert(departureDistance>0&&departureDistance<.3,'leaving orbit moves gently from the current position');
    assert.equal(await page.locator('#throttle').inputValue(),'2');
    assert.equal(await page.locator('#power-dial-value').textContent(),'2%');
    assert(await page.locator('#leave-orbit').isHidden());assert(await page.locator('#launch-craft').isHidden());
    await page.waitForFunction(()=>!STCommand.games[0].scene.getScene('Forward').awayImage.visible);
    await check('departure');
    await page.evaluate(()=>{const sim=STCommand,p=sim.state.target;sim.state.x=p.x+2;sim.tick(.05);sim.state.x=p.x+.5;sim.state.y=p.y;sim.state.z=p.z||0;sim.tick(.05);});
    assert.equal(await page.evaluate(()=>STCommand.away.state.phase),'orbit','returning to the planet can reenter orbit');
    await page.locator('#launch-craft').click();await check('shuttle');
    if(process.argv.includes('--image'))console.log((await page.screenshot({type:'jpeg',quality:50,scale:'css'})).toString('base64'));
    else console.log('Passed: bridge, orbit and shuttle controls fit 2560 x 1440 at 125% (2048 x 1152 CSS pixels).');
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
