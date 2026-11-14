/* A semicircular aft end rises in a straight line to the first saucer dome. */
window.createImpulseSpineGeometry=(T,{halfWidth=.027,rearZ=-.828,lineEndZ=rearZ+(-1.53+(.820-.5)*1.38-rearZ)*1.20,tipZ=lineEndZ-.004,deckHeight,housingGeometry,domeGeometry,domeZ=-1.53,domeY=.456,domeScaleY=1.05})=>{
 const roofTriangles=[],hp=housingGeometry.attributes.position,hi=housingGeometry.index;
 for(let i=0;i<(hi?hi.count:hp.count);i+=3){
  const vertices=[0,1,2].map(k=>{const j=hi?hi.getX(i+k):i+k;return [hp.getX(j),hp.getY(j),hp.getZ(j)];});
  const [a,b,c]=vertices,det=(b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]);
  if(Math.abs(det)>1e-12)roofTriangles.push({vertices,det});
 }
 function housingRoof(z){
  let top=-Infinity;
  for(const {vertices:[a,b,c],det}of roofTriangles){
   const x=-a[0],along=z-a[2],u=(x*(c[2]-a[2])-(c[0]-a[0])*along)/det,v=((b[0]-a[0])*along-x*(b[2]-a[2]))/det;
   if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)top=Math.max(top,a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]));
  }return top;
 }
 let domeRearZ=-1.28598;if(domeGeometry){domeRearZ=-Infinity;const dp=domeGeometry.attributes.position;for(let i=0;i<dp.count;i++)domeRearZ=Math.max(domeRearZ,dp.getZ(i)+domeZ);}
 // Bury the rounded nose beyond the dome shoulder, keeping the full ridge
 // width through the join instead of tapering away before it meets the dome.
 const oldNoseCenter=tipZ+halfWidth;tipZ=domeRearZ-halfWidth-.012;
 const aftRoof=housingRoof(rearZ-.000001),noseCenter=tipZ+halfWidth,arcSegments=32,ringSize=arcSegments+2,straightRows=97,sections=[];
 // Hold the entire cross section at the aft roof height. Do not follow the
 // rising deck: its intersection with this level rail creates the gradual merge.
 const baseY=aftRoof-.004;
 // Carry the level crown forward with the longer ridge so the rising deck
 // still absorbs its rounded nose. The aft attachment stays fixed.
 const crownY=deckHeight(Math.abs(lineEndZ+1.53)-.0416)+.0004,crestWidth=.00495,crestBottom=aftRoof+.017;
 const bodyCrownY=deckHeight(Math.abs(lineEndZ+1.53))-.0001,height=bodyCrownY-baseY;
 let domeMinY=0,domeMaxY=.057;if(domeGeometry){domeMinY=Infinity;domeMaxY=-Infinity;const dp=domeGeometry.attributes.position;for(let i=0;i<dp.count;i++){domeMinY=Math.min(domeMinY,dp.getY(i));domeMaxY=Math.max(domeMaxY,dp.getY(i));}}
 const domeBaseY=domeY+domeMinY*domeScaleY,domeWallHeight=(domeMaxY-domeMinY)*domeScaleY;
 const frontBodyCrownY=domeBaseY+domeWallHeight/10;
 function heightAt(z){const t=Math.max(0,Math.min(1,(rearZ-z)/(rearZ-domeRearZ)));return halfWidth+(frontBodyCrownY-baseY-halfWidth)*t;}
 function baseHeight(z){const t=Math.max(0,Math.min(1,(noseCenter-z)/halfWidth));return baseY+heightAt(z)*(1-Math.sqrt(1-t*t));}
 let mergeZ=tipZ;
 for(let i=0;i<=1000;i++){const z=rearZ+(tipZ-rearZ)*i/1000;if(deckHeight(Math.abs(z+1.53))>=bodyCrownY){mergeZ=z;break;}}
 for(let row=0;row<straightRows;row++)sections.push({z:rearZ+(oldNoseCenter-rearZ)*row/(straightRows-1),radius:halfWidth});
 for(let row=1;row<=48;row++)sections.push({z:oldNoseCenter+(noseCenter-oldNoseCenter)*row/48,radius:halfWidth});
 for(let row=1;row<20;row++){const angle=row/20*Math.PI/2;sections.push({z:noseCenter-halfWidth*Math.sin(angle),radius:halfWidth*Math.cos(angle)});}
 const positions=[],uv=[],indices=[];
 for(const {z,radius}of sections){
  const base=baseHeight(z);
  for(let n=0;n<=arcSegments;n++){const a=n/arcSegments*Math.PI;positions.push(Math.cos(a)*radius,base+Math.sin(a)*radius*heightAt(z)/halfWidth,z);uv.push(n/arcSegments,(z-tipZ)/(rearZ-tipZ));}
  positions.push(0,base,z);uv.push(.5,(z-tipZ)/(rearZ-tipZ));
 }
 for(let row=0;row<sections.length-1;row++)for(let n=0;n<ringSize;n++){
  const a=row*ringSize+n,b=row*ringSize+(n+1)%ringSize,c=a+ringSize,d=b+ringSize;indices.push(a,c,b,b,c,d);
 }
 const pole=positions.length/3;positions.push(0,baseHeight(tipZ),tipZ);uv.push(.5,0);
 const last=(sections.length-1)*ringSize;for(let n=0;n<ringSize;n++)indices.push(last+n,pole,last+(n+1)%ringSize);
 // The taller rounded end has its own flat normals, while its curved
 // perimeter coincides exactly with the continuous spine skin.
 const capIndexStart=indices.length,capStart=positions.length/3,capCenter=capStart+arcSegments+1;
 positions.push(...positions.slice(0,ringSize*3));for(let n=0;n<ringSize;n++)uv.push((positions[n*3]/halfWidth+1)/2,(positions[n*3+1]-baseHeight(rearZ))/height);
 for(let n=0;n<arcSegments;n++)indices.push(capCenter,capStart+n,capStart+n+1);
 // Start at half the previous exposed wall height and rise to the dome.
 const crestMergeZ=domeRearZ,crestEndZ=tipZ,frontClearance=.0005;
 const crestRearY=baseY+halfWidth+(crownY-baseY-halfWidth)*.5,crestFrontY=frontBodyCrownY+frontClearance;
 const crestTopAt=z=>{const t=Math.max(0,Math.min(1,(rearZ-z)/(rearZ-domeRearZ)));return crestRearY+(crestFrontY-crestRearY)*t;};
 const crestStart=positions.length/3,crest=new T.BoxGeometry(crestWidth,crownY-crestBottom,rearZ-crestEndZ,1,1,96);
 crest.translate(0,(crestBottom+crownY)/2,(rearZ+crestEndZ)/2);
 for(let i=0;i<crest.attributes.position.count;i++){const p=crest.attributes.position,t=(p.getY(i)-crestBottom)/(crownY-crestBottom);p.setY(i,crestBottom+t*(crestTopAt(p.getZ(i))-crestBottom));}
 positions.push(...crest.attributes.position.array);uv.push(...crest.attributes.uv.array);
 const crestTopIndices=[];let topIndexStart=0,topIndexCount=0;
 for(const group of crest.groups){if(group.materialIndex===4)continue;if(group.materialIndex===2){topIndexStart=indices.length;topIndexCount=group.count;}for(let i=group.start;i<group.start+group.count;i++){const j=crest.index.getX(i);indices.push(crestStart+j);if(group.materialIndex===2&&!crestTopIndices.includes(crestStart+j))crestTopIndices.push(crestStart+j);}}
 crest.dispose();
 // Its aft face starts on the arch itself, avoiding coplanar overlapping caps.
 const crestCapIndexStart=indices.length,crestCapStart=positions.length/3,boundary=[];
 for(let i=0;i<=8;i++){const x=-crestWidth/2+crestWidth*i/8;boundary.push([x,baseY+height*Math.sqrt(1-(x/halfWidth)**2),rearZ]);}
 boundary.push([crestWidth/2,crestRearY,rearZ],[-crestWidth/2,crestRearY,rearZ]);
 positions.push(0,(bodyCrownY+crownY)/2,rearZ);uv.push(.5,.5);
 for(const [x,y,z]of boundary){positions.push(x,y,z);uv.push(x/crestWidth+.5,(y-baseY)/(crownY-baseY));}
 for(let i=0;i<boundary.length;i++)indices.push(crestCapStart,crestCapStart+1+i,crestCapStart+1+(i+1)%boundary.length);
 // Keep the aft semicircle and use one linear rise along the full ridge.
 const rearHeight=halfWidth,preserveFrontZ=oldNoseCenter,rearCrownY=baseY+rearHeight;
 // Rejoin the aft wall cap to the lowered semicircular arch; its top stays level.
 positions[crestCapStart*3+1]=(rearCrownY+crestRearY)/2;
 for(let i=0;i<=8;i++){const j=crestCapStart+1+i,x=positions[j*3];positions[j*3+1]=baseY+rearHeight*Math.sqrt(1-(x/halfWidth)**2);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 geometry.addGroup(0,capIndexStart,0);geometry.addGroup(capIndexStart,arcSegments*3,1);geometry.addGroup(capIndexStart+arcSegments*3,topIndexStart-capIndexStart-arcSegments*3,0);geometry.addGroup(topIndexStart,topIndexCount,0);geometry.addGroup(topIndexStart+topIndexCount,crestCapIndexStart-topIndexStart-topIndexCount,0);geometry.addGroup(crestCapIndexStart,indices.length-crestCapIndexStart,1);
 geometry.userData.impulseSpine={halfWidth,height,lineEndZ,rearZ,tipZ,arcSegments,ringSize,straightRows,sectionCount:sections.length,noseCenter,oldNoseCenter,frontBodyCrownY,capStart,capCount:ringSize,capCenter,baseY,crownY,bodyCrownY,crestWidth,crestBottom,crestStart,crestCapStart,crestEndZ,crestMergeZ,wallLevel:false,crestRearY,crestFrontY,domeRearZ,domeBaseY,domeWallHeight,frontClearance,crestTopIndices,mergeZ,rearHeight,rearCrownY,preserveFrontZ,level:false,housingRoof:aftRoof};
 return geometry;
};

/* Preserve the original two stripe footprints and project their paint onto the ridge. */
window.addImpulseRidgeStripes=(T,parent,surfaces)=>{
 const triangles=[];
 for(const mesh of surfaces){mesh.updateMatrix();const p=mesh.geometry.attributes.position,idx=mesh.geometry.index;for(let i=0;i<(idx?idx.count:p.count);i+=3){const [a,b,c]=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,idx?idx.getX(i+k):i+k).applyMatrix4(mesh.matrix));if(Math.max(a.x,b.x,c.x)<-.011||Math.min(a.x,b.x,c.x)>.011||Math.max(a.z,b.z,c.z)<-1.3506||Math.min(a.z,b.z,c.z)>-1.0884)continue;const det=(b.x-a.x)*(c.z-a.z)-(c.x-a.x)*(b.z-a.z);if(Math.abs(det)>1e-12)triangles.push({a,b,c,det});}}
 function height(x,z){let y=-Infinity;for(const {a,b,c,det}of triangles){const dx=x-a.x,dz=z-a.z,u=(dx*(c.z-a.z)-(c.x-a.x)*dz)/det,v=((b.x-a.x)*dz-dx*(b.z-a.z))/det;if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)y=Math.max(y,a.y+u*(b.y-a.y)+v*(c.y-a.y));}if(!Number.isFinite(y))throw Error('Ridge stripe must lie on the hull');return y;}
 const group=new T.Group();group.name='saucer-ridge-red-stripes';const paint=new T.MeshStandardMaterial({color:0x9e3029,roughness:.74,metalness:.12,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 for(const side of [-1,1]){const positions=[],indices=[],rows=160,columns=2,centerX=side*.00966,halfWidth=.000966;
  for(let row=0;row<=rows;row++){const z=-1.3506+(.2622)*row/rows;for(let col=0;col<=columns;col++){const x=centerX-halfWidth+halfWidth*2*col/columns;positions.push(x,height(x,z)+.00004,z);}}
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){const a=row*(columns+1)+col,b=a+columns+1;indices.push(a,b,a+1,a+1,b,b+1);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();const stripe=new T.Mesh(geometry,paint);stripe.name=(side<0?'port':'starboard')+'-ridge-red-stripe';stripe.userData={originalCenterX:centerX,frontZ:-1.3506,rearZ:-1.0884,width:.001932,projected:true};group.add(stripe);
 }
 parent.add(group);return group;
};
