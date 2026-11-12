const assert=require('node:assert/strict');global.window=global;
require('./vendor/alpine-three.js');require('./hangar-door-frame.js');
function closedSurface(geometry){
 const p=geometry.attributes.position,index=geometry.index,edges=new Map();
 const vertex=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e7)).join(',');
 for(let i=0;i<(index?index.count:p.count);i+=3){const triangle=[0,1,2].map(j=>vertex(index?index.getX(i+j):i+j));for(let j=0;j<3;j++){const key=[triangle[j],triangle[(j+1)%3]].sort().join('/');edges.set(key,(edges.get(key)||0)+1);}}
 assert([...edges.values()].every(count=>count===2),'every welded edge belongs to two faces: no holes in the solid surround');
}
for(const scaleY of [1,.128/.162]){
 const frame=createHangarDoorFrameGeometry(AlpineThree,{scaleY,flatBelly:scaleY!==1}),profile=frame.rim.userData.doorFrame;
 for(let i=0;i<profile.inner.length;i++){
  const a=profile.inner[i],b=profile.outer[i],width=Math.hypot(b[0]-a[0],(b[1]-a[1])*scaleY);
  if(a[1]>=profile.cy-1e-8)assert(Math.abs(width-.010)<1e-9,'arch retains its narrow consistent border');
  else assert(width>=.010-1e-8&&width<=profile.baseThickness+1e-8,'lower corners blend into the thick base');
  if(a[1]>profile.cy+1e-7)assert(Math.abs((a[0]/profile.rx)**2+((a[1]-profile.cy)/profile.ry)**2-1)<1e-8,'arch follows the clamshell door ellipse');
 }
 assert(Math.abs(Math.min(...profile.inner.map(p=>p[1]))+.04645)<1e-8,'opening meets the deck');
 assert.equal(profile.baseThickness,.024);
 assert(Math.abs(Math.min(...profile.outer.map(p=>p[1]))-(-.04645-profile.baseThickness/scaleY))<1e-8,'base has the reference thickness beneath the deck');
 assert(Math.abs(profile.floor*scaleY+.102*(1-scaleY)-profile.baseThickness+profile.bellyDepth)<1e-8,'underside meets the base without a sloped extra apron');
 assert.equal(profile.ry,.112);
 const p=frame.rim.attributes.position;for(let i=0;i<profile.inner.length;i++)assert(Math.abs(p.getZ(386+i)-profile.roofFront)<1e-8,'whole ring stays upright behind the clamshell');
 assert(profile.roofFront<profile.hingeDepth,'ring clears the dome at the crown');
 assert(Math.abs(profile.sideCut[0]-.0325)<1e-6&&profile.sideCut[48]<.005&&profile.sideCut[96]<1e-8,'brim projects half as far while preserving its curved fringe');
 const beacon=createHangarRoofBeacon(AlpineThree,scaleY),dome=beacon.getObjectByName('shuttle-bay-green-light');assert.equal(dome.geometry.parameters.thetaLength,Math.PI/2);assert(dome.material.emissiveIntensity>0);assert((beacon.position.y+dome.position.y)*scaleY+.102*(1-scaleY)>.102,'dome light sits on top of the roof');
 closedSurface(frame.rim);closedSurface(frame.seal);closedSurface(frame.base);
}
console.log('Passed: narrow door arch, thick reference base, supported floor return, planar front face and watertight surround on both models.');
