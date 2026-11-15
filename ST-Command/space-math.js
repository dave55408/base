(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SpaceMath=api;})(globalThis,()=>{
  const rad=Math.PI/180;
  const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y,(b.z||0)-(a.z||0));
  const pitchTo=(a,b)=>Math.atan2((b.z||0)-(a.z||0),Math.hypot(b.x-a.x,b.y-a.y))/rad;
  function direction(heading,pitch){const h=heading*rad,p=pitch*rad;return {x:Math.sin(h)*Math.cos(p),y:-Math.cos(h)*Math.cos(p),z:Math.sin(p)};}
  function alignment(heading,pitch,bearing,targetPitch){const a=direction(heading,pitch),b=direction(bearing,targetPitch);return a.x*b.x+a.y*b.y+a.z*b.z;}
  // Pitch about the craft's right wing, including when banked or inverted.
  // Resolve back to heading/elevation/roll without imposing a vertical stop.
  function pitchAttitude(heading,pitch,roll,delta){
    if(!delta)return {heading,pitch,roll};
    const h=heading*rad,p=pitch*rad,a=delta*rad,cb=Math.cos(roll),sb=Math.sin(roll);
    const forward=direction(heading,pitch);
    const up={x:-Math.sin(h)*Math.sin(p)*cb+Math.cos(h)*sb,y:Math.cos(h)*Math.sin(p)*cb+Math.sin(h)*sb,z:Math.cos(p)*cb};
    const nose={},top={};
    for(const axis of ['x','y','z']){
      nose[axis]=forward[axis]*Math.cos(a)+up[axis]*Math.sin(a);
      top[axis]=up[axis]*Math.cos(a)-forward[axis]*Math.sin(a);
    }
    const horizontal=Math.hypot(nose.x,nose.y);
    const nextHeading=horizontal<1e-10?heading:(Math.atan2(nose.x,-nose.y)/rad+360)%360;
    const nextPitch=Math.atan2(nose.z,horizontal)/rad,nh=nextHeading*rad,np=nextPitch*rad;
    const nextRoll=Math.atan2(top.x*Math.cos(nh)+top.y*Math.sin(nh),-top.x*Math.sin(nh)*Math.sin(np)+top.y*Math.cos(nh)*Math.sin(np)+top.z*Math.cos(np));
    return {heading:nextHeading,pitch:nextPitch,roll:nextRoll};
  }
  // Shared helm acceleration: ease from 20% to full rate over .65 seconds.
  // Releasing or reversing a command starts the next ramp from the beginning.
  function rampedInput(memory,axis,input,dt){
    if(!(dt>0))return 0;
    const prior=memory[axis+'Input'],held=prior===input?(memory[axis+'Held']||0):0;
    memory[axis+'Input']=input;memory[axis+'Held']=input?Math.min(.65,held+dt):0;
    if(!input)return 0;
    const t=Math.min(1,(held+dt/2)/.65);return input*(.2+.8*t*t*(3-2*t));
  }
  // Preserve forward helm response, but never flip momentum across zero.
  // Negative thrust brakes first, then ramps up astern once stopped.
  function poweredSpeed(current,power,fullSpeed,dt){
    if(!(dt>0))return current;
    if(power===0)return 0;
    const target=Math.max(-100,Math.min(100,power))/100*fullSpeed;
    const step=Math.abs(target)*2*dt;
    if(current*target<0)return Math.sign(current)*Math.max(0,Math.abs(current)-step);
    if(target<0)return current+Math.max(-step,Math.min(step,target-current));
    return target;
  }
  function camera(width,height,yaw=-25,tilt=52,zoom=1){
    const a=yaw*rad,t=tilt*rad,c=Math.cos(a),s=Math.sin(a),ct=Math.cos(t),st=Math.sin(t),D=1900;
    const focal=D*Math.min(width/1250,height/920)*zoom,cx=width/2,cy=height*.53;
    function project(p){const dx=p.x-500,dy=p.y-450,z=p.z||0,x=dx*c-dy*s,y=dx*s+dy*c,depth=y*ct+z*st,up=-y*st+z*ct,k=focal/(D-depth);return {x:cx+x*k,y:cy-up*k,scale:k,depth};}
    function unproject(x,y,z=0){const nx=(x-cx)/focal,ny=-(y-cy)/focal,t=(z-D*st)/(ny*ct-st);if(t<=0||!Number.isFinite(t))return null;const xr=nx*t,up=ny*t,depth=D-t,yr=depth*ct-up*st;return {x:500+xr*c+yr*s,y:450-xr*s+yr*c,z};}
    return {project,unproject};
  }
  return {distance,pitchTo,direction,alignment,pitchAttitude,rampedInput,poweredSpeed,camera};
});
