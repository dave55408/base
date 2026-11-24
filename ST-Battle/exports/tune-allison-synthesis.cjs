const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const ffmpeg=process.env.FFMPEG_PATH||'C:/Users/David Granholm/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
function run(args){
  const result=spawnSync(ffmpeg,['-hide_banner','-v','error',...args],{windowsHide:true,maxBuffer:16*1024*1024});
  if(result.error||result.status!==0)throw result.error||Error(result.stderr.toString());
  return result.stdout;
}
const median=a=>{const b=a.slice().sort((x,y)=>x-y);return b[Math.floor(b.length/2)];};
function measure(file){
  const pcm=run(['-i',path.join(root,file),'-ar','16000','-ac','1','-f','f32le','-']);
  const samples=Array.from({length:pcm.length/4},(_,i)=>pcm.readFloatLE(i*4));
  const frames=[];
  for(let start=0;start+960<samples.length;start+=160){
    const frame=samples.slice(start,start+960);
    const rms=Math.sqrt(frame.reduce((s,v)=>s+v*v,0)/frame.length);
    frames.push({frame,rms,start});
  }
  const threshold=Math.max(...frames.map(f=>f.rms))*.12;
  const pitches=[],active=frames.filter(f=>f.rms>threshold);
  for(const {frame} of active){
    let sum=0;const yin=[1];
    for(let lag=1;lag<=240;lag++){
      let diff=0;for(let i=0;i<640;i++)diff+=(frame[i]-frame[i+lag])**2;
      sum+=diff;yin[lag]=sum?diff*lag/sum:1;
    }
    for(let lag=40;lag<239;lag++)if(yin[lag]<.15){
      while(lag<239&&yin[lag+1]<yin[lag])lag++;
      pitches.push(16000/lag);break;
    }
  }
  return {file,medianPitchHz:median(pitches),voicedFrames:pitches.length,activeSeconds:active.length*.01,spanSeconds:active.length?(active.at(-1).start-active[0].start+960)/16000:0};
}
const files=['assets/We missed!_Allision.mp3','assets/TorpedoMissed_Allision.mp3','assets/Direct hit to Yorktown!_Allision.mp3',"assets/They're out of range_Allision.mp3",'assets/Torpedo incoming!_Allison.mp3','assets/voices/allison-yorktown-missed-synth.mp3'];
const baseline='exports/allison-yorktown-missed-original.mp3';
if(process.argv.includes('--apply')&&!fs.existsSync(path.join(root,baseline)))fs.copyFileSync(path.join(root,files.at(-1)),path.join(root,baseline));
const measurements=files.slice(0,-1).map(measure);
const original=measure(fs.existsSync(path.join(root,baseline))?baseline:files.at(-1));
const referencePitch=median(measurements.map(m=>m.medianPitchHz));
const pitchRatio=referencePitch/original.medianPitchHz;
// A modest tempo change tightens the report without forcing every phrase to
// the speed of the shortest, most urgent reference. Preserve vowel formants.
const tempo=1.25;
const filter=`rubberband=pitch=${pitchRatio}:tempo=${tempo}:formant=preserved,loudnorm=I=-16:TP=-2:LRA=11`;
if(process.argv.includes('--apply')){
  if(!Number.isFinite(pitchRatio)||pitchRatio<.8||pitchRatio>1.3)throw Error('Unexpected pitch measurement; review references before applying.');
  const staging='exports/allison-yorktown-missed-tuned.mp3';
  run(['-y','-i',path.join(root,baseline),'-af',filter,'-ar','48000','-c:a','libmp3lame','-q:a','2',path.join(root,staging)]);
  run(['-i',path.join(root,staging),'-f','null','-']);
  fs.copyFileSync(path.join(root,staging),path.join(root,files.at(-1)));
}
const report={method:'Offline acoustic measurements; no listening evaluation',referenceClips:measurements,original,referencePitchHz:referencePitch,pitchRatio,tempo,filter,current:measure(files.at(-1))};
fs.writeFileSync(path.join(__dirname,'allison-synthesis-comparison.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
