/* Perspective attitude and aft-bay guidance; camera controls match the galaxy map. */
window.drawShuttleApproachMap=(c,w,h,m,s,view)=>{
  const rad=Math.PI/180,range=Math.hypot(m.x,m.y,m.z-110),extent=Math.max(1.5,range*.72),unit=430/extent;
  let location={x:m.x,y:m.y,z:m.z};
  if(m.landing&&['docking','cockpitfade','landed','powerdown'].includes(m.phase)){const pad=m.landing.pad;location={x:m.x-pad.x,y:m.y-pad.y,z:110+m.z-pad.z};}
  const center={x:location.x*.45,y:location.y*.45,z:110+(location.z-110)*.45};
  const camera=SpaceMath.camera(w,h,view.yaw,view.tilt,view.zoom);
  const project=p=>camera.project({x:500+(p.x-center.x)*unit,y:450+(p.y-center.y)*unit,z:(p.z-center.z)*unit});
  function line(a,b,color='#9e713e',width=1,dash=[]){const p=project(a),q=project(b);c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();c.setLineDash([]);}
  const point=(x,y,z)=>({x,y,z});
  c.fillStyle='#090908';c.fillRect(0,0,w,h);
  const floor=110-extent*.24;
  for(let i=-4;i<=4;i++){const k=i*extent/4;line(point(-extent,k,floor),point(extent,k,floor),'#9b632c30');line(point(k,-extent,floor),point(k,extent,floor),'#9b632c30');}
  for(const x of [-extent,extent])for(const y of [-extent,extent])line(point(x,y,floor),point(x,y,110+extent*.65),'#b77d3e25');
  // Unfilled wireframe of the registered Enterprise, anchored at the bay.
  const ship=(x,y,z=0)=>point(x*extent,y*extent,110+z*extent);
  const shipScale=extent*.36,shipFaces=[];
  const hullPoint=([x,y,z])=>point(x*shipScale,y*shipScale,110+z*shipScale);
  function hullFace(vertices){
    const points=vertices.map(v=>project(hullPoint(v)));
    shipFaces.push({points,depth:points.reduce((sum,p)=>sum+p.depth,0)/points.length});
  }
  function ringHull(profile,origin,vertical=false,segments=12){
    const rings=profile.map(([r,h])=>Array.from({length:segments},(_,i)=>{const a=i/segments*Math.PI*2;return vertical?[origin[0]+Math.cos(a)*r,origin[1]+Math.sin(a)*r,origin[2]+h]:[origin[0]+Math.cos(a)*r,origin[1]+h,origin[2]+Math.sin(a)*r];}));
    for(let row=1;row<rings.length;row++)for(let i=0;i<segments;i++){const next=(i+1)%segments;hullFace([rings[row-1][i],rings[row-1][next],rings[row][next],rings[row][i]]);}
  }
  function prism(section,axis,halfWidth){
    const rings=[-halfWidth,halfWidth].map(offset=>section.map(([a,b])=>axis==='x'?[offset,a,b]:[a,axis+offset,b]));
    hullFace(rings[0]);hullFace([...rings[1]].reverse());
    for(let i=0;i<section.length;i++){const next=(i+1)%section.length;hullFace([rings[0][i],rings[1][i],rings[1][next],rings[0][next]]);}
  }
  ringHull([[0,-.033],[.48,-.033],[.65,-.025],[.68,.022],[.57,.038],[.18,.078],[0,.078]],[0,-1.478,.385],true,16);
  ringHull([[.18,0],[.15,.035],[.055,.06],[0,.06]],[0,-1.478,.465],true,12);
  ringHull([[.29,0],[.17,-.06],[.05,-.10],[0,-.10]],[0,-1.478,.358],true,12);
  const shape=EnterpriseEngineeringShape,bodyRings=[0,3,5,7,9].map(index=>{const [radius,level]=shape.profile[index];return Array.from({length:8},(_,i)=>{const a=i/8*Math.PI*2,x=Math.cos(a)*radius;return [x,level*shape.bodyScale-.032,Math.sin(a)>=0?shape.upAt(level,x):-shape.downAt(level,x)];});});
  hullFace(bodyRings[0]);hullFace([...bodyRings.at(-1)].reverse());
  for(let row=1;row<bodyRings.length;row++)for(let i=0;i<8;i++)hullFace([bodyRings[row-1][i],bodyRings[row-1][(i+1)%8],bodyRings[row][(i+1)%8],bodyRings[row][i]]);
  prism([[-.572,.11],[-.902,.13],[-1.192,.36],[-.852,.36]],'x',.032);
  ringHull([[0,-1.10],[.097,-1.09],[.124,-1.05],[0,-1.05]],[0,0,0],false,12);
  for(const side of [-1,1]){
    prism([[side*.065,.07],[side*.105,.07],[side*.459,.455],[side*.419,.455]],-.293,.0535);
    ringHull([[0,-.752],[.078,-.675],[.078,.715],[.06,.815],[0,.83]],[side*.439,0,.490],false,8);
  }
  shipFaces.sort((a,b)=>a.depth-b.depth).forEach(({points})=>{c.strokeStyle='#7bc9ff88';c.lineWidth=.65;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.stroke();});
  const bayArch=Array.from({length:13},(_,i)=>hullPoint([.083*Math.cos(i/12*Math.PI),.014,.008+.071*Math.sin(i/12*Math.PI)]));
  bayArch.unshift(hullPoint([.083,.014,-.046]));bayArch.push(hullPoint([-.083,.014,-.046]),bayArch[0]);
  for(let i=1;i<bayArch.length;i++)line(bayArch[i-1],bayArch[i],'#ffe1a0',1.4);
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
  function local(x,y,z){const a=x*Math.cos(bank)+z*Math.sin(bank),b=-x*Math.sin(bank)+z*Math.cos(bank);return {x:location.x+extent*(right.x*a+forward.x*y+up.x*b),y:location.y+extent*(right.y*a+forward.y*y+up.y*b),z:location.z+extent*(right.z*a+forward.z*y+up.z*b)};}
  const faces=[];
  const face=(vertices,color)=>{const points=vertices.map(p=>project(local(...p)));faces.push({points,color,depth:points.reduce((sum,p)=>sum+p.depth,0)/points.length});};
  // Cache a simplified copy of the real Class F geometry, including its
  // compressed cabin, three windows, swept shelves and cylindrical engines.
  if(!drawShuttleApproachMap.craftFaces){
    const T=AlpineThree,craft=createClassFShuttle(T),polygons=[];craft.updateWorldMatrix(true,true);
    craft.traverse(o=>{
      if(!o.isMesh||!o.name||/markings|glow|rib-/.test(o.name))return;
      const g=o.geometry,p=g.attributes.position,topology=g.userData.hullPanelTopology;
      const vertex=i=>{const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);return [v.x*.026,v.z*.026,(v.y-.90)*.026];};
      const add=indices=>polygons.push({vertices:indices.map(vertex),color:'#'+o.material.color.getHexString()});
      if(topology){
        const {segments,rows}=topology,step=5;
        for(let row=1;row<rows;row++)for(let i=0;i<segments;i+=step){const a=(row-1)*(segments+1)+i,b=row*(segments+1)+i;add([a,a+step,b+step,b]);}
      }else if(o.name.endsWith('-class-f-rear-cowling')){
        for(let i=0;i<64;i+=8){const a=i*4,b=(i+8)*4;add([a,b,b+1,a+1]);add([a+1,b+1,b+3,a+3]);}
      }else if(g.type==='SphereGeometry'){
        const {widthSegments:width,heightSegments:height}=g.parameters;
        for(let y=0;y<height;y+=4)for(let x=0;x<width;x+=4){const nextY=Math.min(y+4,height),nextX=Math.min(x+4,width);add([y*(width+1)+x,y*(width+1)+nextX,nextY*(width+1)+nextX,nextY*(width+1)+x]);}
      }else if(p.count===4||o.name.endsWith('-class-f-body'))add(Array.from({length:p.count},(_,i)=>i));
      else if(g.index)for(let i=0;i<g.index.count;i+=3)add([g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)]);
    });
    drawShuttleApproachMap.craftFaces=polygons;
    craft.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
  }
  for(const {vertices,color} of drawShuttleApproachMap.craftFaces)face(vertices,color);
  faces.sort((a,b)=>a.depth-b.depth).forEach(({points,color})=>{c.fillStyle=color;c.strokeStyle='#9ad9ff8a';c.lineWidth=.8;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fill();c.stroke();});
  line(location,local(0,.3,0),'#91d8ff',1.7);
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
