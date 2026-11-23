const fs=require('node:fs');
const path=require('node:path');
const B=require('../engine.js');
const seeds=[12,37,73,97,121,318,477,601,811,1031,1307,1709,2131,2797,3331,4093];
const battles=[];
for(const seed of seeds){
  const s=new B.Simulation(seed,{randomStart:true});s.running=true;
  for(let i=0;i<6120&&!s.result;i++){
    if(['planning','review'].includes(s.turn.phase)){
      if(!s.bestGuessPlan())throw Error('Could not plan '+seed);
      s.captainEnabled=true;
      if(!s.commitOrders())throw Error('Could not commit '+seed);
    }
    s.tick(.1);s.events=[];
  }
  battles.push({seed,personality:s.enemyPersonality,result:s.result,time:+s.time.toFixed(1),shots:s.shots,playerHull:+s.player.hull.toFixed(2),enemyHull:+s.enemy.hull.toFixed(2)});
}
const finished=battles.filter(battle=>battle.result),times=finished.map(battle=>battle.time).sort((a,b)=>a-b);
const summary={battles:battles.length,resolved:finished.length,victories:battles.filter(battle=>battle.result==='victory').length,defeats:battles.filter(battle=>battle.result==='defeat').length,medianSeconds:(times[Math.floor((times.length-1)/2)]+times[Math.floor(times.length/2)])/2};
const name=process.argv[2]||'fragility-benchmark.json';
if(path.basename(name)!==name)throw Error('Use a report filename inside exports.');
fs.writeFileSync(path.join(__dirname,name),JSON.stringify({summary,battles},null,2)+'\n');
console.log(JSON.stringify(summary));
