const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('the Class F shuttle snapshot contains finite, correctly oriented component outlines',()=>{
  const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/camera-shuttle-outline.js'),'utf8'),context);
  const outline=context.window.BattleCameraShuttleOutline,points=outline.paths.flat(),depths=points.map(p=>p[1]);
  assert.equal(outline.source,'ST-Command/class-f-shuttle.js');assert.equal(outline.paths.length,9);
  assert(points.every(p=>p.length===2&&p.every(Number.isFinite)));
  assert(Math.abs(Math.max(...depths)-Math.min(...depths)-1)<1e-5,'normalized length supports the 70 percent marker scale');
  const width=Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]));
  assert(width>.4&&width<.5,'preserve the narrow cabin and outboard engines of the Class F model');
  assert(outline.paths[0].some(p=>p[1]<-.4),'the cabin nose faces forward, matching camera gaze');
});
