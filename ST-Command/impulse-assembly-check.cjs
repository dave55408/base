const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram|compile/i.test(m.text()))errors.push(m.text());});
 await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async()=>{
  const ship=createMovieEnterpriseRenderer();await ship.ready;ship.model.updateWorldMatrix(true,true);const T=AlpineThree;
  const housing=ship.model.getObjectByName('movie-impulse-housing'),ridge=ship.model.getObjectByName('movie-impulse-dorsal-ridge');
  function bounds(mesh){const p=mesh.geometry.attributes.position,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).toArray();for(let k=0;k<3;k++){min[k]=Math.min(min[k],v[k]);max[k]=Math.max(max[k],v[k]);}}return {min,max};}
  let finite=true;ship.model.getObjectByName('movie-impulse-assembly').traverse(o=>{if(o.isMesh)for(const v of o.geometry.attributes.position.array)if(!Number.isFinite(v))finite=false;});
  const outlets=['port','starboard'].map(side=>{const o=ship.model.getObjectByName(side+'-impulse-outlet');return {position:o.position.toArray(),color:o.material.color.getHex(),bounds:bounds(o)};});
  const dot=ship.model.getObjectByName('movie-impulse-center-port');
  const hp=housing.geometry.attributes.position;let frontHalf=0,rearHalf=0,frontSeamError=0,frontTop=-Infinity;
  for(let i=0;i<hp.count;i++){
   if(Math.abs(hp.getZ(i)+.828)<1e-6)rearHalf=Math.max(rearHalf,Math.abs(hp.getX(i)));
   else{frontHalf=Math.max(frontHalf,Math.abs(hp.getX(i)));frontSeamError=Math.max(frontSeamError,Math.abs(Math.hypot(hp.getX(i),hp.getZ(i)+1.53)-.674));frontTop=Math.max(frontTop,hp.getY(i));}
  }
  const rp=ridge.geometry.attributes.position;let tipWidth=0;
  let rearCapBottom=Infinity,capNormalError=0;const rn=ridge.geometry.attributes.normal;
  for(let i=rp.count-4;i<rp.count;i++){rearCapBottom=Math.min(rearCapBottom,rp.getY(i));capNormalError=Math.max(capNormalError,Math.abs(rn.getX(i)),Math.abs(rn.getY(i)),Math.abs(1-rn.getZ(i)));}
  let tipZ=Infinity;for(let i=0;i<rp.count;i++)tipZ=Math.min(tipZ,rp.getZ(i));
  for(let i=0;i<rp.count;i++)if(Math.abs(rp.getZ(i)-tipZ)<1e-7)tipWidth=Math.max(tipWidth,Math.abs(rp.getX(i)));
  const out=document.createElement('canvas');out.width=1400;out.height=1400;const c=out.getContext('2d');
  const views=[[[0,.60,.6],[0,.425,-1.03]],[[0,3,-1.13],[0,.43,-1.13]]];
  for(let i=0;i<views.length;i++){
   const cam=new T.OrthographicCamera(-.48,.48,.24,-.24,.01,100);cam.position.set(...views[i][0]);if(i===1)cam.up.set(-1,0,0);cam.lookAt(...views[i][1]);ship.renderer.setSize(1400,700,false);ship.renderer.render(ship.scene,cam);
   c.fillStyle='#060b12';c.fillRect(0,i*700,1400,700);c.drawImage(ship.renderer.domElement,0,i*700);
  }
  const ridgeWidths=[0,1,2,3].map(row=>rp.getX(row*4+2)-rp.getX(row*4+1));
  return {finite,rearCapBottom,capNormalError,frontHalf,rearHalf,frontSeamError,frontTop,ridgeWidths,housingColor:housing.material.color.getHex(),tipWidth,housing:bounds(housing),ridge:bounds(ridge),saucer:bounds(ship.model.getObjectByName('movie-saucer')),central:bounds(ship.model.getObjectByName('upper-saucer-teardrop')),outlets,dot:{position:dot.position.toArray(),color:dot.material.color.getHex()},glError:ship.renderer.getContext().getError(),image:out.toDataURL('image/png')};
 });
 assert(result.finite);assert.equal(result.glError,0);assert.deepEqual(errors,[]);
 const h=result.housing;assert(result.rearHalf*2>.26&&result.rearHalf*2<.30,'rear face is almost as wide as the main cylinder');
 assert(result.frontHalf>result.rearHalf+.03,'housing flares into the saucer in plan view');
 assert(Math.abs(result.outlets[0].position[0]+result.outlets[1].position[0])<1e-6,'outlets are symmetric');
 for(const o of result.outlets){assert.equal(o.color,0x090e14);assert(o.bounds.max[2]>h.max[2],'black outlet faces are visible aft of the housing');}
 assert.equal(result.dot.position[0],0);assert.equal(result.dot.color,0x090e14);
 const saucerCenter=(result.saucer.max[2]+result.saucer.min[2])/2;
 assert(result.frontSeamError<1e-6&&Math.abs(result.frontTop-.409)<1e-6,'impulse housing ends flush at the saucer rim');
 assert.equal(result.housingColor,0x99a49b,'housing uses a slightly darker gray');
 assert(Math.abs(result.ridge.max[2]-h.max[2])<1e-6,'ridge reaches the outer edge of the impulse assembly');
 assert(result.ridgeWidths.every(w=>Math.abs(w-.034)<1e-6),'ridge has a single narrow width along its straight length');
 assert(result.ridge.max[0]-result.ridge.min[0]<.035,'ridge fits between the outlined deck panels');
 assert(Math.abs(result.ridge.min[2]-saucerCenter-.400)<1e-6,'ridge extends to the longer endpoint in the green outline');
 assert(result.tipWidth<.001,'ridge closes in a rounded nose');
 assert(result.rearCapBottom>=.405-1e-6,'ridge rear cap does not overlap the impulse face');
 assert(result.capNormalError<1e-6,'rear cap shading is independent of the ridge top');
 fs.writeFileSync(path.join(__dirname,'preview-impulse-assembly.png'),Buffer.from(result.image.split(',')[1],'base64'));
 console.log('Passed: flush impulse housing, retained ridge dimensions, non-overlapping rear cap, clean cap normals and WebGL render.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
