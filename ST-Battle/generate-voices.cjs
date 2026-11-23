/* Generate once, then play the Cedar/Marin recordings locally, including offline. */
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const catalog=require('./bridge-dialogue.js');
const model='gpt-4o-mini-tts';
const delivery={
  captain:'A calm, decisive starship captain giving concise bridge orders. Natural conversational delivery, measured pace, clear diction. Read only the supplied text.',
  helm:'An attentive professional starship helmsman acknowledging orders and reporting danger. Natural conversational delivery, brisk and clear, with urgency appropriate to the text. Read only the supplied text.'
};
function filename(role,text){return catalog.voices[role]+'-'+crypto.createHash('sha256').update(JSON.stringify([model,catalog.voices[role],delivery[role],text])).digest('hex').slice(0,20)+'.mp3';}
async function generate({apiKey=process.env.OPENAI_API_KEY,fetchImpl=globalThis.fetch,root=__dirname,dryRun=false}={}){
  const lines=catalog.lines();
  if(dryRun)return {count:lines.length,voices:catalog.voices};
  if(!apiKey)throw Error('OPENAI_API_KEY is not set. Configure it locally, then run npm run voices:generate. Do not put the key in browser code.');
  const directory=path.join(root,'assets','voices'),manifest=path.join(directory,'voice-clips.js');
  await fs.mkdir(directory,{recursive:true});
  const clips={};let generated=0;
  const save=()=>fs.writeFile(manifest,'/* AI-generated dialogue: Captain / Cedar; Helm / Marin. */\nwindow.BattleVoiceClips='+JSON.stringify(clips,null,2)+';\n');
  for(const {role,text} of lines){
    const name=filename(role,text),file=path.join(directory,name);
    let exists=false;try{exists=(await fs.stat(file)).size>0;}catch{}
    if(!exists){
      const response=await fetchImpl('https://api.openai.com/v1/audio/speech',{
        method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
        body:JSON.stringify({model,voice:catalog.voices[role],input:text,instructions:delivery[role],response_format:'mp3'}),
        signal:AbortSignal.timeout(60000)
      });
      // Never print the response body or credentials on an API failure.
      if(!response.ok)throw Error('Speech generation failed (HTTP '+response.status+'). Completed clips are saved; rerun to resume.');
      const bytes=Buffer.from(await response.arrayBuffer());if(!bytes.length)throw Error('Speech API returned an empty recording.');
      await fs.writeFile(file,bytes);generated++;
    }
    clips[role+'\n'+text]='assets/voices/'+name;await save();
  }
  return {count:lines.length,generated,voices:catalog.voices};
}
if(require.main===module)generate({dryRun:process.argv.includes('--dry-run')}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={generate,filename};
