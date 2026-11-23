/* Snapshot ST-Command's current Third Model for standalone ST Battle replays.
   Reads ST-Command without starting or changing its application/server. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const source=path.resolve(process.argv[2]||path.join(__dirname,'../ST-Command'));
const {chromium}=require(require.resolve('playwright',{paths:[source,path.resolve(__dirname,'../elf-adventure')]}));
async function main(){
 const html=fs.readFileSync(path.join(source,'index.html'),'utf8');
 const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
 const selected=['space-starfield.js',...scripts.slice(scripts.findIndex(s=>s.startsWith('vendor/alpine-three')),scripts.findIndex(s=>s.startsWith('enterprise-third-renderer'))+1)].filter(s=>!s.startsWith('simulation-performance'));
 const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  if(name==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html><head>'+selected.map(s=>'<script src="'+s+'"></script>').join('')+'</head><body></body></html>');}
  const file=path.resolve(source,'.'+decodeURIComponent(name));
  if(!file.startsWith(source+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(data);});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage();page.on('pageerror',e=>console.error(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!window.createThirdEnterpriseRenderer);
  const data=await page.evaluate(async()=>{
   ShipTextures.quality='high';const ship=createThirdEnterpriseRenderer();await ship.ready;ship.setBayDoorOpen(0);
   // Capture composed material effects, including windows, recess masks and hull plating.
   ship.model.traverse(o=>{for(const m of [].concat(o.material||[])){
    if(m.__hdWrapped||!Object.hasOwn(m,'onBeforeCompile'))continue;m.__hdWrapped=true;const before=m.onBeforeCompile;
    m.onBeforeCompile=function(shader,renderer){const original=new Set(Object.keys(shader.uniforms));before.call(this,shader,renderer);m.__hdPatch={vertexShader:shader.vertexShader,fragmentShader:shader.fragmentShader,uniforms:Object.fromEntries(Object.entries(shader.uniforms).filter(([key])=>!original.has(key)))};};
   }});
   ship.renderer.compile(ship.scene,ship.camera);
   const geometries=[],materials=[],textures=[],geometryIDs=new Map(),materialIDs=new Map(),textureIDs=new Map();
   const encode=array=>{const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return {type:array.constructor.name,data:btoa(s)};};
   function texture(t,label){
    if(textureIDs.has(t))return textureIDs.get(t);const id=textures.length;textureIDs.set(t,id);
    const image=t.image,spec={colorSpace:t.colorSpace,wrapS:t.wrapS,wrapT:t.wrapT,repeat:t.repeat.toArray(),offset:t.offset.toArray(),flipY:t.flipY,rotation:t.rotation,center:t.center.toArray(),minFilter:t.minFilter,magFilter:t.magFilter,generateMipmaps:t.generateMipmaps};
    if(t.isRenderTargetTexture&&label==='uImpulseBlurMap')spec.dynamic='impulse-blur';
    else if(image.data)spec.raw={...encode(image.data),width:image.width,height:image.height,format:t.format,pixelType:t.type};
    else{const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;try{canvas.getContext('2d').drawImage(image,0,0);}catch{throw Error('Unsupported HD texture '+JSON.stringify({name:t.name,label,type:t.type,renderTarget:t.isRenderTargetTexture,imageType:image.constructor.name,keys:Object.keys(image)}));}spec.image=canvas.toDataURL('image/png');}
    textures.push(spec);return id;
   }
   function material(m){
    if(materialIDs.has(m))return materialIDs.get(m);const id=materials.length;materialIDs.set(m,id);
    const spec={type:m.type};
    for(const key of ['color','emissive','specular'])if(m[key])spec[key]=m[key].toArray();
    for(const key of ['roughness','metalness','shininess','emissiveIntensity','opacity','transparent','side','depthWrite','depthTest','alphaTest','toneMapped','blending','polygonOffset','polygonOffsetFactor','polygonOffsetUnits','bumpScale'])if(m[key]!==undefined)spec[key]=m[key];
    if(m.isShaderMaterial){
     spec.shader={vertexShader:m.vertexShader,fragmentShader:m.fragmentShader,defines:m.defines,uniforms:{}};
     for(const [key,{value}]of Object.entries(m.uniforms)){
      spec.shader.uniforms[key]=value?.isTexture?{texture:texture(value,key)}:value?.toArray?{array:value.toArray(),kind:value.isColor?'Color':value.constructor.name}:{value};
     }
    }
    if(m.__hdPatch){
     spec.patch={vertexShader:m.__hdPatch.vertexShader,fragmentShader:m.__hdPatch.fragmentShader,uniforms:{}};
     for(const [key,{value}]of Object.entries(m.__hdPatch.uniforms))spec.patch.uniforms[key]=value?.isTexture?{texture:texture(value,key)}:value?.toArray?{array:value.toArray(),kind:value.isColor?'Color':value.constructor.name}:{value};
    }
    if(m.userData.hullSurfaceDetail)spec.surface={mode:m.userData.hullSurfaceMode,physical:m.userData.hullSurfacePhysical,bareMetal:m.customProgramCacheKey().includes('-bare'),paintUnderlay:m.userData.hullPaintUnderlay,paintOpacity:m.userData.hullPaintOpacity,tileScale:m.userData.hullPanelTileScale};
    spec.maps={};for(const key of ['map','emissiveMap','alphaMap','bumpMap','roughnessMap','metalnessMap'])if(m[key]?.image)spec.maps[key]=texture(m[key]);
    materials.push(spec);return id;
   }
   function geometry(g){
    if(geometryIDs.has(g))return geometryIDs.get(g);const id=geometries.length;geometryIDs.set(g,id);
    const attributes={};for(const [key,a]of Object.entries(g.attributes)){if(a.isInterleavedBufferAttribute)throw Error('Unsupported interleaved geometry');attributes[key]={...encode(a.array),itemSize:a.itemSize,normalized:a.normalized};}
    geometries.push({attributes,index:g.index?encode(g.index.array):null,groups:g.groups});return id;
   }
   function node(o){
    // Closed exterior replay never enters these rooms. Keep the actual hull and doors.
    if(['reference-bay-interior','bridge-circular-room','bridge-hatch-room','bridge-helm-console'].includes(o.name)||o.isLight)return null;
    o.updateMatrix();const spec={name:o.name,matrix:o.matrix.toArray(),visible:o.visible,renderOrder:o.renderOrder};
    if(o.isMesh){spec.geometry=geometry(o.geometry);spec.material=Array.isArray(o.material)?o.material.map(material):material(o.material);if(o.isInstancedMesh){spec.instances=encode(o.instanceMatrix.array);spec.count=o.count;if(o.instanceColor)spec.instanceColor=encode(o.instanceColor.array);}}
    spec.children=o.children.map(node).filter(Boolean);return spec;
   }
   const model=node(ship.model),result={version:1,source:'ST-Command / Third Model',geometries,materials,textures,model};ship.dispose();return result;
  });
  const output=path.join(__dirname,'assets','hd','st-command-model.js');fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,'/* Generated by build-hd-model.cjs from ST-Command Third Model. */\nwindow.BattleHDModelData='+JSON.stringify(data)+';\n');
  fs.copyFileSync(path.join(source,'assets/textures/riveted-hull-reference-v2.js'),path.join(path.dirname(output),'hull-panel-tile.js'));
  const surface=fs.readFileSync(path.join(source,'enterprise-hull-surface-detail.js'),'utf8');
  fs.writeFileSync(path.join(path.dirname(output),'hull-surface-detail.js'),'/* ST-Command hull finish; view distance adjusted to ST Battle model scale. */\n'+surface);
  console.log(JSON.stringify({output,bytes:fs.statSync(output).size,geometries:data.geometries.length,materials:data.materials.length,textures:data.textures.length}));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
