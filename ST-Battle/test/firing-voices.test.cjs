const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const B=require('../engine.js');
function harness(){
  const players=[];
  class Audio{constructor(url){this.url=url;players.push(this);}play(){return Promise.resolve();}pause(){this.paused=true;}}
  const context={window:{Audio}};vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../firing-voices.js'),'utf8'),context);
  return {voice:new context.window.BattleFiringVoices(),players};
}
test('captain command finishes before a shot is released, and repeats use the short Fire clip',()=>{
  const {voice,players}=harness(),request={type:'phaser',context:{},now:0};
  assert.equal(voice.prepare(request),false);assert.equal(players[0].url,'assets/Fire phasers.mp3');
  assert.equal(voice.prepare(request),false);assert.equal(players.length,1);
  players[0].onended();assert.equal(voice.prepare(request),true);
  assert.equal(voice.prepare({...request,now:1000}),false);assert.equal(players[1].url,'assets/Fire.mp3');
});
test('torpedo salvos, singular shots, and urgent situations select their matching recordings',()=>{
  for(const [options,name] of [[{type:'torpedo'},'Fire torpedo'],[{type:'torpedo',torpedoes:2},'Fire torpedoes'],[{type:'phaser',urgent:true},'Fire_urgent']]){
    const {voice,players}=harness();voice.prepare(options);assert.equal(players[0].url,'assets/'+name+'.mp3');
    assert(fs.statSync(path.join(__dirname,'..',players[0].url)).size>0);
  }
});
test('changed commands wait for current speech; errors release a shot and long recordings are never cut short',()=>{
  const {voice,players}=harness(),request={type:'phaser',context:{}};
  voice.prepare(request);const stale=players[0].onended;voice.stop();stale();assert.equal(voice.pending,null);
  voice.prepare(request);assert.equal(voice.prepare({...request,type:'torpedo'}),false);assert.notEqual(players[1].paused,true);
  players[1].onended();voice.prepare({...request,type:'torpedo'});players[2].onerror();assert.equal(voice.prepare({...request,type:'torpedo'}),true);
  voice.prepare(request);assert.equal(voice.prepare({...request,now:12000}),false,'elapsed time cannot truncate a recording');
  players[3].onended();assert.equal(voice.prepare(request),true);
});
test('closely spaced fire commands are all played instead of suppressed',()=>{
  const {voice,players}=harness(),context={};
  for(const [i,options] of [{type:'phaser'},{type:'torpedo'},{type:'torpedo',torpedoes:3},{type:'phaser',urgent:true}].entries()){
    const request={...options,context,now:i*100};
    assert.equal(voice.prepare(request),false);assert.equal(players.length,i+1);
    players[i].onended();assert.equal(voice.prepare(request),true);
  }
});

test('the simulation defers only valid player shots without spending resources or holding enemy fire',()=>{
  const sim=new B.Simulation(97);sim.startFreeFlight();
  let allow=false,calls=0;sim.beforePlayerFire=()=>{calls++;return allow;};
  const ammo=sim.player.torpedoes;
  assert.equal(sim.fire('torpedo',sim.player,sim.enemy,false),false);
  assert.equal(sim.player.torpedoes,ammo);assert.equal(sim.player.cooldown.torpedo,0);assert.equal(sim.projectiles.length,0);
  allow=true;assert.equal(sim.fire('torpedo',sim.player,sim.enemy,false),true);assert.equal(calls,2);
  sim.fire('torpedo',sim.player,sim.enemy,false);assert.equal(calls,2,'unready shots do not play commands');
  sim.fire('torpedo',sim.enemy,sim.player,false);assert.equal(calls,2,'enemy fire does not use the captain voice');
});


test('suppressing a repeated firing phrase still executes the shot and releases the voice queue',()=>{
  const {voice,players}=harness();let shots=0,done=0;
  voice.prepare({type:'phaser',context:{},urgent:true,execute:()=>{shots++;return true;},beforeStart:()=>false,enqueue:start=>start(()=>done++)});
  assert.equal(shots,1);assert.equal(done,1);assert.equal(voice.pending,null);assert.equal(voice.active,null);assert.equal(players[0].onended,null,'suppressed audio never waits for an ended event');
});
