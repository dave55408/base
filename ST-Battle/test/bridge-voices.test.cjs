const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const catalog=require('../bridge-dialogue.js'),{generate}=require('../generate-voices.cjs');
async function player(clips={}){
  const players=[],timers=new Map();let now=0,id=0;
  class Audio{constructor(url){this.url=url;this.paused=true;players.push(this);}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
  const c={window:{Audio,BattleVoiceClips:clips},setTimeout:(fn,delay)=>{timers.set(++id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id)};vm.createContext(c);
  vm.runInContext(await fs.readFile(path.join(__dirname,'../bridge-voices.js'),'utf8'),c);
  return {voice:new c.window.BattleBridgeVoices(),players,tick:ms=>{now+=ms;for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}}};
}
const clips={'captain\nCome to port.':'cedar.mp3','helm\nComing to port.':'marin.mp3'};
const line={order:'Come to port.',reply:'Coming to port.'};
test('Allison clips play louder while Erica and captain recordings keep their existing volume',async()=>{
  const h=await player({'captain\nCome to port.':'assets/Come to port_Declan.mp3','helm\nComing to port.':'assets/Coming to port_Allison.mp3','helm\nHull hit!':'assets/Hull hit!_Erica.mp3'});
  h.voice.play(line);assert.equal(h.players[0].volume,.85);
  h.players[0].onended();h.tick(500);assert.equal(h.players[1].volume,1);
  h.voice.play({reply:'Hull hit!'});assert.equal(h.players[2].volume,.85);
});
test('recorded dialogue plays captain then helm without overlapping',async()=>{
  const h=await player(clips);assert(h.voice.play(line));assert.equal(h.players.length,1);assert.equal(h.players[0].url,'cedar.mp3');
  h.players[0].onended();h.tick(499);assert.equal(h.players.length,1);h.tick(1);assert.equal(h.players.length,2);assert.equal(h.players[1].url,'marin.mp3');
  h.players[1].onended();assert.equal(h.voice.current,null);
});
test('muting or interruption stops audio and cancels the old reply',async()=>{
  const h=await player(clips);h.voice.play(line);const stale=h.players[0].onended;h.voice.stop();stale();
  assert(h.players[0].paused);assert.equal(h.players.length,1);assert.equal(h.voice.current,null);
  h.voice.play(line);h.players[1].onended();h.tick(250);h.voice.stop();h.tick(250);
  assert.equal(h.players.length,2,'muting during the reply pause cancels the scheduled helm clip');
});
test('unrecorded dialogue uses browser speech and failed recordings fall back only for remaining dialogue',async()=>{
  const h=await player(clips);assert.equal(h.voice.play({order:'Unknown order',reply:''}),false);assert.equal(h.players.length,0);
  let fallback;h.voice.play(line,value=>fallback=value);h.players[0].onended();h.tick(500);h.players[1].onerror();
  assert.equal(fallback.order,'');assert.equal(fallback.reply,'Coming to port.');assert(h.players[1].paused);
});
test('a synthesized captain finishes before a recorded helm reply, and interruption cancels continuation',async()=>{
  const h=await player({'helm\nComing to port.':'allison.mp3'});
  let finish,spoken;
  assert(h.voice.play(line,(value,done)=>{spoken=value;finish=done;}));
  assert.equal(spoken.order,'Come to port.');assert.equal(spoken.reply,'');assert.equal(h.players.length,0);
  finish();h.tick(500);assert.equal(h.players.length,1);assert.equal(h.players[0].url,'allison.mp3');
  h.voice.play(line,(value,done)=>{finish=done;});h.voice.stop();finish();h.tick(500);
  assert.equal(h.players.length,1,'a cancelled synthesis cannot start a recording');
});
test('a novel helm reply is synthesized after the recorded captain without repeating the order',async()=>{
  const h=await player(clips);let spoken;
  h.voice.play({order:line.order,reply:'New warning.'},value=>spoken=value);
  assert.equal(spoken,undefined);h.players[0].onended();h.tick(500);
  assert.equal(spoken.order,'');assert.equal(spoken.reply,'New warning.');
});
test('local helm selections use the six Allison exceptions and Erica for the other 23 phrases',async()=>{
  const context={window:{BattleVoiceClips:{'captain\nAttack run.':'declan.mp3'}}};
  vm.runInNewContext(await fs.readFile(path.join(__dirname,'../assets/voices/voice-overrides.js'),'utf8'),context);
  const selections=context.window.BattleVoiceClips;
  const exceptions=new Set(['Coming to port.','Coming to starboard.','Climbing.','Descending.','Moving astern.','Making for cover.']);
  let count=0;
  for(const {role,text} of catalog.lines())if(role==='helm'){
    const file=selections[role+'\n'+text];
    assert.equal(file,'assets/'+text.replace(/\.$/,'')+'_'+(exceptions.has(text)?'Allison':'Erica')+'.mp3');
    assert((await fs.stat(path.join(__dirname,'..',file))).size>0);count++;
  }
  assert.equal(count,29);
  let captainCount=0;
  for(const {role,text} of catalog.lines())if(role==='captain'){
    const file=selections[role+'\n'+text];
    assert.equal(file,'assets/'+text.replace(/\.$/,'')+'_Declan.mp3');
    assert((await fs.stat(path.join(__dirname,'..',file))).size>0);captainCount++;
  }
  assert.equal(captainCount,14);assert.equal(Object.keys(selections).length,67);
});
test('voice generation maps Cedar to captain and Marin to helm, saves offline clips and skips completed files',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'st-battle-voices-'));
  assert(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const requests=[];
  const fetchImpl=async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/audio/speech');requests.push(JSON.parse(options.body));return {ok:true,arrayBuffer:async()=>Uint8Array.from([73,68,51,1]).buffer};};
  const result=await generate({apiKey:'test-only',fetchImpl,root:directory});assert.equal(result.generated,catalog.lines().length);
  for(const request of requests){const entry=catalog.lines().find(entry=>entry.text===request.input&&catalog.voices[entry.role]===request.voice);assert(entry);assert.equal(request.model,'gpt-4o-mini-tts');assert.equal(request.response_format,'mp3');}
  assert(requests.some(request=>request.voice==='cedar'));assert(requests.some(request=>request.voice==='marin'));
  const context={window:{}};vm.runInNewContext(await fs.readFile(path.join(directory,'assets/voices/voice-clips.js'),'utf8'),context);
  assert.equal(Object.keys(context.window.BattleVoiceClips).length,catalog.lines().length);
  assert(!JSON.stringify(context).includes('test-only'));
  const second=await generate({apiKey:'test-only',fetchImpl,root:directory});assert.equal(second.generated,0);assert.equal(requests.length,result.count);
});
test('preview needs no API key and generation refuses missing credentials before calling the API',async()=>{
  const preview=await generate({apiKey:'',dryRun:true});assert(preview.count>0);assert.equal(preview.voices.captain,'cedar');assert.equal(preview.voices.helm,'marin');
  await assert.rejects(generate({apiKey:'',fetchImpl:()=>assert.fail('must not call the API')}),/OPENAI_API_KEY/);
});
