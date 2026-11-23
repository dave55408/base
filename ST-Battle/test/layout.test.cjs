const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../layout.js'),'utf8');
function harness(width,height,overflow=false){
  const handlers={},style={setProperty(k,v){this[k]=v;}};
  const shell={style,querySelector(selector){return {get clientHeight(){return (parseFloat(style.height)-150)*.42;},get scrollHeight(){return overflow&&selector===(typeof overflow==='string'?overflow:'.engineering')?450:this.clientHeight;}};}};
  const window={innerWidth:width,innerHeight:height,addEventListener:(event,fn)=>handlers[event]=fn};
  vm.runInNewContext(source,{document:{getElementById:()=>shell},window,requestAnimationFrame:fn=>{handlers.frame=fn;return 1;}});
  return {window,style,resize(){handlers.resize();handlers.frame();},shell};
}
function assertFits(h){
  const scale=Number(h.style['--game-scale']);
  assert(Number.isFinite(scale)&&scale>0);
  assert(parseFloat(h.style.width)*scale<=h.window.innerWidth+.01);
  assert(parseFloat(h.style.height)*scale<=h.window.innerHeight+.01);
}
test('complete dashboard fits common browser sizes and refits on resize',()=>{
  for(const [w,h] of [[1366,768],[1920,1080],[2560,1440],[1024,600],[390,844]])assertFits(harness(w,h));
  const h=harness(1920,1080);h.window.innerWidth=1280;h.window.innerHeight=720;h.resize();assertFits(h);
});
test('bottom consoles expand the fitted canvas until all controls are visible',()=>{
  const h=harness(1366,768,true);assertFits(h);assert(parseFloat(h.style.height)>1000);
  const panel=h.shell.querySelector('.engineering');assert(panel.scrollHeight-panel.clientHeight<2);
});

test('fit layout includes all Yorktown panels instead of requiring a scrolling sidebar',()=>{
  const h=harness(1366,768,'.yorktown-rail');assertFits(h);assert(parseFloat(h.style.height)>1000);
  const rail=h.shell.querySelector('.yorktown-rail');assert(rail.scrollHeight-rail.clientHeight<2);
});
