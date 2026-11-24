const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const B=require('../engine.js');

test('weaker shields deplete sooner and penetrating hits heavily damage internal systems',()=>{
  for(const [weapon,remaining] of [['phaser',44],['torpedo',61]]){
    const s=new B.Simulation(),p=s.player,e=s.enemy,arc=B.facing(e,p);
    s.random=()=>.5;s.damage(e,p,20,weapon,'weapons');assert.equal(e.shields[arc],remaining);assert.equal(e.hull,100);
    e.shields[arc]=0;s.damage(e,p,40,weapon,'weapons');
    const impact=s.events.filter(e=>e.type==='impact').at(-1);
    assert(impact.hullDamage>0);
    const internalLoss=Object.values(e.integrity).reduce((sum,value)=>sum+100-value,0);
    assert(Math.abs(internalLoss-impact.hullDamage*1.44)<1e-8);
    assert(Math.abs((100-e.reactor)-impact.hullDamage*.096)<1e-8);
  }
});

test('both ship models have invisible shields, hull contact flashes and scars only for penetrating damage',()=>{
  const drawing=new Proxy({}, {get:()=>()=>{}}),c={window:{},Battle:B,console,AbortController,document:{createElement:()=>({getContext:()=>drawing})}};
  vm.createContext(c);for(const file of ['vendor/three.js','geometry.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const T=c.window.AlpineThree,s=Object.create(c.window.BattleScene.prototype);s.T=T;s.texture=()=>({});s.burst=()=>{};
  s.ships={Enterprise:s.makeShip('Enterprise','NCC-1701',false),Yorktown:s.makeShip('Yorktown','NCC-1717',true)};
  s.ships.Enterprise.position.set(0,200,0);s.ships.Yorktown.position.set(300,0,0);
  s.sim={player:{x:0,y:200,z:0},enemy:{x:300,y:0,z:0}};
  for(const name of ['Enterprise','Yorktown']){
    const ship=s.ships[name];assert.equal(ship.userData.shield,undefined);assert.equal(ship.userData.shell,undefined);assert(ship.children.every(child=>child===ship.userData.model),'no protective sphere exists outside the hull model');
    const emitters=ship.userData.phaserEmitters;assert.equal(emitters.length,2);
    const hullMaterial=[].concat(ship.userData.engineeringHull.material).find(material=>material.map);
    for(const emitter of emitters){
      emitter.geometry.computeBoundingSphere();assert(Math.abs(emitter.geometry.boundingSphere.radius-.012)<1e-6,'nubs have half their previous radius');
      assert.equal(emitter.material.color.getHex(),hullMaterial.color.getHex());
      assert.equal(emitter.material.map,hullMaterial.map);assert.equal(emitter.material.metalness,hullMaterial.metalness);assert.equal(emitter.material.roughness,hullMaterial.roughness);
    }
    assert.equal(emitters[0].parent,ship.userData.saucer);assert.equal(emitters[1].parent,ship.userData.engineeringHull);
    ship.updateMatrixWorld(true);
    for(const [index,aft] of [false,true].entries()){
      const center=ship.userData.model.worldToLocal(emitters[index].getWorldPosition(new T.Vector3())),origin=s.phaserEmitter({aft,ship});
      assert(Math.abs(center.x-origin.x)<1e-6&&Math.abs(center.z-origin.z)<1e-6,'beam aligns with its visible nub');
      assert(Math.abs(center.y-origin.y)<.031);
    }
    s.addPhaserEmitters(ship);assert.equal(ship.userData.phaserEmitters.length,2);
    let contact;s.burst=position=>{contact=position.clone();};
    const hit={point:{x:0,y:.265,z:-1.65},normal:{x:0,y:-1,z:0}};
    s.event({type:'impact',ship:name,weapon:'phaser',hullDamage:0,shieldDepleted:false,hit});
    assert.equal(ship.userData.scars.length,0,'an absorbed hit leaves no hull damage');
    assert(contact.distanceTo(ship.userData.model.localToWorld(new T.Vector3(0,.265,-1.65)))<1e-8,'shield-absorbed impacts still reach the hull contact point');
    assert.equal(ship.userData.windows.length,14);assert(ship.userData.windows.slice(0,6).every(window=>window.position.z<-1.7));
    assert.equal(ship.userData.lowerHullWindows.length,8);
    assert.equal(ship.userData.lowerHullWindows.filter(window=>window.position.x<0).length,4);
    assert.equal(ship.userData.lowerHullWindows.filter(window=>window.position.x>0).length,4);
    assert(ship.userData.lowerHullWindows.every(window=>window.parent===ship.userData.breakupParts[1]));
    s.event({type:'impact',ship:name,weapon:'torpedo',hullDamage:4,shieldDepleted:true});
    assert.equal(ship.userData.scars.length,1);assert.equal(ship.userData.scars[0].parent,ship.userData.saucer);
    const layers=ship.userData.scars[0].children;assert.equal(layers.length,3);assert(layers[2].material.opacity>.9);
    assert.equal(layers[2].material.color.getHex(),0x010101,'damage center is charred black');
    assert(layers[1].material.userData.damageEmbers,'the burn edge has glowing embers');assert.equal(layers[1].material.toneMapped,false,'embers stay luminous under dark lighting');
    assert.equal(layers[1].geometry.attributes.scarPoint.count,layers[1].geometry.attributes.position.count,'ember pattern follows the wrapped hull geometry');
    assert.equal(layers[1].material.uniforms.scarPlanes.value.length,26);
    for(const layer of layers)assert(layer.geometry.attributes.position.array.every(Number.isFinite));
  }
});

test('saucer phasers, actual hull intersections, scorch marks and subsystem damage share a hit location',()=>{
  const drawing=new Proxy({}, {get:()=>()=>{}}),c={window:{},Battle:B,console,AbortController,document:{createElement:()=>({getContext:()=>drawing})}};
  vm.createContext(c);for(const file of ['vendor/three.js','geometry.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const T=c.window.AlpineThree,scene=Object.create(c.window.BattleScene.prototype),sim=new B.Simulation(97,{turnBased:false});
  scene.T=T;scene.texture=()=>({});scene.burst=()=>{};scene.sim=sim;
  scene.ships={Enterprise:scene.makeShip('Enterprise','NCC-1701',false),Yorktown:scene.makeShip('Yorktown','NCC-1717',true)};
  Object.assign(sim.player,{x:2000,y:200,z:0,heading:0});Object.assign(sim.enemy,{x:2000,y:0,z:-800,heading:180,pitch:12,bank:.2});
  sim.resolveWeaponHit=(...args)=>scene.resolveWeaponHit(...args);sim.running=true;
  for(const sector of B.arcs)sim.enemy.shields[sector]=0;
  assert(sim.fire('phaser'));
  const beam=sim.events.find(e=>e.type==='beam'),impact=sim.events.find(e=>e.type==='impact');
  assert(beam.hit,'beam resolves an actual hull triangle');assert.equal(beam.hit,impact.hit);assert.equal(impact.system,beam.hit.component);
  assert.equal(beam.hit.emitter.x,0);assert.equal(beam.hit.emitter.y,.265);assert.equal(beam.hit.emitter.z,-1.65);
  const endpoints=scene.weaponEndpoints('Enterprise','Yorktown',beam.hit),hitAgain=scene.traceHull(scene.ships.Yorktown,endpoints.start,endpoints.end);
  assert(hitAgain);assert(hitAgain.point.distanceTo(endpoints.end)<.001);
  scene.event(impact);const scar=scene.ships.Yorktown.userData.scars[0];
  assert(scene.ships.Yorktown.userData.breakupParts.includes(scar.parent),'scorch travels with the struck hull piece');
  assert(scar.getWorldPosition(new T.Vector3()).distanceTo(endpoints.end)<.2,'scorch is at the beam endpoint');
  const localPoint=scene.ships.Yorktown.userData.model.worldToLocal(endpoints.end.clone());
  scene.ships.Yorktown.position.add(new T.Vector3(200,50,-100));scene.ships.Yorktown.rotation.y+=.6;scene.ships.Yorktown.updateMatrixWorld(true);
  const moved=scene.weaponEndpoints('Enterprise','Yorktown',beam.hit).end;
  assert(moved.distanceTo(scene.ships.Yorktown.userData.model.localToWorld(localPoint))<.001,'beam and damage follow the hull as the target turns');
  for(const [shooter,target] of [[sim.player,sim.enemy],[sim.enemy,sim.player]])for(const aim of ['hull','bridge','sensors','weapons','mainEngines','engines','reactor','shields']){
    const hit=scene.resolveWeaponHit(shooter,target,aim);
    assert(hit,`${shooter.name} resolves a hull contact for ${aim}`);
    assert.equal(hit.emitter.x,0);assert.equal(hit.emitter.y,.265);assert.equal(hit.emitter.z,-1.65,'both ships use the front underside centerline emitter for every target');
    assert(Object.values(hit.point).every(Number.isFinite));
    assert(Math.abs(Math.hypot(hit.normal.x,hit.normal.y,hit.normal.z)-1)<1e-6);
  }
  Object.assign(sim.enemy,{heading:0,pitch:0,bank:0});Object.assign(sim.player,{y:0});
  const aftHit=scene.resolveWeaponHit(sim.enemy,sim.player,'hull');
  assert(aftHit);assert(aftHit.emitter.z>0&&aftHit.emitter.z<.49,'Yorktown aft phasers originate on the rear lower hull');assert(aftHit.emitter.y>.02&&aftHit.emitter.y<.2,'aft beam starts on top of the engineering hull');
  const aftEndpoints=scene.weaponEndpoints('Yorktown','Enterprise',aftHit);
  assert(aftEndpoints.start.z>sim.enemy.z);assert(aftEndpoints.end.z>aftEndpoints.start.z);
  sim.turnBased=true;sim.turn.maneuver='close';sim.turn.phase='approach';sim.player.heading=180;
  const closeHit=scene.resolveWeaponHit(sim.player,sim.enemy,'hull');
  assert(closeHit);assert(closeHit.emitter.z>0&&closeHit.emitter.z<.49,'Enterprise uses the rear engineering-hull emitter during Close battle');assert(closeHit.emitter.y>.02&&closeHit.emitter.y<.2);
  sim.turnBased=false;sim.player.heading=0;
  const target=sim.enemy;
  assert.equal(scene.resolveWeaponHit(sim.player,target,'hull','torpedo',{x:target.x+200,y:target.y,z:target.z+100},{x:target.x+200,y:target.y,z:target.z-100}),undefined,'a straight torpedo segment missing the hull cannot redirect to its selected target');
});

test('a destroyed ship breaks into independent hull, pylon and nacelle pieces without damaging the reusable model',()=>{
  const drawing=new Proxy({}, {get:()=>()=>{}}),c={window:{},Battle:B,console,AbortController,document:{createElement:()=>({getContext:()=>drawing})}};
  vm.createContext(c);for(const file of ['vendor/three.js','geometry.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const T=c.window.AlpineThree;
  for(const name of ['Enterprise','Yorktown']){
    const scene=Object.create(c.window.BattleScene.prototype);scene.T=T;scene.texture=()=>({});scene.burst=()=>{};scene.effects=[];scene.scene=new T.Scene();scene.sim=new B.Simulation();
    scene.ships={Enterprise:scene.makeShip('Enterprise','NCC-1701',false),Yorktown:scene.makeShip('Yorktown','NCC-1717',true)};
    scene.breakApart(name);const pieces=scene.effects.filter(effect=>effect.kind==='debris');assert(pieces.length>=25);assert.equal(scene.ships[name].visible,false);
    const saucer=pieces[0],original=scene.ships[name].userData.saucer;assert.notEqual(saucer.object.geometry,original.geometry);assert.notEqual(saucer.object.material,original.material);
    assert.equal(B.DESTRUCTION_DURATION,5,'wreckage keeps animating for five seconds');
    assert(pieces.every(piece=>piece.max>B.DESTRUCTION_DURATION),'wreckage survives the entire animation');
    const start=saucer.object.position.clone();scene.advanceDebris(saucer,.5);assert(saucer.object.position.distanceTo(start)>5);
    const halfway=saucer.object.position.clone();scene.advanceDebris(saucer,4.5);assert(saucer.object.position.distanceTo(halfway)>45,'pieces continue drifting through the fifth second');
    const count=scene.effects.length;scene.breakApart(name);assert.equal(scene.effects.length,count,'destruction event cannot duplicate debris');
    assert.equal(scene.effects.find(effect=>effect.kind==='detonations').centers.length,4);
  }
});


test('impact burns wrap engine curvature and remain on their moving hull piece',()=>{
  const c={window:{},console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const T=c.window.AlpineThree,scene=Object.create(c.window.BattleScene.prototype);scene.T=T;
  const ship=new T.Group(),model=new T.Group();ship.add(model);
  const tube=new T.Mesh(new T.CylinderGeometry(.1,.1,1,64),new T.MeshStandardMaterial({color:0xbbc6bf}));model.add(tube);
  ship.userData={model,breakupParts:[tube],scars:[]};
  scene.addImpactScar(ship,'torpedo',{point:{x:.1,y:0,z:0},normal:{x:1,y:0,z:0}});
  const scar=ship.userData.scars[0];assert.equal(scar.parent,tube);assert.equal(scar.children.length,3);
  const points=[];for(const layer of scar.children){
    const positions=layer.geometry.attributes.position;
    for(let i=0;i<positions.count;i++)points.push(new T.Vector3().fromBufferAttribute(positions,i).add(scar.position));
  }
  assert(points.some(p=>p.x<.06&&Math.abs(p.z)>.08),'burn curves around the side of the tube');
  assert(points.every(p=>Math.abs(Math.hypot(p.x,p.z)-.1)<.0015),'every burn vertex hugs the cylinder, without a floating plane');
  const before=scar.getWorldPosition(new T.Vector3());tube.position.set(2,3,4);tube.rotation.z=.6;ship.updateMatrixWorld(true);
  assert(scar.getWorldPosition(new T.Vector3()).distanceTo(before)>4,'damage follows hull motion');
  const fragment=tube.clone(true);assert(fragment.children.some(child=>child.userData.scorch),'breakup clones retain the wrapped damage');
  const ember=fragment.children.find(child=>child.userData.scorch).children[1].material;
  const time=ember.uniforms.emberTime.value;scene.advanceDebris({object:fragment,velocity:new T.Vector3(),spin:new T.Vector3()},.5);assert.equal(ember.uniforms.emberTime.value,time+.5,'embers keep flickering on detached wreckage');
  scene.disposeScar(scar);assert.equal(tube.children.length,0,'cleanup removes the attached burn');
});

test('blast marks wrap a thin hull edge without bridging empty space or painting lights',()=>{
  const c={window:{},console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const T=c.window.AlpineThree,scene=Object.create(c.window.BattleScene.prototype);scene.T=T;
  const ship=new T.Group(),model=new T.Group();ship.add(model);
  const plate=new T.Mesh(new T.BoxGeometry(.5,.04,.5),new T.MeshStandardMaterial({color:0xbbc6bf}));model.add(plate);
  const light=new T.Mesh(new T.SphereGeometry(.025,12,8),new T.MeshStandardMaterial({emissive:0xffaa00}));light.position.set(.24,.03,0);plate.add(light);
  ship.userData={model,breakupParts:[plate],scars:[]};
  scene.addImpactScar(ship,'phaser',{point:{x:.245,y:.02,z:0},normal:{x:0,y:1,z:0}});
  const scar=ship.userData.scars[0],positions=scar.children[0].geometry.attributes.position,points=[];
  for(let i=0;i<positions.count;i++)points.push(new T.Vector3().fromBufferAttribute(positions,i).add(scar.position));
  assert(points.some(p=>p.y>.02)&&points.some(p=>p.x>.25)&&points.some(p=>p.y<-.02),'burn follows the top, edge and underside');
  assert(points.every(p=>Math.abs(Math.abs(p.x)-.25)<.0015||Math.abs(Math.abs(p.y)-.02)<.0015||Math.abs(Math.abs(p.z)-.25)<.0015),'all vertices lie on actual hull faces');
  assert.equal(light.children.length,0,'illuminated parts remain unpainted');
});


test('a phaser with no confirmed surface contact spends its shot but cannot damage either ship',()=>{
  for(const attacker of ['player','enemy']){
    const sim=new B.Simulation(97,{turnBased:false});sim.running=true;Object.assign(sim.player,{x:2000,y:0,z:0,heading:0});Object.assign(sim.enemy,{x:2000,y:0,z:-500,heading:180});
    sim.resolveWeaponHit=()=>undefined;const source=sim[attacker],target=sim[attacker==='player'?'enemy':'player'],before=JSON.stringify({hull:target.hull,shields:target.shields,integrity:target.integrity});
    assert(sim.fire('phaser',source,target,false));assert(source.capacitor<100);assert(source.cooldown.phaser>0);
    assert.equal(JSON.stringify({hull:target.hull,shields:target.shields,integrity:target.integrity}),before);assert(!sim.events.some(e=>e.type==='impact'));assert.equal(sim.events.find(e=>e.type==='beam').missed,true);
  }
});

test('HD hull materials with emissive window maps still receive black burns and ember edges',()=>{
  const c={window:{},console,AbortController};vm.createContext(c);for(const file of ['vendor/three.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const T=c.window.AlpineThree,scene=Object.create(c.window.BattleScene.prototype);scene.T=T;
  const ship=new T.Group(),model=new T.Group(),plate=new T.Mesh(new T.BoxGeometry(.5,.04,.5),new T.MeshStandardMaterial({color:0xbbc6bf,emissive:0xffffff,emissiveMap:{}}));ship.add(model);model.add(plate);ship.userData={model,breakupParts:[plate],scars:[]};
  const scar=scene.addImpactScar(ship,'torpedo',{point:{x:0,y:.02,z:0},normal:{x:0,y:1,z:0}});
  assert(scar);assert.equal(scar.parent,plate);assert(scar.children[1].material.userData.damageEmbers);assert.equal(scar.children[2].material.color.getHex(),0x010101);
});

test('hull-hit events report actual lost hull, never nominal damage that did not change health',()=>{
  const sim=new B.Simulation(),p=sim.player,e=sim.enemy,arc=B.facing(e,p);e.shields[arc]=0;
  sim.damage(e,p,Number.EPSILON,'phaser','hull');const tiny=sim.events.findLast(event=>event.type==='impact');assert.equal(e.hull,100);assert.equal(tiny.hullDamage,0);assert.equal(tiny.system,null);
  const before=e.hull;sim.damage(e,p,1e6,'torpedo','hull');const fatal=sim.events.findLast(event=>event.type==='impact');assert.equal(fatal.hullDamage,before-e.hull);assert.equal(fatal.hullDamage,100);
});
