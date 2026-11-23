const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture({blocked=false,random=()=>0}={}){
  const players=[],introMusic=[];
  class Audio{
    constructor(url){this.url=url;this.plays=0;this.paused=true;(url==='assets/IntroMusic.mp3'?introMusic:players).push(this);}
    play(){this.plays++;if(blocked){blocked=false;return Promise.reject(Object.assign(new Error('Autoplay blocked'),{name:'NotAllowedError'}));}this.paused=false;return Promise.resolve();}
    pause(){this.paused=true;}
  }
  const c={window:{Audio,BattleVoiceClips:{}}};vm.createContext(c);
  for(const file of ['captain-narration.js','assets/voices/voice-overrides.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
  return {narration:new c.window.BattleCaptainNarration({random}),players,introMusic,window:c.window};
}
test('welcome narration plays once, stops when dismissed, respects mute, and resets for a new welcome',async()=>{
  const {narration:n,players}=fixture();
  n.updateWelcome({visible:true,enabled:false});assert.equal(players.length,0);
  n.updateWelcome({visible:true,enabled:true});await new Promise(setImmediate);
  assert.equal(players[0].url,'assets/Welcome introduction_short_Declan.mp3');assert.equal(players[0].volume,.85);
  n.updateWelcome({visible:true,enabled:true,retry:true});assert.equal(players.length,1);
  n.updateWelcome({visible:false,enabled:true});assert(players[0].paused);
  n.updateWelcome({visible:true,enabled:true,retry:true});assert.equal(players.length,1);
  n.reset();n.updateWelcome({visible:true,enabled:true});assert.equal(players.length,2);
  n.updateWelcome({visible:true,enabled:false});assert(players[1].paused);
});
test('blocked welcome autoplay waits for a user interaction instead of retrying every frame',async()=>{
  const {narration:n,players}=fixture({blocked:true});
  n.updateWelcome({visible:true,enabled:true});await new Promise(setImmediate);assert(players[0].paused);
  for(let i=0;i<60;i++)n.updateWelcome({visible:true,enabled:true});assert.equal(players.length,1);
  n.updateWelcome({visible:true,enabled:true,retry:true});await new Promise(setImmediate);
  assert.equal(players.length,2);assert.equal(players[1].paused,false);
});

test('IntroMusic starts with the narration at sixty percent and stays aligned with its playback',async()=>{
  const {narration:n,players,introMusic}=fixture();
  n.updateWelcome({visible:true,enabled:true});
  assert.equal(players[0].plays,1);assert.equal(introMusic[0].plays,1,'both play calls occur in the same interaction');
  const voice=players[0],music=introMusic[0];
  assert.equal(music.url,'assets/IntroMusic.mp3');assert.equal(music.volume,.6);assert.equal(music.loop,false);assert(fs.statSync(music.url).size>1000);
  await new Promise(setImmediate);voice.duration=10;voice.currentTime=3;music.currentTime=1;
  n.updateWelcome({visible:true,enabled:true});assert.equal(music.currentTime,3);assert.equal(music.volume,.6);
  voice.currentTime=9.375;voice.ontimeupdate();assert.equal(music.volume,.3,'intro music blends into the existing ColdOpenHit transition');
  voice.onended();assert.equal(music.paused,true);
});

test('IntroMusic stops on blocked narration, global mute, dismissal and explicit replay',async()=>{
  const blocked=fixture({blocked:true});blocked.narration.updateWelcome({visible:true,enabled:true});await new Promise(setImmediate);
  assert.equal(blocked.introMusic[0].paused,true,'music cannot be left playing after narration fails');
  const {narration:n,introMusic}=fixture();n.updateWelcome({visible:true,enabled:true});await new Promise(setImmediate);
  n.updateWelcome({visible:true,enabled:false,musicEnabled:true});assert.equal(introMusic[0].paused,false,'voice mute keeps background music');
  n.updateWelcome({visible:true,enabled:false,musicEnabled:false});assert.equal(introMusic[0].paused,true);
  n.reset();n.updateWelcome({visible:true,enabled:true});await new Promise(setImmediate);
  n.updateWelcome({visible:false,enabled:true});assert.equal(introMusic[1].paused,true);
  n.reset();n.updateWelcome({visible:true,enabled:true});await new Promise(setImmediate);n.reset();assert.equal(introMusic[2].paused,true);
});

test('ColdOpenHit has an end-of-intro fallback and stops when the screen closes',async()=>{
  const {narration:n,players}=fixture();
  n.updateWelcome({visible:true,enabled:true});await new Promise(setImmediate);
  assert.equal(players.length,1,'music cannot start over the spoken welcome');
  players[0].onended();await new Promise(setImmediate);
  const music=players[1];assert.equal(music.url,'assets/ColdOpenHit.mp3');assert.equal(music.volume,0);music.currentTime=2;music.ontimeupdate();assert.equal(music.volume,.70);assert.equal(music.loop,false);
  assert(fs.statSync(music.url).size>1000);
  for(let i=0;i<60;i++)n.updateWelcome({visible:true,enabled:true});assert.equal(players.length,2);
  n.updateWelcome({visible:true,enabled:false,musicEnabled:true});assert.equal(music.paused,false,'voice mute leaves the music playing');
  n.updateWelcome({visible:false,enabled:true});assert.equal(music.paused,true);
});

test('ColdOpenHit overlaps the last one and a quarter seconds and fades in without restarting at narration end',async()=>{
  const {narration:n,players}=fixture();
  n.updateWelcome({visible:true,enabled:true});await new Promise(setImmediate);
  const intro=players[0];intro.duration=10;intro.currentTime=8.7;intro.ontimeupdate();assert.equal(players.length,1);
  intro.currentTime=8.75;intro.ontimeupdate();await new Promise(setImmediate);
  const music=players[1];assert.equal(music.url,'assets/ColdOpenHit.mp3');assert.equal(music.volume,0);
  music.currentTime=1;n.updateWelcome({visible:true,enabled:true});assert.equal(music.volume,.35);
  music.currentTime=2;music.ontimeupdate();assert.equal(music.volume,.70);
  intro.onended();assert.equal(players.length,2,'the end event must not restart the overlapping music');
  music.onended();n.updateWelcome({visible:true,enabled:true});assert.equal(players.length,2,'the track only plays once');
});

test('skipping the welcome never starts ColdOpen and global mute or replay resets stop the music',async()=>{
  const {narration:n,players}=fixture();
  n.updateWelcome({visible:true,enabled:true});await new Promise(setImmediate);
  const stale=players[0].onended;n.updateWelcome({visible:false,enabled:true});stale();assert.equal(players.length,1);
  n.reset();n.updateWelcome({visible:true,enabled:true});players[1].onended();await new Promise(setImmediate);
  n.updateWelcome({visible:true,enabled:false,musicEnabled:false});assert.equal(players[2].paused,true);
  n.reset();n.updateWelcome({visible:true,enabled:true});players[3].onended();await new Promise(setImmediate);
  n.reset();assert.equal(players[4].paused,true);
});
test('the short opening and both farewell alternatives resolve to their existing Declan assets',()=>{
  for(const random of [()=>0,()=>.999]){
    const {narration:n,window:w}=fixture({random});
    for(const cue of [n.chooseOpening(),n.chooseFarewell(),w.BattleCaptainNarration.cues.welcome]){
      assert.equal(w.BattleVoiceClips['captain\n'+cue.text],cue.clip);assert(fs.statSync(cue.clip).size>1000);
    }
  }
  const opening=fixture().narration.chooseOpening();
  assert.equal(opening.text,"Yorktown's closing. Shields up. Helm, take us in...");
  assert.equal(opening.clip,fixture({random:()=>.999}).narration.chooseOpening().clip);
  assert.equal(fixture().window.BattleCaptainNarration.cues.openings.length,1,'only the short fight opening is available');
  assert.notEqual(fixture({random:()=>0}).narration.chooseFarewell().clip,fixture({random:()=>.999}).narration.chooseFarewell().clip);
  const html=fs.readFileSync('index.html','utf8');assert(html.indexOf('src="captain-narration.js"')<html.indexOf('src="app.js"'));
});
