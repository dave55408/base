const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async()=>{
  const T=AlpineThree,checks=[],sheet=document.createElement('canvas');sheet.width=1800;sheet.height=1000;const ctx=sheet.getContext('2d');
  for(const [row,factory] of [createMovieEnterpriseRenderer,createThirdEnterpriseRenderer].entries()){
   const ship=factory();await ship.ready;let minLipGap=Infinity,minDomeGap=Infinity,maxDomeRadius=0,depthBiased=true;
   for(const side of ['port','starboard']){
    const tube=ship.model.getObjectByName(side+'-engine-outer-tube'),rim=ship.model.getObjectByName(side+'-dome-gray-retaining-rim'),tp=tube.geometry.attributes.position,ti=tube.geometry.index,rp=rim.geometry.attributes.position;
    let firstSkin=Infinity,ringRear=-Infinity;for(let i=0;i<ti.count;i++)firstSkin=Math.min(firstSkin,tp.getY(ti.getX(i)));for(let i=0;i<rp.count;i++)ringRear=Math.max(ringRear,rp.getY(i));
    if(Math.abs(firstSkin-ringRear)>1e-7)throw Error('Engine tube must meet the retaining ring with no overlapping axial band');

    const rotor=ship.model.getObjectByName(side+'-cap-lines'),cap=ship.model.getObjectByName(side+'-engine-cap'),lip=ship.model.getObjectByName(side+'-engine-inner-lip');
    lip.updateMatrix();const lp=lip.geometry.attributes.position;let lipRadius=Infinity;
    for(let i=0;i<lp.count;i++){const v=new T.Vector3().fromBufferAttribute(lp,i).applyMatrix4(lip.matrix).sub(cap.position);lipRadius=Math.min(lipRadius,Math.hypot(v.x,v.y));}
    const facets=lip.geometry.userData.hullPanelTopology?.segments||64,boreRadius=lipRadius*Math.cos(Math.PI/facets),dome=cap.geometry.attributes.position,stride=cap.geometry.parameters.widthSegments+1,domeProfile=[];
    for(let i=0;i<dome.count;i+=stride)domeProfile.push({z:dome.getZ(i),r:Math.hypot(dome.getX(i),dome.getY(i))});
    function domeBore(z){for(let i=1;i<domeProfile.length;i++){const a=domeProfile[i-1],b=domeProfile[i];if(z>=a.z&&z<=b.z){const t=(z-a.z)/(b.z-a.z);return (a.r+(b.r-a.r)*t)*Math.cos(Math.PI/(stride-1));}}return 0;}
    for(let phase=0;phase<64;phase++){
     rotor.rotation.z=phase*Math.PI/32;rotor.updateMatrix();
     for(const blade of rotor.children){blade.updateMatrix();const p=blade.geometry.attributes.position;
      for(let i=0;i<p.count;i++){
       const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(blade.matrix).applyMatrix4(rotor.matrix).sub(cap.position),r=Math.hypot(v.x,v.y);
       if(v.z>=-.001)minLipGap=Math.min(minLipGap,boreRadius-r);
       if(v.z<0){maxDomeRadius=Math.max(maxDomeRadius,Math.hypot(r,v.z/cap.scale.z));minDomeGap=Math.min(minDomeGap,domeBore(v.z/cap.scale.z)-r);}
      }
     }
     depthBiased=depthBiased&&rotor.children.every(blade=>blade.material.polygonOffset&&blade.material.polygonOffsetFactor>0&&blade.material.polygonOffsetUnits>0);
    }
   }
   for(let col=0;col<3;col++){
    const scratch=document.createElement('canvas').getContext('2d');ship.draw(scratch,2,2,{x:0,y:-2,z:110.49},{heading:180,pitch:0,time:col*.17});ship.model.updateWorldMatrix(true,true);
    const center=ship.model.getObjectByName('port-engine-cap').getWorldPosition(new T.Vector3()),camera=new T.PerspectiveCamera(32,1.2,.01,10);
    camera.position.copy(center).add(new T.Vector3([0,-.15,-.32][col],[0,.05,.08][col],-.40));camera.lookAt(center);camera.updateWorldMatrix(true,false);ship.renderer.setSize(600,500,false);ship.renderer.render(ship.scene,camera);ctx.drawImage(ship.renderer.domElement,col*600,row*500);
   }
   checks.push({minLipGap,minDomeGap,maxDomeRadius,depthBiased,glError:ship.renderer.getContext().getError()});ship.dispose();
  }
  return {checks,image:sheet.toDataURL('image/jpeg',.88)};
 });
 for(const c of result.checks){assert(c.minLipGap>.003,'blades keep increased clearance inside the actual retaining lip through a full rotation');assert(c.minDomeGap>.002,'blades remain inside the faceted dome surface');assert(c.maxDomeRadius<.084,'blades sit well inside the dome');assert(c.depthBiased,'blade depth stays behind the casing');assert.equal(c.glError,0);}assert.deepEqual(errors,[]);
 if(process.argv.includes('--preview')){const file=path.join(require('node:os').tmpdir(),'st-command-inset-engine-blades.jpg');require('node:fs').writeFileSync(file,Buffer.from(result.image.split(',')[1],'base64'));console.log('Preview: '+file);}
 console.log(JSON.stringify(process.argv.includes('--image')?result:result.checks));
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
