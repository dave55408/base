const fs=require('fs'),root='attack-budget-fix/';
for(const file of fs.readdirSync(root+'test').filter(f=>f.endsWith('.test.cjs'))){let s=fs.readFileSync(root+'test/'+file,'utf8');
s=s.replaceAll("['phaser','phaser','torpedo']","['phaser','phaser','torpedo','phaser','phaser','phaser','torpedo']");
s=s.replace(/(range:\[[\d,]+\])\[i\]/g,'$1[i%3]').replaceAll('maneuvers:assigned[i]','maneuvers:assigned[i%assigned.length]');
s=s.replace(/(filter\([^\n;]*?weapon==='phaser'\)\.length),2\)/g,'$1,5)').replace(/(filter\([^\n;]*?weapon==='torpedo'\)\.length),1\)/g,'$1,2)');
s=s.replaceAll('turn.orders.length,3','turn.orders.length,7').replaceAll('turn.enemyOrders.length,3','turn.enemyOrders.length,7');
if(file==='attack-assignments.test.cjs')s=s.replaceAll('s.shots,3','s.shots,7').replaceAll('torpedoes,23','torpedoes,22').replaceAll('{phaser:2,torpedo:1}','{phaser:5,torpedo:2}');
if(file==='interface.test.cjs'){s=s.replaceAll("['shield-fore','bridge','mainEngines'][i]","['shield-fore','bridge','mainEngines'][i%3]").replaceAll('[1100,800,600][i]','[1100,800,600][i%3]');s=s.replaceAll('sim.turn.draft,[null,null,null]','sim.turn.draft,Array(7).fill(null)').replaceAll("[[0],[0],[0]]","Array.from({length:7},()=>[0])");}
fs.writeFileSync(root+'test/'+file,s);}
let s=fs.readFileSync(root+'test/turns.test.cjs','utf8');s=s.replace("[{weapon:'phaser',target,range},{weapon:'phaser',target,range},{weapon:'torpedo',target,range}]","['phaser','phaser','torpedo','phaser','phaser','phaser','torpedo'].map(weapon=>({weapon,target,range}))").replace("...plan().slice(0,2)","...plan().slice(0,2),...plan().slice(3)");fs.writeFileSync(root+'test/turns.test.cjs',s);
