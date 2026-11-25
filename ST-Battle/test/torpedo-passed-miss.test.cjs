const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
function fixture({practice=false,y=200}={}){
  const s=new B.Simulation(97,{turnBased:false});s.running=true;s.aiShot=s.aiTorp=1000;
  Object.assign(s.player,{x:6000,y:0,z:1000,heading:0,speed:0,fullStop:true,throttle:0});
  Object.assign(s.enemy,{x:6000,y:0,z:0,heading:0,speed:0});s.enemy.integrity.weapons=0;
  const order={status:'in-flight'},shot={id:'passing-shot',from:'Enterprise',target:'Yorktown',pos:{x:6000,y,z:300},heading:0,pitch:0,life:0,maxLife:8,strength:1,targetSystem:'hull',order,practice};
  s.projectiles.push(shot);s.events=[];return {s,shot,order};
}
test('a torpedo reports its miss once it has flown clear past Yorktown, before its lifetime expires',()=>{
  const {s,shot,order}=fixture();for(let i=0;i<10;i++)s.tick(.05);
  assert(!s.events.some(event=>event.type==='torpedo-missed'),'no early miss while the torpedo is approaching');
  for(let i=0;i<50&&!shot.missReported;i++)s.tick(.05);
  const misses=s.events.filter(event=>event.type==='torpedo-missed');assert.equal(misses.length,1);assert.equal(misses[0].reason,'passed');
  assert.equal(misses[0].from,'Enterprise');assert.equal(misses[0].target,'Yorktown');assert.equal(order.status,'missed');
  assert(shot.life<3&&shot.life<shot.maxLife);assert(s.projectiles.includes(shot),'the torpedo continues visibly along its flight path');
});
test('later expiry or obstruction cannot repeat a miss already reported after a fly-past',()=>{
  for(const terminal of ['expired','blocked']){
    const {s,shot,order}=fixture();for(let i=0;i<60&&!shot.missReported;i++)s.tick(.05);assert(shot.missReported);
    if(terminal==='expired')shot.life=8;
    else s.stationTrace=(from,to,padding)=>padding===2?{pos:{...to},normal:{x:0,y:1,z:0}}:null;
    s.tick(.05);assert(!s.projectiles.includes(shot));assert.equal(s.events.filter(event=>event.type==='torpedo-missed').length,1);
    assert.equal(order.status,'missed');
  }
});
test('real impacts and practice fly-pasts do not announce a miss',()=>{
  const hit=fixture({y:0});for(let i=0;i<60&&hit.s.projectiles.includes(hit.shot);i++)hit.s.tick(.05);
  assert.equal(hit.order.status,'hit');assert(!hit.s.events.some(event=>event.type==='torpedo-missed'));
  const practice=fixture({practice:true});for(let i=0;i<80;i++)practice.s.tick(.05);
  assert(!practice.s.events.some(event=>event.type==='torpedo-missed'));
});
