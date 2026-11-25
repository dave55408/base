const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
function duel(route='flank'){
  const s=new B.Simulation(97);s.running=true;s.selectManeuver(route,0);
  for(let i=0;i<3;i++)s.updateStep(i,{weapon:'phaser',target:'hull',range:1000,maneuvers:[0]});
  assert(s.commitOrders());s.turn.navigation.stage='attack';s.events=[];return s;
}
function orbit(s,i,range=600){
  const a=i*.05*12*Math.PI/180;
  Object.assign(s.player,{x:6000+Math.sin(a)*range/2,y:0,z:-Math.cos(a)*range/2,heading:i*.6+90,turnRate:12});
  Object.assign(s.enemy,{x:6000-Math.sin(a)*range/2,y:0,z:Math.cos(a)*range/2,heading:i*.6+270,turnRate:12});
}

test('one and a half seconds of circling triggers a committed outward course without changing the turn plan',()=>{
  const s=duel(),orders=JSON.stringify(s.turn.orders),routes=JSON.stringify(s.turn.maneuvers);
  let aim,options;s.steerFlight=(ship,point)=>{aim=point;};s.adjustFlightSpeed=(ship,enemy,point,command)=>{options=command;};
  for(let i=0;i<29;i++){orbit(s,i);s.autoHelm(.05);assert.equal(s.turn.navigation.breakaway,undefined);}
  orbit(s,29);s.autoHelm(.05);
  const move=s.turn.navigation.breakaway;assert(move);assert.equal(aim,move.aim);assert.equal(options.mode,'breakaway');assert.equal(options.alignFirst,false);
  const out={x:s.player.x-s.enemy.x,z:s.player.z-s.enemy.z};
  assert((aim.x-s.player.x)*out.x+(aim.z-s.player.z)*out.z>0,'the new course opens distance');
  const course={...aim};
  for(let i=0;i<40;i++){orbit(s,60+i,1000);s.autoHelm(.05);assert.deepEqual(s.turn.navigation.breakaway.aim,course,'a moving enemy does not drag the breakaway heading around');}
  assert.equal(JSON.stringify(s.turn.orders),orders);assert.equal(JSON.stringify(s.turn.maneuvers),routes);
  for(let i=0;i<22;i++){orbit(s,100+i,1000);s.autoHelm(.05);}
  assert.equal(s.turn.navigation.breakaway,null);assert(s.turn.navigation.circleCooldown>0);
  assert.equal(s.events.filter(event=>event.type==='circling-breakaway').length,1);
});

test('brief turns, straight pursuit, closing range and intentional rams do not trigger a circling breakaway',()=>{
  for(const scenario of ['brief','straight','closing','opposite','ram','flee']){
    const s=duel(['ram','flee','direct'].includes(scenario)?scenario:'flank');
    for(let i=0;i<100;i++){
      orbit(s,scenario==='straight'?0:i,scenario==='closing'?1500-i*8:600);
      if(scenario==='brief'&&i>=15)s.enemy.turnRate=0;
      if(scenario==='opposite')s.enemy.turnRate=-12;
      assert.equal(s.circlingBreakaway(.05),null,scenario);
    }
  }
});

test('a Direct Assault circling breakaway returns to a fresh Direct Assault without spending orders',()=>{
  const s=duel('direct'),orders=JSON.stringify(s.turn.orders),routes=JSON.stringify(s.turn.maneuvers),n=s.turn.navigation;
  let aim,mode;s.steerFlight=(ship,point)=>{aim=point;};s.adjustFlightSpeed=(ship,target,point,options)=>{mode=options.mode;};
  for(let i=0;i<30;i++){orbit(s,i);s.autoHelm(.05);}
  assert(n.breakaway);assert.equal(n.breakaway.resumeManeuver,'direct');assert.equal(mode,'breakaway');
  n.flyPastComplete=true;n.flyPast={direction:{x:1,y:0,z:0},elapsed:4};n.breakaway.elapsed=6;
  orbit(s,31,1000);s.autoHelm(.05);
  assert.equal(n.breakaway,null);assert.equal(n.stage,'attack');assert.equal(s.turn.maneuver,'direct');
  assert.equal(mode,'attack');assert.equal(aim,s.enemy);assert.equal(n.flyPast,null);assert.equal(n.flyPastComplete,false);
  assert(n.circleCooldown>0);assert.equal(JSON.stringify(s.turn.orders),orders);assert.equal(JSON.stringify(s.turn.maneuvers),routes);
});

test('pausing does not consume circling detection or breakaway time',()=>{
  const s=duel();for(let i=0;i<20;i++){orbit(s,i);s.circlingBreakaway(.05);}
  const elapsed=s.turn.navigation.circleWatch.elapsed;
  for(let i=0;i<100;i++)s.circlingBreakaway(0);
  assert.equal(s.turn.navigation.circleWatch.elapsed,elapsed);
  for(let i=20;i<30;i++){orbit(s,i);s.circlingBreakaway(.05);}
  assert(s.turn.navigation.breakaway);
  for(let i=0;i<100;i++)s.circlingBreakaway(0);
  assert.equal(s.turn.navigation.breakaway.elapsed,0);
});

test('Yorktown independently breaks circling after 1.5 seconds while Enterprise keeps Direct Assault',()=>{
  const s=duel('direct');let enemyAim,enemyMode,playerAim;
  s.turn.navigation.circleCooldown=60;
  s.fire=()=>false;s.thinkEnemy=()=>{};
  s.steerFlight=(ship,aim)=>{if(ship===s.enemy)enemyAim=aim;else playerAim=aim;};
  s.adjustFlightSpeed=(ship,target,aim,options)=>{if(ship===s.enemy)enemyMode=options.mode;};
  for(let i=0;i<29;i++){orbit(s,i);s.tick(.05);assert(!s.enemyMind.breakaway);}
  orbit(s,29);s.tick(.05);
  assert(s.enemyMind.breakaway);assert.equal(enemyAim,s.enemyMind.breakaway.aim);assert.equal(enemyMode,'breakaway');
  assert.equal(playerAim,s.enemy);assert(!s.turn.navigation.breakaway);assert.equal(s.turn.maneuver,'direct');
  assert(s.events.some(event=>event.type==='circling-breakaway'&&event.ship==='Yorktown'));
  const elapsed=s.enemyMind.breakaway.elapsed;s.circlingBreakaway(0,s.enemy);assert.equal(s.enemyMind.breakaway.elapsed,elapsed);
  s.enemyMind.breakaway.elapsed=4;assert.equal(s.circlingBreakaway(.05,s.enemy),null);assert(s.enemyMind.circleReengageUntil>s.time);
  orbit(s,30,1000);s.tick(.05);assert.equal(enemyAim,s.player);assert.equal(enemyMode,'attack','Yorktown commits to a fresh attack after opening the circle');
});

test('one ship opening the circle prevents the other from starting a simultaneous retreat',()=>{
  const s=duel();
  for(let i=0;i<30;i++){orbit(s,i);s.circlingBreakaway(.05);s.circlingBreakaway(.05,s.enemy);}
  assert(s.turn.navigation.breakaway);assert(!s.enemyMind.breakaway);
  const t=duel('direct');
  for(let i=0;i<30;i++){orbit(t,i);t.circlingBreakaway(.05,t.enemy);}
  assert(t.enemyMind.breakaway);t.turn.maneuver='flank';
  for(let i=30;i<60;i++){orbit(t,i);t.circlingBreakaway(.05);}
  assert(!t.turn.navigation.breakaway,'Enterprise lets Yorktown complete the committed escape heading');
});

test('useful progress toward firing arc is not mistaken for stalled circling',()=>{
  const s=duel();
  for(let i=0;i<70;i++){
    orbit(s,i);s.player.heading+=i*.6;
    assert.equal(s.circlingBreakaway(.05),null,'the bow is steadily acquiring the enemy');
  }
});
