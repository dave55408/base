const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram|compile/i.test(m.text()))errors.push(m.text());});
 await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async()=>{
  const ship=createMovieEnterpriseRenderer();await ship.ready;ship.setBayDoorOpen(1);const T=AlpineThree;
  if(ship.model.getObjectByName('parked-class-f-shuttle'))throw new Error('Normal hangar must not contain a second shuttle');
  // Isolated geometry fixture for the flying craft; never added by the app.
  const shuttle=createClassFShuttle(T);shuttle.scale.setScalar(.162/3/3.20);shuttle.position.set(-.035,-.01530,-.165*ship.model.userData.referenceDimensions.bodyScale);ship.model.add(shuttle);enterpriseHullSurfaceDetail.prepare(shuttle);ship.model.updateWorldMatrix(true,true);
  const parts=new Set(),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let finite=true;
  shuttle.traverse(o=>{if(!o.isMesh)return;parts.add(o);const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).toArray();for(let k=0;k<3;k++){if(!Number.isFinite(v[k]))finite=false;min[k]=Math.min(min[k],v[k]);max[k]=Math.max(max[k],v[k]);}}});
  const center=min.map((v,i)=>(v+max[i])/2),out=document.createElement('canvas');out.width=1800;out.height=1950;const c=out.getContext('2d');let platingDifference=0;
  const views=[['PARKED / HANGAR',[0,.055,.15],[0,.025,-.17],.105],['CLASS F / FRONT',[center[0],center[1]+.025,center[2]+.20],center,.047],['CLASS F / TOP',[center[0],center[1]+.30,center[2]],center,.075],['CLASS F / QUARTER',[center[0]+.12,center[1]+.07,center[2]+.14],center,.075],['CLASS F / REAR',[center[0],center[1]+.012,center[2]-.20],center,.047],['CLASS F / REAR QUARTER',[center[0]+.12,center[1]+.045,center[2]-.14],center,.075]];
  for(let i=0;i<views.length;i++){
   if(i===1)ship.model.traverse(o=>{if(o.isMesh)o.visible=parts.has(o);});
   const [label,pos,aim,half]=views[i],cam=new T.OrthographicCamera(-half,half,half*650/900,-half*650/900,.001,100);cam.position.set(...pos);if(i===2)cam.up.set(-1,0,0);cam.lookAt(...aim);ship.renderer.setSize(900,650,false);ship.renderer.render(ship.scene,cam);
   if(i===5){
    const layer=enterpriseHullSurfaceDetail,comparison=document.createElement('canvas');comparison.width=900;comparison.height=650;const cc=comparison.getContext('2d');
    layer.strength.value=0;ship.renderer.render(ship.scene,cam);cc.drawImage(ship.renderer.domElement,0,0);const off=cc.getImageData(0,0,900,650).data;
    layer.strength.value=1;ship.renderer.render(ship.scene,cam);cc.clearRect(0,0,900,650);cc.drawImage(ship.renderer.domElement,0,0);const on=cc.getImageData(0,0,900,650).data;
    for(let n=0;n<on.length;n+=4)for(let k=0;k<3;k++)platingDifference+=Math.abs(on[n+k]-off[n+k]);platingDifference/=900*650*3;
   }
   const x=i%2*900,y=Math.floor(i/2)*650;c.fillStyle='#091117';c.fillRect(x,y,900,650);c.drawImage(ship.renderer.domElement,x,y);c.fillStyle='#e2cba4';c.font='17px Arial';c.fillText(label,x+20,y+28);
  }
  const floor=ship.model.getObjectByName('movie-hangar-floor'),floorPoint=new T.Vector3(0,.0045,0);floor.localToWorld(floorPoint);
  const engineBottoms=[...parts].filter(o=>o.name.endsWith('-class-f-nacelle')).map(o=>{let y=Infinity;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)y=Math.min(y,new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).y);return y;});
  const rear=document.createElement('canvas');rear.width=1800;rear.height=650;rear.getContext('2d').drawImage(out,0,1300,1800,650,0,0,1800,650);
  const protectedMarks=[...parts].filter(o=>/markings|windshield|violet-slot/.test(o.name)).every(o=>!o.material.userData.hullSurfaceDetail);
  return {finite,platingDifference,protectedMarks,rearSlots:[...parts].filter(o=>o.name.startsWith('class-f-rear-violet-slot-')).length,rearCowls:[...parts].filter(o=>o.name.endsWith('-class-f-rear-cowling')).length,rearMarkings:!!shuttle.getObjectByName('class-f-rear-markings'),engineBottoms,width:max[0]-min[0],min,max,floorY:floorPoint.y,windshields:[...parts].filter(o=>o.name.startsWith('class-f-windshield-')).length,engines:[...parts].filter(o=>o.name.endsWith('-class-f-nacelle')).length,skids:[...parts].filter(o=>o.name.endsWith('-class-f-landing-skid')).length,markings:[...parts].filter(o=>o.name.endsWith('-class-f-markings')).length,glError:ship.renderer.getContext().getError(),image:out.toDataURL('image/png'),rearImage:rear.toDataURL('image/png')};
 });
 assert(result.finite);assert.equal(result.glError,0);assert.deepEqual(errors,[]);
 assert(Math.abs(result.width/.162-1/3)<.005,'complete shuttle including engines occupies one third of the clear bay width');
 assert(result.min[0]>-.081&&result.max[0]<.081,'shuttle clears both hangar walls');assert(result.min[1]>=result.floorY-1e-6,'shuttle remains above the deck');
 assert(result.engineBottoms.every(y=>y>=result.floorY&&y-result.floorY<.0001),'both engines sit directly on the deck');
 assert(Math.abs((result.max[1]-result.min[1])/(2.3425*(.054/3.20))-.80)<.001,'overall shuttle height is reduced by 20 percent');
 assert.equal(result.windshields,3);assert.equal(result.engines,2);assert.equal(result.skids,0);assert.equal(result.markings,2);
 assert.equal(result.rearSlots,8);assert.equal(result.rearCowls,2);assert(result.rearMarkings,'rear service-panel markings are present');
 assert(result.platingDifference>.05,'plating visibly changes the bare shuttle surface');assert(result.protectedMarks,'lettering, glass and violet slots keep their own materials');
 fs.writeFileSync(path.join(__dirname,'preview-class-f-shuttle.png'),Buffer.from(result.image.split(',')[1],'base64'));
 fs.writeFileSync(path.join(__dirname,'preview-class-f-rear.png'),Buffer.from(result.rearImage.split(',')[1],'base64'));console.log('Passed: detailed Class F rear, one-third bay width, compressed height, deck-level engines and six rendered views.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
