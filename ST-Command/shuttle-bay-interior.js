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
 c.strokeStyle='#733731';c.lineWidth=10;c.strokeRect(125,260,774,1430);
 // The turntable matches the deck, outlined only by a fine perimeter seam.
 c.strokeStyle='#465156';c.lineWidth=3;c.beginPath();c.ellipse(512,1040,342,486,0,0,Math.PI*2);c.stroke();
 c.strokeStyle='#ffe16a';c.lineWidth=16;c.beginPath();c.ellipse(512,1040,310,440,0,0,Math.PI*2);c.stroke();
 c.strokeStyle='#d1cba8';c.lineWidth=3;c.beginPath();c.moveTo(512,470);c.lineTo(512,600);c.moveTo(512,1480);c.lineTo(512,1600);c.stroke();
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
 const floor=new T.MeshStandardMaterial({color:0xffffff,map,emissive:0xffffff,emissiveMap:map,emissiveIntensity:.28,roughness:.95,metalness:.02,side:T.DoubleSide});
 const deck=mesh(new T.PlaneGeometry(.162,.322),floor,'bay-reference-landing-pad',0,-.04648,-.111);deck.rotation.x=-Math.PI/2;
 // Long luminous panels follow the roof, separated by dark structural seams.
 const ceilingPoint=(a,z)=>{const y=.008+Math.sin(a)*.069,x=Math.cos(a)*.081,limit=.083*Math.sqrt(Math.max(0,1-((y+.043)/.130)**2))-.002;return [fitDoorShoulders?Math.sign(x)*Math.min(Math.abs(x),limit):x,y,z];};
 for(let band=0;band<8;band++)for(let row=0;row<6;row++){
  const a=.30+(Math.PI-.60)*band/8+.015,b=.30+(Math.PI-.60)*(band+1)/8-.015,z0=-.268+row*.045+.001,z1=Math.min(z0+.042,-.0183);
  quad('bay-ceiling-light-'+band+'-'+row,[ceilingPoint(a,z0),ceilingPoint(b,z0),ceilingPoint(b,z1),ceilingPoint(a,z1)],white);
 }
 addShuttleBayWalls(T,room,{rearZ,fitDoorShoulders});
 const garage=createShuttleGarage(T,{rearZ,storageScaleY,storageScaleZ});room.add(garage);room.setGarageDoorOpen=garage.setOpen;
 room.userData.referenceFeatures=['segmented luminous ceiling','horizontal vent louvers','tan wall panels','beveled console banks','recessed service doors','red boundary and yellow landing ring','garage'];
 return room;
};
