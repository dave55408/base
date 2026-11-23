/* Fit the complete bridge dashboard inside the available browser viewport. */
(()=>{
  const shell=document.getElementById('game-shell');
  let frame=0;
  function fit(){
    frame=0;
    const viewportWidth=Math.max(1,window.innerWidth),viewportHeight=Math.max(1,window.innerHeight);
    let height=1000,width;
    // Reserve enough natural space for the densest panel before scaling everything together.
    for(let pass=0;pass<8;pass++){
      width=Math.max(1760,viewportWidth/viewportHeight*height);
      shell.style.width=width+'px';shell.style.height=height+'px';
      const excess=selectors=>Math.max(0,...selectors.map(selector=>{
        const panel=shell.querySelector(selector);return panel?panel.scrollHeight-panel.clientHeight:0;
      }));
      const growth=Math.max(excess(['.screen'])+excess(['.helm','.shields','.weapons','.engineering']),excess(['.yorktown-rail']));
      if(growth<2)break;
      height+=growth+12;
    }
    // Include any final growth from the last pass in the actual shell dimensions.
    width=Math.max(1760,viewportWidth/viewportHeight*height);
    shell.style.width=width+'px';shell.style.height=height+'px';
    shell.style.setProperty('--game-scale',String(Math.min(viewportWidth/width,viewportHeight/height)));
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(fit);}
  window.addEventListener('resize',schedule);
  window.visualViewport?.addEventListener('resize',schedule);
  document.fonts?.ready.then(schedule);
  fit();
})();
