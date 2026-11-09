/* Double-click switches between the viewscreen and the full Ops console. */
(() => {
  const screen=document.querySelector('.forward');
  let active=false,nativeOwned=false,transitioning=false,scrollPosition=0;
  function setMode(value){
    active=value;document.body.classList.toggle('viewscreen-mode',value);
    screen.title=value?'Double-click to return to Ops mode. Escape also returns.':'Double-click for full-screen viewscreen.';
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
  screen.addEventListener('dblclick',event=>{event.preventDefault();toggle();});
  document.addEventListener('fullscreenchange',()=>{
    if(document.fullscreenElement===screen){nativeOwned=true;setMode(true);}
    else if(nativeOwned){nativeOwned=false;setMode(false);}
  });
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&active){event.preventDefault();toggle();}});
  window.STCommandView={get active(){return active;},toggle};
  setMode(false);
})();
