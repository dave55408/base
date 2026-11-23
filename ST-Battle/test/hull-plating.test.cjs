const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function harness(){
  const drawing=new Proxy({}, {get:()=>()=>{}}),c={window:{},console,AbortController,document:{createElement:()=>({getContext:()=>drawing})}};
  vm.createContext(c);for(const file of ['vendor/three.js','geometry.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const scene=Object.create(c.window.BattleScene.prototype);scene.T=c.window.AlpineThree;scene.texture=canvas=>({canvas});return scene;
}
test('both ships have painted plating on opaque surfaces while every light and exhaust stays untextured',()=>{
  const scene=harness();
  for(const enemy of [false,true]){
    const ship=scene.makeShip(enemy?'Yorktown':'Enterprise',enemy?'NCC-1717':'NCC-1701',enemy);let plated=0,lit=0;
    ship.traverse(part=>{
      if(!part.isMesh)return;
      for(const material of Array.isArray(part.material)?part.material:[part.material]){
        if(material.isMeshStandardMaterial){assert(material.map,'opaque ship surfaces have a painted map');plated++;assert.equal(material.bumpMap,null);assert.equal(material.displacementMap,null);}
        if(material.isMeshBasicMaterial){assert.equal(material.map,null,'glowing areas remain clear');lit++;}
      }
    });
    assert(plated>20);assert(lit>10);
    const saucer=ship.userData.saucer;assert.notEqual(saucer.material[0].map,saucer.material[1].map,'underside plating has its own unlettered map');
  }
});
test('turned hull plating follows the contour and wraps cleanly without changing the actual hull',()=>{
  const scene=harness(),T=scene.T,profile=[[0,-.5],[.2,-.4],[.25,0],[.1,.6],[0,.65]].map(([x,y])=>new T.Vector2(x,y));
  const geometry=new T.LatheGeometry(profile,16),positions=Array.from(geometry.attributes.position.array),indices=Array.from(geometry.index.array);
  scene.wrapLathePlating(geometry,profile,16);
  assert.deepEqual(Array.from(geometry.attributes.position.array),positions);assert.deepEqual(Array.from(geometry.index.array),indices);
  const uv=geometry.attributes.uv;
  for(let row=0;row<profile.length;row++){
    const first=row*17,last=first+16;assert.equal(uv.getX(first),0);assert.equal(uv.getX(last),1);assert.equal(uv.getY(first),uv.getY(last));
    if(row)assert(uv.getY(first)>uv.getY(first-17),'panels progress along the hull profile');
  }
  assert.equal(uv.getY(0),0);assert.equal(uv.getY(uv.count-1),1);
});

test('Yorktown carries its saucer gunmetal plating palette and finish across the remaining hull',()=>{
 const scene=harness(),paint=scene.hullPanelCanvas;scene.hullPanelCanvas=function(columns,rows,base='#ffffff',...size){const canvas=paint.call(this,columns,rows,base,...size);canvas.platingBase=base;return canvas;};
 const ship=scene.makeShip('Yorktown','NCC-1717',true),top=ship.userData.saucer.material[0];let coated=0;
 ship.traverse(mesh=>{for(const material of [].concat(mesh.material||[])){
  if(!material.userData.yorktownHullFinish)continue;coated++;assert.equal(material.color.getHex(),0xffffff,'the painted gunmetal texture is not darkened twice');
  assert.equal(material.roughness,top.roughness);assert.equal(material.metalness,top.metalness);
  if(material.map.canvas.platingBase)assert.equal(material.map.canvas.platingBase,'#3b4249');
 }});assert(coated>20);
});

test('K7 shares Enterprise plating, wraps lathed contours, and preserves its separate saucer gridlines',()=>{
 const scene=harness(),B=require('../engine.js');scene.sim=new B.Simulation();const station=scene.makeStation(),T=scene.T;let lines=0,lathed=0,cones=0,plated=0;
 station.traverse(mesh=>{
  if(mesh.isLineSegments){lines++;assert.equal(mesh.geometry.attributes.position.count,64);assert.equal(mesh.material.color.getHex(),0x52666b);assert.equal(mesh.material.opacity,.45);assert.equal(mesh.material.map,null);}
  if(!mesh.isMesh)return;
  if(mesh.material.isMeshStandardMaterial){assert(mesh.material.map);plated++;}
  if(mesh.material.isMeshBasicMaterial)assert.equal(mesh.material.map,null,'windows and beacons stay clear');
  const geometry=mesh.geometry,uv=geometry.attributes.uv;
  if(geometry instanceof T.LatheGeometry){
   lathed++;for(let row=0;row<uv.count/65;row++){assert.equal(uv.getX(row*65),0);assert.equal(uv.getX(row*65+64),1);assert.equal(uv.getY(row*65),uv.getY(row*65+64));}
   for(const value of uv.array)assert(value>=0&&value<=1,'plating follows normalized contour coordinates');
  }
  if(geometry instanceof T.ConeGeometry||geometry.type==='CylinderGeometry'&&geometry.parameters.radiusTop!==geometry.parameters.radiusBottom){
   cones++;const side=geometry.groups.find(group=>group.materialIndex===0),index=geometry.index,position=geometry.attributes.position,height=geometry.parameters.height;
   for(let i=side.start;i<side.start+side.count;i++){const j=index.getX(i);assert(Math.abs(uv.getY(j)-(position.getY(j)/height+.5))<1e-6,'cone panel rows are horizontal height bands');}
  }
 });
 assert.equal(lines,4);assert.equal(lathed,6);assert.equal(cones,8);assert(plated>20);
});

test('neck is cut flat below the saucer without moving or rotating its original connection',()=>{
  const scene=harness(),T=scene.T;
  for(const enemy of [false,true]){
    const ship=scene.makeShip(enemy?'Yorktown':'Enterprise','NCC-1701',enemy),neck=ship.userData.breakupParts[2];
    assert(neck.position.distanceTo(new T.Vector3(0,.22,-.54))<1e-8);
    const originalRotation=new T.Group().quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(0,.28,-.28).normalize());
    assert(Math.abs(neck.quaternion.dot(originalRotation))>1-1e-8);
    const positions=neck.geometry.attributes.position,normals=neck.geometry.attributes.normal;
    let capVertices=0,minY=Infinity;
    for(let i=0;i<positions.count;i++){
      const point=new T.Vector3().fromBufferAttribute(positions,i).applyQuaternion(neck.quaternion).add(neck.position);
      assert(point.y<=.3950001,'no part of the neck protrudes above the cut');minY=Math.min(minY,point.y);
      if(Math.abs(point.y-.395)<1e-7){
        const normal=new T.Vector3().fromBufferAttribute(normals,i).applyQuaternion(neck.quaternion);
        if(normal.y>.999)capVertices++;
      }
    }
    assert(capVertices>=6,'the cut has a closed, flat upper face');
    assert(Math.abs(minY-(.08-.125/Math.sqrt(2)))<1e-7,'the bottom connection remains unchanged');
  }
});
