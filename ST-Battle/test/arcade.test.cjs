const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
test('difficulty changes enemy damage but preserves the default duel and survives a rematch',()=>{
  const losses={};for(const level of ['cadet','captain','admiral']){
    const s=new B.Simulation();s.random=()=>.5;assert(s.setDifficulty(level));s.damage(s.player,s.enemy,20,'phaser','hull');losses[level]=100-s.player.shields[B.facing(s.player,s.enemy)];
    s.reset();assert.equal(s.difficulty,level);s.running=true;assert.equal(s.setDifficulty('cadet'),false);
  }
  assert(Math.abs(losses.captain-56)<1e-8);assert(losses.cadet<losses.captain);assert(losses.admiral>losses.captain);
});

test('consecutive hits build bounded chains, expire, and break when Enterprise takes a hit',()=>{
  const s=new B.Simulation();s.shots=3;s.damage(s.enemy,s.player,10,'phaser','hull');const first=s.battleStats.score;
  s.time=1;s.damage(s.enemy,s.player,10,'phaser','hull');assert.equal(s.activeChain,2);assert(s.battleStats.score-first>first);
  for(let i=0;i<8;i++){s.time+=.2;s.damage(s.enemy,s.player,1,'phaser','hull');}assert.equal(s.activeChain,5);assert.equal(s.battleStats.bestChain,5);
  s.time+=9;assert.equal(s.activeChain,0);s.damage(s.enemy,s.player,1,'phaser','hull');assert.equal(s.activeChain,1);
  s.damage(s.player,s.enemy,1,'phaser','hull');assert.equal(s.activeChain,0);assert.equal(s.battleStats.bestChain,5);
  s.reset();s.startFreeFlight();s.damage(s.enemy,s.player,999,'torpedo','hull');assert.equal(s.battleStats.score,0);
});

test('shield breaches carry hit feedback and victory awards a bonus only once',()=>{
  const s=new B.Simulation(0);s.shots=1;s.enemy.shields[B.facing(s.enemy,s.player)]=10;
  s.damage(s.enemy,s.player,10,'phaser','hull');const hit=s.events.find(e=>e.type==='impact');assert(hit.shieldBroken);assert(hit.scorePoints>0);
  for(const sector of B.arcs)s.enemy.shields[sector]=0;s.enemy.hull=1;
  s.damage(s.enemy,s.player,100,'torpedo','hull');assert.equal(s.result,'victory');assert(s.challengeComplete);assert(s.battleStats.victoryBonus>=750);assert(['S','A','B','C'].includes(s.battleGrade));
  const score=s.battleStats.score;s.completeBattleScore();s.damage(s.enemy,s.player,100,'torpedo','hull');assert.equal(s.battleStats.score,score);
  s.reset();assert.equal(s.battleStats.score,0);assert.equal(s.battleStats.bestChain,0);
});
