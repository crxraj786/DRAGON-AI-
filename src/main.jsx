import React,{useEffect,useRef,useState} from 'react';
import { STORAGE_KEYS, DEFAULT_SETTINGS, readStorage, writeStorage, removeStorage, createId, validateMessage, normalizeSettings, normalizeHistory, makeExportPayload } from './core.js';
import{createRoot}from'react-dom/client';
import{Bot,Menu,Plus,Send,Settings,Trash2,Copy,Sparkles,ShieldCheck,Download,X,MessageSquare,Square,Paperclip,Search}from'lucide-react';
import'./style.css';
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
 const[settings,setSettings]=useState(()=>({...defaults,...read(CONFIG,{})}));
 const[chats,setChats]=useState(()=>read(HISTORY,[]));const[active,setActive]=useState(()=>read(HISTORY,[])[0]?.id||'');
 const[draft,setDraft]=useState('');const[searchQuery,setSearchQuery]=useState('');const[panel,setPanel]=useState('');const[error,setError]=useState('');const[isSending,setIsSending]=useState(false);const abortRef=useRef(null);const[online,setOnline]=useState(navigator.onLine);const[aiStatus,setAiStatus]=useState({loading:true,configured:false,providers:{groq:false,gemini:false,openrouter:false},error:''});
 const t=(hi,en)=>settings.lang==='hi'?hi:en;
 useEffect(()=>()=>abortRef.current?.abort(),[]);
 useEffect(()=>{let alive=true;const check=async()=>{try{const response=await fetch('/api/health',{cache:'no-store'});const data=await response.json();if(!response.ok||data.status!=='ok')throw new Error('Health check failed');if(alive)setAiStatus({loading:false,configured:Boolean(data.realAiConfigured),providers:data.providers||{},error:''})}catch{if(alive)setAiStatus({loading:false,configured:false,providers:{groq:false,gemini:false,openrouter:false},error:t('सर्वर से स्थिति नहीं मिल सकी।','Could not read server status.')})}};check();return()=>{alive=false}},[]);
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
  if(settings.provider==='demo'){
   const reply=t('यह ऐप अभी Demo मोड में है, इसलिए यह आपके सवाल का वास्तविक AI उत्तर नहीं दे सकता। सेटिंग्स खोलें → AI Provider में Groq, Gemini या OpenRouter चुनें। उसके बाद सर्वर पर उस provider की API key configure करनी होगी। API key के बिना मैं उत्तर गढ़ने या आपका सवाल दोहराने के बजाय साफ़ बता रहा हूँ।','DRAGON AI is currently in Demo mode, so it cannot generate a real answer yet. Open Settings → AI Provider and choose Groq, Gemini, or OpenRouter. That provider must then have a server-side API key configured. Without a key, I will explain the limitation rather than echo your message.');
   setChats(previous=>previous.map(chat=>chat.id===cid?{...chat,messages:[...chat.messages,{id:id(),role:'assistant',content:reply,demo:true}],updated:Date.now()}:chat));
   return;
  }
  setIsSending(true);
  const controller=new AbortController();
  abortRef.current=controller;
  try{
   const conversation=updatedChat.messages.filter(message=>['user','assistant'].includes(message.role)).slice(-24).map(message=>({role:message.role,content:message.content}));
   const response=await fetch((import.meta.env.VITE_API_BASE_URL||'')+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:settings.provider,messages:conversation}),signal:controller.signal});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'AI request failed.');
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
 return <div className="app"><aside className={'sidebar '+(panel==='history'?'show':'')}><div className="brand"><div className="logo"><Bot size={24}/></div><div><b>DRAGON AI</b><small>Free-first assistant</small></div><button className="icon mobile" onClick={()=>setPanel('')} aria-label="Close"><X/></button></div><button className="new" onClick={fresh}><Plus size={18}/>{t('नई बातचीत','New chat')}</button><div className="side-label">{t('हाल की बातचीत','Recent chats')}</div><label className="chat-search"><Search size={15}/><input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder={t('बातचीत खोजें…','Search chats…')} aria-label={t('बातचीत खोजें','Search chats')}/></label><div className="history">{chats.filter(c=>(c.title+' '+c.messages.map(m=>m.content).join(' ')).toLowerCase().includes(searchQuery.trim().toLowerCase())).map(c=><button key={c.id} className={'history-item '+(c.id===active?'selected':'')} onClick={()=>{setActive(c.id);setPanel('')}}><MessageSquare size={15}/><span>{c.title}</span></button>)}</div><div className="side-bottom"><button onClick={()=>setPanel('settings')}><Settings size={17}/>{t('सेटिंग्स','Settings')}</button><span className="status"><i className={online?'dot':'dot off'}/>{online?'Online':'Offline'}</span></div></aside>
 <main><header><button className="icon mobile" onClick={()=>setPanel('history')} aria-label="Menu"><Menu/></button><div className="head-title"><strong>{current?.title||'DRAGON AI'}</strong><small>{settings.provider==='demo'?t('स्थानीय Demo · असली AI नहीं','Local demo · not real AI'):settings.provider}</small></div><button className="icon" onClick={()=>setPanel('settings')} aria-label="Settings"><Settings/></button></header>
 <section className="messages">{!current?.messages?.length?<div className="welcome"><div className="glow"><Sparkles size={28}/></div><h1>{t('नमस्ते! मैं DRAGON AI हूँ।','Hello! I’m DRAGON AI.')}</h1><p>{t('आप क्या जानना या बनाना चाहते हैं?','What would you like to learn or create?')}</p><div className="suggestions">{[t('Python सीखने में मदद करो','Help me learn Python'),t('एक काम की योजना बनाओ','Create a useful plan'),t('यह code समझाओ','Explain this code')].map(s=><button key={s} onClick={()=>setDraft(s)}>{s}</button>)}</div><div className="demo-note"><ShieldCheck size={16}/>{t('अभी Demo UI है — AI उत्तर simulated हैं।','Demo UI — AI responses are simulated.')}</div></div>:current.messages.map(m=><article className={'message '+m.role} key={m.id}><div className="avatar">{m.role==='assistant'?<Bot size={18}/>:<span>U</span>}</div><div className="bubble"><div className="role">{m.role==='assistant'?'DRAGON AI':t('आप','You')}</div><div className="markdown-body">{renderMarkdown(m.content)}</div>{m.demo&&<small className="demo-tag">DEMO</small>}<button className="copy" onClick={()=>navigator.clipboard?.writeText(m.content).catch(()=>setError(t('कॉपी नहीं हो सका।','Copy failed.')))}><Copy size={14}/>{t('कॉपी','Copy')}</button></div></article>)}</section>
 {error&&<div className="error" role="alert">{error}<button onClick={()=>setError('')}>×</button></div>}<form className="composer" onSubmit={e=>{e.preventDefault();send()}}><input className="file-input" type="file" accept=".txt,.md,.csv,.json,.log,text/plain,text/markdown,text/csv,application/json" onChange={attachFile} aria-label="Attach text file"/><button className="attach" type="button" disabled={isSending} onClick={e=>e.currentTarget.previousElementSibling.click()} aria-label="Attach text file"><Paperclip size={16}/></button><textarea value={draft} disabled={isSending} onChange={e=>setDraft(e.target.value)} placeholder={t('DRAGON से कुछ पूछें…','Message DRAGON…')} rows="1" maxLength="8000" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}/><button className="send" disabled={!isSending&&!draft.trim()} aria-label={isSending?"Stop response":"Send"} onClick={isSending?()=>abortRef.current?.abort():undefined} type={isSending?"button":"submit"}>{isSending?<Square size={16}/>:<Send size={18}/>}</button><small>{t('Enter भेजें · Shift+Enter नई लाइन','Enter to send · Shift+Enter for newline')}</small></form></main>
 {panel==='settings'&&<div className="overlay" onClick={()=>setPanel('')}><section className="settings" onClick={e=>e.stopPropagation()}><div className="settings-head"><h2><Settings/> {t('सेटिंग्स','Settings')}</h2><button className="icon" onClick={()=>setPanel('')}><X/></button></div><label>{t('भाषा','Language')}<select value={settings.lang} onChange={e=>setSettings(s=>({...s,lang:e.target.value}))}><option value="hi">हिंदी</option><option value="en">English</option></select></label><label>{t('AI Provider','AI Provider')}<select value={settings.provider} onChange={e=>setSettings(s=>({...s,provider:e.target.value}))}><option value="demo">Demo (no real AI)</option><option value="groq">Groq (server key required)</option><option value="gemini">Gemini (server key required)</option><option value="openrouter">OpenRouter (server key required)</option></select></label><div className={'ai-status '+(aiStatus.configured?'ready':'not-ready')}><strong>{aiStatus.loading?t('AI कनेक्शन जाँचा जा रहा है…','Checking AI connection…'):aiStatus.configured?t('सर्वर पर AI key मिली है','AI key found on server'):t('सर्वर पर AI key नहीं मिली','No AI key found on server')}</strong><span>{aiStatus.error|| (aiStatus.configured?t('Configured providers: ','Configured providers: ')+Object.entries(aiStatus.providers).filter(([,v])=>v).map(([k])=>k).join(', '):t('Demo जवाब असली AI नहीं हैं। असली जवाब के लिए सर्वर key चाहिए।','Demo replies are not real AI. A server key is required.'))}</span><button type="button" onClick={()=>{setAiStatus(s=>({...s,loading:true,error:''}));fetch('/api/health',{cache:'no-store'}).then(r=>r.json().then(d=>({ok:r.ok,data:d}))).then(({ok,data})=>{if(!ok||data.status!=='ok')throw new Error();setAiStatus({loading:false,configured:Boolean(data.realAiConfigured),providers:data.providers||{},error:''})}).catch(()=>setAiStatus({loading:false,configured:false,providers:{},error:t('सर्वर से स्थिति नहीं मिल सकी।','Could not read server status.')}))}}>{t('फिर जाँचें','Check again')}</button></div><p className="notice"><ShieldCheck size={17}/>{t('API key केवल Vercel Environment Variables में रखें। API key बनाना और उसे सुरक्षित रूप से जोड़ना account owner को करना होगा।','Keep API keys only in Vercel Environment Variables. The account owner must create and securely add the key.')}</p><a className="action" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">{t('Gemini API key बनाएँ (Free tier)','Create Gemini API key (Free tier)')}</a><p className="fine">{t('Key बनाने के बाद Vercel → Settings → Environment Variables में GEMINI_API_KEY जोड़ें, Production चुनें और redeploy करें।','After creating the key, add GEMINI_API_KEY in Vercel → Settings → Environment Variables, select Production, and redeploy.')}</p><label className="check"><input type="checkbox" checked={settings.save} onChange={e=>setSettings(s=>({...s,save:e.target.checked}))}/>{t('इस डिवाइस पर history सेव करें','Save history on this device')}</label><button className="action" onClick={exportData}><Download size={17}/>{t('डेटा Export करें','Export data')}</button><button className="action danger" onClick={wipe}><Trash2 size={17}/>{t('सभी बातचीत हटाएँ','Delete all chats')}</button><p className="fine">{t('असली AI के लिए server-side provider key चाहिए। Accounts और cloud history अभी उपलब्ध नहीं हैं।','Real AI needs a server-side provider key. Accounts and cloud history are not available yet.')}</p></section></div>}</div>
}
createRoot(document.getElementById('root')).render(<App/>);