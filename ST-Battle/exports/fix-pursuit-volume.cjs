const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const ffmpeg='C:/Users/David Granholm/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const file='assets/Pursuit course_Allison.mp3',source=path.join(root,file);
const directory=path.join(__dirname,'pursuit-volume-fix');
fs.mkdirSync(directory,{recursive:true});
function run(args){
  const result=spawnSync(ffmpeg,['-hide_banner','-nostats',...args],{encoding:'utf8',windowsHide:true});
  if(result.error||result.status!==0)throw result.error||Error(result.stderr);
  return result.stderr;
}
function measure(filename,prefilter=''){
  const output=run(['-i',filename,'-af',(prefilter?prefilter+',':'')+'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-']);
  return JSON.parse(output.match(/\{\s*"input_i"[\s\S]*?\}/)[0]);
}
const before=measure(source);
if(Math.abs(Number(before.input_i)+16)<.3){console.log('Clip already matches -16 LUFS.');process.exit(0);}
const backup=path.join(directory,'Pursuit course_Allison.before.mp3');
if(!fs.existsSync(backup))fs.copyFileSync(source,backup);
const compressed=Number(before.input_tp)-16-Number(before.input_i)>-2;
const prefilter=compressed?'acompressor=threshold=0.0631:ratio=4:attack=1:release=80:makeup=1':'';
const measured=measure(source,prefilter);
const filter=(prefilter?prefilter+',':'')+`loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${measured.input_i}:measured_LRA=${measured.input_lra}:measured_TP=${measured.input_tp}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`;
const output=path.join(directory,'Pursuit course_Allison.normalized.mp3');
run(['-y','-i',source,'-map','0:a:0','-map_metadata','-1','-af',filter,'-ar','48000','-c:a','libmp3lame','-q:a','2',output]);
const after=measure(output),loudness=Number(after.input_i),peak=Number(after.input_tp);
if(!Number.isFinite(loudness)||Math.abs(loudness+16)>.4||!Number.isFinite(peak)||peak> -1)throw Error(`Verification failed: ${loudness} LUFS / ${peak} dBTP`);
fs.copyFileSync(output,source);
const entry={file,targetLUFS:-16,beforeLUFS:Number(before.input_i),afterLUFS:loudness,truePeakDBTP:peak,compressed,bytes:fs.statSync(source).size};
const reportPath=path.join(__dirname,'allison-loudness-matched.json'),report=JSON.parse(fs.readFileSync(reportPath,'utf8'));
const index=report.matched.findIndex(clip=>clip.file===file);
if(index>=0)report.matched[index]=entry;
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(directory,'measurement.json'),JSON.stringify({...entry,playbackVolume:.85,backup:path.relative(root,backup)},null,2)+'\n');
console.log(JSON.stringify(entry,null,2));
