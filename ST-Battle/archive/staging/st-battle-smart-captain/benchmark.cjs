const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const game='C:/Users/David Granholm/.codex/ST Battle',Replay=require(path.join(game,'replay.js'));
function load(source){const c={module:{exports:{}},exports:{},require:()=>Replay,console};vm.runInNewContext(source,c);return c.module.exports;}
const old=load(fs.readFileSync(path.join(__dirname,'../st-battle-arcade-upgrade/engine.js'),'utf8')),fresh=require(path.join(game,'engine.js'));
function run(B,seed,smart){
  const s=new B.Simulation(seed,{randomStart:true});s.running=true;
  for(let i=0;i<6000&&!s.result;i++){
    if(['planning','review'].includes(s.turn.phase)){s.randomizePlan();s.captainEnabled=smart;s.commitOrders();}
    s.tick(.1);s.events=[];
  }
  return {result:s.result||'timeout',hull:Math.round(s.player.hull),enemyHull:Math.round(s.enemy.hull),shots:s.shots,hits:s.hits,time:Math.round(s.time)};
}
const results=[];for(const seed of [12,37,73,97,121,318,477,601])results.push({seed,old:run(old,seed,false),smart:run(fresh,seed,true)});
console.log(JSON.stringify(results));
