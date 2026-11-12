/* Arrival flyby staged from enterorbit.mp4 (7.766633 s), with wider starfield. */
(() => {
 const fade=.65,clipDuration=7.766633,total=clipDuration+fade*2;
 // Screen-space path: center X/Y and width in the reference frame.
 // Enter overhead, recede beside the planet, then hold the viewscreen center.
 const poses=[
  [0,.48,-4,1.8],[.65,.50,-.60,1.55],[1.3,.54,-.02,1.20],
  [2.2,.57,.28,.85],[3.5,.55,.45,.55],[5,.51,.50,.37],
  [6.3,.50,.50,.32],[7.766633,.50,.50,.32]
 ];
 let seed=1701;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const stars=Array.from({length:1500},()=>({x:random(),y:random(),alpha:.2+random()*.65,size:.5+random()*1.1,blue:random()>.8}));
 const overlay=document.querySelector('.view-overlay');
 function start(){
  const source=window.STCommand?.games[0]?.canvas,previous=document.createElement('canvas');
  if(source){previous.width=source.width;previous.height=source.height;previous.getContext('2d').drawImage(source,0,0);}
  return {elapsed:0,total,previous};
 }
 function sync(m){
  const a=m.phase==='orbit'?m.orbitArrival:null;
  overlay.style.opacity=!a?'1':a.elapsed<fade?String(1-a.elapsed/fade):a.elapsed>=fade+clipDuration?String(Math.min(1,(a.elapsed-fade-clipDuration)/fade)):'0';
 }
 function black(ctx,w,h,amount){if(amount<=0)return;ctx.save();ctx.globalAlpha=Math.min(1,amount);ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);ctx.restore();}
 function actor(scene){
  const ship=EnterpriseModels.rendererFor(scene);if(scene.orbitActor?.ship===ship)return scene.orbitActor;
  const T=AlpineThree,min=new T.Vector3(Infinity,Infinity,Infinity),max=new T.Vector3(-Infinity,-Infinity,-Infinity),v=new T.Vector3(),corners=[];
  ship.model.updateWorldMatrix(true,true);ship.model.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);for(const axis of ['x','y','z']){min[axis]=Math.min(min[axis],v[axis]);max[axis]=Math.max(max[axis],v[axis]);}}});
  const center=min.clone().add(max).multiplyScalar(.5);
  for(const x of [min.x,max.x])for(const y of [min.y,max.y])for(const z of [min.z,max.z])corners.push(new T.Vector3(x,y,z));
  return scene.orbitActor={ship,center,corners,radius:max.clone().sub(min).length()/2,camera:new T.PerspectiveCamera(35,1,.001,1000),sink:document.createElement('canvas').getContext('2d'),renders:0};
 }
 function drawShip(ctx,w,h,time,scene,refW,refH,ox,oy){
  const a=actor(scene),{ship,camera,center,corners}=a,T=AlpineThree,[cx,cy,width]=pose(time),progress=Math.min(1,time/6.3);
  // Move a real perspective camera around the unchanged, full-detail model.
  // Distance supplies recession; the projection offset supplies the flight path.
  const direction=new T.Vector3(2.4-progress*.9,-.60+progress*.30,2.7+progress*.7).normalize();
  camera.clearViewOffset();camera.aspect=w/h;camera.fov=2*Math.atan(Math.tan(35*Math.PI/360)*refH/h)*180/Math.PI;camera.updateProjectionMatrix();
  function position(distance){camera.position.copy(center).addScaledVector(direction,distance);camera.up.set(0,1,0);camera.lookAt(center);camera.updateWorldMatrix(true,false);return corners.map(p=>p.clone().project(camera));}
  let near=a.radius*1.05,far=200,projected;
  for(let i=0;i<28;i++){const distance=(near+far)/2;projected=position(distance);const span=(Math.max(...projected.map(p=>p.x))-Math.min(...projected.map(p=>p.x)))*w/2;if(span>width*refW)near=distance;else far=distance;}
  projected=position(far);const midX=(Math.max(...projected.map(p=>p.x))+Math.min(...projected.map(p=>p.x)))/2,midY=(Math.max(...projected.map(p=>p.y))+Math.min(...projected.map(p=>p.y)))/2;
  const targetX=2*(ox+cx*refW)/w-1,targetY=1-2*(oy+cy*refH)/h;
  camera.setViewOffset(w,h,(midX-targetX)*w/2,(targetY-midY)*h/2,w,h);
  ship.draw(a.sink,w,h,{x:2.4,y:2.7,z:109.65,phase:'bridge',bank:0},{heading:0,pitch:0,time,bayDoorOpen:0});
  ship.renderer.render(ship.scene,camera);ctx.drawImage(ship.renderer.domElement,0,0,w,h);a.renders++;
  projected=corners.map(p=>p.clone().project(camera));const xs=projected.map(p=>(p.x+1)*w/2),ys=projected.map(p=>(1-p.y)*h/2);
  return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
 }
 function pose(time){
  let i=0;while(i<poses.length-2&&time>poses[i+1][0])i++;
  const a=poses[i],b=poses[i+1],t=Math.max(0,Math.min(1,(time-a[0])/(b[0]-a[0])));
  function tangent(index,column){
   if(index===0)return (poses[1][column]-poses[0][column])/(poses[1][0]-poses[0][0]);
   if(index===poses.length-1)return (poses[index][column]-poses[index-1][column])/(poses[index][0]-poses[index-1][0]);
   const previous=poses[index-1],current=poses[index],next=poses[index+1],before=current[0]-previous[0],after=next[0]-current[0],d0=(current[column]-previous[column])/before,d1=(next[column]-current[column])/after;
   if(d0*d1<=0)return 0;const w0=2*after+before,w1=after+2*before;return (w0+w1)/(w0/d0+w1/d1);
  }
  const span=b[0]-a[0],t2=t*t,t3=t2*t;
  return a.slice(1).map((v,j)=>(2*t3-3*t2+1)*v+(t3-2*t2+t)*span*tangent(i,j+1)+(-2*t3+3*t2)*b[j+1]+(t3-t2)*span*tangent(i+1,j+1));
 }
 function render(ctx,w,h,m,s,scene){
  const a=m.orbitArrival;if(m.phase!=='orbit'||!a)return false;
  if(a.elapsed<fade){ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);if(a.previous.width)ctx.drawImage(a.previous,0,0,w,h);black(ctx,w,h,a.elapsed/fade);scene.orbitArrivalTelemetry={stage:'fade-out',elapsed:a.elapsed};return true;}
  if(a.elapsed>=fade+clipDuration)return false;
  const time=a.elapsed-fade,refH=Math.min(h,w*9/16),refW=refH*16/9,ox=(w-refW)/2,oy=(h-refH)/2;
  ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
  for(const star of stars){ctx.globalAlpha=star.alpha;ctx.fillStyle=star.blue?'#9db5cb':'#d9dedb';ctx.fillRect(star.x*w,star.y*h,star.size,star.size);}ctx.globalAlpha=1;
  scene.detailedPlanet??=createDetailedPlanet();const planet={cx:ox+refW*.21,cy:oy+refH*.93,radius:refH*.65};
  scene.detailedPlanet.drawGlobe(ctx,w,h,time,m.planet.color,planet);
  const rect=drawShip(ctx,w,h,time,scene,refW,refH,ox,oy);
  black(ctx,w,h,Math.max(1-time/fade,(time-(clipDuration-fade))/fade,0));
  scene.orbitArrivalTelemetry={stage:'flyby',elapsed:a.elapsed,time,planet,ship:rect,liveModel:true,modelScale:scene.orbitActor.ship.model.scale.toArray(),cameraPosition:scene.orbitActor.camera.position.toArray(),sideSpace:ox,referenceAspect:16/9,planetColor:m.planet.color};return true;
 }
 function finish(ctx,w,h,m,scene){const a=m.orbitArrival;if(m.phase==='orbit'&&a&&a.elapsed>=fade+clipDuration){black(ctx,w,h,1-(a.elapsed-fade-clipDuration)/fade);scene.orbitArrivalTelemetry={stage:'cockpit-fade-in',elapsed:a.elapsed};}}
 window.OrbitArrival={start,sync,render,finish,total,clipDuration};
})();
