const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async closed=>{
  const T=AlpineThree,checks=[],sheet=document.createElement('canvas');sheet.width=1800;sheet.height=500;const ctx=sheet.getContext('2d');
  for(const [i,factory] of [createEnterpriseRenderer,createMovieEnterpriseRenderer,createThirdEnterpriseRenderer].entries()){
   const ship=factory();await ship.ready;ship.setBayDoorOpen(closed?0:1);ship.model.updateWorldMatrix(true,true);
   const group=ship.model.getObjectByName('hangar-arch-uplights'),lamps=group?.children.filter(o=>o.isSpotLight)??[];
   const frame=ship.model.getObjectByName('movie-hangar-flat-door-rim')??ship.model.getObjectByName('original-hangar-flat-door-rim');
   const center=frame.localToWorld(new T.Vector3(0,.014,.02)),camera=new T.PerspectiveCamera(32,1.2,.001,10);
   camera.position.copy(center).add(new T.Vector3(closed?.13:.012,closed?.075:.015,.43));camera.lookAt(center);camera.updateWorldMatrix(true,false);ship.renderer.setSize(600,500,false);
   ship.renderer.render(ship.scene,camera);ctx.drawImage(ship.renderer.domElement,i*600,0);
   const lowerLights=[];ship.model.traverse(o=>{if(/^(port|starboard)-hangar-(red|yellow)-light$|^hangar-green-light$|hangar-uplight/.test(o.name))lowerLights.push(o.name);});
   const doorTrim=[];ship.model.traverse(o=>{if(/-bay-under-booth-status-recess$|-bay-door-indicator-/.test(o.name))doorTrim.push(o.name);});
   checks.push({lamps:lamps.length,lowerLights,doorTrim,glError:ship.renderer.getContext().getError()});ship.dispose();
  }
  return {checks,image:sheet.toDataURL('image/png')};
 },process.argv.includes('--closed'));
 for(const check of result.checks){assert.equal(check.lamps,0);assert.equal(check.lowerLights.length,5);assert.deepEqual(check.doorTrim,[]);assert.equal(check.glError,0);}assert.deepEqual(errors,[]);
 console.log(JSON.stringify(process.argv.includes('--image')?result:result.checks));
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
