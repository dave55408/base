const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.createMovieEnterpriseRenderer);
 const result=await page.evaluate(async()=>{
  const T=AlpineThree,out=document.createElement('canvas');out.width=2500;out.height=900;const ctx=out.getContext('2d'),models=[];
  for(const [row,factory] of [createMovieEnterpriseRenderer,createEnterpriseRenderer].entries()){
   const ship=factory();await ship.ready;const doors=ship.model.getObjectByName('shuttle-bay-clamshell-doors'),frames=[];
   for(const [col,open] of [0,.25,.5,.75,1].entries()){
    ship.setBayDoorOpen(open);ship.model.updateWorldMatrix(true,true);
    const leaves=doors.children.map(leaf=>{const side=leaf.name.startsWith('port')?-1:1,p=leaf.children[0].geometry.attributes.position,v=new T.Vector3().fromBufferAttribute(p,0).applyMatrix4(leaf.matrix);return {side,index:Number(leaf.name.at(-1)),angle:side*Math.atan2(v.x,v.z),radius:v.length(),rotation:leaf.rotation.y};});frames.push({open,leaves});
    const camera=new T.PerspectiveCamera(40,500/450,.005,10);camera.position.copy(doors.localToWorld(new T.Vector3(0,.4,5.5)));camera.lookAt(doors.localToWorld(new T.Vector3(0,.5,0)));camera.updateWorldMatrix(true,false);
    ship.renderer.setSize(500,450,false);ship.renderer.render(ship.scene,camera);ctx.fillStyle='#050a10';ctx.fillRect(col*500,row*450,500,450);ctx.drawImage(ship.renderer.domElement,col*500,row*450);ctx.fillStyle='#ebd0a1';ctx.font='15px Consolas';ctx.fillText((row?'ORIGINAL':'MOVIE')+' / '+Math.round(open*100)+'% OPEN',col*500+12,row*450+24);
   }
   ship.setBayDoorOpen(0);const closedAgain=doors.children.map(leaf=>leaf.rotation.y);models.push({frames,closedAgain,glError:ship.renderer.getContext().getError()});
  }
  return {models,image:out.toDataURL('image/jpeg',.85)};
 });
 for(const model of result.models){assert.equal(model.glError,0);assert(model.closedAgain.every(v=>v===0),'closing restores the center seam');
  for(const side of [-1,1]){
   const at=i=>model.frames[i].leaves.filter(l=>l.side===side).sort((a,b)=>a.index-b.index),closed=at(0),quarter=at(1),half=at(2),opened=at(4);
   assert.equal(closed.length,3,'three leaves on each side');assert(closed.every((l,n)=>Math.abs(l.angle-n*Math.PI/6)<1e-6),'closed leaves tile the shell');
   assert(quarter[0].rotation!==0&&quarter.slice(1).every(l=>l.rotation===0),'center panel retracts first');
   assert(Math.abs(half[0].angle-half[1].angle)<.02&&half[2].rotation===0,'center pair nests before collecting the next panel');
   assert(Math.abs(Math.sin(opened[0].angle)-.95)<1e-6,'open stack leaves five percent visible at each side');
   assert(opened.every((l,n)=>Math.abs(l.angle-(Math.asin(.95)+n*.012))<1e-6),'three collapsed leaves retain visible staggered edges');
   assert(opened.every((l,n)=>n===0||l.radius>opened[n-1].radius+.007),'separate concentric tracks prevent intersecting leaves');
  }
 }
 assert.deepEqual(errors,[]);console.log(process.argv.includes('--image')?'IMG:'+result.image.split(',')[1]:'Passed: sequential panel collection, concentric nesting, clear side stacks, reversible closing and both Enterprise models.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
