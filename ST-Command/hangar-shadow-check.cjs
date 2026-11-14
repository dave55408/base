const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.EnterpriseModels);
 const result=await page.evaluate(async()=>{
  const out=[];let preview;
  for(const model of ['original','movie','third']){
   EnterpriseModels.selected=model;const ship=EnterpriseModels.rendererFor({}),b=ShuttleBayFlight.dimensions();await ship.ready;
   const canvas=document.createElement('canvas');canvas.width=900;canvas.height=600;const ctx=canvas.getContext('2d');
   const m={phase:'flight',freeSpace:true,cameraView:'cockpit',x:0,y:b.padY-.04,z:b.floor+.025,garageDoorOpen:0},s={heading:180,pitch:0,time:0,bayDoorOpen:1};
   const light=ship.model.getObjectByName('bay-interior-key');
   ship.draw(ctx,900,600,m,s);const enabled=light.visible&&ship.renderer.shadowMap.enabled;
   const withShadows=ctx.getImageData(0,0,900,600).data;
   if(model==='third')preview=canvas.toDataURL('image/png').split(',')[1];
   light.castShadow=false;ship.draw(ctx,900,600,m,s);const without=ctx.getImageData(0,0,900,600).data;let changed=0;
   for(let i=0;i<without.length;i+=4)if(Math.abs(withShadows[i]-without[i])+Math.abs(withShadows[i+1]-without[i+1])+Math.abs(withShadows[i+2]-without[i+2])>6)changed++;
   light.castShadow=true;ship.draw(ctx,900,600,{...m,x:4,y:4,z:114},s);
   out.push({model,enabled,changed,disabledAway:!light.visible,glError:ship.renderer.getContext().getError()});ship.dispose();
  }
  return {out,preview};
 });
 for(const r of result.out){assert(r.enabled,r.model+' enables interior shadows');assert(r.changed>100,r.model+' renders visible shadows: '+r.changed);assert(r.disabledAway);assert.equal(r.glError,0);}assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(__dirname,'preview-hangar-shadows.png'),Buffer.from(result.preview,'base64'));console.log(JSON.stringify(result.out));console.log('Passed: visible hangar shadows on all three models, cockpit activation and distant-flight deactivation.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
