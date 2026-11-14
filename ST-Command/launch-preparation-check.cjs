const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]})),{createServer}=require('./server.cjs');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  await page.addInitScript(model=>localStorage.setItem('st-command-enterprise-model',model),process.argv[2]||'movie');
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram|preparation|Launch renderer/i.test(m.text()))errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
  await page.evaluate(()=>{for(const game of STCommand.games)game.loop.stop();STCommand.stop();});
  await page.locator('#launch-shuttle').click();
  assert(await page.locator('#launch-shuttle').isDisabled());
  assert.equal(await page.evaluate(()=>STCommand.away.state.phase),'bridge','hold on the bridge until graphics are ready');
  await page.waitForFunction(()=>STCommand.away.state.phase==='flight',null,{timeout:180000});
  const checks=await page.evaluate(async()=>{
   const sim=STCommand,m=sim.away.state,scene=sim.games[0].scene.getScene('Forward'),ship=EnterpriseModels.rendererFor(scene),ctx=document.createElement('canvas').getContext('2d'),out=[];
   if(m.launchLiftRemaining!==1.5||m.z!==ShuttleBayFlight.padRoot(180).z)throw Error('Preparation must not consume liftoff time');
   if(!ship.launchWarmKey||!ship.excursionShuttle)throw Error('Craft and launch graphics must be prepared');
   const startPrograms=ship.renderer.info.programs.length,heights=[],times=[];ship.renderer.info.autoReset=false;
   function draw(){ship.renderer.info.reset();const start=performance.now();ship.draw(ctx,scene.scale.width,scene.scale.height,m,{...sim.state,bayDoorOpen:1});return {ms:performance.now()-start,calls:ship.renderer.info.render.calls,triangles:ship.renderer.info.render.triangles};}
   for(let i=0;i<12;i++){await new Promise(requestAnimationFrame);const result=draw();times.push(result.ms);heights.push(m.z);sim.tick(1/60);}
   if(ship.renderer.info.programs.length!==startPrograms)throw Error('Liftoff must not compile new shader programs');
   if(heights.some((h,i)=>i&&h<=heights[i-1]))throw Error('Lift must progress smoothly');
   const optimized=draw(),sun=ship.scene.getObjectByName('space-key'),bay=ship.model.getObjectByName('bay-interior-key'),culled=ship.launchCulledMeshes;
   window.launchPreview=ship.renderer.domElement.toDataURL('image/png');
   if(sun.castShadow||!bay.visible||!bay.castShadow||culled<10)throw Error('Launch must retain local shadows and skip distant geometry/exterior shadows');
   const hidden=[];ship.model.traverse(o=>{if(o.isMesh)hidden.push([o,o.visible]);});
   ship.launchOptimizationEnabled=false;draw();const baseline=draw();ship.launchOptimizationEnabled=true;draw();
   if(hidden.some(([o,visible])=>o.visible!==visible))throw Error('Launch culling must restore visibility after each render');
   if(optimized.calls>=baseline.calls||optimized.triangles>=baseline.triangles)throw Error('Launch rendering must submit less work');
   const start=performance.now();await EnterpriseModels.prepareLaunch(scene,scene.scale.width,scene.scale.height);const cachedMs=performance.now()-start;
   if(cachedMs>100)throw Error('Prepared graphics should be reused for another launch');
   const exterior={...m,x:.25,y:.8,z:110.3,departureCameraPending:false};ship.draw(ctx,800,450,exterior,sim.state);
   if(ship.launchRendering||ship.launchCulledMeshes||!sun.castShadow)throw Error('Normal rendering must resume outside the bay');
   out.push({model:EnterpriseModels.selected,programs:startPrograms,liftFrameMs:times.map(v=>Math.round(v)),optimized,baseline,culled,cachedMs,glError:ship.renderer.getContext().getError()});
   return out;
  });
  fs.writeFileSync(path.join(os.tmpdir(),'st-command-prepared-launch.png'),Buffer.from((await page.evaluate(()=>launchPreview)).split(',')[1],'base64'));
  assert.equal(checks[0].glError,0);assert.deepEqual(errors,[]);console.log(JSON.stringify(checks));
  // Canceling a queued launch must never start a sortie later.
  await page.evaluate(()=>{STCommand.reset();EnterpriseModels.prepareLaunch=()=>new Promise(resolve=>{window.finishLaunchPreparation=resolve;});});
  await page.locator('#launch-shuttle').click();await page.waitForFunction(()=>!!window.finishLaunchPreparation);
  await page.keyboard.press('r');await page.evaluate(()=>finishLaunchPreparation());
  await page.waitForFunction(()=>!document.getElementById('launch-shuttle').disabled);
  assert.equal(await page.evaluate(()=>STCommand.away.state.phase),'bridge');
  console.log('Passed: preparation gates liftoff, shaders stay warm, launch work decreases, normal rendering returns, cached relaunch and reset cancellation.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
