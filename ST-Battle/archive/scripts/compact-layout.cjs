const fs=require('fs'),root='C:/Users/David Granholm/.codex/ST-Battle/';
fs.writeFileSync(root+'layout.js',`/* Fit every bridge console, including expanded strategy, without panel scrolling. */
(()=>{
  const shell=document.getElementById('game-shell');
  const panels=['.screen','.yorktown-rail','.helm','.engineering','.shields','.weapons'];
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
    for(const content of shell.querySelectorAll('.yorktown-rail>.panel,main>:is(.helm,.engineering,.shields,.weapons)>*'))observer.observe(content);
  }
  fit();
})();
`);
const p=root+'style.css';fs.appendFileSync(p,`\n/* Keep the full bridge visible, with room for the expanded Yorktown strategy. */
#game-shell main{grid-template-rows:minmax(0,1.35fr) minmax(0,1fr);gap:8px;padding:10px 12px}
#game-shell main>:is(.helm,.shields,.weapons,.engineering){overflow:hidden;overscroll-behavior:auto}
#game-shell .yorktown-rail{gap:5px}
#game-shell main>.panel>.panel-heading,#game-shell .yorktown-rail .panel-heading{height:25px;padding:5px 8px}
#game-shell .yorktown-rail .target-name{padding:5px 8px 0}#game-shell .yorktown-rail .target-name h2{font-size:17px;margin:3px 0}
#game-shell .yorktown-rail .contact-stats{padding:5px 8px}
#game-shell .yorktown-pass-status{margin:2px 8px 4px;padding:5px 0}
#game-shell #yorktown-plan-state[data-status="executing"]{font-size:14px}
#game-shell .yorktown-strategy{margin:4px 8px}#game-shell .yorktown-strategy>button{padding:4px 8px}
#game-shell #yorktown-strategy-details{margin-top:4px;padding-top:4px}
#game-shell #yorktown-strategy-tactic{font-size:9px;line-height:1.3;margin:3px 0}
#game-shell #yorktown-strategy-orders{gap:3px;margin:4px 0}
#game-shell #yorktown-strategy-orders li{padding:4px 6px;font-size:8px;line-height:1.3}
#game-shell #yorktown-strategy-orders li strong{font-size:9px;margin-bottom:2px}
#game-shell .yorktown-rail .target-panel>.micro{margin:3px 8px}
#game-shell .yorktown-rail .wide{margin:3px 8px 5px;width:calc(100% - 16px);padding:5px 8px}
#game-shell .yorktown-console-body{padding:5px 8px}
#game-shell .yorktown-engineering .reactor-summary{padding:0 0 3px}
#game-shell .yorktown-engineering .reactor-summary strong{font-size:18px}
#game-shell .yt-readouts{gap:4px;margin-top:5px}
#game-shell .yt-power-controls,#game-shell #yt-system-integrity{gap:4px 10px}
#game-shell .yt-power-controls b{margin-top:2px;font-size:9px}
#game-shell .yorktown-console-body .micro{margin-top:4px;font-size:8px;line-height:1.3}
#game-shell .yorktown-console-body .meter-label{margin:4px 0 3px}
#game-shell .yorktown-weapons .weapon-block{padding-bottom:5px}
#game-shell .yorktown-weapons .weapon-title h3{font-size:12px}
#game-shell .yorktown-weapons .weapon-charge{margin-top:4px}
#game-shell .yorktown-weapons .capacitor{margin:1px 0 4px;gap:3px 8px}
#game-shell .yorktown-weapons .weapon-title p{margin-top:2px}
#game-shell main>.engineering .energy-reserve{margin:4px 10px 6px;padding:6px 8px}
#game-shell .energy-reserve-heading strong{font-size:15px}
#game-shell .energy-reserve .meter{height:7px;margin:5px 0}
#game-shell .energy-reserve p{font-size:8px;line-height:1.3;margin-top:4px}
#game-shell main>.engineering .repair-row{padding-top:3px}
#game-shell main>.engineering .repair-row select{padding:4px;font-size:10px}
#game-shell main>.helm .helm-sliders{gap:6px;padding:4px 10px}
#game-shell main>.helm .helm-actions{padding:4px 10px}
#game-shell main>.weapons .captain-orders{margin-top:4px;padding:5px;gap:3px}
#game-shell main>.weapons .weapon-title h3{font-size:12px}
#game-shell main>.weapons .weapon-title p{font-size:8px;line-height:1.3}
#game-shell main>.weapons .weapon-block{padding-top:4px}
`);
const t=root+'test/layout.test.cjs';let s=fs.readFileSync(t,'utf8');s=s.replace("bottom consoles give space to the viewscreen without enlarging the dashboard","bottom consoles expand the fitted canvas until all controls are visible");s=s.replace("assert.equal(parseFloat(h.style.height),1000);","assert(parseFloat(h.style.height)>1000);");s=s.replace("assert(panel.scrollHeight>panel.clientHeight);","assert(panel.scrollHeight-panel.clientHeight<2);");fs.writeFileSync(t,s);
