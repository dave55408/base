const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  const url='http://127.0.0.1:'+server.address().port;await page.goto(url);
  const result=await page.evaluate(async()=>{
   const scene={},c=document.createElement('canvas');c.width=640;c.height=360;const ctx=c.getContext('2d');
   const render=ship=>ship.draw(ctx,640,360,{x:1,y:1,z:111},{heading:0,pitch:0,time:0,bayDoorOpen:0});
   const setQuality=value=>{const input=document.getElementById('texture-quality');input.value=value;input.dispatchEvent(new Event('change'));};
   const bytes=maps=>Object.values(maps).reduce((sum,t)=>sum+(t?.isTexture?t.image.width*t.image.height*4:0),0);
   EnterpriseModels.selected='movie';setQuality('high');
   let ship=EnterpriseModels.rendererFor(scene);await ship.ready;const highBytes=bytes(enterpriseMovieMaps);render(ship);
   const oldCanvas=enterpriseMovieMaps.top.image;setQuality('low');
   const released=oldCanvas.width===1&&ship.scene.children.length===0&&ship.renderer.domElement.width===1;
   ship=EnterpriseModels.rendererFor(scene);await ship.ready;render(ship);const lowBytes=bytes(enterpriseMovieMaps),registryWidth=enterpriseMovieMaps.registry.image.width;
   const cycles=[];
   for(let i=0;i<6;i++){
    const previous=ship;EnterpriseModels.selected=i%2?'movie':'original';ship=EnterpriseModels.rendererFor(scene);
    // Alternate immediate disposal with ready-first disposal.
    if(i%2)await ship.ready;
    cycles.push({cached:Object.keys(scene.enterpriseRenderers).length,released:previous.scene.children.length===0});
   }
   await ship.ready;render(ship);const glError=ship.renderer.getContext().getError();
   // Disposing one preview must leave its shared atlas usable in another.
   const a=createMovieEnterpriseRenderer(),b=createMovieEnterpriseRenderer();await Promise.all([a.ready,b.ready]);
   const shared=enterpriseMovieMaps.top.image;a.dispose();render(b);const sharedSurvives=shared.width>1&&b.renderer.getContext().getError()===0;b.dispose();
   EnterpriseModels.selected='original';EnterpriseModels.rendererFor(scene);setQuality('high');
   return {highBytes,lowBytes,registryWidth,released,cycles,glError,sharedSurvives};
  });
  assert(result.released);assert(result.lowBytes<result.highBytes*.35);assert.equal(result.registryWidth,2048);
  assert(result.cycles.every(c=>c.cached===1&&c.released));assert.equal(result.glError,0);assert(result.sharedSurvives);
  assert(!requests.some(url=>/original-source|movie-source|enterprise-model-sheet|enterprise-movie-orthos/.test(url)));
  await page.reload();assert.equal(await page.locator('#texture-quality').inputValue(),'high');
  await page.locator('#texture-quality').selectOption('low');await page.locator('#enterprise-chase').click();
  await page.waitForFunction(()=>STCommand.games[0].scene.getScene('Forward').enterpriseRenderers?.original);
  await page.evaluate(async()=>{await STCommand.games[0].scene.getScene('Forward').enterpriseRenderers.original.ready;});
  await page.screenshot({path:path.join(__dirname,'preview-low-memory.png')});
  await page.setViewportSize({width:430,height:900});
  assert(await page.locator('#texture-quality').isVisible());
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert(!overflow,'quality controls fit a narrow viewport');
  const local=await browser.newPage();local.on('pageerror',e=>errors.push(e.message));await local.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
  const fileResult=await local.evaluate(async()=>{const ship=createMovieEnterpriseRenderer();await ship.ready;ship.renderer.render(ship.scene,ship.camera);return {error:ship.renderer.getContext().getError(),width:enterpriseMovieMaps.top.image.width};});
  assert.equal(fileResult.error,0);assert.equal(fileResult.width,1024);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({...result,fileResult}));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
