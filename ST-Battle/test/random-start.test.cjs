const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../engine.js');

test('random starts give the opening approach 39 to 52 km separation clear of K7',()=>{
  for(let seed=0;seed<500;seed++){
    const s=new B.Simulation(seed,{randomStart:true});
    assert(s.range>3900&&s.range<5200,`separation for seed ${seed}: ${s.range}`);
    assert(Math.abs(s.player.y-s.enemy.y)>=200,'the ships start at distinct elevations');
    assert(B.angle(s.player,s.enemy)<11);
    for(const ship of [s.player,s.enemy]){
      assert(B.distance(ship,s.station)>3400);assert(B.distance(ship,s.station)<3820);
      assert.equal(s.stationTrace(ship,ship,150),null);assert.equal(ship.hull,100);assert.equal(ship.turnRate,0);
    }
    assert.equal(s.stationTrace(s.player,s.enemy,100),null);
  }
});

test('new engagements choose new locations while explicit seeds keep starts reproducible',()=>{
  const a=new B.Simulation(123,{randomStart:true}),b=new B.Simulation(123,{randomStart:true});
  assert.deepEqual(a.player,b.player);assert.deepEqual(a.enemy,b.enemy);
  const player={...a.player},enemy={...a.enemy};a.reset();
  assert.notEqual(a.player.x,player.x);assert.notEqual(a.enemy.z,enemy.z);assert.equal(a.running,false);assert.equal(a.turn.phase,'planning');
});
