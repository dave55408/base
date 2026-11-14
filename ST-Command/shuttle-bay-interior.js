/* Reference-inspired hangar fittings in the existing bay's local coordinates. */
window.createShuttleBayInterior=(T,{rearZ=-.27765,fitDoorShoulders=false,storageScaleY=1,storageScaleZ=1}={})=>{
 const room=new T.Group();room.name='reference-bay-interior';
 const white=new T.MeshBasicMaterial({color:0xf4fafb,side:T.DoubleSide,toneMapped:false});
 function mesh(geometry,material,name,x=0,y=0,z=0){const o=new T.Mesh(geometry,material);o.name=name;o.position.set(x,y,z);o.receiveShadow=true;room.add(o);return o;}
 function quad(name,points,material){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();return mesh(geometry,material,name);}
 // The landing graphic is painted on the existing deck, with no raised lip.
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=2048;const c=canvas.getContext('2d');
 c.fillStyle='#737c80';c.fillRect(0,0,1024,2048);
 const wash=c.createLinearGradient(0,0,1024,0);wash.addColorStop(0,'#00000038');wash.addColorStop(.5,'#ffffff0b');wash.addColorStop(1,'#00000038');c.fillStyle=wash;c.fillRect(0,0,1024,2048);
 // Continue the two boundary lines onto the raised aft sill below.
 const sillStart=-.008,sillEnd=hangarDoorProfile().roofFront;
 const sillCanvasY=(sillStart+.111+.161)/.322*2048;
 c.strokeStyle='#733731';c.lineWidth=10;c.beginPath();c.moveTo(125,sillCanvasY);c.lineTo(125,260);c.lineTo(899,260);c.lineTo(899,sillCanvasY);c.stroke();
 // A matte grit coating gives the turntable traction without a repeating
 // tread pattern. The surrounding deck stays smooth.
 const tractionHeight=document.createElement('canvas');tractionHeight.width=1024;tractionHeight.height=2048;const h=tractionHeight.getContext('2d');
 h.fillStyle='#404040';h.fillRect(0,0,1024,2048);
 // Shrink the turntable, traction, ring and alignment marks about their center.
 for(const ctx of [c,h]){ctx.save();ctx.translate(512,1040);ctx.scale(.9,.9);ctx.translate(-512,-1040);}
 for(const ctx of [c,h]){ctx.save();ctx.beginPath();ctx.ellipse(512,1040,340,484,0,0,Math.PI*2);ctx.clip();ctx.fillStyle=ctx===c?'#535e63':'#404040';ctx.fillRect(160,550,704,980);}
 // Use the high bits of the seeded noise to avoid aligned grain or rows.
 let grain=173;
 const noise=()=>{grain=(Math.imul(grain,1664525)+1013904223)>>>0;return grain/4294967296;};
 for(let n=0;n<90000;n++){
  const x=160+noise()*704,y=550+noise()*980,size=.7+noise()*2.1,bright=noise()>.55;
  c.fillStyle=bright?'rgba(213,224,229,.16)':'rgba(9,17,21,.22)';c.fillRect(x,y,size,size*.75);
  h.fillStyle=bright?'#939393':'#242424';h.fillRect(x,y,size,size*.75);
 }
 c.restore();h.restore();
 // Keep the perimeter seam and painted landing guidance over the coating.
 c.strokeStyle='#465156';c.lineWidth=3;c.beginPath();c.ellipse(512,1040,342,486,0,0,Math.PI*2);c.stroke();
 // Painted guidance has a smooth surface; grit must not break up
 // the yellow band through the bump map.
 h.strokeStyle='#404040';h.lineWidth=20;h.beginPath();h.ellipse(512,1040,310,440,0,0,Math.PI*2);h.stroke();
 c.strokeStyle='#f4ce3e';c.lineWidth=16;c.beginPath();c.ellipse(512,1040,310,440,0,0,Math.PI*2);c.stroke();
 c.strokeStyle='#d1cba8';c.lineWidth=3;c.beginPath();c.moveTo(512,470);c.lineTo(512,600);c.moveTo(512,1480);c.lineTo(512,1600);c.stroke();
 c.restore();h.restore();
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=16;
 const floor=new T.MeshStandardMaterial({color:0xffffff,map,emissive:0xffffff,emissiveMap:map,emissiveIntensity:.18,roughness:1,metalness:0,side:T.DoubleSide});
 floor.bumpMap=new T.CanvasTexture(tractionHeight);floor.bumpMap.anisotropy=16;floor.bumpScale=.000035;
 const deckY=hangarDoorProfile().cy;
 const deckRear=-.272,deckFront=shuttleBayFloorFront();
 const deckGeometry=new T.PlaneGeometry(.162,deckFront-deckRear),deckUV=deckGeometry.attributes.uv,cropV=(.05-deckFront)/.322;
 for(let i=0;i<deckUV.count;i++)deckUV.setY(i,cropV+(1-cropV)*deckUV.getY(i));
 const deck=mesh(deckGeometry,floor,'bay-reference-landing-pad',0,deckY+.00003,(deckRear+deckFront)/2);deck.rotation.x=-Math.PI/2;
 const boundaryPaint=new T.MeshStandardMaterial({color:0x733731,emissive:0x733731,emissiveIntensity:.18,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,depthWrite:false,roughness:1,metalness:0,side:T.DoubleSide});
 const lineX=(.5-125/1024)*.162,lineHalfWidth=5/1024*.162,sillY=hangarDoorProfile().cy+.00003;
 for(const side of [-1,1]){
  const x=side*lineX;
  quad('bay-red-boundary-sill-'+side,[[x-lineHalfWidth,sillY,sillStart],[x+lineHalfWidth,sillY,sillStart],[x+lineHalfWidth,sillY,sillEnd],[x-lineHalfWidth,sillY,sillEnd]],boundaryPaint);
 }
 const endHalfWidth=5/2048*.322;
 quad('bay-red-boundary-sill-end',[[-lineX-lineHalfWidth,sillY,sillEnd-endHalfWidth],[lineX+lineHalfWidth,sillY,sillEnd-endHalfWidth],[lineX+lineHalfWidth,sillY,sillEnd+endHalfWidth],[-lineX-lineHalfWidth,sillY,sillEnd+endHalfWidth]],boundaryPaint);
 // Long luminous panels follow the roof, separated by dark structural seams.
 const ceilingPoint=(a,z)=>{const y=.008+Math.sin(a)*.069,x=Math.cos(a)*.081,limit=.083*Math.sqrt(Math.max(0,1-((y+.043)/.130)**2))-.002;return [fitDoorShoulders?Math.sign(x)*Math.min(Math.abs(x),limit):x,y,z];};
 for(let band=0;band<8;band++)for(let row=0;row<6;row++){
  const a=.30+(Math.PI-.60)*band/8+.015,b=.30+(Math.PI-.60)*(band+1)/8-.015,z0=-.268+row*.045+.001,z1=Math.min(z0+.042,-.0183);
  quad('bay-ceiling-light-'+band+'-'+row,[ceilingPoint(a,z0),ceilingPoint(b,z0),ceilingPoint(b,z1),ceilingPoint(a,z1)],white);
 }
 // A single ceiling housing near the bay door, retaining its 70% size.
 const housing=new T.MeshStandardMaterial({color:0x8b979b,roughness:.84,metalness:.08,emissive:0x8b979b,emissiveIntensity:.12,side:T.DoubleSide});
 const housingSide=housing,housingBottom=housing;
 function ceilingHousing(name,x,z,topWidth,topLength,bottomWidth,bottomLength,bottomY){
  const outline=(w,d)=>[[-w/2,-d/2],[w/2,-d/2],[w/2,d*.30],[w*.32,d/2],[-w*.32,d/2],[-w/2,d*.30]];
  const mount=ceilingPoint(Math.acos(x/.081),z);mount[1]-=.0003;
  const shrink=p=>p.map((v,i)=>mount[i]+(v-mount[i])*.7);
  const top=outline(topWidth,topLength).map(([dx,dz])=>{const p=ceilingPoint(Math.acos((x+dx)/.081),z+dz);p[1]-=.0003;return shrink(p);});
  const bottom=outline(bottomWidth,bottomLength).map(([dx,dz])=>shrink([x+dx,bottomY,z+dz]));
  for(let i=0;i<6;i++){
   const j=(i+1)%6,o=quad(name+'-side-'+i,[top[i],top[j],bottom[j],bottom[i]],i===1||i===5?housingSide:housing);o.castShadow=true;
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(bottom.flat(),3));g.setIndex([0,1,2,0,2,3,0,3,4,0,4,5]);g.computeVertexNormals();
  mesh(g,housingBottom,name+'-underside').castShadow=true;
 }
 ceilingHousing('bay-ceiling-center-housing',0,-.055,.038,.078,.020,.049,.054);
 addShuttleBayWalls(T,room,{rearZ,fitDoorShoulders});
 // Local overhead light keeps the small fittings' shadows sharp enough to
 // read inside the bay, independently of the exterior sun's large shadow map.
 const bayLight=new T.DirectionalLight(0xe8eef0,1.2);bayLight.name='bay-interior-key';
 bayLight.position.set(.028,.060,-.045);bayLight.target.position.set(-.012,-.040,-.155);
 bayLight.castShadow=true;bayLight.visible=false;bayLight.shadow.mapSize.set(1024,1024);
 Object.assign(bayLight.shadow.camera,{left:-.15,right:.15,top:.15,bottom:-.15,near:.001,far:1});
 bayLight.shadow.camera.updateProjectionMatrix();bayLight.shadow.bias=-.00002;bayLight.shadow.normalBias=.00012;bayLight.shadow.radius=2;bayLight.shadow.intensity=.75;
 room.add(bayLight,bayLight.target);
 // Gentle light from inside the bay opens up the entrance arch's dark face.
 const archFill=new T.DirectionalLight(0xe6e9e4,.65);archFill.name='bay-arch-fill';
 archFill.position.set(0,.008,-.13);archFill.target.position.set(0,.055,.005);
 archFill.castShadow=false;archFill.visible=false;room.add(archFill,archFill.target);
 const garage=createShuttleGarage(T,{rearZ,bayDeckRear:deckRear,storageScaleY,storageScaleZ});room.add(garage);room.setGarageDoorOpen=garage.setOpen;
 room.userData.referenceFeatures=['segmented luminous ceiling','faceted overhead housings','horizontal vent louvers','tan wall panels','beveled console banks','recessed service doors','red boundary and yellow landing ring','garage'];
 return room;
};
