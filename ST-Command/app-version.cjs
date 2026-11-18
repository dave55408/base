/* Content-derived build versions, shared by the server and direct-file snapshot. */
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
// SemVer 2.0.0: numeric release/prerelease identifiers cannot have leading zeroes.
const SEMVER=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
function validateVersion(value){if(typeof value!=='string'||value.trim()!==value||!SEMVER.test(value))throw Error('package.json version must follow Semantic Versioning 2.0.0');return value;}
function createVersionTracker(root=__dirname){
 const files=new Map();let cached=null,checkedAt=0,pending=null;
 async function inputs(){
  const names=[];
  for(const entry of await fs.readdir(root,{withFileTypes:true}))if(entry.isFile()&&(
   /\.(js|css)$/.test(entry.name)&&!['app-version-data.js','project-notes.js','project-notes-format.js'].includes(entry.name)||
   ['index.html','package.json','server.cjs','app-version.cjs'].includes(entry.name)))names.push(entry.name);
  async function walk(relative){
   let entries;try{entries=await fs.readdir(path.join(root,relative),{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return;throw error;}
   for(const entry of entries){const name=path.join(relative,entry.name);if(entry.isDirectory())await walk(name);else if(entry.isFile())names.push(name);}
  }
  await walk('assets');await walk('vendor');return names.sort();
 }
 async function compute(){
  const hash=crypto.createHash('sha256'),names=await inputs();
  for(const name of names){
   const full=path.join(root,name),stat=await fs.stat(full),stamp=[stat.size,stat.mtimeMs,stat.ctimeMs].join('/');let entry=files.get(name);
   if(entry?.stamp!==stamp){entry={stamp,digest:crypto.createHash('sha256').update(await fs.readFile(full)).digest('hex')};files.set(name,entry);}
   hash.update(name.split(path.sep).join('/')).update('\0').update(entry.digest).update('\0');
  }
  for(const name of files.keys())if(!names.includes(name))files.delete(name);
  const release=validateVersion(JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version),revision=hash.digest('hex').slice(0,8);
  const result={version:release+(release.includes('+')?'.':'+')+revision,release,revision};
  const snapshot='/* Generated automatically from app code and assets. */\nwindow.ST_COMMAND_VERSION='+JSON.stringify(result)+';\n';
  const target=path.join(root,'app-version-data.js');let previous='';try{previous=await fs.readFile(target,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  if(previous!==snapshot){
   try{await fs.writeFile(target+'.tmp',snapshot);await fs.rename(target+'.tmp',target);}
   catch(error){
    // A read-only/offline snapshot must not break the live /api/version result.
    // Explicit snapshot generation still reports the write failure to the caller.
    if(require.main===module||!['EACCES','EPERM','EROFS'].includes(error.code))throw error;
   }
  }
  return result;
 }
 return {async current(force=false){
  if(pending)return pending;if(!force&&cached&&Date.now()-checkedAt<1000)return cached;
  pending=compute();try{cached=await pending;checkedAt=Date.now();return cached;}finally{pending=null;}
 }};
}
module.exports={createVersionTracker,validateVersion};
if(require.main===module)createVersionTracker().current().then(value=>console.log('App version: '+value.version)).catch(error=>{console.error(error);process.exitCode=1;});
