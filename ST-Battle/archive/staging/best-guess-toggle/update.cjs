const fs=require('fs'),path=require('path');
const root='C:/Users/David Granholm/.codex/ST Battle';
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const write=(f,s)=>fs.writeFileSync(path.join(__dirname,f),s);
let app=read('app.js');
app=app.replace('let resultSaved=false,newBest=false,calloutUntil=0;','let resultSaved=false,newBest=false,calloutUntil=0,bestGuessEnabled=false;')
 .replace("$('random-continue').checked=false;",'bestGuessEnabled=false;')
 .replace("  $('random-turn').onclick=bestGuessTurn;\r\n  $('random-continue').onchange=()=>{\r\n    if($('random-continue').checked&&canBestGuessTurn())bestGuessTurn();", "  $('random-turn').onclick=()=>{\r\n    if($('random-turn').disabled)return;\r\n    bestGuessEnabled=!bestGuessEnabled;\r\n    if(bestGuessEnabled&&canBestGuessTurn())bestGuessTurn();")
 .replace("$('random-turn').disabled=!canBestGuessTurn();\r\n    $('random-continue').disabled=!scene||!sim.turnBased||!!sim.freeFlight||!!sim.result;", "$('random-turn').disabled=!scene||!sim.turnBased||!!sim.freeFlight||!!sim.result;\r\n    $('random-turn').setAttribute('aria-pressed',String(bestGuessEnabled));")
 .replace("sim.running&&$('random-continue').checked",'sim.running&&bestGuessEnabled');
if(app.includes('random-continue'))throw Error('Old Continue references remain');
write('app.js',app);
let html=read('index.html').replace(/<label class="continue-random">.*?<\/label>/,'')
 .replace('id="random-turn" type="button" title="Enterprise captain: choose the best-rated plan from current sensor information and ship condition"','id="random-turn" type="button" aria-pressed="false" title="Toggle automatic Best Guess plans for this and following turns"');
write('index.html',html);
let css=read('style.css').replace(/^.*\.continue-random.*\r?\n/gm,'');
css+='\n#game-shell .captain-orders .commit-actions #random-turn[aria-pressed="true"]{background:#3a2c19;border-color:var(--amber);color:#ffe0a6;box-shadow:inset 0 0 0 1px var(--amber)}\n';
write('style.css',css);
let test=read('test/interface.test.cjs')
 .replace("Random sits beside Commit, starts a full random turn, and is unavailable during execution","Best Guess toggles on beside Commit and stays available during execution")
 .replace("  assert(html.indexOf('id=\"random-turn\"')<html.indexOf('id=\"random-continue\"'));", "  assert(!html.includes('id=\"random-continue\"'));\n  assert.match(html, /id=\"random-turn\"[^>]*aria-pressed=\"false\"/);")
 .replace("assert.match(html,/> Best Guess Continue<\\/label>/);", "assert(!html.includes('Best Guess Continue'));")
 .replace("assert.equal(e['random-turn'].disabled,true);\r\n  assert.equal(sim.captainEnabled,true);", "assert.equal(e['random-turn'].disabled,false);\n  assert.equal(e['random-turn'].attrs['aria-pressed'],'true');\n  assert.equal(sim.captainEnabled,true);")
 .replace('Continue creates fresh random turns and unchecking stops after the current turn','Best Guess continues across turns and toggling off finishes only the current turn')
 .replaceAll("e['random-continue'].checked=true;e['random-continue'].onchange();", "e['random-turn'].onclick();assert.equal(e['random-turn'].attrs['aria-pressed'],'true');")
 .replace("e['random-continue'].checked=false;e['random-continue'].onchange();", "e['random-turn'].onclick();assert.equal(e['random-turn'].attrs['aria-pressed'],'false');")
 .replace('unchecking does not cancel the current turn','toggling off does not cancel the current turn')
 .replace("e['random-continue'].disabled,true", "e['random-turn'].disabled,true")
 .replace("e['random-continue'].checked,false", "e['random-turn'].attrs['aria-pressed'],'false'");
write('test/interface.test.cjs',test);
