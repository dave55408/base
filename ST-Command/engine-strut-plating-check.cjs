const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram|compile/i.test(m.text()))errors.push(m.text());});await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async()=>{
  const T=AlpineThree,checks=[],ships=[createMovieEnterpriseRenderer(),createEnterpriseRenderer(),createThirdEnterpriseRenderer()];await Promise.all(ships.map(s=>s.ready));
  const layer=enterpriseHullSurfaceDetail,sheet=document.createElement('canvas');sheet.width=2400;sheet.height=1350;const out=sheet.getContext('2d');
  for(const [row,ship]of ships.entries()){
   ship.model.updateWorldMatrix(true,true);
   for(const side of ['port','starboard'])for(const suffix of ['engine-strut','engine-pylon-shoe']){
    const part=ship.model.getObjectByName(side+'-'+suffix),uv=part?.geometry.attributes.hullSurfaceUv;if(!part?.material.userData.hullSurfaceDetail||!part.material.userData.hullSurfacePhysical||!uv||uv.count!==part.geometry.attributes.position.count||Array.from(uv.array).some(v=>!Number.isFinite(v)))throw Error('Missing plating or valid surface coordinates: '+side+'-'+suffix);
   }
   const visibility=new Map();ship.model.traverse(o=>{if(o.isMesh)visibility.set(o,o.visible);});
   for(const [column,name]of ['starboard-engine-strut','starboard-engine-pylon-shoe'].entries()){
    const part=ship.model.getObjectByName(name);for(const [mesh,visible]of visibility){let belongs=false;for(let ancestor=mesh;ancestor;ancestor=ancestor.parent)if(ancestor===part)belongs=true;mesh.visible=visible&&belongs;}
    const p=part.geometry.attributes.position,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(part.matrixWorld).toArray();for(let k=0;k<3;k++){min[k]=Math.min(min[k],v[k]);max[k]=Math.max(max[k],v[k]);}}
    const center=new T.Vector3(...min.map((v,i)=>(v+max[i])/2)),aspect=600/450,half=Math.max((max[0]-min[0])/2,(max[1]-min[1])/2*aspect)*1.18,camera=new T.OrthographicCamera(-half,half,half/aspect,-half/aspect,.001,20);
    camera.position.copy(center).add(new T.Vector3(0,0,column?.25:.70));camera.lookAt(center);camera.updateWorldMatrix(true,false);ship.renderer.setSize(600,450,false);
    const frames=[];for(const enabled of [0,1]){
     layer.strength.value=enabled;ship.renderer.render(ship.scene,camera);const canvas=document.createElement('canvas');canvas.width=600;canvas.height=450;const c=canvas.getContext('2d');c.drawImage(ship.renderer.domElement,0,0);frames.push(c.getImageData(0,0,600,450).data);out.fillStyle='#0a1119';out.fillRect((column*2+enabled)*600,row*450,600,450);out.drawImage(canvas,(column*2+enabled)*600,row*450);out.fillStyle='#edce9a';out.font='14px Arial';out.fillText(['MOVIE','ORIGINAL','THIRD'][row]+' / '+(column?'CONNECTOR':'STRUT')+' / '+(enabled?'PLATING':'BASE METAL'),(column*2+enabled)*600+12,row*450+24);
    }
    let changed=0,total=0;for(let i=0;i<frames[0].length;i+=4){let delta=0;for(let k=0;k<3;k++)delta+=Math.abs(frames[0][i+k]-frames[1][i+k]);total+=delta;if(delta>6)changed++;}checks.push({model:['movie','original','third'][row],part:name,changed,mean:total/(600*450*3),glError:ship.renderer.getContext().getError()});
   }
   for(const [mesh,visible]of visibility)mesh.visible=visible;
  }
  layer.strength.value=1;ships[0].dispose();ships[2].dispose();
  if(layer.texture.image.width<=1||window.enterpriseHullSurfaceDetail!==layer)throw Error('The active original renderer must retain its shared plating texture');
  ships[1].dispose();if(window.enterpriseHullSurfaceDetail===layer)throw Error('The final renderer must release its shared plating texture');
  return {checks,image:sheet.toDataURL('image/png').split(',')[1]};
 });
 const preview=path.join(require('node:os').tmpdir(),'st-command-engine-strut-plating.png');fs.writeFileSync(preview,Buffer.from(result.image,'base64'));console.log('Preview: '+preview);console.log(JSON.stringify(result.checks));for(const c of result.checks){assert(c.changed>500&&c.mean>.1,'plating visibly affects '+c.model+' '+c.part);assert.equal(c.glError,0);}assert.deepEqual(errors,[]);console.log('Passed: visible hull plating on both engine struts and attachment connectors, valid surface mapping and clean shaders on all three models.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
