const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.createMovieEnterpriseRenderer);
const result=await page.evaluate(async()=>{
 const ship=createMovieEnterpriseRenderer();await ship.ready;ship.setBayDoorOpen(1);ship.model.updateMatrixWorld(true);
 const registration=ship.model.userData.referenceDimensions,bayScale=registration.bayScaleY,bayOffset=registration.bayOffsetY,bodyScale=registration.bodyScale;
 const T=AlpineThree,enclosure=ship.model.getObjectByName('movie-hangar-enclosure'),triangles=[],doorProfile=hangarDoorProfile(bayScale);
 const launchRear=-.278*bodyScale-.032+.001;
 for(const name of Array.from({length:12},(_,n)=>'garage-door-panel-'+n)){const part=ship.model.getObjectByName(name),p=part.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(part.matrixWorld);if(v.z>=launchRear)throw new Error('Recessed wall fittings must clear the shuttle at its deepest launch position');}}
 for(const root of [enclosure,ship.model.getObjectByName('bay-garage-shell'),ship.model.getObjectByName('bay-garage-door')])root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,idx=o.geometry.index,n=idx?idx.count:p.count;
  for(let i=0;i<n;i+=3){const tri=[];for(let j=0;j<3;j++){const v=new T.Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(o.matrixWorld);tri.push(v.x,v.y,v.z);}triangles.push(tri);}
 });
 const rim=ship.model.getObjectByName('movie-hangar-flat-door-rim'),portalPoints=rim.geometry.userData.doorFrame.aperture.map(p=>new T.Vector3(...p).applyMatrix4(rim.matrixWorld)),portalCenter=portalPoints.reduce((sum,p)=>sum.add(p),new T.Vector3()).multiplyScalar(1/portalPoints.length),portalTriangles=[];
 for(let i=1;i<portalPoints.length;i++)portalTriangles.push([...portalCenter.toArray(),...portalPoints[i-1].toArray(),...portalPoints[i].toArray()]);
 function rayHit(o,d,maxDistance=.7,faces=triangles){
  for(const t of faces){
   const ax=t[0],ay=t[1],az=t[2],e1x=t[3]-ax,e1y=t[4]-ay,e1z=t[5]-az,e2x=t[6]-ax,e2y=t[7]-ay,e2z=t[8]-az;
   const px=d[1]*e2z-d[2]*e2y,py=d[2]*e2x-d[0]*e2z,pz=d[0]*e2y-d[1]*e2x,det=e1x*px+e1y*py+e1z*pz;
   if(Math.abs(det)<1e-10)continue;const inv=1/det,tx=o[0]-ax,ty=o[1]-ay,tz=o[2]-az,u=(tx*px+ty*py+tz*pz)*inv;if(u< -1e-8||u>1+1e-8)continue;
   const qx=ty*e1z-tz*e1y,qy=tz*e1x-tx*e1z,qz=tx*e1y-ty*e1x,v=(d[0]*qx+d[1]*qy+d[2]*qz)*inv;if(v< -1e-8||u+v>1+1e-8)continue;
   const distance=(e2x*qx+e2y*qy+e2z*qz)*inv;if(distance>1e-6&&distance<maxDistance)return true;
  }return false;
 }
 // Look directly through the marked shoulder gaps: the front of the new
 // wall must stop each ray, rather than relying on the far rear bulkhead.
 for(const side of [-1,1])for(const y of [.018,.035,.055,.065]){
  const roof=.083*Math.sqrt(1-((y-.008)/.071)**2),door=doorProfile.rx*Math.sqrt(Math.max(0,1-((y-doorProfile.cy)/doorProfile.ry)**2));
  if(!rayHit([side*(roof+door)/2,y*bayScale+bayOffset,.1*bodyScale-.032],[0,0,-bodyScale],.13))throw new Error('Recessed roof and shoulders must remain solid around the entrance');
 }
 let checked=0;const leaks=[];
 for(const x of [-.025,0,.025])for(const z of [-.08,-.18])for(let i=0;i<256;i++){
  const dy=1-2*(i+.5)/256,a=i*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt(1-dy*dy),d=[Math.cos(a)*r,dy,Math.sin(a)*r],o=[x,-.010,z-.032];
  const actualOrigin=[o[0],o[1]*bayScale+bayOffset,(o[2]+.032)*bodyScale-.032],actualDirection=[d[0],d[1]*bayScale,d[2]*bodyScale];
  // The opening is swept back at the roof. Cap its actual 3D contour for
  // the exit test rather than treating the recessed mouth as a flat plane.
  if(d[2]>0&&rayHit(actualOrigin,actualDirection,.7,portalTriangles))continue;
  checked++;if(!rayHit(actualOrigin,actualDirection))leaks.push({o:actualOrigin,d:actualDirection});
 }
 const hull=ship.model.getObjectByName('secondary-hull'),p=hull.geometry.attributes.position,cutoutStart=hull.userData.aftCutoutStart;let aftBottom=0,forwardBottom=0,strutAftBottom=0;
 for(let i=0;i<p.count;i++){if(Math.abs(p.getY(i))<1e-5)aftBottom=Math.min(aftBottom,-p.getZ(i));if(Math.abs(p.getY(i)-cutoutStart)<1e-5)forwardBottom=Math.min(forwardBottom,-p.getZ(i));if(Math.abs(p.getY(i)+.24)<1e-5)strutAftBottom=Math.min(strutAftBottom,-p.getZ(i));}
 const roots=[];
 for(let i=0;i<p.count;i+=hull.userData.radialSegments+1)if(p.getZ(i)>0)roots.push({z:p.getY(i),depth:p.getZ(i)});
 const start=roots.findIndex(v=>Math.abs(v.z-cutoutStart)<1e-5),slope=(a,b)=>(b.depth-a.depth)/(b.z-a.z);
 const tangentChange=Math.abs(slope(roots[start-1],roots[start])-slope(roots[start],roots[start+1]));
 const endSlope=Math.abs(slope(roots.at(-2),roots.at(-1)));
 const midDepth=roots.reduce((a,b)=>Math.abs(a.z-cutoutStart/2)<Math.abs(b.z-cutoutStart/2)?a:b).depth;
 const flat=roots.filter(v=>v.z>=-.075),flatRun=Math.max(...flat.map(v=>v.depth))-Math.min(...flat.map(v=>v.depth));
 const strut=ship.model.getObjectByName('starboard-engine-strut'),sp=strut.geometry.attributes.position;let strutAft=-Infinity;
 for(let i=0;i<sp.count;i++)strutAft=Math.max(strutAft,new T.Vector3().fromBufferAttribute(sp,i).applyMatrix4(strut.matrixWorld).z+.032);
 for(const side of ['port','starboard']){const wall=ship.model.getObjectByName(side+'-hangar-upper-wall');if(!wall||wall.material.transparent||wall.material.side!==T.DoubleSide)throw new Error('Upper bay walls must be solid on both sides');}
 const out=document.createElement('canvas');out.width=1800;out.height=1950;const c=out.getContext('2d');let profileImage;
 const views=[
 ['AFT BELLY CUTOUT',[1,0,-.19],[0,-.015,-.19],.32],
 ['OPEN BAY / ENCLOSED INTERIOR',[0,.018,.46],[0,.015,-.15],.145],
 ['BELOW / AFT QUARTER',[.30,-.15,.45],[0,-.018,-.13],.22],
 ['INSIDE / FORWARD BULKHEAD',[0,-.005,-.018],[0,.010,-.28],.100],
 ['CLOSED / SEALED SHOULDERS',[0,.018,.46],[0,.015,-.15],.115,0],
 ['PARTLY OPEN / UPPER WALLS',[0,.018,.46],[0,.015,-.15],.115,.5]
 ];
 for(let i=0;i<views.length;i++){
  const [label,pos,aim,half,door=1]=views[i],tile=document.createElement('canvas');tile.width=900;tile.height=650;
  const tc=tile.getContext('2d');ship.draw(tc,900,650,{x:pos[0],y:pos[2],z:110+pos[1],bank:0},{heading:0,pitch:0,time:0,bayDoorOpen:door});
  const cam=new T.OrthographicCamera(-half,half,half*650/900,-half*650/900,.001,20);cam.position.set(...pos);cam.lookAt(...aim);ship.renderer.render(ship.scene,cam);tc.clearRect(0,0,900,650);tc.drawImage(ship.renderer.domElement,0,0);if(i===0)profileImage=tile.toDataURL('image/jpeg',.95);
  const x=i%2*900,y=Math.floor(i/2)*650;c.fillStyle='#080f14';c.fillRect(x,y,900,650);c.drawImage(tile,x,y);c.fillStyle='#e2cda6';c.font='18px Arial';c.fillText(label,x+22,y+30);
 }
 const backWall=ship.model.getObjectByName('movie-hangar-forward-bulkhead');
 return {wallColor:backWall.material.color.getHex(),solidWall:!backWall.material.transparent&&backWall.material.side===T.DoubleSide,checked,leaks,aftBottom,expectedAftDepth:EnterpriseEngineeringShape.aftBaseDepth,forwardBottom,cutoutStart,strutAft,strutAftBottom,tangentChange,endSlope,midDepth,flatRun,profileImage,details:window.enterpriseMovieMaps.orthographicDetails,image:out.toDataURL('image/jpeg',.94)};
});
assert.deepEqual(result.leaks,[],'hangar rays hit a solid wall, ceiling, floor or bulkhead except at the intended bay entrance');
assert.equal(result.wallColor,0x778177);assert(result.solidWall,'restored back wall remains opaque');
assert(result.checked>1000);assert(Math.abs(result.aftBottom+result.expectedAftDepth)<.001&&result.forwardBottom<-.105,'aft belly supports the thick hangar base');
assert(result.cutoutStart*.85>result.strutAft+.01&&result.cutoutStart*.85<result.strutAft+.04,'registered cutout begins just behind the engine strut');assert(result.strutAftBottom<-.11,'reference hull retains structural depth beneath the strut');
assert(result.tangentChange<.01&&result.endSlope<.01,'cutout joins the original hull and level bay floor without a sharp tangent change');
assert(result.midDepth<.075,'reference cutout has a long shallow aft sweep rather than a centered S-shaped shoulder');
assert(result.flatRun>.001&&result.flatRun<.03,'underside cutout curves forward from the squared base');
assert(result.details,'latest orthographic detailing loads');assert.deepEqual(errors,[]);
if(!process.argv.includes('--no-images')){
 fs.writeFileSync(path.join(__dirname,'preview-movie-cutout-profile.jpg'),Buffer.from(result.profileImage.split(',')[1],'base64'));
 fs.writeFileSync(path.join(__dirname,'preview-movie-hangar.jpg'),Buffer.from(result.image.split(',')[1],'base64'));
}
console.log(process.argv.includes('--image')?result.image:'Passed: '+result.checked+' enclosure rays, curved aft cutout, fully open door clearance, forward bulkhead and orthographic details.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});

