const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
test('both ships retain a 65 degree forward limit for torpedoes and phasers',()=>{
  const s=new B.Simulation(97);
  for(const [ship,target] of [[s.player,s.enemy],[s.enemy,s.player]]){
    ship.x=ship.y=ship.z=0;ship.heading=ship.pitch=0;
    for(const [degrees,torpedo,phaser] of [[0,true,true],[39.9,true,true],[40.1,true,true],[64.9,true,true],[65.1,false,false],[180,false,false]]){
      const r=degrees*Math.PI/180;target.x=Math.sin(r)*500;target.y=0;target.z=-Math.cos(r)*500;
      assert.equal(s.forwardFiringArc('torpedo',ship,target),torpedo,String(degrees));
      assert.equal(s.forwardFiringArc('phaser',ship,target),phaser,String(degrees));
    }
  }
});
