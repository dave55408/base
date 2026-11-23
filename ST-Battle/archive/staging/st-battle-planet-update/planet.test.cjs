const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const B=require('../engine.js');

test('Mars image loader uses the bundled texture API and a packaged offline surface map',()=>{
  const images=[],draws=[],canvas={getContext:()=>({fillRect(){},drawImage(...args){draws.push(args);}})};
  const c={window:{},Battle:B,console,AbortController,document:{createElement:()=>canvas},Image:class{constructor(){images.push(this);}}};
  vm.createContext(c);for(const file of ['vendor/three.js','assets/mars-surface.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const scene=Object.create(c.window.BattleScene.prototype);scene.T=c.window.AlpineThree;
  scene.renderer={capabilities:{getMaxAnisotropy:()=>4}};
  const texture=scene.loadPlanetMap();assert(texture.isCanvasTexture);assert.equal(texture.image,canvas);assert.equal(canvas.width,2048);assert.equal(canvas.height,1024);
  const image=images[0];assert(image.src.startsWith('data:image/png;base64,'),'embedded image avoids file:// canvas security restrictions');
  const png=fs.readFileSync(path.join(__dirname,'../assets/mars-surface.png'));
  assert.deepEqual(Buffer.from(image.src.split(',')[1],'base64'),png);
  assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),png.readUInt32BE(20)*2,'full longitude/latitude map has a 2:1 aspect ratio');
  image.naturalWidth=1774;image.naturalHeight=887;const version=texture.version;image.onload();
  assert.equal(canvas.width,2048);assert.equal(canvas.height,1024);assert.equal(draws.length,1);assert(texture.version>version);
  assert.equal(draws[0][3],2048);assert.equal(draws[0][4],1024,'draw into fixed GPU dimensions instead of resizing a texture after upload');
});

test('Enterprise can reach the fixed planet and stays safely above its cloud tops',()=>{
  const s=new B.Simulation();s.startFreeFlight();const body={...s.planet};
  Object.assign(s.player,{x:body.x,y:body.y,z:body.z+body.radius+body.atmosphere+2200,heading:0,pitch:0,turnRate:0,throttle:100});
  const initial=s.planetClearance();let closest=initial;
  for(let i=0;i<600;i++){s.tick(.1);const clearance=s.planetClearance();assert(clearance>=120-1e-6);closest=Math.min(closest,clearance);}
  assert(closest<125,'reaches the protected cloud-top boundary');assert(initial-closest>2000);assert.deepEqual(s.planet,body);assert.equal(s.player.hull,100);
});

test('planet collision guard prevents tunneling and rejects warp destinations inside the planet',()=>{
  const s=new B.Simulation();s.startFreeFlight();const b=s.planet;
  const previous={x:b.x,y:b.y,z:b.z+b.radius+1000};Object.assign(s.player,{x:b.x,y:b.y,z:b.z-b.radius-1000});
  s.moveAroundPlanet(s.player,previous);assert(s.planetClearance()>120);assert(s.player.z>b.z);
  Object.assign(s.player,{x:b.x,y:b.y,z:b.z+3000,heading:0,pitch:0});assert.equal(s.warp(),false);assert.equal(s.warpUsed,false);
});

test('rendered planet is a uniformly scaled sphere at the physical navigation position',()=>{
  const c={window:{},Battle:B,console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const scene=Object.create(c.window.BattleScene.prototype);scene.T=c.window.AlpineThree;scene.sim=new B.Simulation();
  const planet=scene.makePlanet();assert.deepEqual(Array.from(planet.scale.toArray()),[1,1,1]);
  assert.deepEqual(Array.from(planet.position.toArray()),[scene.sim.planet.x,scene.sim.planet.y,scene.sim.planet.z]);
  const vertices=planet.children[0].geometry.attributes.position.array;
  for(let i=0;i<vertices.length;i+=3)assert(Math.abs(Math.hypot(vertices[i],vertices[i+1],vertices[i+2])-scene.sim.planet.radius)<.001);
});
