const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const ffmpeg='C:/Users/David Granholm/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const source='C:/Users/David Granholm/.codex/.Project Research/Star Trek/battle/Declan_intro.mp3';
const clips=[
  ['Welcome introduction',0,10.920375],
  ["Yorktown's closing. Shields up. We need to stop her here. Helm, take us in",12.023875,17.063083],
  ["Yorktown's closing. Shields up. Helm, take us in",18.262417,21.879375],
  ['We must disable or destroy the Yorktown',23.263833,26.475792],
  ['I gave my best',27.766667,29.097333],
  ['We gave it our all',30.273,31.586708],
];
function run(args){
  const result=spawnSync(ffmpeg,['-hide_banner','-v','error',...args],{encoding:'utf8',windowsHide:true});
  if(result.error||result.status!==0)throw result.error||new Error(result.stderr);
}
const manifest=[];
// Preflight all names so an existing asset can never be overwritten.
for(const [name] of clips)if(fs.existsSync(path.join(root,'assets',name+'_Declan.mp3')))throw Error('Clip already exists: '+name);
for(const [name,speechStart,speechEnd] of clips){
  const filename=name+'_Declan.mp3',output=path.join(root,'assets',filename);
  const start=Math.max(0,speechStart-.100),end=speechEnd+.160;
  run(['-n','-i',source,'-ss',start.toFixed(6),'-t',(end-start).toFixed(6),'-map','0:a:0','-map_metadata','-1','-c:a','libmp3lame','-b:a','64k',output]);
  run(['-i',output,'-f','null','-']);
  manifest.push({filename,source,start,end,duration:+(end-start).toFixed(6),bytes:fs.statSync(output).size});
}
fs.writeFileSync(path.join(__dirname,'clip-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Saved and decode-verified ${manifest.length} Declan clips in assets.`);
