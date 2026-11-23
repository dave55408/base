const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const ffmpeg = process.env.FFMPEG_PATH || 'C:/Users/David Granholm/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const sourceRoot = 'C:/Users/David Granholm/.codex/.Project Research/Star Trek/battle';
// Times mark spoken content; add short handles without including adjacent lines.
const recordings = [
  { source: 'Allison_direct reponses.mp3', suffix: 'Allision', clips: [
    ['Direct hit to Yorktown!', 0, 1.602042],
    ["We've lost the port engine!", 3.445750, 5.214167],
    ["We've lost the starboard engine!", 7.093708, 9.059333],
    ['We missed!', 11.188167, 11.795250],
    ["They're out of range", 13.905958, 14.900958],
    ["They're back in range", 16.887333, 17.982875],
    ["I'll try", 19.809875, 20.532875],
    ['That might be hard', 22.241292, 23.348083],
    ['We took a direct hit!', 25.201417, 26.306125],
    ['Direct Hit!', 26.699333, 27.386875],
    ["I'll do what I can", 28.888917, 29.910542],
    ['We took a direct hit! (take 2)', 31.764042, 33.260667],
    ["We're losing power", 35.110792, 36.268667],
    ['On screen', 38.125917, 38.856208],
    ["No response. They're jamming our frequencies", 40.760625, 43.653708],
    ['Shields down to [X] percent!', 45.448583, 47.275750],
    ['Phasers offline!', 49.369833, 50.887958],
    ['Warp drive is down!', 53.095875, 54.484667],
    ['Brace for impact!', 56.352958, 57.728542],
  ]},
  { source: 'Declan_AdditonalCommands.mp3', suffix: 'Declan', clips: [
    ['Open hailing frequencies', 0, 1.938292],
    ['Red alert. All hands battle stations', 3.802958, 6.605292],
    ['Shields up', 8.305042, 9.060208],
    ['Raise shields', 9.418042, 10.697583],
    ['Evasive maneuvers', 12.373000, 13.638458],
    ['Divert auxiliary power to forward shields', 15.291167, 18.549667],
    ['Lock phasers on target', 20.228125, 21.784417],
    ['Arm photon torpedoes', 23.536292, 25.444417],
    ['Target their weapons', 27.162750, 28.502792],
    ['Target their engines', 30.191167, 31.772917],
    ['Target their shields', 33.136208, 34.555250],
    ['Target their shields (take 2)', 36.253542, 37.612292],
    ['Fire', 40.055667, 40.621083],
    ['Fire at will', 42.405792, 43.372542],
    ["Fire everything we've got", 45.173000, 46.728750],
    ['Damage report', 48.159875, 49.039167],
  ]},
];

function run(args) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-v', 'error', ...args], { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) throw result.error || new Error(result.stderr);
  return result;
}

const manifest = [];
for (const recording of recordings) {
  for (const [command, speechStart, speechEnd] of recording.clips) {
    const filename = `${command}_${recording.suffix}.mp3`;
    const output = path.join(root, 'assets', filename);
    if (fs.existsSync(output)) throw new Error(`Refusing to overwrite existing clip: ${filename}`);
    const start = Math.max(0, speechStart - 0.100);
    const end = speechEnd + 0.160;
    run(['-n', '-i', path.join(sourceRoot, recording.source), '-ss', start.toFixed(6), '-t', (end - start).toFixed(6), '-map', '0:a:0', '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '64k', output]);
    run(['-i', output, '-f', 'null', '-']);
    manifest.push({ filename, source: recording.source, command, start, end, duration: +(end - start).toFixed(6), bytes: fs.statSync(output).size });
  }
}
fs.writeFileSync(path.join(__dirname, 'clip-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Exported and decode-verified ${manifest.length} clips.`);
