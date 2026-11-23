const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),B=require('../engine.js'),Replay=require('../replay.js');
function cameraScene(){
  const root=path.join(__dirname,'..'),c={window:{},Battle:B,console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
  const T=c.window.AlpineThree,s=Object.create(c.window.BattleScene.prototype);
  Object.assign(s,{T,camera:new T.PerspectiveCamera(46,1.8,.5,65000),sim:new B.Simulation(),ships:{Enterprise:new T.Group(),Yorktown:new T.Group()},effects:[]});
  for(const ship of Object.values(s.ships)){const model=new T.Group();ship.add(model);ship.userData.model=model;}
  s.ships.Yorktown.position.set(300,100,-1100);s.burst=()=>{};s.addImpactScar=()=>{};
  return s;
}
function view(s,kind,screenAt,key=kind){
  s.sim.replayShot={kind,focus:'Enterprise',screenAt,key};
  const position=new s.T.Vector3(),target=new s.T.Vector3(),cut=s.replayCamera(position,target);
  s.camera.position.copy(position);return {position,target,cut};
}
test('quiet travel uses long tracking, trailing and fly-by storyboard beats in screen time',()=>{
  const sim=new B.Simulation(),frame={player:sim.player,enemy:sim.enemy,projectiles:[],stageIndex:0,maneuver:'direct',phase:'attack'};
  const record={pass:1,startTime:0,station:sim.station,planet:sim.planet,environment:'space',duration:120,events:[],frames:[{...frame,at:0},{...frame,at:120}]};
  const player=new Replay.Player(record,sim);
  for(const [screenTime,kind] of [[0,'establishing'],[7,'tracking'],[14,'trailing'],[21,'flyby'],[28,'wide']]){
    player.screenTime=screenTime;player.sample(screenTime);assert.equal(player.state.replayShot.kind,kind);
  }
});
test('tracking shots hold at least seven screen seconds and preserve the viewing side',()=>{
  const s=cameraScene();assert(view(s,'tracking',0).cut);
  for(const time of [1,3,6.9])assert.equal(view(s,'trailing',time).cut,false);
  assert(view(s,'trailing',7).cut);const offset=s.camera.position.clone().sub(s.replayComposition.lastTarget);
  assert(offset.dot(s.replayAxisSide)>0);
});
test('recorded impact queues a reverse shot followed by a tight close-up of its actual hull contact',()=>{
  const s=cameraScene();view(s,'tracking',0);
  s.sim.time=1;s.sim.replayShot.screenAt=1;
  const event={type:'impact',ship:'Yorktown',weapon:'phaser',hullDamage:5,hit:{point:{x:.2,y:.3,z:-.5},normal:{x:0,y:1,z:0}}};
  s.event(event);assert.equal(s.replayReactions.length,1);
  assert.equal(view(s,'tracking',2).cut,false);
  assert(view(s,'tracking',3.5).cut);assert.equal(s.replayComposition.kind,'impact');assert.equal(s.replayComposition.focus,'Yorktown');
  assert.equal(s.replayReactions.length,0);assert.equal(s.replayDetail.event,event);
  assert.equal(view(s,'tracking',6).cut,false);
  const close=view(s,'tracking',7);assert(close.cut);assert.equal(s.replayComposition.kind,'component');
  s.ships.Yorktown.updateMatrixWorld(true);
  const hit=s.ships.Yorktown.userData.model.localToWorld(new s.T.Vector3(.2,.3,-.5));
  assert(close.target.distanceTo(hit)<1e-8);assert(close.position.distanceTo(close.target)<200);
});
test('fly-by produces bounded parallax as the ship travels through the shot',()=>{
  const s=cameraScene(),first=view(s,'flyby',0);
  s.ships.Enterprise.position.x+=100;
  const next=view(s,'flyby',1);
  assert.equal(next.cut,false);const cameraMovement=next.position.x-first.position.x;
  assert(cameraMovement<100&&cameraMovement>0,'camera lets the ship move across the frame');
});
