/* Fit every bridge console, including expanded strategy, without panel scrolling. */
(()=>{
  const shell=document.getElementById('game-shell');
  const panels=['main','.screen','.yorktown-rail','.helm','.engineering','.shields','.weapons'];
  let frame=0;
  function fit(){
    frame=0;
    const viewportWidth=Math.max(1,window.innerWidth),viewportHeight=Math.max(1,window.innerHeight);
    let height=1000,width;
    for(let pass=0;pass<10;pass++){
      width=Math.max(1760,viewportWidth/viewportHeight*height);
      shell.style.width=width+'px';shell.style.height=height+'px';
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
    shell.style.width=width+'px';shell.style.height=height+'px';
    shell.style.setProperty('--game-scale',String(Math.min(viewportWidth/width,viewportHeight/height)));
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(fit);}
  window.addEventListener('resize',schedule);
  window.visualViewport?.addEventListener('resize',schedule);
  document.fonts?.ready.then(schedule);
  // Strategy expansion and changing console content must refit without a window resize.
  if(typeof MutationObserver!=='undefined')new MutationObserver(schedule).observe(shell,{subtree:true,attributes:true,attributeFilter:['hidden','aria-expanded']});
  if(typeof ResizeObserver!=='undefined'){
    const observer=new ResizeObserver(schedule);
    for(const content of shell.querySelectorAll('.yorktown-rail>.panel,main>:is(.helm,.engineering,.shields,.weapons)>*,.engineering-repair-controls>*'))observer.observe(content);
  }
  fit();
})();
