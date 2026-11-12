/* Shared bay coordinates: flight distances are kilometres, including 10 feet. */
window.ShuttleBayFlight={
 approachDistance:.003048,
 departureFadeDuration:.45,
 dimensions(model=window.EnterpriseModels?.selected){
  const movie=model!=='original',body=movie?(window.EnterpriseEngineeringShape?.bodyScale??.85):1;
  return {floor:110-(movie?.01530:.04645),ceiling:110+(movie?.050:.045),mouth:hangarDoorProfile().roofFront*body-.032,rear:-(movie?.278*body:.270)-.032,padY:(-.111+(1040/2048-.5)*.322)*body-.032,cabinTransitionY:(-.262+2*.078+.033)*body-.032,launchRearLimitY:(-.262+.078+.033)*body-.032};
 },
 inside(m,model){const b=this.dimensions(model);return Math.abs(m.x)<.071&&m.y>=b.rear+.025&&m.y<=b.mouth&&m.z>=b.floor-.005&&m.z<=b.ceiling+.008;},
 padRoot(heading,model){const b=this.dimensions(model),offset=(createClassFShuttle.aftExtent-3.40)/2*(.162/3/3.20),a=heading*Math.PI/180;return {x:Math.sin(a)*offset,y:b.padY-Math.cos(a)*offset,z:b.floor};},
 cockpitEntryPose(model){
  const b=this.dimensions(model);
  // Reference view: centered at the rear, ring below, looking toward space.
  return {x:0,y:b.rear-.0017,z:b.floor+.0253};
 },
 cockpitView(m,s){
  const rad=Math.PI/180;
  return {x:m.x,y:m.y,z:m.z,heading:s.heading+(m.lookYaw||0),pitch:Math.max(-89,Math.min(89,s.pitch+(m.lookPitch||0)+(m.pitchBob||0)/rad)),bank:m.bank||0,zoom:m.cameraZoom||1};
 },
 lipOutsideView(view,width,height,model=window.EnterpriseModels?.selected){
  const b=this.dimensions(model),T=AlpineThree,rad=Math.PI/180,movie=model!=='original';
  if(Math.abs(view.x)>.071||view.z<b.floor||view.z>b.ceiling||Math.cos(view.heading*rad)<=0)return false;
  if(view.y<=b.mouth)return this.inside(view,model);
  const scaleY=movie?.128/.162:1,offsetY=movie?.102*(1-scaleY):0;
  const camera=new T.PerspectiveCamera(2*Math.atan(height/(2*width*.65*view.zoom))/rad,width/height,.005,100);
  camera.position.set(view.x,view.z-110,view.y);
  const h=view.heading*rad,p=view.pitch*rad;
  camera.lookAt(camera.position.clone().add(new T.Vector3(Math.sin(h)*Math.cos(p),Math.sin(p),-Math.cos(h)*Math.cos(p))));camera.rotateZ(-view.bank);camera.updateWorldMatrix(true,false);
  // If every viewport corner looks through the opening, none of its lip
  // remains on screen. The opening is convex, including the arched roof.
  for(const x of [-1,1])for(const y of [-1,1]){
   const ray=new T.Vector3(x,y,.5).unproject(camera).sub(camera.position).normalize();if(ray.z>=0)return false;
   const door=hangarDoorProfile(scaleY);
   // The lip is upright; the recessed door hinge is behind this front plane.
   {
    const t=(b.mouth-camera.position.z)/ray.z,hit=camera.position.clone().addScaledVector(ray,t),localY=(hit.y-offsetY)/scaleY;
    if(hit.y<b.floor-110||localY>.077)return false;
    let half=.081;if(localY>.008)half*=Math.sqrt(Math.max(0,1-((localY-.008)/.069)**2));
    half=Math.min(half,door.rx*Math.sqrt(Math.max(0,1-((localY-door.cy)/door.ry)**2))-.002);
    if(Math.abs(hit.x)>=half)return false;
   }
  }
  return true;
 },
 clearedEntrance(m,s,model){
  const T=AlpineThree,scale=.162/3/3.20,rad=Math.PI/180;
  const pose=new T.Group();pose.rotation.set(-(s.pitch*rad+(m.pitchBob||0)),Math.PI-s.heading*rad,m.bank||0,'YXZ');
  let rear=Infinity;
  for(const x of [-1.625,1.625])for(const y of [0,2.36*.80])for(const z of [-createClassFShuttle.aftExtent-.02,3.40]){
   rear=Math.min(rear,new T.Vector3(x,y,z).multiplyScalar(scale).applyQuaternion(pose.quaternion).z+m.y);
  }
  const body=(model??window.EnterpriseModels?.selected)==='original'?1:(window.EnterpriseEngineeringShape?.bodyScale??.85);
  return rear>hangarDoorProfile().baseFront*body-.032+.001;
 },
 nearEntrance(before,after,model){
  const b=this.dimensions(model),limit=this.approachDistance;
  let t=1;
  if(Math.abs(after.y-b.mouth)>limit){const dy=after.y-before.y;if(!dy)return false;const plane=b.mouth+(before.y>b.mouth?limit:-limit);t=(plane-before.y)/dy;if(t<0||t>1)return false;}
  const x=before.x+(after.x-before.x)*t,z=before.z+(after.z-before.z)*t;
  return Math.abs(x)<.068&&z>b.floor-.004&&z<b.ceiling+.004;
 }
};
