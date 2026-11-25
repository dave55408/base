/* Recorded bridge dialogue only; unavailable phrases remain text-only. */
window.BattleBridgeVoices=class{
  constructor({allowPhrase=()=>true}={}){this.allowPhrase=allowPhrase;this.generation=0;this.current=null;this.replyTimer=null;}
  stop(){
    this.generation++;
    if(this.replyTimer!==null){clearTimeout(this.replyTimer);this.replyTimer=null;}
    const audio=this.current;this.current=null;
    if(audio){audio.onended=audio.onerror=null;audio.pause();try{audio.currentTime=0;}catch{}}
  }
  play(line,fallback,onComplete=()=>{}){
    const clips=window.BattleVoiceClips||{};
    const clipFor=(role,text)=>line.clip&&(!line.order||!line.reply||role==='captain')?line.clip:clips[role+'\n'+text];
    const replyRole=line.speaker==='allison'?'allison':'helm';
    const parts=[['captain',line.order],...(line.replies||[line.reply]).map(text=>[replyRole,text])].filter(([,text])=>text);
    if(!parts.length||!parts.some(([role,text])=>clipFor(role,text)))return false;
    this.stop();const generation=this.generation;
    const next=index=>{
      if(generation!==this.generation)return;
      if(line.valid&&!line.valid()){onComplete();return;}
      if(index>=parts.length){onComplete();return;}
      const [role,text]=parts[index];let audio,settled=false,recovering=false;
      const advance=()=>{
        if(settled||generation!==this.generation)return;settled=true;this.current=null;
        if(parts[index+1]&&(role==='captain'||line.replies))this.replyTimer=setTimeout(()=>{this.replyTimer=null;next(index+1);},role==='captain'?500:200);
        else next(index+1);
      };
      const failed=()=>{
        if(settled||recovering||generation!==this.generation)return;
        recovering=true;
        if(audio){audio.onended=audio.onerror=null;audio.pause();}
        this.current=null;
        advance();
      };
      if(!this.allowPhrase(text,role)){advance();return;}
      if(!clipFor(role,text)){failed();return;}
      try{
        audio=new window.Audio(clipFor(role,text));this.current=audio;
        audio.volume=.85*(window.BattleCrewVoiceGain??1);audio.onended=advance;
        audio.onerror=failed;window.BattleReplayCapture?.trackMedia(audio);Promise.resolve(audio.play()).catch(failed);
      }catch{failed();}
    };
    next(0);return true;
  }
};
