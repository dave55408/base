const fs=require('node:fs');
function replace(source,from,to){if(!source.includes(from))throw Error('Expected source missing: '+from);return source.replace(from,to);}
let scene=fs.readFileSync(__dirname+'/scene.js','utf8');
scene=replace(scene,"this.mode==='chase'&&sim.contact","['chase','cinematic'].includes(this.mode)&&sim.contact");
scene=replace(scene,"if(this.mode==='chase'){","if(this.mode==='chase'||this.mode==='cinematic'){");
scene=replace(scene,"setCamera(mode){this.closeFraming=false;this.mode=mode;this.orbit={x:0,y:0};this.zoom=1;}","setCamera(mode){const chaseStyle=value=>value==='chase'||value==='cinematic';const preserve=mode!==this.mode&&chaseStyle(mode)&&chaseStyle(this.mode);this.mode=mode;if(!preserve){this.closeFraming=false;this.orbit={x:0,y:0};this.zoom=1;}}");
scene=scene.replace(/\}else if\(this\.mode==='cinematic'\)\{\r?\n[^\n]*\r?\n    \}else\{/,'}else{');
if(scene.includes("}else if(this.mode==='cinematic'){"))throw Error('Orbit removal failed');
fs.writeFileSync(__dirname+'/scene.js',scene);
let app=fs.readFileSync(__dirname+'/app.js','utf8');
app=replace(app,'function camera(mode){scene?.setCamera(mode);',"function camera(mode){scene?.setCamera(mode);$('game-shell').classList.toggle('cinema-view',mode==='cinematic'&&!replayView?.active);");
app=replace(app,"cinematic:'CINEMATIC ORBIT'","cinematic:'CINEMA VIEW'");
app=replace(app,'function ui(){',"function ui(){\n    $('game-shell').classList.toggle('cinema-view',scene?.mode==='cinematic'&&!replayView?.active);");
fs.writeFileSync(__dirname+'/app.js',app);
fs.appendFileSync(__dirname+'/style.css','\n#game-shell.cinema-view #battle-screen > :not(#viewport):not(.view-bottom):not(#launch-card):not(#result){display:none!important}\n#game-shell.cinema-view #battle-screen .view-tip{display:none!important}\n');
