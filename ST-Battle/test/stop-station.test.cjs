const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const B=require('../engine.js');

test('full stop holds Enterprise stationary after release in manual and automatic flight, and thrust resumes it',()=>{
  for(const turnBased of [false,true]){
    const sim=new B.Simulation(97,{turnBased});sim.running=true;
    Object.assign(sim.player,{x:2000,y:0,z:0,throttle:80,speed:100});Object.assign(sim.enemy,{x:2000,y:0,z:-1500});sim.enemy.integrity.weapons=0;
    if(turnBased){sim.applyPlanPreset('strong');assert(sim.commitOrders());}
    assert(sim.stopEnterprise());const position={x:sim.player.x,y:sim.player.y,z:sim.player.z};
    for(let i=0;i<20;i++)sim.tick(.05);
    assert.equal(sim.player.speed,0);assert.equal(sim.player.throttle,0);assert.equal(B.distance(position,sim.player),0,'releasing Space does not reapply minimum impulse');
    sim.tick(.1,{more:true});assert.equal(sim.player.fullStop,false);assert(sim.player.speed>0,'thrust resumes flight');
  }
});

test('K7 collision volumes stay stationary as simulation time advances',()=>{
  const sim=new B.Simulation(),k=sim.station;
  const cargo={x:k.x+k.cargo.x*k.scale,y:k.y+k.cargo.y*k.scale,z:k.z};
  assert(sim.stationTrace(cargo,cargo),'cargo is solid at its original position');
  sim.time=120;const angle=Math.PI/2,x=cargo.x-k.x,z=cargo.z-k.z;
  const turned={x:k.x+Math.cos(angle)*x+Math.sin(angle)*z,y:cargo.y,z:k.z-Math.sin(angle)*x+Math.cos(angle)*z};
  assert.equal(B.K7_ROTATION_RATE,0);assert.equal(sim.stationTrace(turned,turned),null,'cargo does not rotate into the old quarter-turn position');
  assert(sim.stationTrace(cargo,cargo),'cargo stays solid at its original position');
  const ray={x:cargo.x,y:cargo.y+100,z:cargo.z},hit=sim.stationTrace(ray,cargo);
  assert(hit);assert(Math.abs(hit.pos.x-cargo.x)<1e-8&&Math.abs(hit.pos.z-cargo.z)<1e-8,'contact is returned in world coordinates');
  assert(hit.normal.y>.9,'contact normal is restored to world coordinates');
});

test('K7 stays fixed without rotation in live views and replay seeks',()=>{
  const c={window:{},Battle:B,console,AbortController};vm.createContext(c);
  for(const p of ['vendor/three.js','geometry.js','scene.js'])vm.runInContext(fs.readFileSync(p,'utf8'),c);
  const T=c.window.AlpineThree,scene=Object.create(c.window.BattleScene.prototype);scene.T=T;scene.sim=new B.Simulation();scene.hullPanelCanvas=()=>({});scene.texture=()=>null;scene.station=scene.makeStation();
  const root=scene.station,before=root.position.clone();scene.sim.time=60;scene.updateStationRotation();
  assert.equal(root.rotation.y,0,'elapsed time does not rotate K7');
  assert.equal(root.rotation.x,0);assert.equal(root.rotation.z,0);assert(root.position.equals(before));
  root.updateMatrixWorld(true);const beacon=root.userData.beacon.getWorldPosition(new T.Vector3());
  assert(Math.abs(beacon.x-root.position.x)<1e-8&&Math.abs(beacon.z-root.position.z)<1e-8,'rotation axis passes through the top ball');
  scene.sim={time:30,replayShot:{}};scene.updateStationRotation();assert.equal(root.rotation.y,0,'replay seeks also leave K7 stationary');
});
