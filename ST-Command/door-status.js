/* Large viewscreen announcements follow door motion, including automatic opening. */
(()=>{
 const hud=document.getElementById('door-status-hud');
 let lastBay=1,automaticOpening=false;
 function update(){
  const m=window.STCommand?.away.state;
  const messages=[];
  if(m&&!['bridge','orbit'].includes(m.phase)){
   if(m.bayDoorOpen>lastBay)automaticOpening=true;
   if(m.bayDoorOpen<lastBay||m.bayDoorOpen>=1)automaticOpening=false;
   if(m.bayDoorOpen<1&&(m.hangarDoorTarget===1||(m.hangarDoorTarget==null&&automaticOpening)))messages.push('Opening Hangar Door');
   if(m.garageDoorTarget===1&&m.garageDoorOpen<1)messages.push('Opening Garage');
  }else automaticOpening=false;
  lastBay=m?.bayDoorOpen??1;
  const text=messages.join('\n');if(hud.textContent!==text)hud.textContent=text;
  hud.hidden=!messages.length;
  requestAnimationFrame(update);
 }
 requestAnimationFrame(update);
})();
