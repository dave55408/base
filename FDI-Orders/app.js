'use strict';
const capabilities=['E-Business Suite Data Intelligence','Fusion Operational Analytics','Frequent Data Refresh','AIDP Deep Insight Agents'];
const businessOutcomeNote='All Business Outcomes employ the AIDP Deep Insight Agents.';
const solutions=[
  {id:'cx',name:'Fusion CX Analytics',capabilities,outcomes:['Diagnose churn and dissatisfaction','Improve sales effectiveness','Measure marketing and service impact']},
  {id:'erp',name:'Fusion ERP Analytics',capabilities:[...capabilities,'Fusion EPM/PBCS Connector'],outcomes:['Quarter-end close with FDR','Explain and protect profitability','Improve cash flow and working capital','Allocate capital under uncertainty','Forecast misses causes']},
  {id:'hcm',name:'Fusion HCM Analytics',capabilities,outcomes:['Match workforce capacity to business demand','Understand regrettable attrition','Improve productivity sustainably','Evaluate workforce investments']},
  {id:'scm',name:'Fusion SCM Analytics',capabilities,outcomes:['Balance inventory, service, and cash','Resolve recurring delivery failures','Build supply resilience','Optimize production and fulfillment']},
  {id:'epm-fdi',name:'EPM + FDI',outcomes:['Margin-at-risk forecasting','Sales and demand planning alignment','Workforce cost and capacity planning','Project and services profitability','Working-capital optimization']},
  {id:'cx-erp',name:'CX + ERP',outcomes:['Quote-to-cash visibility and deal-risk management','Customer profitability and growth management','Service-to-retention and renewal optimization','Demand, order, and fulfillment experience','Customer collections and credit experience']},
  {id:'hcm-erp',name:'HCM + ERP',outcomes:['Workforce cost and capacity planning','Project staffing and profitability','Labor-cost and overtime optimization','Recruit-to-productivity and hiring ROI','Workforce compliance and financial-risk management']},
  {id:'scm-erp',name:'SCM + ERP',outcomes:['Demand-to-supply and revenue-risk management','Inventory and working-capital optimization','Procurement spend and supplier-performance management','Cost-to-serve and fulfillment profitability','Manufacturing cost and operational-performance management']}
];
const form=document.querySelector('#order-form');
const originalTitle=document.title;
function currentDate(){
  const now=new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
const requestFilename=date=>`FDI-Order-Request_${date}`;
function refreshDate(){document.querySelector('#request-date').textContent=`Date: ${currentDate()}`;}
// Planning defaults: cross-functional packages include these FDI components.
const dependencies={'epm-fdi':['erp'],'cx-erp':['cx','erp'],'hcm-erp':['hcm','erp'],'scm-erp':['scm','erp']};
const manualSolutions=new Set(),manualCapabilities=new Set();
const solutionInput=id=>form.querySelector(`input[name="solution"][value="${id}"]`);
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const [index,solution] of solutions.entries()){
  const card=document.createElement('div');card.className='solution-card';card.dataset.solution=solution.id;
  card.innerHTML=`<label class="solution-title"><input type="checkbox" name="solution" value="${solution.id}" aria-controls="options-${solution.id}" aria-expanded="false"><span>${solution.name}</span></label><div class="options" id="options-${solution.id}" hidden>${['capabilities','outcomes'].filter(group=>solution[group]).map(group=>`<p class="option-heading">${group==='capabilities'?'CAPABILITIES':'BUSINESS OUTCOMES'}</p>${solution[group].map((text,i)=>`<label class="option"><input type="checkbox" name="${solution.id}-${group}" value="${i}" disabled><span>${escapeHTML(text)}</span></label>`).join('')}`).join('')}</div>`;
  document.querySelector(index<4?'#solutions':'#cross-functional').append(card);
  const outcomeHeading=card.querySelector('.option-heading:last-of-type');
  outcomeHeading.append(' *');
  const note=document.createElement('p');note.className='outcome-note';note.id=`outcome-note-${solution.id}`;note.textContent='* '+businessOutcomeNote;
  card.querySelector('.options').append(note);
  outcomeHeading.setAttribute('aria-describedby',note.id);
  if(index<4){
    const dependencyNote=document.createElement('p');dependencyNote.className='dependency-note';dependencyNote.id=`dependency-${solution.id}`;dependencyNote.hidden=true;
    card.querySelector('.solution-title').after(dependencyNote);
    card.querySelector('input[name="solution"]').setAttribute('aria-describedby',dependencyNote.id);
  }
}
function selectedSolutions(){
  return solutions.filter(s=>form.querySelector(`input[name="solution"][value="${s.id}"]`).checked).map(s=>({name:s.name,category:solutions.indexOf(s)<4?'FDI Solutions':'Cross-functional Solutions',capabilities:(s.capabilities||[]).filter((_,i)=>form.querySelector(`input[name="${s.id}-capabilities"][value="${i}"]`).checked),outcomes:s.outcomes.filter((_,i)=>form.querySelector(`input[name="${s.id}-outcomes"][value="${i}"]`).checked)}));
}
function update(){
  refreshDate();
  const activePackages=Object.keys(dependencies).filter(id=>manualSolutions.has(id));
  for(const s of solutions){
    const checkbox=solutionInput(s.id),sources=activePackages.filter(id=>dependencies[id].includes(s.id));
    checkbox.checked=manualSolutions.has(s.id)||sources.length>0;
    checkbox.disabled=sources.length>0;
    const card=checkbox.closest('.solution-card'),note=card.querySelector('.dependency-note');
    card.classList.toggle('dependency-selected',sources.length>0);
    if(note){note.hidden=!sources.length;note.textContent=sources.length?'Included with '+sources.map(id=>solutions.find(s=>s.id===id).name).join(', '):'';}
    const hasSelectedOutcome=checkbox.checked&&s.outcomes.some((_,i)=>form.querySelector(`input[name="${s.id}-outcomes"][value="${i}"]`).checked);
    (s.capabilities||[]).forEach((capability,i)=>{
      const input=form.querySelector(`input[name="${s.id}-capabilities"][value="${i}"]`);
      const requiredByOutcome=capability==='AIDP Deep Insight Agents'&&hasSelectedOutcome;
      const required=requiredByOutcome||(sources.length>0&&(capability==='AIDP Deep Insight Agents'||(capability==='Fusion EPM/PBCS Connector'&&sources.includes('epm-fdi'))));
      input.checked=manualCapabilities.has(`${s.id}:${i}`)||required;
      input.dataset.required=String(required);
      input.closest('label').classList.toggle('required-capability',required);
      input.title=requiredByOutcome?'Included by the selected business outcomes':required?'Included by the selected cross-functional solution':'';
    });
  }
  for(const s of solutions){
    const card=form.querySelector(`[data-solution="${s.id}"]`),checkbox=card.querySelector('input[name="solution"]'),options=card.querySelector('.options');
    card.classList.toggle('selected',checkbox.checked);options.hidden=false;checkbox.removeAttribute('aria-expanded');
    options.querySelectorAll('input').forEach(input=>input.disabled=!checkbox.checked||input.dataset.required==='true');
  }
  const selected=selectedSolutions();document.querySelector('#selection-count').textContent=selected.length;
  document.querySelector('#summary-items').innerHTML=selected.length?selected.map(s=>`<div class="summary-entry"><h3>${s.name}</h3>${s.capabilities.length+s.outcomes.length?`<ul>${[...s.capabilities,...s.outcomes].map(t=>`<li>${escapeHTML(t)}</li>`).join('')}</ul>`:'<p>No specific priorities selected</p>'}</div>`).join(''):'<p class="empty">Your selected solutions and priorities will appear here.</p>';
  document.querySelector('#form-status').textContent='';
}
form.addEventListener('change',event=>{
  const input=event.target;
  if(input.name==='solution'){
    if(input.checked)manualSolutions.add(input.value);else manualSolutions.delete(input.value);
  }else if(input.name.endsWith('-capabilities')){
    const key=input.name.replace(/-capabilities$/,'')+':'+input.value;
    if(input.checked)manualCapabilities.add(key);else manualCapabilities.delete(key);
  }
  update();
});
form.addEventListener('input',()=>document.querySelector('#form-status').textContent='');
form.addEventListener('reset',()=>{manualSolutions.clear();manualCapabilities.clear();setTimeout(update,0);});
function request(){
  const fields=new FormData(form);
  return {date:currentDate(),company:fields.get('company').trim()||'Not specified',contact:fields.get('contact').trim()||'Not specified',email:fields.get('email').trim()||'Not specified',phone:fields.get('phone').trim(),targetStartDate:fields.get('start'),reference:fields.get('reference').trim(),notes:fields.get('notes').trim(),solutions:selectedSolutions()};
}
function validate(){
  if(!form.reportValidity())return false;
  if(!selectedSolutions().length){document.querySelector('#form-status').textContent='Select at least one solution to prepare your request.';form.querySelector('input[name="solution"]').focus();return false;}
  return true;
}
const commercialNote='Pricing, licensing, and commercial terms will be confirmed separately. This is an order request and does not place an order.';
function requestText(data){
  return [`FDI SOLUTION ORDER REQUEST — ${data.date}`,`Date: ${data.date}`,'',`Company: ${data.company}`,`Contact: ${data.contact}`,`Email: ${data.email}`,`Phone: ${data.phone||'Not specified'}`,`Target start date: ${data.targetStartDate||'Not specified'}`,`Request reference: ${data.reference||'Not specified'}`,'',...data.solutions.flatMap(s=>[s.name,...s.capabilities.map(t=>'  Capability: '+t),...s.outcomes.map(t=>'  Outcome: '+t),'']),'PROJECT NOTES',data.notes||'None','',commercialNote].join('\n');
}
function renderPrint(){
  const data=request();
  document.querySelector('#print-order').innerHTML=`<p class="eyebrow">FUSION DATA INTELLIGENCE</p><h1>Solution order request</h1>${[['Company',data.company],['Contact',data.contact],['Email',data.email],['Phone',data.phone],['Target start date',data.targetStartDate],['Reference',data.reference]].map(([label,value])=>`<p><strong>${label}:</strong> ${escapeHTML(value||'Not specified')}</p>`).join('')}<h2>Selected solutions (${data.solutions.length})</h2>${data.solutions.map(s=>`<section><h3>${s.name}</h3>${['capabilities','outcomes'].filter(group=>s[group].length).map(group=>`<p><strong>${group==='capabilities'?'Capabilities':'Business outcomes'}</strong></p><ul>${s[group].map(t=>`<li>${escapeHTML(t)}</li>`).join('')}</ul>`).join('')}</section>`).join('')||'<p>No solutions selected.</p>'}<h2>Project notes</h2><p>${escapeHTML(data.notes||'None')}</p><p class="print-note">${commercialNote}</p>`;
}
form.addEventListener('submit',event=>{
  event.preventDefault();if(!validate())return;
  const data=request(),blob=new Blob([requestText(data)+'\n\n* '+businessOutcomeNote],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=requestFilename(data.date)+'.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  document.querySelector('#form-status').textContent='Order request prepared. Your download has started; no request has been sent.';
});
document.querySelector('#print').addEventListener('click',()=>{if(validate()){renderPrint();window.print();}});
window.addEventListener('beforeprint',()=>{
  document.title=requestFilename(currentDate());
  renderPrint();
  const heading=document.querySelector('#print-order h1');
  const dateLine=document.createElement('p');dateLine.textContent=`Date: ${currentDate()}`;heading.after(dateLine);
  document.querySelectorAll('#print-order section h3').forEach(heading=>heading.append(' *'));
  const note=document.createElement('p');note.className='print-note';note.textContent='* '+businessOutcomeNote;document.querySelector('#print-order').append(note);
});
window.addEventListener('afterprint',()=>{document.title=originalTitle;});
window.addEventListener('focus',refreshDate);
update();
