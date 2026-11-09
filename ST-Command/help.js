/* A keyboard-accessible controls window; preserve the user's pause state. */
(() => {
  const dialog=document.getElementById('controls-help'),link=document.getElementById('help-link');
  let resume=false;
  link.addEventListener('click',event=>{
    event.preventDefault();if(dialog.open)return;
    resume=!STCommand.state.paused;if(resume)STCommand.pause();
    dialog.showModal();
  });
  document.getElementById('help-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{
    if(resume&&STCommand.state.paused)STCommand.pause();
    resume=false;link.focus({preventScroll:true});
  });
  window.addEventListener('keydown',event=>{
    if(!dialog.open)return;
    event.stopImmediatePropagation();
    if(event.key==='Escape'){event.preventDefault();dialog.close();}
  },{capture:true});
})();
