const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function harness(source,kind='BattleEngineAudio'){
  const players=[];
  class Audio{constructor(url){this.url=url;this.playbackRate=1;this.plays=0;this.paused=true;players.push(this);}load(){}play(){this.plays++;this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
  const c={window:{Audio},console};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../weapon-audio.js'),'utf8'),c);
  return {engine:new c.window[kind](source),players};
}

test('viewscreen ambience repeats quietly at fixed pitch and stops on mute or hidden state',async()=>{
  const {engine:e,players:[audio]}=harness(undefined,'BattleViewscreenAudio');
  assert.equal(audio.url,'assets/viewscreen_slow.mp3');assert.equal(audio.loop,true);
  assert(fs.statSync(path.join(__dirname,'..',audio.url)).size>1000);
  e.setEnabled(true);e.update({active:true});await new Promise(setImmediate);
  assert.equal(audio.paused,false);assert.equal(audio.volume,.025);assert.equal(audio.playbackRate,1);
  for(let i=0;i<10;i++)e.update({active:true});assert.equal(audio.plays,1);
  e.update({active:false});assert.equal(audio.paused,true);assert.equal(audio.volume,0);
  e.update({active:true});await new Promise(setImmediate);assert.equal(audio.paused,false);
  e.setEnabled(false);assert.equal(audio.paused,true);assert.equal(audio.volume,0);
});

test('steady viewscreen ambience never spikes to engine volume or repeatedly resets playback speed',async()=>{
  const {engine,players:[audio]}=harness(undefined,'BattleViewscreenAudio');
  const volumes=[],rates=[];let volume=0,rate=1;
  Object.defineProperty(audio,'volume',{get:()=>volume,set:value=>{volume=value;volumes.push(value);}});
  Object.defineProperty(audio,'playbackRate',{get:()=>rate,set:value=>{rate=value;rates.push(value);}});
  engine.setEnabled(true);engine.update({active:true});await new Promise(setImmediate);
  for(let i=0;i<120;i++)engine.update({active:true});
  assert.deepEqual(volumes,[.025],'set the quiet level once, without per-frame spikes');
  assert.deepEqual(rates,[],'a fixed-speed loop never needs playback-rate assignments');
  assert.equal(audio.plays,1);
});
test('Enterprise engine loop uses drone_hum and raises pitch by at most 40 percent in either direction',async()=>{
  const {engine:e,players:[a]}=harness();assert.equal(a.url,'assets/drone_hum.mp3');assert.equal(a.loop,true);assert.equal(a.preservesPitch,false);
  e.setEnabled(true);e.update({speed:0,maximum:200,active:true});await new Promise(setImmediate);assert.equal(a.playbackRate,1);assert.equal(a.volume,.3);assert(!a.paused);
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
