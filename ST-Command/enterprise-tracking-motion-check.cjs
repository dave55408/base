const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addScriptTag({path:path.join(__dirname,'vendor/alpine-three.js')});
  await page.addScriptTag({path:path.join(__dirname,'enterprise-tracking.js')});
  const result=await page.evaluate(()=>{
   const T=AlpineThree;
   function shoot({shipSpeed=0,shuttleSpeed=0,rate=60,reverse=false}){
    const model=new T.Group();model.add(new T.Mesh(new T.BoxGeometry(2,1,4),new T.MeshBasicMaterial()));
    const camera=new T.PerspectiveCamera(45,1.5,.01,100),mission={freeSpace:true,carrier:{x:0,y:0,z:0}},simulation={time:0};
    EnterpriseTracking.reset(mission);camera.position.set(0,0,10);camera.lookAt(0,0,0);
    let maxStep=0,previous=camera.quaternion.clone(),beforeReverse,earlyDrift;
    for(let i=0;i<=rate*8;i++){
     const time=i/rate,turn=reverse&&time>4;
     const travel=turn?8-time:time;
     mission.carrier.x=shipSpeed*travel;
     camera.position.set(shuttleSpeed*travel-mission.carrier.x,0,10);
     simulation.time=time;EnterpriseTracking.aim(camera,model,mission,simulation);
     if(i===rate*4)beforeReverse=EnterpriseTracking.target(model).project(camera).x;
     if(i===Math.round(rate*.2))earlyDrift=EnterpriseTracking.target(model).project(camera).x;
     if(i)maxStep=Math.max(maxStep,previous.angleTo(camera.quaternion));previous.copy(camera.quaternion);
    }
    const subject=EnterpriseTracking.target(model).project(camera),paused=camera.quaternion.clone();
    for(let i=0;i<20;i++)EnterpriseTracking.aim(camera,model,mission,simulation);
    const pauseError=paused.angleTo(camera.quaternion);
    // Once both ships stop, the operator gently returns to centered framing.
    for(let i=0;i<rate*4;i++){simulation.time+=1/rate;EnterpriseTracking.aim(camera,model,mission,simulation);}
    const stopped=EnterpriseTracking.target(model).project(camera);
    return {x:subject.x,y:subject.y,z:subject.z,maxStep,pauseError,stoppedX:stopped.x,beforeReverse,earlyDrift};
   }
   function passing(sideways,rate=60){
    const model=new T.Group();model.add(new T.Mesh(new T.BoxGeometry(2,1,4),new T.MeshBasicMaterial()));
    const camera=new T.PerspectiveCamera(45,1.5,.01,100),mission={},simulation={time:0};
    const place=time=>camera.position.set(sideways?-10+Math.min(time,2)*10:1,0,sideways?3:10-Math.min(time,2)*10);
    place(0);camera.lookAt(0,0,0);EnterpriseTracking.reset(mission);
    let maxRate=0,lagAtPass=0,previous=camera.quaternion.clone();
    for(let i=0;i<=rate*10;i++){
     simulation.time=i/rate;place(simulation.time);EnterpriseTracking.aim(camera,model,mission,simulation);
     if(i)maxRate=Math.max(maxRate,previous.angleTo(camera.quaternion)*rate);previous.copy(camera.quaternion);
     if(i===rate*2)lagAtPass=camera.getWorldDirection(new T.Vector3()).angleTo(camera.position.clone().negate().normalize());
    }
    const finalError=camera.getWorldDirection(new T.Vector3()).angleTo(camera.position.clone().negate().normalize());
    return {maxRate,lagAtPass,finalError};
   }
   // A rotating Enterprise frame must not roll the operator's inertial horizon.
   const model=new T.Group();model.add(new T.Mesh(new T.BoxGeometry(2,1,4),new T.MeshBasicMaterial()));
   const camera=new T.PerspectiveCamera(45,1.5,.01,100),mission={freeSpace:true,carrier:{heading:0,pitch:0,roll:0}},simulation={time:0},frame=new T.Group();
   EnterpriseTracking.reset(mission);let rotationError=0;
   for(let i=0;i<=180;i++){
    simulation.time=i/60;Object.assign(mission.carrier,{heading:i*.25,pitch:i*.05,roll:i*.002});
    frame.rotation.set(mission.carrier.pitch*Math.PI/180,-mission.carrier.heading*Math.PI/180,-mission.carrier.roll,'YXZ');
    camera.position.set(0,0,10).applyQuaternion(frame.quaternion.clone().invert());
    camera.quaternion.copy(frame.quaternion).invert();EnterpriseTracking.aim(camera,model,mission,simulation);
    rotationError=Math.max(rotationError,camera.quaternion.clone().premultiply(frame.quaternion).angleTo(new T.Group().quaternion));
   }
   return {rotationError,frontToBack:passing(false),sideToSide:passing(true),passingThirty:passing(false,30),
    ship:shoot({shipSpeed:.5}),shuttle:shoot({shuttleSpeed:-.5}),both:shoot({shipSpeed:.8,shuttleSpeed:.3}),
    sameVelocity:shoot({shipSpeed:.5,shuttleSpeed:.5}),reverse:shoot({shipSpeed:.5,reverse:true}),
    thirty:shoot({shipSpeed:.5,rate:30}),sixty:shoot({shipSpeed:.5,rate:60})
   };
  });
  for(const shot of [result.ship,result.shuttle,result.both]){
   assert(shot.x<-.02&&shot.x>-.4,'leave visible room ahead of rightward relative motion');
   assert(shot.earlyDrift>.01,'let Enterprise get ahead during the operator reaction delay');
   assert(Math.abs(shot.y)<.01&&shot.z>-1&&shot.z<1);assert(shot.maxStep<.03,'pan smoothly');
   assert(shot.pauseError<1e-7,'freeze camera while paused');assert(Math.abs(shot.stoppedX)<.01,'ease back to center after stopping');
  }
  assert(Math.abs(result.ship.x-result.shuttle.x)<1e-6,'equivalent motion of either ship gets the same framing');
  assert(Math.abs(result.ship.x-result.both.x)<1e-6,'use relative motion of both ships');
  assert(Math.abs(result.sameVelocity.x)<.001,'no false lead when both ships move together');
  assert(result.reverse.beforeReverse<0&&result.reverse.x>.02,'lead changes sides smoothly after reversal');
  assert(Math.abs(result.thirty.x-result.sixty.x)<.01,'consistent framing at 30 and 60 FPS');
  assert(result.rotationError<1e-7,'Enterprise yaw, pitch, and roll do not drag the camera horizon');
  for(const shot of [result.frontToBack,result.sideToSide,result.passingThirty]){
   assert(shot.maxRate<=55*Math.PI/180+.001,'limit human pan speed during close passes');
   assert(shot.lagAtPass>.5,'let the ship pass ahead rather than snapping across');
   assert(shot.finalError<.02,'smoothly catch up and reacquire the ship');
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify(result));
  console.log('Passed: relative ship/shuttle motion, lead room, smooth pans, reversal, paused camera, stopped framing, and frame-rate independence.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
