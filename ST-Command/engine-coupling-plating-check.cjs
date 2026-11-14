const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async()=>{const T=AlpineThree,checks=[],sheet=document.createElement('canvas');sheet.width=1000;sheet.height=900;const out=sheet.getContext('2d');
 for(const [row,factory]of [createMovieEnterpriseRenderer,createThirdEnterpriseRenderer,createEnterpriseRenderer].entries()){
  const ship=factory();await ship.ready;ship.model.updateWorldMatrix(true,true);const layer=enterpriseHullSurfaceDetail;
  for(const side of ['port','starboard'])for(const location of ['inboard','outboard']){const patch=ship.model.getObjectByName(side+'-'+location+'-coupling-gray-patch');if(!patch.material.userData.hullSurfaceDetail||patch.material.userData.hullPaintUnderlay!=='coupling-panel'||!patch.geometry.attributes.hullSurfaceUv)throw Error('Actual coupling panels must receive plating');if(patch.material.color.getHex()!==(location==='inboard'?0xa0ab9f:0x98a393))throw Error('Coupling paint color changed');}
  const patch=ship.model.getObjectByName('starboard-inboard-coupling-gray-patch'),p=patch.geometry.attributes.position,aim=new T.Vector3();let minZ=Infinity,maxZ=-Infinity;
  for(let i=0;i<p.count;i++){aim.add(patch.localToWorld(new T.Vector3().fromBufferAttribute(p,i)));minZ=Math.min(minZ,p.getZ(i));maxZ=Math.max(maxZ,p.getZ(i));}aim.multiplyScalar(1/p.count);
  ship.model.traverse(o=>{if(o.isMesh)o.visible=o===patch;});const half=(maxZ-minZ)*.55,camera=new T.OrthographicCamera(-half,half,half*.6,-half*.6,.0001,3);camera.position.copy(aim).add(new T.Vector3(-.25,-.13,0));camera.lookAt(aim);camera.updateWorldMatrix(true,false);
  const canvas=document.createElement('canvas');canvas.width=500;canvas.height=300;const ctx=canvas.getContext('2d');let before;
  for(const enabled of [0,1]){layer.strength.value=enabled;ship.renderer.setSize(500,300,false);ship.renderer.render(ship.scene,camera);ctx.clearRect(0,0,500,300);ctx.drawImage(ship.renderer.domElement,0,0);out.drawImage(canvas,enabled*500,row*300);const data=ctx.getImageData(0,0,500,300).data;if(!enabled)before=data;else{let changed=0,sum=0,visible=0;for(let i=0;i<data.length;i+=4)if(before[i+3]>250){visible++;const delta=Math.abs(data[i]-before[i])+Math.abs(data[i+1]-before[i+1])+Math.abs(data[i+2]-before[i+2]);sum+=delta;if(delta>3)changed++;}checks.push({variant:ship.model.userData.variant||'original',visible,changed,meanDifference:sum/Math.max(1,visible*3),glError:ship.renderer.getContext().getError()});}}
  layer.strength.value=1;ship.dispose();
 }
 return {checks,image:sheet.toDataURL('image/png').split(',')[1]};});
 for(const check of result.checks){assert(check.visible>1000,'actual panel must be visible');assert(check.changed>500&&check.meanDifference>.5,'plating must be visible on the actual colored panel');assert.equal(check.glError,0);}assert.deepEqual(errors,[]);
 const preview=path.join(require('node:os').tmpdir(),'st-command-coupling-plating.png');require('node:fs').writeFileSync(preview,Buffer.from(result.image,'base64'));console.log(JSON.stringify(result.checks));console.log(preview);
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
