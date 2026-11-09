/* Alpine Flight scenery adapted to the shuttle's kilometre-based mission. */
window.PlanetSurface=(()=>{
  const riverX=z=>600+Math.sin(z*.00063)*300+Math.sin(z*.0014)*90;
  const riverWidth=z=>120+220*Math.exp(-Math.pow((z+3100)/650,2));
  function height(x,y){
    const wx=(x-8)*1000,wz=(y+12)*1000,distance=Math.abs(wx-riverX(wz)),edge=Math.max(0,distance-1100)/3600;
    const ridge=Math.pow(edge,1.3)*(900+180*Math.sin(wz*.00055+wx*.0003)+120*Math.sin(wz*.0009-wx*.0005));
    const detail=(Math.sin(wx*.0031)*Math.cos(wz*.0023)*35+Math.sin(wx*.009+wz*.004)*10)*Math.min(edge,1);
    const floor=26+Math.sin(wz*.001)*5+Math.sin(wx*.0017)*3;
    const channel=17*Math.exp(-Math.pow(distance/(riverWidth(wz)*1.05),4));
    const endRidge=900*Math.exp(-Math.pow((wz+7600)/1900,2))*(.75+Math.pow(Math.sin(wx*.0008),2)*.2);
    return (floor+2300*Math.tanh(ridge/2300)+detail+endRidge-channel)/1000;
  }
  function create(){
    const T=window.AlpineThree;if(!T)return null;
    let renderer;try{renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});}catch{return null;}
    renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.outputColorSpace=T.SRGBColorSpace;
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(55,1,1,120000);scene.fog=new T.FogExp2(0xc6d3c1,.000055);
    let seed=2401;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const standard=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.88,...extra});
    function mesh(parent,geometry,material,x=0,y=0,z=0){const o=new T.Mesh(geometry,material);o.position.set(x,y,z);parent.add(o);return o;}
    const sunDir=new T.Vector3(-.55,.42,-.55).normalize();
    const sky=mesh(scene,new T.SphereGeometry(115000,24,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{sun:{value:sunDir}},vertexShader:'varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 vPosition;uniform vec3 sun;void main(){vec3 d=normalize(vPosition);float t=pow(max(0.0,d.y),0.45);vec3 c=mix(vec3(.90,.83,.68),vec3(.31,.63,.73),t);float s=max(0.0,dot(d,sun));c+=vec3(1.,.66,.26)*pow(s,20.)*.22;c+=vec3(1.,.80,.45)*pow(s,900.)*1.1;gl_FragColor=vec4(c,1.);}'}));
    sky.material.uniforms.tint={value:new T.Color(0x83c8ff)};
    sky.material.fragmentShader=sky.material.fragmentShader.replace('uniform vec3 sun;','uniform vec3 sun;uniform vec3 tint;').replace('gl_FragColor=vec4(c,1.);','gl_FragColor=vec4(mix(c,tint,.24),1.);');
    const hemisphere=new T.HemisphereLight(0xc8ebf0,0x587156,1.8);scene.add(hemisphere);
    const sun=new T.DirectionalLight(0xffd4a0,3.1);sun.position.set(6400,2400,-14300);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-800,right:800,top:800,bottom:-800,near:10,far:12000});sun.shadow.bias=-.00025;sun.shadow.normalBias=.35;scene.add(sun,sun.target);
    let geo=new T.PlaneGeometry(48000,56000,180,210);geo.rotateX(-Math.PI/2);geo.translate(8000,0,-12000);
    let positions=geo.attributes.position;for(let i=0;i<positions.count;i++)positions.setY(i,height(positions.getX(i)/1000,positions.getZ(i)/1000)*1000);
    geo=geo.toNonIndexed();geo.computeVertexNormals();positions=geo.attributes.position;const colors=new Float32Array(positions.count*3),color=new T.Color();
    for(let i=0;i<positions.count;i+=3){const y=(positions.getY(i)+positions.getY(i+1)+positions.getY(i+2))/3,x=positions.getX(i)-8000,z=positions.getZ(i)+12000;
      if(y+Math.sin(x*.004+z*.003)*85>1580)color.set(0xe9e9db);
      else if(y>1050)color.set(0x829589).lerp(new T.Color(0xb9bcb1),Math.min(1,(y-1050)/500));
      else if(y>420)color.set(0x4f7964).lerp(new T.Color(0x798b6c),(y-420)/800);
      else color.set(0x83a66d).lerp(new T.Color(0xb4bd7f),Math.sin(x*.0009+z*.001)*.25+.25);
      color.multiplyScalar(.91+random()*.16);for(let j=0;j<3;j++)color.toArray(colors,(i+j)*3);
    }
    geo.setAttribute('color',new T.BufferAttribute(colors,3));const terrain=mesh(scene,geo,standard(0xffffff,{vertexColors:true,flatShading:true}));terrain.receiveShadow=true;
    const originalColors=colors.slice();
    // Surface survey flight follows the same turquoise river and alpine palette.
    const waterPositions=[],waterIndices=[];for(let i=0;i<=600;i++){const z=28000-i*100,x=riverX(z),width=riverWidth(z)*.92;waterPositions.push(8000+x-width,18.25,-12000+z,8000+x+width,18.25,-12000+z);if(i<600){const a=i*2;waterIndices.push(a,a+1,a+2,a+1,a+3,a+2);}}
    const waterGeo=new T.BufferGeometry();waterGeo.setAttribute('position',new T.Float32BufferAttribute(waterPositions,3));waterGeo.setIndex(waterIndices);waterGeo.computeVertexNormals();
    const water=mesh(scene,waterGeo,new T.MeshPhongMaterial({color:0x3bafb2,specular:0xffe0ab,shininess:110,side:T.DoubleSide}));
    const count=8500,dummy=new T.Object3D(),trunks=new T.InstancedMesh(new T.CylinderGeometry(.65,1,6,5),standard(0x705d3e),count),pines=new T.InstancedMesh(new T.ConeGeometry(5,19,7),standard(0x346553),count),tops=new T.InstancedMesh(new T.ConeGeometry(3.8,14,6),standard(0x52826a),count);
    let planted=0;for(let tries=0;planted<count&&tries<60000;tries++){
      const x=(random()-.5)*25000,z=(random()-.5)*32000,y=height(8+x/1000,-12+z/1000)*1000;
      if(y>1450||Math.abs(x-riverX(z))<riverWidth(z)+40||Math.hypot(x,z)<180)continue;
      const scale=.8+random()*1.4;dummy.position.set(8000+x,y+3*scale,-12000+z);dummy.scale.setScalar(scale);dummy.rotation.y=random()*Math.PI;dummy.updateMatrix();trunks.setMatrixAt(planted,dummy.matrix);
      dummy.position.y=y+12*scale;dummy.updateMatrix();pines.setMatrixAt(planted,dummy.matrix);dummy.position.y=y+22*scale;dummy.updateMatrix();tops.setMatrixAt(planted,dummy.matrix);
      const tint=new T.Color().setHSL(.39+random()*.035,.18+random()*.12,.27+random()*.17);pines.setColorAt(planted,tint);tops.setColorAt(planted,tint.clone().multiplyScalar(1.15));planted++;
    }
    for(const o of [trunks,pines,tops]){o.count=planted;o.castShadow=true;o.receiveShadow=true;scene.add(o);}
    const cloudCanvas=document.createElement('canvas');cloudCanvas.width=512;cloudCanvas.height=128;const cc=cloudCanvas.getContext('2d');
    cc.shadowColor='#ffffff';cc.shadowBlur=5;
    for(let i=0;i<85;i++){const x=15+random()*110,y=35+random()*55,length=210+random()*180;cc.strokeStyle=`rgba(255,255,255,${.06+random()*.09})`;cc.lineWidth=.8+random()*3;cc.beginPath();cc.moveTo(x,y);cc.bezierCurveTo(x+length*.3,y-15-random()*10,x+length*.7,y+10+random()*12,x+length,y-8);cc.stroke();}
    cc.globalCompositeOperation='destination-in';const fade=cc.createLinearGradient(0,0,512,0);fade.addColorStop(0,'#ffffff00');fade.addColorStop(.18,'#ffffffff');fade.addColorStop(.75,'#ffffffff');fade.addColorStop(1,'#ffffff00');cc.fillStyle=fade;cc.fillRect(0,0,512,128);
    const cloudMaterial=new T.MeshBasicMaterial({map:new T.CanvasTexture(cloudCanvas),color:0xfff4dd,transparent:true,opacity:.65,depthWrite:false,side:T.DoubleSide}),clouds=new T.InstancedMesh(new T.PlaneGeometry(1,1),cloudMaterial,90),cloudLocations=[];scene.add(clouds);
    for(let i=0;i<90;i++)cloudLocations.push({x:8000+(random()-.5)*30000,y:1700+random()*2200,z:-12000+(random()-.5)*36000,w:700+random()*1100,h:130+random()*140,angle:(random()-.5)*.16});
    const beaconGroup=new T.Group();beaconGroup.position.set(8000,height(8,-12)*1000,-12000);scene.add(beaconGroup);
    const stone=standard(0xb9b8aa),cap=standard(0x626e76),trim=standard(0xc9c9bc);
    mesh(beaconGroup,new T.BoxGeometry(38,110,38),stone,0,55,0).castShadow=true;
    for(let i=0;i<4;i++)mesh(beaconGroup,new T.BoxGeometry(148-i*23,7,148-i*23),i%2?trim:cap,0,111+i*8,0).castShadow=true;
    const base=mesh(beaconGroup,new T.CylinderGeometry(36,44,10,8),stone,0,5,0);base.receiveShadow=true;
    const forward=new T.Vector3(),up=new T.Vector3(),point=new T.Vector3();let width=0,tall=0,lastPlanetColor=null;
    function setPlanetColor(iconColor){
      if(iconColor===lastPlanetColor)return;lastPlanetColor=iconColor;
      const tint=new T.Color(iconColor),white=new T.Color(0xffffff),ground=tint.clone().lerp(white,.12);
      for(let i=0;i<positions.count;i++){const j=i*3,luma=originalColors[j]*.2126+originalColors[j+1]*.7152+originalColors[j+2]*.0722,snow=Math.max(0,Math.min(.8,(positions.getY(i)-1450)/500));colors[j]=ground.r*luma*1.8*(1-snow)+originalColors[j]*snow;colors[j+1]=ground.g*luma*1.8*(1-snow)+originalColors[j+1]*snow;colors[j+2]=ground.b*luma*1.8*(1-snow)+originalColors[j+2]*snow;}
      geo.attributes.color.needsUpdate=true;
      pines.material.color.copy(tint).lerp(new T.Color(0x444444),.4);tops.material.color.copy(pines.material.color).multiplyScalar(1.15);
      water.material.color.copy(tint).lerp(new T.Color(0x5d8b99),.35);
      hemisphere.groundColor.copy(tint).multiplyScalar(.45);sky.material.uniforms.tint.value.copy(tint);
      scene.fog.color.copy(tint).lerp(white,.65);cloudMaterial.color.copy(tint).lerp(white,.8);
    }
    function draw(ctx,w,h,m,s){
      setPlanetColor(m.planet.color);
      const rw=Math.min(1920,Math.round(w)),rh=Math.round(h*rw/w);if(width!==rw||tall!==rh){renderer.setSize(rw,rh,false);camera.aspect=rw/rh;camera.updateProjectionMatrix();width=rw;tall=rh;}
      const bank=m.bank||0;
      const heading=s.heading*Math.PI/180,pitch=s.pitch*Math.PI/180;
      forward.set(Math.sin(heading)*Math.cos(pitch),Math.sin(pitch),-Math.cos(heading)*Math.cos(pitch));camera.position.set(m.x*1000,m.z*1000,m.y*1000);
      up.set(-Math.sin(heading)*Math.sin(pitch),Math.cos(pitch),Math.cos(heading)*Math.sin(pitch));up.applyAxisAngle(forward,bank);camera.up.copy(up);camera.lookAt(point.copy(camera.position).add(forward));
      camera.updateMatrixWorld();cloudLocations.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.quaternion.copy(camera.quaternion);dummy.rotateZ(p.angle);dummy.scale.set(p.w,p.h,1);dummy.updateMatrix();clouds.setMatrixAt(i,dummy.matrix);});clouds.instanceMatrix.needsUpdate=true;
      sky.position.copy(camera.position);sun.position.set(camera.position.x-1600,camera.position.y+2200,camera.position.z-2300);sun.target.position.set(camera.position.x,0,camera.position.z);sun.target.updateMatrixWorld();
      clouds.position.x=Math.sin(m.clock*.015)*80;beaconGroup.visible=!m.recovered;renderer.render(scene,camera);ctx.drawImage(renderer.domElement,0,0,w,h);
    }
    function project(x,y,z,w,h){point.set(x*1000,z*1000,y*1000);const depth=point.clone().sub(camera.position).dot(forward);if(depth<=0)return null;point.project(camera);return {x:(point.x+1)*w/2,y:(1-point.y)*h/2,d:depth/1000};}
    return {draw,project,renderer,scene,camera,terrain,clouds,trees:planted};
  }
  function mapColor(x,y,iconColor=0x83c8ff){
    const wx=(x-8)*1000,wz=(y+12)*1000,z=height(x,y);
    const rgb=[(iconColor>>16)&255,(iconColor>>8)&255,iconColor&255];
    if(Math.abs(wx-riverX(wz))<riverWidth(wz)*.92&&z<.025)return `rgb(${rgb.map((v,i)=>Math.round(v*.2+[8,18,28][i])).join(',')})`;
    const shade=z>1.58?.52:z>1.05?.42:z>.42?.32:.23;
    return `rgb(${rgb.map(v=>Math.round(v*shade)).join(',')})`;
  }
  return {height,mapColor,create};
})();
