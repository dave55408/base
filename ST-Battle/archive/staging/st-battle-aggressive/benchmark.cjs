const before=require('./before.cjs'),after=require('./engine.js');
function run(B,seed){
 const s=new B.Simulation(seed,{randomStart:true});s.running=true;
 for(let i=0;i<6000&&!s.result;i++){
  if(['planning','review'].includes(s.turn.phase)){s.bestGuessPlan();s.captainEnabled=true;s.commitOrders();}
  s.tick(.1);s.events=[];
 }
 return {result:s.result||'timeout',hull:Math.round(s.player.hull),enemyHull:Math.round(s.enemy.hull),time:Math.round(s.time),shots:s.shots};
}
for(const seed of [12,37,73,97,121,318,477,601])console.log(JSON.stringify({seed,before:run(before,seed),after:run(after,seed)}));
