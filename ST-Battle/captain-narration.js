/* Declan's welcome narration and the recorded opening/closing alternatives. */
(()=>{
  const welcome={text:"Captain Declan, commanding Enterprise. Yorktown's captain has gone rogue and is hunting us near K7. We must disable her. All hands—battle stations!",clip:'assets/Welcome introduction_short_Declan.mp3'};
  const openings=[
    {text:"Yorktown's closing. Shields up. Helm, take us in...",clip:"assets/Yorktown's closing. Shields up. Helm, take us in_Declan.mp3"}
  ];
  const farewells=[
    {text:'I gave my best...',clip:'assets/I gave my best_Declan.mp3'},
    {text:'We gave it our all...',clip:'assets/We gave it our all_Declan.mp3'}
  ];
  window.BattleCaptainNarration=class{
    static cues={welcome,openings,farewells};
    constructor({random=Math.random,now=()=>Date.now()}={}){this.random=random;this.now=now;this.welcomeFade=null;this.welcomeAudio=null;this.introMusicAudio=null;this.musicAudio=null;this.musicStarted=false;this.attempted=false;this.played=false;}
    chooseOpening(){return openings[0];}
    chooseFarewell(){return farewells[Math.min(farewells.length-1,Math.floor(this.random()*farewells.length))];}
    updateWelcome({visible=false,enabled=false,musicEnabled=enabled,retry=false,continueWhenHidden=false}={}){
      this.welcomeVisible=visible;this.musicEnabled=musicEnabled;this.continueWhenHidden=continueWhenHidden;
      if(!musicEnabled||!visible&&!continueWhenHidden){this.stopWelcome();return;}
      if(this.welcomeFade){
        const gain=Math.max(0,1-(this.now()-this.welcomeFade.started)/600);
        for(const {audio,volume} of this.welcomeFade.tracks)audio.volume=volume*gain;
        if(gain===0)this.stopWelcome();
        return;
      }
      this.updateMusicFade();
      this.syncIntroMusic();
      if(!enabled){this.stopWelcome({music:false});return;}
      if(this.welcomeAudio)this.overlapColdOpen(this.welcomeAudio);
      if(!visible||this.welcomeAudio||this.played||this.attempted&&!retry||!window.Audio)return;
      this.attempted=true;
      let audio;
      const failed=()=>{if(this.welcomeAudio===audio){this.welcomeAudio=null;audio.onended=audio.onerror=audio.ontimeupdate=null;audio.pause();this.stopIntroMusic();}};
      try{
        audio=new window.Audio(welcome.clip);this.welcomeAudio=audio;audio.volume=.85;audio.preload='auto';
        audio.ontimeupdate=()=>{this.syncIntroMusic();this.overlapColdOpen(audio);};
        audio.onended=()=>{if(this.welcomeAudio===audio){this.played=true;this.welcomeAudio=null;this.stopIntroMusic();this.startColdOpen();}};
        audio.onerror=failed;window.BattleReplayCapture?.trackMedia(audio);
        this.startIntroMusic();
        const starting=audio.play();
        Promise.resolve(starting).then(()=>{if(this.welcomeAudio===audio)this.played=true;else audio.pause();}).catch(failed);
      }catch{if(audio)failed();}
    }
    startIntroMusic(){
      if(!this.musicEnabled||this.introMusicAudio)return;
      const music=new window.Audio('assets/IntroMusic.mp3');this.introMusicAudio=music;
      music.preload='auto';music.volume=.60;music.loop=false;
      const finish=()=>{if(this.introMusicAudio===music){this.introMusicAudio=null;music.onended=music.onerror=null;music.pause();}};
      music.onended=music.onerror=finish;window.BattleReplayCapture?.trackMedia(music);
      // Start music and narration in the same interaction, without a timing offset.
      try{Promise.resolve(music.play()).then(()=>{if(this.introMusicAudio!==music)music.pause();else this.syncIntroMusic();}).catch(finish);}catch{finish();}
    }
    syncIntroMusic(){
      if(this.welcomeFade)return;
      const voice=this.welcomeAudio,music=this.introMusicAudio;
      if(!voice||!music)return;
      if(!voice.paused&&!music.paused&&Number.isFinite(voice.currentTime)&&Number.isFinite(music.currentTime)&&Math.abs(voice.currentTime-music.currentTime)>.05){try{music.currentTime=voice.currentTime;}catch{}}
      const remaining=voice.duration-voice.currentTime;
      music.volume=.60*(Number.isFinite(remaining)?Math.min(1,Math.max(0,remaining)/1.25):1);
    }
    stopIntroMusic(){
      const music=this.introMusicAudio;this.introMusicAudio=null;
      if(music){music.onended=music.onerror=null;music.pause();try{music.currentTime=0;}catch{}}
    }
    overlapColdOpen(audio){
      if(this.welcomeAudio===audio&&!audio.paused&&Number.isFinite(audio.duration)&&audio.duration>0&&audio.currentTime>=Math.max(0,audio.duration-1.25))this.startColdOpen();
    }
    updateMusicFade(){
      if(this.welcomeFade)return;
      if(this.musicAudio)this.musicAudio.volume=.70*Math.min(1,Math.max(0,this.musicAudio.currentTime||0)/2);
    }
    startColdOpen(){
      if(this.welcomeFade||!this.welcomeVisible&&!this.continueWhenHidden||!this.musicEnabled||this.musicStarted||!window.Audio)return;
      this.musicStarted=true;
      const music=new window.Audio('assets/ColdOpenHit.mp3');this.musicAudio=music;
      music.volume=0;music.loop=false;music.ontimeupdate=()=>this.updateMusicFade();
      const finish=()=>{if(this.musicAudio===music){this.musicAudio=null;music.onended=music.onerror=music.ontimeupdate=null;music.pause();}};
      music.onended=music.onerror=finish;window.BattleReplayCapture?.trackMedia(music);
      try{Promise.resolve(music.play()).then(()=>{if(this.musicAudio!==music)music.pause();}).catch(finish);}catch{finish();}
    }
    fadeWelcome(){
      if(this.welcomeFade)return;
      
      const tracks=[this.welcomeAudio,this.introMusicAudio,this.musicAudio].filter(Boolean).map(audio=>({audio,volume:audio.volume}));
      if(tracks.length)this.welcomeFade={started:this.now(),tracks};
    }
    stopWelcome({music=true}={}){
      
      if(music)this.welcomeFade=null;
      const audio=this.welcomeAudio;this.welcomeAudio=null;
      if(audio){audio.onended=audio.onerror=audio.ontimeupdate=null;audio.pause();try{audio.currentTime=0;}catch{}}
      if(music)this.stopIntroMusic();
      if(music&&this.musicAudio){const current=this.musicAudio;this.musicAudio=null;current.onended=current.onerror=current.ontimeupdate=null;current.pause();try{current.currentTime=0;}catch{}}
    }
    reset(){this.stopWelcome();this.musicStarted=false;this.attempted=false;this.played=false;}
  };
})();
