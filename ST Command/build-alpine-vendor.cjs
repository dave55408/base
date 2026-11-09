// Reuse the locally bundled Three.js r180 from the Flight Simulator project.
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../flight-simulator/game.bundle.js'),'utf8');
const boundary=source.indexOf('  // flight.js');
if(boundary<0)throw new Error('Flight Simulator vendor boundary not found');
const names=['WebGLRenderer','Scene','PerspectiveCamera','Vector3','Color','Object3D','Group','Mesh','InstancedMesh','PlaneGeometry','BoxGeometry','SphereGeometry','ConeGeometry','CylinderGeometry','IcosahedronGeometry','BufferGeometry','BufferAttribute','Float32BufferAttribute','CanvasTexture','MeshStandardMaterial','MeshPhongMaterial','MeshLambertMaterial','MeshBasicMaterial','ShaderMaterial','HemisphereLight','DirectionalLight','FogExp2','BackSide','DoubleSide','PCFSoftShadowMap','ACESFilmicToneMapping','SRGBColorSpace'];
fs.writeFileSync(path.join(__dirname,'vendor/alpine-three.js'),source.slice(0,boundary)+'\nwindow.AlpineThree={'+names.join(',')+'};\n})();\n/* Three.js MIT license: see THREE-LICENSE.txt. */\n');
fs.copyFileSync(path.join(__dirname,'../flight-simulator/vendor/THREE-LICENSE.txt'),path.join(__dirname,'vendor/THREE-LICENSE.txt'));
