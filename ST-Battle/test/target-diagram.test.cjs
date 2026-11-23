const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),B=require('../engine.js');
function diagram(){
  const elements=Object.fromEntries(Object.keys(B.targets).map(k=>['target-'+k,{style:{}}]));
  const drawing=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  const canvas={handlers:{},setAttribute(){},getContext:()=>drawing,addEventListener(k,fn){this.handlers[k]=fn;},setPointerCapture(){},getBoundingClientRect:()=>({left:10,top:20})};
  const host={clientWidth:600,clientHeight:360,prepend(){}};
  const context={window:{},Battle:B,document:{createElement:()=>canvas,getElementById:id=>elements[id]},devicePixelRatio:1};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../target-diagram.js'),'utf8'),context);
  let selected;const view=new context.window.BattleTargetDiagram(host,k=>selected=k);return {view,canvas,elements,drawing,selected:()=>selected};
}
test('Yorktown target wireframe is true perspective geometry with a 3D anchor for every target',()=>{
  const {view}=diagram();assert(view.lines.length>40);assert.deepEqual(Object.keys(view.constructor.anchors).sort(),Object.keys(B.targets).sort());
  for(const yaw of [0,Math.PI/2,Math.PI])for(const pitch of [-1.5,0,1.5]){
    view.yaw=yaw;view.pitch=pitch;
    for(const line of view.lines)for(const vertex of line.points){assert.equal(vertex.length,3);const p=view.project(vertex,600,360);assert(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.depth));}
  }
});
test('drag and keyboard rotate the diagram; projected shield markers select the right target after rotation',()=>{
  const {view,canvas,selected}=diagram();view.setSelection('bridge','systems');const initial=view.project([.56,.53,.1],600,360);
  canvas.handlers.pointerdown({clientX:100,clientY:80,pointerId:1});canvas.handlers.pointermove({clientX:180,clientY:110});canvas.handlers.pointerup({clientX:180,clientY:110});
  const rotated=view.project([.56,.53,.1],600,360);assert.notEqual(rotated.x,initial.x);assert.equal(selected(),undefined);
  view.setSelection('shield-aft','shields');const p=view.points['shield-aft'];canvas.handlers.pointerdown({clientX:p.x+10,clientY:p.y+20,pointerId:1});canvas.handlers.pointerup({clientX:p.x+10,clientY:p.y+20});assert.equal(selected(),'shield-aft');
  const yaw=view.yaw;canvas.handlers.keydown({key:'ArrowRight',preventDefault(){}});assert(view.yaw>yaw);canvas.handlers.keydown({key:'Home',preventDefault(){}});assert.equal(view.yaw,.65);
  canvas.handlers.wheel({deltaY:-100,preventDefault(){}});assert(view.zoom>1.15);
});


test('Shields layer dims the ship while shield envelope, targets and labels stay clear',()=>{
  const {view,drawing}=diagram(),strokes=[],labels=[];
  drawing.stroke=()=>strokes.push({color:drawing.strokeStyle,alpha:drawing.globalAlpha});drawing.fillText=()=>labels.push(drawing.globalAlpha);
  view.setSelection('shield-fore','shields');
  const hull=strokes.filter(stroke=>stroke.color==='#659db0');assert(hull.length>10);assert(hull.every(stroke=>stroke.alpha===.2),'ship wireframe is subdued');
  assert(strokes.some(stroke=>stroke.color==='#ffd094'&&stroke.alpha===1),'selected shield stays bright');assert(labels.every(alpha=>alpha===1),'labels retain full contrast');
  strokes.length=0;view.setSelection('hull','systems');assert(strokes.filter(stroke=>stroke.color==='#659db0').every(stroke=>stroke.alpha===1),'Systems view restores the ship brightness');
});
