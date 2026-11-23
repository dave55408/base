const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js'),Replay=require('../replay.js');

test('both ships smoothly bank up to 40 degrees in either direction',()=>{
  for(const side of ['player','enemy'])for(const turn of [-1,1]){
    const s=new B.Simulation(),ship=s[side];Object.assign(ship,{x:6000,y:0,z:0,heading:0,pitch:0});
    for(let i=0;i<200;i++){
      const h=(ship.heading+turn*90)*Math.PI/180,before=ship.bank;
      s.steerFlight(ship,{x:ship.x+Math.sin(h)*1000,y:0,z:ship.z-Math.cos(h)*1000},.05);
      assert(Math.abs(ship.bank)<=40*Math.PI/180+1e-8);assert(Math.abs(ship.bank-before)<.15);
    }
    assert(Math.abs(ship.bank)>40*Math.PI/180-.01);assert.equal(Math.sign(ship.bank),-turn);
  }
});


test('both automatic helms stay upright on steep turns',()=>{
  for(const side of ['player','enemy']){
    const s=new B.Simulation(),ship=s[side];Object.assign(ship,{x:6000,y:0,z:0,heading:0,pitch:0});
    for(let i=0;i<400;i++){s.steerFlight(ship,{x:6000,y:1000,z:300},.05);assert(Math.abs(ship.pitch)<=85);}
    assert(Math.abs(ship.pitch)<90);
  }
});
test('Free Flight pitch stops at 85 degrees instead of looping into inverted flight',()=>{
  const s=new B.Simulation();s.startFreeFlight();Object.assign(s.player,{x:6000,y:3000,z:6000,heading:0,pitch:0,turnRate:0});
  for(let i=0;i<150;i++)s.tick(.1,{down:true});assert.equal(s.player.pitch,85);
  for(let i=0;i<150;i++)s.tick(.1,{up:true});assert.equal(s.player.pitch,-85);
});
