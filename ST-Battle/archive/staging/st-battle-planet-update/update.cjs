const fs=require('node:fs');
const file=__dirname+'/scene.js';
let source=fs.readFileSync(file,'utf8');
source=source.replace("    this.ships={Enterprise:",`    // NASA/USGS Viking mosaic supplied as the planet reference. Prefer a local copy.
    this.planetMap=new T.Texture();this.planetMap.colorSpace=T.SRGBColorSpace;
    const planetLoader=new T.TextureLoader();
    const loadPlanet=url=>planetLoader.load(url,texture=>{this.planetMap.image=texture.image;this.planetMap.needsUpdate=true;texture.dispose();},undefined,()=>{});
    planetLoader.load('assets/mars-valles-marineris.png',texture=>{this.planetMap.image=texture.image;this.planetMap.needsUpdate=true;texture.dispose();},undefined,()=>loadPlanet('https://upload.wikimedia.org/wikipedia/commons/5/56/Mars_Valles_Marineris.jpeg'));
    this.ships={Enterprise:`);
const start=source.indexOf('    const terrainNoise=',source.indexOf('  makePlanet(){'));
const end=source.indexOf('    const atmosphere=',start);
source=source.slice(0,start)+`    // Project the reference globe onto the sphere rather than stretching its
    // black square background around the surface. The reverse shares the mosaic.
    const surface=new T.ShaderMaterial({uniforms:{marsMap:{value:this.planetMap||null}},vertexShader,fragmentShader:\`
      uniform sampler2D marsMap;varying vec3 globe;varying vec3 worldNormal;
      void main(){
        vec3 p=normalize(globe),n=normalize(worldNormal);
        vec2 photoUv=p.xy*.485+vec2(.5);
        vec3 photo=texture2D(marsMap,photoUv).rgb;
        // A warm surface remains visible while the image loads or when offline.
        vec3 color=mix(vec3(.48,.22,.105),photo,step(.015,dot(photo,vec3(.3333))));
        float daylight=.48+.52*max(dot(n,normalize(vec3(-.3,.5,.81))),0.);
        gl_FragColor=vec4(color*daylight,1.);
      }\`});
    planet.add(new T.Mesh(new T.SphereGeometry(body.radius,96,64),surface));
`+source.slice(end);
source=source.replace('vec3(.06,.20,.55),vec3(.10,.035,.18)','vec3(.34,.13,.055),vec3(.12,.035,.015)');
source=source.replace('rim*.65*fade','rim*.18*fade');
fs.writeFileSync(file,source);
const readme=__dirname+'/README.md';
let text=fs.readFileSync(readme,'utf8').replace('The gas giant is a true sphere','The Mars planet is a true sphere');
text+='\n\nPlanet image: NASA/USGS Viking 1 Valles Marineris mosaic, matching the supplied reference. Source: https://commons.wikimedia.org/wiki/File:Mars_Valles_Marineris.jpeg (public domain). The renderer first loads `assets/mars-valles-marineris.png`, then the same photo from Wikimedia if no local copy exists. The hosted photo requires internet access; an offline fallback displays a warm Mars-colored sphere. To bundle the photo offline, save a PNG copy at that asset path. The reference covers one hemisphere, so the reverse reuses the same terrain.\n';
fs.writeFileSync(readme,text);
