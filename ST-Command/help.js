/* A keyboard-accessible controls window; preserve the user's pause state. */
(() => {
  const dialog=document.getElementById('controls-help'),links=document.querySelectorAll('#help-link,#about-link');
  let resume=false,opener=null;
  for(const link of links)link.addEventListener('click',event=>{
    event.preventDefault();if(dialog.open)return;
    opener=link;
    resume=!STCommand.state.paused;if(resume)STCommand.pause();
    dialog.showModal();dialog.scrollTop=0;
  });
  document.getElementById('help-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{
    if(resume&&STCommand.state.paused)STCommand.pause();
    resume=false;opener?.focus({preventScroll:true});
  });
  window.addEventListener('keydown',event=>{
    if(!dialog.open)return;
    event.stopImmediatePropagation();
    if(event.key==='Escape'){event.preventDefault();dialog.close();}
  },{capture:true});
})();
