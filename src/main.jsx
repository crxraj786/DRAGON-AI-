import React,{useEffect,useRef,useState} from 'react';
import { STORAGE_KEYS, DEFAULT_SETTINGS, readStorage, writeStorage, removeStorage, createId, validateMessage, normalizeSettings, normalizeHistory, makeExportPayload } from './core.js';
import{createRoot}from'react-dom/client';
import{Bot,Menu,Plus,Send,Settings,Trash2,Copy,Sparkles,ShieldCheck,Download,X,MessageSquare,Square,Paperclip,Search}from'lucide-react';
import'./style.css';
const LOGO_DATA='data:image/jpeg;base64,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';
const HISTORY=STORAGE_KEYS.history,CONFIG=STORAGE_KEYS.settings;
const defaults=DEFAULT_SETTINGS;
const read=(k,d)=>k===HISTORY?normalizeHistory(readStorage(k,d)):k===CONFIG?normalizeSettings(readStorage(k,d)):readStorage(k,d);

function renderInline(text,keyPrefix){
 const parts=String(text).split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
 return parts.map((part,index)=>{
  const key=keyPrefix+'-'+index;
  if(part.startsWith('`')&&part.endsWith('`'))return <code className="md-inline-code" key={key}>{part.slice(1,-1)}</code>;
  if(part.startsWith('**')&&part.endsWith('**'))return <strong key={key}>{part.slice(2,-2)}</strong>;
  if(part.startsWith('*')&&part.endsWith('*'))return <em key={key}>{part.slice(1,-1)}</em>;
  return part;
 });
}
function renderMarkdown(content){
 const lines=String(content||'').replace(/\r/g,'').split('\n');
 const nodes=[];let paragraph=[];let list=[];let listType='';let code=[];let inCode=false;
 const flushParagraph=()=>{if(paragraph.length){nodes.push(<p key={'p'+nodes.length}>{paragraph.map((line,i)=><React.Fragment key={i}>{i>0&&<br/>}{renderInline(line,'p'+nodes.length+'i'+i)}</React.Fragment>)}</p>);paragraph=[]}};
 const flushList=()=>{if(list.length){const Tag=listType==='ol'?'ol':'ul';nodes.push(<Tag key={'l'+nodes.length}>{list.map((item,i)=><li key={i}>{renderInline(item,'l'+nodes.length+'i'+i)}</li>)}</Tag>);list=[];listType=''}};
 const flushCode=()=>{nodes.push(<pre className="md-code" key={'c'+nodes.length}><code>{code.join('\n')}</code></pre>);code=[]};
 for(const line of lines){
  if(/^\s*```/.test(line)){flushParagraph();flushList();if(inCode)flushCode();inCode=!inCode;continue}
  if(inCode){code.push(line);continue}
  const bullet=line.match(/^\s*[-*+]\s+(.+)$/);const numbered=line.match(/^\s*\d+[.)]\s+(.+)$/);
  if(!line.trim()){flushParagraph();flushList();continue}
  if(bullet||numbered){flushParagraph();const type=numbered?'ol':'ul';if(list.length&&listType!==type)flushList();listType=type;list.push((bullet||numbered)[1]);continue}
  const heading=line.match(/^\s{0,3}(#{1,3})\s+(.+)$/);
  if(heading){flushParagraph();flushList();const level=heading[1].length;const Tag='h'+level;nodes.push(<Tag key={'h'+nodes.length}>{renderInline(heading[2],'h'+nodes.length)}</Tag>);continue}
  flushList();paragraph.push(line);
 }
 if(inCode)flushCode();flushParagraph();flushList();
 return nodes;
}
function App(){
 const[settings,setSettings]=useState(()=>{const saved={...defaults,...read(CONFIG,{})};return {...saved,lang:'en',provider:saved.provider==='demo'?'gemini':saved.provider};});
 const[chats,setChats]=useState(()=>read(HISTORY,[]));const[active,setActive]=useState(()=>read(HISTORY,[])[0]?.id||'');
 const[draft,setDraft]=useState('');const[searchQuery,setSearchQuery]=useState('');const[panel,setPanel]=useState('');const[error,setError]=useState('');const[isSending,setIsSending]=useState(false);const abortRef=useRef(null);const[online,setOnline]=useState(navigator.onLine);const[aiStatus,setAiStatus]=useState({loading:true,configured:false,providers:{groq:false,gemini:false,openrouter:false},error:''});
 const t=(hi,en)=>settings.lang==='hi'?hi:en;
 useEffect(()=>()=>abortRef.current?.abort(),[]);
 useEffect(()=>{let alive=true;const check=async()=>{try{const response=await fetch((import.meta.env.VITE_API_BASE_URL||'https://dragon-ai-five.vercel.app')+'/api/health',{cache:'no-store'});const data=await response.json();if(!response.ok||data.status!=='ok')throw new Error('Health check failed');if(alive)setAiStatus({loading:false,configured:Boolean(data.realAiConfigured),providers:data.providers||{},error:''})}catch{if(alive)setAiStatus({loading:false,configured:false,providers:{groq:false,gemini:false,openrouter:false},error:t('सर्वर से स्थिति नहीं मिल सकी।','Could not read server status.')})}};check();return()=>{alive=false}},[]);
 useEffect(()=>{const on=()=>setOnline(true),off=()=>setOnline(false);window.addEventListener('online',on);window.addEventListener('offline',off);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off)}},[]);
 useEffect(()=>{const configWrite=writeStorage(CONFIG,normalizeSettings(settings));const historyWrite=settings.save?writeStorage(HISTORY,normalizeHistory(chats)):(removeStorage(HISTORY),{ok:true});if(!configWrite.ok||!historyWrite.ok)setError(t('डिवाइस स्टोरेज में समस्या है। Export करके जगह खाली करें।','Device storage failed. Export data and free some space.'))},[settings,chats]);
 const current=chats.find(c=>c.id===active);const id=createId;
 function fresh(){const c={id:id(),title:t('नई बातचीत','New chat'),messages:[],updated:Date.now()};setChats(p=>[c,...p]);setActive(c.id);setPanel('')}
 async function send(){
  if(isSending)return;
  const validation=validateMessage(draft);
  if(!validation.ok){
   if(validation.reason==='too-long')setError(t('संदेश 8000 अक्षरों से छोटा रखें।','Keep messages under 8000 characters.'));
   return;
  }
  const q=validation.content;
  const existing=chats.find(chat=>chat.id===active);
  const cid=existing?.id||id();
  const base=existing||{id:cid,title:q.slice(0,42),messages:[],updated:Date.now()};
  const userMessage={id:id(),role:'user',content:q};
  const updatedChat={...base,title:base.messages.length?base.title:q.slice(0,42),messages:[...base.messages,userMessage],updated:Date.now()};
  setChats(previous=>existing?previous.map(chat=>chat.id===cid?updatedChat:chat):[updatedChat,...previous]);
  setActive(cid);
  setDraft('');
  setError('');
  setIsSending(true);
  const controller=new AbortController();
  abortRef.current=controller;
  try{
   const conversation=updatedChat.messages.filter(message=>['user','assistant'].includes(message.role)).slice(-24).map(message=>({role:message.role,content:message.content}));
   const response=await fetch((import.meta.env.VITE_API_BASE_URL||'https://dragon-ai-five.vercel.app')+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:settings.provider,messages:conversation}),signal:controller.signal});
   const data=await response.json().catch(()=>({}));
   if(!response.ok){const message=response.status===429?'Too many requests right now. Please wait a moment and try again.':response.status===401||response.status===403?'The AI service is temporarily unavailable. Please try again later.':response.status>=500?'DRAGON AI is having trouble responding right now. Please try again shortly.':'Your message could not be processed. Please try again.';throw new Error(message);}
   if(typeof data.content!=='string'||!data.content.trim())throw new Error('AI provider returned an empty response.');
   setChats(previous=>previous.map(chat=>chat.id===cid?{...chat,messages:[...chat.messages,{id:id(),role:'assistant',content:data.content}],updated:Date.now()}:chat));
  }catch(err){
   if(err?.name==='AbortError')setError(t('उत्तर रोक दिया गया।','Response stopped.'));
   else{setError(err.message||t('AI सेवा उपलब्ध नहीं है।','AI service is unavailable.'));setDraft(q);}
  }finally{
   if(abortRef.current===controller)abortRef.current=null;
   setIsSending(false);
  }
 }
 async function attachFile(event){
  const file=event.target.files?.[0];
  event.target.value='';
  if(!file)return;
  if(!/\.(txt|md|csv|json|log)$/i.test(file.name)){
   setError(t('केवल TXT, MD, CSV, JSON या LOG text files समर्थित हैं।','Only TXT, MD, CSV, JSON, or LOG text files are supported.'));
   return;
  }
  if(file.size>256*1024){
   setError(t('File 256 KB से छोटी होनी चाहिए।','File must be smaller than 256 KB.'));
   return;
  }
  try{
   const content=await file.text();
   const prefix='[Attached text file: '+file.name+']\n';
   const remaining=Math.max(0,8000-draft.length-prefix.length-80);
   if(remaining<1){
    setError(t('पहले message छोटा करें, फिर file जोड़ें।','Shorten the message before attaching a file.'));
    return;
   }
   const clipped=content.length>remaining;
   setDraft((draft?draft+'\n\n':'')+prefix+content.slice(0,remaining)+(clipped?'\n[File content truncated to fit the message limit.]':''));
   setError('');
  }catch{
   setError(t('File पढ़ी नहीं जा सकी।','Could not read this file.'));
  }
 }
 function exportData(){try{const u=URL.createObjectURL(new Blob([JSON.stringify(makeExportPayload({settings,chats}),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='dragon-ai-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}catch{setError(t('Export असफल।','Export failed.'))}}
 function wipe(){if(!confirm(t('सभी बातचीत हटाएँ? यह वापस नहीं आएगा।','Delete all conversations? This cannot be undone.')))return;setChats([]);setActive('');removeStorage(HISTORY)}
 return <div className="app"><aside className={'sidebar '+(panel==='history'?'show':'')}><div className="brand"><div className="logo"><img src={LOGO_DATA} alt="DRAGON AI logo" /></div><div><b>DRAGON AI</b><small>Free-first assistant</small></div><button className="icon mobile" onClick={()=>setPanel('')} aria-label="Close"><X/></button></div><button className="new" onClick={fresh}><Plus size={18}/>{t('नई बातचीत','New chat')}</button><div className="side-label">{t('हाल की बातचीत','Recent chats')}</div><label className="chat-search"><Search size={15}/><input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder={t('बातचीत खोजें…','Search chats…')} aria-label={t('बातचीत खोजें','Search chats')}/></label><div className="history">{chats.filter(c=>(c.title+' '+c.messages.map(m=>m.content).join(' ')).toLowerCase().includes(searchQuery.trim().toLowerCase())).map(c=><button key={c.id} className={'history-item '+(c.id===active?'selected':'')} onClick={()=>{setActive(c.id);setPanel('')}}><MessageSquare size={15}/><span>{c.title}</span></button>)}</div><div className="side-bottom"><button onClick={()=>setPanel('settings')}><Settings size={17}/>{t('Settings','Settings')}</button><span className="status"><i className={online?'dot':'dot off'}/>{online?'Online':'Offline'}</span></div></aside>
 <main><header><button className="icon mobile" onClick={()=>setPanel('history')} aria-label="Menu"><Menu/></button><div className="head-title"><strong>{current?.title||'DRAGON AI'}</strong><small>{settings.provider==='demo'?t('सहायक','Assistant'):settings.provider==='gemini'?'DRAGON AI':'DRAGON AI'}</small></div><button className="icon" onClick={()=>setPanel('settings')} aria-label="Settings"><Settings/></button></header>
 <section className="messages">{!current?.messages?.length?<div className="welcome"><div className="glow"><Sparkles size={28}/></div><h1>{t('नमस्ते! मैं DRAGON AI हूँ।','Hello! I’m DRAGON AI.')}</h1><p>{t('आप क्या जानना या बनाना चाहते हैं?','What would you like to learn or create?')}</p><div className="suggestions">{[t('Python सीखने में मदद करो','Help me learn Python'),t('एक काम की योजना बनाओ','Create a useful plan'),t('यह code समझाओ','Explain this code')].map(s=><button key={s} onClick={()=>setDraft(s)}>{s}</button>)}</div></div>:current.messages.map(m=><article className={'message '+m.role} key={m.id}><div className="avatar">{m.role==='assistant'?<Bot size={18}/>:<span>U</span>}</div><div className="bubble"><div className="message-meta"><div className="role">{m.role==='assistant'?'DRAGON AI':'You'}</div></div><div className="markdown-body">{renderMarkdown(m.content)}</div>{m.demo&&<small className="demo-tag">DEMO</small>}<button className="copy" onClick={()=>navigator.clipboard?.writeText(m.content).catch(()=>setError(t('कॉपी नहीं हो सका।','Copy failed.')))}><Copy size={14}/>{t('कॉपी','Copy')}</button></div></article>)}</section>
 {error&&<div className="error" role="alert">{error}<button onClick={()=>setError('')}>×</button></div>}<form className="composer" onSubmit={e=>{e.preventDefault();send()}}><input className="file-input" type="file" accept=".txt,.md,.csv,.json,.log,text/plain,text/markdown,text/csv,application/json" onChange={attachFile} aria-label="Attach text file"/><button className="attach" type="button" disabled={isSending} onClick={e=>e.currentTarget.previousElementSibling.click()} aria-label="Attach text file"><Paperclip size={16}/></button><textarea value={draft} disabled={isSending} onChange={e=>setDraft(e.target.value)} placeholder={t('DRAGON से कुछ पूछें…','Message DRAGON…')} rows="1" maxLength="8000" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}/><button className="send" disabled={!isSending&&!draft.trim()} aria-label={isSending?"Stop response":"Send"} onClick={isSending?()=>abortRef.current?.abort():undefined} type={isSending?"button":"submit"}>{isSending?<Square size={16}/>:<Send size={18}/>}</button><small>{t('Enter भेजें · Shift+Enter नई लाइन','Enter to send · Shift+Enter for newline')}</small></form></main>
 {panel==='settings'&&<div className="overlay" onClick={()=>setPanel('')}><section className="settings" onClick={e=>e.stopPropagation()}><div className="settings-head"><h2><Settings/> {t('सेटिंग्स','Settings')}</h2><button className="icon" onClick={()=>setPanel('')}><X/></button></div><label>{t('Language','Language')}<select value={settings.lang} onChange={e=>setSettings(s=>({...s,lang:e.target.value}))}><option value="en">English</option><option value="hi">हिंदी</option></select></label><label className="check"><input type="checkbox" checked={settings.save} onChange={e=>setSettings(s=>({...s,save:e.target.checked}))}/>{t('Save chat history on this device','Save chat history on this device')}</label><button className="action" onClick={exportData}><Download size={17}/>{t('Export data','Export data')}</button><button className="action danger" onClick={wipe}><Trash2 size={17}/>{t('Delete all chats','Delete all chats')}</button></section></div>}</div>
}
createRoot(document.getElementById('root')).render(<App/>);