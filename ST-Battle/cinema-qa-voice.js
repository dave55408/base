/* Local computer-style speech for live Cinema motion QA. */
window.BattleCinemaQAVoice=class{
  constructor({onSpeakingChange=()=>{},getAudioContext=()=>null}={}){this.onSpeakingChange=onSpeakingChange;this.getAudioContext=getAudioContext;this.talking=false;this.chirps=new Set();}
  setTalking(active){if(this.talking===active)return;this.talking=active;this.onSpeakingChange(active);}
  stop(){const current=this.current;this.current=null;this.setTalking(false);if(current)window.speechSynthesis?.cancel();for(const tone of this.chirps){try{tone.stop();}catch{}}this.chirps.clear();}
  chirp(){
    const context=this.getAudioContext();if(!context?.createOscillator||!context.createGain||context.state!=='running')return;
    for(const [delay,hz] of [[0,740],[.075,1110]]){
      const oscillator=context.createOscillator(),gain=context.createGain(),at=context.currentTime+delay;
      oscillator.type='square';oscillator.frequency.setValueAtTime(hz,at);
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.045,at+.006);gain.gain.exponentialRampToValueAtTime(.001,at+.055);
      oscillator.connect(gain);gain.connect(context.destination);this.chirps.add(oscillator);
      oscillator.onended=()=>{this.chirps.delete(oscillator);oscillator.disconnect();gain.disconnect();};oscillator.start(at);oscillator.stop(at+.06);
    }
  }
  reset(){this.stop();this.lastKey=null;}
  update({visible,enabled,playing,sim}){
    if(!visible||!enabled){this.reset();return;}
    const t=sim.turn;
    if(!playing||sim.result||sim.freeFlight||!sim.turnBased||!['approach','attack','withdraw'].includes(t?.phase)){this.stop();return;}
    const speech=window.speechSynthesis,Utterance=window.SpeechSynthesisUtterance;
    if(!speech||!Utterance)return;
    const n=t.navigation,action=n?.breakaway?'breakaway':n?.flyPast?'flypast':n?.flyPastComplete?'come-about':'maneuver';
    const key=[t.number,t.stageIndex,t.maneuver,action,n?.flankSide||''].join(':');
    if(key===this.lastKey)return;
    this.lastKey=key;this.stop();
    const name=Battle.maneuvers[t.maneuver]?.name||t.maneuver;
    const text=action==='breakaway'?'Breaking the circling pattern.':action==='flypast'?'Flying past. Holding attack trajectory.':action==='come-about'?'Coming about. Re-engaging.':`Maneuver ${t.stageIndex+1}. ${name}.`+(t.maneuver==='flank'&&n?.flankSide?` Approaching Yorktown's ${n.flankSide} side.`:'');
    const line=new Utterance(text),voices=speech.getVoices?.()||[];
    line.voice=voices.find(voice=>/\b(Sam|eSpeak|robot)\b/i.test(voice.name)&&/^en/i.test(voice.lang))||voices.find(voice=>/Microsoft.*(David|Mark|George)/i.test(voice.name))||voices.find(voice=>voice.localService&&/^en/i.test(voice.lang))||null;
    line.lang='en-US';line.rate=.84;line.pitch=.45;line.volume=1;
    line.onend=line.onerror=()=>{if(this.current===line){this.current=null;this.setTalking(false);}};
    this.current=line;this.setTalking(true);try{this.chirp();speech.speak(line);}catch{this.stop();}
  }
};
