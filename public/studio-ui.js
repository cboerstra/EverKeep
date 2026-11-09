import catalog from './studio-data.js';
export default (function studio(){
const {paths,nav,topics,traitOptions,statusNames,kindIcons,sectionTitles,fileTypes}=catalog;
const root=document.querySelector('#studio');
const apiRoot='/api/studio/';
const firstTopic=Object.keys(topics)[0];
const allowed=new Set(Object.keys(sectionTitles));
const state={page:'dashboard',entries:[],shared:[],account:null,avatarService:false,loaded:false,error:'',sharedError:'',mobile:false,topic:firstTopic,prompt:'',parent:'',detail:'',filter:'all',archiveFilter:'all',libraryQuery:'',liveUrl:''};
const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const icon=(n,s=16)=>`<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[n]||paths.info}"/></svg>`;
const box=(n,c='')=>`<span class="icon-box ${c}">${icon(n)}</span>`;
const badge=(s)=>`<span class="pill ${s==='complete'?'green':s==='review'?'gold':''}">${statusNames[s]||statusNames.draft}</span>`;
const pill=(label,c='',n='')=>`<span class="pill ${c}">${n?icon(n,12):''}${esc(label)}</span>`;
const button=(label,action,value='',style='',glyph='')=>`<button type="button" class="btn ${style}" data-action="${action}" data-value="${esc(value)}">${glyph?icon(glyph,14):''}${esc(label)}</button>`;
const textBtn=(label,action,value='',glyph='arrow')=>`<button type="button" class="text-btn" data-action="${action}" data-value="${esc(value)}">${esc(label)}${icon(glyph,13)}</button>`;
const row=(id)=>state.entries.find(e=>e.id===id);
const rows=(kind)=>state.entries.filter(e=>e.kind===kind);
const info=(id)=>row(id)?.data||{};
const defaults=()=>row(info('settings').defaultPreset)?.id||'private';
const presetName=(id)=>row(id)?.title||'Private';
const presetBadge=(id)=>pill(presetName(id),id==='private'?'':'green',id==='private'?'lock':'people');
const displayName=()=>info('profile').name||state.account?.name?.split('@')[0]||'My archive';
const firstName=()=>info('profile').name?.split(/\s+/)[0]||'';
const empty=(n,title,detail)=>`<div class="empty">${box(n)}<strong>${esc(title)}</strong><span>${esc(detail)}</span></div>`;
const note=(text,type='')=>`<div class="notice ${type}">${icon(type==='error'?'info':'shield',15)}<span>${esc(text)}</span></div>`;
const heading=(eyebrow,title,description,actions='')=>`<div class="page-intro"><div><div class="caps sage">${esc(eyebrow)}</div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${actions?`<div class="actions">${actions}</div>`:''}</div>`;
const cardTitle=(title,desc='',right='')=>`<div class="card-head"><div><h2>${esc(title)}</h2>${desc?`<p>${esc(desc)}</p>`:''}</div>${right}</div>`;
const panel=(title,desc,body,right='')=>`<section class="card panel">${cardTitle(title,desc,right)}${body}</section>`;
const options=(items,value)=>items.map(item=>{const [val,label]=Array.isArray(item)?item:[item,item];return `<option value="${esc(val)}"${value===val?' selected':''}>${esc(label)}</option>`;}).join('');
const label=(name,control,wide=false,hint='')=>`<label class="field${wide?' wide':''}">${esc(name)}${control}${hint?`<span class="hint">${esc(hint)}</span>`:''}</label>`;
const input=(name,value='',placeholder='',extra='')=>`<input name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${extra}>`;
const textarea=(name,value='',placeholder='',extra='')=>`<textarea name="${name}" placeholder="${esc(placeholder)}" ${extra}>${esc(value)}</textarea>`;
const select=(name,items,value,extra='')=>`<select name="${name}" ${extra}>${options(items,value)}</select>`;
const audience=(value='private',name='preset')=>label('Visibility',select(name,[['private','Private · only me'],...rows('preset').map(p=>[p.id,p.title])],value),false,'Only completed items can be viewed by the preset’s members.');
const review=(value='review')=>label('Review status',select('status',Object.entries({...statusNames,draft:'Draft'}),value));
const foot=(caption='Save changes',extra='')=>`<div class="form-foot">${extra}<button type="submit" class="btn primary">${icon('check',14)}${esc(caption)}</button></div>`;
const recordForm=(id,body)=>`<form data-form="${id}">${body}</form>`;
const fileUrl=(e,download=false)=>apiRoot+'file/'+encodeURIComponent(e.id)+(e.source||download?'?'+new URLSearchParams({...e.source?{from:e.source}:{},...download?{download:'1'}:{}}):'');
const assetIcon=(e)=>e.data.mime?.startsWith('image/')?'image':e.data.mime?.startsWith('audio/')?'mic':e.data.mime?.startsWith('video/')?'play':'file';
const titleCase=(text)=>text.charAt(0).toUpperCase()+text.slice(1);

function activePage(){
  const hash=location.hash.slice(1);
  return allowed.has(hash)?hash:'dashboard';
}
function go(page){
  if(!allowed.has(page)) return;
  if(state.page===page){state.mobile=false;render();return;}
  if(state.page==='avatar'&&'speechSynthesis' in window) speechSynthesis.cancel();
  state.page=page;
  state.mobile=false;
  history.pushState(null,'',page==='dashboard'?location.pathname:'#'+page);
  render();
  window.scrollTo(0,0);
  if(page==='shared') refreshShared();
}
function relative(time){
  const days=Math.max(0,Math.floor((Date.now()-time)/86400000));
  return days===0?'Today':days===1?'Yesterday':new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(time);
}
function stage(list){
  return !list.length?'draft':list.some(x=>x.status!=='complete')?'review':'complete';
}
function getNext(){
  if(state.prompt)return state.prompt;
  const questions=topics[state.topic]||topics[firstTopic];
  return questions.find(q=>!rows('answer').some(e=>e.title===q))||'What is one story on this topic you have never written down?';
}
function nextDashboard(){
  const list=topics[firstTopic];
  return list.find(q=>!rows('answer').some(e=>e.title===q))||'What is one story on this topic you have never written down?';
}
function avatarCard(){
  const avatar=info('avatar');
  const photo=row(avatar.portrait);
  return `<section class="avatar-card"><img class="portrait" src="${photo?fileUrl(photo):'/sample-avatar.jpg'}" alt="${photo?'Your selected avatar portrait':'A fictional sample avatar portrait'}">
    <div class="avatar-top">${pill('AVATAR PREVIEW','outline','avatar')}</div>
    <div class="avatar-content"><div class="caps sage">YOUR DIGITAL LIKENESS</div><h2>${photo?'Your avatar':'Meet your avatar'}</h2>
    <p>${photo?'See the portrait and voice you’ve selected for your digital likeness.':'Preview how your portrait, voice, and presence can come together.'}</p>
    ${button('Open preview','preview','','primary','play')}</div>
    <div class="avatar-bottom"><span>${icon('lock',13)} Private to you</span><span class="quality"><i class="dot"></i> ${photo?'Personal portrait':'Sample portrait'}</span></div></section>`;
}
function dashboard(){
  const answers=rows('answer'), files=rows('asset');
  const checks=[['Profile','profile',stage(rows('profile'))],['Discovery interviews','discovery',stage(answers)],['Documents & media','archive',stage(files)],['Personality & traits','traits',stage(rows('traits'))],['Avatar & voice','avatar',stage(rows('avatar'))]];
  const done=checks.filter(x=>x[2]==='complete').length;
  const percent=done*20;
  const reviewItems=state.entries.filter(e=>e.status==='review'&&!['settings','preset'].includes(e.kind));
  const shared=state.entries.filter(e=>e.status==='complete'&&e.preset!=='private'&&row(e.preset)?.data.emails?.length).length;
  const metrics=[['chat','',answers.length,'Saved answers','library'],['folder','blue',files.length,'Archive files','archive'],['clock','amber',reviewItems.length,'Need review','review'],['people','violet',shared,'Shared items','privacy']];
  const activities=state.entries.filter(e=>!['settings','preset'].includes(e.kind)).slice(0,3);
  return heading('YOUR DIGITAL SELF',firstName()?`Welcome back, ${firstName()}`:'Your studio dashboard','Capture the stories, details, and choices that make you who you are.',
    button('Upload media','upload','','quiet','upload')+button(answers.length?'Continue discovery':'Start discovery','go','discovery','primary','arrow'))+
    `<div class="hero">${avatarCard()}<section class="card progress-card">${cardTitle('Studio progress','A snapshot of your setup.',pill(done===5?'Complete':'In progress',done===5?'green':'gold'))}
    <div class="progress-top"><div class="ring" style="--p:${percent}%" role="img" aria-label="${percent}% complete"><span>${percent}%</span></div><div><strong>${done} of 5 sections complete</strong><p>Review each section as it takes shape.</p></div></div>
    ${checks.map(([label,id,s])=>`<button type="button" class="progress-row" data-action="go" data-value="${id}"><i class="mini-dot ${s==='complete'?'done':s==='review'?'review':''}"></i>${label}${badge(s)}</button>`).join('')}</section></div>
    <div class="stats">${metrics.map(([n,c,count,title,action])=>`<button class="card stat" type="button" data-action="${action==='review'?'review':'go'}" data-value="${action}">${box(n,c)}<span><strong>${count}</strong><span class="label">${title}</span></span>${icon('right',14)}</button>`).join('')}</div>
    <div class="lower"><section><div class="section-head"><h2>Continue your discovery</h2>${textBtn('All topics','go','discovery')}</div><div class="card interview-card">
    <div class="interview-top">${box('sparkle')}<div><h3>Life stories</h3><p class="muted small">Guided interview · Start with a memory</p></div></div>
    <p class="interview-quote">“${esc(nextDashboard())}”</p>${button('Answer this question','dashboard-question','','quiet','arrow')}</div></section>
    <section><div class="section-head"><h2>Recent activity</h2>${textBtn('View library','go','library')}</div><div class="card activity">${activities.length?activities.map(e=>`<div class="activity-row">${box(e.kind==='asset'?assetIcon(e):kindIcons[e.kind])}<span class="activity-name">${esc(e.title)}</span><span class="time">${relative(e.updated)}</span></div>`).join(''):empty('clock','Your activity will appear here','Save an answer or add a file to get started.')}</div></section></div>
    <section><div class="section-head"><h2>Manage your studio</h2></div><div class="section-grid">${[['profile','user','Your profile','Identity and background'],['traits','sparkle','Personality','Values, tone, and traits'],['privacy','shield','Privacy & sharing','Visibility and trusted viewers']].map(([id,n,t,d])=>`<button class="card section-link" type="button" data-action="go" data-value="${id}">${box(n)}<span><h3>${t}</h3><p>${d}</p></span>${icon('right',14)}</button>`).join('')}</div></section>`;
}
function profile(){
  const e=row('profile'), d=e?.data||{};
  return heading('IDENTITY','My profile','Record the details you want your digital self to remember.')+
    `<div class="subgrid">${panel('Personal details','Choose what goes into your life record.',
    recordForm('profile',`<div class="form-grid">
    ${label('Full or preferred name',input('name',d.name,'Name you go by','required maxlength="150"'))}
    ${label('Pronouns',input('pronouns',d.pronouns,'Optional','maxlength="80"'))}
    ${label('Date of birth',input('birth',d.birth,'','type="date"'))}
    ${label('Places you call home',input('location',d.location,'City, region, or community','maxlength="150"'))}
    ${label('A short biography',textarea('bio',d.bio,'Describe yourself in your own words.','maxlength="8000"'),true)}
    ${audience(e?.preset||'private')}${review(e?.status||'review')}</div>${foot('Save profile')}`),badge(e?.status))}
    ${panel('Your starting point','Add whatever feels right today.',`<div class="list"><div class="list-row">${box('chat')}<div class="row-main"><strong>Tell a story in your own words</strong><span>Guided discovery helps add details over time.</span></div></div><div class="list-row">${box('lock')}<div class="row-main"><strong>Profile details start private</strong><span>You can change the visibility when you review them.</span></div></div></div><div class="form-foot">${button('Go to discovery','go','discovery','quiet','arrow')}</div>`)}</div>`;
}
function discovery(){
  const prompt=getNext();
  const parent=row(state.parent);
  const count=rows('answer').filter(e=>e.data.topic===state.topic).length;
  return heading('INTERVIEW STUDIO','Guided discovery','Start with a question and follow the details that matter.',button('Q&A library','go','library','quiet','book'))+
    `<div class="subgrid">${panel('Write an answer','Pause whenever you like. Answers are saved to your library.',pill(state.topic,'green','chat'))}
    </div>`.replace('</section>',`<div class="prompt"><div class="caps sage">${parent?'FOLLOW-UP QUESTION':'INTERVIEW QUESTION'}</div><h2>${esc(prompt)}</h2>${parent?`<p>Based on your answer to “${esc(parent.title)}”</p>`:''}</div>
    ${recordForm('answer',`<div class="form-grid">${label('Your answer',textarea('answer','','Write the story as you would tell it.','required maxlength="12000" class="tall"'),true)}${audience(defaults())}${review('review')}</div>
    <div class="form-foot">${button('Skip question','skip','','quiet')}<button type="submit" class="btn quiet" name="submit" value="save">Save answer</button><button type="submit" class="btn primary" name="submit" value="follow">${icon('sparkle',14)} Save & ask a follow-up</button></div>`)}
    </section>${panel('Interview topics',`${count} saved in ${state.topic.toLowerCase()}.`,
    `<div class="list">${Object.keys(topics).map(t=>`<button class="card section-link" type="button" data-action="topic" data-value="${esc(t)}" aria-pressed="${t===state.topic}">${box(t===state.topic?'check':'chat')}<span><h3>${esc(t)}</h3><p>${rows('answer').filter(e=>e.data.topic===t).length} saved</p></span>${icon('right',14)}</button>`).join('')}</div>`)}`);
}
function entryRow(e,shared=false){
  const isAsset=e.kind==='asset';
  const n=isAsset?assetIcon(e):kindIcons[e.kind];
  const meta=isAsset?`${e.data.category||titleCase(e.data.mime?.split('/')[0]||'File')} · ${Math.max(1,Math.round(e.data.size/1024))} KB`:e.kind==='answer'?`${e.data.topic||'Life stories'} · ${relative(e.updated)}`:titleCase(e.kind);
  return `<div class="list-row">${box(n)}<div class="row-main"><strong>${esc(e.title)}</strong><span>${esc(meta)}</span></div>${shared?pill('Shared with you','green','people'):badge(e.status)+presetBadge(e.preset)}
  <div class="actions">${shared?button('View','shared-item',e.source+'|'+e.id,'quiet inline','right'):button(isAsset?'Open':'View','entry',e.id,'quiet inline','right')}</div></div>`;
}
function libraryItems(){
  const q=state.libraryQuery.trim().toLowerCase();
  const list=rows('answer').filter(e=>(state.filter==='all'||e.status===state.filter)&&(!q||[e.title,e.data.answer,e.data.topic].some(x=>String(x||'').toLowerCase().includes(q))));
  return list.length?list.map(e=>entryRow(e)).join(''):empty('book',rows('answer').length?'No matching answers':'Your library is ready','Saved interview answers and follow-ups will appear here.');
}
function library(){
  return heading('MEMORIES & ANSWERS','Q&A library','Find, revisit, and review the answers your digital self can draw from.',button('Add a question','new-answer','','quiet','plus')+button('Open discovery','go','discovery','primary','arrow'))+
    panel('Saved answers',`${rows('answer').length} in your library.`,
    `<div class="toolbar"><input class="search" type="search" id="library-query" value="${esc(state.libraryQuery)}" aria-label="Search answers" placeholder="Search questions and answers"><div class="chips">${[['all','All answers'],['review','Needs review'],['complete','Complete'],['draft','Draft']].map(([v,t])=>`<button class="chip ${state.filter===v?'on':''}" type="button" data-action="filter" data-value="${v}" aria-pressed="${state.filter===v}">${t}</button>`).join('')}</div></div><div class="list" id="library-list">${libraryItems()}</div>`);
}
function archive(){
  const files=rows('asset').filter(e=>state.archiveFilter==='all'||(state.archiveFilter==='review'?e.status==='review':state.archiveFilter==='application'?/^(application|text)\//.test(e.data.mime):e.data.mime?.startsWith(state.archiveFilter+'/')));
  return heading('YOUR MATERIALS','Documents & media','Preserve the photos, recordings, videos, and documents that tell your story.',button('Upload a file','upload','','primary','upload'))+
    panel('Archive files',`${rows('asset').length} files in your archive.`,
    `<div class="toolbar"><div class="chips">${[['all','All files'],['image','Images'],['audio','Audio'],['video','Video'],['application','Documents'],['review','Needs review']].map(([v,t])=>`<button class="chip ${state.archiveFilter===v?'on':''}" type="button" data-action="archive-filter" data-value="${v}" aria-pressed="${state.archiveFilter===v}">${t}</button>`).join('')}</div></div>
    <div class="list">${files.length?files.map(e=>entryRow(e)).join(''):empty('folder',rows('asset').length?'No files match this filter':'Your archive is empty','Upload a portrait, voice recording, or document to start.')}</div>`);
}
function traits(){
  const e=row('traits'),d=e?.data||{};
  const picks=new Set(d.traits||[]);
  const custom=[...picks].filter(t=>!traitOptions.includes(t));
  return heading('CHARACTER & VALUES','Personality & traits','Describe what you value, how you communicate, and the boundaries you want to set.')+
    panel('How you show up','Choose the traits that feel true to you.',recordForm('traits',`
      <div class="form-grid"><div class="field wide">Character traits<div class="chips">${traitOptions.map(t=>`<button class="chip ${picks.has(t)?'on':''}" type="button" data-action="trait" aria-pressed="${picks.has(t)}">${t}</button>`).join('')}</div></div>
      ${label('Other traits',input('custom',custom.join(', '),'Separate traits with commas','maxlength="500"'),true)}
      ${label('Values and beliefs',textarea('values',d.values,'What guides your decisions?','maxlength="5000"'),true)}
      ${label('Speaking style and humor',textarea('tone',d.tone,'How do you sound with people you know well?','maxlength="1000"'),true)}
      ${label('Boundaries',textarea('boundaries',d.boundaries,'What should your digital self avoid or leave unanswered?','maxlength="5000"'),true)}
      ${audience(e?.preset||'private')}${review(e?.status||'review')}</div>${foot('Save traits')}`),badge(e?.status));
}
function avatar(){
  const e=row('avatar'),d=e?.data||{};
  const files=rows('asset');
  const images=files.filter(e=>e.data.mime.startsWith('image/')).map(e=>[e.id,e.title]);
  const audio=files.filter(e=>e.data.mime.startsWith('audio/')).map(e=>[e.id,e.title]);
  return heading('LIKENESS STUDIO','Avatar & voice','Choose the portrait and voice material that represent you.',button('Upload source media','upload','','quiet','upload')+button('Open preview','preview','','primary','play'))+
    `<div class="subgrid">${panel('Likeness settings','Source files stay in your private archive unless you share them.',recordForm('avatar',`
    <div class="form-grid">${label('Avatar style',select('look',['Photorealistic','Still portrait','Audio only'],d.look||'Photorealistic'))}
    ${label('Voice choice',select('voice',['Original recording','Warm narration','Clear narration','Text only'],d.voice||'Original recording'))}
    ${label('Source portrait',select('portrait',[['','Choose a portrait'],...images],d.portrait||''))}
    ${label('Source voice recording',select('recording',[['','Choose a recording'],...audio],d.recording||''))}
    ${label('Presentation notes',textarea('notes',d.notes,'Describe expression, pacing, or how you want to be represented.','maxlength="3000"'),true)}
    ${review(e?.status||'review')}<label class="check field wide"><span><input type="checkbox" name="consent" ${d.consent?'checked':''}> I consent to sending these selected source files to the connected avatar provider when I start a live preview.</span></label></div>
    ${foot('Save avatar & voice')}`),badge(e?.status))}
    <div>${avatarCard()}${panel('Avatar provider',state.avatarService?'A separate rendering service is connected.':'No rendering service is connected.',`<p class="muted small">${state.avatarService?'A live preview sends your selected portrait and recording only after you give consent and start a session.':'You can review your portrait and play original audio here. Live photorealistic rendering becomes available after a provider is configured.'}</p>`,pill(state.avatarService?'Connected':'Disconnected',state.avatarService?'green':'gold'))}</div></div>`;
}
function privacy(){
  const d=info('settings'), presets=rows('preset');
  const shared=state.entries.filter(e=>!['preset','settings','avatar'].includes(e.kind)&&e.preset!=='private');
  return heading('ACCESS CONTROL','Privacy & sharing','Set defaults and decide who can view specific parts of your record.',button('New sharing preset','preset','','primary','plus'))+
    `<div class="subgrid"><div>${panel('Sharing presets','Reuse the same audience across selected records.',
    `<div class="list"><div class="list-row">${box('lock')}<div class="row-main"><strong>Private</strong><span>Only you can view this content.</span></div>${pill('Built-in')}</div>
    ${presets.map(p=>`<div class="list-row">${box('people')}<div class="row-main"><strong>${esc(p.title)}</strong><span>${p.data.emails?.length||0} approved viewers · ${shared.filter(e=>e.preset===p.id).length} assigned items</span></div>${button('Manage','preset',p.id,'quiet inline','right')}</div>`).join('')}</div>
    <p class="hint stack">Viewers also need access to this Site and must sign in with the email you list. Adding an address here records permission without sending an invitation.</p>`)}
    ${panel('Items assigned to viewers','Only completed items are visible to members of their preset.',
    `<div class="list">${shared.length?shared.map(e=>entryRow(e)).join(''):empty('shield','Everything is private','Assign a preset to an answer, profile, or file when you want to share it.')}</div>`)}</div>
    ${panel('Privacy defaults','Used for new answers and uploads.',recordForm('settings',`<div class="form-grid">
    ${label('Default visibility',select('defaultPreset',[['private','Private · only me'],...presets.map(p=>[p.id,p.title])],defaults()),true)}
    ${label('Memorial wishes',textarea('wishes',d.wishes,'Record who should steward this archive and how you want it used.','maxlength="5000"'),true,'These instructions remain private and do not trigger release.')}</div>
    ${foot('Save privacy settings')}`))}</div>`;
}
function sharedPage(){
  return heading('TRUSTED ACCESS','Shared with me','View completed material that other studio members have shared with your signed-in email.',button('Refresh','refresh-shared','','quiet'))+
    (state.sharedError?note(state.sharedError,'error'):'')+
    panel('Shared records','Access depends on the owner’s current sharing settings.',`<div class="list">${state.shared.length?state.shared.map(e=>entryRow(e,true)).join(''):empty('people','Nothing shared with you yet','Approved records will appear here after a studio owner grants access.')}</div>`);
}
const pages={dashboard,profile,discovery,library,archive,traits,avatar,privacy,shared:sharedPage};
function render(){
  document.title=`${sectionTitles[state.page]} · Everkeep`;
  const initials=displayName().trim().split(/\s+/).slice(0,2).map(s=>s[0]?.toUpperCase()).join('')||'E';
  root.innerHTML=`<div class="shell ${state.mobile?'menu-open':''}"><button type="button" class="scrim" aria-label="Close navigation" data-action="menu"></button>
  <aside class="sidebar"><button type="button" class="brand" data-action="go" data-value="dashboard"><span class="brandmark">${icon('logo',22)}</span><span><span class="wordmark">Everkeep</span><div class="brand-sub">DIGITAL SELF STUDIO</div></span></button>
  <nav aria-label="Studio navigation">${nav.map(([title,items])=>`<div class="navgroup"><div class="caps">${title}</div>${items.map(([id,t,n])=>`<button type="button" class="navitem ${state.page===id?'active':''}" ${state.page===id?'aria-current="page"':''} data-action="go" data-value="${id}">${icon(n)}${t}${state.page===id?`<span class="nav-end">${icon('right',12)}</span>`:''}</button>`).join('')}</div>`).join('')}</nav>
  <div class="sidebar-footer"><div class="privacy-note">${icon('shield',15)}<div><strong>Private workspace</strong><p>Visibility is set for each record.</p></div></div>
  <button type="button" class="identity" data-action="go" data-value="profile"><span class="initials">${esc(initials)}</span><span><div class="identity-name">${esc(displayName())}</div><div class="muted small">Personal studio</div></span>${icon('right',13)}</button><form method="post" action="/auth/logout"><button class="text-btn sign-out" type="submit">Sign out</button></form></div></aside>
  <div class="workspace"><header class="topbar"><div class="crumb">${button('','menu','','quiet icon-only mobile-menu','menu').replace('type="button"','type="button" aria-label="Open navigation"')}<span>My studio</span><span class="divider">${icon('right',12)}</span><strong>${sectionTitles[state.page]}</strong></div>
  <div class="top-actions">${pill('Private studio','green','lock')}${button('','go','privacy','quiet icon-only','shield').replace('type="button"','type="button" aria-label="Privacy settings"')}</div></header>
  <main class="main" id="main">${state.error?note(state.error,'error'):''}${pages[state.page]()}</main></div>
  <dialog id="dialog" class="modal" aria-labelledby="dialog-title"></dialog><div id="toast" class="toast" role="status" aria-live="polite"></div></div>`;
}
return {state, root, apiRoot, rows, row, info, esc, icon, box, pill, badge, presetBadge, defaults, button, textBtn, label, select, input, textarea, note, empty, review, audience, foot, recordForm, fileUrl, entryRow, topics, firstTopic, kindIcons, fileTypes, activePage, go, render, getNext, libraryItems, nextDashboard, traitOptions};
function refreshShared(){window.dispatchEvent(new Event('studio-shared'));}
})();
