const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(){
  const c={window:{},console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','engine.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const T=c.window.AlpineThree,scene=Object.create(c.window.BattleScene.prototype),bursts=[];
  Object.assign(scene,{T,scene:new T.Scene(),sim:new c.Battle.Simulation(97),effects:[],clock:0,burst:(...args)=>bursts.push(args)});
  return {scene,bursts};
}
test('ship and K7 collisions retain the impact burst and add drifting, tumbling, cooling fragments',()=>{
  for(const type of ['ship-collision','station-collision']){
    const {scene:s,bursts}=fixture();s.event({type,ship:'Enterprise',pos:{x:100,y:200,z:300}});
    assert.equal(bursts.length,1);assert.equal(bursts[0][2],30);
    const fragments=s.effects.filter(effect=>effect.kind==='collision-debris');assert.equal(fragments.length,type==='ship-collision'?12:8);
    for(const effect of fragments){
      const position=effect.object.position.clone(),rotation=effect.object.quaternion.clone(),ember=effect.object.material.emissive.r;
      effect.life=.5;s.advanceDebris(effect,.5);
      assert(effect.object.position.distanceTo(position)>1);assert(rotation.angleTo(effect.object.quaternion)>0);
      assert(effect.object.material.emissive.r<=ember);assert.equal(effect.object.material.opacity,1);
      effect.life=effect.max-.35;s.advanceDebris(effect,0);assert(Math.abs(effect.object.material.opacity-.5)<1e-8);
      let disposed=0;effect.object.geometry.addEventListener('dispose',()=>disposed++);effect.object.material.addEventListener('dispose',()=>disposed++);
      s.disposeEffect(effect);assert.equal(disposed,2);assert(!s.scene.children.includes(effect.object));
    }
  }
});
test('repeated collision contacts limit debris without suppressing existing impact bursts',()=>{
  const {scene:s,bursts}=fixture(),event={type:'station-collision',ship:'Enterprise',pos:{x:100,y:200,z:300}};
  s.event(event);s.clock=.1;s.event(event);assert.equal(s.effects.length,8);assert.equal(bursts.length,2);
  for(let i=0;i<100;i++){s.clock+=.31;s.event(event);}
  assert.equal(s.effects.length,80,'persistent contact cannot create an unbounded cloud');
});
test('recorded collision positions reproduce the same fragment burst during replay',()=>{
  const live=fixture().scene,replay=fixture().scene,event={type:'ship-collision',ship:'Yorktown',pos:{x:123,y:45,z:-678}};
  replay.clock=100;replay.sim.replayShot={};live.event(event);replay.event(event);
  const describe=scene=>JSON.stringify(scene.effects.map(effect=>({position:effect.object.position.toArray(),velocity:effect.velocity.toArray(),spin:effect.spin.toArray(),max:effect.max})));
  assert.equal(describe(live),describe(replay));
});
