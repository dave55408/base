(()=>{
 const $=id=>document.getElementById(id),D=WindowPlanDiagram,key='st-command-window-plan-'+WINDOW_PLAN_DATA.revision;
 const clone=value=>JSON.parse(JSON.stringify(value));let data=clone(WINDOW_PLAN_DATA),selected=null,activeView='side',adding=false,drag=null,history=[],future=[];
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.schemaVersion===1&&Array.isArray(saved.windows))data=saved;}catch{}
 function current(){return data.windows.find(w=>w.id===selected);}
 function announce(text,error=false){$('status').textContent=text;$('status').dataset.error=String(error);}
 function save(){try{localStorage.setItem(key,JSON.stringify(data));announce('Saved in this browser. Export JSON to keep an editable file.');}catch{announce('Browser storage is unavailable. Export JSON to keep your edits.',true);}}
 function checkpoint(){history.push(clone(data));if(history.length>40)history.shift();future=[];}
 function render(){
  $('diagram').innerHTML=D.svg(data,{selected,showNavigation:$('navigation').checked,side:$('side').value,showLabels:$('labels').checked});
  const svg=$('diagram').firstElementChild,view=$('view').value;
  svg.setAttribute('viewBox',view==='front'?'30 125 750 485':view==='rear'?'820 125 750 485':view==='side'?'35 650 1530 510':'0 0 1600 1240');
  $('undo').disabled=!history.length;$('redo').disabled=!future.length;$('add-window').setAttribute('aria-pressed',String(adding));inspect();
 }
 function inspect(){
  $('window-picker').innerHTML='<option value="">Select a window</option>'+data.windows.map(w=>`<option value="${D.esc(w.id)}">${D.esc(w.id+' · '+w.state+' · '+w.surface)}</option>`).join('');$('window-picker').value=selected||'';
  const w=current();$('inspector').hidden=!w;$('selection-title').textContent=w?w.id:'Select a window';
  if(!w){$('selection-note').textContent='Gold = lit. Dark = unlit. Dashed outlines need review.';return;}
  const g=data.groups.find(g=>g.id===w.group);$('selection-note').textContent=g?.notes||'User-added window. Fit its position to the ship surface before implementation.';
  $('window-group').innerHTML=data.groups.map(g=>`<option value="${D.esc(g.id)}">${D.esc(g.label)}</option>`).join('');$('window-group').value=w.group;
  for(const name of ['state','shape','category','width','height','confidence','notes'])$('window-'+name).value=w[name]??'';
  ['x','y','z'].forEach((a,i)=>{$('window-'+a).value=w.position[i];$('normal-'+a).value=w.normal[i];});
  if(data.sources.some(s=>s.id===w.source)){$('source').value=w.source;source();}
 }
 function source(){
  const ref=data.sources.find(s=>s.id===$('source').value)||data.sources[0];$('reference-image').setAttribute('href',ref.file);
  const w=current(),pixel=w?.source===$('source').value?w.sourcePixel:null;$('reference-marker').toggleAttribute('hidden',!pixel);
  if(pixel){$('reference-marker').setAttribute('cx',pixel[0]);$('reference-marker').setAttribute('cy',pixel[1]);}
  $('source-note').textContent=pixel?`${w.id} · source pixel ${pixel[0]}, ${pixel[1]}`:ref.label+' · window positions are reconstructed, not exact photo measurements.';
 }
 function select(id,view){selected=id;if(view)activeView=view;render();}
 function commit(callback){checkpoint();callback();save();render();}
 function point(event){const svg=$('diagram').firstElementChild,p=new DOMPoint(event.clientX,event.clientY);return p.matrixTransform(svg.getScreenCTM().inverse());}
 function toggle(){const w=current();if(w){commit(()=>{w.state=w.state==='lit'?'unlit':'lit';});$('diagram').querySelector(`[data-id="${selected}"][data-view="${activeView}"]`)?.focus();}}
 function newId(){let n=1;while(data.windows.some(w=>w.id==='EDIT-'+String(n).padStart(3,'0')))n++;return 'EDIT-'+String(n).padStart(3,'0');}
 $('diagram').addEventListener('pointerdown',event=>{
  if(event.button!==0)return;const mark=event.target.closest('.window-mark'),view=mark?.dataset.view||event.target.closest('[data-view]')?.dataset.view;
  if(mark){
   event.preventDefault();selected=mark.dataset.id;activeView=view;const w=current(),p=point(event);drag={pointer:event.pointerId,start:[p.x,p.y],position:w.position.slice(),moved:false};for(const node of $('diagram').querySelectorAll('.window-mark'))node.classList.toggle('selected',node.dataset.id===selected);inspect();
  }else if(adding&&view){
   const p=point(event),side=$('side').value,previous=current(),g=data.groups.find(g=>g.id===(previous?.group||(side==='port'?'PH':'SH')));
   commit(()=>{const position=D.unproject([p.x,p.y],view,previous?.position||[side==='port'?-.15:.15,0,-.6]);const w={id:newId(),group:g.id,surface:g.surface,side:view==='side'?side:g.side,position:position.map(n=>+n.toFixed(5)),normal:view==='front'?[0,0,-1]:view==='rear'?[0,0,1]:[side==='port'?-1:1,0,0],width:.018,height:.007,shape:'rect',state:'lit',category:'window',confidence:'estimated',source:g.source,sourcePixel:null,color:null,notes:'User-added; surface registration required.'};data.windows.push(w);selected=w.id;activeView=view;adding=false;});
  }
 });
 $('diagram').addEventListener('pointermove',event=>{
  if(!drag||drag.pointer!==event.pointerId)return;const p=point(event);if(Math.hypot(p.x-drag.start[0],p.y-drag.start[1])<2&&!drag.moved)return;
  if(!drag.moved){checkpoint();$('diagram').setPointerCapture(event.pointerId);}drag.moved=true;const original=D.project(drag.position,activeView),position=D.unproject([original[0]+p.x-drag.start[0],original[1]+p.y-drag.start[1]],activeView,drag.position);
  current().position=position.map(n=>+n.toFixed(5));current().confidence='estimated';render();
 });
 function endDrag(){if(!drag)return;if(drag.moved)save();drag=null;$('undo').disabled=!history.length;}
 $('diagram').addEventListener('pointerup',endDrag);$('diagram').addEventListener('pointercancel',endDrag);$('diagram').addEventListener('lostpointercapture',endDrag);
 $('diagram').addEventListener('dblclick',event=>{const mark=event.target.closest('.window-mark');if(mark){selected=mark.dataset.id;toggle();}});
 $('diagram').addEventListener('focusin',event=>{const mark=event.target.closest('.window-mark');if(mark){selected=mark.dataset.id;activeView=mark.dataset.view;inspect();}});
 $('diagram').addEventListener('keydown',event=>{
  const mark=event.target.closest('.window-mark');if(!mark)return;selected=mark.dataset.id;activeView=mark.dataset.view;
  if(event.key===' '){event.preventDefault();toggle();return;}
  if(event.key==='Delete'){event.preventDefault();$('delete-window').click();return;}
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const w=current(),delta=event.shiftKey?.01:.002;
  commit(()=>{if(event.key==='ArrowUp')w.position[1]+=delta;else if(event.key==='ArrowDown')w.position[1]-=delta;else if(activeView==='side')w.position[2]+=(event.key==='ArrowRight'?1:-1)*delta;else w.position[0]+=(event.key==='ArrowRight'?1:-1)*(activeView==='front'?-1:1)*delta;w.position=w.position.map(n=>+n.toFixed(5));w.confidence='estimated';});
  $('diagram').querySelector(`[data-id="${selected}"][data-view="${activeView}"]`)?.focus();
 });
 $('inspector').addEventListener('submit',event=>event.preventDefault());
 $('inspector').addEventListener('change',event=>{
  if(!current()||!event.target.id.startsWith('window-')&&!event.target.id.startsWith('normal-'))return;
  const w=current(),id=event.target.id,value=event.target.value,numeric=/^window-(width|height|x|y|z)$|^normal-/.test(id);
  if(numeric&&!Number.isFinite(Number(value))){announce('Enter a finite numeric value.',true);inspect();return;}
  if(/width|height/.test(id)&&(Number(value)<.002||Number(value)>.2)){announce('Window dimensions must be between 0.002 and 0.2 units.',true);inspect();return;}
  commit(()=>{
   if(/^normal-/.test(id))w.normal['xyz'.indexOf(id.at(-1))]=Number(value);
   else if(/^window-[xyz]$/.test(id)){w.position['xyz'.indexOf(id.at(-1))]=Number(value);w.confidence='estimated';}
   else{const name=id.slice(7);w[name]=numeric?Number(value):value;if(name==='group'){const g=data.groups.find(g=>g.id===value);w.surface=g.surface;w.side=g.side;}}
  });
 });
 $('duplicate').onclick=()=>{if(current())commit(()=>{const copy=clone(current());copy.id=newId();copy.position[activeView==='side'?2:0]+=.025;copy.sourcePixel=null;copy.confidence='estimated';data.windows.push(copy);selected=copy.id;});};
 $('delete-window').onclick=()=>{if(current())commit(()=>{data.windows=data.windows.filter(w=>w.id!==selected);selected=null;});};
 $('undo').onclick=()=>{if(history.length){future.push(clone(data));data=history.pop();if(!current())selected=null;save();render();}};
 $('redo').onclick=()=>{if(future.length){history.push(clone(data));data=future.pop();save();render();}};
 for(const id of ['view','side','navigation','labels'])$(id).onchange=render;
 $('window-picker').onchange=()=>{const w=data.windows.find(w=>w.id===$('window-picker').value);if(w){if(['port','starboard'].includes(w.side))$('side').value=w.side;select(w.id,'side');}};
 $('add-window').onclick=()=>{adding=!adding;render();announce(adding?'Click a location on one of the ship views to add a window.':'Add mode off.');};
 $('reset').onclick=()=>commit(()=>{data=clone(WINDOW_PLAN_DATA);selected=null;});
 function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 $('export-json').onclick=()=>download('enterprise-window-layout.json',JSON.stringify(data,null,2),'application/json');
 $('export-svg').onclick=()=>download('enterprise-window-map.svg',D.svg(data,{showNavigation:$('navigation').checked,side:$('side').value,showLabels:$('labels').checked}),'image/svg+xml');
 function validate(value){
  if(value?.schemaVersion!==1||!Array.isArray(value.windows)||!Array.isArray(value.groups)||!Array.isArray(value.sources))throw Error('This is not a version 1 window-layout file.');
  if(value.windows.length>5000)throw Error('The file contains too many windows.');const ids=new Set();
  for(const w of value.windows){
   if(typeof w.id!=='string'||!/^[A-Za-z0-9_-]+$/.test(w.id)||ids.has(w.id))throw Error('Window IDs must be unique letters, numbers, underscores or hyphens.');ids.add(w.id);
   if(![w.position,w.normal].every(v=>Array.isArray(v)&&v.length===3&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<20))||Math.hypot(...w.normal)<.001)throw Error('Invalid position or surface normal.');
   if(!value.groups.some(g=>g.id===w.group)||w.color&&!/^#[0-9a-f]{6}$/i.test(w.color))throw Error('Invalid group or light color.');
   if(!['lit','unlit'].includes(w.state)||!['rect','round'].includes(w.shape)||!['window','aperture','navigation'].includes(w.category)||![w.width,w.height].every(n=>Number.isFinite(n)&&n>=.002&&n<=.2))throw Error('Invalid window state, classification or dimensions.');
  }
  for(const source of value.sources)if(!/^references\/image-\d+\.png$/.test(source.file))throw Error('Source images must refer to the supplied local references.');
 }
 $('import-json').onchange=async event=>{try{const file=event.target.files[0];if(!file)return;const incoming=JSON.parse(await file.text());validate(incoming);commit(()=>{data=incoming;selected=null;});announce('Imported '+data.windows.length+' editable records.');}catch(error){announce(error.message,true);}finally{event.target.value='';}};
 $('source').innerHTML=data.sources.map(s=>`<option value="${D.esc(s.id)}">${D.esc(s.label)}</option>`).join('');$('source').onchange=source;
 $('coverage').replaceChildren(...data.coverage.unresolved.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
 window.WindowPlanEditor={get data(){return clone(data);},select,validate,render};source();render();
})();
