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

test('K7 contact volumes turn with the hull around its central vertical axis',()=>{
  const sim=new B.Simulation(),k=sim.station;
  const cargo={x:k.x+k.cargo.x*k.scale,y:k.y+k.cargo.y*k.scale,z:k.z};
  assert(sim.stationTrace(cargo,cargo),'cargo is solid at its original position');
  sim.time=120;const angle=sim.time*B.K7_ROTATION_RATE,x=cargo.x-k.x,z=cargo.z-k.z;
  const turned={x:k.x+Math.cos(angle)*x+Math.sin(angle)*z,y:cargo.y,z:k.z-Math.sin(angle)*x+Math.cos(angle)*z};
  assert(sim.stationTrace(turned,turned),'rotated cargo remains solid');
  assert.equal(sim.stationTrace(cargo,cargo),null,'the old cargo location is now empty');
  const ray={x:turned.x,y:turned.y+100,z:turned.z},hit=sim.stationTrace(ray,turned);
  assert(hit);assert(Math.abs(hit.pos.x-turned.x)<1e-8&&Math.abs(hit.pos.z-turned.z)<1e-8,'contact is returned in world coordinates');
  assert(hit.normal.y>.9,'contact normal is restored to world coordinates');
});

test('K7 spins counterclockwise slowly without moving or tilting its beacon-to-base axis, including replay time',()=>{
  const c={window:{},Battle:B,console,AbortController};vm.createContext(c);
  for(const p of ['vendor/three.js','geometry.js','scene.js'])vm.runInContext(fs.readFileSync(p,'utf8'),c);
  const T=c.window.AlpineThree,scene=Object.create(c.window.BattleScene.prototype);scene.T=T;scene.sim=new B.Simulation();scene.hullPanelCanvas=()=>({});scene.texture=()=>null;scene.station=scene.makeStation();
  const root=scene.station,before=root.position.clone();scene.sim.time=60;scene.updateStationRotation();
  assert(Math.abs(root.rotation.y-Math.PI/4)<1e-10,'only 45 degrees per minute, counterclockwise from above');
  assert.equal(root.rotation.x,0);assert.equal(root.rotation.z,0);assert(root.position.equals(before));
  root.updateMatrixWorld(true);const beacon=root.userData.beacon.getWorldPosition(new T.Vector3());
  assert(Math.abs(beacon.x-root.position.x)<1e-8&&Math.abs(beacon.z-root.position.z)<1e-8,'rotation axis passes through the top ball');
  scene.sim={time:30,replayShot:{}};scene.updateStationRotation();assert(Math.abs(root.rotation.y-Math.PI/8)<1e-10,'replay seeks use recorded time');
});
