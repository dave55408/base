'use strict';
const capabilities=['E-Business Suite Data Intelligence','Fusion Operational Analytics','Frequent Data Refresh','AIDP Deep Insight Agents'];
const businessOutcomeNote='All Business Outcomes employ the AIDP Deep Insight Agents.';
const capabilityDescriptions={
  'E-Business Suite Data Intelligence':'Brings EBS data into FDI’s modern analytics experience, unifying insights across EBS and Fusion. Initial coverage includes Finance, Procurement, and Projects.',
  'Fusion Operational Analytics':'Combines live Fusion transaction reporting with cross-application analytics, bringing 500+ OTBI subject areas into FDI’s governed model with AI and conversational exploration.',
  'Frequent Data Refresh':'Refreshes selected ERP, SCM, and HCM data every few hours, giving teams updated insights throughout the day.',
  'AIDP Deep Insight Agents':'Use multistep analysis to investigate business questions, identify potential root causes, and recommend actions. AIDP extends agent development with enterprise and external data.',
  'Fusion EPM/PBCS Connector':'Connects Oracle EPM data with FDI to support integrated financial analytics.'
};
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
const outcomeDescriptions={
  "erp": {
    "Explain and protect profitability": "Why are margins falling despite revenue growth? Which customers, products, projects, or channels remain profitable after the full cost to serve?",
    "Improve cash flow and working capital": "What is tying up cash across receivables, inventory, and payables? Which actions release cash with acceptable customer and supplier impact?",
    "Allocate capital under uncertainty": "Which investments should we fund, delay, or stop? How do demand, cost, and execution assumptions change the answer?",
    "Forecast misses causes": "Are variances driven by volume, price, mix, timing, productivity, or accounting effects? Which are temporary versus structural?"
  },
  "hcm": {
    "Match workforce capacity to business demand": "Where will skill shortages constrain growth? Should we hire, develop, redeploy, automate, or change the work?",
    "Understand regrettable attrition": "What workplace conditions contribute to losing critical talent? Which interventions improve retention, and how can we test their impact?",
    "Improve productivity sustainably": "Are performance gaps caused by skills, workload, management practices, process friction, or inadequate tools?",
    "Evaluate workforce investments": "Do training, compensation, and internal mobility programs improve business outcomes? How do results vary across employee groups?"
  },
  "scm": {
    "Balance inventory, service, and cash": "Where should inventory sit, and how much is needed when demand, lead times, and supply reliability vary?",
    "Resolve recurring delivery failures": "Are late orders caused by unrealistic promises, supplier variability, production constraints, or logistics? Which fix improves the whole system?",
    "Build supply resilience": "Which supplier, material, or location dependencies create the greatest exposure? When is a second source worth the added cost?",
    "Optimize production and fulfillment": "What should we make, where, and when—given capacity, labor, material, transport, and customer commitments?"
  },
  "cx": {
    "Diagnose churn and dissatisfaction": "Are customers leaving because of product fit, price, onboarding, delivery, billing, or support? Which problems should we fix first?",
    "Improve sales effectiveness": "Which deals are likely to close profitably? Where do stalled deals reflect weak qualification, pricing friction, or delivery concerns?",
    "Measure marketing and service impact": "Which activities cause incremental purchases or retention? Where are we spending on customers who would have bought or stayed anyway?"
  },
  "epm-fdi": {
    "Margin-at-risk forecasting": "Combine EPM plans with FDI sales, orders, procurement, and fulfillment data to spot likely revenue or gross-margin misses early.",
    "Sales and demand planning alignment": "Compare EPM revenue targets and scenarios with FDI pipeline, bookings, customer demand, inventory, and supply signals—giving Sales, Finance, and Supply Chain one forecast.",
    "Workforce cost and capacity planning": "Link EPM headcount and labor-cost plans to FDI HR, payroll, recruiting, utilization, and attrition data. Finance and HR can forecast hiring needs, cost pressure, and capacity gaps.",
    "Project and services profitability": "Connect EPM project budgets and forecasts with FDI project actuals, resource utilization, time, expenses, billing, and backlog. Delivery leaders can intervene before projects erode margin.",
    "Working-capital optimization": "Use EPM cash-flow forecasts alongside FDI receivables, payables, inventory, purchasing, and order data to improve cash conversion, prioritize collections, and manage payment timing."
  },
  "cx-erp": {
    "Quote-to-cash visibility and deal-risk management": "Link CRM pipeline and quotes with ERP orders, contracts, billing, credit, and collections. Sales, Finance, and Operations can identify stalled deals, order exceptions, and revenue/cash risks earlier.",
    "Customer profitability and growth management": "Combine CX account, opportunity, engagement, and service data with ERP revenue, cost-to-serve, returns, and payment data to focus Sales and Finance on profitable growth—not just bookings.",
    "Service-to-retention and renewal optimization": "Connect service cases, sentiment, usage, and renewal signals in CX with ERP invoices, entitlements, shipments, and payment history. Customer Success, Service, and Finance can prioritize accounts at risk of churn or non-renewal.",
    "Demand, order, and fulfillment experience": "Pair customer demand and campaign response from CX with ERP inventory, order status, delivery, and returns data. Marketing, Sales, Supply Chain, and Service can set accurate expectations and proactively resolve fulfillment issues.",
    "Customer collections and credit experience": "Use CRM relationship context and account interactions alongside ERP receivables, disputes, credit limits, and payment behavior. Finance can improve collections while Sales and Service protect strategic customer relationships."
  },
  "hcm-erp": {
    "Workforce cost and capacity planning": "Combine HCM headcount, compensation, recruiting, skills, and attrition data with ERP budgets, projects, demand, and labor costs. HR, Finance, and Operations can align staffing plans to business demand and budget.",
    "Project staffing and profitability": "Link employee skills, availability, time, and utilization from HCM with ERP project budgets, milestones, revenue, and costs. Delivery, HR, and Finance can staff the right people and protect project margins.",
    "Labor-cost and overtime optimization": "Join HCM schedules, timecards, absences, overtime, and contingent labor data with ERP operational volumes, production/service demand, and cost centers. Operations and HR can reduce avoidable overtime without hurting service levels.",
    "Recruit-to-productivity and hiring ROI": "Connect recruiting funnel, time-to-fill, onboarding, and learning data with ERP department budgets, project demand, and performance/cost outcomes. HR and Finance can identify which roles, locations, and hiring sources deliver the best return.",
    "Workforce compliance and financial-risk management": "Combine HCM worker classification, certifications, training, payroll, and absence data with ERP purchasing, project, location, and cost data. HR, Finance, Legal, and Operations can identify compliance gaps before they result in audit findings, penalties, or delivery risk."
  },
  "scm-erp": {
    "Demand-to-supply and revenue-risk management": "Combine SCM demand forecasts, inventory, supply plans, and supplier constraints with ERP orders, revenue forecasts, and financial plans. Sales, Supply Chain, and Finance can identify revenue at risk from shortages or late supply.",
    "Inventory and working-capital optimization": "Link SCM inventory positions, safety stock, lead times, and replenishment data with ERP item costs, carrying costs, cash forecasts, and profitability. Finance and Supply Chain can reduce excess stock while protecting service levels.",
    "Procurement spend and supplier-performance management": "Bring together SCM sourcing, supplier quality, delivery performance, and contract data with ERP purchase orders, invoices, payments, and budget data. Procurement, Finance, and Operations can control spend and reduce supplier-related disruption.",
    "Cost-to-serve and fulfillment profitability": "Combine SCM transportation, warehousing, fulfillment, returns, and service-level data with ERP customer, product, order, and margin data. Operations, Sales, and Finance can see which customers, channels, or products are profitable after fulfillment costs.",
    "Manufacturing cost and operational-performance management": "Connect SCM production plans, work orders, yield, downtime, and quality data with ERP standard costs, actual costs, inventory valuation, and financial forecasts. Manufacturing, Finance, and Supply Chain can act on cost variances and production risks faster."
  }
};
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
const infoTooltip=document.createElement('div');
infoTooltip.id='item-info';infoTooltip.className='info-tooltip';infoTooltip.role='tooltip';infoTooltip.hidden=true;
document.body.append(infoTooltip);
let activeInfoButton=null;
let closeInfoTimer;
function closeInfo(){
  clearTimeout(closeInfoTimer);
  activeInfoButton?.removeAttribute('aria-describedby');
  activeInfoButton=null;infoTooltip.hidden=true;
}
function scheduleCloseInfo(){clearTimeout(closeInfoTimer);closeInfoTimer=setTimeout(closeInfo,200);}
infoTooltip.addEventListener('mouseenter',()=>clearTimeout(closeInfoTimer));
infoTooltip.addEventListener('mouseleave',()=>{if(!infoTooltip.contains(document.activeElement))scheduleCloseInfo();});
infoTooltip.addEventListener('focusin',()=>clearTimeout(closeInfoTimer));
infoTooltip.addEventListener('focusout',event=>{if(!infoTooltip.contains(event.relatedTarget)&&event.relatedTarget!==activeInfoButton)closeInfo();});
function showInfo(button,text){
  closeInfo();activeInfoButton=button;button.setAttribute('aria-describedby',infoTooltip.id);
  infoTooltip.textContent=text+'\u00a0\u00a0';
  const moreLink=document.createElement('a');moreLink.className='tooltip-more';moreLink.textContent='More...';
  moreLink.href='https://www.oracle.com/fusion-data-intelligence/';moreLink.target='_blank';moreLink.rel='noopener noreferrer';
  infoTooltip.append(moreLink);infoTooltip.hidden=false;
  const bounds=button.getBoundingClientRect();
  const gap=12,width=infoTooltip.offsetWidth,height=infoTooltip.offsetHeight;
  let left=bounds.right+gap,top=bounds.top+(bounds.height-height)/2+5;
  if(left+width>window.innerWidth-gap){
    if(bounds.left-gap-width>=gap){
      left=bounds.left-gap-width;
    }else{
      left=Math.max(gap,Math.min(bounds.left,window.innerWidth-width-gap));
      top=bounds.bottom+gap;
      if(top+height>window.innerHeight-gap&&bounds.top-gap-height>=gap)top=bounds.top-gap-height;
    }
  }
  infoTooltip.style.left=left+'px';
  infoTooltip.style.top=Math.max(gap,Math.min(top,window.innerHeight-height-gap))+'px';
}
function addInfo(label,text){
  const textSpan=label.querySelector('span');
  const link=document.createElement('a');link.href='#item-info';link.className='info-link';
  link.textContent=textSpan.textContent;textSpan.replaceWith(link);
  link.addEventListener('mouseenter',()=>showInfo(link,text));
  link.addEventListener('mouseleave',()=>{if(document.activeElement!==link)scheduleCloseInfo();});
  link.addEventListener('focus',()=>showInfo(link,text));
  link.addEventListener('blur',event=>{if(!infoTooltip.contains(event.relatedTarget))closeInfo();});
  link.addEventListener('click',event=>{event.preventDefault();showInfo(link,text);});
}
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeInfo();});
document.addEventListener('click',event=>{if(!event.target.closest('.info-link')&&!infoTooltip.contains(event.target))closeInfo();});
window.addEventListener('resize',closeInfo);
window.addEventListener('scroll',closeInfo,true);
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
  const included=(dependencies[solution.id]||[]).map(id=>solutions.find(s=>s.id===id).name);
  const solutionDescription=solution.id==='epm-fdi'?'Selecting EPM + FDI includes Fusion ERP Analytics, AIDP Deep Insight Agents, and the Fusion EPM/PBCS Connector. These components are selected automatically.':included.length?`Selecting ${solution.name} includes ${included.join(' and ')}. Related capabilities are selected automatically.`:`Select ${solution.name} to choose its capabilities and business outcomes for your order request.`;
  addInfo(card.querySelector('.solution-title'),solutionDescription);
  card.querySelectorAll('.option').forEach(label=>{
    const input=label.querySelector('input'),text=label.textContent.trim();
    addInfo(label,input.name.endsWith('-outcomes')?(outcomeDescriptions[solution.id]?.[text]||`Include “${text}” as a business priority for ${solution.name}. ${businessOutcomeNote}`):(capabilityDescriptions[text]||`Include ${text} as a capability in your ${solution.name} request.`));
  });
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
    const closeOutcomeIndex=s.outcomes.indexOf('Quarter-end close with FDR');
    const hasCloseOutcome=checkbox.checked&&closeOutcomeIndex>=0&&form.querySelector(`input[name="${s.id}-outcomes"][value="${closeOutcomeIndex}"]`).checked;
    (s.capabilities||[]).forEach((capability,i)=>{
      const input=form.querySelector(`input[name="${s.id}-capabilities"][value="${i}"]`);
      const requiredByOutcome=(capability==='AIDP Deep Insight Agents'&&hasSelectedOutcome)||(capability==='Frequent Data Refresh'&&hasCloseOutcome);
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
    options.querySelectorAll('input').forEach(input=>input.disabled=input.dataset.required==='true');
  }
  const selected=selectedSolutions();document.querySelector('#selection-count').textContent=selected.length;
  document.querySelector('#summary-items').innerHTML=selected.length?selected.map(s=>`<div class="summary-entry"><h3>${s.name}</h3>${s.capabilities.length+s.outcomes.length?`<ul>${[...s.capabilities,...s.outcomes].map(t=>`<li>${escapeHTML(t)}</li>`).join('')}</ul>`:'<p>No specific priorities selected</p>'}</div>`).join(''):'<p class="empty">Your selected solutions and priorities will appear here.</p>';
  document.querySelector('#form-status').textContent='';
}
form.addEventListener('change',event=>{
  const input=event.target;
  if(input.checked&&/-(capabilities|outcomes)$/.test(input.name)){
    const solutionId=input.name.replace(/-(capabilities|outcomes)$/,'');
    if(solutions.some(s=>s.id===solutionId))manualSolutions.add(solutionId);
  }
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
