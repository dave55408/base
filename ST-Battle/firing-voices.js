/* Queued captain commands launch a valid shot as the recording starts. */
window.BattleFiringVoices=class{
  constructor(){this.pending=null;this.active=null;this.counts={phaser:0,torpedo:0};this.context=null;}
  stop(){
    const pending=this.pending;this.pending=null;
    for(const audio of new Set([pending?.audio,this.active].filter(Boolean))){audio.onended=audio.onerror=null;audio.pause();}
    this.active=null;
  }
  abandon(){this.pending=null;}
  prepare({type,order,context,urgent=false,torpedoes=1,beforeStart=()=>{},enqueue,waitForVoice=true,execute}={}){
    if(this.context!==context){this.stop();this.context=context;this.counts={phaser:0,torpedo:0};}
    let pending=waitForVoice?this.pending:null;
    if(pending&&(pending.type!==type||pending.order!==order||pending.context!==context)){
      if(!pending.ready)return false;
      this.pending=null;pending=null;
    }
    if(pending){
      if(!pending.ready)return false;
      this.counts[type]++;this.pending=null;return true;
    }
    const title=urgent?'Fire_urgent':type==='torpedo'&&torpedoes>1?'Fire torpedoes':
      this.counts[type]%2?'Fire':type==='phaser'?'Fire phasers':'Fire torpedo';
    const audio=new window.Audio('assets/'+title+'.mp3');
    pending={type,order,context,audio,ready:false};
    if(waitForVoice)this.pending=pending;else this.counts[type]++;
    audio.volume=.85;
    const start=done=>{
      if(waitForVoice&&this.pending!==pending){done();return;}
      if(execute){
        this.releasing=pending;let fired=false;
        try{fired=execute();}finally{this.releasing=null;}
        this.pending=null;
        if(!fired){done();return;}
        this.counts[type]++;
      }
      this.active=audio;
      let finished=false;
      const complete=()=>{if(finished)return;finished=true;pending.ready=true;if(this.active===audio)this.active=null;audio.onended=audio.onerror=null;done();};
      audio.onended=audio.onerror=complete;
      if(beforeStart(title)===false){complete();return;}
      window.BattleReplayCapture?.trackMedia(audio);
      try{Promise.resolve(audio.play()).catch(complete);}catch{complete();}
    };
    if(enqueue)enqueue(start,title,()=>!waitForVoice||this.pending===pending,()=>{if(this.pending===pending)this.pending=null;});
    else start(()=>{});
    return !waitForVoice;
  }
};
