const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
global.window=global;require('./hangar-door-frame.js');
const closingRate=v=>(v-advanceHangarDoor(v,0,.01))/.01;
assert(Math.abs(closingRate(.4)-1/2.4)<1e-10,'normal closing speed before the last 15 percent');
assert(closingRate(.2)<closingRate(.4)&&closingRate(.05)<closingRate(.2),'closing gradually slows near the seal');
assert(Math.abs(advanceHangarDoor(.05,1,.01)-(.05+.01/2.4))<1e-10,'opening keeps its original speed');
assert.equal(advanceHangarDoor(.1,0,0),.1,'closing pauses with simulation time');
let closing=1;for(let i=0;i<360;i++)closing=advanceHangarDoor(closing,0,1/120);assert.equal(closing,0,'soft closing reaches full closure');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.createMovieEnterpriseRenderer);
 const result=await page.evaluate(async()=>{
  const T=AlpineThree,out=document.createElement('canvas');out.width=2500;out.height=1350;const ctx=out.getContext('2d'),models=[];
  for(const [row,factory] of [createMovieEnterpriseRenderer,createEnterpriseRenderer,createThirdEnterpriseRenderer].entries()){
   const ship=factory();await ship.ready;const doors=ship.model.getObjectByName('shuttle-bay-clamshell-doors'),frames=[];
   ship.setBayDoorOpen(0);ship.model.updateWorldMatrix(true,true);let closedEnd=-Infinity;
   doors.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)closedEnd=Math.max(closedEnd,doors.parent.worldToLocal(mesh.localToWorld(new T.Vector3().fromBufferAttribute(p,i))).z);});
   const exposedLedge=hangarDoorProfile().baseFront-.0002-closedEnd;
   if(exposedLedge<.004||exposedLedge>.012)throw Error('Closed doors must leave a small exposed strip of the outside ledge');
   for(const leaf of doors.children){
    const panel=leaf.children[0].geometry.userData.hullPanelTopology,overlap=leaf.getObjectByName('clamshell-outboard-overlap')?.geometry.userData.hullPanelTopology;
    if(!overlap||Math.abs(overlap.start-panel.end)>1e-10||Math.abs(Math.abs(overlap.end-overlap.start)-.025)>1e-10)throw Error('Every panel needs an outboard overlap beyond its visible sector');
   }
   for(const [col,open] of [0,.25,.5,.75,1].entries()){
    ship.setBayDoorOpen(open);ship.model.updateWorldMatrix(true,true);
    const leaves=doors.children.map(leaf=>{const side=leaf.name.startsWith('port')?-1:1,p=leaf.children[0].geometry.attributes.position,v=new T.Vector3().fromBufferAttribute(p,0).applyMatrix4(leaf.matrix),topology=leaf.children[0].geometry.userData.hullPanelTopology;return {side,index:Number(leaf.name.at(-1)),angle:side*Math.atan2(v.x,v.z),radius:v.length(),rotation:leaf.rotation.y,width:Math.abs(p.getX(topology.segments)-p.getX(0)),startX:side*p.getX(0),endX:side*p.getX(topology.segments)};});frames.push({open,leaves});
    const camera=new T.PerspectiveCamera(40,500/450,.005,10);camera.position.copy(doors.localToWorld(new T.Vector3(0,.4,5.5)));camera.lookAt(doors.localToWorld(new T.Vector3(0,.5,0)));camera.updateWorldMatrix(true,false);
    ship.renderer.setSize(500,450,false);ship.renderer.render(ship.scene,camera);ctx.fillStyle='#050a10';ctx.fillRect(col*500,row*450,500,450);ctx.drawImage(ship.renderer.domElement,col*500,row*450);ctx.fillStyle='#ebd0a1';ctx.font='15px Consolas';ctx.fillText(['MOVIE','ORIGINAL','THIRD'][row]+' / '+Math.round(open*100)+'% OPEN',col*500+12,row*450+24);
   }
   ship.setBayDoorOpen(0);const closedAgain=doors.children.map(leaf=>leaf.rotation.y);models.push({frames,closedAgain,glError:ship.renderer.getContext().getError()});
  }
  return {models,image:out.toDataURL('image/jpeg',.85)};
 });
 for(const model of result.models){assert.equal(model.glError,0);assert(model.closedAgain.every(v=>v===0),'closing restores the center seam');
  for(const side of [-1,1]){
   const at=i=>model.frames[i].leaves.filter(l=>l.side===side).sort((a,b)=>a.index-b.index),closed=at(0),quarter=at(1),half=at(2),opened=at(4);
   assert.equal(closed.length,3,'three leaves on each side');
   assert(closed.every((l,n)=>Math.abs(l.angle-n*Math.PI/6)<1e-6),'closed leaves tile each half with matching curved segments');
   assert(closed.every((l,n)=>Math.abs(l.startX/l.radius-Math.sin(n*Math.PI/6))<1e-6&&Math.abs(l.endX/l.radius-Math.sin((n+1)*Math.PI/6))<1e-6),'each segment has the same 30-degree curved span');
   assert(closed[0].width>closed[1].width&&closed[1].width>closed[2].width,'matching curved doors foreshorten toward the sides');
   assert(quarter[0].rotation!==0&&quarter.slice(1).every(l=>l.rotation===0),'center panel retracts first');
   assert(Math.abs(half[0].angle-half[1].angle)<.03&&half[2].rotation===0,'center pair nests before collecting the next panel');
   assert(Math.abs(Math.sin(opened[0].angle)-.90)<1e-6,'open stacks leave 90 percent of the doorway width clear');
   assert(opened.every((l,n)=>Math.abs(l.angle-(Math.asin(.90)+n*.024))<1e-6),'three collapsed leaves retain visible staggered edges');
   assert(opened.slice(1).every((l,n)=>l.radius*Math.sin(l.angle)-opened[n].radius*Math.sin(opened[n].angle)>.015),'a strip of every collapsed door remains visible from the rear');
   assert(opened.every((l,n)=>n===0||l.radius>opened[n-1].radius+.007),'separate concentric tracks prevent intersecting leaves');
  }
 }
 assert.deepEqual(errors,[]);console.log(process.argv.includes('--image')?'IMG:'+result.image.split(',')[1]:'Passed: six matching curved panels, foreshortened side seams, visible collapsed edges, 90 percent clear opening and reversible closing on all three models.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
