const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){
  const players=[];
  class Audio{constructor(source){this.source=source;this.plays=0;this.currentTime=0;this.paused=true;players.push(this);}load(){}play(){this.plays++;this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
  const c={window:{Audio},console};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../weapon-audio.js'),'utf8'),c);
  return {intro:new c.window.BattleIntroAudio(),players};
}
test('intro plays the supplied MP3 once and only resets for a new engagement',async()=>{
  const {intro,players:[audio]}=setup();intro.setEnabled(true);assert.equal(audio.plays,0);
  intro.playOnce();await new Promise(setImmediate);assert.equal(audio.source,'assets/introwav.mp3');assert.equal(audio.loop,false);assert.equal(audio.plays,1);
  intro.playOnce();intro.update({active:true});assert.equal(audio.plays,1);
  audio.onended();intro.update({active:true});intro.playOnce();assert.equal(audio.plays,1);
  intro.reset();intro.playOnce();await new Promise(setImmediate);assert.equal(audio.plays,2);
  assert(fs.readFileSync(path.join(__dirname,'../assets/introwav.mp3')).length>1000);
});
test('intro pauses and resumes at the same position and respects mute',async()=>{
  const {intro,players:[audio]}=setup();intro.setEnabled(true);intro.playOnce();await new Promise(setImmediate);
  audio.currentTime=3.5;intro.update({active:false});assert(audio.paused);assert.equal(audio.volume,0);
  intro.update({active:true});await new Promise(setImmediate);assert.equal(audio.currentTime,3.5);assert(!audio.paused);
  intro.setEnabled(false);intro.update({active:true});assert(audio.paused);assert.equal(audio.volume,0);
});


test('fight score starts only after the opening cue ends and loops at fixed pitch',async()=>{
  const {intro,players:[opening,fight]}=setup();intro.setEnabled(true);intro.playOnce();await new Promise(setImmediate);
  assert.equal(fight.source,'assets/FightMusic.mp3');assert.equal(fight.plays,0,'score does not overlap the opening');
  opening.onended();await new Promise(setImmediate);
  assert.equal(fight.plays,1);assert.equal(fight.loop,true);assert.equal(fight.playbackRate,1);assert.equal(fight.volume,.2);assert.equal(opening.volume,0);
  intro.update({active:true});assert.equal(fight.plays,1,'frame updates do not restart the score');
  assert(fs.readFileSync(path.join(__dirname,'../assets/FightMusic.mp3')).length>1000);
});

test('fight score pauses, resumes and mutes with battle audio; rematch replays the cue first',async()=>{
  const {intro,players:[opening,fight]}=setup();intro.setEnabled(true);intro.playOnce();await new Promise(setImmediate);opening.onended();await new Promise(setImmediate);
  fight.currentTime=12;intro.update({active:false});assert(fight.paused);assert.equal(fight.volume,0);
  intro.update({active:true});await new Promise(setImmediate);assert(!fight.paused);assert.equal(fight.currentTime,12);
  intro.setEnabled(false);assert(fight.paused);assert.equal(fight.volume,0);
  intro.setEnabled(true);intro.update({active:true});await new Promise(setImmediate);assert(!fight.paused);assert.equal(fight.currentTime,12);
  intro.reset();assert(fight.paused);assert.equal(fight.currentTime,0);const plays=fight.plays;
  intro.playOnce();await new Promise(setImmediate);assert.equal(fight.plays,plays,'new engagement waits for its opening cue');assert(!opening.paused);
});

test('an opening ending during inactivity cannot start fight music in the background',async()=>{
  const {intro,players:[opening,fight]}=setup();intro.setEnabled(true);intro.playOnce();await new Promise(setImmediate);
  intro.update({active:false});opening.onended();await new Promise(setImmediate);assert.equal(fight.plays,0);
  intro.update({active:true});await new Promise(setImmediate);assert.equal(fight.plays,1);
});


test('fight score fades between turns without rewinding and reverses a partial fade smoothly',async()=>{
  const {intro,players:[opening,fight]}=setup();intro.setEnabled(true);intro.playOnce();await new Promise(setImmediate);opening.onended();await new Promise(setImmediate);
  fight.currentTime=24;
  intro.update({active:false,musicActive:false,fadeMusic:true,dt:.6});assert(Math.abs(fight.volume-.1)<1e-8);assert(!fight.paused,'fade continues playing while audible');
  const before=fight.volume;intro.update({active:true,musicActive:true,fadeMusic:true,dt:.3});assert(fight.volume>before&&fight.volume<.2,'next turn reverses the fade without a volume jump');
  intro.update({active:false,musicActive:false,fadeMusic:true,dt:1.2});assert.equal(fight.volume,0);assert(fight.paused);assert.equal(fight.currentTime,24);
  intro.update({active:true,musicActive:true,fadeMusic:true,dt:.6});await new Promise(setImmediate);assert(Math.abs(fight.volume-.1)<1e-8);assert(!fight.paused);assert.equal(fight.currentTime,24);
  intro.update({active:true,musicActive:true,fadeMusic:true,dt:.6});assert.equal(fight.volume,.2);
});

test('replay music can play without the opening cue and responds immediately to mute',async()=>{
  const {intro,players:[opening,fight]}=setup();intro.setEnabled(true);
  intro.update({active:false,musicActive:true,replay:true,fadeMusic:true,dt:.6});await new Promise(setImmediate);
  assert.equal(opening.plays,0);assert.equal(fight.plays,1);assert(Math.abs(fight.volume-.1)<1e-8);assert.equal(fight.playbackRate,1);
  intro.setEnabled(false);assert.equal(fight.volume,0);assert(fight.paused);
});


test('Enterprise destruction fades replay music to silence and keeps it silent through the wreckage',async()=>{
  const {intro,players:[opening,fight]}=setup();intro.setEnabled(true);
  intro.update({active:false,musicActive:true,replay:true});await new Promise(setImmediate);assert.equal(fight.volume,.2);
  intro.update({active:false,musicActive:false,replay:true,fadeOut:true,dt:.6});assert(Math.abs(fight.volume-.1)<1e-8);assert(!fight.paused);
  intro.update({active:false,musicActive:false,replay:true,fadeOut:true,dt:.6});assert.equal(fight.volume,0);assert(fight.paused);
  const count=fight.plays;intro.update({active:false,musicActive:true,replay:true,fadeOut:true,dt:2});assert.equal(fight.plays,count,'destroyed Enterprise cannot restart music');assert.equal(opening.plays,0);
});

test('Enterprise destruction also fades an opening cue still in progress',async()=>{
  const {intro,players:[opening,fight]}=setup();intro.setEnabled(true);intro.playOnce();await new Promise(setImmediate);
  intro.update({active:false,musicActive:false,fadeOut:true,dt:.6});assert(Math.abs(opening.volume-.25)<1e-8);assert(!opening.paused);
  intro.update({active:false,musicActive:false,fadeOut:true,dt:.6});assert.equal(opening.volume,0);assert(opening.paused);assert.equal(fight.plays,0);
});
