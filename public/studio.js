import ui from './studio-ui.js';
(function interaction(){
const {state,root,apiRoot,rows,row,info,esc,icon,pill,button,label,select,input,textarea,note,empty,review,audience,foot,recordForm,fileUrl,entryRow,topics,firstTopic,fileTypes,activePage,go,render,getNext,libraryItems,nextDashboard}=ui;
let toastTimer;
let sharedRequest=0;
let mutating=false;
const dialog=()=>document.querySelector('#dialog');

async function api(route, options={}){
  const response=await fetch(apiRoot+route,{cache:'no-store',...options});
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data) throw new Error(data?.error||'The studio could not connect. Try again.');
  return data;
}
const send=(route,body)=>api(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
function toast(message,error=false){
  const el=(dialog()?.open&&error?dialog().querySelector('.modal-feedback'):null)||document.querySelector('#toast');
  if(!el) return;
  el.classList.toggle('error',error);
  el.textContent=message;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{el.textContent='';},3800);
}
function modal(title,detail,body){
  const el=dialog();
  el.innerHTML=`<div class="modal-body"><div class="card-head"><div><h2 id="dialog-title">${esc(title)}</h2>${detail?`<p>${esc(detail)}</p>`:''}</div><button class="btn quiet icon-only" type="button" data-action="close" aria-label="Close dialog">${icon('close')}</button></div><div class="stack">${body}</div><div class="modal-feedback" role="status" aria-live="polite"></div></div>`;
  if(!el.open)el.showModal();
  el.onclose=()=>{if('speechSynthesis' in window)speechSynthesis.cancel();};
}
function close(){
  if(dialog()?.open)dialog().close();
}
function refreshShared(){
  const request=++sharedRequest;
  state.sharedError='';
  api('shared').then(data=>{
    if(request!==sharedRequest)return;
    state.shared=data.entries;
    if(state.page==='shared'&&!dialog().open) render();
  }).catch(e=>{
    if(request!==sharedRequest)return;
    state.sharedError=e.message;
    if(state.page==='shared'&&!dialog().open) render();
  });
}
async function load(){
  try{
    const data=await api('state');
    Object.assign(state,data,{loaded:true,error:''});
    render();
    if(state.page==='shared')refreshShared();
  }catch(e){
    state.error=e.message;
    render();
    if(/sign in/i.test(e.message)){
      document.querySelector('.notice')?.insertAdjacentHTML('beforeend','<a class="text-btn" href="/auth/login" target="_top">Sign in</a>');
    }else{
      document.querySelector('.notice')?.insertAdjacentHTML('beforeend',button('Retry','reload','','quiet inline'));
    }
  }
}
function saveLocal(entry){
  state.entries=[entry,...state.entries.filter(e=>e.id!==entry.id)];
}
function showUpload(){
  modal('Upload to your archive','Select one file. Each upload begins in Needs review.',recordForm('upload',`
    <div class="form-grid">
    ${label('File',`<input type="file" name="file" accept="${fileTypes}" required>`,true,'Images, audio, video, PDF, Word, or text up to 20 MB.')}
    ${label('Display title',input('title','','Use filename if left empty','maxlength="300"'),true)}
    ${label('Category',select('category',['Memory','Portrait','Voice recording','Video','Personal document','Other'],'Memory'))}
    ${audience(defaults())}</div>${foot('Upload file')}`));
}
function showPreset(id){
  const e=row(id),d=e?.data||{};
  modal(e?'Manage sharing preset':'New sharing preset','Members can view completed items assigned to this preset.',recordForm('preset',`
    <input type="hidden" name="id" value="${esc(id)}"><div class="form-grid">
    ${label('Preset name',input('title',e?.title,'For example, Family stories','required maxlength="100"'),true)}
    ${label('Description',input('description',d.description,'What this audience can expect','maxlength="1000"'),true)}
    ${label('Viewer emails',textarea('emails',d.emails?.join('\n'),'One email address per line','maxlength="8000"'),true,'Viewers must already have access to the Site. This form does not send invitations.')}</div>
    ${foot('Save preset',e?button('Delete preset','confirm-delete',id,'danger'):'')}`));
}
function media(e){
  const url=fileUrl(e);
  if(e.data.mime?.startsWith('image/'))return `<div class="media-preview"><img class="profile-photo" alt="${esc(e.title)}" src="${esc(url)}"></div>`;
  if(e.data.mime?.startsWith('audio/'))return `<div class="media-preview"><audio src="${esc(url)}" controls preload="metadata"></audio></div>`;
  if(e.data.mime?.startsWith('video/'))return `<div class="media-preview"><video src="${esc(url)}" controls preload="metadata"></video></div>`;
  return '';
}
const download=(e)=>`<a class="btn quiet" href="${esc(fileUrl(e,true))}" download>${icon('file',14)} Download file</a>`;
function showAsset(e){
  modal(e.title,e.data.category||'Archive file',media(e)+recordForm('asset',`
    <input type="hidden" name="id" value="${esc(e.id)}"><div class="form-grid stack">
    ${label('Display title',input('title',e.title,'','required maxlength="300"'),true)}${audience(e.preset)}${review(e.status)}</div>
    ${foot('Save file details',download(e)+button('Delete','confirm-delete',e.id,'danger'))}`));
}
function showAnswer(e){
  const linked=e?rows('answer').filter(r=>r.data.parent===e.id):[];
  const parent=e&&row(e.data.parent);
  modal(e?'Review answer':'Add a question',e?.data.topic||'Record a question and answer in your own words.',
    recordForm('edit-answer',`<input type="hidden" name="id" value="${esc(e?.id||'')}"><div class="form-grid">
    ${label('Question',input('title',e?.title,'What would you like to remember?','required maxlength="300"'),true)}
    ${label('Topic',select('topic',Object.keys(topics),e?.data.topic||firstTopic),true)}
    ${label('Answer',textarea('answer',e?.data.answer,'Write your answer.','required maxlength="12000"'),true)}
    ${audience(e?.preset||defaults())}${review(e?.status||'review')}</div>
    ${foot('Save answer',e?button('Delete','confirm-delete',e.id,'danger')+button('Ask a follow-up','follow',e.id,'quiet','sparkle'):'')}`)+
    (parent||linked.length?`<hr class="rule"><div class="list">${parent?textBtn('Original question','entry',parent.id):''}${linked.map(e=>textBtn(e.title,'entry',e.id)).join('')}</div>`:''));
}
function showRecord(e){
  if(!e)return;
  if(e.kind==='asset')showAsset(e);
  else if(e.kind==='answer')showAnswer(e);
  else if(['profile','traits','avatar'].includes(e.kind)){close();go(e.kind);}
}
function showShared(e){
  const d=e.data;
  const details=e.kind==='answer'?[['Answer',d.answer]]:e.kind==='profile'?[['Name',d.name],['Pronouns',d.pronouns],['Date of birth',d.birth],['Places',d.location],['Biography',d.bio]]:
    e.kind==='traits'?[['Traits',d.traits?.join(', ')],['Values',d.values],['Speaking style',d.tone],['Boundaries',d.boundaries]]:[];
  modal(e.title,'Shared with your signed-in email.',e.kind==='asset'?media(e)+`<div class="form-foot">${download(e)}</div>`:
    `<div class="list">${details.filter(([,v])=>v).map(([k,v])=>`<div class="list-row"><div class="row-main"><strong>${k}</strong><p>${esc(v)}</p></div></div>`).join('')}</div>`);
}
function showPreview(){
  const a=info('avatar'),photo=row(a.portrait),voice=row(a.recording);
  const bars=[11,18,24,14,32,38,24,15,26,36,43,25,15,24,34,26,18,10,19,12,18];
  const voiceChoice=a.voice||'Original recording';
  const audioOnly=a.look==='Audio only';
  modal('Avatar preview',a.look||'Photorealistic · sample preview',
    `${audioOnly?'':`<img class="profile-photo" src="${photo?esc(fileUrl(photo)):'/sample-avatar.jpg'}" alt="${photo?'Your selected portrait':'Fictional sample portrait'}">`}
    <div class="card-head stack"><div><h3>${esc(voiceChoice)}</h3><p>${voiceChoice==='Text only'?'Audio is off for this configuration.':voice?'Original source audio is available below.':'Select a source recording to hear your own voice.'}</p></div>${pill(audioOnly?'Audio only':photo?'Your portrait':'Sample portrait','green','avatar')}</div>
    ${voiceChoice==='Text only'?'':voice&&voiceChoice==='Original recording'?media(voice):`<div class="wave" aria-hidden="true">${bars.map(h=>`<i style="height:${h}px"></i>`).join('')}</div>${voiceChoice==='Original recording'?'':button('Play narration sample','speak','','quiet','play')}`}
    <div class="form-foot">${button('Edit avatar settings','avatar-settings','','quiet','avatar')}
    ${state.avatarService&&a.consent&&photo?button('Start live preview','live','','primary','play'):''}</div>
    <p class="hint stack">${state.avatarService?'Live preview is available with a saved portrait and provider consent.':'Live rendering becomes available when an avatar provider is connected.'}</p>`);
}
function followup(e){
  const response=e.data.answer;
  const quote=response.match(/[“"]([^”"]{8,64})[”"]/u)?.[1];
  const clauses=response.split(/[.!?;\n]+/).map(s=>s.trim()).filter(Boolean);
  const meaningful=clauses.find(s=>s.split(/\s+/).length>=5)||clauses[0]||'';
  const excerpt=quote||meaningful.split(/\s+/).slice(0,13).join(' ');
  const phrase=excerpt.length>100?excerpt.slice(0,97)+'…':excerpt;
  const anchor=phrase?`You wrote “${phrase}.” `:'';
  const variants=/\b(died|death|loss|grief|miss)\b/i.test(response)?[
    'What do you most want someone to understand about that part of your story?',
    'Is there a small detail from that time you would like to preserve?'
  ]:/\b(mom|dad|mother|father|friend|sister|brother|family|teacher|grandmother|grandfather|partner)\b/i.test(response)?[
    'What did that person do that stayed with you?',
    'What is one moment with them that helps explain what they meant to you?'
  ]:/\b(decided|choose|chose|choice|moved|quit|started)\b/i.test(response)?[
    'What made that decision difficult, and what helped you make it?',
    'How did that choice change the way you handled a later decision?'
  ]:[
    'Can you describe a specific moment that shows why this mattered to you?',
    'What did you understand differently after that experience?',
    'What small detail would help someone picture what it was like?'
  ];
  const already=new Set(rows('answer').filter(r=>r.data.parent===e.id).map(r=>r.title));
  const questions=variants.map(q=>anchor+q);
  state.topic=topics[e.data.topic]?e.data.topic:firstTopic;
  state.parent=e.id;
  state.prompt=questions.find(q=>!already.has(q))||anchor+'How would you explain what this taught you to someone who wasn’t there?';
  close();
  go('discovery');
}
function skip(){
  const current=getNext();
  const list=topics[state.topic];
  const pos=list.indexOf(current);
  state.parent='';
  state.prompt=list[(pos+1)%list.length];
  render();
}
function showReview(){
  const pending=state.entries.filter(e=>e.status==='review'&&!['settings','preset'].includes(e.kind));
  modal('Needs review',`${pending.length} ${pending.length===1?'item is':'items are'} waiting for your review.`,
    `<div class="list">${pending.length?pending.map(e=>entryRow(e)).join(''):empty('check','You’re caught up','New items marked Needs review will appear here.')}</div>`);
}
function confirmDelete(id){
  const e=row(id);
  if(!e)return;
  modal('Delete '+(e.kind==='preset'?'sharing preset':e.kind==='asset'?'archive file':'answer'),e.kind==='preset'?'Records using this preset will become private.':'This removes the record from your archive.',
    `<p>${esc(e.title)}</p><div class="form-foot">${button('Cancel','entry-or-preset',id,'quiet')}${button('Delete permanently','delete',id,'danger')}</div>`);
}
async function remove(id,el){
  el.disabled=true;
  try{
    await api('entry/'+encodeURIComponent(id),{method:'DELETE'});
    const deleted=row(id);
    state.entries=state.entries.filter(e=>e.id!==id);
    if(deleted?.kind==='preset'){
      state.entries=state.entries.map(e=>e.preset===id?{...e,preset:'private'}:
        e.kind==='settings'&&e.data.defaultPreset===id?{...e,data:{...e.data,defaultPreset:'private'}}:e);
    }
    close();render();toast('Deleted.');
  }catch(e){el.disabled=false;toast(e.message,true);}
}
async function live(el){
  el.disabled=true;
  try{
    const {previewUrl}=await send('avatar-preview',{});
    modal('Live avatar session','The rendering provider created a preview link.',
      `<a class="btn primary" href="${esc(previewUrl)}" rel="noopener noreferrer" target="_blank">${icon('up',15)} Open provider preview</a>`);
  }catch(e){el.disabled=false;toast(e.message,true);}
}
function speech(){
  if(!('speechSynthesis' in window)){toast('Narration samples are unavailable in this browser.',true);return;}
  const local=speechSynthesis.getVoices().filter(v=>v.localService&&v.lang.toLowerCase().startsWith('en'));
  if(!local.length){toast('No local English narration voice is available.',true);return;}
  const warm=info('avatar').voice==='Warm narration';
  const utterance=new SpeechSynthesisUtterance('Every life holds stories worth keeping. This is a sample of the narration style.');
  utterance.voice=local[warm?0:Math.min(1,local.length-1)];
  utterance.rate=warm?0.88:1.03;
  utterance.pitch=warm?0.91:1.03;
  speechSynthesis.cancel();speechSynthesis.speak(utterance);
}
const click={
  go,menu:()=>{state.mobile=!state.mobile;render();},upload:showUpload,preset:showPreset,preview:showPreview,review:showReview,
  reload:load,close,entry:id=>showRecord(row(id)),'new-answer':()=>showAnswer(),skip,follow:id=>{const e=row(id);if(e)followup(e);},
  topic:t=>{if(topics[t]){state.topic=t;state.prompt='';state.parent='';render();}},
  'dashboard-question':()=>{state.topic=firstTopic;state.prompt=nextDashboard();state.parent='';go('discovery');},
  'archive-filter':v=>{state.archiveFilter=v;render();},filter:v=>{state.filter=v;render();},
  'avatar-settings':()=>{close();go('avatar');},
  'refresh-shared':refreshShared,'shared-item':id=>{const e=state.shared.find(x=>x.source+'|'+x.id===id);if(e)showShared(e);},
  'confirm-delete':confirmDelete,delete:remove,'entry-or-preset':id=>row(id)?.kind==='preset'?showPreset(id):showRecord(row(id)),
  live:(_,el)=>live(el),speak:speech,
  trait:(_,el)=>{const next=el.getAttribute('aria-pressed')!=='true';el.setAttribute('aria-pressed',next);el.classList.toggle('on',next);}
};
root.addEventListener('click',event=>{
  const target=event.target.closest('button[data-action]');
  if(!target)return;
  click[target.dataset.action]?.(target.dataset.value||'',target);
});
root.addEventListener('input',event=>{
  if(event.target.id==='library-query'){
    state.libraryQuery=event.target.value;
    document.querySelector('#library-list').innerHTML=libraryItems();
  }
});
root.addEventListener('submit',async event=>{
  const form=event.target;
  const type=form.dataset.form;
  if(!type)return;
  event.preventDefault();
  if(mutating)return;
  const fields=new FormData(form);
  const data=Object.fromEntries(fields);
  const buttons=[...form.querySelectorAll('button[type="submit"]')];
  mutating=true;buttons.forEach(b=>b.disabled=true);
  try{
    let entry;
    if(type==='upload'){
      if(data.file.size>20*1024*1024)throw new Error('Files can be up to 20 MB.');
      ({entry}=await api('upload',{method:'POST',body:fields}));
    }else{
      let id=data.id||'',kind=type,title=data.title||'',status=data.status||'complete',preset=data.preset||'private';
      if(type==='profile'){id='profile';title=data.name;}
      if(type==='traits'){
        id='traits';title='Personality & traits';
        data.traits=[...form.querySelectorAll('[data-action="trait"][aria-pressed="true"]')].map(b=>b.textContent).concat(data.custom.split(',').map(x=>x.trim()).filter(Boolean));
      }
      if(type==='avatar'){id='avatar';title='Avatar & voice';data.consent=fields.has('consent');}
      if(type==='settings'){id='settings';title='Privacy settings';}
      if(type==='preset')data.emails=data.emails.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
      if(type==='answer'){title=getNext();data.topic=state.topic;data.parent=state.parent;}
      if(type==='edit-answer'){kind='answer';data.parent=row(id)?.data.parent||'';}
      ({entry}=await send('entry',{id,kind,title,status,preset,data}));
    }
    saveLocal(entry);
    close();
    if(type==='answer'&&event.submitter?.value==='follow'){followup(entry);toast('Answer saved. Your follow-up is ready.');}
    else{
      if(type==='answer'){state.prompt='';state.parent='';}
      if(type==='upload'){state.archiveFilter='all';go('archive');}
      else render();
      toast(type==='upload'?'File uploaded. It’s ready for review.':'Saved.');
    }
  }catch(e){toast(e.message,true);}
  finally{mutating=false;buttons.forEach(b=>b.disabled=false);}
});
function restorePage(){
  const page=activePage();
  if(page===state.page)return;
  state.page=page;
  close();render();
  if(page==='shared')refreshShared();
}
window.addEventListener('popstate',restorePage);
window.addEventListener('hashchange',restorePage);
window.addEventListener('studio-shared',refreshShared);
state.page=activePage();
render();
load();
})();
