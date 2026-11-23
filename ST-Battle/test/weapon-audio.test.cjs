const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function harness(fetchOverride){
  const sources=[],parameters=[],urls=[];
  const context={currentTime:10,destination:{},async decodeAudioData(bytes){return {bytes};},createBufferSource(){
    const source={stops:[],connect(){},disconnect(){this.disconnected=true;},start(time){this.started=time;},stop(time){assert(this.started!==undefined,'start must precede stop');this.stops.push(time);}};sources.push(source);return source;
  },createGain(){const gain={value:0,calls:[],setValueAtTime(...args){this.calls.push(['set',...args]);},linearRampToValueAtTime(...args){this.calls.push(['ramp',...args]);},cancelAndHoldAtTime(...args){this.calls.push(['hold',...args]);}};parameters.push(gain);return {gain,connect(){},disconnect(){}};}};
  const c={window:{},console,fetch:fetchOverride||(async url=>{urls.push(url);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};})};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../weapon-audio.js'),'utf8'),c);
  return {audio:new c.window.BattleWeaponAudio(context),context,sources,parameters,urls};
}
test('phaser recording loops for the beam then fades; torpedo plays once',async()=>{
  const h=harness();await h.audio.ready;
  assert.deepEqual(h.urls,['assets/phaser2.mp3','assets/torpedo.mp3','assets/explosion.mp3','assets/bump.mp3','assets/bang_together.mp3','assets/end.mp3']);
  h.audio.playPhaser();assert.equal(h.sources.length,0);h.audio.setEnabled(true);h.audio.playPhaser();
  assert.equal(h.sources[0].loop,true);assert.equal(h.sources[0].buffer,h.audio.buffers.phaser);
  assert(h.parameters[0].calls.some(call=>call[0]==='set'&&call[2]===11.4));
  assert(h.parameters[0].calls.some(call=>call[0]==='ramp'&&call[1]===0&&Math.abs(call[2]-11.58)<1e-8));
  h.audio.playTorpedo();assert.equal(h.sources[1].loop,false);assert.equal(h.sources[1].buffer,h.audio.buffers.torpedo);assert.equal(h.sources[1].stops.length,0);
  h.audio.setEnabled(false);assert.equal(h.sources[0].stops.length,2);assert.equal(h.sources[1].stops.length,1);
  h.audio.stopAll();assert.equal(h.sources[0].stops.length,2);assert.equal(h.sources[1].stops.length,1);
  for(const source of h.sources)source.onended();assert.equal(h.audio.voices.size,0);
});
test('pausing or resetting suppresses a pending late recording',async()=>{
  let release;const pending=new Promise(resolve=>release=resolve),h=harness(async()=>{await pending;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};});
  h.audio.setEnabled(true);h.audio.playPhaser();h.audio.stopAll();release();await h.audio.ready;await Promise.resolve();assert.equal(h.sources.length,0);
});
test('local server serves all weapon MP3 assets with audio MIME type',async()=>{
  const server=require('../server.cjs');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{for(const name of ['phaser2','torpedo','explosion','bump','bang_together','end']){const response=await fetch('http://127.0.0.1:'+server.address().port+'/assets/'+name+'.mp3');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'audio/mpeg');assert((await response.arrayBuffer()).byteLength>0);}}
  finally{await new Promise(resolve=>server.close(resolve));}
});

function fileHarness(){
  const players=[],context={currentTime:0};
  class Audio{constructor(url){this.url=url;this.paused=true;players.push(this);}load(){}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
  const c={window:{location:{protocol:'file:'},Audio},console,requestAnimationFrame:()=>1,fetch(){throw new Error('File playback must not fetch');}};
  vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../weapon-audio.js'),'utf8'),c);
  return {audio:new c.window.BattleWeaponAudio(context),context,players};
}
test('file pages play local phasers with a fade and torpedoes once without fetch',async()=>{
  const h=fileHarness();assert.equal(h.players.length,33);h.audio.setEnabled(true);await Promise.resolve();
  h.audio.playPhaser();const phaser=[...h.audio.voices][0].audio;assert.equal(phaser.url,'assets/phaser2.mp3');assert.equal(phaser.loop,true);assert.equal(phaser.paused,false);
  h.context.currentTime=.1;h.audio.update();assert(phaser.volume>.5);
  h.context.currentTime=1.49;h.audio.update();assert(phaser.volume>0&&phaser.volume<.5);
  h.context.currentTime=1.61;h.audio.update();assert.equal(phaser.paused,true);assert.equal(h.audio.voices.size,0);
  h.audio.playTorpedo();const torpedo=[...h.audio.voices][0].audio;assert.equal(torpedo.url,'assets/torpedo.mp3');assert.equal(torpedo.loop,false);
  h.context.currentTime=1.8;h.audio.update();assert(Math.abs(torpedo.volume-.255)<1e-8);torpedo.onended();assert.equal(h.audio.voices.size,0);
});
test('local media priming does not interrupt a fired beam, and mute fades it',async()=>{
  const h=fileHarness();h.audio.setEnabled(true);h.audio.playPhaser();await Promise.resolve();
  const phaser=[...h.audio.voices][0].audio;assert.equal(phaser.paused,false);
  h.context.currentTime=.1;h.audio.update();h.audio.setEnabled(false);
  h.context.currentTime=.16;h.audio.update();assert(phaser.volume>0&&phaser.volume<.5);
  h.context.currentTime=.24;h.audio.update();assert.equal(phaser.paused,true);assert.equal(h.audio.voices.size,0);
});

test('ship-hit explosion plays once through both audio backends and respects mute',async()=>{
  const web=harness();await web.audio.ready;web.audio.playExplosion();assert.equal(web.sources.length,0);
  web.audio.setEnabled(true);web.audio.playExplosion();assert.equal(web.sources[0].buffer,web.audio.buffers.explosion);assert.equal(web.sources[0].loop,false);assert.equal(web.sources[0].stops.length,0);
  const file=fileHarness();file.audio.setEnabled(true);await Promise.resolve();file.audio.playExplosion();
  const explosion=[...file.audio.voices][0].audio;assert.equal(explosion.url,'assets/explosion.mp3');assert.equal(explosion.loop,false);file.context.currentTime=.1;file.audio.update();assert.equal(explosion.volume,.8);
  file.audio.setEnabled(false);file.context.currentTime=.24;file.audio.update();assert.equal(explosion.paused,true);
});

test('destruction plays end.mp3 once through both audio backends and respects mute',async()=>{
  for(const mode of ['web','file']){
    const h=mode==='web'?harness():fileHarness();await h.audio.ready;
    h.audio.playEnd();assert.equal(mode==='web'?h.sources.length:h.audio.voices.size,0);
    h.audio.setEnabled(true);await Promise.resolve();h.audio.playEnd();
    const playback=mode==='web'?h.sources.at(-1):[...h.audio.voices][0].audio;
    assert.equal(playback.loop,false);
    if(mode==='web'){assert.equal(playback.buffer,h.audio.buffers.end);assert.equal(playback.stops.length,0);}
    else assert.equal(playback.url,'assets/end.mp3');
    h.audio.setEnabled(false);h.context.currentTime+=.3;if(mode==='file')h.audio.update();
    assert(mode==='web'?playback.stops.length>0:playback.paused);
  }
});

test('weapon hits alternate explosion and bump while collisions play a separate debounced bang_together clip',async()=>{
  for(const mode of ['web','file']){
    const h=mode==='web'?harness():fileHarness();await h.audio.ready;
    h.audio.playHit();h.audio.playBreak();assert.equal(h.audio.hitCount,0,'muted events do not change the audible alternation');
    h.audio.setEnabled(true);await Promise.resolve();
    const cues=[];
    const play=kind=>{if(kind==='hit')h.audio.playHit();else h.audio.playBreak();if(mode==='web')return h.sources.at(-1).buffer;return [...h.audio.voices].at(-1).audio.url;};
    for(let i=0;i<4;i++)cues.push(play('hit'));
    assert.deepEqual(cues,mode==='web'?[h.audio.buffers.explosion,h.audio.buffers.bump,h.audio.buffers.explosion,h.audio.buffers.bump]:['assets/explosion.mp3','assets/bump.mp3','assets/explosion.mp3','assets/bump.mp3']);
    const cue=play('collision');assert.equal(cue,mode==='web'?h.audio.buffers.break:'assets/bang_together.mp3');
    const count=mode==='web'?h.sources.length:h.audio.voices.size;h.audio.playBreak();assert.equal(mode==='web'?h.sources.length:h.audio.voices.size,count,'continuous contact does not stack collision sounds');
    h.context.currentTime+=.8;h.audio.playBreak();assert.equal(mode==='web'?h.sources.length:h.audio.voices.size,count+1);
    assert.equal(h.audio.hitCount,4,'collisions do not consume alternating hit cues');
    h.audio.setEnabled(false);h.audio.playHit();assert.equal(h.audio.hitCount,4);
  }
});
