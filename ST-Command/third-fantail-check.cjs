const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.createThirdEnterpriseRenderer);
 const result=await page.evaluate(async()=>{
  const T=AlpineThree,second=createMovieEnterpriseRenderer(),third=createThirdEnterpriseRenderer();await Promise.all([second.ready,third.ready]);second.model.updateWorldMatrix(true,true);third.model.updateWorldMatrix(true,true);
  function point(mesh,i){return new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(mesh.matrixWorld);}
  const oldBase=second.model.getObjectByName('movie-hangar-squared-base'),base=third.model.getObjectByName('movie-hangar-squared-base'),old=oldBase.geometry.attributes.position;
  const front=[];for(let i=0;i<old.count;i++)if(Math.abs(old.getZ(i)-(.062-.0002))<1e-6)front.push(point(base,i));
  const frontSpread=Math.max(...front.map(v=>v.z))-Math.min(...front.map(v=>v.z));
  const hull=third.model.getObjectByName('secondary-hull'),hullOld=second.model.getObjectByName('secondary-hull'),p=hullOld.geometry.attributes.position,section=[];
  for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i))<1e-7)section.push(point(hull,i));
  const fairing=third.model.getObjectByName('movie-hangar-integrated-fairing');let seamGap=0;
  for(let i=0;i<=192;i++){const a=point(fairing,i);let best=Infinity;for(let j=1;j<section.length;j++){
   const b=section[j-1],c=section[j],edge=c.clone().sub(b),t=Math.max(0,Math.min(1,a.clone().sub(b).dot(edge)/(edge.lengthSq()||1)));
   best=Math.min(best,a.distanceTo(b.clone().addScaledVector(edge,t)));
  }seamGap=Math.max(seamGap,best);}
  const frontZ=Math.max(...front.map(v=>v.z)),lampClearances=[];
  for(const name of ['port-hangar-red-light','starboard-hangar-red-light','port-hangar-red-vertical-light','starboard-hangar-red-vertical-light','hangar-green-light']){
   const mesh=third.model.getObjectByName(name);let back=Infinity;for(let i=0;i<mesh.geometry.attributes.position.count;i++)back=Math.min(back,point(mesh,i).z);lampClearances.push(back-frontZ);
  }
  const doors=third.model.getObjectByName('shuttle-bay-clamshell-doors'),doorStates=[];
  for(const open of [0,.5,1]){third.setBayDoorOpen(open);doorStates.push(doors.userData.open);}
  const out=document.createElement('canvas');out.width=2400;out.height=1800;const c=out.getContext('2d');
  const views=[['CLOSED AFT',[0,.025,.65],[0,.025,.04],0,.15],['AFT QUARTER',[.35,.10,.45],[0,.015,.01],0,.16],['FANTAIL UNDERSIDE',[.25,-.12,.35],[0,-.015,.01],0,.15],['OPEN BAY',[0,.025,.65],[0,.025,.04],1,.15]];
  for(const [i,[label,pos,aim,open,half]]of views.entries()){
   third.setBayDoorOpen(open);const camera=new T.OrthographicCamera(-half,half,half*.75,-half*.75,.001,100);camera.position.copy(third.model.localToWorld(new T.Vector3(...pos)));camera.lookAt(third.model.localToWorld(new T.Vector3(...aim)));
   third.renderer.setClearColor(0x101820,1);third.renderer.setSize(1200,900,false);third.renderer.render(third.scene,camera);const x=i%2*1200,y=Math.floor(i/2)*900;c.drawImage(third.renderer.domElement,x,y);c.fillStyle='#ffe3a5';c.font='19px Arial';c.fillText(label,x+18,y+28);
  }
  return {frontSpread,seamGap,lampClearances,doorStates,glError:third.renderer.getContext().getError(),photoRevision:third.model.userData.photoDetails.revision,preview:out.toDataURL().split(',')[1]};
 });
 assert(result.frontSpread<1e-6,'fantail apron is planar: '+result.frontSpread);assert(result.seamGap<.0005,'fairing joins the hull in 3D: '+result.seamGap);assert(result.lampClearances.every(v=>v>0&&v<.001),'sill lamps sit flush outside the apron');assert.deepEqual(result.doorStates,[0,.5,1]);assert.equal(result.glError,0);assert.equal(result.photoRevision,2);assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(__dirname,'preview-third-fantail.png'),Buffer.from(result.preview,'base64'));delete result.preview;console.log(JSON.stringify(result));console.log('Passed: continuous stern seam, planar fantail, flush sill lamps and open/closed bay.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
