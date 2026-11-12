/* Project notes use the local server or a browser-granted HTML file handle. */
(()=>{
 const $=id=>document.getElementById(id),dialog=$('project-notes'),text=$('project-notes-text'),status=$('project-notes-status'),saveButton=$('project-notes-save'),openButton=$('project-notes-open'),fileButton=$('project-notes-file'),importInput=$('project-notes-import'),format=STProjectNotesFormat;
 const draftKey='st-command-notes-draft:'+location.pathname,pickerOptions={id:'st-command-notes',types:[{description:'ST Command HTML notes',accept:{'text/html':['.html','.htm']}}]};
 let localMode=location.protocol==='file:',fileHandle=null,needsFileWrite=false,saved='',loaded=false,resume=false,timer=null,saving=null;
 function report(message,error=false){status.textContent=message;status.dataset.error=String(error);}
 function draft(){try{return localStorage.getItem(draftKey);}catch{return null;}}
 function keepDraft(){if(localMode)try{localStorage.setItem(draftKey,text.value);}catch{}}
 function clearDraft(){if(localMode)try{localStorage.removeItem(draftKey);}catch{}}
 function savedMessage(){return localMode?'Saved to '+(fileHandle?.name||'project-notes.html'):'Saved in ST-Command/project-notes.html';}
 async function rememberedHandle(value){
  let db;try{
   db=await new Promise((resolve,reject)=>{const request=indexedDB.open('st-command-notes-files',1);request.onupgradeneeded=()=>request.result.createObjectStore('files');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
   return await new Promise((resolve,reject)=>{const transaction=db.transaction('files',value?'readwrite':'readonly'),store=transaction.objectStore('files'),request=value?store.put(value,location.pathname):store.get(location.pathname);transaction.oncomplete=()=>resolve(value||request.result);transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);});
  }catch{return null;}finally{db?.close();}
 }
 async function request(options){
  let response;try{response=await fetch('/api/project-notes',{cache:'no-store',...options});}catch{throw Error('Notes service unavailable. Use Choose HTML file to save directly.');}
  let data;try{data=await response.json();}catch{throw Error('This preview does not provide a notes service.');}
  if(!response.ok)throw Error(data.error||'Could not access the notes file.');return data;
 }
 async function localLoad(){
  localMode=true;fileButton.hidden=false;loaded=true;saved='';text.value=draft()??'';
  report('Choose project-notes.html in ST-Command, or type notes and click Save Notes to create it.');
  const handle=await rememberedHandle();
  if(handle)try{
   if(await handle.queryPermission({mode:'readwrite'})==='granted'){
    const notes=format.readNotesDocument(await(await handle.getFile()).text());fileHandle=handle;saved=notes;text.value=draft()??notes;
    fileButton.textContent='Change HTML file';report(text.value===saved?savedMessage():'Recovered unsaved notes. Click Save Notes to write them.');
   }
  }catch{report('Choose your HTML notes file again to reconnect it.');}
 }
 async function useExistingFile(file,handle=null){
  const notes=format.readNotesDocument(await file.text()),pending=text.value!==saved?text.value:'';
  fileHandle=handle;saved=notes;needsFileWrite=false;text.value=pending&&pending!==notes?notes+(notes?'\n\n':'')+pending:notes;
  loaded=true;fileButton.textContent=handle?'Change HTML file':'Open HTML file';keepDraft();
  if(handle)await rememberedHandle(handle);
  report(text.value===saved?'Loaded '+file.name+' — edits save to this file.':'Existing notes loaded; your unsaved notes were kept below them.');
 }
 fileButton.addEventListener('click',async()=>{
  if(!window.showOpenFilePicker){importInput.click();return;}
  try{
   const [handle]=await showOpenFilePicker({...pickerOptions,multiple:false});
   if(handle.requestPermission)await handle.requestPermission({mode:'readwrite'});
   await useExistingFile(await handle.getFile(),handle);text.focus();
  }catch(error){if(error.name!=='AbortError')report('Could not open that notes file. '+error.message,true);}
 });
 importInput.addEventListener('change',async()=>{try{if(importInput.files[0])await useExistingFile(importInput.files[0]);}catch(error){report('Could not read the selected notes page. '+error.message,true);}finally{importInput.value='';}});
 async function ensureLocalFile(interactive){
  if(!fileHandle){
   if(!interactive){report('Draft kept in this browser. Click Save Notes or Choose HTML file.');return false;}
   if(!window.showSaveFilePicker)return 'download';
   fileHandle=await showSaveFilePicker({...pickerOptions,suggestedName:'project-notes.html'});needsFileWrite=true;
   const file=await fileHandle.getFile();
   if(file.size&&text.value===saved&&!text.value){const notes=format.readNotesDocument(await file.text());text.value=notes;saved=notes;needsFileWrite=false;}
   await rememberedHandle(fileHandle);fileButton.textContent='Change HTML file';
  }
  let permission=await fileHandle.queryPermission({mode:'readwrite'});
  if(permission!=='granted'&&interactive)permission=await fileHandle.requestPermission({mode:'readwrite'});
  if(permission!=='granted'){report('Click Save Notes to allow writing to your HTML file. Your draft is kept here.',true);return false;}
  return true;
 }
 async function save(interactive=false){
  clearTimeout(timer);if(!loaded)return false;
  if(saving){if(!await saving)return false;return save(interactive);}
  try{
   if(localMode){
    const access=await ensureLocalFile(interactive);if(!access)return false;
    if(access==='download'){
     const url=URL.createObjectURL(new Blob([format.notesDocument(text.value)],{type:'text/html;charset=utf-8'})),link=document.createElement('a');
     link.href=url;link.download='project-notes.html';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
     saved=text.value;clearDraft();report('Saved an HTML download.');return true;
    }
   }
  }catch(error){keepDraft();if(error.name!=='AbortError')report('Could not select a writable HTML file. '+error.message,true);return false;}
  if(text.value===saved&&!needsFileWrite)return true;
  const snapshot=text.value;saveButton.disabled=true;report('Saving…');
  saving=(async()=>{
   try{
    if(localMode){const writable=await fileHandle.createWritable();try{await writable.write(format.notesDocument(snapshot));await writable.close();}catch(error){await writable.abort().catch(()=>{});throw error;}}
    else await request({method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({notes:snapshot})});
    saved=snapshot;needsFileWrite=false;if(text.value===saved)clearDraft();report(text.value===saved?savedMessage():'Unsaved changes');return true;
   }catch(error){keepDraft();report('Could not save notes. '+error.message,true);return false;}
   finally{saveButton.disabled=false;}
  })();
  const success=await saving;saving=null;return success;
 }
 openButton.addEventListener('click',async()=>{
  if(dialog.open)return;resume=!STCommand.state.paused;if(resume)STCommand.pause();dialog.showModal();
  if(loaded){text.focus();return;}
  text.disabled=true;saveButton.disabled=true;report('Loading notes…');
  try{
   if(localMode)await localLoad();
   else try{const data=await request();text.value=data.notes;saved=data.notes;loaded=true;report(savedMessage());}catch{await localLoad();}
  }catch(error){report(error.message,true);}
  finally{text.disabled=!loaded;saveButton.disabled=!loaded;if(dialog.open&&loaded)text.focus();}
 });
 text.addEventListener('input',()=>{keepDraft();report('Unsaved changes');clearTimeout(timer);timer=setTimeout(()=>save(),700);});
 function restoreFlight(){if(resume&&STCommand.state.paused)STCommand.pause();resume=false;openButton.focus({preventScroll:true});}
 function finishClose(){dialog.close();restoreFlight();}
 async function close(writeFile=false){
  if(loaded){
   if(localMode&&!fileHandle&&!writeFile){keepDraft();finishClose();return;}
   do{if(!await save(true))return;}while(text.value!==saved);
  }
  finishClose();
 }
 saveButton.addEventListener('click',()=>close(true));$('project-notes-close').addEventListener('click',()=>close());
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('close',()=>{if(!dialog.open)restoreFlight();});
 window.addEventListener('keydown',event=>{
  if(!dialog.open)return;event.stopImmediatePropagation();
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();save(true);}
  if(event.key==='Escape'){event.preventDefault();close();}
 },{capture:true});
})();
