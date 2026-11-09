(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SpaceMath=api;})(globalThis,()=>{
  const rad=Math.PI/180;
  const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y,(b.z||0)-(a.z||0));
  const pitchTo=(a,b)=>Math.atan2((b.z||0)-(a.z||0),Math.hypot(b.x-a.x,b.y-a.y))/rad;
  function direction(heading,pitch){const h=heading*rad,p=pitch*rad;return {x:Math.sin(h)*Math.cos(p),y:-Math.cos(h)*Math.cos(p),z:Math.sin(p)};}
  function alignment(heading,pitch,bearing,targetPitch){const a=direction(heading,pitch),b=direction(bearing,targetPitch);return a.x*b.x+a.y*b.y+a.z*b.z;}
  function camera(width,height,yaw=-25,tilt=52,zoom=1){
    const a=yaw*rad,t=tilt*rad,c=Math.cos(a),s=Math.sin(a),ct=Math.cos(t),st=Math.sin(t),D=1900;
    const focal=D*Math.min(width/1250,height/920)*zoom,cx=width/2,cy=height*.53;
    function project(p){const dx=p.x-500,dy=p.y-450,z=p.z||0,x=dx*c-dy*s,y=dx*s+dy*c,depth=y*ct+z*st,up=-y*st+z*ct,k=focal/(D-depth);return {x:cx+x*k,y:cy-up*k,scale:k,depth};}
    function unproject(x,y,z=0){const nx=(x-cx)/focal,ny=-(y-cy)/focal,t=(z-D*st)/(ny*ct-st);if(t<=0||!Number.isFinite(t))return null;const xr=nx*t,up=ny*t,depth=D-t,yr=depth*ct-up*st;return {x:500+xr*c+yr*s,y:450-xr*s+yr*c,z};}
    return {project,unproject};
  }
  return {distance,pitchTo,direction,alignment,camera};
});
