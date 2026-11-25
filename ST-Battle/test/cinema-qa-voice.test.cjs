const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),B=require('../engine.js');
function fixture(options={}){
  const spoken=[],computer={name:'Microsoft David Desktop',lang:'en-US',localService:true};let cancelled=0;
  const c={Battle:B,window:{speechSynthesis:{speak:line=>spoken.push(line),cancel:()=>cancelled++,getVoices:()=>[computer]},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}}}};
  vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../cinema-qa-voice.js'),'utf8'),c);
  const mixing=[],voice=new c.window.BattleCinemaQAVoice({onSpeakingChange:active=>mixing.push(active),...options}),sim={running:true,turnBased:true,turn:{number:1,stageIndex:0,maneuver:'flank',phase:'approach',navigation:{flankSide:'port'}}};
  const update=(options={})=>voice.update({visible:true,enabled:true,playing:true,sim,...options});
  return {voice,sim,spoken,computer,update,mixing,cancelled:()=>cancelled};
}
test('Cinema computer voice announces actual maneuvers once, including repeated slots and fly-pasts',()=>{
  const h=fixture();h.update();h.update();assert.equal(h.spoken.length,1);assert.match(h.spoken[0].text,/Flanking attack.*Yorktown's port side/);
  assert.equal(h.spoken[0].voice,h.computer);assert(h.spoken[0].pitch<1);
  assert.equal(h.spoken[0].volume,1,'the computer uses full speech volume');
  h.sim.turn.stageIndex=1;h.update();assert.equal(h.spoken.length,2,'repeating a maneuver in the next slot still announces it');
  h.sim.turn.maneuver='above';h.update();assert.match(h.spoken.at(-1).text,/Attack from above/);
  h.sim.turn.navigation.flyPast={};h.update();assert.match(h.spoken.at(-1).text,/Flying past/);
  h.update();assert.equal(h.spoken.length,4);assert.equal(h.cancelled(),3,'new changes replace stale speech instead of building a backlog');
});

test('retro computer delivery uses a low measured cadence and a short square-wave terminal chirp',()=>{
  const tones=[],context={state:'running',currentTime:10,destination:{},createOscillator(){const tone={frequency:{setValueAtTime(value){tone.hz=value;}},connect(){},disconnect(){},start(at){this.at=at;},stop(at){this.until=at;}};tones.push(tone);return tone;},createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}};
  const h=fixture({getAudioContext:()=>context});h.update();
  assert(h.spoken[0].rate<1&&h.spoken[0].pitch<.6);assert.equal(tones.length,2);
  assert(tones.every(tone=>tone.type==='square'&&tone.until-tone.at<.1));assert(tones[1].hz>tones[0].hz);
  h.voice.stop();assert(tones.every(tone=>tone.until===undefined),'leaving or muting cancels the cue tones');
});

test('computer speech restores crew gain on completion, error and cancellation without stale callbacks',()=>{
  const h=fixture();h.update();assert.equal(h.mixing.at(-1),true);const old=h.spoken[0];
  h.sim.turn.stageIndex=1;h.update();old.onend();assert.equal(h.mixing.at(-1),true,'old completions cannot unduck a new announcement');
  h.spoken.at(-1).onerror();assert.equal(h.mixing.at(-1),false);
  h.sim.turn.number++;h.update();assert.equal(h.mixing.at(-1),true);h.spoken.at(-1).onend();assert.equal(h.mixing.at(-1),false);
  h.sim.turn.number++;h.update();h.voice.stop();assert.equal(h.mixing.at(-1),false);
});
test('QA announcements stop outside Cinema, on pause, on mute, in Free Flight and after combat',()=>{
  const h=fixture();h.update();h.update({playing:false});assert.equal(h.cancelled(),1);h.update();assert.equal(h.spoken.length,1,'resume does not repeat the same maneuver');
  h.update({visible:false});h.update({visible:false});assert.equal(h.spoken.length,1);
  h.update();assert.equal(h.spoken.length,2,'returning to Cinema announces its current maneuver');
  h.update({enabled:false});assert.equal(h.cancelled(),2);h.update({enabled:false});assert.equal(h.spoken.length,2);
  h.sim.freeFlight=true;h.update();assert.equal(h.spoken.length,2);
  h.sim.freeFlight=false;h.sim.result='victory';h.update();assert.equal(h.spoken.length,2);
});
