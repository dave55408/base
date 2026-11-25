const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../engine.js');
// Keep both contacts in sensor range to measure speed control rather than search behavior.
function duel(range=1800,firingRange=1000){
  const s=new B.Simulation();s.running=true;s.selectManeuver('direct');
  Object.assign(s.player,{x:2000,y:0,z:0,heading:0});Object.assign(s.enemy,{x:2000,y:0,z:-range,heading:180});
  s.player.integrity.weapons=s.enemy.integrity.weapons=0;
  const plan=['phaser','phaser','torpedo'].map(weapon=>({weapon,target:'hull',range:firingRange}));
  plan.forEach((step,i)=>s.updateStep(i,step));s.commitOrders();s.turn.enemyOrders=plan.map(v=>({...v,status:'pending'}));return s;
}
test('both ships command all available speed throughout a clear attack run',()=>{
  for(const range of [1800,900,500]){
    const s=duel(range);s.tick(.05);
    for(const side of ['player','enemy']){
      const ship=s[side];assert.equal(ship.flightTargetSpeed,125*s.flightMobility(ship)*1.5,side);
      assert.equal(ship.speedIntent,'ACCELERATING FOR ATTACK RUN');
      assert(ship.speed>B.MIN_IMPULSE_SPEED);assert(ship.speed<ship.flightTargetSpeed,'acceleration remains gradual');
    }
  }
});

test('selected firing range does not make an attack run loiter or slow down',()=>{
  for(const firingRange of [400,1000,1400]){
    const s=duel(900,firingRange);s.tick(.05);
    for(const side of ['player','enemy'])assert.equal(s[side].flightTargetSpeed,125*s.flightMobility(s[side])*1.5,side);
  }
});

test('weapon recharge and heat do not hold back acceleration on an attack run',()=>{
  const s=duel();for(const ship of [s.player,s.enemy]){ship.cooldown.phaser=30;ship.capacitor=0;ship.heat=95;}
  s.tick(.05);
  for(const side of ['player','enemy'])assert.equal(s[side].flightTargetSpeed,125*s.flightMobility(s[side])*1.5,side);
});

test('both ships slow for a sharp heading change rather than flying large circles past the target',()=>{
  const aligned=duel(),turning=duel();turning.player.heading=180;turning.enemy.heading=0;
  aligned.tick(.05);turning.tick(.05);
  for(const side of ['player','enemy']){
    assert(turning[side].flightTargetSpeed<aligned[side].flightTargetSpeed*.5,side);assert.equal(turning[side].speedIntent,'TURNING FOR ATTACK');
  }
});
test('damage reduces speed targets while actual ships brake gradually and retain minimum impulse',()=>{
  const s=duel();for(const side of ['player','enemy']){s[side].speed=180;s[side].integrity.engines=0;s[side].repairBudget=0;}
  s.tick(.1);for(const side of ['player','enemy']){assert(s[side].speed<180);assert(s[side].speed>s[side].flightTargetSpeed);}
  // Eased acceleration deliberately takes longer to settle than constant braking.
  for(let i=0;i<110;i++)s.tick(.1);
  for(const side of ['player','enemy']){assert(s[side].speed<=22.5+.001);assert(s[side].speed>=B.MIN_IMPULSE_SPEED);}
});

test('attack runs and collision courses reduce thrust immediately when a new turn needs it',()=>{
  for(const mode of ['attack','ram']){
    const s=duel(1800),p=s.player,options={mode,order:s.nextOrder()};p.speed=160;
    s.adjustFlightSpeed(p,s.enemy,s.enemy,options,.05);const straight=p.flightTargetSpeed;
    p.heading=45;s.adjustFlightSpeed(p,s.enemy,s.enemy,options,.05);
    assert(p.flightTargetSpeed<straight);assert(p.flightTargetSpeed<160,'turning bypasses the routine speed-decision hold');
    assert.equal(p.speedIntent,'TURNING FOR ATTACK');
    p.heading=0;s.adjustFlightSpeed(p,s.enemy,s.enemy,options,.05);
    assert.equal(p.flightTargetSpeed,straight,'full attack thrust resumes once lined up');
  }
});
test('the shared controller selects slow cover speed and full available speed for aligned withdrawal',()=>{
  const s=duel();
  for(const [ship,target] of [[s.player,s.enemy],[s.enemy,s.player]]){
    const d=B.direction(ship),aim={x:ship.x+d.x*1000,y:ship.y+d.y*1000,z:ship.z+d.z*1000};
    const cover=s.desiredFlightSpeed(ship,target,aim,{mode:'cover'}),escape=s.desiredFlightSpeed(ship,target,aim,{mode:'escape'});
    assert.equal(cover.speed,B.MIN_IMPULSE_SPEED);assert.equal(escape.speed,escape.maximum);assert(escape.speed>cover.speed);
  }
});
test('predicted K7 collisions reduce speed before the ship reaches the station',()=>{
  const s=duel(),p=s.player,k=s.station;Object.assign(p,{x:k.x,y:k.y,z:k.z+220,heading:0,pitch:0,speed:180});
  const aim={x:k.x,y:k.y,z:k.z-1800},command=s.desiredFlightSpeed(p,s.enemy,aim,{mode:'position'});
  assert.equal(command.reason,'BRAKING FOR K7');assert(command.speed<=80);assert(command.speed>=B.MIN_IMPULSE_SPEED);
  const override=s.desiredFlightSpeed(p,s.enemy,aim,{mode:'position',speedOverride:1});assert.equal(override.reason,'BRAKING FOR K7');assert(override.speed<=80);
});

test('held W and S override only player speed and releasing returns to the automatic plan',()=>{
  const s=duel(900,1400),p=s.player,orders=JSON.stringify(s.turn.orders);p.speed=80;
  s.enemy.x+=400;
  s.autoHelm(.1,{more:true});assert.equal(p.speedOverride,1);assert(p.flightTargetSpeed>150);assert.match(p.speedIntent,/MANUAL SPEED UP/);assert(p.speed>80&&p.speed<90);
  s.autoHelm(.1,{});assert.equal(p.speedOverride,0);assert.match(p.speedIntent,/ATTACK|STRAFING/);assert(p.flightTargetSpeed>B.MIN_IMPULSE_SPEED,'the strafing run keeps moving while making its small alignment correction');
  s.autoHelm(.1,{less:true});assert.equal(p.speedOverride,-1);assert.equal(p.flightTargetSpeed,B.MIN_IMPULSE_SPEED);assert.match(p.speedIntent,/MANUAL SLOW DOWN/);
  s.autoHelm(.1,{});assert.equal(p.speedOverride,0);assert.equal(JSON.stringify(s.turn.orders),orders);assert.equal(s.turn.maneuver,'direct');assert.equal(p.torpedoes,24);
});
