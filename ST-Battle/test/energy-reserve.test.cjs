const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
function setup(){const s=new B.Simulation(97,{turnBased:false});s.running=true;s.enemy.integrity.weapons=0;Object.assign(s.player,{x:3000,y:0,z:0,heading:0,pitch:0,speed:15});Object.assign(s.enemy,{x:3000,y:0,z:-900,heading:180,pitch:0});return s;}
const tick=(s,seconds=1)=>{for(let i=0;i<Math.round(seconds/.05);i++)s.tick(.05);};
test('reserves recharge during light activity, stay bounded, and reset for a new battle',()=>{
 const s=setup();s.player.energyReserve=50;tick(s);assert(s.player.energyReserve>50);assert(s.player.energyRate>0);
 s.player.energyReserve=100;tick(s);assert.equal(s.player.energyReserve,100);
 s.player.energyReserve=5;s.reset();assert.equal(s.player.energyReserve,100);assert.equal(s.enemy.energyReserve,100);
});
test('propulsion, capacitor charging, shield recovery and repairs increase reserve draw',()=>{
 const s=setup();
 const compare=change=>{const idle=structuredClone(s.player),active=structuredClone(s.player);idle.energyReserve=active.energyReserve=70;change(active);s.updateEnergy(idle,1);s.updateEnergy(active,1);assert(active.energyReserve<idle.energyReserve);};
 compare(ship=>{ship.speed=250;});
 const baseline=structuredClone(s.player);baseline.energyReserve=70;s.updateEnergy(baseline,1);
 for(const gains of [[10,0,0],[0,10,0],[0,0,1]]){const active=structuredClone(s.player);active.energyReserve=70;s.updateEnergy(active,1,...gains);assert(active.energyReserve<baseline.energyReserve);}
});
test('damage immediately drains reserve and damaged hull and reactor impair recovery',()=>{
 const s=setup(),p=s.player;p.energyReserve=80;const healthy=structuredClone(p);s.damage(p,s.enemy,20,'phaser','hull');assert(p.energyReserve<80);
 p.hull=20;p.reactor=20;p.energyReserve=healthy.energyReserve=60;s.updateEnergy(healthy,1);s.updateEnergy(p,1);assert(p.energyReserve<60);assert(p.energyRate<healthy.energyRate);
 s.drawEnergy(p,1000);assert.equal(p.energyReserve,0);
});
test('firing, scans and warp spend reserves while depleted reserves hold weapons',()=>{
 const s=setup(),p=s.player;p.energyReserve=60;assert(s.fire('phaser'));assert(p.energyReserve<60);
 p.energyReserve=0;p.capacitor=100;p.cooldown.phaser=0;assert.equal(s.status('phaser'),'LOW ENERGY RESERVE');assert(!s.fire('phaser'));
 p.energyReserve=60;assert(s.scan());assert(p.energyReserve<60);
 p.energyReserve=60;assert(s.warp());assert(p.energyReserve<60);
});
test('low reserves slow capacitor and shield recovery but can recover from depletion',()=>{
 const full=setup(),low=setup();for(const s of [full,low]){s.player.capacitor=0;for(const arc of B.arcs)s.player.shields[arc]=50;}
 low.player.energyReserve=0;tick(full,.1);tick(low,.1);
 assert(full.player.capacitor>low.player.capacitor);assert(full.player.shields.fore>low.player.shields.fore);assert(low.player.energyReserve>0);
});
test('pause, planning and review freeze reserves and new turns preserve them',()=>{
 const s=new B.Simulation();s.running=true;s.player.energyReserve=60;tick(s);assert.equal(s.player.energyReserve,60);
 assert(s.applyPlanPreset('strong'));assert(s.commitOrders());s.running=false;tick(s);assert.equal(s.player.energyReserve,60);
 s.running=true;tick(s);const remaining=s.player.energyReserve;assert(s.endPass());tick(s);assert.equal(s.player.energyReserve,remaining);assert(s.commitOrders());assert.equal(s.player.energyReserve,remaining);
});


test('missing nacelles sharply reduce power generation for both ships and repairs cannot bypass it',()=>{
  const sim=new B.Simulation();
  for(const name of ['player','enemy']){
    const ship=sim[name];ship.speed=0;ship.power.sensors=0;ship.energyReserve=50;
    const generated=()=>{sim.updateEnergy(ship,1);return ship.energyRate+.2;};
    const normal=generated();ship.detachedNacelles.port=true;assert(Math.abs(generated()/normal-.45)<1e-8);
    ship.detachedNacelles.starboard=true;assert(Math.abs(generated()/normal-.12)<1e-8);
    ship.integrity.mainEngines=100;ship.reactor=100;assert(Math.abs(generated()/normal-.12)<1e-8,'repairing systems does not recreate lost power capacity');
  }
});

test('one or both lost warp engines also slow shield and weapon-capacitor recharge on either ship',()=>{
  const readings=[];
  for(const lost of [0,1,2]){
    const sim=setup();sim.enemy.integrity.weapons=100;
    for(const ship of [sim.player,sim.enemy]){
      ship.energyReserve=100;ship.capacitor=20;ship.repairBudget=0;for(const arc of B.arcs)ship.shields[arc]=50;
      ship.detachedNacelles={port:lost>=1,starboard:lost>=2};
    }
    sim.tick(.05);readings.push([sim.player,sim.enemy].map(ship=>({capacitor:ship.capacitor-20,shield:ship.shields.fore-50})));
  }
  for(const index of [0,1])for(const field of ['capacitor','shield']){
    assert(Math.abs(readings[1][index][field]/readings[0][index][field]-.45)<1e-8);
    assert(Math.abs(readings[2][index][field]/readings[0][index][field]-.12)<1e-8);
  }
});
