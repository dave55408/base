const test=require('node:test'),assert=require('node:assert/strict'),math=require('./space-math.js');
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} should equal ${b}`);
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

