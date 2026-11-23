const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){
  const root=path.join(__dirname,'..'),c={window:{},console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','engine.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
  const T=c.window.AlpineThree,s=Object.create(c.window.BattleScene.prototype);
  Object.assign(s,{T,scene:new T.Scene(),sim:new c.Battle.Simulation(),mode:'tactical'});
  Object.assign(s.sim.player,{x:0,y:0,z:0,heading:0,pitch:0,speed:100,turnRate:0,pitchRate:0});
  Object.assign(s.sim.enemy,{x:500,y:100,z:0,heading:90,pitch:0,speed:50,turnRate:0,pitchRate:0});
  return s;
}
const vertices=line=>Array.from(line.geometry.attributes.position.array.slice(0,line.geometry.drawRange.count*3));
test('solid paths keep only thirty simulated seconds and remain bounded while paused',()=>{
  const s=setup();
  for(let i=0;i<=400;i++){s.sim.time=i/10;s.sim.player.z=-i*10;s.updateTacticalPaths();}
  const p=s.tacticalPaths.Enterprise;assert(p.history.length<=301);
  assert(p.history.every(point=>point.time>=10&&point.time<=40));
  const before=JSON.stringify(p.history);for(let i=0;i<200;i++)s.updateTacticalPaths();
  assert.equal(JSON.stringify(p.history),before);
  const points=vertices(p.past);assert(points.length>0);assert(points.every(Number.isFinite));
  assert(points.filter((_,i)=>i%3===2).every(z=>z<=-1000&&z>=-4000));
  assert.equal(p.past.material.color.getHex(),0x398cff);
  assert.equal(s.tacticalPaths.Yorktown.past.material.color.getHex(),0x45e68b);
  const colors=Array.from(p.past.geometry.attributes.color.array.slice(0,points.length));
  assert.deepEqual(colors.slice(0,3),[0,0,0]);assert.deepEqual(colors.slice(-3),[1,1,1]);
  assert(colors.some(value=>value>0&&value<1),'history fades gradually');
});
test('dashed fifteen-second predictions follow current motion without changing simulation state',()=>{
  const s=setup(),before=JSON.stringify(s.sim);s.updateTacticalPaths();assert.equal(JSON.stringify(s.sim),before);
  const line=s.tacticalPaths.Enterprise.future,points=vertices(line);
  assert.equal(line.geometry.drawRange.count,62);assert.deepEqual(points.slice(0,3),[0,0,0]);
  assert.equal(points[points.length-1],-1500);
  const colors=Array.from(line.geometry.attributes.color.array.slice(0,points.length));
  assert(line.material.vertexColors);assert.deepEqual(colors.slice(0,3),[1,1,1]);assert.deepEqual(colors.slice(-3),[0,0,0]);assert(colors.some(value=>value>0&&value<1),'prediction fades smoothly toward its endpoint');
  assert(colors.every((value,i)=>i===0||value<=colors[i-1]),'prediction never brightens toward the future');
  assert.equal(points[11],-50);assert.equal(points[14],-100,'prediction has a visible dash gap');
  s.sim.player.turnRate=3;s.updateTacticalPaths();assert(vertices(line).some((v,i)=>i%3===0&&v>100));
});
test('camera switches retain history, Cinema hides paths, and reset discards old tracks',()=>{
  const s=setup();s.updateTacticalPaths();s.sim.time=1;s.sim.player.z=-100;
  s.mode='chase';s.updateTacticalPaths();assert.equal(s.tacticalPaths.Enterprise.past.visible,false);
  s.mode='cinematic';s.updateTacticalPaths();assert.equal(s.tacticalPaths.Enterprise.future.visible,false);
  s.mode='tactical';s.updateTacticalPaths();assert(s.tacticalPaths.Enterprise.past.visible);assert.equal(s.tacticalPaths.Enterprise.history.length,2);
  s.sim.reset();s.updateTacticalPaths();assert.equal(s.tacticalPaths.Enterprise.history.length,1);
});
test('warp jumps and sensor gaps are not drawn as traveled lines',()=>{
  const s=setup();s.updateTacticalPaths();s.sim.time=.1;s.sim.player.x=3000;s.updateTacticalPaths();
  assert.equal(s.tacticalPaths.Enterprise.past.geometry.drawRange.count,0);
  Object.assign(s.sim.enemy,{x:400,y:0,z:-500});s.sim.time=.2;s.updateTacticalPaths();
  s.sim.player.integrity.sensors=0;s.sim.time=.3;s.updateTacticalPaths();assert.equal(s.tacticalPaths.Yorktown.future.visible,false);
});
