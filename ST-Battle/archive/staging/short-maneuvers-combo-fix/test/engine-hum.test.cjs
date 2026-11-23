const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function harness(source){
  const players=[];
  class Audio{constructor(url){this.url=url;this.playbackRate=1;this.plays=0;this.paused=true;players.push(this);}load(){}play(){this.plays++;this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
  const c={window:{Audio},console};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../weapon-audio.js'),'utf8'),c);
  return {engine:new c.window.BattleEngineAudio(source),players};
}
test('Enterprise engine loop uses drone_hum and raises pitch by at most 40 percent in either direction',async()=>{
  const {engine:e,players:[a]}=harness();assert.equal(a.url,'assets/drone_hum.mp3');assert.equal(a.loop,true);assert.equal(a.preservesPitch,false);
  e.setEnabled(true);e.update({speed:0,maximum:200,active:true});await new Promise(setImmediate);assert.equal(a.playbackRate,1);assert(!a.paused);
  e.update({speed:100,maximum:200,active:true});assert.equal(a.playbackRate,1.2);
  e.update({speed:200,maximum:200,active:true});assert.equal(a.playbackRate,1.4);
  e.update({speed:-200,maximum:200,active:true});assert.equal(a.playbackRate,1.4);
  e.update({speed:800,maximum:200,active:true});assert.equal(a.playbackRate,1.4);
  assert.equal(a.plays,1,'updates reuse one looping player');
});
test('Engine hum stops during inactivity and mute, and resumes without spawning duplicate loops',async()=>{
  const {engine:e,players:[a]}=harness();e.setEnabled(true);await new Promise(setImmediate);assert(a.paused,'priming remains silent while inactive');
  e.update({speed:80,active:true});await new Promise(setImmediate);assert(!a.paused);assert(a.volume>0);
  e.update({speed:80,active:false});assert(a.paused);assert.equal(a.volume,0);
  e.update({speed:80,active:true});await new Promise(setImmediate);assert(!a.paused);
  e.setEnabled(false);assert(a.paused);assert.equal(a.volume,0);
  e.update({speed:80,active:true});assert(a.paused);
});
test('Engine recording is packaged with the game assets',()=>{
  const clip=fs.readFileSync(path.join(__dirname,'../assets/drone_hum.mp3'));assert(clip.length>1000);
});

test('Yorktown uses its own engine recording with the same speed pitch response',()=>{
  const {engine,players:[audio]}=harness('assets/drone_hum_yorktown.mp3');
  assert.equal(audio.url,'assets/drone_hum_yorktown.mp3');assert.equal(audio.loop,true);
  engine.update({speed:-200,maximum:200,active:true});assert.equal(audio.playbackRate,1.4);
  assert(fs.readFileSync(path.join(__dirname,'../assets/drone_hum_yorktown.mp3')).length>1000);
});
