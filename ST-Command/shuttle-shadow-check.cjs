const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1800,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
  await page.locator('#stop').click();await page.locator('#launch-shuttle').click();
  const result=await page.evaluate(async()=>{
   const a=STCommand,m=a.away.state,s=a.state,scene=a.games[0].scene.getScene('Forward'),out=[];s.paused=true;
   for(const model of ['movie','original']){
    EnterpriseModels.selected=model;
    Object.assign(s,{heading:0,pitch:0,throttle:0,speed:0});
    Object.assign(m,{phase:'flight',freeSpace:true,cameraView:'excursion',x:.025,y:-.07,z:110-(model==='original'?.04645:.0153),bank:0,lookYaw:0,lookPitch:0,cameraZoom:1});
    a.away.render(scene,1000,600);const ship=scene.enterpriseRenderer;await ship.ready;a.away.render(scene,1000,600);
    const sun=ship.scene.getObjectByName('space-key'),T=AlpineThree,expected=new T.Vector3(-6,8,4).normalize();
    for(const x of [.025,-.025]){
     m.x=x;a.away.render(scene,1000,600);
     const p=ship.excursionShuttle.position.clone().project(sun.shadow.camera);
     const direction=sun.position.clone().sub(sun.target.position).normalize();
     out.push({model,extent:sun.shadow.camera.right,inside:Math.abs(p.x)<1&&Math.abs(p.y)<1&&Math.abs(p.z)<1,directionError:direction.distanceTo(expected),mapSize:sun.shadow.mapSize.x,maxSize:ship.renderer.capabilities.maxTextureSize,glError:ship.renderer.getContext().getError()});
    }
    if(model==='movie')window.shadowPreview=scene.awayTexture.getCanvas().toDataURL('image/jpeg',.8);
    const saved={...m};Object.assign(m,{phase:'bridge',freeSpace:false});ship.draw(scene.awayTexture.getCanvas().getContext('2d'),1000,600,m,s);
    out.push({model,broadExtent:sun.shadow.camera.right});Object.assign(m,saved);
   }
   return out;
  });
  for(const row of result){
   if('broadExtent'in row){assert.equal(row.broadExtent,2.2,'bridge restores full Enterprise shadow coverage');continue;}
   assert.equal(row.extent,.35);assert(row.inside,'moving shuttle stays inside local shadow coverage');assert(row.directionError<1e-10,'shadow focus preserves sun direction');assert.equal(row.mapSize,Math.min(4096,row.maxSize));assert.equal(row.glError,0);
  }
  assert.deepEqual(errors,[]);
  if(process.argv.includes('--image'))console.log('IMG:'+await page.evaluate(()=>window.shadowPreview.split(',')[1]));
  else console.log('Passed: focused shuttle shadows track both models, preserve sun direction, respect texture limits, restore bridge coverage and render without WebGL errors.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
