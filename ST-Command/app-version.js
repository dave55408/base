/* Refresh the passive build label without interrupting flight. */
(()=>{
 const badge=document.getElementById('app-version'),versionNumber=document.getElementById('app-version-number'),buildNumber=document.getElementById('app-build-number');let current=null,pending=null;
 function show(value){
  if(!value||typeof value.version!=='string')return;
  current=value;const release=(value.release||value.version).split('+')[0],build=value.revision||value.version.split('+')[1]||'—';versionNumber.textContent=release;buildNumber.textContent=build;badge.setAttribute('aria-description','Semantic Versioning 2.0.0: '+value.version);badge.setAttribute('aria-label','Version '+release+', build '+build);
 }
 async function refresh(){
  if(pending||!/^https?:$/.test(location.protocol))return pending;
  pending=(async()=>{try{const response=await fetch('/api/version',{cache:'no-store'});if(response.ok)show(await response.json());}catch{/* Keep the last known version when offline. */}})();
  try{await pending;}finally{pending=null;}
 }
 show(window.ST_COMMAND_VERSION);refresh();
 if(/^https?:$/.test(location.protocol)){
  setInterval(()=>{if(!document.hidden)refresh();},15000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.addEventListener('focus',refresh);
 }
 window.STCommandVersion={refresh,get current(){return current;}};
})();
