/* Discourage browser save actions; client-delivered files remain accessible. */
(()=>{
  'use strict';
  const block=event=>{
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  window.addEventListener('contextmenu',block,{capture:true});
  window.addEventListener('dragstart',block,{capture:true});
  for(const type of ['pointerdown','pointerup','mousedown','mouseup','click','auxclick']){
    window.addEventListener(type,event=>{
      if(event.button===2)block(event);
    },{capture:true});
  }
  window.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s')block(event);
  },{capture:true});
  window.addEventListener('click',event=>{
    if(event.composedPath().some(node=>node instanceof HTMLAnchorElement&&node.hasAttribute('download')))block(event);
  },{capture:true});
})();
