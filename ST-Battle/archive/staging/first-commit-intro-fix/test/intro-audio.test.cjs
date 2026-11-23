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
