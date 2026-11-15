const test=require('node:test'),assert=require('node:assert/strict'),math=require('./space-math.js');
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} should equal ${b}`);
test('helm axes share a gentle ramp, full rate, and fresh release/reversal',()=>{
  for(const axis of ['yaw','flatYaw','pitch','roll','vertical','power','neutral','brake']){
    const memory={},first=math.rampedInput(memory,axis,1,.05);
    assert(first>.2&&first<.22);
    for(let i=0;i<13;i++)math.rampedInput(memory,axis,1,.05);
    near(math.rampedInput(memory,axis,1,.05),1);
    near(math.rampedInput(memory,axis,-1,.05),-first);
    near(math.rampedInput(memory,axis,0,.05),0);
    near(math.rampedInput(memory,axis,1,.05),first);
  }
  const memory={};near(math.rampedInput(memory,'yaw',1,0),0);assert.deepEqual(memory,{});
});
test('3D flight vectors preserve speed, heading, and climb angle',()=>{
  const v=math.direction(90,30);near(Math.hypot(v.x,v.y,v.z),1);near(v.x,Math.cos(Math.PI/6));near(v.y,0);near(v.z,.5);
  assert(math.direction(0,-45).z<0);near(math.direction(0,0).y,-1);
});
test('distance and autopilot alignment include altitude',()=>{
  const a={x:0,y:0,z:0},b={x:0,y:-3,z:4};near(math.distance(a,b),5);near(math.pitchTo(a,b),53.13010235415598);
  near(math.alignment(0,math.pitchTo(a,b),0,math.pitchTo(a,b)),1);near(math.alignment(180,0,0,0),-1);
});
test('map picking round trips after orbit, tilt, zoom, and resize',()=>{
  for(const [w,h] of [[540,340],[360,330]])for(const yaw of [-140,-25,80])for(const tilt of [-82,-52,-18,18,52,82])for(const zoom of [.65,1,1.8]){
    const camera=math.camera(w,h,yaw,tilt,zoom),p={x:740,y:640,z:95},screen=camera.project(p),world=camera.unproject(screen.x,screen.y,p.z);
    near(world.x,p.x);near(world.y,p.y);near(world.z,p.z);
  }
});
test('elevated systems project at different depths from the reference plane',()=>{
  const camera=math.camera(540,340),a=camera.project({x:500,y:450,z:0}),b=camera.project({x:500,y:450,z:100});
  assert(b.y<a.y);assert(b.depth>a.depth);assert(b.scale>a.scale);
});

test('negative power brakes to zero before accelerating astern',()=>{
  let speed=2;const history=[];
  for(let n=0;n<40;n++){speed=math.poweredSpeed(speed,-50,4,.05);history.push(speed);}
  const reversed=history.findIndex(v=>v<0);assert(reversed>0);assert(history.slice(0,reversed).every(v=>v>=0));near(history[reversed-1],0);near(history.at(-1),-2);
  assert(math.poweredSpeed(0,-25,.4,.1)<0);
});
test('opposing forward thrust brakes reverse momentum and all stop stays immediate',()=>{
  near(math.poweredSpeed(-.2,100,.4,1),0);near(math.poweredSpeed(0,100,.4,.05),.4);
  near(math.poweredSpeed(2,0,4,.05),0);near(math.poweredSpeed(-2,0,4,.05),0);
  near(math.poweredSpeed(1,-50,4,0),1);
});


test('shuttle pitch completes loops and holds an inverted attitude',()=>{
  for(const sign of [-1,1]){
    let pose={heading:0,pitch:0,roll:0};
    for(let i=0;i<120;i++)pose=math.pitchAttitude(pose.heading,pose.pitch,pose.roll,sign*1.5);
    near(pose.pitch,0);near(Math.cos(pose.roll),-1);
    const held=math.pitchAttitude(pose.heading,pose.pitch,pose.roll,0);assert.deepEqual(held,pose);
    for(let i=0;i<120;i++)pose=math.pitchAttitude(pose.heading,pose.pitch,pose.roll,sign*1.5);
    near(pose.pitch,0);near(Math.cos(pose.roll),1);near(Math.cos(pose.heading*Math.PI/180),1);
  }
});
test('shuttle pitch follows its own up vector when inverted or banked',()=>{
  const inverted=math.pitchAttitude(0,0,Math.PI,15);near(inverted.pitch,-15);
  const sideways=math.pitchAttitude(0,0,Math.PI/2,15);near(sideways.heading,15);near(sideways.pitch,0);
  const vertical=math.pitchAttitude(37,88.5,0,1.5);near(vertical.pitch,90);near(vertical.heading,37);
  const over=math.pitchAttitude(vertical.heading,vertical.pitch,vertical.roll,1.5);near(over.pitch,88.5);near(over.heading,217);near(Math.cos(over.roll),-1);
});
