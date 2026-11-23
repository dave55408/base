/* Capture the replay canvas and its audio; convert WebM locally when MP4 recording is unavailable. */
(()=>{
  class AudioCapture{
    constructor(){this.media=new Set();this.sources=new WeakMap();this.registered=new WeakSet();this.buses=new Map();this.nodes=new Set();this.active=false;}
    getContext(){
      const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error('This browser cannot capture replay audio.');
      if(!this.context){this.context=new Context();this.mix=this.context.createMediaStreamDestination();}
      return this.context;
    }
    async open(){
      this.getContext();
      await this.context.resume();
    }
    trackMedia(audio){
      this.media.add(audio);
      if(!this.registered.has(audio)){
        this.registered.add(audio);audio.addEventListener?.('ended',()=>{if(!audio.loop)this.media.delete(audio);});
      }
      if(this.active)this.connectMedia(audio);
    }
    connectMedia(audio){
      let source=this.sources.get(audio);
      if(!source){source=this.context.createMediaElementSource(audio);source.connect(this.context.destination);this.sources.set(audio,source);}
      if(!this.connected.has(source)){source.connect(this.mix);this.connected.add(source);}
    }
    trackNode(node,context){
      if(!this.active||this.nodes.has(node))return;
      // Game effects and media share the recording clock instead of crossing streams.
      if(context===this.context){node.connect(this.mix);this.nodes.add(node);return;}
      let bus=this.buses.get(context);
      if(!bus){
        const destination=context.createMediaStreamDestination(),source=this.context.createMediaStreamSource(destination.stream);source.connect(this.mix);
        bus={destination,source};this.buses.set(context,bus);
      }
      node.connect(bus.destination);this.nodes.add(node);
    }
    begin(){
      this.connected=new Set();this.active=true;
      // Supply silent samples even before the first cue so the encoder starts audio immediately.
      this.silence=this.context.createConstantSource();this.silence.offset.value=0;this.silence.connect(this.mix);this.silence.start();
      for(const audio of this.media)this.connectMedia(audio);
      return this.mix.stream.getAudioTracks().map(track=>track.clone());
    }
    end(){
      this.active=false;
      if(this.silence){this.silence.stop();this.silence.disconnect();this.silence=null;}
      for(const source of this.connected||[])try{source.disconnect(this.mix);}catch{}
      for(const node of this.nodes){
        try{node.disconnect(this.mix);}catch{}
        for(const {destination} of this.buses.values())try{node.disconnect(destination);}catch{}
      }
      for(const {source,destination} of this.buses.values()){source.disconnect();for(const track of destination.stream.getTracks())track.stop();}
      this.buses.clear();this.nodes.clear();this.connected?.clear();
      for(const audio of this.media)if(audio.paused&&!audio.loop)this.media.delete(audio);
    }
  }
  const capture=window.BattleReplayCapture=new AudioCapture();
  class ReplayExporter{
    constructor({hd=false}={}){this.hd=hd;this.frameRate=hd?60:30;this.speech=new Map();this.urls=[];this.controller=new AbortController();this.cancelled=false;this.recording=false;}
    static supported(){return !!window.MediaRecorder&&!!window.HTMLCanvasElement?.prototype.captureStream;}
    async prepare(record){
      await capture.open();
      const mp4=this.hd?['video/mp4;codecs=avc1.640034,mp4a.40.2','video/mp4;codecs=avc1.420034,mp4a.40.2']:['video/mp4;codecs=avc1.42001E,mp4a.40.2'];
      this.mime=[...mp4,'video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/mp4','video/webm'].find(type=>window.MediaRecorder.isTypeSupported(type));
      if(!this.mime)throw Error('This browser cannot record a supported replay video format.');
      const missing=[];
      for(const {event} of record.events){
        if(event.type!=='bridge-dialogue')continue;
        const text=event.order||event.reply,speaker=event.order?'captain':event.speaker||'helm',key=speaker+'\n'+text;
        if(!event.clip&&!window.BattleVoiceClips?.[key]&&!missing.some(line=>line.key===key))missing.push({key,text,speaker});
      }
      if(!this.mime.startsWith('video/mp4')||missing.length){
        if(!/^https?:$/.test(window.location.protocol))throw Error('Start ST Battle with its local server to export MP4 and synthesized dialogue.');
        const response=await fetch('/api/replay/capabilities',{signal:this.controller.signal});if(!response.ok)throw Error('Restart the ST Battle server to enable replay export.');
        const capabilities=await response.json();
        if(!this.mime.startsWith('video/mp4')&&!capabilities.mp4)throw Error('MP4 conversion needs the installed FFmpeg encoder. Restart the local game server.');
        if(missing.length&&!capabilities.speech)throw Error('Synthesized dialogue export needs Windows speech and FFmpeg on the local game server.');
      }
      for(const line of missing){
        const response=await fetch('/api/replay/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:line.text,speaker:line.speaker}),signal:this.controller.signal});
        if(!response.ok)throw Error('Could not prepare synthesized replay dialogue.');
        const url=URL.createObjectURL(await response.blob());this.urls.push(url);this.speech.set(line.key,url);
      }
      if(this.cancelled)throw Error('Export cancelled.');
    }
    clipFor(line){return this.speech.get((line.order?'captain':line.speaker||'helm')+'\n'+(line.order||line.reply));}
    start(canvas){
      if(this.cancelled)throw Error('Export cancelled.');
      const scale=Math.min(1,(this.hd?3840:1920)/canvas.width,(this.hd?2160:1080)/canvas.height);
      if(this.hd&&scale===1&&canvas.width%2===0&&canvas.height%2===0&&typeof canvas.captureStream==='function'){
        // Keep HD frames on the GPU instead of reading 4K pixels into a 2D canvas every frame.
        this.canvas=canvas;
      }else{
        this.canvas=document.createElement('canvas');this.canvas.width=Math.max(2,Math.floor(canvas.width*scale/2)*2);this.canvas.height=Math.max(2,Math.floor(canvas.height*scale/2)*2);
        this.paint=this.canvas.getContext('2d',{alpha:false});this.frame(canvas);
      }
      this.stream=this.canvas.captureStream(this.frameRate);for(const track of capture.begin())this.stream.addTrack(track);
      const chunks=[];
      this.recorder=new window.MediaRecorder(this.stream,{mimeType:this.mime,videoBitsPerSecond:this.hd?50000000:7000000,audioBitsPerSecond:this.hd?320000:160000});
      this.finished=new Promise((resolve,reject)=>{
        this.resolve=resolve;this.reject=reject;
        this.recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
        this.recorder.onerror=()=>reject(Error('Replay recording failed.'));
        this.recorder.onstop=()=>{this.recording=false;resolve(new Blob(chunks,{type:this.recorder.mimeType||this.mime}));};
      });
      this.recording=true;this.recorder.start(1000);
      this.timer=setTimeout(()=>{this.reject(Error('Replay export timed out.'));this.stop();},300000);
      return this.finished;
    }
    frame(canvas){this.paint?.drawImage(canvas,0,0,this.canvas.width,this.canvas.height);}
    stop(){clearTimeout(this.timer);if(this.recorder?.state!=='inactive')this.recorder?.stop();}
    async mp4(blob){
      if(this.cancelled)throw Error('Export cancelled.');
      if(blob.type.startsWith('video/mp4'))return blob;
      const response=await fetch('/api/replay/mp4',{method:'POST',headers:{'Content-Type':'video/webm',...(this.hd?{'X-Replay-Quality':'hd'}:{})},body:blob,signal:this.controller.signal});
      if(!response.ok){let message='Could not convert the replay to MP4.';try{message=(await response.json()).error||message;}catch{}throw Error(message);}
      return response.blob();
    }
    download(blob,turn,{hd=false}={}){
      if(this.cancelled)return;
      const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='ST-Battle-Turn-'+turn+(hd?'-HD':'')+'.mp4';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    }
    cancel(){this.cancelled=true;this.controller.abort();this.stop();this.resolve?.(new Blob());}
    dispose(){clearTimeout(this.timer);capture.end();for(const track of this.stream?.getTracks()||[])track.stop();for(const url of this.urls)URL.revokeObjectURL(url);this.urls=[];}
  }
  window.BattleReplayExporter=ReplayExporter;
})();
