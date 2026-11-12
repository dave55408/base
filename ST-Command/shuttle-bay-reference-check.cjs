const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.createMovieEnterpriseRenderer&&window.createShuttleBayInterior);
 const result=await page.evaluate(async()=>{
  const T=AlpineThree,out=document.createElement('canvas');out.width=1600;out.height=1100;const ctx=out.getContext('2d'),results=[];
  for(const [i,factory] of [createMovieEnterpriseRenderer,createEnterpriseRenderer].entries()){
   const ship=factory();await ship.ready;ship.setBayDoorOpen(1);ship.model.updateWorldMatrix(true,true);const room=ship.model.getObjectByName('reference-bay-interior'),parts=[];room.traverse(o=>{if(o.isMesh)parts.push(o);});
   const walls=room.getObjectByName('reference-bay-walls'),wallParts=[];walls.traverse(o=>{if(o.isMesh)wallParts.push(o);});let minWallX=Infinity,maxWallZ=-Infinity;
   for(const o of wallParts){o.updateMatrix();const p=o.geometry.attributes.position;for(let n=0;n<p.count;n++){const v=new T.Vector3().fromBufferAttribute(p,n).applyMatrix4(o.matrix);minWallX=Math.min(minWallX,Math.abs(v.x));maxWallZ=Math.max(maxWallZ,v.z);}}
   for(const side of ['port','starboard']){
    const wallNormal=new T.Vector3().fromBufferAttribute(walls.getObjectByName(side+'-bay-upper-infill').geometry.attributes.normal,0);
    if(Math.abs(wallNormal.y)<.1)throw Error('Side walls must slope inward');
    for(const o of wallParts.filter(o=>o.name.startsWith(side+'-')&&/-bay-console-screen-|-bay-side-door-inset-/.test(o.name))){
     const normal=new T.Vector3().fromBufferAttribute(o.geometry.attributes.normal,0);
     if(Math.abs(normal.dot(wallNormal))<.999999)throw Error(o.name+' must be parallel to the sloped wall');
    }
   }
   results.push({lights:parts.filter(o=>o.name.startsWith('bay-ceiling-light-')).length,consoles:parts.filter(o=>/bay-console-\d$/.test(o.name)).length,screens:wallParts.filter(o=>/-bay-console-screen-\d-\d$/.test(o.name)).length,doors:wallParts.filter(o=>/-bay-side-door-inset-\d$/.test(o.name)).length,louvers:wallParts.filter(o=>/-bay-vent-\d-\d$/.test(o.name)).length,minWallX,maxWallZ,parked:!!ship.model.getObjectByName('parked-class-f-shuttle'),pad:!!room.getObjectByName('bay-reference-landing-pad'),door:!!room.getObjectByName('bay-forward-arched-lift')});
   for(let v=0;v<2;v++){
    const camera=new T.PerspectiveCamera(72,800/550,.0005,20);camera.position.copy(room.localToWorld(new T.Vector3(v?.035:0,-.006,v?-.080:.008)));camera.lookAt(room.localToWorld(new T.Vector3(v?-.02:0,.010,-.272)));camera.updateWorldMatrix(true,false);
    ship.renderer.setSize(800,550,false);ship.renderer.render(ship.scene,camera);ctx.fillStyle='#07090c';ctx.fillRect(v*800,i*550,800,550);ctx.drawImage(ship.renderer.domElement,v*800,i*550);ctx.fillStyle='#d4c5a6';ctx.font='13px Consolas';ctx.fillText((i?'ORIGINAL':'MOVIE')+' / '+(v?'WALL CONSOLES':'BAY INTERIOR'),v*800+15,i*550+22);
   }
   results.at(-1).glError=ship.renderer.getContext().getError();
  }
  return {results,image:out.toDataURL('image/jpeg',.85)};
 });
 for(const r of result.results){assert.equal(r.lights,48);assert.equal(r.consoles,6);assert.equal(r.screens,12);assert.equal(r.doors,8);assert.equal(r.louvers,64);assert(r.minWallX>=.0615,'wall cabinets preserve shuttle clearance');assert(r.maxWallZ<=-.01829,'wall fittings stop behind the door return');assert(!r.parked,'no second parked shuttle');assert(r.pad&&r.door);assert.equal(r.glError,0);}assert.deepEqual(errors,[]);
 console.log(process.argv.includes('--image')?'IMG:'+result.image.split(',')[1]:'Passed: reference wall cabinets, twelve inset screens, eight recessed doors, louvered grilles, doorway and shuttle clearances on both models.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
