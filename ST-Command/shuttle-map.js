/* Perspective attitude and aft-bay guidance; camera controls match the galaxy map. */
window.drawShuttleApproachMap=(c,w,h,m,s,view)=>{
  const rad=Math.PI/180,range=Math.hypot(m.x,m.y,m.z-110),extent=Math.max(1.5,range*.72),unit=430/extent;
  let location={x:m.x,y:m.y,z:m.z};
  if(['docking','landed','powerdown'].includes(m.phase)){const t=m.phase==='docking'?Math.min(1,m.clock/4):1,smooth=t*t*(3-2*t);location={x:m.x*(1-smooth),y:m.y*(1-smooth),z:m.z+(110-m.z)*smooth};}
  const center={x:location.x*.45,y:location.y*.45,z:110+(location.z-110)*.45};
  const camera=SpaceMath.camera(w,h,view.yaw,view.tilt,view.zoom);
  const project=p=>camera.project({x:500+(p.x-center.x)*unit,y:450+(p.y-center.y)*unit,z:(p.z-center.z)*unit});
  function line(a,b,color='#9e713e',width=1,dash=[]){const p=project(a),q=project(b);c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();c.setLineDash([]);}
  const point=(x,y,z)=>({x,y,z});
  c.fillStyle='#090908';c.fillRect(0,0,w,h);
  const floor=110-extent*.24;
  for(let i=-4;i<=4;i++){const k=i*extent/4;line(point(-extent,k,floor),point(extent,k,floor),'#9b632c30');line(point(k,-extent,floor),point(k,extent,floor),'#9b632c30');}
  for(const x of [-extent,extent])for(const y of [-extent,extent])line(point(x,y,floor),point(x,y,110+extent*.65),'#b77d3e25');
  // Enterprise outline, with its aft entrance fixed at the navigation target.
  const ship=(x,y,z=0)=>point(x*extent,y*extent,110+z*extent);
  const saucer=Array.from({length:33},(_,i)=>ship(Math.cos(i*Math.PI/16)*.32,-.56+Math.sin(i*Math.PI/16)*.26,.14));
  for(let i=1;i<saucer.length;i++)line(saucer[i-1],saucer[i],'#d6b58066',1.3);
  for(const side of [-1,1]){
    line(ship(side*.06,-.03),ship(side*.06,-.58),'#b7986e66',2);
    line(ship(side*.06,-.15),ship(side*.35,-.21,.08),'#b7986e66',2);
    line(ship(side*.35,-.06,.08),ship(side*.35,-.58,.08),'#dec69b66',5);
  }
  const gate=(y,color,width=1)=>{
    const corners=[ship(-.13,y,-.09),ship(.13,y,-.09),ship(.13,y,.09),ship(-.13,y,.09)];
    corners.forEach((p,i)=>line(p,corners[(i+1)%4],color,width));
  };
  for(const y of [.3,.6,.9])gate(y,'#d9b46d44');gate(0,'#ffe1a0',2);
  line(ship(0,0),ship(0,1.15),'#ffe1a077',1,[4,5]);
  // Reference axes and drop line make vertical and lateral offsets visible.
  line(point(location.x,location.y,floor),location,'#ffc66b88',1,[3,4]);
  line(location,point(0,0,110),'#f3a74c88',1,[5,5]);
  const hdg=s.heading*rad,pitch=s.pitch*rad,bank=m.bank||0;
  const forward=SpaceMath.direction(s.heading,s.pitch),right={x:Math.cos(hdg),y:Math.sin(hdg),z:0},up={x:-Math.sin(hdg)*Math.sin(pitch),y:Math.cos(hdg)*Math.sin(pitch),z:Math.cos(pitch)};
  function local(x,y,z){const a=x*Math.cos(bank)-z*Math.sin(bank),b=x*Math.sin(bank)+z*Math.cos(bank);return {x:location.x+extent*(right.x*a+forward.x*y+up.x*b),y:location.y+extent*(right.y*a+forward.y*y+up.y*b),z:location.z+extent*(right.z*a+forward.z*y+up.z*b)};}
  const faces=[];
  const face=(vertices,color)=>{const points=vertices.map(p=>project(local(...p)));faces.push({points,color,depth:points.reduce((sum,p)=>sum+p.depth,0)/points.length});};
  face([[-.07,-.11,-.025],[.07,-.11,-.025],[.065,.08,-.025],[-.065,.08,-.025]],'#795132');
  face([[-.07,-.11,-.025],[-.07,-.11,.04],[-.055,.055,.055],[-.065,.08,-.025]],'#a97c47');
  face([[.07,-.11,-.025],[.065,.08,-.025],[.055,.055,.055],[.07,-.11,.04]],'#ba8b51');
  face([[-.07,-.11,.04],[.07,-.11,.04],[.055,.055,.055],[-.055,.055,.055]],'#f3d29a');
  face([[-.055,.055,.055],[.055,.055,.055],[.065,.08,-.025],[-.065,.08,-.025]],'#e4b879');
  face([[-.045,.058,.045],[.045,.058,.045],[.049,.071,.008],[-.049,.071,.008]],'#7dd3ea');
  for(const side of [-1,1])face([[side*.055,-.08,0],[side*.12,-.105,-.008],[side*.11,.035,-.008],[side*.055,.02,.015]],'#c2955c');
  face([[-.055,-.112,-.005],[.055,-.112,-.005],[.055,-.112,.025],[-.055,-.112,.025]],s.throttle>0?'#ff9a3a':'#524437');
  faces.sort((a,b)=>a.depth-b.depth).forEach(({points,color})=>{c.fillStyle=color;c.strokeStyle='#ffdda08a';c.lineWidth=.8;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fill();c.stroke();});
  line(location,local(0,.3,0),'#ffdf95',1.7);
  const shuttle=project(location),bay=project(point(0,0,110)),nose=project(local(0,.3,0)),wing=project(local(.12,0,0));
  c.font='11px Consolas';c.fillStyle='#edc48b';c.fillText('3D SHUTTLE / AFT BAY',14,22);
  c.font='10px Consolas';c.fillText(`HDG ${Math.round(s.heading).toString().padStart(3,'0')}°   PITCH ${s.pitch.toFixed(0)}°   BANK ${(bank/rad).toFixed(0)}°`,14,41);
  const format=v=>Math.abs(v)<1?`${(v*1000).toFixed(0)} M`:`${v.toFixed(1)} KM`;
  c.fillStyle='#bba17e';c.fillText(`LATERAL ${format(location.x)}   VERTICAL ${format(location.z-110)}`,14,h-39);
  c.fillText(`${m.phase==='flight'?'APPROACH':m.phase.toUpperCase()} · RANGE ${format(Math.hypot(location.x,location.y,location.z-110))}`,14,h-21);
  c.fillStyle='#ffe1a0';c.fillText('AFT BAY',Math.max(10,Math.min(w-65,bay.x+10)),Math.max(62,Math.min(h-65,bay.y-8)));
  c.fillStyle='#f9ce86';c.fillText('LANDING CRAFT',Math.max(10,Math.min(w-108,shuttle.x+13)),Math.max(76,Math.min(h-55,shuttle.y+26)));
  return {heading:s.heading,pitch:s.pitch,bank:bank/rad,range:Math.hypot(location.x,location.y,location.z-110),shuttle,bay,nose,wing,phase:m.phase};
};
