const fs=require('node:fs'),path=require('node:path');
const source='C:/Users/David Granholm/.codex/ST Battle';
const output=path.join(__dirname,'turn-wording');fs.mkdirSync(output,{recursive:true});
const word=text=>text.replace(/\bpasses\b/gi,m=>m==='PASSES'?'TURNS':m==='Passes'?'Turns':'turns').replace(/\bpass\b/gi,m=>m==='PASS'?'TURN':m==='Pass'?'Turn':'turn');
const phrases={
  'app.js':['one pass','PASS ${','complete pass','NEXT PASS','Pass ${','pass clock'],
  'engine.js':['Pass ${','next pass','PASS PLAN COMPLETE'],
  'planner.js':['Repair pass','This pass','per pass','one pass'],
  'replay.js':['No recorded pass available'],
};
for(const [file,list] of Object.entries(phrases)){
  let text=fs.readFileSync(path.join(source,file),'utf8');
  for(const phrase of list)text=text.replaceAll(phrase,word(phrase));
  fs.writeFileSync(path.join(output,file),text);
}
let html=fs.readFileSync(path.join(source,'index.html'),'utf8');
html=html.split(/(<[^>]+>)/g).map(part=>part.startsWith('<')?part.replace(/((?:aria-label|title)=")([^"]*)(")/g,(_,a,text,b)=>a+word(text)+b):word(part)).join('');
fs.writeFileSync(path.join(output,'index.html'),html);
let readme=fs.readFileSync(path.join(source,'README.md'),'utf8').replace('pass harmlessly','travel harmlessly').replace('close passes','close approaches');
fs.writeFileSync(path.join(output,'README.md'),word(readme));
console.log('Updated interface labels, help, command messages, planning text, replay errors and README.');
