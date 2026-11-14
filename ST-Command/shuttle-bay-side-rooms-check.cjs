const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+(process.argv.includes('--surfaces')?'/?surfaces=1':process.argv.includes('--entrance')?'/?entrance=1':''));
 const result=await page.evaluate(async()=>{
  const T=AlpineThree,sheet=document.createElement('canvas');sheet.width=1600;sheet.height=1350;const ctx=sheet.getContext('2d'),checks=[];
  for(const [row,factory]of [createMovieEnterpriseRenderer,createEnterpriseRenderer,createThirdEnterpriseRenderer].entries()){
   const ship=factory();await ship.ready;ship.setBayDoorOpen(1);ship.model.updateWorldMatrix(true,true);
   const room=ship.model.getObjectByName('reference-bay-interior'),suites=room.children.filter(o=>/-bay-side-room-\d$/.test(o.name)),hits=[];
   const original=factory===createEnterpriseRenderer,prefix=original?'original':'movie';
   function heightBounds(mesh){const p=mesh.geometry.attributes.position;let min=Infinity,max=-Infinity;for(let i=0;i<p.count;i++){const v=mesh.localToWorld(new T.Vector3().fromBufferAttribute(p,i));min=Math.min(min,v.y);max=Math.max(max,v.y);}return {min,max};}
   const ledge=heightBounds(ship.model.getObjectByName(prefix+'-hangar-squared-base')).max;
   const floor=heightBounds(ship.model.getObjectByName(prefix+'-hangar-floor')).max;
   const landing=ShuttleBayFlight.dimensions(original?'original':'movie').floor-110;
   if(Math.abs(floor-ledge)>1e-7||Math.abs(landing-ledge)>1e-7)throw Error('Hangar floor, outside ledge and shuttle landing height must be flush');
   if(Math.abs(heightBounds(room.getObjectByName('bay-reference-landing-pad')).min-ledge)>.00004)throw Error('Painted deck must sit on the raised floor');
   const ringEnd=room.localToWorld(new T.Vector3(0,0,shuttleBayFloorFront())).z;
   for(const mesh of [room.getObjectByName('bay-reference-landing-pad'),ship.model.getObjectByName(prefix+'-hangar-floor')]){const p=mesh.geometry.attributes.position;let end=-Infinity;for(let i=0;i<p.count;i++)end=Math.max(end,mesh.localToWorld(new T.Vector3().fromBufferAttribute(p,i)).z);if(Math.abs(end-ringEnd)>1e-7)throw Error('Both gray floor layers must end halfway between the red line and last frame');}
   for(const side of ['port','starboard'])if(Math.abs(heightBounds(room.getObjectByName(side+'-bay-wall-utility-box')).min-ledge)>1e-7)throw Error('Floor boxes must sit on the raised deck');
   for(const side of ['port','starboard']){
    const cap=room.getObjectByName(side+'-bay-hull-fitted-end-cap'),trim=room.getObjectByName(side+'-bay-console-rail');
    if(!cap)throw Error('Exposed wall end needs a hull-fitted cap');
    const p=cap.geometry.attributes.position,t=trim.geometry.attributes.position;let trimEnd=-Infinity;
    for(let i=0;i<t.count;i++)trimEnd=Math.max(trimEnd,t.getZ(i));
    if(trimEnd>=p.getZ(0)-.002)throw Error('Trim must stop short enough to expose the wall end');
    let minY=Infinity,maxY=-Infinity;for(let i=0;i<p.count;i++){minY=Math.min(minY,p.getY(i));maxY=Math.max(maxY,p.getY(i));}
    if(minY>-.0464||maxY<-.0143||p.count<40)throw Error('Curved wall-end closure must cover the full vertical gap');
   }
   if(shuttleBaySideDoorLayout().some(d=>d.z+d.length/2>-.0183-.0003))throw Error('A side room intersects the bay mouth return');
   // Structural horizontal caps must sit behind the visible room surfaces,
   // including on the original model's differently positioned wall boxes.
   for(const side of ['port','starboard']){
    const wall=ship.model.getObjectByName(side+'-hangar-wall'),p=wall.geometry.attributes.position;
    for(let i=0;i<p.count;i+=3){
     const ys=[0,1,2].map(k=>p.getY(i+k)+wall.position.y);
     if(Math.max(...ys)-Math.min(...ys)<1e-7&&[-.04645,-.0205].some(y=>Math.abs(ys[0]-y)<.0002))throw Error('Structural cap overlaps the room floor or ceiling');
     const zs=[0,1,2].map(k=>p.getZ(i+k)+wall.position.z),roomEnds=shuttleBaySideDoorLayout().flatMap(d=>[d.z-d.length/2,d.z+d.length/2]);
     if(Math.max(...zs)-Math.min(...zs)<1e-7&&roomEnds.some(z=>Math.abs(zs[0]-z)<.0002))throw Error('Structural reveal overlaps a room end wall');
    }
   }
   const triangles=[],inverse=room.matrixWorld.clone().invert();
   ship.model.traverse(o=>{
    if(!o.isMesh||!o.visible||o.material.transparent)return;
    const p=o.geometry.attributes.position,index=o.geometry.index,matrix=inverse.clone().multiply(o.matrixWorld),vertices=[];
    for(let i=0;i<p.count;i++)vertices.push(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix));
    for(let i=0;i<(index?index.count:p.count);i+=3)triangles.push({name:o.name,v:[0,1,2].map(k=>vertices[index?index.getX(i+k):i+k])});
   });
   // Intersect horizontal rays with the transformed triangles in bay space.
   for(const side of [-1,1])for(const {z}of shuttleBaySideDoorLayout()){
    let distance=Infinity,name='none';
    for(const {name:part,v:[a,b,c]}of triangles){
     const by=b.y-a.y,bz=b.z-a.z,cy=c.y-a.y,cz=c.z-a.z,det=by*cz-cy*bz;if(Math.abs(det)<1e-14)continue;
     const y=-.033-a.y,dz=z-a.z,u=(y*cz-cy*dz)/det,v=(by*dz-y*bz)/det;if(u<0||v<0||u+v>1)continue;
     const x=side*(a.x+u*(b.x-a.x)+v*(c.x-a.x));if(x>.0001&&x<distance){distance=x;name=part;}
    }
    hits.push(name);
   }
   const materials=suites.flatMap(o=>o.children.filter(m=>m.name.endsWith('back-wall')).map(m=>m.material.color.getHex()));
   checks.push({suites:suites.length,hits,materials,lamps:suites.filter(o=>o.children.filter(m=>m.name.endsWith('hall-light')).length===1).length});
   for(let col=0;col<2;col++){
    const camera=new T.PerspectiveCamera(col?52:75,800/450,.0002,20);
    const surfaces=location.search.includes('surfaces');
    camera.position.copy(room.localToWorld(new T.Vector3(surfaces?.083:(col?.012:0),surfaces?-.033:(col?-.034:-.022),surfaces?-.151:(col?-.126:.004))));
    camera.lookAt(room.localToWorld(new T.Vector3(surfaces?.093:(col?.096:0),surfaces?(col?-.0205:-.04645):(col?-.033:-.018),surfaces?-.164:(col?-.151:-.25))));camera.updateWorldMatrix(true,false);
    if(location.search.includes('entrance')){
     camera.position.copy(room.localToWorld(new T.Vector3(col?.025:0,-.031,col?-.080:.004)));
     camera.lookAt(room.localToWorld(new T.Vector3(.079,-.031,-.024)));camera.updateWorldMatrix(true,false);
    }
    ship.renderer.setSize(800,450,false);ship.renderer.render(ship.scene,camera);ctx.drawImage(ship.renderer.domElement,col*800,row*450);
    ctx.fillStyle='#c4d0d4';ctx.font='14px Arial';ctx.fillText(['MOVIE','ORIGINAL','THIRD'][row]+' / '+(col?'SIDE ROOM':'BAY'),col*800+14,row*450+24);
   }
   checks.at(-1).glError=ship.renderer.getContext().getError();ship.dispose();
  }
  return {checks,image:sheet.toDataURL('image/png').split(',')[1]};
 });
 const preview=path.join(require('node:os').tmpdir(),'st-command-side-rooms.png');fs.writeFileSync(preview,Buffer.from(result.image,'base64'));
 console.log(JSON.stringify(result.checks));console.log('Preview: '+preview);
 for(const c of result.checks){assert.equal(c.suites,8);assert.equal(c.lamps,8);assert(c.hits.every(n=>/-bay-side-room-\d-back-wall$/.test(n)),'all eight doorways open through the structural walls into rooms');assert(c.materials.every(n=>n===0x090e12));assert.equal(c.glError,0);}assert.deepEqual(errors,[]);
 console.log('Passed: eight open side rooms, unobstructed halls, sparse lighting and rendering on all three models.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
