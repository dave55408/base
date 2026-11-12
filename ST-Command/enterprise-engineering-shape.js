/* Shared engineering-hull silhouette and physical marking projection. */
window.EnterpriseEngineeringShape=(()=>{
 // Carry the cylinder forward to a small rounded shoulder; the separate
 // deflector collar projects from this face rather than continuing a taper.
 const profile=[[.147,-1.15],[.150,-1.145],[.151,-1.135],[.151,-1.08],[.151,-.94],[.147,-.75],[.135,-.48],[.113,-.24],[.104,-.07],[.102,0]];
 const upperProfile=[[.147,-1.15],[.150,-1.145],[.151,-1.135],[.151,-1.10],[.151,-.92],[.147,-.75],[.136,-.52],[.125,-.36],[.114,-.18],[.107,-.065],[.102,0]];
 const lowerProfile=[[.149,-1.15],[.152,-1.145],[.153,-1.135],[.153,-1.10],[.153,-.92],[.152,-.75],[.145,-.52],[.136,-.36],[.114,-.24],[.110,-.22],[.066,0]];
 const aftCutoutStart=-.22,lowerScale=1,bodyScale=.85;
 const smooth=v=>{const t=Math.max(0,Math.min(1,v));return t*t*t*(t*(t*6-15)+10);};
 function valueAt(points,z){
  for(let i=1;i<points.length;i++)if(z>=points[i-1][1]&&z<=points[i][1]){
   const [a,za]=points[i-1],[b,zb]=points[i];return a+(b-a)*(z-za)/(zb-za);
  }
  return z<points[0][1]?points[0][0]:points.at(-1)[0];
 }
 const radiusAt=z=>valueAt(profile,z),aftBaseDepth=hangarDoorProfile(.128/.162).bellyDepth;
 const upAt=(z,cross)=>Math.sqrt(Math.max(0,1-(cross/radiusAt(z))**2))*valueAt(upperProfile,z);
 function cutoutAt(z,cross,{start,radius,startDepth,startSlope,endDepth}){
  const t=Math.max(0,Math.min(1,(z-start)/-start)),x=Math.min(1,Math.abs(cross)/radius);
  // A single Bezier sweep joins the forward tangent to the level sill.
  // Its controls concentrate the rise forward without a short blend crease.
  let lo=0,hi=1;
  for(let i=0;i<24;i++){const s=(lo+hi)/2,q=1-s,along=3*q*q*s*.06+3*q*s*s*.18+s*s*s;if(along<t)lo=s;else hi=s;}
  const s=(lo+hi)/2,q=1-s,control=startDepth+startSlope*(-start)*.06;
  const depth=q*q*q*startDepth+3*q*q*s*control+(3*q*s*s+s*s*s)*endDepth;
  // Blend whole rounded sections over the full length; changing the power
  // abruptly produced a folded shoulder on each side of the old scoop.
  const blend=smooth(t),round=Math.sqrt(Math.max(0,1-x*x)),flat=Math.pow(Math.max(0,1-x**8),1/8);
  return depth*(round+(flat-round)*blend);
 }
 function smoothHullSeam(T,geometry,segments){
  const normals=geometry.attributes.normal;
  for(let a=0;a<normals.count;a+=segments+1){const b=a+segments,n=new T.Vector3().fromBufferAttribute(normals,a).add(new T.Vector3().fromBufferAttribute(normals,b)).normalize();normals.setXYZ(a,n.x,n.y,n.z);normals.setXYZ(b,n.x,n.y,n.z);}
  normals.needsUpdate=true;
 }
 function downAt(z,cross){
  const radius=radiusAt(z),x=Math.min(1,Math.abs(cross)/radius);
  if(z<aftCutoutStart)return Math.sqrt(Math.max(0,1-x*x))*valueAt(lowerProfile,z);
  return cutoutAt(z,cross,{start:aftCutoutStart,radius,startDepth:valueAt(lowerProfile,aftCutoutStart),startSlope:(valueAt(lowerProfile,aftCutoutStart)-valueAt(lowerProfile,aftCutoutStart-.001))/.001,endDepth:aftBaseDepth});
 }
 return {profile,aftCutoutStart,lowerScale,bodyScale,radiusAt,upAt,downAt,aftBaseDepth,cutoutAt,smoothHullSeam};
})();
