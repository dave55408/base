const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const B=require('../engine.js');

test('weaker shields deplete sooner and penetrating hits heavily damage internal systems',()=>{
  for(const [weapon,remaining] of [['phaser',44],['torpedo',61]]){
    const s=new B.Simulation(),p=s.player,e=s.enemy,arc=B.facing(e,p);
    s.damage(e,p,20,weapon,'weapons');assert.equal(e.shields[arc],remaining);assert.equal(e.hull,100);
    e.shields[arc]=0;s.damage(e,p,40,weapon,'weapons');
    const impact=s.events.filter(e=>e.type==='impact').at(-1);
    assert(impact.hullDamage>0);
    const internalLoss=Object.values(e.integrity).reduce((sum,value)=>sum+100-value,0);
    assert(Math.abs(internalLoss-impact.hullDamage*1.8)<1e-8);
    assert(Math.abs((100-e.reactor)-impact.hullDamage*.12)<1e-8);
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
  assert.equal(scar.parent,scene.ships.Yorktown.userData.model);
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
  assert(aftHit);assert.equal(aftHit.emitter.z,.8,'Yorktown aft phasers originate at the stern');
  const aftEndpoints=scene.weaponEndpoints('Yorktown','Enterprise',aftHit);
  assert(aftEndpoints.start.z>sim.enemy.z);assert(aftEndpoints.end.z>aftEndpoints.start.z);
  sim.turnBased=true;sim.turn.maneuver='close';sim.turn.phase='approach';sim.player.heading=180;
  const closeHit=scene.resolveWeaponHit(sim.player,sim.enemy,'hull');
  assert(closeHit);assert.equal(closeHit.emitter.z,.8,'Enterprise can use its aft emitter during Close battle');
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
