const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const ffmpeg='C:/Users/David Granholm/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const before=JSON.parse(fs.readFileSync(path.join(__dirname,'dialogue-loudness-before.json'),'utf8'));
// The existing Declan/Erica reference median is -15.64 LUFS; round to -16.
const target=-16;
const originals=path.join(__dirname,'allison-volume-originals');
const staging=path.join(__dirname,'allison-loudness-matched');
fs.mkdirSync(staging,{recursive:true});
function run(args){
  const result=spawnSync(ffmpeg,['-hide_banner','-nostats',...args],{encoding:'utf8',windowsHide:true});
  if(result.error||result.status!==0)throw result.error||Error(result.stderr);
  return result.stderr;
}
function measure(file,prefilter=''){
  const log=run(['-i',file,'-af',`${prefilter?prefilter+',':''}loudnorm=I=${target}:TP=-1.5:LRA=11:print_format=json`,'-f','null','-']);
  const found=log.match(/\{\s*"input_i"[\s\S]*?\}/);if(!found)throw Error('No loudness measurement: '+file);
  return JSON.parse(found[0]);
}
const matched=[];
for(const clip of before.clips.filter(clip=>clip.speaker==='Allison')){
  const name=path.basename(clip.file),original=path.join(originals,name),output=path.join(staging,name);
  if(!fs.existsSync(original))throw Error('Original missing: '+name);
  // Tame peaks only when a plain gain change cannot reach the reference safely.
  const needsCompression=Number(clip.input_tp)+target-Number(clip.input_i)>-2;
  const compressor=needsCompression?'acompressor=threshold=0.0631:ratio=4:attack=1:release=80:makeup=1':'';
  const measured=measure(original,compressor);
  const filter=`${compressor?compressor+',':''}loudnorm=I=${target}:TP=-1.5:LRA=11:measured_I=${measured.input_i}:measured_LRA=${measured.input_lra}:measured_TP=${measured.input_tp}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`;
  run(['-y','-i',original,'-map','0:a:0','-map_metadata','-1','-af',filter,'-ar','48000','-c:a','libmp3lame','-q:a','2',output]);
  const after=measure(output),loudness=Number(after.input_i),peak=Number(after.input_tp);
  if(!Number.isFinite(loudness)||Math.abs(loudness-target)>.6||!Number.isFinite(peak)||peak>-.5)throw Error(`Loudness verification failed for ${name}: ${loudness} LUFS / ${peak} dBTP`);
  matched.push({file:clip.file,targetLUFS:target,beforeLUFS:Number(clip.input_i),afterLUFS:loudness,truePeakDBTP:peak,compressed:needsCompression,bytes:fs.statSync(output).size});
}
// All files must pass audio verification before any active assets are replaced.
for(const clip of matched)fs.copyFileSync(path.join(staging,path.basename(clip.file)),path.join(root,clip.file));
const manifestFile=path.join(__dirname,'additional-voice-clips/clip-manifest.json');
const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
for(const clip of manifest){
  const match=matched.find(entry=>path.basename(entry.file)===clip.filename);
  if(match){clip.bytes=match.bytes;delete clip.volumeGain;clip.loudnessLUFS=match.afterLUFS;}
}
fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'allison-loudness-matched.json'),JSON.stringify({referenceMedianLUFS:before.referenceMedianLUFS,targetLUFS:target,playbackVolume:.85,matched},null,2)+'\n');
console.log(JSON.stringify({clips:matched.length,targetLUFS:target,quietestLUFS:Math.min(...matched.map(clip=>clip.afterLUFS)),loudestLUFS:Math.max(...matched.map(clip=>clip.afterLUFS)),highestTruePeakDBTP:Math.max(...matched.map(clip=>clip.truePeakDBTP))},null,2));
