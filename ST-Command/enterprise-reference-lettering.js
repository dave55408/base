/* Source-derived vector lettering and paint from Image 1444.png. */
(()=>{
 const data=()=>window.ENTERPRISE_1444_STENCILS;
 function contours(c,stencil,map,color){
  c.beginPath();
  for(const points of stencil.contours){
   if(points.length<3)continue;
   const corners=points.map((p,i)=>{
    const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length],a=Math.hypot(prev[0]-p[0],prev[1]-p[1]),b=Math.hypot(next[0]-p[0],next[1]-p[1]),radius=Math.min(.20,a*.22,b*.22);
    return {p,entry:[p[0]+(prev[0]-p[0])*radius/a,p[1]+(prev[1]-p[1])*radius/a],exit:[p[0]+(next[0]-p[0])*radius/b,p[1]+(next[1]-p[1])*radius/b]};
   });
   c.moveTo(...map(corners[0].entry));
   for(const corner of corners){c.lineTo(...map(corner.entry));c.quadraticCurveTo(...map(corner.p),...map(corner.exit));}c.closePath();
  }
  c.fillStyle=color;c.fill('evenodd');
 }
 window.drawEnterpriseReferenceLabel=(c,kind,options={})=>{
  const source=data();if(!source)throw Error('Image 1444 lettering stencils are unavailable');
  const gain=205/.68*1.38,ink='#26342d';
  if(kind==='saucer-registry'){
   // Rigid angular letters follow the arc without bending their strokes.
   const glyphs={
    N:[[0,1],[0,0],[.65,1],[.65,0]],
    C:[[.65,.13],[.52,0],[.13,0],[0,.13],[0,.87],[.13,1],[.52,1],[.65,.87]],
    '-':[[0,.5],[.35,.5]],
    '1':[[0,.16],[.16,0],[.16,1]],
    '7':[[0,0],[.65,0],[.18,1]],
    '0':[[.13,0],[.52,0],[.65,.13],[.65,.87],[.52,1],[.13,1],[0,.87],[0,.13],[.13,0]]
   };
   const angles=[-.82,-.56,-.30,-.035,.19,.41,.66,.88];
   c.save();c.translate(.5,.5);c.rotate(Math.PI);c.strokeStyle=ink;c.lineWidth=.14;c.lineJoin='bevel';c.lineCap='butt';
   [...'NCC-1701'].forEach((letter,i)=>{
    const a=angles[i],points=glyphs[letter],width=letter==='1'?.16:letter==='-'?.35:.65;
    c.save();c.translate(Math.sin(a)*.293,Math.cos(a)*.293);c.rotate(-a);c.scale(.055,.062);
    c.beginPath();points.forEach(([x,y],n)=>{if(n)c.lineTo(x-width/2,y-.5);else c.moveTo(x-width/2,y-.5);});c.stroke();c.restore();
   });
   c.restore();return;
  }
  if(kind==='ship-name'){
   c.save();c.translate(.5,.337);c.rotate(Math.PI);c.scale(.001,.001);
   c.font='600 35px Arial, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle=ink;
   const width=c.measureText('U.S.S. ENTERPRISE').width;c.scale(330/width,1);
   c.fillText('U.S.S. ENTERPRISE',0,0);c.restore();return;
  }
  if(kind==='registry'){
   c.save();c.translate(options.x,options.y);c.rotate(options.angle||0);
   c.font='600 100px Arial, sans-serif';c.textAlign='center';c.textBaseline='alphabetic';c.fillStyle=ink;
   const label='NCC-1701',metrics=c.measureText(label),scale=(options.width||.20)/metrics.width;
   c.scale(scale,scale*(options.physicalAspect||1));
   c.fillText(label,0,(metrics.actualBoundingBoxAscent-metrics.actualBoundingBoxDescent)/2);
   c.restore();return;
  }
  const stencil=source.side,[bx,by,bw,bh]=stencil.bounds,width=options.width||.20,height=width*(options.physicalAspect||1)*bh/bw,a=options.angle||0;
  contours(c,stencil,p=>{const x=((p[0]-bx)/bw-.5)*width,y=((p[1]-by)/bh-.5)*height;return [options.x+x*Math.cos(a)-y*Math.sin(a),options.y+x*Math.sin(a)+y*Math.cos(a)];},ink);
 };
 window.drawEnterpriseReferencePaint=(c,kind,color,verticalScale=1)=>{
  const stencil=data()[kind];contours(c,stencil,p=>[p[0]/stencil.width,.51+(p[1]/stencil.height-.51)*verticalScale],color);
 };
})();

