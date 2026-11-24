/* Fit every bridge console, including expanded strategy, without panel scrolling. */
(()=>{
  const shell=document.getElementById('game-shell');
  const panels=['main','.screen','.yorktown-rail','.helm','.engineering','.shields','.weapons'];
  let frame=0;
  function matchViewPanels(){
    const reference=shell.querySelector('#attack-hud'),turn=shell.querySelector('#pass-panel');
    if(!reference?.offsetHeight||!reference.offsetWidth||!turn?.style)return;
    const height=reference.offsetHeight+'px',width=reference.offsetWidth+'px';
    if(turn.style.getPropertyValue?.('--turn-panel-height')!==height)turn.style.setProperty('--turn-panel-height',height);
    if(turn.style.getPropertyValue?.('--turn-panel-width')!==width)turn.style.setProperty('--turn-panel-width',width);
  }
  function fit(){
    frame=0;
    const viewportWidth=Math.max(1,window.innerWidth),viewportHeight=Math.max(1,window.innerHeight);
    let height=1000,width;
    for(let pass=0;pass<10;pass++){
      width=Math.max(1760,viewportWidth/viewportHeight*height);
      if(shell.style.width!==width+'px')shell.style.width=width+'px';
      if(shell.style.height!==height+'px')shell.style.height=height+'px';
      let growth=0;
      for(const selector of panels){
        const panel=shell.querySelector(selector);if(!panel)continue;
        const overflow=panel.scrollHeight-panel.clientHeight;
        // A console receives only part of the shell's height; grow proportionally.
        if(overflow>1)growth=Math.max(growth,Math.ceil(overflow*height/Math.max(1,panel.clientHeight))+8);
      }
      if(!growth)break;
      height+=growth;
    }
    width=Math.max(1760,viewportWidth/viewportHeight*height);
    if(shell.style.width!==width+'px')shell.style.width=width+'px';
    if(shell.style.height!==height+'px')shell.style.height=height+'px';
    const scale=String(Math.min(viewportWidth/width,viewportHeight/height));
    if(shell.style.getPropertyValue?.('--game-scale')!==scale)shell.style.setProperty('--game-scale',scale);
    matchViewPanels();
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(fit);}
  window.addEventListener('resize',schedule);
  window.visualViewport?.addEventListener('resize',schedule);
  document.fonts?.ready.then(schedule);
  // Strategy expansion and changing console content must refit without a window resize.
  if(typeof MutationObserver!=='undefined')new MutationObserver(records=>{
    if(records.some(record=>record.oldValue!==record.target.getAttribute(record.attributeName)))schedule();
  }).observe(shell,{subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['hidden','aria-expanded']});
  if(typeof ResizeObserver!=='undefined'){
    const reference=shell.querySelector('#attack-hud');if(reference)new ResizeObserver(matchViewPanels).observe(reference);
    const observer=new ResizeObserver(schedule);
    for(const content of shell.querySelectorAll('.yorktown-rail>.panel,main>:is(.helm,.engineering,.shields,.weapons)>*,.engineering-repair-controls>*'))observer.observe(content);
  }
  fit();
})();
