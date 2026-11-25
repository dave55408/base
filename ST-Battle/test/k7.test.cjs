const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const B=require('../engine.js');

test('K7 component volumes leave arm gaps and overhead space open',()=>{
  const s=new B.Simulation(97,{turnBased:false}),k=s.station;
  assert.equal(k.pods.length,3);
  assert(s.stationTrace({x:k.x,y:k.y,z:k.z+400},{x:k.x,y:k.y,z:k.z-400}));
  assert.equal(s.stationTrace({x:k.x,y:k.y,z:k.z+180},{x:k.x,y:k.y,z:k.z+180}),null);
  assert.equal(s.stationTrace({x:k.x,y:k.y+350,z:k.z+400},{x:k.x,y:k.y+350,z:k.z-400}),null);
  for(const pod of k.pods)assert(s.stationTrace({x:k.x+pod.x,y:k.y,z:k.z+pod.z},{x:k.x+pod.x,y:k.y,z:k.z+pod.z}));
});

test('K7 blocks firing solutions without consuming resources',()=>{
  const s=new B.Simulation(97,{turnBased:false}),k=s.station;s.running=true;
  Object.assign(s.player,{x:k.x,y:k.y,z:k.z+600,heading:0,pitch:0});Object.assign(s.enemy,{x:k.x,y:k.y,z:k.z-600});
  for(const weapon of ['phaser','torpedo']){assert.equal(s.status(weapon),'K7 BLOCKING SHOT');assert.equal(s.fire(weapon),false);}
  assert.equal(s.lock,false);assert.equal(s.player.capacitor,100);assert.equal(s.player.torpedoes,24);assert.equal(s.enemy.hull,100);
});

test('ships deflect before K7 at slow impulse even when a movement segment crosses it',()=>{
  const s=new B.Simulation(97,{turnBased:false}),k=s.station;
  for(const ship of [s.player,s.enemy]){
    const from={x:k.x,y:k.y,z:k.z+500};Object.assign(ship,{x:k.x,y:k.y,z:k.z-500,speed:125,throttle:100});
    const normal=s.stationTrace(from,ship,45).normal;
    const incoming=B.direction(ship),entering=incoming.x*normal.x+incoming.y*normal.y+incoming.z*normal.z<0;
    s.moveAroundStation(ship,from);assert.equal(Math.abs(ship.speed),B.MIN_IMPULSE_SPEED);assert.equal(s.stationTrace(ship,ship,44),null);assert(ship.z>k.z);
    const d=B.direction(ship),outward=d.x*normal.x+d.y*normal.y+d.z*normal.z;
    if(entering)assert(outward>=0&&outward<.1,'K7 contacts slide along the hull with only a small outward deflection');
  }
  assert.equal(s.player.throttle,0);
});

test('traveling torpedoes hit K7 instead of the ship behind it',()=>{
  const s=new B.Simulation(97,{turnBased:false}),k=s.station;s.running=true;
  Object.assign(s.enemy,{x:k.x,y:k.y,z:k.z-300});s.aiShot=s.aiTorp=100;
  s.projectiles.push({id:'station-test',from:'Enterprise',target:'Yorktown',pos:{x:k.x,y:k.y,z:k.z+100},life:0,maxLife:8,strength:1,heading:0,pitch:0});
  for(let i=0;i<4;i++)s.tick(.1);
  assert.equal(s.projectiles.length,0);assert(s.events.some(e=>e.type==='station-impact'));assert.equal(s.enemy.hull,100);
});

test('Yorktown routes around K7 while pursuing',()=>{
  const s=new B.Simulation(97,{turnBased:false}),k=s.station;s.running=true;
  Object.assign(s.player,{x:k.x,y:k.y,z:k.z+700,heading:180});Object.assign(s.enemy,{x:k.x,y:k.y,z:k.z-700,heading:180});s.enemy.integrity.weapons=0;
  for(let i=0;i<900;i++)s.tick(.05);
  assert(s.enemy.z>k.z+100);assert(!s.events.some(e=>e.type==='station-collision'));
});

test('warp rejects an occupied destination without spending the charge',()=>{
  const s=new B.Simulation(97,{turnBased:false}),k=s.station;s.running=true;
  Object.assign(s.player,{x:k.x,y:k.y,z:k.z+3000,heading:0,pitch:0});
  assert.equal(s.warp(),false);assert.equal(s.warpUsed,false);assert.equal(s.player.z,k.z+3000);
  s.player.pitch=30;assert.equal(s.warp(),true);
});

test('K7 procedural model has finite geometry, three pod towers and batched windows',()=>{
  const drawing=new Proxy({}, {get:(object,key)=>object[key]??(()=>{}),set:(object,key,value)=>(object[key]=value,true)});
  const c={window:{},console,AbortController,document:{createElement:()=>({getContext:()=>drawing})}};vm.createContext(c);
  const root=path.join(__dirname,'..');for(const file of ['vendor/three.js','geometry.js','engine.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
  const s=Object.create(c.window.BattleScene.prototype);s.T=c.window.AlpineThree;s.sim=new c.Battle.Simulation();s.texture=()=>null;
  const station=s.makeStation();assert.equal(station.scale.x,1.4);assert.equal(s.sim.station.parts[0].rx,110*1.4);let batches=0,windows=0,meshes=0;
  station.traverse(o=>{if(o.geometry){meshes++;assert(o.geometry.attributes.position.array.every(Number.isFinite));}if(o.isInstancedMesh){batches++;windows+=o.count;assert(o.instanceMatrix.array.every(Number.isFinite));}});
  assert.equal(batches,4);assert.equal(windows,375);assert(meshes<80);assert.equal(station.position.x,s.sim.station.x);
  const T=s.T,matrix=new T.Object3D().matrix;
  assert.equal(station.userData.runningLights.length,3);
  const innerEdge=(lens,radial)=>{
    lens.updateWorldMatrix(true,false);const m=lens.matrixWorld.elements;
    const projection=(a,b,c)=>a*radial.x+b*radial.y+c*radial.z;
    const radius=lens.geometry.userData.recessedLightRadius;
    const reach=radius?radius*Math.hypot(projection(m[0],m[1],m[2]),projection(m[4],m[5],m[6])):Math.hypot(projection(m[0],m[1],m[2]),projection(m[4],m[5],m[6]),projection(m[8],m[9],m[10]));
    return projection(m[12],m[13],m[14])-reach;
  };
  station.userData.runningLights.forEach((lens,i)=>{
    const {x,z}=s.sim.station.pods[i],radial=new T.Vector3(x,0,z).normalize(),radius=Math.hypot(x*.17,z*.17);
    const original=new T.Group(),originalLens=new T.Mesh(new T.SphereGeometry(1,32,20),lens.material);originalLens.position.y=-1.05;originalLens.scale.set(2,1.4,2);original.add(originalLens);
    original.position.set(x*1.17,-52*.08*(52-radius)/(52*.25),z*1.17);original.quaternion.copy(lens.parent.quaternion);station.add(original);
    assert.equal(lens.parent.scale.x,.5);assert.equal(lens.material.color.getHex(),0xffedcd);
    assert(Math.abs(innerEdge(lens,radial)-innerEdge(originalLens,radial))<1e-8,'halving each lamp keeps its inward lens edge fixed');
    station.remove(original);
    assert.equal(lens.parent.children.length,1,'only the recessed lens remains, with no housing');
    assert(lens.position.y>0,'the light sits inward of the hull surface');
    station.updateMatrixWorld(true);
    const center=lens.getWorldPosition(new T.Vector3()),outward=new T.Vector3(0,-1,0).applyQuaternion(lens.parent.quaternion);
    const target={updateMatrixWorld:()=>station.updateMatrixWorld(true),userData:{model:station}};
    const hit=s.traceHull(target,center.clone().addScaledVector(outward,5),center.clone().addScaledVector(outward,-1));
    assert.equal(hit?.mesh,lens,'the cut aperture exposes the inset light instead of covering it with hull plating');
  });
  station.traverse(batch=>{
    if(!batch.isInstancedMesh)return;
    assert.equal(batch.geometry.type,'PlaneGeometry');assert.equal(batch.material.polygonOffset,true);
    const tower=batch.userData.hull,profile=tower.geometry.parameters,r=profile.radiusBottom,h=profile.height,vertices=batch.geometry.attributes.position.array;
    for(let i=0;i<batch.count;i++){
      batch.getMatrixAt(i,matrix);const angle=Math.atan2(matrix.elements[12]-tower.position.x,matrix.elements[14]-tower.position.z);
      for(let j=0;j<vertices.length;j+=3){
        const p=new T.Vector3(vertices[j],vertices[j+1],vertices[j+2]).applyMatrix4(matrix),height=(p.y-tower.position.y)/h+.5;
        const radius=(r+(profile.radiusTop-r)*height)*Math.cos(Math.PI/40),projection=(p.x-tower.position.x)*Math.sin(angle)+(p.z-tower.position.z)*Math.cos(angle);
        assert(Math.abs(projection-radius)<1e-4,'every window corner lies flush on its tower facet');
      }
    }
  });
  const body=station.children.find(part=>part.geometry instanceof T.LatheGeometry),originalMaterial=body.material;
  const windowBatches=station.children.filter(part=>part.isInstancedMesh),seams=station.children.filter(part=>part.isLineSegments);
  s.station=station;s.mode='tactical';s.updateStationDetail();
  assert.notEqual(body.material,originalMaterial);assert.equal(body.material.map,null);assert.equal(body.material.roughness,.95);
  assert(windowBatches.every(part=>!part.visible));assert(seams.every(part=>!part.visible));
  assert(station.userData.runningLights.every(lens=>!lens.parent.visible));
  s.setCamera('chase');assert.equal(body.material,originalMaterial);
  assert(windowBatches.every(part=>part.visible));assert(seams.every(part=>part.visible));
  assert(station.userData.runningLights.every(lens=>lens.parent.visible));
  s.setCamera('tactical');s.sim.replayShot={};s.updateStationDetail();
  assert.equal(body.material,originalMaterial,'cinematic replays retain the detailed station');
});
