const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async()=>{
  const ship=createMovieEnterpriseRenderer();await ship.ready;ship.model.updateWorldMatrix(true,true);
  let finite=true;ship.model.traverse(o=>{if(!o.isMesh)return;for(const key of ['position','normal','uv']){const a=o.geometry.attributes[key];if(a)for(const v of a.array)if(!Number.isFinite(v))finite=false;}});
  const T=AlpineThree,hull=ship.model.getObjectByName('secondary-hull'),p=hull.geometry.attributes.position;
  const front=[],top=[];
  for(let i=0;i<p.count;i++){
   const z=p.getY(i),y=-p.getZ(i);
   if(Math.abs(z+1.15)<1e-6)front.push([p.getX(i),y,z]);
   if(Math.abs(p.getX(i))<1e-6&&y>.14&&z< -1.10)top.push([y,z]);
  }
  const collar=ship.model.getObjectByName('movie-deflector-collar');
  const baseRing=ship.model.getObjectByName('movie-deflector-base-ring'),frontRim=ship.model.getObjectByName('movie-deflector-retaining-rim');
  function frontZ(mesh){const a=mesh.geometry.attributes.position;let min=Infinity;for(let i=0;i<a.count;i++)min=Math.min(min,new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld).z);return min;}
  const out=document.createElement('canvas');out.width=1400;out.height=1600;const c=out.getContext('2d');
  const views=[[[5,.14,-1.12],[0,.14,-1.12]],[[4,.30,-2.2],[0,.14,-1.17]]];
  for(let i=0;i<views.length;i++){
   const cam=new T.OrthographicCamera(-.54,.54,.54*800/1400,-.54*800/1400,.01,100);
   cam.position.set(...views[i][0]);cam.lookAt(...views[i][1]);
   ship.renderer.setSize(1400,800,false);ship.renderer.render(ship.scene,cam);
   c.fillStyle='#060b12';c.fillRect(0,i*800,1400,800);c.drawImage(ship.renderer.domElement,0,i*800);
  }
  const tabs=['port-raised-forward-pennant-pad','starboard-raised-forward-pennant-pad','ventral-pad-surface'].map(name=>frontZ(ship.model.getObjectByName(name)));
  const bottom=ship.model.getObjectByName('ventral-pad-surface').geometry.attributes.position;
  let backingShapeError=0;
  for(const [side,axis] of [['port',-Math.PI/2],['starboard',Math.PI/2]]){
   const sidePad=ship.model.getObjectByName(side+'-raised-forward-pennant-pad').geometry.attributes.position;
   if(sidePad.count!==bottom.count)backingShapeError=Infinity;
   for(let i=0;i<Math.min(sidePad.count,bottom.count);i++){
    const x=sidePad.getX(i),z=sidePad.getZ(i);
    backingShapeError=Math.max(backingShapeError,Math.abs(x*Math.cos(axis)-z*Math.sin(axis)-bottom.getX(i)),Math.abs(x*Math.sin(axis)+z*Math.cos(axis)-bottom.getZ(i)),Math.abs(sidePad.getY(i)-bottom.getY(i)));
   }
   const walls=ship.model.getObjectByName(side+'-raised-forward-pennant-pad').children[0].geometry.attributes.position,bottomWalls=ship.model.getObjectByName('ventral-pad-surface').children[0].geometry.attributes.position;
   if(walls.count!==bottomWalls.count)backingShapeError=Infinity;
   for(let i=0;i<Math.min(walls.count,bottomWalls.count);i++){
    const x=walls.getX(i),z=walls.getZ(i);
    backingShapeError=Math.max(backingShapeError,Math.abs(x*Math.cos(axis)-z*Math.sin(axis)-bottomWalls.getX(i)),Math.abs(x*Math.sin(axis)+z*Math.cos(axis)-bottomWalls.getZ(i)),Math.abs(walls.getY(i)-bottomWalls.getY(i)));
   }
  }
  let shoulderMin=Infinity,shoulderMax=-Infinity;
  for(let i=0;i<bottom.count;i++)if(bottom.getY(i)>-1.19&&bottom.getY(i)<-1.125){shoulderMin=Math.min(shoulderMin,bottom.getZ(i));shoulderMax=Math.max(shoulderMax,bottom.getZ(i));}
  const cp=collar.geometry.attributes.position;let collarRadius=0;
  let collarRearRadius=0,collarFrontRadius=0;
  for(let i=0;i<cp.count;i++)collarRadius=Math.max(collarRadius,Math.abs(cp.getX(i)*collar.scale.x*.90));
  for(let i=0;i<cp.count;i++){
   const r=Math.hypot(cp.getX(i),cp.getZ(i));
   if(Math.abs(cp.getY(i)+1.130)<1e-6)collarRearRadius=Math.max(collarRearRadius,r);
   if(Math.abs(cp.getY(i)+1.211)<1e-6)collarFrontRadius=Math.max(collarFrontRadius,r);
  }
  const closeCam=new T.OrthographicCamera(-.23,.23,.19,-.19,.01,100);closeCam.position.set(1.8,.20,-1.65);closeCam.lookAt(0,0,-1.04);ship.renderer.setSize(1200,1000,false);ship.renderer.render(ship.scene,closeCam);
  const close=document.createElement('canvas');close.width=1200;close.height=1000;const cc=close.getContext('2d');cc.fillStyle='#060b12';cc.fillRect(0,0,1200,1000);cc.drawImage(ship.renderer.domElement,0,0);
  return {finite,front,top,tabs,backingShapeError,shoulderStep:shoulderMax-shoulderMin,baseRingMatches:baseRing.material===frontRim.material,baseRingFront:frontZ(baseRing),collarRearRadius,collarFrontRadius,collarRadius,collarFront:frontZ(collar),bodyFront:frontZ(hull),glError:ship.renderer.getContext().getError(),image:out.toDataURL('image/png'),closeImage:close.toDataURL('image/png')};
 });
 assert(result.front.some(([x,y])=>Math.abs(x)<1e-6&&y>.145),'full-height forward face reaches the upper hull');
 assert(result.top.length>=3&&result.top.every(([y])=>y>=.146),'upper cylinder continues forward with only a small rounded shoulder');
 assert(result.collarFront<result.bodyFront-.03,'sensor collar projects forward from the body');
 assert(result.tabs.every(z=>Math.abs(z-result.collarFront-.023)<1e-6),'all three backings end at the same collar plane, .023 behind its front lip');
 assert(result.backingShapeError<1e-6,'both side faces and walls match the bottom backing after rotation');
 assert(result.shoulderStep<1e-6,'backing face crosses the hull shoulder without a step');
 assert(result.baseRingMatches,'collar base ring shares the bronze finish behind the dish');
 assert(Math.abs(result.baseRingFront-result.bodyFront+.003)<1e-6,'thin base ring sits at the collar-to-hull junction');
 assert(result.collarFrontRadius/result.collarRearRadius>.90&&result.collarFrontRadius/result.collarRearRadius<.94,'collar tapers slightly toward the dish');
 assert(Math.abs(result.collarRadius-.130)<1e-6,'collar reaches the annotated height relative to the .151-radius hull');
 assert(result.finite,'hull, collar, tabs and painted detail geometry remain finite');
 assert.equal(result.glError,0);assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(__dirname,'preview-forward-hull.png'),Buffer.from(result.image.split(',')[1],'base64'));
 fs.writeFileSync(path.join(__dirname,'preview-forward-hull-close.png'),Buffer.from(result.closeImage.split(',')[1],'base64'));
 console.log('Passed: identical backing faces and walls, no shoulder step, aligned collar endpoints, tapered collar and finite geometry.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
