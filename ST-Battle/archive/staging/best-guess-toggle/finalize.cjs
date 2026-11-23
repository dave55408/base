const fs=require('node:fs'),path=require('node:path');
const source='C:/Users/David Granholm/.codex/ST Battle';
const read=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
const write=(f,s)=>fs.writeFileSync(path.join(__dirname,f),s);
let app=read('app.js').replace("$('combat-callout').hidden=true;bestGuessEnabled=false;", "$('combat-callout').hidden=true;");
app=app.replace("$('random-turn').setAttribute('aria-pressed',String(bestGuessEnabled));", "$('random-turn').setAttribute('aria-checked',String(bestGuessEnabled));\n    text('best-guess-state',bestGuessEnabled?'ON':'OFF');");
write('app.js',app);
write('index.html',read('index.html').replace('id="random-turn" type="button" aria-pressed="false"','id="random-turn" type="button" role="switch" aria-checked="false" aria-label="Best Guess"').replace('>Best Guess</button>','><span>Best Guess</span><span class="best-guess-track" aria-hidden="true"></span><span id="best-guess-state" aria-hidden="true">OFF</span></button>'));
write('style.css',read('style.css').replace('minmax(0,1fr) minmax(0,1fr) auto auto','minmax(0,1fr) minmax(0,1fr) auto').replaceAll('#random-turn[aria-pressed="true"]','#random-turn[aria-checked="true"]')+`
#game-shell .captain-orders .commit-actions #random-turn{display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}
#random-turn .best-guess-track{display:inline-block;position:relative;width:28px;height:16px;flex-shrink:0;border:1px solid currentColor;border-radius:12px;background:#18202a}
#random-turn .best-guess-track::after{content:"";position:absolute;top:2px;left:2px;width:10px;height:10px;border-radius:50%;background:currentColor;transition:transform .15s}
#random-turn[aria-checked="true"] .best-guess-track{background:#725323}
#random-turn[aria-checked="true"] .best-guess-track::after{transform:translateX(12px)}
#best-guess-state{min-width:3ch;font:10px var(--mono)}
#random-turn:focus-visible{outline:2px solid var(--amber);outline-offset:3px}
@media(prefers-reduced-motion:reduce){#random-turn .best-guess-track::after{transition:none}}
`);
let test=read('test/interface.test.cjs').replaceAll("['aria-pressed']","['aria-pressed']");
test=test.replaceAll("e['random-turn'].attrs['aria-pressed']","e['random-turn'].attrs['aria-checked']").replace('aria-pressed="false"/);','role="switch"[^>]*aria-checked="false"/);').replace('assert.match(html,/>Best Guess<\\/button>/);','assert.match(html,/>Best Guess<\\/span>/);').replace("e.rematch.onclick();assert.equal(e['random-turn'].attrs['aria-checked'],'false');", "e.rematch.onclick();assert.equal(e['random-turn'].attrs['aria-checked'],'true');\n  e['random-turn'].onclick();assert.equal(e['random-turn'].attrs['aria-checked'],'false');\n  assert.equal(e['best-guess-state'].textContent,'OFF');");
write('test/interface.test.cjs',test);
let readme=fs.readFileSync(path.join(source,'README.md'),'utf8').replace('Best Guess commits the highest-rated tactical plan based on current sensor information, Enterprise condition and remembered contacts. Check **Best Guess Continue** to let the captain plan and commit each following turn; uncheck it to stop after the current turn.','Switch **Best Guess** ON to commit the highest-rated tactical plan based on current sensor information, Enterprise condition and remembered contacts, then automatically plan and commit each following turn. It stays ON across turns and rematches until switched OFF. Switching OFF lets the current turn finish and stops automatic planning of following turns.').replaceAll('Best Guess / Best Guess Continue','the Best Guess toggle').replaceAll('Best Guess Continue can take over again','Best Guess, when ON, can take over again');
write('README.md',readme);
for(const file of fs.readdirSync(source))if(file.endsWith('.js')&&!['app.js'].includes(file))fs.copyFileSync(path.join(source,file),path.join(__dirname,file));
for(const file of fs.readdirSync(path.join(source,'test')))if(file!=='interface.test.cjs')fs.copyFileSync(path.join(source,'test',file),path.join(__dirname,'test',file));
