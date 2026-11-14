const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
 await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async()=>{
  const T=AlpineThree,results=[];
  for(const factory of [createMovieEnterpriseRenderer,createThirdEnterpriseRenderer]){
   const ship=factory();await ship.ready;ship.model.updateWorldMatrix(true,true);
   const tube=ship.model.getObjectByName('starboard-engine-outer-tube'),material=tube.material[0],layer=enterpriseHullSurfaceDetail;
   // A uniform brown test coat isolates plating on actual front-engine UVs.
   material.map=null;material.color.setHex(0x956a48);material.needsUpdate=true;
   ship.model.traverse(o=>{if(o.isMesh)o.visible=o===tube;});
   const aim=tube.localToWorld(new T.Vector3(.087,-.68,0)),camera=new T.OrthographicCamera(-.045,.045,.03375,-.03375,.0001,2);
   camera.position.copy(aim).add(new T.Vector3(.20,0,0));camera.lookAt(aim);camera.updateWorldMatrix(true,false);
   const canvas=document.createElement('canvas');canvas.width=400;canvas.height=300;const ctx=canvas.getContext('2d');
   function capture(strength){layer.strength.value=strength;ship.renderer.setSize(400,300,false);ship.renderer.render(ship.scene,camera);ctx.clearRect(0,0,400,300);ctx.drawImage(ship.renderer.domElement,0,0);return ctx.getImageData(0,0,400,300).data;}
   const off=capture(0),on=capture(1);let count=0,difference=0,warm=0;
   for(let i=0;i<off.length;i+=4)if(off[i+3]>250&&off[i]>off[i+1]*1.1&&off[i+1]>off[i+2]*1.1){count++;difference+=Math.abs(off[i]-on[i])+Math.abs(off[i+1]-on[i+1])+Math.abs(off[i+2]-on[i+2]);if(on[i]>on[i+1]*1.1&&on[i+1]>on[i+2]*1.1)warm++;}
   results.push({variant:ship.model.userData.variant,count,meanDifference:difference/Math.max(1,count*3),warmFraction:warm/Math.max(1,count),glError:ship.renderer.getContext().getError()});
   layer.strength.value=1;ship.dispose();
  }
  return results;
 });
 for(const r of result){assert(r.count>10000,'front brown coating must be visible');assert(r.meanDifference>.5,'plating must visibly affect front brown pixels');assert(r.warmFraction>.98,'plating must preserve the brown hue');assert.equal(r.glError,0);}
 assert.deepEqual(errors,[]);console.log(JSON.stringify(result));
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
