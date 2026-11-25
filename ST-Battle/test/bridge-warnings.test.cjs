const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const B=require('../engine.js'),Warnings=require('../bridge-warnings.js');
function harness(){const sim=new B.Simulation(97),warnings=new Warnings();sim.running=true;warnings.update(sim);return {sim,warnings};}
const labels={fore:'Foreward',aft:'Aft',starboard:'Starboard',port:'Port',dorsal:'Dorsal',ventral:'Ventral'};
const hit=arc=>({type:'impact',ship:'Enterprise',arc,amount:15,hullDamage:0});
test('Allison announces a sustained loss of an acquired weapon lock and drops a stale report',()=>{
  const {sim,warnings}=harness();sim.turn.phase='attack';sim.player.x=sim.enemy.x;sim.player.heading=0;sim.player.pitch=0;
  warnings.update(sim);assert(sim.lock);
  sim.player.heading=180;sim.time=1;assert(!warnings.update(sim).some(line=>line.text==="Weapon's lock lost."));
  sim.time=1.4;const line=warnings.update(sim).find(line=>line.text==="Weapon's lock lost.");assert(line);assert.equal(line.speaker,'allison');assert(line.valid());
  assert(!warnings.update(sim).some(line=>line.text==="Weapon's lock lost."),'do not repeat while lock remains lost');
  sim.player.heading=0;assert.equal(line.valid(),false);warnings.update(sim);
  sim.player.heading=180;sim.time=2;warnings.update(sim);sim.player.heading=0;sim.time=2.2;warnings.update(sim);sim.time=3;
  assert(!warnings.update(sim).some(line=>line.text==="Weapon's lock lost."),'brief lock flicker is ignored');
});

test('the lock-loss callout ignores an initial lack of lock, planning and Free Flight',()=>{
  const {sim,warnings}=harness();sim.turn.phase='attack';sim.player.heading=180;warnings.update(sim);sim.time=1;
  assert(!warnings.update(sim).some(line=>line.text==="Weapon's lock lost."));
  sim.turn.phase='planning';sim.player.heading=0;warnings.update(sim);sim.player.heading=180;sim.time=2;warnings.update(sim);sim.time=3;
  assert(!warnings.update(sim).some(line=>line.text==="Weapon's lock lost."));
  sim.freeFlight=true;assert.deepEqual(warnings.update(sim),[]);
});

test('each shield facing uses the matching hit and critical recordings, with critical taking precedence',()=>{
  for(const [arc,label] of Object.entries(labels)){
    const {sim,warnings}=harness();sim.player.shields[arc]=80;
    let lines=warnings.update(sim,[hit(arc)]);assert.deepEqual(lines.map(line=>line.text),[label+' shields took a hit']);
    sim.player.shields[arc]=25;sim.time=1;
    lines=warnings.update(sim,[hit(arc)]);assert.deepEqual(lines.map(line=>line.text),[label+' shields at critical']);
    assert(!warnings.update(sim,[hit(arc)]).some(line=>line.text.includes('at critical')),'remaining critical does not repeat the threshold warning');
    sim.player.shields[arc]=36;assert.equal(lines[0].valid(),false,'repairs invalidate a queued critical report');
    warnings.update(sim);sim.time=30;sim.player.shields[arc]=24;
    assert(warnings.update(sim).some(line=>line.text===label+' shields at critical'),'damage after repairs re-arms the warning');
  }
});
test('general shield damage reflects multiple hits and ignores enemy, practice and hull-only impacts',()=>{
  const {sim,warnings}=harness();
  assert.equal(warnings.update(sim,[{...hit('fore'),ship:'Yorktown'},{...hit('fore'),practice:true},{...hit('fore'),hullDamage:15}]).length,0);
  const lines=warnings.update(sim,[hit('fore'),hit('aft')]);
  assert.deepEqual(lines.map(line=>line.text),['The shields are taking damage']);
  sim.time=1;assert.equal(warnings.update(sim,[hit('port')]).length,0,'a sustained burst does not flood dialogue');
});
test('all four offline reports follow actual system outages and become invalid when restored',()=>{
  for(const [key,label,value] of [['sensors','Sensors',12],['shields','Shields',0],['engines','Engines',0],['weapons','Weapons',9]]){
    const {sim,warnings}=harness();sim.player.integrity[key]=value;
    const line=warnings.update(sim).find(line=>line.text===label+' are offline');assert(line);
    assert.equal(warnings.update(sim).length,0);sim.player.integrity[key]=100;assert.equal(line.valid(),false);
    warnings.update(sim);sim.time=30;sim.player.integrity[key]=value;
    assert(warnings.update(sim).some(line=>line.text===label+' are offline'));
  }
});
test('overall shield collapse and critical hull damage warn without the removed bad-feeling line',()=>{
  const {sim,warnings}=harness();for(const arc of B.arcs)sim.player.shields[arc]=20;
  assert(warnings.update(sim).some(line=>line.text==='Shields at critical level'));
  for(const arc of B.arcs)sim.player.shields[arc]=0;
  assert(warnings.update(sim).some(line=>line.text==='Shields are offline'));
  sim.player.hull=45;assert(!warnings.update(sim).some(line=>/bad feeling/i.test(line.text)));
  sim.player.hull=24;
  assert(warnings.update(sim).some(line=>line.text==="We're not going to last long"));
  sim.time=60;assert.equal(warnings.update(sim).length,0,'persistent damage stays latched after cooldown');
});
test('paused, practice and finished games stay quiet, and a reset clears warning state',()=>{
  const {sim,warnings}=harness();sim.player.integrity.sensors=0;
  sim.running=false;assert.equal(warnings.update(sim).length,0);
  sim.running=true;sim.freeFlight=true;assert.equal(warnings.update(sim,[hit('fore')]).length,0);
  sim.freeFlight=false;sim.result='defeat';assert.equal(warnings.update(sim).length,0);
  sim.result=null;assert(warnings.update(sim).length>0);
  warnings.reset();assert(warnings.update(sim).length>0);
});
test('every new Erica warning resolves to its packaged recording',()=>{
  const context={window:{BattleVoiceClips:{}}};vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/voices/voice-overrides.js'),'utf8'),context);
  const clips=context.window.BattleVoiceClips;
  const names=['The shields are taking damage','Shields at critical level','Sensors are offline','Shields are offline','Engines are offline','Weapons are offline',...Object.values(labels).flatMap(label=>[label+' shields at critical',label+' shields took a hit']),"We're not going to last long"];
  assert.equal(names.length,19);assert.equal(clips["helm\nI've got a bad feeling about this"],undefined);
  for(const name of names){assert.equal(clips['helm\n'+name],'assets/'+name+'.mp3');assert(fs.statSync(path.join(__dirname,'..',clips['helm\n'+name])).size>0);}
});


test('Allison reports Yorktown leaving weapons range once, with hysteresis and stale-line cancellation',()=>{
  const sim=new B.Simulation(97),warnings=new Warnings();sim.running=true;
  Object.assign(sim.player,{x:2000,y:0,z:0});Object.assign(sim.enemy,{x:2000,y:0,z:-1800});warnings.update(sim);
  sim.enemy.z=-1901;const lines=warnings.update(sim),line=lines.find(l=>l.text==="They're out of range.");assert(line);assert.equal(line.speaker,'allison');assert(line.valid());
  assert.equal(warnings.update(sim).length,0,'staying out of range is silent');
  sim.enemy.z=-1890;warnings.update(sim);assert.equal(line.valid(),false,'returning into range cancels queued report');
  sim.time=30;sim.enemy.z=-1901;assert.equal(warnings.update(sim).length,0,'small boundary oscillations do not re-arm it');
  sim.enemy.z=-1800;warnings.update(sim);sim.enemy.z=-1901;assert(warnings.update(sim).some(l=>l.speaker==='allison'),'a new departure can be reported');
});

test('range report does not announce an initial distant target, Free Flight, or a destroyed Yorktown',()=>{
  for(const mode of ['initial','freeFlight','destroyed']){
    const sim=new B.Simulation(97),warnings=new Warnings();sim.running=true;Object.assign(sim.player,{x:2000,y:0,z:0});Object.assign(sim.enemy,{x:2000,y:0,z:mode==='initial'?-2000:-1800});warnings.update(sim);
    if(mode==='freeFlight')sim.freeFlight=true;if(mode==='destroyed')sim.enemy.hull=0;sim.enemy.z=-2200;
    assert(!warnings.update(sim).some(l=>l.text==="They're out of range."));
  }
});


test('Allison announces return to range once and cancels stale return reports',()=>{
  const sim=new B.Simulation(),warnings=new Warnings();sim.running=true;Object.assign(sim.player,{x:2000,y:0,z:0});Object.assign(sim.enemy,{x:2000,y:0,z:-1800});warnings.update(sim);
  sim.enemy.z=-2000;assert(warnings.update(sim).some(line=>line.text==="They're out of range."));
  sim.enemy.z=-1840;sim.time=5;const back=warnings.update(sim).find(line=>line.text==="They're back in range.");assert(back);assert.equal(back.speaker,'allison');assert(back.valid());
  assert(!warnings.update(sim).some(line=>line.text==="They're back in range."));sim.enemy.z=-2000;assert.equal(back.valid(),false);
});
