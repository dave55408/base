const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){
  const players=[];
  class Audio{
    constructor(source){this.source=source;this.plays=0;this.paused=true;players.push(this);}
    load(){}play(){this.plays++;this.paused=false;return Promise.resolve();}pause(){this.paused=true;}
  }
  const c={window:{Audio},console};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../weapon-audio.js'),'utf8'),c);
  return {alert:new c.window.BattleAlertAudio(),players};
}
test('red alert uses the supplied MP3 quietly at normal pitch and reuses one looping player',async()=>{
  const {alert,players:[audio]}=setup();assert.equal(audio.source,'assets/tos_red_alert.mp3');assert(audio.loop);
  alert.setEnabled(true);alert.update({active:true});await new Promise(setImmediate);
  assert.equal(audio.volume,.06);assert.equal(audio.playbackRate,1);assert.equal(audio.paused,false);
  for(let i=0;i<100;i++)alert.update({active:true});assert.equal(audio.plays,1);
  assert(fs.readFileSync(path.join(__dirname,'../assets/tos_red_alert.mp3')).length>1000);
});
test('quiet alert stops on inactivity or mute and can resume without duplicating playback',async()=>{
  const {alert,players:[audio]}=setup();alert.setEnabled(true);alert.update({active:true});await new Promise(setImmediate);
  alert.update({active:false});assert(audio.paused);assert.equal(audio.volume,0);
  alert.update({active:true});await new Promise(setImmediate);assert.equal(audio.volume,.06);assert(!audio.paused);
  alert.setEnabled(false);assert.equal(audio.volume,0);assert(audio.paused);
  alert.update({active:true});assert(audio.paused);assert.equal(audio.volume,0);
});
