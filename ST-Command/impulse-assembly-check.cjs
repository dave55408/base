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
  const backWall=ship.model.getObjectByName('impulse-room-back-wall');const outletBack={shader:backWall.material.isShaderMaterial,bounds:bounds(backWall)};
  const grateGroup=ship.model.getObjectByName('recessed-impulse-grates');
  if(grateGroup.children.filter(o=>o.name.includes('-grate-')).length!==38)throw Error('Both recessed outlets need real grille bars');
  if(grateGroup.userData.recessDepth<.005)throw Error('Impulse grates must have real depth');
  for(const bar of grateGroup.children.filter(o=>o.name.includes('-grate-')))if(bar.material.color.getHex()!==0x000000)throw Error('Impulse grate bars must be black');
  const chamberRoot=ship.model.getObjectByName('impulse-interior-room'),rooms=chamberRoot.children;
  if(chamberRoot.userData.sharedOutlets||rooms.length!==2)throw Error('Impulse outlets must have two independent rooms');
  const chamber=rooms[0],otherRoom=rooms[1],otherBack=otherRoom.getObjectByName('impulse-room-back-wall');
  for(const room of rooms){
   const walls=room.children.filter(o=>o.name==='impulse-room-side-wall'),back=room.getObjectByName('impulse-room-back-wall'),pane=room.getObjectByName('impulse-room-translucent-front-wall');
   if(room.userData.depth<.055||walls.length!==2||room.children.filter(o=>o.name==='impulse-room-deck').length!==2||walls.some(w=>Math.sign(w.position.x)!==Math.sign(back.position.x)))throw Error('Each outlet needs a deep enclosed room');
   if(!pane.material.transparent||pane.material.opacity!==.80||pane.userData.blur?.samples!==9)throw Error('Both rooms must retain their frosted 80 percent opaque walls');
   if(pane.geometry.parameters.width<.064||pane.geometry.parameters.height<.030)throw Error('Black panes must overlap every outer window edge to block unfiltered red leakage');
   for(const mesh of room.children.filter(o=>['impulse-room-back-wall','impulse-room-side-wall','impulse-room-deck'].includes(o.name)))if(mesh.material!==back.material||!mesh.geometry.attributes.roomPosition)throw Error('Room surfaces must share their own procedural shader');
  }
  if(backWall.material===otherBack.material||backWall.material.uniforms.uPulse===otherBack.material.uniforms.uPulse||backWall.material.uniforms.uTime===otherBack.material.uniforms.uTime)throw Error('Each room needs independent shader timing');
  grateGroup.userData.updateGlow(0);if(Math.abs(backWall.material.uniforms.uPulse.value-otherBack.material.uniforms.uPulse.value)<.1)throw Error('Room pulses must be slightly offset');
  grateGroup.userData.updateGlow(0);const leftStart=backWall.material.uniforms.uTime.value,rightStart=otherBack.material.uniforms.uTime.value;
  grateGroup.userData.updateGlow(1);if(backWall.material.uniforms.uTime.value<=leftStart||otherBack.material.uniforms.uTime.value>=rightStart)throw Error('Right impulse animation must run in reverse while the left runs forward');
  for(const room of rooms){const spec=room.userData,back=room.getObjectByName('impulse-room-back-wall');grateGroup.userData.updateGlow(1.2);const before=back.material.uniforms.uPulse.value;grateGroup.userData.updateGlow(1.2+spec.pulsePeriod);if(Math.abs(back.material.uniforms.uPulse.value-before)>1e-8)throw Error('Each pulse must repeat at its own period');}
  const back=backWall,emitter=ship.model.getObjectByName('impulse-room-red-emitter'),samples=[];
  for(const time of [0,1.25,3.75]){grateGroup.userData.updateGlow(time);samples.push(back.material.uniforms.uPulse.value);}
  if(!(samples[1]>samples[0]&&samples[0]>samples[2]&&samples[1]/samples[2]>1.8&&samples[2]>=.65&&Math.abs(samples[0]-1)<1e-8&&emitter.intensity>=.00000010&&emitter.intensity<.00000025))throw Error('Port-room glow must pulse while retaining red standby illumination');
  grateGroup.userData.updateGlow(6.25);if(Math.abs(back.material.uniforms.uPulse.value-samples[1])>1e-8)throw Error('Impulse pulse must retain its five-second period');grateGroup.userData.updateGlow(3.75);
  const paused=back.material.uniforms.uPulse.value;grateGroup.userData.updateGlow(3.75);if(back.material.uniforms.uPulse.value!==paused)throw Error('Pulse must pause with simulation time');grateGroup.userData.updateGlow(0);
  for(const mesh of [housing,ship.model.getObjectByName('movie-saucer')]){
   if(!mesh.geometry.userData.impulseChamberPassages)throw Error('Deep rooms need passages through the inner skins');
   const p=mesh.geometry.attributes.position,idx=mesh.geometry.index;for(const side of [-1,0,1])for(let i=0;i<(idx?idx.count:p.count);i+=3){const [a,b,c]=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,idx?idx.getX(i+k):i+k).add(mesh.position)),det=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);if(Math.abs(det)<1e-12)continue;const x=side*.061-a.x,y=.379-a.y,u=(x*(c.y-a.y)-(c.x-a.x)*y)/det,v=((b.x-a.x)*y-x*(b.y-a.y))/det,z=a.z+u*(b.z-a.z)+v*(c.z-a.z);if(u>1e-7&&v>1e-7&&u+v<1-1e-7&&z<-.834&&z>-.888)throw Error('Hull skin must not block the view into the deep chamber');}
  }
  const frontWall=ship.model.getObjectByName('impulse-room-translucent-front-wall');if(!frontWall?.material.transparent||frontWall.material.opacity!==.80||frontWall.material.color.getHex()!==0x000000||!frontWall.material.bumpMap?.isCanvasTexture||frontWall.material.roughness<.5||frontWall.material.depthWrite||Math.abs(frontWall.position.z-(-.8323))>1e-7)throw Error('Front wall must be black, frosted and eighty percent opaque immediately behind the grates');
  if(frontWall.userData.blur?.samples!==9||typeof frontWall.onBeforeRender!=='function')throw Error('Frosted front wall needs a subtle Gaussian transmission blur');
  for(const surface of chamber.children)if(surface.isMesh&&['impulse-room-back-wall','impulse-room-side-wall','impulse-room-deck'].includes(surface.name)&&(surface.material!==backWall.material||!surface.geometry.attributes.roomPosition))throw Error('Every room wall and floor must share the procedural glow shader');
  const diffuse=ship.model.getObjectByName('impulse-room-diffuse-red-glow');if(!diffuse?.material.isShaderMaterial||!diffuse.material.transparent||diffuse.material.depthWrite||diffuse.material.blending!==T.AdditiveBlending||diffuse.position.z<=backWall.position.z||diffuse.position.z>=frontWall.position.z||diffuse.material.uniforms.uPulse!==backWall.material.uniforms.uPulse)throw Error('Diffuse red glow must float in front of the back wall and share the slow pulse');
  const glow=backWall;if(!glow?.material.isShaderMaterial)throw Error('Impulse room needs a procedural red glow shader');
  const glowCenter=glow.getWorldPosition(new T.Vector3()),normal=glow.localToWorld(new T.Vector3(0,0,1)).sub(glowCenter).normalize(),noiseCamera=new T.OrthographicCamera(-.091,.091,.016,-.016,.001,1);noiseCamera.position.copy(glowCenter).addScaledVector(normal,.030);noiseCamera.lookAt(glowCenter);noiseCamera.updateWorldMatrix(true,false);
  const sampleCanvas=document.createElement('canvas');sampleCanvas.width=512;sampleCanvas.height=96;const sc=sampleCanvas.getContext('2d');
  function captureNoise(time){grateGroup.userData.updateGlow(time);ship.renderer.setSize(512,96,false);ship.renderer.render(ship.scene,noiseCamera);sc.clearRect(0,0,512,96);sc.drawImage(ship.renderer.domElement,0,0);return sc.getImageData(0,0,512,96).data;}
  const firstNoise=captureNoise(0),laterNoise=captureNoise(5),pausedNoise=captureNoise(5);let motion=0,pauseError=0,minRed=255,maxRed=0;for(let i=0;i<firstNoise.length;i+=4){motion+=Math.abs(firstNoise[i]-laterNoise[i]);pauseError+=Math.abs(laterNoise[i]-pausedNoise[i]);minRed=Math.min(minRed,firstNoise[i]);maxRed=Math.max(maxRed,firstNoise[i]);}
  if(motion<500||maxRed-minRed<5||pauseError>0)throw Error('Procedural red cloud must swirl spatially and pause with simulation time');grateGroup.userData.updateGlow(0);
  const dot=ship.model.getObjectByName('movie-impulse-center-port');
  if(!dot.userData.recess||Math.abs(dot.position.z+.0001-(dot.userData.recess.faceZ-dot.userData.recess.depth))>1e-8)throw Error('Black center port must sit behind the housing face with a shallow bevel');
  const hp=housing.geometry.attributes.position;let frontHalf=0,rearHalf=0,frontSeamError=0,frontTop=-Infinity;
  for(let i=0;i<hp.count;i++){
   if(Math.abs(hp.getZ(i)+.828)<1e-6)rearHalf=Math.max(rearHalf,Math.abs(hp.getX(i)));
   else{frontHalf=Math.max(frontHalf,Math.abs(hp.getX(i)));if(hp.getY(i)>.408999)frontSeamError=Math.max(frontSeamError,Math.abs(Math.hypot(hp.getX(i),hp.getZ(i)+1.53)-.674));frontTop=Math.max(frontTop,hp.getY(i));}
  }
  const rp=ridge.geometry.attributes.position,spine=ridge.geometry.userData.impulseSpine;let tipWidth=0;
  if(Math.abs(spine.halfWidth*2-(.061*2-.062)*.90)>1e-9)throw Error('Ridge must be ten percent narrower than the grate gap');
  if(ridge.material[1].color.getHex()!==housing.material.color.getHex())throw Error('Aft end must match the impulse housing gray');
  const endGroups=ridge.geometry.groups.filter(g=>g.materialIndex===1);if(endGroups.length!==2)throw Error('Both rounded cap and wall cap need the housing finish');
  let rearCapBottom=Infinity,capNormalError=0;const rn=ridge.geometry.attributes.normal;
  for(let i=spine.capStart;i<spine.capStart+spine.capCount;i++){rearCapBottom=Math.min(rearCapBottom,rp.getY(i));capNormalError=Math.max(capNormalError,Math.abs(rn.getX(i)),Math.abs(rn.getY(i)),Math.abs(1-rn.getZ(i)));}
  let halfCircleError=0,joinError=0;
  const capCenterY=rp.getY(spine.capCenter);
  for(let n=0;n<=spine.arcSegments;n++){
   const index=spine.capStart+n;halfCircleError=Math.max(halfCircleError,Math.abs(Math.hypot(rp.getX(index)/spine.halfWidth,(rp.getY(index)-capCenterY)/spine.rearHeight)-1));
   for(const axis of ['getX','getY','getZ'])joinError=Math.max(joinError,Math.abs(rp[axis](index)-rp[axis](n)));
  }
  let tipZ=Infinity;for(let i=0;i<spine.capStart;i++)tipZ=Math.min(tipZ,rp.getZ(i));
  for(let i=0;i<spine.capStart;i++)if(Math.abs(rp.getZ(i)-tipZ)<1e-7)tipWidth=Math.max(tipWidth,Math.abs(rp.getX(i)));
  let wallEnd=Infinity;for(let i=spine.crestStart;i<spine.crestCapStart;i++)wallEnd=Math.min(wallEnd,rp.getZ(i));
  if(Math.abs(wallEnd-spine.crestEndZ)>1e-7||Math.abs(spine.lineEndZ-(spine.rearZ+(-1.53+(.820-.5)*1.38-spine.rearZ)*1.20))>1e-9)throw Error('Wall must extend beneath the saucer while preserving the rounded ridge length');
  if(Math.abs(spine.crownY-(.380+.078+(.065-.078)*(.34792-.18)/(.36-.18)+.0004))>1e-9||Math.abs(spine.crestBottom-(spine.housingRoof+.017))>1e-9)throw Error('Wall crown must clear the rising deck and preserve its aft base');
  let crownError=0;for(const i of spine.crestTopIndices){const t=Math.max(0,Math.min(1,(spine.rearZ-rp.getZ(i))/(spine.rearZ-spine.domeRearZ))),expected=spine.crestRearY+(spine.crestFrontY-spine.crestRearY)*t;crownError=Math.max(crownError,Math.abs(rp.getY(i)-expected));}
  if(spine.wallLevel||spine.crestEndZ>=spine.domeRearZ||spine.domeRearZ>=spine.lineEndZ)throw Error('Rising wall must reach the dome');
  if(Math.abs((spine.crestRearY-spine.rearCrownY)*2-(spine.crownY-spine.rearCrownY))>1e-8)throw Error('Rear exposed wall height must be halved');
  if(Math.abs((spine.frontBodyCrownY-spine.domeBaseY)/spine.domeWallHeight-.10)>1e-8||Math.abs(spine.crestFrontY-spine.frontBodyCrownY-.0005)>1e-8)throw Error('Ridge must meet ten percent up the dome with the wall slightly taller');
  if(Math.abs(spine.rearHeight-spine.halfWidth)>1e-9||spine.rearCrownY>=spine.crownY)throw Error('Aft end must be semicircular and rise toward the fixed front');
  for(let row=0;row<spine.sectionCount;row++){const j=row*spine.ringSize+spine.arcSegments/2,z=rp.getZ(j),t=Math.max(0,Math.min(1,(spine.rearZ-z)/(spine.rearZ-spine.domeRearZ))),expected=spine.rearCrownY+(spine.frontBodyCrownY-spine.rearCrownY)*t;if(Math.abs(rp.getY(j)-expected)>2e-7)throw Error('Ridge crown must rise in one straight line from the original aft height to the dome');}
  if(Math.abs(tipZ-spine.crestEndZ)>1e-7||spine.frontBodyCrownY<=spine.bodyCrownY)throw Error('Rounded ridge and wall must both extend to the first dome');
  if(spine.noseCenter>spine.domeRearZ-.01||spine.crestEndZ>spine.domeRearZ-spine.halfWidth-.01)throw Error('Full-width ridge and wall must penetrate the dome shoulder to close the join');
  for(const side of ['port','starboard']){const stripe=ship.model.getObjectByName(side+'-ridge-red-stripe'),spec=stripe?.userData;if(!spec?.projected||Math.abs(spec.originalCenterX-(side==='port'?-.00966:.00966))>1e-9||spec.frontZ!==-1.3506||spec.rearZ!==-1.0884||stripe.material.color.getHex()!==0x9e3029)throw Error('Red stripes must keep their original footprints while painting the new ridge');}
  if(!(spine.baseY<spine.housingRoof&&spine.bodyCrownY<spine.crownY&&spine.crestWidth<.006))throw Error('Rounded base must be embedded with a narrow rectangular crest above it');
  if(Math.abs(spine.mergeZ-spine.lineEndZ)>.008)throw Error('Ridge must reach its extended endpoint before merging into the saucer');
  if(crownError>1e-7)throw Error('Wall crown must rise in a straight line to the dome');
  if(!(spine.mergeZ<spine.rearZ&&spine.mergeZ>spine.tipZ))throw Error('Rounded ridge must retain its existing aft merge and extend toward the dome');
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
  const ridgeWidths=[0,1,2,3].map(row=>rp.getX(row*spine.ringSize)-rp.getX(row*spine.ringSize+spine.arcSegments));
  return {finite,halfCircleError,joinError,rearCapBottom,capNormalError,frontHalf,rearHalf,frontSeamError,frontTop,ridgeWidths,housingColor:housing.material.color.getHex(),tipWidth,housing:bounds(housing),ridge:bounds(ridge),wallNose:ridge.localToWorld(new T.Vector3(0,0,spine.crestEndZ)).z,saucer:bounds(ship.model.getObjectByName('movie-saucer')),central:bounds(ship.model.getObjectByName('upper-saucer-teardrop')),outletBack,dot:{position:dot.position.toArray(),color:dot.material.color.getHex()},glError:ship.renderer.getContext().getError(),image:out.toDataURL('image/png')};
 });
 assert(result.finite);assert(result.halfCircleError<2e-6,'aft end retains a semicircular profile');assert(result.joinError<1e-7,'cap perimeter joins the ridge without a gap');assert.equal(result.glError,0);assert.deepEqual(errors,[]);
 const h=result.housing;assert(result.rearHalf*2>.26&&result.rearHalf*2<.30,'rear face is almost as wide as the main cylinder');
 assert(result.frontHalf>result.rearHalf+.03,'housing flares into the saucer in plan view');
 assert(result.outletBack.shader);assert(result.outletBack.bounds.max[2]<h.max[2]-.055,'room back wall stays deep behind its grate');
 assert.equal(result.dot.position[0],0);assert.equal(result.dot.color,0x090e14);
 const saucerCenter=(result.saucer.max[2]+result.saucer.min[2])/2;
 assert(result.frontSeamError<2e-5&&Math.abs(result.frontTop-.409)<1e-6,'impulse housing ends flush at the saucer rim');
 assert.equal(result.housingColor,0x5a6065,'housing uses the lighter charcoal gray metal finish');
 assert(Math.abs(result.ridge.max[2]-h.max[2])<1e-6,'ridge reaches the outer edge of the impulse assembly');
 assert(result.ridgeWidths.every(w=>Math.abs(w-.054)<1e-6),'ridge is ten percent narrower than the impulse grate gap');
 assert(Math.abs(result.ridge.max[0]-result.ridge.min[0]-.054)<1e-6,'ridge stays centered inside the grate gap');
 assert(Math.abs(result.ridge.min[2]-result.wallNose)<1e-6,'wall nose is buried beneath the saucer beyond the visible merge');
 assert(result.tipWidth<=.002751,'rounded base closes beneath the deck');
 assert(result.rearCapBottom<.405-.003,'rounded ridge is sunk into the impulse housing');
 assert(result.capNormalError<1e-6,'rear cap shading is independent of the ridge top');
 fs.writeFileSync(path.join(__dirname,'preview-impulse-assembly.png'),Buffer.from(result.image.split(',')[1],'base64'));
 console.log('Passed: flush impulse housing, embedded rounded ridge, rising crest with preserved front, clean cap normals and WebGL render.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
