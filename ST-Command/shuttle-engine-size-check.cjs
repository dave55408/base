const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
 const result=await page.evaluate(()=>{
  const T=AlpineThree;createClassFShuttle.engineScale=1;const old=createClassFShuttle(T);createClassFShuttle.engineScale=1.10;const enlarged=createClassFShuttle(T);
  function bounds(root){root.updateWorldMatrix(true,true);const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).toArray();for(let k=0;k<3;k++){min[k]=Math.min(min[k],v[k]);max[k]=Math.max(max[k],v[k]);}}});return {min,max,size:max.map((v,k)=>v-min[k])};}
  const engines=['port','starboard'].map(side=>({before:bounds(old.getObjectByName(side+'-class-f-engine-assembly')),after:bounds(enlarged.getObjectByName(side+'-class-f-engine-assembly'))}));
  const bodyBefore=bounds(old.getObjectByName('class-f-body-panel-1')),bodyAfter=bounds(enlarged.getObjectByName('class-f-body-panel-1'));
  STCommand.stop();STCommand.away.launchShuttle();STCommand.state.paused=true;
  const rear=STCommand.away.state.y-createClassFShuttle.aftExtent*(.162/3/3.20),wall=-.278*.85-.032;
  return {engines,bodyBefore,bodyAfter,clearance:rear-wall};
 });
 for(const engine of result.engines){for(let k=0;k<3;k++)assert(Math.abs(engine.after.size[k]/engine.before.size[k]-1.10)<1e-6,'engine dimensions grow ten percent');assert(Math.abs(engine.after.min[1]-engine.before.min[1])<1e-7,'engine remains at deck height');}
 assert.deepEqual(result.bodyAfter,result.bodyBefore,'shuttle body remains the same size');assert(result.clearance>=.000999,'longer engines retain one metre of launch clearance');
 console.log('Passed: both complete engines grow 10% in width, height and length, preserve deck contact and body size, and retain launch clearance.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
