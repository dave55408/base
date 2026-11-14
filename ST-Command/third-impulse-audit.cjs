const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram|compile/i.test(m.text()))errors.push(m.text());});
 await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async()=>{
  const ship=createThirdEnterpriseRenderer();await ship.ready;ship.model.updateWorldMatrix(true,true);const T=AlpineThree;
  const housing=ship.model.getObjectByName('movie-impulse-housing'),ridge=ship.model.getObjectByName('movie-impulse-dorsal-ridge');
  function bounds(mesh){const p=mesh.geometry.attributes.position,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).toArray();for(let k=0;k<3;k++){min[k]=Math.min(min[k],v[k]);max[k]=Math.max(max[k],v[k]);}}return {min,max};}
  let finite=true;ship.model.getObjectByName('movie-impulse-assembly').traverse(o=>{if(o.isMesh)for(const v of o.geometry.attributes.position.array)if(!Number.isFinite(v))finite=false;});
  const outlets=['port','starboard'].map(side=>{const o=ship.model.getObjectByName(side+'-impulse-outlet');return {position:o.position.toArray(),color:o.material.color.getHex(),bounds:bounds(o)};});
  const grateGroup=ship.model.getObjectByName('recessed-impulse-grates');
  if(grateGroup.children.filter(o=>o.name.includes('-grate-')).length!==38)throw Error('Both recessed outlets need real grille bars');
  if(grateGroup.userData.recessDepth<.005)throw Error('Impulse grates must have real depth');
  const dot=ship.model.getObjectByName('movie-impulse-center-port');
  const hp=housing.geometry.attributes.position;let frontHalf=0,rearHalf=0,frontSeamError=0,frontTop=-Infinity;
  for(let i=0;i<hp.count;i++){
   if(Math.abs(hp.getZ(i)+.828)<1e-6)rearHalf=Math.max(rearHalf,Math.abs(hp.getX(i)));
   else{frontHalf=Math.max(frontHalf,Math.abs(hp.getX(i)));frontSeamError=Math.max(frontSeamError,Math.abs(Math.hypot(hp.getX(i),hp.getZ(i)+1.53)-.674));frontTop=Math.max(frontTop,hp.getY(i));}
  }
  const rp=ridge.geometry.attributes.position,spine=ridge.geometry.userData.impulseSpine;let tipWidth=0;
  if(Math.abs(spine.halfWidth*2-(.061*2-.062))>1e-9)throw Error('Ridge must fill the gap between the grate openings');
  if(ridge.material[1].color.getHex()!==housing.material.color.getHex())throw Error('Aft end must match the impulse housing gray');
  const endGroups=ridge.geometry.groups.filter(g=>g.materialIndex===1);if(endGroups.length!==2)throw Error('Both rounded cap and wall cap need the housing finish');
  let rearCapBottom=Infinity,capNormalError=0;const rn=ridge.geometry.attributes.normal;
  for(let i=spine.capStart;i<spine.capStart+spine.capCount;i++){rearCapBottom=Math.min(rearCapBottom,rp.getY(i));capNormalError=Math.max(capNormalError,Math.abs(rn.getX(i)),Math.abs(rn.getY(i)),Math.abs(1-rn.getZ(i)));}
  let halfCircleError=0,joinError=0;
  const capCenterY=rp.getY(spine.capCenter);
  for(let n=0;n<=spine.arcSegments;n++){
   const index=spine.capStart+n;halfCircleError=Math.max(halfCircleError,Math.abs(Math.hypot(rp.getX(index)/spine.halfWidth,(rp.getY(index)-capCenterY)/spine.height)-1));
   for(const axis of ['getX','getY','getZ'])joinError=Math.max(joinError,Math.abs(rp[axis](index)-rp[axis](n)));
  }
  let tipZ=Infinity;for(let i=0;i<rp.count;i++)tipZ=Math.min(tipZ,rp.getZ(i));
  for(let i=0;i<rp.count;i++)if(Math.abs(rp.getZ(i)-tipZ)<1e-7)tipWidth=Math.max(tipWidth,Math.abs(rp.getX(i)));
  let wallEnd=Infinity;for(let i=spine.crestStart;i<spine.crestCapStart;i++)wallEnd=Math.min(wallEnd,rp.getZ(i));
  if(Math.abs(wallEnd-spine.lineEndZ)>1e-7||Math.abs(spine.lineEndZ-(-1.53+(.820-.5)*1.38))>1e-9)throw Error('Wall must stop exactly at the painted red-line endpoints');
  if(Math.abs(spine.crownY-(.380+.065+(.038-.065)*(.400-.36)/(.57-.36)+.0004))>1e-9||Math.abs(spine.crestBottom-(spine.housingRoof+.017))>1e-9)throw Error('Wall elevation must remain unchanged');
  let crownError=0;for(const i of spine.crestTopIndices)crownError=Math.max(crownError,Math.abs(rp.getY(i)-spine.crownY));
  if(!(spine.baseY<spine.housingRoof&&spine.bodyCrownY<spine.crownY&&spine.crestWidth<.006))throw Error('Rounded base must be embedded with a narrow rectangular crest above it');
  if(Math.abs(spine.mergeZ-spine.lineEndZ)>.008)throw Error('Ridge must reach the ends of the red lines before merging into the saucer');
  if(crownError>1e-7)throw Error('Ridge crown must stay horizontal from the aft cap forward');
  if(!(spine.mergeZ<spine.rearZ&&spine.mergeZ>spine.tipZ))throw Error('Rising saucer must absorb the ridge before its rounded endpoint');
  const out=document.createElement('canvas');out.width=1400;out.height=2800;const c=out.getContext('2d');
  const views=[[[0,.60,.6],[0,.425,-1.03]],[[0,3,-1.13],[0,.43,-1.13]],null,null];
  for(let i=0;i<views.length;i++){
   const half=i===2?.070:i===3?.24:.48,cam=new T.OrthographicCamera(-half,half,half/2,-half/2,.001,100);
   if(i===2){const center=ridge.localToWorld(new T.Vector3(0,spine.baseY+spine.height/2,spine.rearZ));cam.position.copy(center).add(new T.Vector3(.045,.025,.24));cam.lookAt(center);}
   else if(i===3){const center=ridge.localToWorld(new T.Vector3(0,spine.baseY+.012,-1.01));cam.position.copy(center).add(new T.Vector3(.8,0,0));cam.lookAt(center);}
   else{cam.position.set(...views[i][0]);if(i===1)cam.up.set(-1,0,0);cam.lookAt(...views[i][1]);}
   ship.renderer.setSize(1400,700,false);ship.renderer.render(ship.scene,cam);
   c.fillStyle='#060b12';c.fillRect(0,i*700,1400,700);c.drawImage(ship.renderer.domElement,0,i*700);
  }
  for(let i=spine.capStart;i<spine.capStart+spine.capCount;i++){

   if(Math.abs(rn.getZ(i))>.5&&(Math.abs(rn.getX(i))>1e-6||Math.abs(rn.getY(i))>1e-6))throw Error('Impulse spine cap shares side normals');
  }
  const ridgeWidths=[0,1,2,3].map(row=>rp.getX(row*spine.ringSize)-rp.getX(row*spine.ringSize+spine.arcSegments));
  return {finite,halfCircleError,joinError,rearCapBottom,capNormalError,frontHalf,rearHalf,frontSeamError,frontTop,ridgeWidths,housingColor:housing.material.color.getHex(),tipWidth,housing:bounds(housing),ridge:bounds(ridge),saucer:bounds(ship.model.getObjectByName('movie-saucer')),central:bounds(ship.model.getObjectByName('upper-saucer-teardrop')),outlets,dot:{position:dot.position.toArray(),color:dot.material.color.getHex()},glError:ship.renderer.getContext().getError(),image:out.toDataURL('image/png')};
 });
 assert(result.finite);assert(result.halfCircleError<2e-6,'aft end retains a smooth rounded profile at the taller height');assert(result.joinError<1e-7,'cap perimeter joins the ridge without a gap');assert.equal(result.glError,0);assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(__dirname,'preview-third-impulse.png'),Buffer.from(result.image.split(',')[1],'base64'));
 console.log('Passed: finite THIRD MODEL impulse geometry, rounded base embeds into the roof with a raised crest, separate cap normals and WebGL render.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
