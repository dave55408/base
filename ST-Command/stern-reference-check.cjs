const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async()=>{
  const T=AlpineThree,out=document.createElement('canvas');out.width=2400;out.height=1000;const ctx=out.getContext('2d'),checks=[];
  for(const [row,factory] of [createMovieEnterpriseRenderer,createEnterpriseRenderer].entries()){
   const ship=factory();await ship.ready;ship.model.updateWorldMatrix(true,true);const rim=ship.model.getObjectByName(row?'original-hangar-flat-door-rim':'movie-hangar-flat-door-rim'),profile=rim.geometry.userData.doorFrame,doors=ship.model.getObjectByName('shuttle-bay-clamshell-doors');
   for(const [col,view] of [{label:'OPEN / REAR',position:[0,.025,.65],target:[0,.025,.04],open:1},{label:'CLOSED / SIDE CUTOUT',position:[.35,.025,.45],target:[0,.005,.01],open:0},{label:'SIDE PROFILE',position:[.65,.01,-.04],target:[0,.01,-.04],open:0,half:.17},{label:'CLOSED',position:[0,.025,.65],target:[0,.025,.04],open:0}].entries()){
    ship.setBayDoorOpen(view.open);const half=view.half||.15,camera=new T.OrthographicCamera(-half,half,half*5/6,-half*5/6,.001,100);camera.position.copy(ship.model.localToWorld(new T.Vector3(...view.position)));camera.lookAt(ship.model.localToWorld(new T.Vector3(...view.target)));camera.updateWorldMatrix(true,false);ship.renderer.setSize(600,500,false);ship.renderer.render(ship.scene,camera);
    ctx.fillStyle='#05080c';ctx.fillRect(col*600,row*500,600,500);ctx.drawImage(ship.renderer.domElement,col*600,row*500);ctx.fillStyle='#ffe16b';ctx.font='13px monospace';ctx.fillText((row?'ORIGINAL':'SECOND MODEL')+' / '+view.label,col*600+14,row*500+23);
   }
   const body=ship.model.getObjectByName('secondary-hull'),skin=body.geometry.attributes.position,section=[];let aftDepth=0;
   for(let i=0;i<skin.count;i++)if(Math.abs(skin.getY(i))<1e-6){aftDepth=Math.max(aftDepth,skin.getZ(i));section.push(new T.Vector3().fromBufferAttribute(skin,i).applyMatrix4(body.matrixWorld));}
   const fairing=ship.model.getObjectByName(row?'original-hangar-integrated-fairing':'movie-hangar-integrated-fairing'),fp=fairing.geometry.attributes.position;let joinError=0;
   for(let i=0;i<=192;i++){
    const p=new T.Vector3().fromBufferAttribute(fp,i).applyMatrix4(fairing.matrixWorld);let closest=Infinity;
    for(let j=1;j<section.length;j++){const a=section[j-1],b=section[j],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));closest=Math.min(closest,Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy));}
    joinError=Math.max(joinError,closest);
   }
   const room=ship.model.getObjectByName('reference-bay-interior');let fittingEnd=-Infinity;
   room.traverse(o=>{if(!o.isMesh||!(/bay-central-ceiling-beam|bay-console-rail|bay-upper-infill|bay-vent-rail|bay-ceiling-light/.test(o.name)))return;o.updateMatrix();const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)fittingEnd=Math.max(fittingEnd,new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrix).z);});
   const neutralShoulders=row||['port','starboard'].every(side=>ship.model.getObjectByName(side+'-hangar-upper-wall').material.color.getHex()===0x727b7e);
   const beacon=ship.model.getObjectByName('shuttle-bay-green-light'),beaconBase=new T.Vector3().setFromMatrixPosition(beacon.matrixWorld),topLamp=ship.model.getObjectByName('hangar-upper-yellow-light'),base=ship.model.getObjectByName(row?'original-hangar-squared-base':'movie-hangar-squared-base'),bp=base.geometry.attributes.position;let minBase=Infinity,maxBase=-Infinity;for(let i=0;i<bp.count;i++)if(bp.getY(i)<profile.floor-profile.baseThickness/(2*profile.scaleY)){const y=new T.Vector3().fromBufferAttribute(bp,i).applyMatrix4(base.matrixWorld).y;minBase=Math.min(minBase,y);maxBase=Math.max(maxBase,y);}
   // Rounded outer corners blend into the level underside. Measure its
   // central span independently of those short corner transitions.
   minBase=Infinity;maxBase=-Infinity;
   for(let i=0;i<bp.count;i++)if(bp.getY(i)<profile.floor-profile.baseThickness/profile.scaleY+.000001){
    const y=new T.Vector3().fromBufferAttribute(bp,i).applyMatrix4(base.matrixWorld).y;minBase=Math.min(minBase,y);maxBase=Math.max(maxBase,y);
   }
   if(Math.abs(topLamp.position.z-profile.lampFront-.001)>1e-8)throw Error('Yellow light sits beneath the hood');
   checks.push({archHeight:doors.scale.y*profile.scaleY,expectedArchHeight:profile.ry*profile.scaleY,archWidth:doors.scale.x*2,aftDepth,bellyDepth:profile.bellyDepth,baseThickness:profile.baseThickness,baseFlatness:maxBase-minBase,roofSetback:profile.baseFront-profile.roofFront,sideCutTop:profile.sideCut[0],sideCutMiddle:profile.sideCut[48],sideCutBase:profile.sideCut[96],beaconHeight:beaconBase.y,joinError,fittingEnd,neutralShoulders,expectedHullColor:new T.Color(row?window.ENTERPRISE_HULL_COLOR:window.ENTERPRISE_MOVIE_HULL_COLOR).getHex(),frameColor:fairing.material.color.getHex(),exposedBeam:!!room.getObjectByName('bay-central-ceiling-beam'),closed:doors.userData.open,opaque:!rim.material.transparent,glError:ship.renderer.getContext().getError()});
  }
  return {checks,image:out.toDataURL('image/jpeg',.88)};
 });
 for(const check of result.checks){assert(Math.abs(check.archHeight-check.expectedArchHeight)<1e-8);assert.equal(check.archWidth,.166);assert(check.baseFlatness<1e-6,'base underside is squared off');assert(Math.abs(check.roofSetback-.048)<1e-8&&Math.abs(check.sideCutTop-.0325)<1e-6&&check.sideCutMiddle<.010&&check.sideCutBase<1e-8,'ring is set behind the dome and cutout curves into the hull');assert(check.beaconHeight>.102);assert(check.joinError<1e-6,'fairing meets the actual hull section');assert(check.fittingEnd<=-.01829,'ceiling and wall fittings stay behind the door return');assert(check.neutralShoulders,'no gold shoulder trim');assert.equal(check.frameColor,check.expectedHullColor,'surround matches the hull finish');assert(!check.exposedBeam,'no floating beam end at the entrance');assert.equal(check.closed,0);assert(check.opaque);assert.equal(check.glError,0);}assert.deepEqual(errors,[]);
 for(const check of result.checks){assert.equal(check.baseThickness,.024);assert(Math.abs(check.aftDepth-check.bellyDepth)<1e-6,'aft hull supports the shallow base and joins its fairing');}
 if(process.argv.includes('--image'))console.log(JSON.stringify(result));else console.log('Passed: reference stern proportions, opaque beveled rim and open/closed rear and underside views on both models.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
