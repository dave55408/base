const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const ffmpeg='C:/Users/David Granholm/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const backup=path.join(__dirname,'allison-volume-originals');
fs.mkdirSync(backup,{recursive:true});
const entries=[];
for(const filename of fs.readdirSync(path.join(root,'assets')).filter(name=>/_Alli(?:son|sion)\.mp3$/i.test(name))){
  const source=path.join(root,'assets',filename),original=path.join(backup,filename),temp=path.join(backup,'boosted.mp3');
  if(!fs.existsSync(original))fs.copyFileSync(source,original,fs.constants.COPYFILE_EXCL);
  // Always start from the backup so rerunning cannot compound the gain.
  const result=spawnSync(ffmpeg,['-hide_banner','-v','error','-y','-i',original,'-af','volume=1.1,alimiter=limit=0.98:level=false:latency=true','-c:a','libmp3lame','-q:a','2',temp],{encoding:'utf8',windowsHide:true});
  if(result.error||result.status!==0)throw result.error||new Error(result.stderr);
  const check=spawnSync(ffmpeg,['-v','error','-i',temp,'-f','null','-'],{encoding:'utf8',windowsHide:true});
  if(check.error||check.status!==0)throw check.error||new Error(check.stderr);
  fs.copyFileSync(temp,source);fs.unlinkSync(temp);
  entries.push({filename,gain:1.1,originalBytes:fs.statSync(original).size,bytes:fs.statSync(source).size});
}
fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify(entries,null,2)+'\n');
console.log(`Boosted and decode-verified ${entries.length} Allison clips by 10%.`);
