const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage();
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.createMovieEnterpriseRenderer);
 const result=await page.evaluate(async()=>{
  const ship=createMovieEnterpriseRenderer();await ship.ready;ship.model.updateMatrixWorld(true);const T=AlpineThree;
  function bounds(root){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).toArray();for(let k=0;k<3;k++){min[k]=Math.min(min[k],v[k]);max[k]=Math.max(max[k],v[k]);}}});return {min,max};}
  const saucer=bounds(ship.model.getObjectByName('movie-saucer')),diameter=saucer.max[0]-saucer.min[0];
  const engines=['port','starboard'].map(side=>bounds(ship.model.getObjectByName(side+'-movie-nacelle')));
  for(const side of ['port','starboard']){
    const inboardFin=bounds(ship.model.getObjectByName(side+'-inboard-engine-fin')),pylon=bounds(ship.model.getObjectByName(side+'-engine-strut'));
    if(Math.abs(inboardFin.min[2]-(pylon.min[2]+pylon.max[2])/2)>1e-6)throw new Error('Both inboard fin leading edges must bisect their pylons');
    for(const suffix of ['-engine-red-pylon-baffle','-engine-disk-front-glow','-dome-rear-backing'])if(ship.model.getObjectByName(side+suffix))throw new Error('Hollow engines must not contain disks or backing caps');
    for(const suffix of ['-engine-outer-tube','-dome-inner-housing']){const p=ship.model.getObjectByName(side+suffix).geometry.attributes.position;for(let i=0;i<p.count;i++)if(Math.hypot(p.getX(i),p.getZ(i))<.066)throw new Error('Inner and outer tubes must remain open-ended');}
    const center=ship.model.getObjectByName(side+'-engine-cap').getWorldPosition(new T.Vector3());
    for(const root of [ship.model.getObjectByName(side+'-engine-strut'),ship.model.getObjectByName(side+'-engine-pylon-shoe')])root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,index=o.geometry.index,n=index?index.count:p.count;for(let i=0;i<n;i+=3){const points=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(o.matrixWorld));for(let a=0;a<=4;a++)for(let b=0;b<=4-a;b++){const v=points[0].clone().multiplyScalar(a/4).addScaledVector(points[1],b/4).addScaledVector(points[2],1-(a+b)/4);if(Math.hypot(v.x-center.x,v.y-center.y)<.0774-.00005)throw new Error('Pylons, grilles and mounting shoes must stay outside the clear engine bore');}}});
    const bore=bounds(ship.model.getObjectByName(side+'-engine-outer-tube')),innerCap=ship.model.getObjectByName(side+'-engine-concave-inner-cap'),capBounds=bounds(innerCap),cappedRays=new Set();
    if(innerCap.material.transparent||!innerCap.material.depthWrite||innerCap.material.color.getHex()!==0x353535||capBounds.max[2]-capBounds.min[2]<.025)throw new Error('Sight-blocking cap must be shallow, concave, opaque and dark gray');
    for(const suffix of ['-dome-internal-lights','-dome-red-sphere-lights','-dome-front-red-lights'])if(bounds(ship.model.getObjectByName(side+suffix)).max[2]>=capBounds.min[2])throw new Error('Concave cap must sit behind every dome light');
    ship.model.traverse(o=>{if(!o.isMesh||(Array.isArray(o.material)?o.material:[o.material]).every(m=>m.transparent))return;const p=o.geometry.attributes.position,index=o.geometry.index,n=index?index.count:p.count;for(let i=0;i<n;i+=3){const [a,b,c]=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(o.matrixWorld));if(Math.max(a.z,b.z,c.z)<=bore.min[2]||Math.min(a.z,b.z,c.z)>=bore.max[2])continue;const d=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(d)<1e-12)continue;for(let ix=-2;ix<=2;ix++)for(let iy=-2;iy<=2;iy++){const x=center.x+ix*.018,y=center.y+iy*.018,u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/d,v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/d;if(u<0||v<0||u+v>1)continue;const z=u*a.z+v*b.z+(1-u-v)*c.z;if(z>bore.min[2]+.002&&z<bore.max[2]-.0003){if(o===innerCap)cappedRays.add(ix+','+iy);else throw new Error('Unexpected opaque geometry in the engine bore: '+o.name);}}}});
    if(cappedRays.size!==25)throw new Error('Concave cap must block all sampled sightlines toward the back of the engine');
  }
  const fin=bounds(ship.model.getObjectByName('port-aft-engine-fin'));
  const housing=bounds(ship.model.getObjectByName('upper-saucer-teardrop')),bowl=bounds(ship.model.getObjectByName('movie-underside-bowl'));
  const caps=['port','starboard'].map(side=>{const cap=ship.model.getObjectByName(side+'-engine-cap'),rotor=ship.model.getObjectByName(side+'-cap-lines');return {positions:Array.from(cap.geometry.attributes.position.array),scale:cap.parent.scale.toArray(),color:cap.material.color.getHex(),emissive:cap.material.emissive.getHex(),intensity:cap.material.emissiveIntensity,lineColor:rotor.children[0].material.color.getHex(),lineOpacity:rotor.children[0].material.opacity};});
  const spacing=ship.model.getObjectByName('starboard-movie-nacelle').position.x-ship.model.getObjectByName('port-movie-nacelle').position.x;
  const domeLineEnds=['port','starboard'].flatMap(side=>ship.model.getObjectByName(side+'-cap-lines').children.map(o=>{const p=o.geometry.attributes.position;let z=-Infinity,r=0,finite=true;for(let i=0;i<p.count;i++){z=Math.max(z,p.getZ(i));r=Math.max(r,Math.hypot(p.getX(i),p.getY(i)));if(!Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)))finite=false;}return {z,r,finite};}));
  const hangarClearances=[],strutBurial=['port','starboard'].map(side=>{
   const strut=ship.model.getObjectByName(side+'-engine-strut'),p=strut.geometry.attributes.position,shape=EnterpriseEngineeringShape;
   const axis=new T.Vector3((side==='port'?-1:1)*.354,.370,0).normalize(),bay=ship.model.getObjectByName('reference-shuttle-bay');
   // The whole hangar ellipse lies behind this support plane. The strut
   // extends outward from its root plane, so positive separation proves that
   // its solid body cannot enter the bay, including between mesh vertices.
   const bayCenterY=bay.position.y+.008*bay.scale.y;
   const baySupport=axis.y*bayCenterY+Math.hypot(.083*axis.x,.071*bay.scale.y*axis.y);
   let rootY=Infinity,margin=Infinity,bayMargin=Infinity;for(let i=0;i<p.count;i++)rootY=Math.min(rootY,p.getY(i));
   for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-rootY)<1e-6){
    const v=new T.Vector3().fromBufferAttribute(p,i);strut.localToWorld(v);ship.model.worldToLocal(v);const z=v.z/shape.bodyScale;
    margin=Math.min(margin,shape.radiusAt(z)-Math.abs(v.x),shape.upAt(z,v.x)-v.y,shape.downAt(z,v.x)+v.y);
    bayMargin=Math.min(bayMargin,v.x*axis.x+v.y*axis.y-baySupport);
   }
   hangarClearances.push(bayMargin);return margin;
  });
  return {domeLineEnds,hangarClearances,strutBurial,diameter,finLength:(fin.max[2]-fin.min[2])/diameter,lengths:engines.map(b=>(b.max[2]-b.min[2])/diameter),spacing:spacing/diameter,capGap:(Math.min(...engines.map(e=>e.min[2]))-saucer.max[2])/diameter,housingWidth:(housing.max[0]-housing.min[0])/diameter,housingLength:(housing.max[2]-housing.min[2])/diameter,bowlWidth:(bowl.max[0]-bowl.min[0])/diameter,caps,bronze:ship.model.getObjectByName('deflector-backplate').material.color.getHex()};
 });
 const near=(actual,expected,tolerance,label)=>assert(Math.abs(actual-expected)<tolerance,label+': '+actual+' vs '+expected);
 near(result.diameter,1.36,.001,'saucer diameter');for(const value of result.lengths)near(value,506/419,.012,'reference nacelle length / saucer diameter');
 near(result.finLength,83/333,.015,'rear fin length');near(result.spacing,215/333,.015,'nacelle spacing');near(result.capGap,12/419,.006,'reference collector clearance behind saucer');
 near(result.housingWidth,68/333,.012,'teardrop width');near(result.housingLength,95/333,.015,'teardrop length');near(result.bowlWidth,142/333,.025,'underside bowl width');
 const signature=result.caps.map(s=>({positions:crypto.createHash('sha256').update(JSON.stringify(s.positions)).digest('hex'),scale:s.scale}));
 const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'assets/reference/movie-study/movie-dome-shape.json'),'utf8')).map(s=>({positions:s.positions,scale:[.90,.90,1.10]}));
 assert.deepEqual(signature,baseline,'glass cover retains the collector shape and reference nacelle diameter');
 assert.equal(result.bronze,0x24170f,'dark bronze deflector backing is preserved');
 assert.equal(result.domeLineEnds.length,24);assert(result.domeLineEnds.every(e=>e.finite&&Math.abs(e.z-.350/.864)<1e-6&&e.r>.0859&&e.r<.087),'all spinning blades extend into the tube while staying inside the housing radius');
 assert(result.strutBurial.every(margin=>margin>.006),'both strut root caps are fully embedded in the curved hull with clearance');
 assert(result.hangarClearances.every(margin=>margin>.008),'both struts stay outside the hangar interior with clearance');
 console.log('Passed: concave dark gray caps block rear sightlines behind all lights, clear pylon/grille/shoe bore, hangar clearance, reference proportions and preserved dome shape.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});

