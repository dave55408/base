/* Hull-mounted illumination: starts off, independent of night mode. */
window.ExteriorLights=(()=>{
 const ships=new Set(),buttons=document.querySelectorAll('[data-exterior-lights]');let enabled=false;
 function sync(){for(const button of buttons){button.setAttribute('aria-pressed',String(enabled));button.title=enabled?'Turn exterior hull spotlights off':'Turn exterior hull spotlights on';}}
 const api={
  get enabled(){return enabled;},
  set enabled(value){enabled=!!value;for(const ship of ships)ship.model.userData.exteriorLights.setEnabled(enabled);sync();},
  attach(ship){ships.add(ship);ship.model.userData.exteriorLights.setEnabled(enabled);const dispose=ship.dispose;ship.dispose=function(...args){ships.delete(ship);return dispose?.apply(this,args);};return ship;},
  add(T,model){
   const root=new T.Group();root.name='exterior-hull-spotlights';model.add(root);model.updateWorldMatrix(true,true);
   const lamps=[],color=new T.Color().setRGB(1,.96,.90),lensBrightness=1.4,housingPaint=new T.MeshStandardMaterial({color:window.ENTERPRISE_MOVIE_HULL_COLOR??0xa9b5aa,roughness:.9,metalness:0});
   const housingGeometry=new T.SphereGeometry(.0018,12,8),lensGeometry=new T.SphereGeometry(.0008,12,8);
   // Find a real vertex on the finished hull, after the model's fitting and scale
   // adjustments. Lamp origins and aiming points therefore follow its actual skin.
   function closestTriangle(a,b,c,p){
    const ab=b.clone().sub(a),ac=c.clone().sub(a),ap=p.clone().sub(a),d1=ab.dot(ap),d2=ac.dot(ap);
    if(d1<=0&&d2<=0)return a.clone();
    const bp=p.clone().sub(b),d3=ab.dot(bp),d4=ac.dot(bp);if(d3>=0&&d4<=d3)return b.clone();
    const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0)return a.clone().addScaledVector(ab,d1/(d1-d3));
    const cp=p.clone().sub(c),d5=ab.dot(cp),d6=ac.dot(cp);if(d6>=0&&d5<=d6)return c.clone();
    const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0)return a.clone().addScaledVector(ac,d2/(d2-d6));
    const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0)return b.clone().addScaledVector(c.clone().sub(b),(d4-d3)/((d4-d3)+(d5-d6)));
    const sum=va+vb+vc;if(Math.abs(sum)<1e-20)return a.clone();
    return a.clone().addScaledVector(ab,vb/sum).addScaledVector(ac,vc/sum);
   }
   function surface(meshName,desired,clearance,precise=false){
    const mesh=model.getObjectByName(meshName);if(!mesh)throw Error('Missing spotlight mount: '+meshName);
    const position=mesh.geometry.attributes.position,normal=mesh.geometry.attributes.normal,wanted=new T.Vector3(...desired),point=new T.Vector3(),best=new T.Vector3(),out=new T.Vector3();let distance=Infinity;
    if(precise){
     // The long nacelle casing has few axial rings. Project onto its triangles
     // so a fitting can sit behind the lettering instead of snapping to an end.
     const index=mesh.geometry.index,vertex=i=>model.worldToLocal(mesh.localToWorld(new T.Vector3().fromBufferAttribute(position,index?index.getX(i):i)));
     for(let i=0;i<(index?index.count:position.count);i+=3){
      const a=vertex(i),b=vertex(i+1),c=vertex(i+2),n=b.clone().sub(a).cross(c.clone().sub(a));if(n.lengthSq()<1e-20)continue;
      const v=closestTriangle(a,b,c,wanted),d=v.distanceToSquared(wanted);if(d<distance){distance=d;best.copy(v);out.copy(n).normalize();}
     }
     return best.addScaledVector(out,clearance);
    }
    for(let i=0;i<position.count;i++){
     point.fromBufferAttribute(position,i);mesh.localToWorld(point);model.worldToLocal(point);const d=point.distanceToSquared(wanted);
     if(d<distance){distance=d;best.copy(point);out.fromBufferAttribute(normal,i).transformDirection(mesh.matrixWorld);}
    }
    // The model root currently translates only; converting the direction keeps
    // this correct if a caller rotates the complete ship before constructing it.
    const origin=model.worldToLocal(new T.Vector3()),end=model.worldToLocal(out.clone());out.copy(end).sub(origin).normalize();
    return best.addScaledVector(out,clearance);
   }
   function add(id,mount,from,targetMesh,to,intensity=.10,distance=1.2,beamAngle=Math.PI/4,mountNormalSign=1,preciseMount=false){
    const skin=surface(mount,from,0,preciseMount),source=surface(mount,from,.0045*mountNormalSign,preciseMount),normal=source.clone().sub(skin).normalize(),target=surface(targetMesh,to,.001,targetMesh.endsWith('-engine-outer-tube')||preciseMount&&mount===targetMesh),fixture=new T.Group();fixture.name='hull-spotlight-'+id;
    // Keep the optical origin clear of the hull for its existing grazing wash,
    // while the visible fitting sits almost flush with the skin.
    fixture.position.copy(skin).addScaledVector(normal,.00035);fixture.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),normal);root.add(fixture);
    const housing=new T.Mesh(housingGeometry,housingPaint);housing.scale.set(1,1,.25);fixture.add(housing);
    const lensPaint=new T.MeshStandardMaterial({color:0xe5dfd3,emissive:color,emissiveIntensity:lensBrightness,roughness:.65,metalness:0});
    const lens=new T.Mesh(lensGeometry,lensPaint);lens.position.z=.00055;lens.scale.z=.22;lens.name=fixture.name+'-lens';fixture.add(lens);
    fixture.userData.mount=mount;
    // Unlit fittings do not need a light or target in the scene at all.
    if(intensity<=0){lensPaint.emissiveIntensity=0;lensPaint.color.setHex(0x535a55);return null;}
    const lamp=new T.SpotLight(color,intensity,distance,beamAngle,.65,1);lamp.name=fixture.name+'-beam';lamp.position.copy(source);lamp.target.position.copy(target);lamp.castShadow=false;root.add(lamp,lamp.target);
    lamps.push({id,light:lamp,lens:lensPaint,intensity});return lamp;
   }
   const saucer='movie-saucer',upper='upper-saucer-teardrop',bowl='movie-underside-bowl',body='secondary-hull';
   // Carry the soft wash beyond the outer N and 1 before fading into the hull.
   const registryFlood=add('bridge-registry',upper,[0,.520,-1.538],saucer,[0,.415,-2.065],3.6,1.2,Math.PI*4/9,1,true);
   registryFlood.decay=0;registryFlood.penumbra=.60;
   // A continuous luminous strip replaces the four rear sensor spotlights.
   // It follows the same radius (one third inward from the lip) without lighting the hull.
   const dish=model.getObjectByName('deflector-dish');
   const dishRadius=.097*2/3,rearProfile=[[0,-1.240],[.014,-1.240],[.024,-1.243],[.043,-1.249],[.065,-1.257],[.084,-1.264],[.097,-1.269]];
   function inModel(mesh,x,y,z){return model.worldToLocal(mesh.localToWorld(new T.Vector3(x,y,z)));}
   function rearAt(r){for(let i=1;i<rearProfile.length;i++){const [b,zb]=rearProfile[i],[a,za]=rearProfile[i-1];if(r<=b)return za+(zb-za)*(r-a)/(b-a)+.003;}return rearProfile.at(-1)[1]+.003;}
   function ringGeometry(halfWidth,lift,radialSteps=1){
    const positions=[],uv=[],indices=[],segments=256,stride=radialSteps+1;
    for(let i=0;i<=segments;i++)for(let edge=0;edge<=radialSteps;edge++){
     const radial=edge/radialSteps,angle=i/segments*Math.PI*2,r=dishRadius+(radial*2-1)*halfWidth,v=inModel(dish,Math.sin(angle)*r,rearAt(r),Math.cos(angle)*r);v.z+=lift;
     positions.push(v.x,v.y,v.z);uv.push(i/segments,radial);
    }
    for(let i=0;i<segments;i++)for(let edge=0;edge<radialSteps;edge++){const a=i*stride+edge,b=a+stride;indices.push(a,a+1,b,a+1,b+1,b);}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
   }
   const glowRing=new T.Group();glowRing.name='deflector-rear-glow-ring';glowRing.userData.radius=dishRadius;root.add(glowRing);
   // Feather both layers so there is no hard white strip or abrupt halo edge.
   const ringPaint=new T.ShaderMaterial({uniforms:{glowColor:{value:new T.Color(0xfff1d6)},strength:{value:.85}},transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
    vertexShader:'varying vec2 vGlowUv;void main(){vGlowUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform vec3 glowColor;uniform float strength;varying vec2 vGlowUv;void main(){float radial=abs(vGlowUv.y-.5)*2.0;float glow=exp(-radial*radial*4.5)*(1.0-smoothstep(.78,1.0,radial));gl_FragColor=vec4(glowColor,glow*strength);\n#include <colorspace_fragment>\n}'});
   const ringCore=new T.Mesh(ringGeometry(.0022,.0007),ringPaint);ringCore.name='deflector-rear-glow-core';glowRing.add(ringCore);
   const haloPaint=ringPaint.clone();haloPaint.blending=T.AdditiveBlending;haloPaint.uniforms.strength.value=.65;
   // Extend the feathered outer glow past the dish lip, retaining normal depth
   // testing so it never shines through opaque ship geometry.
   const ringHalo=new T.Mesh(ringGeometry(.06,.0006,8),haloPaint);ringHalo.name='deflector-rear-glow-halo';glowRing.add(ringHalo);
   for(const side of [-1,1]){
    const name=side<0?'port':'starboard',nacelle=name+'-engine-outer-tube';
    // Aft side-edge saucer lamps look back along the outboard nacelle lettering.
    const registry=model.getObjectByName(name+'-nacelle-registry'),registryPositions=registry.geometry.attributes.position;
    let registryFore=Infinity,registryRear=-Infinity;
    for(let i=0;i<registryPositions.count;i++){const v=model.worldToLocal(registry.localToWorld(new T.Vector3().fromBufferAttribute(registryPositions,i)));registryFore=Math.min(registryFore,v.z);registryRear=Math.max(registryRear,v.z);}
    // Lettering occupies the aft half of the decal, behind the pennant arrow.
    const registryZ=registryFore+(registryRear-registryFore)*.75;
    const registrySpot=add(name+'-saucer-nacelle-registry',saucer,[side*.635,.415,-1.24],nacelle,[side*.518,.49,registryZ],3.2,3.0,Math.PI/90,1,true);
    registrySpot.penumbra=.30;
    root.getObjectByName('hull-spotlight-'+name+'-saucer-nacelle-registry').quaternion.setFromUnitVectors(new T.Vector3(0,0,1),registrySpot.target.position.clone().sub(registrySpot.position).normalize());
    // Narrow washes frame the underside registries.
    const undersideSpot=add(name+'-ventral-registry',bowl,[side*.24,.327,-1.446],saucer,[side*.45,.352,-1.446],.70,.85,Math.PI*.22,1,true);
    undersideSpot.penumbra=.55;
    root.getObjectByName('hull-spotlight-'+name+'-ventral-registry').quaternion.setFromUnitVectors(new T.Vector3(0,0,1),undersideSpot.target.position.clone().sub(undersideSpot.position).normalize());
    // A broader, softly feathered wash illuminates each main hull pennant.
    const pennant=name+'-secondary-pennant';
    const pennantSpot=add(name+'-engineering-forward',saucer,[side*.48,.35,-1.04],pennant,[side*.155,-.022,-.875],.35,1.35,Math.PI/18,1,true);
    pennantSpot.target.position.copy(surface(pennant,[side*.155,-.022,-.875],.0002,true));
    pennantSpot.penumbra=.90;
    root.getObjectByName('hull-spotlight-'+name+'-engineering-forward').quaternion.setFromUnitVectors(new T.Vector3(0,0,1),pennantSpot.target.position.clone().sub(pennantSpot.position).normalize());
    add(name+'-engineering-aft',body,[side*.105,.025,-.025],body,[side*.14,0,-.53],0,.85);
    add(name+'-pylon',name+'-engine-strut',[side*.12,.12,-.32],name+'-engine-strut',[side*.425,.44,-.32],.36,1.1,Math.PI/8);
    // Keep the saucer-facing nacelle beams and their lenses switched off.
    add(name+'-nacelle-forward',nacelle,[side*.36,.56,-.60],saucer,[side*.19,.44,-1.12],0,1.3,Math.PI/45,1,true);
    // Register the aft bay spotlight to the actual gap between the service
    // assembly's trailing edge and the gray inboard rectangle's leading edge.
    const inboard=model.getObjectByName(name+'-inboard-service-panel'),grayPanel=model.getObjectByName(name+'-inboard-aft-engine-vent');
    const assemblyEnd=model.worldToLocal(inboard.localToWorld(new T.Vector3(0,0,inboard.userData.inboardPanel.end))).z;
    let grayFront=Infinity;
    grayPanel.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=model.worldToLocal(mesh.localToWorld(new T.Vector3().fromBufferAttribute(p,i)));grayFront=Math.min(grayFront,v.z);}});
    const bayLampZ=(assemblyEnd+grayFront)/2;
    const baySpot=add(name+'-nacelle-bay',nacelle,[side*.36,.46,bayLampZ],'movie-hangar-flat-door-rim',[side*.035,.025,.03],.35,1.1,Math.PI/12,1,true);
    const bayFixture=root.getObjectByName('hull-spotlight-'+name+'-nacelle-bay');
    bayFixture.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),baySpot.target.position.clone().sub(baySpot.position).normalize());
    bayFixture.userData.axialGap={front:assemblyEnd,rear:grayFront};
   }
   const state={lamps,glowRing,setEnabled(value){for(const lamp of lamps){const on=value&&lamp.intensity>0;lamp.light.visible=!!on;lamp.light.intensity=on?lamp.intensity:0;lamp.lens.emissiveIntensity=on?lensBrightness:0;lamp.lens.color.setHex(on?0xe5dfd3:0x535a55);}glowRing.visible=false;root.userData.enabled=!!value;}};
   root.userData.lightCount=lamps.length;model.userData.exteriorLights=state;state.setEnabled(enabled);return root;
  }
 };
 for(const button of buttons){button.addEventListener('click',()=>{api.enabled=!enabled;button.blur();});button.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter')e.stopPropagation();});}sync();return api;
})();
