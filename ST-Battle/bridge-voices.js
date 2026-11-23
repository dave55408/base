/* Local, generated bridge recordings; browser speech remains the fallback. */
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
    const parts=[['captain',line.order],[line.speaker==='allison'?'allison':'helm',line.reply]].filter(([,text])=>text);
    if(!parts.length||!parts.some(([role,text])=>clipFor(role,text)))return false;
    this.stop();const generation=this.generation;
    const next=index=>{
      if(generation!==this.generation)return;
      if(index>=parts.length){onComplete();return;}
      const [role,text]=parts[index];let audio,settled=false,recovering=false;
      const advance=()=>{
        if(settled||generation!==this.generation)return;settled=true;this.current=null;
        if(role==='captain'&&parts[index+1]&&parts[index+1][0]!=='captain')this.replyTimer=setTimeout(()=>{this.replyTimer=null;next(index+1);},500);
        else next(index+1);
      };
      const failed=()=>{
        if(settled||recovering||generation!==this.generation)return;
        recovering=true;
        if(audio){audio.onended=audio.onerror=null;audio.pause();}
        this.current=null;
        // Synthesize only this phrase, then continue with the next recording.
        if(fallback)fallback({order:role==='captain'?text:'',reply:role!=='captain'?text:'',speaker:role,phraseClaimed:true},advance);
        else advance();
      };
      if(!this.allowPhrase(text,role)){advance();return;}
      if(!clipFor(role,text)){failed();return;}
      try{
        audio=new window.Audio(clipFor(role,text));this.current=audio;
        audio.volume=role==='allison'||/_Allison\.mp3(?:[?#]|$)/i.test(clipFor(role,text))?1:.85;audio.onended=advance;
        audio.onerror=failed;window.BattleReplayCapture?.trackMedia(audio);Promise.resolve(audio.play()).catch(failed);
      }catch{failed();}
    };
    next(0);return true;
  }
};
