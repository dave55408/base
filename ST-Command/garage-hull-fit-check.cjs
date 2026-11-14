const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async()=>{
  const T=AlpineThree,checks=[],sheet=document.createElement('canvas');sheet.width=1800;sheet.height=1650;const ctx=sheet.getContext('2d');
  for(const [row,factory]of [createMovieEnterpriseRenderer,createEnterpriseRenderer,createThirdEnterpriseRenderer].entries()){
   const ship=factory();await ship.ready;ship.setBayDoorOpen(1);const garage=ship.model.getObjectByName('bay-forward-arched-lift');garage.setOpen(1);ship.model.updateWorldMatrix(true,true);ship.renderer.shadowMap.enabled=true;
   const hull=ship.model.getObjectByName('secondary-hull'),p=hull.geometry.attributes.position,stride=(hull.userData.radialSegments||96)+1,hullInverse=hull.matrixWorld.clone().invert(),rows=p.count/stride,leaks=[];
   // Interpolate the actual faceted hull mesh at the point's longitudinal
   // station, then test containment in that cross-section polygon.
   function contained(point){
    let level=-1;for(let i=0;i<rows-1;i++)if(p.getY(i*stride)<=point.y&&p.getY((i+1)*stride)>=point.y&&p.getY((i+1)*stride)>p.getY(i*stride)){level=i;break;}
    if(level<0)return false;
    const a=level*stride,b=a+stride,t=(point.y-p.getY(a))/(p.getY(b)-p.getY(a)),poly=[];
    for(let i=0;i<stride-1;i++)poly.push([p.getX(a+i)+(p.getX(b+i)-p.getX(a+i))*t,p.getZ(a+i)+(p.getZ(b+i)-p.getZ(a+i))*t]);
    let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
     const [x,z]=poly[i],[u,v]=poly[j];if((z>point.z)!==(v>point.z)&&point.x<(u-x)*(point.z-z)/(v-z)+x)inside=!inside;
    }return inside;
   }
   let vertices=0;garage.traverse(o=>{
    if(!o.isMesh)return;let craft=false;for(let a=o;a&&a!==garage;a=a.parent)if(a.name.startsWith('stored-type-f-shuttle-'))craft=true;
    // Craft bounding boxes are checked below; test all shell and fixture
    // vertices here.
    if(craft)return;const p=o.geometry.attributes.position,m=hullInverse.clone().multiply(o.matrixWorld);
    for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(m);vertices++;if(!contained(v)&&leaks.length<20)leaks.push({name:o.name,point:v.toArray()});}
   });
   const craft=garage.getObjectByName('bay-garage-storage').children.filter(o=>o.name.startsWith('stored-type-f-shuttle-')),bounds=[];
   for(const root of craft){
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,m=garage.matrixWorld.clone().invert().multiply(o.matrixWorld);for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(m).toArray();for(let k=0;k<3;k++){min[k]=Math.min(min[k],v[k]);max[k]=Math.max(max[k],v[k]);}}});
    for(const x of [min[0],max[0]])for(const y of [min[1],max[1]])for(const z of [min[2],max[2]]){const v=new T.Vector3(x,y,z).applyMatrix4(garage.matrixWorld).applyMatrix4(hullInverse);if(!contained(v))leaks.push({name:root.name,point:v.toArray()});}
    bounds.push({slot:root.userData.storageSlot,min,max});
   }
   const lamps=[];garage.traverse(o=>{if(o.isSpotLight)lamps.push({role:o.userData.role,power:o.userData.power});});
   checks.push({model:['movie','original','third'][row],vertices,leaks,bounds,lamps});
   for(let col=0;col<2;col++){
    const camera=new T.PerspectiveCamera(62,900/550,.001,10);camera.position.copy(garage.localToWorld(new T.Vector3(col?.020:0,col?-.018:.009,col?-.225:-.170)));camera.lookAt(garage.localToWorld(new T.Vector3(0,.015,-.42)));camera.updateWorldMatrix(true,false);ship.renderer.setSize(900,550,false);ship.renderer.render(ship.scene,camera);ctx.drawImage(ship.renderer.domElement,col*900,row*550);ctx.fillStyle='#e1d1af';ctx.font='15px Arial';ctx.fillText(checks.at(-1).model+' / '+(col?'INSIDE GARAGE':'BAY VIEW'),col*900+14,row*550+25);
   }
   checks.at(-1).glError=ship.renderer.getContext().getError();ship.dispose();
  }return {checks,image:sheet.toDataURL('image/png').split(',')[1]};
 });
 const preview=path.join(require('node:os').tmpdir(),'st-command-garage-3x2.png');fs.writeFileSync(preview,Buffer.from(result.image,'base64'));console.log('Preview: '+preview);
 for(const r of result.checks){
  console.log(JSON.stringify({model:r.model,vertices:r.vertices,leaks:r.leaks,lamps:r.lamps}));assert.deepEqual(r.leaks,[],r.model+' garage and all shuttles stay inside the actual hull mesh');assert.equal(r.bounds.length,6);assert.equal(r.glError,0);
  for(let row=0;row<2;row++)for(let col=0;col<3;col++){const b=r.bounds.find(b=>b.slot.row===row&&b.slot.column===col);assert(b);if(col){const a=r.bounds.find(b=>b.slot.row===row&&b.slot.column===col-1);assert(b.min[0]-a.max[0]>.010,'shuttles keep lateral clearance');}if(row){const a=r.bounds.find(b=>b.slot.row===row-1&&b.slot.column===col);assert(b.min[1]-a.max[1]>.002,'platforms fit between levels');}}
  assert.equal(r.lamps.filter(l=>l.role==='top').length,3);assert.equal(r.lamps.filter(l=>l.role==='bottom-spot'&&l.power<.11).length,2);
  assert.equal(r.lamps.filter(l=>l.role==='bottom-center'&&l.power<.11).length,1);
 }assert.deepEqual(errors,[]);console.log('Passed: six shuttles in three columns and two levels, hull containment, clearance, three top spotlights, two gap spotlights and one center bottom spotlight on all models.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
