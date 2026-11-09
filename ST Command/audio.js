/* Local bridge ambience: no external player or network connection required. */
(() => {
  const audio=document.getElementById('bridge-ambience'),panel=document.getElementById('audio-panel'),status=document.getElementById('audio-status'),volume=document.getElementById('audio-volume');
  let wanted=false,simulationPaused=!!window.STCommand?.state.paused,resumeAfterPause=false,awaitingGesture=false;
  const handle=panel.querySelector('.audio-title');let drag=null;
  function place(x,y){
    const box=panel.getBoundingClientRect(),margin=10;
    panel.style.left=Math.max(margin,Math.min(x,innerWidth-box.width-margin))+'px';
    panel.style.top=Math.max(margin,Math.min(y,innerHeight-box.height-margin))+'px';panel.style.right='auto';
  }
  function keepOnScreen(){if(!panel.hidden&&panel.style.left){const box=panel.getBoundingClientRect();place(box.x,box.y);}}
  handle.tabIndex=0;handle.title='Drag to move. When focused, use arrow keys to reposition.';
  handle.setAttribute('aria-label','Move audio window: drag or use arrow keys');
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('button'))return;
    event.preventDefault();const box=panel.getBoundingClientRect();drag={x:event.clientX,y:event.clientY,left:box.left,top:box.top};
    handle.focus({preventScroll:true});handle.setPointerCapture(event.pointerId);panel.classList.add('dragging');
  });
  handle.addEventListener('pointermove',event=>{if(drag)place(drag.left+event.clientX-drag.x,drag.top+event.clientY-drag.y);});
  const endDrag=()=>{drag=null;panel.classList.remove('dragging');};
  handle.addEventListener('pointerup',endDrag);handle.addEventListener('pointercancel',endDrag);handle.addEventListener('lostpointercapture',endDrag);
  handle.addEventListener('keydown',event=>{
    if(event.target!==handle||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();const box=panel.getBoundingClientRect(),step=event.shiftKey?40:10;
    place(box.left+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0),box.top+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0));
  });
  window.addEventListener('resize',keepOnScreen);
  audio.loop=true;audio.volume=+volume.value/100;
  const setPlaying=value=>{panel.dataset.playing=String(value);};
  function stop(){wanted=false;awaitingGesture=false;resumeAfterPause=false;audio.pause();panel.hidden=true;setPlaying(false);}
  async function start({reveal=true}={}){
    wanted=true;if(reveal)panel.hidden=false;status.textContent='Starting local bridge audio…';keepOnScreen();
    if(simulationPaused){resumeAfterPause=true;status.textContent='Audio paused with simulation. Resume the simulation to play.';return;}
    try{await audio.play();}
    catch(error){if(!wanted)return;setPlaying(false);awaitingGesture=error.name==='NotAllowedError';status.textContent=awaitingGesture?'Bridge audio will start with your first click or key press.':'The local audio could not play. Reload the simulator and try again.';}
  }
  function setSimulationPaused(paused){
    if(simulationPaused===paused)return;
    simulationPaused=paused;
    if(paused){resumeAfterPause=wanted&&!audio.paused;audio.pause();if(wanted)status.textContent='Audio paused with simulation.';}
    else if(resumeAfterPause&&wanted){resumeAfterPause=false;audio.play().catch(()=>{status.textContent='Press play below to resume the background loop.';});}
  }
  audio.addEventListener('playing',()=>{if(!wanted||simulationPaused){audio.pause();return;}awaitingGesture=false;setPlaying(true);status.textContent='Local bridge audio playing · continuous loop.';});
  audio.addEventListener('play',()=>{wanted=true;if(simulationPaused){resumeAfterPause=true;audio.pause();status.textContent='Audio paused with simulation.';}});
  audio.addEventListener('pause',()=>{setPlaying(false);if(wanted)status.textContent=simulationPaused?'Audio paused with simulation.':'Audio paused. Press play below to resume.';});
  audio.addEventListener('error',()=>{setPlaying(false);wanted=false;status.textContent='The local audio file could not load. Reload the simulator and try again.';});
  audio.addEventListener('volumechange',()=>{volume.value=Math.round(audio.volume*100);document.getElementById('audio-volume-value').textContent=volume.value+'%';});
  window.addEventListener('keydown',event=>{
    if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||['INPUT','SELECT','TEXTAREA'].includes(event.target?.tagName))return;
    if(event.key.toLowerCase()==='b'){event.preventDefault();wanted?stop():start();}
  });
  document.getElementById('audio-close').addEventListener('click',stop);
  volume.addEventListener('input',()=>{audio.volume=+volume.value/100;document.getElementById('audio-volume-value').textContent=volume.value+'%';});
  function unlockAudio(event){if(!event.isTrusted||!wanted||!awaitingGesture||simulationPaused||event.target.closest?.('#audio-panel')||event.key?.toLowerCase()==='b')return;awaitingGesture=false;start({reveal:false});}
  window.addEventListener('pointerdown',unlockAudio,{capture:true});window.addEventListener('keydown',unlockAudio,{capture:true});
  window.STCommandAudio={get wanted(){return wanted;},get awaitingGesture(){return awaitingGesture;},get ready(){return audio.readyState>=1;},get playing(){return !audio.paused&&!audio.ended&&audio.readyState>=2;},source:'assets/audio/bridge-ambience.m4a',stop,setSimulationPaused};
  start({reveal:false});
})();
