/* Exterior camera and the same Class F craft used in the hangar. */
window.attachExcursionCamera=ship=>{
 if(!ship)return ship;
 const T=AlpineThree,baseDraw=ship.draw,sink=document.createElement('canvas').getContext('2d');
 // Reserve depth precision for the thin nacelle shells at excursion ranges.
 const camera=new T.PerspectiveCamera(45,1,.02,100000);ship.excursionCamera=camera;
 // Broad reflected light from the planet below/port, separate from the sun.
 const planetBounce=new T.DirectionalLight(0xffffff,0);planetBounce.name='planet-bounce';planetBounce.position.set(-4,-3,2);ship.scene.add(planetBounce);
 const sun=ship.scene.getObjectByName('space-key'),sunDirection=sun?.position.clone().normalize();
 if(sun){
  sun.shadow.intensity=.5;
  const shadowSize=Math.min(4096,ship.renderer.capabilities.maxTextureSize);
  sun.castShadow=true;sun.shadow.mapSize.set(shadowSize,shadowSize);sun.shadow.camera.left=sun.shadow.camera.bottom=-2.2;sun.shadow.camera.right=sun.shadow.camera.top=2.2;sun.shadow.camera.near=.01;sun.shadow.camera.far=30;sun.shadow.bias=-.0001;sun.shadow.normalBias=.0015;sun.shadow.radius=2;
  ship.scene.add(sun.target);ship.renderer.shadowMap.type=T.PCFSoftShadowMap;
  ship.model.traverse(o=>{if(o.isMesh){const materials=Array.isArray(o.material)?o.material:[o.material];o.castShadow=materials.some(mat=>!mat.transparent||mat.opacity>=.9);o.receiveShadow=true;}});
 }
 let craft=null,enterpriseCorners=null,enterpriseSurface=null,planetFrame=null,bayFrame=null,lastExteriorPose=null;
 let starSeed=1701;const random=()=>{starSeed=(Math.imul(starSeed,1664525)+1013904223)>>>0;return starSeed/4294967296;};
 const stars=Array.from({length:1000},()=>{const y=random()*2-1,a=random()*Math.PI*2,r=Math.sqrt(1-y*y);return new T.Vector3(Math.sin(a)*r,y,Math.cos(a)*r);});
 function boxCorners(min,max){const out=[];for(const x of [min[0],max[0]])for(const y of [min[1],max[1]])for(const z of [min[2],max[2]])out.push(new T.Vector3(x,y,z));return out;}
 function focusShadow(center,extent){
  if(!sun)return;
  const shadowCamera=sun.shadow.camera;
  // Keep the sun direction fixed while concentrating texels on the local deck.
  sun.position.copy(center).addScaledVector(sunDirection,10);sun.target.position.copy(center);sun.target.updateWorldMatrix(true,false);
  shadowCamera.left=shadowCamera.bottom=-extent;shadowCamera.right=shadowCamera.top=extent;shadowCamera.updateProjectionMatrix();
  sun.shadow.normalBias=.0015*extent/2.2;
 }
 function planetCamera(w,h,m){
  const zoom=m.cameraZoom||1,key=[w,h,zoom].join('/');
  camera.aspect=w/h;camera.fov=2*Math.atan(Math.tan(22.5*Math.PI/180)/Math.max(w/h,1))*180/Math.PI;camera.near=.02;camera.far=100000;
  if(planetFrame?.key!==key){
   const center=enterpriseCorners[0].clone().add(enterpriseCorners[7]).multiplyScalar(.5),direction=new T.Vector3(2.4,-.60,2.7).normalize();
   camera.clearViewOffset();camera.updateProjectionMatrix();
   function bounds(distance){camera.position.copy(center).addScaledVector(direction,distance);camera.up.set(0,1,0);camera.lookAt(center);camera.updateWorldMatrix(true,false);let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;for(const v of enterpriseSurface){const p=v.clone().project(camera),x=(p.x+1)*w/2,y=(1-p.y)*h/2;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}return {left,right,top,bottom};}
   let near=enterpriseCorners[0].distanceTo(enterpriseCorners[7])*.55,far=200;
   for(let i=0;i<24;i++){const distance=(near+far)/2,b=bounds(distance);if(b.right-b.left>w*.84*zoom||b.bottom-b.top>h*.86*zoom)near=distance;else far=distance;}
   const b=bounds(far),offsetX=(b.left+b.right)/2-w*.46,offsetY=(b.top+b.bottom)/2-h*.456;
   camera.setViewOffset(w,h,offsetX,offsetY,w,h);
   planetFrame={key,position:camera.position.clone(),quaternion:camera.quaternion.clone(),offsetX,offsetY,rect:{x:b.left-offsetX,y:b.top-offsetY,width:b.right-b.left,height:b.bottom-b.top}};
  }
  camera.position.copy(planetFrame.position);camera.quaternion.copy(planetFrame.quaternion);
  camera.setViewOffset(w,h,planetFrame.offsetX,planetFrame.offsetY,w,h);
  camera.rotateY(-(m.lookYaw||0)*Math.PI/180);camera.rotateX((m.lookPitch||0)*Math.PI/180);camera.updateWorldMatrix(true,false);
  ship.planetExcursionFraming={...planetFrame.rect,liveModel:true};
 }
 ship.draw=(ctx,w,h,m,s)=>{
  const landing=!!m.landing&&!m.landing.inside&&(m.phase==='docking'||m.phase==='cockpitfade'&&m.clock<.6);
  const external=m.cameraView==='excursion'&&['flight','docking','landed','powerdown'].includes(m.phase)&&(m.freeSpace||m.z>95);
  if(!external){bayFrame=null;lastExteriorPose=null;}
  const exteriorShadows=!!sun&&(external||landing||m.phase==='bridge');
  ship.renderer.shadowMap.enabled=exteriorShadows||(m.garageDoorOpen||0)>.001;
  if(sun)sun.castShadow=exteriorShadows;
  if(exteriorShadows)focusShadow(new T.Vector3(0,.4,-.85),2.2);
  planetBounce.intensity=external&&!m.freeSpace&&m.planet?.color!=null?1.05:0;
  if(planetBounce.intensity)planetBounce.color.setHex(m.planet.color).lerp(new T.Color(0xffffff),.22);
  if(craft)craft.visible=false;
  // Retain all existing rotor, door and lighting updates in either model.
  const berthCockpit=!external&&m.cockpitFromBerth;
  const blend=m.landing?.inside&&m.phase==='docking'?Math.max(0,Math.min(1,m.clock/m.landing.duration)):1,eye=m.landing?.inside&&m.phase==='docking'?m.landing.eyeAtStart+(1-m.landing.eyeAtStart)*blend*blend*(3-2*blend):1;
  const heading=s.heading*Math.PI/180,pilot=berthCockpit?{...m,x:m.x+Math.sin(heading)*.043*eye,y:m.y-Math.cos(heading)*.043*eye,z:m.z+.024*eye}:m;
  const bay=baseDraw(external||landing?sink:ctx,w,h,pilot,s);if(!external&&!landing)return bay;
  if(!craft){craft=createClassFShuttle(T);craft.name='excursion-class-f-shuttle';craft.scale.setScalar(.162/3/3.20);craft.traverse(o=>{if(o.isMesh){const materials=Array.isArray(o.material)?o.material:[o.material];o.castShadow=materials.some(mat=>!mat.transparent||mat.opacity>=.9);o.receiveShadow=true;}});ship.scene.add(craft);ship.excursionShuttle=craft;window.enterpriseHullSurfaceDetail?.prepare(craft);}
  craft.visible=true;craft.position.set(m.x,m.z-110,m.y);craft.rotation.set(-((s.shuttlePitch??s.pitch)*Math.PI/180+(m.pitchBob||0)),Math.PI-(s.shuttleHeading??s.heading)*Math.PI/180,m.bank||0,'YXZ');
  if(external&&m.freeSpace)focusShadow(craft.position,.35);
  const insideBay=external&&ShuttleBayFlight.inside(m);
  const departing=external&&(m.departureCameraPending||m.departureCameraFade!=null||m.landingChoicePending||m.landing?.keepLaunchCamera);
  if(!insideBay&&!m.entranceCameraPose)bayFrame=null;
  if(insideBay||departing||m.entranceCameraPose){
   const b=ShuttleBayFlight.dimensions();camera.clearViewOffset();camera.aspect=w/h;camera.near=.005;camera.far=20;
   if(departing){
    // Hold the launch camera in place as the shuttle rises and departs.
    const anchor=m.departureCameraAnchor||{x:m.x,y:m.y,z:m.z,heading:s.shuttleHeading??s.heading,pitch:s.shuttlePitch??s.pitch,bank:m.bank||0};
    const pose=new T.Group();pose.rotation.set(-anchor.pitch*Math.PI/180,Math.PI-anchor.heading*Math.PI/180,-anchor.bank,'YXZ');
    const forward=new T.Vector3(0,0,1).applyQuaternion(pose.quaternion),origin=new T.Vector3(anchor.x,anchor.z-110,anchor.y);
    camera.position.copy(origin).addScaledVector(forward,-.12);camera.position.y+=.030;
    camera.up.set(0,1,0);camera.lookAt(origin.clone().addScaledVector(forward,.035).add(new T.Vector3(0,.016,0)));
    camera.fov=60;camera.near=.002;
   }else{
   if(!bayFrame||m.entranceCameraPose&&bayFrame.entry!==m.entranceCameraPose){
    if(m.entranceCameraPose){
     const entry=m.entranceCameraPose,yaw=entry.heading*Math.PI/180,p=entry.pitch*Math.PI/180;
     camera.position.set(entry.x,entry.z-110,entry.y);camera.up.set(0,1,0);
     const forward=new T.Vector3(Math.sin(yaw)*Math.cos(p),Math.sin(p),-Math.cos(yaw)*Math.cos(p));
     camera.lookAt(camera.position.clone().add(forward));camera.rotateZ(-entry.bank);
     const up=new T.Vector3(0,1,0).applyQuaternion(camera.quaternion);
     camera.position.addScaledVector(forward,-.14).addScaledVector(up,.030);
     camera.fov=2*Math.atan(h/(2*w*.65*entry.zoom))*180/Math.PI;
     bayFrame={position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov,entry};
    }
    else if(lastExteriorPose&&lastExteriorPose.position.z>b.mouth+.015)bayFrame=lastExteriorPose;
    else{
     const target=new T.Vector3(0,b.floor-110+.035,b.padY);camera.position.set(0,b.floor-110+.085,b.mouth+.13);camera.up.set(0,1,0);camera.lookAt(target);
     camera.fov=2*Math.atan(.0675/camera.position.distanceTo(target))*180/Math.PI;
     bayFrame={position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov};
    }
   }
   camera.position.copy(bayFrame.position);camera.quaternion.copy(bayFrame.quaternion);camera.fov=bayFrame.fov;
   }
   camera.updateProjectionMatrix();camera.updateWorldMatrix(true,false);
   ctx.fillStyle='#01050e';ctx.fillRect(0,0,w,h);const rw=Math.min(1920,Math.round(w));ship.renderer.setSize(rw,Math.round(h*rw/w),false);ship.renderer.render(ship.scene,camera);ctx.drawImage(ship.renderer.domElement,0,0,w,h);
   craft.updateWorldMatrix(true,true);const corners=boxCorners([-1.625,0,-createClassFShuttle.aftExtent-.02],[1.625,2.36*.80,3.40]).map(v=>craft.localToWorld(v).project(camera).toArray());
   ship.excursionFraming={enterprise:[],shuttle:corners,fixedBayCamera:true,departureCamera:departing};ship.landingTelemetry={progress:m.phase==='docking'?Math.min(1,m.clock/m.landing.duration):1,position:craft.position.toArray(),camera:camera.position.toArray(),touchdown:m.phase==='landed',fixedBayCamera:true};
   const p=new T.Vector3(0,b.floor-110+.02,b.padY).project(camera);return {x:(p.x+1)*w/2,y:(1-p.y)*h/2,visible:p.z>=-1&&p.z<=1};
  }
  if(landing){
   camera.clearViewOffset();
   const {pad,duration}=m.landing,t=m.phase==='docking'?Math.max(0,Math.min(1,m.clock/duration)):1;
   const pose=m.phase==='docking'?m.landing.pose:pad;
   craft.position.set(pose.x,pose.z-110,pose.y);craft.rotation.set(0,Math.PI-(m.landing.heading||0)*Math.PI/180,0);
   focusShadow(craft.position,.24);
   const center=craft.position.clone().add(new T.Vector3(0,.016,0));
   camera.aspect=w/h;camera.fov=40;camera.near=.02;camera.far=Math.max(100,craft.position.length()*4+10);camera.up.set(0,1,0);
   camera.position.set(craft.position.x-.030,craft.position.y+.04,Math.max(craft.position.z+.16,m.clock>=duration-4?.018:-Infinity));camera.lookAt(center);camera.updateProjectionMatrix();camera.updateWorldMatrix(true,false);
   ctx.fillStyle='#01050e';ctx.fillRect(0,0,w,h);const rw=Math.min(1920,Math.round(w));ship.renderer.setSize(rw,Math.round(h*rw/w),false);ship.renderer.render(ship.scene,camera);ctx.drawImage(ship.renderer.domElement,0,0,w,h);
   ship.landingTelemetry={progress:t,position:craft.position.toArray(),camera:camera.position.toArray(),touchdown:t===1};
   return {...bay,visible:false,landing:true};
  }
  ship.model.updateWorldMatrix(true,true);craft.updateWorldMatrix(true,true);
  if(!enterpriseCorners){
   enterpriseSurface=[];
   const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
   ship.model.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).toArray();for(let k=0;k<3;k++){min[k]=Math.min(min[k],v[k]);max[k]=Math.max(max[k],v[k]);}}});
   enterpriseCorners=boxCorners(min,max);
   ship.model.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,stride=Math.max(1,Math.ceil(p.count/128));for(let i=0;i<p.count;i+=stride)enterpriseSurface.push(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));});
  }
  if(!m.freeSpace){
   planetCamera(w,h,m);const rw=Math.min(1920,Math.round(w));ship.renderer.setSize(rw,Math.round(h*rw/w),false);ship.renderer.render(ship.scene,camera);ctx.drawImage(ship.renderer.domElement,0,0,w,h);
   const projected=enterpriseCorners.map(v=>v.clone().project(camera));ship.excursionFraming={enterprise:projected.map(v=>v.toArray()),shuttle:[]};
   ctx.fillStyle='#b5e9ff';ctx.font='12px Consolas';ctx.fillText('EXCURSION CAMERA',18,28);const p=new T.Vector3().project(camera);return {x:(p.x+1)*w/2,y:(1-p.y)*h/2,visible:p.z>=-1&&p.z<=1};
  }
  ship.planetExcursionFraming=null;camera.clearViewOffset();
  // Preserve the shuttle's forward viewpoint, including mouse look, rather
  // than aiming the camera at Enterprise independently of the helm.
  const yaw=s.heading*Math.PI/180,pitch=s.pitch*Math.PI/180;
  const forward=new T.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
  const up=new T.Vector3(-Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),Math.cos(yaw)*Math.sin(pitch));
  // Keep the exterior camera level; only the shuttle mesh follows its bank/roll.
  const center=craft.localToWorld(new T.Vector3(0,.944,-.10));
  const craftCorners=boxCorners([-1.625,0,-createClassFShuttle.aftExtent-.02],[1.625,2.36*.80,3.40]).map(v=>craft.localToWorld(v)),points=[...enterpriseCorners,...craftCorners];
  camera.aspect=w/h;camera.fov=Math.max(25,Math.min(70,45/(m.cameraZoom||1)));camera.near=.02;camera.far=Math.max(100,craft.position.length()*4+10);camera.updateProjectionMatrix();
  function positionCamera(distance,height){
   camera.position.copy(center).addScaledVector(forward,-distance).addScaledVector(up,height);camera.up.copy(up);camera.lookAt(camera.position.clone().add(forward));camera.updateWorldMatrix(true,false);
  }
  // Hold the craft at roughly one fifth of the screen width at every range.
  let near=.08,far=5,backoff=.2,craftProjected=[];
  for(let i=0;i<28;i++){
   backoff=(near+far)/2;positionCamera(backoff,0);craftProjected=craftCorners.map(v=>v.clone().project(camera));
   const width=(Math.max(...craftProjected.map(v=>v.x))-Math.min(...craftProjected.map(v=>v.x)))/2;
   const height=Math.max(...craftProjected.map(v=>v.y))-Math.min(...craftProjected.map(v=>v.y));
   if(width>.20||height>.85)near=backoff;else far=backoff;
  }
  // Keep the whole shuttle low in the frame so the pilot's forward view is clear.
  let height=0;const tangent=Math.tan(camera.fov*Math.PI/360);
  for(let i=0;i<6;i++){
   positionCamera(backoff,height);craftProjected=craftCorners.map(v=>v.clone().project(camera));
   const middle=(Math.max(...craftProjected.map(v=>v.y))+Math.min(...craftProjected.map(v=>v.y)))/2;
   height+=(middle+.50)*backoff*tangent;
  }
  positionCamera(backoff,height);const projected=points.map(v=>v.clone().project(camera));
  if(m.freeSpace){
   ctx.fillStyle='#01050e';ctx.fillRect(0,0,w,h);ctx.fillStyle='#c3d8e7';
   for(const star of stars){const p=star.clone().multiplyScalar(10).add(camera.position).project(camera);if(p.z> -1&&p.z<1&&Math.abs(p.x)<1&&Math.abs(p.y)<1)ctx.fillRect((p.x+1)*w/2,(1-p.y)*h/2,1,1);}
  }
  const rw=Math.min(1920,Math.round(w));ship.renderer.setSize(rw,Math.round(h*rw/w),false);ship.renderer.render(ship.scene,camera);ctx.drawImage(ship.renderer.domElement,0,0,w,h);
  ship.excursionFraming={enterprise:projected.slice(0,8).map(v=>v.toArray()),shuttle:projected.slice(8).map(v=>v.toArray())};
  lastExteriorPose={position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov};
  const p=new T.Vector3(0,0,0).project(camera);ctx.fillStyle='#b5e9ff';ctx.font='12px Consolas';ctx.fillText('EXCURSION CAMERA',18,28);
  return {x:(p.x+1)*w/2,y:(1-p.y)*h/2,visible:p.z>=-1&&p.z<=1};
 };
 return ship;
};
