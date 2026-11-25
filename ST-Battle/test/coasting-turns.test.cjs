const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
function duel(){
  const s=new B.Simulation(97);s.turnBased=true;s.running=true;
  Object.assign(s.player,{x:6000,y:0,z:0,heading:0,pitch:0,turnRate:0,speed:100});
  Object.assign(s.enemy,{x:6700,y:0,z:0,heading:0,pitch:0,turnRate:0,speed:100});return s;
}
test('either ship can cut thrust and rotate into forward firing arc while continuing its original trajectory',()=>{
  for(const side of ['player','enemy']){
    const s=duel(),ship=s[side],enemy=side==='player'?s.enemy:s.player;
    const original=B.direction(ship);let acquired=false;
    for(let i=0;i<240;i++){
      s.adjustFlightSpeed(ship,enemy,enemy,{mode:'attack'},.05);
      if(i===0){assert(ship.coastingTurn);assert.equal(ship.throttle,0);}
      s.steerFlight(ship,enemy,.05,42,30,false,true,true);
      const v=s.moveFlightVelocity(ship,.05);for(const axis of ['x','y','z'])ship[axis]+=v[axis]*.05;
      if(ship.coastingTurn){assert(Math.abs(v.x-original.x*100)<1e-8);assert(Math.abs(v.z-original.z*100)<1e-8);}
      if(s.forwardFiringArc('phaser',ship,enemy)){acquired=true;assert(ship.coastingTurn,'the bow can acquire the target before changing the trajectory');break;}
    }
    assert(acquired);assert(Math.abs(ship.turnRate)>0);assert.equal(ship.flightAcceleration,0);
  }
});
test('aligned thrust redirects momentum gradually instead of snapping the trajectory onto the bow',()=>{
  const s=duel(),p=s.player;s.adjustFlightSpeed(p,s.enemy,s.enemy,{mode:'pursuit'},.05);
  p.heading=90;s.adjustFlightSpeed(p,s.enemy,s.enemy,{mode:'pursuit'},.05);assert.equal(p.coastingTurn,false);assert(p.throttle>0);
  const before={...p.flightVelocity},v=s.moveFlightVelocity(p,.05);
  assert(v.x>0&&v.x<5);assert(v.z<-90);
  assert(Math.hypot(v.x-before.x,v.y-before.y,v.z-before.z)<=28*Math.max(.35,s.flightMobility(p))*.05+1e-8);
});
test('All Stop cancels coasting, and avoidance and manual thrust take priority',()=>{
  for(const override of ['stop','avoid','manual']){
    const s=duel(),p=s.player;s.adjustFlightSpeed(p,s.enemy,s.enemy,{mode:'attack'},.05);assert(p.coastingTurn);
    if(override==='stop'){assert(s.stopEnterprise());assert.equal(p.speed,0);}
    else s.adjustFlightSpeed(p,s.enemy,s.enemy,{mode:'attack',avoiding:override==='avoid',speedOverride:override==='manual'?1:0},.05);
    assert.equal(p.coastingTurn,false);assert.equal(p.flightVelocity,null);
  }
});
test('distant approaches and deliberate ram or Close battle orders retain powered steering',()=>{
  for(const mode of ['ram','close','position','escape']){const s=duel();s.adjustFlightSpeed(s.player,s.enemy,s.enemy,{mode},.05);assert(!s.player.coastingTurn);}
  const s=duel();s.enemy.x=8000;s.adjustFlightSpeed(s.player,s.enemy,s.enemy,{mode:'attack'},.05);assert(!s.player.coastingTurn);
});

test('cutting thrust saves propulsion energy while the ship retains its coasting speed',()=>{
  const s=duel(),p=s.player,e=s.enemy;p.coastingTurn=true;p.throttle=0;
  p.energyReserve=e.energyReserve=50;s.updateEnergy(p,1);s.updateEnergy(e,1);
  assert(p.energyRate>e.energyRate);assert(p.energyReserve>e.energyReserve,'coasting does not pay the powered propulsion demand');
  assert.equal(p.speed,100,'energy savings do not remove momentum');
});
