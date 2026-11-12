/* Smooth reference markings, drawn as paths over the movie hull finish. */
window.applyMovieMarkings=(T,maps)=>{
 const ink='#26342d',red='#9e3029',base='#a9b5aa',gold='#c4a950',contexts=[];
 function ctx(name,clear=false){
  const image=maps[name].image;if(clear){image.width=2048;image.height=256;}
  const c=image.getContext('2d');c.setTransform(1,0,0,1,0,0);c.scale(image.width,image.height);c.lineJoin='round';c.lineCap='round';contexts.push(c);return c;
 }
 function path(c,points,fill=null,color=ink,width=.0014,close=true){
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(close)c.closePath();
  if(fill){c.fillStyle=fill;c.fill();}if(color){c.strokeStyle=color;c.lineWidth=width;c.stroke();}
 }
 function rect(c,x,y,w,h,color=ink,width=.0022){c.strokeStyle=color;c.lineWidth=width;c.strokeRect(x,y,w,h);}
 function text(c,x,y,width,angle=0,physicalAspect=1){drawEnterpriseReferenceLabel(c,'registry',{x,y,width,angle,physicalAspect});}
 function grid(c){
  c.strokeStyle='rgba(63,84,69,.20)';c.lineWidth=.00105;
  for(const r of [.10,.16,.22,.28,.34,.40,.46,.49]){c.beginPath();c.arc(.5,.5,r,0,Math.PI*2);c.stroke();}
  for(let n=0;n<32;n++){const a=n*Math.PI/16;c.beginPath();c.moveTo(.5+Math.sin(a)*.10,.5+Math.cos(a)*.10);c.lineTo(.5+Math.sin(a)*.49,.5+Math.cos(a)*.49);c.stroke();}
 }
 let c=ctx('top');grid(c);
 const band=ENTERPRISE_1444_STENCILS.saucerBand,gain=205/.68*1.38;
 c.strokeStyle='rgba(178,156,111,.42)';c.lineWidth=(band.outer-band.inner)/gain;c.lineCap='butt';c.beginPath();c.arc(.5,.5,(band.inner+band.outer)/2/gain,Math.PI*1.5+band.start,Math.PI*1.5+band.end);c.stroke();c.lineCap='round';
 c.strokeStyle='rgba(99,108,78,.10)';c.lineWidth=.00065;
 for(let n=-16;n<=16;n++){const a=n*Math.PI/16;if(a<band.start||a>band.end)continue;c.beginPath();c.moveTo(.5+Math.sin(a)*band.inner/gain,.5-Math.cos(a)*band.inner/gain);c.lineTo(.5+Math.sin(a)*band.outer/gain,.5-Math.cos(a)*band.outer/gain);c.stroke();}
 if(.40>band.inner/gain&&.40<band.outer/gain){c.beginPath();c.arc(.5,.5,.40,Math.PI*1.5+band.start,Math.PI*1.5+band.end);c.stroke();}
 drawEnterpriseReferenceLabel(c,'saucer-registry');
 drawEnterpriseReferenceLabel(c,'ship-name');
 for(const a of [Math.PI/4,Math.PI*3/4,Math.PI*5/4,Math.PI*7/4]){
  c.save();c.translate(.5+Math.sin(a)*.455,.5+Math.cos(a)*.455);c.rotate(-a);c.fillStyle='#edf1e4';c.fillRect(-.009,-.012,.018,.024);c.restore();
 }
 for(const side of [-1,1]){
  c.save();if(side>0){c.translate(1,0);c.scale(-1,1);}
  path(c,[[.444,.926],[.480,.926],[.480,.972],[.405,.972],[.405,.946],[.444,.946]]);c.fillStyle=gold;c.fillRect(.396,.925,.007,.007);c.restore();
 }
 for(const x of [.493,.507])path(c,[[x,.630],[x,.820]],null,red,.0014,false);
 // The aft ridge is modeled in 3D; a painted stand-in would remain visible
 // past its rounded endpoint whenever the physical ridge is shortened.
 c=ctx('bottom');grid(c);
 for(const r of [.172,.198,.224]){c.strokeStyle='#7e5649';c.lineWidth=.00125;c.beginPath();c.arc(.5,.5,r,0,Math.PI*2);c.stroke();}
 if(maps.ventralSaucerInk!==false){text(c,.178,.505,.20);text(c,.822,.505,.20,Math.PI);}
 for(const side of [-1,1]){
  c.save();if(side>0){c.translate(1,0);c.scale(-1,1);}
  if(maps.ventralSaucerInk!==false)path(c,[[.161,.307],[.308,.368],[.286,.408],[.166,.326]],null,ink,.0015);
  c.strokeStyle=red;c.lineWidth=.002;c.beginPath();c.arc(.5,.5,.446,2.25,2.52);c.stroke();c.restore();
 }
 c.fillStyle=gold;c.fillRect(.348,.493,.013,.009);
 c=ctx('deck');c.fillStyle=gold;c.fillRect(.493,.568,.014,.018);rect(c,.493,.568,.014,.018,red,.001);
 for(const name of ['secondary','nacelle']){
  c=ctx(name);c.strokeStyle='rgba(63,84,69,.20)';c.lineWidth=.00125;
  for(const v of name==='secondary'?[.067,.23,.40,.58,.77,.94]:[.06,.20,.38,.56,.75,.94]){c.beginPath();c.moveTo(0,v);c.lineTo(1,v);c.stroke();}
  for(const u of [0,.125,.25,.375,.5,.625,.75,.875,1]){c.beginPath();c.moveTo(u,0);c.lineTo(u,1);c.stroke();}
  if(name==='nacelle')for(const x of [0,1])rect(c,x-.029,.570,.058,.160,'#8c4137',.00135);
  if(name==='secondary'){
   // Reference coordinates from the supplied ventral close-up. Map physical
   // cross-hull distances to the circular (or flattened aft) skin, rather than
   // drawing UV ellipses that turn into stretched rectangles and oval hatches.
   const referenceScale=1.19/361,engineeringShape=window.EnterpriseEngineeringShape;
   function point(x,y,seam){
    const z=-(x-18)*referenceScale,cross=(y-52)*referenceScale,down=engineeringShape.downAt(z,cross);
    return [seam+Math.atan2(cross,down)/(2*Math.PI),-z/1.19];
   }
   function shape(points,fill,stroke=ink,width=1.35){
    const centerX=(Math.min(...points.map(p=>p[0]))+Math.max(...points.map(p=>p[0])))/2;
    for(const seam of [0,1]){
     c.beginPath();
     for(let j=0;j<points.length;j++){
      const a=points[j],b=points[(j+1)%points.length],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])));
      for(let k=0;k<steps;k++){const t=k/steps,x=a[0]+(b[0]-a[0])*t,p=point(centerX+(x-centerX)/engineeringShape.bodyScale,a[1]+(b[1]-a[1])*t,seam);if(j===0&&k===0)c.moveTo(...p);else c.lineTo(...p);}
     }
     c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width/361;c.stroke();}
    }
   }
   const panel='#b8c4ba',outline='#923d32';
   function hatch(x,y,w,h,color){shape([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],panel,color);}
   hatch(48,40,30,23,outline);hatch(104,45,12,13,outline);
   hatch(135,45,40,14,ink);
   shape([[187,46],[197,46],[197,40],[215,37],[215,65],[197,63],[197,57],[187,57]],'#849187',ink);
   const circle=Array.from({length:96},(_,i)=>{const a=i/96*Math.PI*2;return [241+14*Math.cos(a),52+14*Math.sin(a)];});shape(circle,'#e4b51c',outline,1.4);
   hatch(334,45,33,14,'#7d8a80');
   shape([[337,48],[364,48],[364,56],[337,56]],'#829086',null);
   for(const y of [49.5,52,54.5])shape([[338,y],[363,y],[363,y+.6],[338,y+.6]],'#66796b',null);
   // Small paired maintenance stencils above and below the hatch centerline.
   for(const [x,y,flip] of [[157,27,1],[157,76,-1],[240,12,1],[239,89,-1]]){
    shape([[x-2,y],[x+2,y],[x+2,y+1],[x+.5,y+1],[x+.5,y+flip*5],[x-.5,y+flip*5],[x-.5,y+1],[x-2,y+1]],'#65736a',null);
   }
   maps.ventralMarkingReference='secondary hull underside close-up';
  }
 }
 function pennant(c){
  // Supplied close-up: straight parallel stripes, one diagonal separator,
  // and a curved yellow insignia painted over the forward red panel.
  path(c,[[.010,.46],[.024,.36],[.315,.36],[.326,.23],[.682,.23],[.661,.72],[.313,.72],[.319,.57],[.010,.57]],red,null);
  // Stop the sloping red edge before the opaque grille decal so the
  // diagonal remains visible at the red-to-gray transition.
  path(c,[[.697,.23],[.787,.23],[.762,.72],[.676,.72]],red,null);
  for(const y of [.40,.56])path(c,[[.321,y],[.642,y]],null,base,.020,false);
  c.save();c.translate(-.040,0);
  c.beginPath();c.moveTo(.765,.12);
  c.bezierCurveTo(.779,.10,.785,.27,.799,.39);
  c.bezierCurveTo(.810,.49,.797,.62,.778,.78);
  c.bezierCurveTo(.768,.86,.752,.82,.759,.72);
  c.bezierCurveTo(.776,.51,.777,.45,.762,.27);
  c.bezierCurveTo(.753,.18,.755,.13,.765,.12);
  c.fillStyle='#f2dc45';c.fill();c.restore();
 }
 c=ctx('pennant',true);pennant(c);
 c=ctx('portPennant',true);c.translate(1,0);c.scale(-1,1);c.drawImage(maps.pennant.image,0,0,1,1);
 const sideStencil=ENTERPRISE_1444_STENCILS.side,center=(724+sideStencil.bounds[0]+sideStencil.bounds[2]/2-655)/295;
 function engineRegistry(c,reverse){
  c.save();if(reverse){c.translate(1,0);c.scale(-1,1);}
  drawEnterpriseReferencePaint(c,'engineRed',red,1.45);drawEnterpriseReferencePaint(c,'engineGold','#d6bb45',1.45);c.restore();
  const labelCenter=reverse?1-center:center;
  c.clearRect(labelCenter-.14,0,.28,1);
  text(c,labelCenter,.51,.268,0,15.86);
 }
 c=ctx('registry',true);engineRegistry(c,false);c=ctx('portRegistry',true);engineRegistry(c,true);
 for(const c of contexts){c.setTransform(1,0,0,1,0,0);}
 for(const name of ['top','bottom','deck','secondary','nacelle','registry','portRegistry','pennant','portPennant'])maps[name].needsUpdate=true;
 maps.paintedMarkings=true;maps.markingReference='Image 1444.png';maps.shipName='U.S.S. ENTERPRISE';maps.registryText='NCC-1701';maps.registryCenters=[center,1-center];maps.registryTextWidth=.268;
};

