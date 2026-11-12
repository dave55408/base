const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(game=>game.isBooted));
 for(const model of ['movie','original']){
  await page.locator('#enterprise-model').selectOption(model);
  for(const power of [0,14]){
   const result=await page.evaluate(async power=>{
    const a=STCommand,m=a.away.state,s=a.state;a.reset();Object.assign(s,{throttle:power,speed:power/25});a.away.launchShuttle();s.paused=true;for(const game of a.games)game.loop.stop();const scene=a.games[0].scene.getScene('Forward'),anchor=m.departureCameraAnchor;
    function step(seconds){const n=Math.ceil(seconds/.05);for(let i=0;i<n;i++)a.away.tick(seconds/n);a.away.updateUI();}
    async function frame(){a.away.render(scene,640,400);await scene.enterpriseRenderer.ready;a.away.render(scene,640,400);const camera=scene.enterpriseRenderer.excursionCamera;return [...camera.position.toArray(),...camera.quaternion.toArray(),camera.fov];}
    step(power?1.6:.6);if(power){m.x=.008;m.y-=.01;s.heading=0;}
    const start={x:m.x,y:m.y,z:m.z,heading:s.heading},before=await frame();a.away.dock();s.paused=true;const simple=!!m.landing.keepLaunchCamera&&!m.landing.alignPad;
    step(.9);const middle=await frame(),descends=m.z<start.z&&m.z>ShuttleBayFlight.dimensions().floor,poseHeld=m.x===start.x&&m.y===start.y&&s.heading===start.heading;
    step(1);const after=await frame();const result={simple,descends,poseHeld,cameraFixed:JSON.stringify(before)===JSON.stringify(middle)&&JSON.stringify(before)===JSON.stringify(after),anchorKept:anchor===m.departureCameraAnchor,onDeck:m.phase==='landed'&&m.z===ShuttleBayFlight.dimensions().floor,x:m.x===start.x,y:m.y===start.y,heading:s.heading===start.heading,choice:document.getElementById('shuttle-choice').open,noCameraFade:m.landingCameraFade===null,description:document.getElementById('shuttle-choice-description').textContent.includes('back on deck')};
    document.getElementById('shuttle-choice-launch').click();s.paused=true;const relaunched=await frame();result.relaunchCameraFixed=JSON.stringify(after)===JSON.stringify(relaunched);return result;
   },power);
   assert(Object.values(result).every(Boolean),model+' / '+power+'%: '+JSON.stringify(result));await page.evaluate(()=>STCommand.reset());
  }
 }
 assert.deepEqual(errors,[]);console.log('Passed: stopped and powered launches can set back down mid-lift or from hover without translating, turning, changing the rear camera or replaying its fade; normal landed choices remain available on both models.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(error=>{console.error(error);process.exitCode=1;});
