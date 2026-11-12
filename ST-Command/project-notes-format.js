/* Shared standalone HTML format for server and direct-file notes. */
(()=>{
const escapeNotes=text=>text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function notesDocument(notes){return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ST Command · Project Notes</title>
<style>body{margin:0;padding:32px 20px;background:#16120e;color:#f4e5cf;font:16px/1.7 system-ui,sans-serif}main{max-width:800px;margin:auto}h1{color:#ffd08a;font-size:24px;font-weight:500;border-bottom:1px solid #765028;padding-bottom:16px}article{white-space:pre-wrap;overflow-wrap:anywhere;background:#211a13;border:1px solid #594329;border-radius:8px;padding:24px;min-height:180px}</style></head>
<body><main><h1>ST Command · Project Notes</h1><article id="project-notes-content">${escapeNotes(notes)}</article></main></body></html>
`;}
function readNotesDocument(html){
  const content=/<article id="project-notes-content">([\s\S]*?)<\/article>/.exec(html);
  if(!content)throw Error('Missing notes content');
  return content[1].replace(/&(amp|lt|gt|quot|#39);/g,entity=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[entity]));
}
const format={notesDocument,readNotesDocument};
if(typeof module==='object'&&module.exports)module.exports=format;
else window.STProjectNotesFormat=format;
})();
