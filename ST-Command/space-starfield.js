/* Fixed world-space stars shared by the shuttle and bridge forward views. */
(()=>{
 let seed=1701;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const stars=Array.from({length:3000},()=>({x:random()*120,y:random()*120,z:random()*120,size:.6+random()*.9}));
 const clamp=v=>Math.max(0,Math.min(1,v));
 let softStar;
 function starSprite(){
  if(softStar)return softStar;
  softStar=document.createElement('canvas');softStar.width=softStar.height=64;
  const c=softStar.getContext('2d'),gradient=c.createRadialGradient(32,32,0,32,32,32);
  for(const [stop,alpha]of [[0,1],[.35,.75],[.7,.15],[1,0]])gradient.addColorStop(stop,'rgba(210,231,255,'+alpha+')');
  c.fillStyle=gradient;c.fillRect(0,0,64,64);return softStar;
 }
 function draw(c,w,h,{origin,forward,right,up,zoom=1,soft=false}){
  const relative=(p,o)=>((p-o+60)%120+120)%120-60,focal=w*.65*zoom;
  c.save();c.fillStyle='#d2e7ff';
  for(const star of stars){
   const dx=relative(star.x,origin.x),dy=relative(star.y,origin.y),dz=relative(star.z,origin.z);
   const depth=dx*forward.x+dy*forward.y+dz*forward.z;if(depth<=.1)continue;
   const x=w/2+(dx*right.x+dy*right.y+dz*right.z)/depth*focal,y=h/2-(dx*up.x+dy*up.y+dz*up.z)/depth*focal;
   if(x<0||x>w||y<0||y>h)continue;
   c.globalAlpha=clamp((60-Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dz)))/12)*clamp((depth-.5)/2);
   if(soft){
    // Spread each point across neighboring pixels at constant total brightness.
    // Subpixel travel then changes smoothly instead of making tiny stars sparkle.
    const diameter=Math.max(3,star.size*3);
    c.globalAlpha*=star.size*star.size/(diameter*diameter*.22);
    c.drawImage(starSprite(),x+star.size/2-diameter/2,y+star.size/2-diameter/2,diameter,diameter);
   }else c.fillRect(x,y,star.size,star.size);
  }
  c.restore();
 }
 function pose(origin,heading=0,pitch=0,roll=0){
  const h=heading*Math.PI/180,p=pitch*Math.PI/180,ch=Math.cos(h),sh=Math.sin(h),cp=Math.cos(p),sp=Math.sin(p),cr=Math.cos(roll),sr=Math.sin(roll);
  const right={x:ch,y:sh,z:0},up={x:-sh*sp,y:ch*sp,z:cp};
  return {origin,forward:{x:sh*cp,y:-ch*cp,z:sp},right:{x:right.x*cr-up.x*sr,y:right.y*cr-up.y*sr,z:-up.z*sr},up:{x:up.x*cr+right.x*sr,y:up.y*cr+right.y*sr,z:up.z*cr}};
 }
 window.SpaceStarfield={draw,pose};
})();
