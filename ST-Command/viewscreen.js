/* F or double-click switches between the viewscreen and the full Ops console. */
(() => {
  const screen=document.querySelector('.forward');
  const view=document.getElementById('main-view');
  let lookDrag=null,lastLookDrag=-Infinity;
  const canLook=()=>{const m=window.STCommand?.away.state;return m?.phase==='flight'&&(m.freeSpace||m.z>65)&&!(m.cameraView==='excursion'&&(ShuttleBayFlight.inside(m)||m.entranceCameraPose));};
  screen.addEventListener('wheel',event=>{
    if(!canLook()||event.ctrlKey||event.metaKey||event.altKey)return;
    event.preventDefault();event.stopPropagation();
    const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1),m=STCommand.away.state;
    m.cameraZoom=Math.max(.5,Math.min(8,(m.cameraZoom||1)*Math.exp(-Math.max(-1000,Math.min(1000,pixels))*.0018)));
    document.getElementById('camera-zoom').textContent=m.cameraZoom.toFixed(1)+'×';
  },{passive:false});
  view.addEventListener('pointerdown',event=>{
    if(event.button!==0||!canLook())return;
    const m=STCommand.away.state;lookDrag={id:event.pointerId,x:event.clientX,y:event.clientY,yaw:m.lookYaw||0,pitch:m.lookPitch||0,moved:false};
    view.setPointerCapture(event.pointerId);view.classList.add('looking');event.preventDefault();
  });
  view.addEventListener('pointermove',event=>{
    if(!lookDrag||event.pointerId!==lookDrag.id)return;
    if(!canLook()){lookDrag=null;view.classList.remove('looking');return;}
    const dx=event.clientX-lookDrag.x,dy=event.clientY-lookDrag.y;
    if(Math.hypot(dx,dy)<4&&!lookDrag.moved)return;
    lookDrag.moved=true;const m=STCommand.away.state;if(m.trackingEnterprise){m.trackingEnterprise=false;STCommand.away.updateUI();}
    m.lookYaw=((lookDrag.yaw-dx*.22+180)%360+360)%360-180;
    m.lookPitch=Math.max(-85,Math.min(85,lookDrag.pitch+dy*.22));
  });
  const endLook=()=>{if(lookDrag?.moved)lastLookDrag=performance.now();lookDrag=null;view.classList.remove('looking');};
  view.addEventListener('pointerup',endLook);view.addEventListener('pointercancel',endLook);view.addEventListener('lostpointercapture',endLook);
  document.getElementById('look-forward').addEventListener('click',()=>{const m=STCommand.away.state;m.trackingEnterprise=false;m.entranceCameraPose=null;m.entranceCameraFade=null;m.cameraView='cockpit';m.lookYaw=0;m.lookPitch=0;m.cameraZoom=1;document.getElementById('camera-zoom').textContent='1.0×';STCommand.away.updateUI();});
  let active=false,nativeOwned=false,transitioning=false,scrollPosition=0;
  function setMode(value){
    active=value;document.body.classList.toggle('viewscreen-mode',value);
    screen.setAttribute('aria-description',value?'Press F or double-click to return to Ops mode. Escape also returns.':'Press F or double-click for full-screen viewscreen.');
    if(!value)requestAnimationFrame(()=>window.scrollTo(0,scrollPosition));
  }
  async function toggle(){
    if(transitioning)return;
    transitioning=true;
    try{
      if(active){
        if(document.fullscreenElement===screen){await document.exitFullscreen();}
        setMode(false);
      }else{
        scrollPosition=window.scrollY;document.activeElement?.blur();setMode(true);
        // Keep the viewport-filling mode if native fullscreen is unavailable.
        if(screen.requestFullscreen&&document.fullscreenEnabled){
          try{await screen.requestFullscreen({navigationUI:'hide'});}catch{/* CSS mode remains available. */}
        }
      }
    }finally{transitioning=false;}
  }
  screen.addEventListener('dblclick',event=>{if(event.target.closest('button')||performance.now()-lastLookDrag<300)return;event.preventDefault();toggle();});
  document.addEventListener('fullscreenchange',()=>{
    if(document.fullscreenElement===screen){nativeOwned=true;setMode(true);}
    else if(nativeOwned){nativeOwned=false;setMode(false);}
  });
  window.addEventListener('keydown',event=>{
    if(event.key.toLowerCase()==='f'){
      if(event.defaultPrevented||event.repeat||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||event.target?.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"])')||document.querySelector('dialog[open]'))return;
      event.preventDefault();toggle();return;
    }
    if(event.key==='Escape'&&active){event.preventDefault();toggle();}
  });
  window.STCommandView={get active(){return active;},toggle};
  setMode(false);
})();
