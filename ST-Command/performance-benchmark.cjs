const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
  const results=await page.evaluate(async()=>{
   for(const game of STCommand.games)game.loop.stop();NightMode.enabled=false;
   const scene=STCommand.games[0].scene.getScene('Forward'),ship=EnterpriseModels.rendererFor(scene);await ship.ready;
   const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d'),gl=ship.renderer.getContext(),results=[];
   const debug=gl.getExtension('WEBGL_debug_renderer_info'),device=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
   for(const quality of window.SimPerformance?['full','balanced','economy']:['baseline']){
    if(window.SimPerformance)SimPerformance.quality=quality;
    for(const [view,pose]of [
     ['exterior',{x:.25,y:.8,z:110.3,cameraView:'excursion',garageDoorOpen:0}],
     ['garage',{x:0,y:-.20,z:110.009,cameraView:'cockpit',garageDoorOpen:1}],
     ['distant',{x:.3,y:8,z:110.1,cameraView:'cockpit',garageDoorOpen:0}]
    ]){
     const m={phase:'flight',clock:20,freeSpace:true,bank:0,...pose},s={heading:0,pitch:0,time:20,bayDoorOpen:1};
     ship.renderer.info.autoReset=false;const samples=[];
     for(let frame=0;frame<7;frame++){
      await new Promise(requestAnimationFrame);ship.renderer.info.reset();const start=performance.now();
      ship.draw(ctx,1280,720,m,{...s,time:20+frame/60});gl.finish();
      if(frame>=3)samples.push({ms:performance.now()-start,calls:ship.renderer.info.render.calls,triangles:ship.renderer.info.render.triangles});
     }
     samples.sort((a,b)=>a.ms-b.ms);const median=samples[Math.floor(samples.length/2)];
     results.push({quality,view,...median,width:ship.renderer.domElement.width,height:ship.renderer.domElement.height});
    }
   }
   return {device,results,glError:gl.getError()};
  });
  assert.equal(results.glError,0);assert.deepEqual(errors,[]);
  const destination=process.argv[2]||path.join(require('node:os').tmpdir(),'st-command-performance.json');fs.writeFileSync(destination,JSON.stringify(results,null,2));console.log(JSON.stringify(results));console.log(destination);
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
