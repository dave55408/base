/* A stabilized camera aboard the shuttle, with motion-aware lead room. */
window.EnterpriseTracking=(()=>{
 const mounts=new WeakMap();
 const targets=new WeakMap();
 const operators=new WeakMap();let generation=0;
 function target(model){
  const T=AlpineThree;let center=targets.get(model);
  if(!center){
   model.updateWorldMatrix(true,true);const min=new T.Vector3(Infinity,Infinity,Infinity),max=new T.Vector3(-Infinity,-Infinity,-Infinity),point=new T.Vector3();
   model.traverse(object=>{
    if(!object.isMesh)return;const geometry=object.geometry;if(!geometry.boundingBox)geometry.computeBoundingBox();const box=geometry.boundingBox;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){point.set(x,y,z).applyMatrix4(object.matrixWorld);min.min(point);max.max(point);}
   });
   center=min.add(max).multiplyScalar(.5);model.worldToLocal(center);targets.set(model,center);
  }
  return model.localToWorld(center.clone());
 }
 function aim(camera,model,mission={},simulation={}){
  const T=AlpineThree,carrier=mission.freeSpace?mission.carrier:null,frame=new T.Group(),rad=Math.PI/180;
  if(carrier)frame.rotation.set((carrier.pitch||0)*rad,-(carrier.heading||0)*rad,-(carrier.roll||0),'YXZ');
  const origin=new T.Vector3(carrier?.x||0,carrier?.z||0,carrier?.y||0);
  const subject=target(model).applyQuaternion(frame.quaternion).add(origin);
  const eye=camera.position.clone().applyQuaternion(frame.quaternion).add(origin);
  const relative=subject.clone().sub(eye),distance=relative.length(),time=simulation.time??mission.clock??0;
  if(distance<.000001)return;
  let operator=operators.get(camera);
  if(!operator||operator.generation!==generation||operator.model!==model||time<operator.time){
   operator={generation,model,time,relative:relative.clone(),observed:relative.clone(),history:[{time,relative:relative.clone()}],velocity:new T.Vector3(),lead:new T.Vector3(),panRate:0,rotation:camera.quaternion.clone().premultiply(frame.quaternion)};
   operators.set(camera,operator);
  }
  // Measure apparent motion in inertial space: both ships' translations,
  // Enterprise's attitude, and the shuttle's moving camera mount contribute.
  const elapsed=Math.max(0,time-operator.time),dt=Math.min(.1,elapsed),forward=relative.clone().normalize();
  if(elapsed>0)operator.history.push({time,relative:relative.clone()});
  while(operator.history.length>2&&operator.history[1].time<time-1)operator.history.shift();
  // An operator notices changes a beat late, allowing the subject to drift
  // ahead before the pan catches up. Slowly varying timing avoids robotic lock.
  const observedTime=time-(.28+.06*Math.sin(time*.85)),history=operator.history;
  let observed=history[0].relative.clone();
  for(let i=1;i<history.length;i++){
   const a=history[i-1],b=history[i];
   if(observedTime<=b.time){observed.copy(a.relative).lerp(b.relative,Math.max(0,Math.min(1,(observedTime-a.time)/(b.time-a.time))));break;}
   observed.copy(b.relative);
  }
  if(elapsed>0){
   const measured=observed.clone().sub(operator.observed).multiplyScalar(1/elapsed);
   operator.velocity.lerp(measured,1-Math.exp(-dt/.28));
  }
  const transverse=operator.velocity.clone().addScaledVector(forward,-operator.velocity.dot(forward));
  const halfHeight=distance*Math.tan(camera.fov*rad/2),leadLimit=halfHeight*Math.min(1,camera.aspect)*.28;
  const lead=transverse.multiplyScalar(1.1);if(lead.length()>leadLimit)lead.setLength(leadLimit);
  operator.lead.lerp(lead,1-Math.exp(-dt/.4));
  const aimPoint=eye.clone().add(observed).add(operator.lead);
  const view=new T.Group();view.position.copy(eye);view.up.set(0,1,0);view.lookAt(aimPoint);
  // Object3D looks along +Z, while a camera looks along -Z.
  view.rotateY(Math.PI);
  const facing=new T.Vector3(0,0,-1).applyQuaternion(operator.rotation);
  // A close pass can swing the bearing through 180 degrees. Let the operator
  // fall behind and pan around, rather than speeding up to snap after the ship.
  const largePan=Math.max(0,Math.min(1,(facing.angleTo(forward)-25*rad)/(60*rad)));
  const response=.17+.035*Math.sin(time*1.1+.7)+largePan*.28;
  const angle=operator.rotation.angleTo(view.quaternion),maxRate=(55-25*largePan)*rad;
  const desiredRate=dt>0?Math.min(maxRate,angle*(1-Math.exp(-dt/response))/dt):operator.panRate;
  const acceleration=65*rad*dt;
  operator.panRate+=Math.max(-acceleration,Math.min(acceleration,desiredRate-operator.panRate));
  const panStep=Math.min(angle,operator.panRate*dt);
  if(angle>1e-9)operator.rotation.slerp(view.quaternion,panStep/angle);
  camera.quaternion.copy(operator.rotation).premultiply(frame.quaternion.clone().invert());
  camera.up.set(0,1,0);camera.updateWorldMatrix(true,false);
  operator.eye=eye;operator.relative.copy(relative);operator.observed.copy(observed);operator.time=time;
 }
 function drawStars(context,width,height,camera){
  const operator=operators.get(camera);if(!operator?.eye)return;
  const T=AlpineThree,toFlight=vector=>({x:vector.x,y:vector.z,z:vector.y});
  const axis=(x,y,z)=>toFlight(new T.Vector3(x,y,z).applyQuaternion(operator.rotation));
  context.fillStyle='#01050e';context.fillRect(0,0,width,height);
  SpaceStarfield.draw(context,width,height,{origin:toFlight(operator.eye),forward:axis(0,0,-1),right:axis(1,0,0),up:axis(0,1,0),zoom:height/(2*width*.65*Math.tan(camera.fov*Math.PI/360)),soft:true});
 }
 function mount(m,camera,craft){
  let pose=mounts.get(m);
  if(!pose){
   const inverse=craft.quaternion.clone().invert();
   pose={offset:camera.position.clone().sub(craft.position).applyQuaternion(inverse),rotation:camera.quaternion.clone().premultiply(inverse)};
   mounts.set(m,pose);return;
  }
  camera.position.copy(pose.offset).applyQuaternion(craft.quaternion).add(craft.position);
  camera.quaternion.copy(pose.rotation).premultiply(craft.quaternion);
  camera.updateWorldMatrix(true,false);
 }
 return {mount,aim,target,drawStars,reset(m){mounts.delete(m);generation++;}};
})();
