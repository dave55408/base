const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async()=>{
  const T=AlpineThree,sheet=document.createElement('canvas');sheet.width=1200;sheet.height=500;const ctx=sheet.getContext('2d'),checks=[];
  for(const [i,factory] of [createMovieEnterpriseRenderer,createEnterpriseRenderer].entries()){
   const ship=factory();await ship.ready;ship.setBayDoorOpen(1);ship.model.updateWorldMatrix(true,true);const halos=[];
   ship.model.traverse(o=>{if(o.name.endsWith('-light-glow')&&/hangar|shuttle-bay/.test(o.name))halos.push(o);});
   const camera=new T.OrthographicCamera(-.15,.15,.125,-.125,.001,100);camera.position.copy(ship.model.localToWorld(new T.Vector3(0,.025,.65)));camera.lookAt(ship.model.localToWorld(new T.Vector3(0,.025,.04)));camera.updateWorldMatrix(true,false);ship.renderer.setSize(600,500,false);
   const frame=()=>{ship.renderer.render(ship.scene,camera);const canvas=document.createElement('canvas');canvas.width=600;canvas.height=500;const c=canvas.getContext('2d');c.drawImage(ship.renderer.domElement,0,0);return {canvas,pixels:c.getImageData(0,0,600,500).data};};
   const on=frame(),red=ship.model.getObjectByName('port-hangar-red-light'),green=ship.model.getObjectByName('hangar-green-light'),beacon=ship.model.getObjectByName('shuttle-bay-green-light');
   halos.forEach(o=>o.visible=false);const off=frame();let changed=0;for(let p=0;p<on.pixels.length;p+=4)if(Math.abs(on.pixels[p]-off.pixels[p])+Math.abs(on.pixels[p+1]-off.pixels[p+1])+Math.abs(on.pixels[p+2]-off.pixels[p+2])>5)changed++;
   ctx.fillStyle='#04070c';ctx.fillRect(i*600,0,600,500);ctx.drawImage(on.canvas,i*600,0);ctx.fillStyle='#ffe16b';ctx.font='14px monospace';ctx.fillText(i?'ORIGINAL MODEL':'SECOND MODEL',i*600+16,24);
   checks.push({halos:halos.length,changed,red:red.material.color.getHex(),green:green.material.color.getHex(),beacon:beacon.material.color.getHex(),beaconEmission:beacon.material.emissiveIntensity,glError:ship.renderer.getContext().getError()});
  }
  return {checks,image:sheet.toDataURL('image/png')};
 });
 if(process.argv.includes('--image'))console.log(JSON.stringify(result));
 for(const check of result.checks){assert.equal(check.halos,0);assert.equal(check.changed,0);assert.equal(check.red,0x9c2820);assert.equal(check.green,0x64c995);assert.equal(check.beacon,0xa7c4a4);assert.equal(check.beaconEmission,.55);assert.equal(check.glError,0);}assert.deepEqual(errors,[]);
 if(!process.argv.includes('--image'))console.log('Passed: hangar marker colors and the roof dome light render without added halos on both models.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
