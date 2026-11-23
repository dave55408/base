const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Battle=require('../engine.js'),Replay=require('../replay.js');
function record(){
 const sim=new Battle.Simulation(),frame={player:sim.player,enemy:sim.enemy,stageIndex:0,maneuver:'direct',phase:'attack',projectiles:[]};
 return {sim,record:{pass:1,startTime:0,duration:30,station:sim.station,planet:sim.planet,environment:'space',result:null,endHold:0,frames:[{...frame,at:0},{...frame,player:{...sim.player,x:300},at:30}],events:[{at:4,event:{type:'beam',from:'Enterprise',to:'Yorktown'}},{at:20,event:{type:'bridge-dialogue',order:'Report.'}}]}};
}
test('HD full-turn playback preserves every second, position and event without quiet-scene cuts',()=>{
 const {sim,record:r}=record(),before=JSON.stringify(r),player=new Replay.Player(r,sim,{fullTurn:true}),events=[];
 for(let i=0;i<300;i++){
  const update=player.advance(.1);assert.equal(update.cut,false);assert.equal(update.rate,1);assert(Math.abs(player.position-(i+1)*.1)<1e-8);assert(Math.abs(player.state.player.x-player.position*10)<1e-8);events.push(...update.events);
 }
 assert.deepEqual(events,r.events.map(e=>e.event));assert.equal(JSON.stringify(r),before);
 assert.equal(player.sequences.length,1);assert.equal(player.sequences[0].end,r.duration);
});
function viewFixture({fail=false}={}){
 const {sim,record:r}=record(),elements={},calls=[],scene={renderer:{domElement:{width:800,height:450}},reset(){},setCamera(){},update(){},setReplayHD(value){calls.push(['model',value]);this.renderer.domElement={width:value?3840:800,height:value?2160:450};}};
 const element=()=>({textContent:'',addEventListener(){},setAttribute(){},close(){}}),document={getElementById:id=>elements[id]??=element()};
 let finish,loaded;const ready=new Promise(r=>loaded=r);
 class Exporter{
  static supported(){return true;}async prepare(){calls.push(['audio']);}start(canvas){calls.push(['record',canvas.width,canvas.height]);this.recording=true;return new Promise(r=>finish=r);}mp4(blob){return Promise.resolve(blob);}download(blob,pass,options){calls.push(['download',pass,options.hd]);}dispose(){calls.push(['dispose']);}cancel(){this.cancelled=true;finish?.({});}
 }
 const context={window:{BattleReplayExporter:Exporter,BattleReplayHD:{async load(){calls.push(['load']);await ready;if(fail)throw Error('HD load failed');}}},document,Battle,BattleReplay:Replay};
 vm.runInNewContext(fs.readFileSync('replay-view.js','utf8'),context);
 const view=new context.window.BattleReplayView(sim,{stopSound(){},resetDialogue(){},changed(){},error(message){calls.push(['error',message]);}});
 view.active=true;view.record=r;view.scene=scene;view.player=new Replay.Player(r,sim);
 return {view,calls,elements,loaded,finish:()=>finish({})};
}
test('Replay in HD starts full-turn playback without preparing or recording a download',async()=>{
 const f=viewFixture(),done=f.view.replayHD();assert(f.view.player.paused);assert(f.elements['replay-download'].disabled);
 f.loaded();await done;assert(f.view.player.fullTurn);assert(!f.view.player.paused);assert(f.view.hd);assert.equal(f.view.exporter,undefined);
 assert.deepEqual(f.calls,[['load'],['model',true]]);assert.equal(f.elements['replay-record-hd'].textContent,'Replay in HD');
 f.view.player.position=10;await f.view.replayHD();assert.equal(f.view.player.position,0);assert(f.view.player.fullTurn);assert.equal(f.calls.length,2,'replays the loaded model');
});
test('closing during HD preparation prevents a late model swap or replay restart',async()=>{
 const f=viewFixture(),done=f.view.replayHD();f.view.close();f.loaded();await done;
 assert(!f.calls.some(c=>['model','record','download'].includes(c[0])));assert.equal(f.view.active,false);assert.equal(f.view.hdRequest,null);
});
test('Download MP4 restarts the selected HD replay at 4K and keeps HD selected',async()=>{
 const f=viewFixture();f.loaded();await f.view.replayHD();f.view.player.position=10;
 const done=f.view.download();await new Promise(r=>setImmediate(r));assert.equal(f.view.player.position,0);assert(f.view.player.fullTurn);assert(f.calls.some(c=>c[0]==='record'&&c[1]===3840&&c[2]===2160));
 f.finish();await done;assert(f.calls.some(c=>c[0]==='download'&&c[2]===true));assert(f.view.hd);assert.equal(f.view.exporter,null);assert(!f.calls.some(c=>c[0]==='model'&&c[1]===false));
});
test('cancelling an HD download skips the file and keeps the HD replay available',async()=>{
 const f=viewFixture();f.loaded();await f.view.replayHD();const done=f.view.download();await new Promise(r=>setImmediate(r));f.view.cancelExport();await done;
 assert(!f.calls.some(c=>c[0]==='download'));assert(f.view.hd);assert(f.view.player.paused);assert.equal(f.view.exporter,null);
});
test('HD load failure leaves playback paused and retry available',async()=>{
 const f=viewFixture({fail:true}),done=f.view.replayHD();f.loaded();await done;
 assert(f.calls.some(c=>c[0]==='error'&&c[1]==='HD load failed'));assert.equal(f.view.hdRequest,null);assert(f.view.player.paused);assert.equal(f.elements['replay-record-hd'].disabled,false);
});
