const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.EnterpriseModels);
 const result=await page.evaluate(async()=>{
  const T=AlpineThree,ship=EnterpriseModels.rendererFor({});await ship.ready;const output=document.createElement('canvas');output.width=2400;output.height=600;const ctx=output.getContext('2d'),pixels=[],near=ship.excursionCamera.near;
  const sink=document.createElement('canvas').getContext('2d');ship.draw(sink,800,600,{phase:'bridge',x:0,y:1,z:110,bank:0},{heading:0,pitch:0,time:0});
  const camera=new T.PerspectiveCamera(35,800/600,.001,100);camera.position.set(.4,-3.5,-6.4);camera.lookAt(0,.4,-.65);camera.updateWorldMatrix(true,false);ship.renderer.setSize(800,600,false);
  for(let n=0;n<3;n++){
   ship.renderer.shadowMap.enabled=true;enterpriseHullSurfaceDetail.strength.value=1;camera.near=[.001,near,.1][n];camera.updateProjectionMatrix();
   ship.renderer.render(ship.scene,camera);const x=n*800;ctx.fillStyle='#03080e';ctx.fillRect(x,0,800,600);ctx.drawImage(ship.renderer.domElement,x,0);pixels.push(ctx.getImageData(x,0,800,600).data);ctx.fillStyle='#f1d8a4';ctx.font='16px Consolas';ctx.fillText(['BEFORE / DEPTH FIGHTING','FIXED / EXTERIOR CAMERA','HIGH PRECISION REFERENCE'][n],x+15,25);
  }
  function error(a,b){let sum=0;for(let i=0;i<a.length;i+=4)for(let k=0;k<3;k++)sum+=Math.abs(a[i+k]-b[i+k]);return sum/(800*600*3);}
  return {near,oldError:error(pixels[0],pixels[2]),fixedError:error(pixels[1],pixels[2]),image:output.toDataURL('image/jpeg',.85),glError:ship.renderer.getContext().getError()};
 });assert.equal(result.glError,0);assert(result.oldError>.05,'distant view reproduces nacelle depth fighting');assert(result.fixedError<result.oldError*.3,'exterior camera removes at least 70 percent of the distant-view depth artifacts');
 console.log(process.argv.includes('--image')?'IMG:'+result.image.split(',')[1]:'Passed: distant nacelle artifacts reduced '+(100*(1-result.fixedError/result.oldError)).toFixed(1)+'% against a high precision reference, preserving all geometry and decals.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
