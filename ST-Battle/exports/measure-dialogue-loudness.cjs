const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const ffmpeg='C:/Users/David Granholm/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const context={window:{BattleVoiceClips:{}}};
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/voices/voice-overrides.js'),'utf8'),context);
const files=new Map();
for(const filename of fs.readdirSync(path.join(root,'assets')))if(/_Alli(?:son|sion)\.mp3$/i.test(filename))files.set('assets/'+filename,'Allison');
for(const [key,file] of Object.entries(context.window.BattleVoiceClips)){
  if(/_Alli(?:son|sion)\.mp3$/i.test(file))continue;
  if(key.startsWith('captain\n')&&/_Declan\.mp3$/i.test(file))files.set(file,'Declan');
  else if(key.startsWith('helm\n'))files.set(file,'Erica');
}
const clips=[];
for(const [file,speaker] of files){
  const result=spawnSync(ffmpeg,['-hide_banner','-nostats','-i',path.join(root,file),'-af','loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json','-f','null','-'],{windowsHide:true,encoding:'utf8'});
  if(result.error||result.status!==0)throw result.error||Error(result.stderr);
  const json=result.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
  if(!json)throw Error('No loudness result for '+file);
  const measured=JSON.parse(json[0]);
  clips.push({file,speaker,...measured});
}
const median=values=>{const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};
const summary={};
for(const speaker of ['Allison','Declan','Erica']){
  const values=clips.filter(clip=>clip.speaker===speaker).map(clip=>Number(clip.input_i)).filter(Number.isFinite);
  summary[speaker]={clips:values.length,medianLUFS:median(values),quietestLUFS:Math.min(...values),loudestLUFS:Math.max(...values)};
}
const report={summary,referenceMedianLUFS:median(clips.filter(clip=>clip.speaker!=='Allison').map(clip=>Number(clip.input_i))),clips};
fs.writeFileSync(path.join(__dirname,'dialogue-loudness-before.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({summary,referenceMedianLUFS:report.referenceMedianLUFS},null,2));
