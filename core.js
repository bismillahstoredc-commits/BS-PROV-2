'use strict';
/* ========== helpers ========== */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=parseFloat(v);return isFinite(n)?n:0};
const r2=n=>Math.round(num(n)*100)/100;
const money=n=>'৳'+r2(n).toLocaleString('en-US');
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2,12);
function toast(m,t){const e=document.createElement('div');e.className='toast '+(t||'');e.textContent=m;$('#tw').appendChild(e);setTimeout(()=>e.remove(),3000)}
function modal(title,html,mount,wide){
  const w=$('#mw');w.innerHTML=`<div class="mo"><div class="mb2 ${wide?'w':''}"><h3>${esc(title)}</h3><div id="mbody">${html}</div></div></div>`;
  $('.mo',w).addEventListener('mousedown',e=>{if(e.target.classList.contains('mo'))closeModal()});
  if(mount)mount($('#mbody'));
}
const closeModal=()=>{$('#mw').innerHTML=''};
const modalOpen=()=>!!$('#mw .mo');
function printHTML(html){
  const f=document.createElement('iframe');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);const d=f.contentDocument;d.open();d.write(html);d.close();
  setTimeout(()=>{try{f.contentWindow.focus();f.contentWindow.print()}catch(e){}setTimeout(()=>f.remove(),5000)},350);
}
async function sha256(t){
  if(crypto.subtle){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
  let h=5381;for(let i=0;i<t.length;i++)h=((h<<5)+h+t.charCodeAt(i))|0;return 'x'+h;
}
function toB64(str){const by=new TextEncoder().encode(str);let s='';for(let i=0;i<by.length;i+=0x8000)s+=String.fromCharCode.apply(null,by.subarray(i,i+0x8000));return btoa(s)}

/* ========== IndexedDB (large + fast, one record per row) ========== */
const SYNCED=['products','parties','docs','money','users','meta'];
const IDB={db:null,
  open(){return new Promise((res,rej)=>{const r=indexedDB.open('bspro2',1);
    r.onupgradeneeded=()=>{const d=r.result;SYNCED.forEach(n=>d.createObjectStore(n,{keyPath:'id'}));d.createObjectStore('kv')};
    r.onsuccess=()=>{this.db=r.result;res()};r.onerror=()=>rej(r.error)})},
  tx(store,mode,fn){return new Promise((res,rej)=>{const t=this.db.transaction(store,mode);const s=t.objectStore(store);let out;
    try{out=fn(s)}catch(e){rej(e);return}
    t.oncomplete=()=>res(out&&out.result!==undefined?out.result:undefined);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})},
  all(store){return this.tx(store,'readonly',s=>s.getAll())},
  put(store,val,key){return this.tx(store,'readwrite',s=>key!==undefined?s.put(val,key):s.put(val))},
  putMany(store,arr){return this.tx(store,'readwrite',s=>{arr.forEach(v=>s.put(v))})},
  get(store,key){return this.tx(store,'readonly',s=>s.get(key))},
  clear(store){return this.tx(store,'readwrite',s=>s.clear())}
};

/* ========== state ========== */
const S={products:new Map(),parties:new Map(),docs:new Map(),money:new Map(),users:new Map(),meta:new Map()};
let ME=null;
let DEV={tag:'',counter:0};
let SYNC={owner:'',repo:'',branch:'main',token:'',sha:{},last:0};
let DIRTY={},dirtyV=0,IDXC=null;
const live=m=>[...S[m].values()].filter(r=>!r.del);
const biz=()=>S.meta.get('biz')||{id:'biz'};
async function loadAll(){
  for(const s of SYNCED){S[s]=new Map((await IDB.all(s)).map(r=>[r.id,r]))}
  DEV=(await IDB.get('kv','device'))||{tag:Math.random().toString(36).slice(2,4).toUpperCase(),counter:0};
  SYNC=Object.assign(SYNC,(await IDB.get('kv','sync'))||{});
  DIRTY=(await IDB.get('kv','dirty'))||{};
  IDXC=null;
}
const saveKV=()=>{IDB.put('kv',DEV,'device');IDB.put('kv',SYNC,'sync');IDB.put('kv',DIRTY,'dirty')};
function shardOf(store,r){
  if(store==='docs'||store==='money')return store+'-'+String(r.date||'0000-00').slice(0,7);
  return store;
}
async function save(store,rec){
  rec.updatedAt=Date.now();if(ME)rec.by=ME.id;
  S[store].set(rec.id,rec);await IDB.put(store,rec);
  DIRTY[shardOf(store,rec)]=++dirtyV;IDB.put('kv',DIRTY,'dirty');IDXC=null;syncSoon();return rec;
}
async function saveMany(store,recs){recs.forEach(r=>{r.updatedAt=Date.now();if(ME)r.by=ME.id;S[store].set(r.id,r);DIRTY[shardOf(store,r)]=++dirtyV});
  await IDB.putMany(store,recs);IDB.put('kv',DIRTY,'dirty');IDXC=null;syncSoon()}
const remove=(store,rec)=>{rec.del=1;return save(store,rec)};
function nextNo(prefix){DEV.counter++;IDB.put('kv',DEV,'device');const d=new Date();return `${prefix}-${String(d.getFullYear()).slice(2)}${pad(d.getMonth()+1)}${pad(d.getDate())}-${DEV.tag}${DEV.counter}`}

/* ========== document types & computed index ========== */
const TYPES={
  sale:{l:'বিক্রয়',pre:'S',stock:-1,cash:+1,price:'sellPrice',party:'customer',money:true},
  purchase:{l:'ক্রয়',pre:'P',stock:+1,cash:-1,price:'buyPrice',party:'supplier',money:true},
  free:{l:'ফ্রি আইটেম',pre:'F',stock:-1,cash:0,price:null,party:'customer',need:true},
  sale_order:{l:'বিক্রয় অর্ডার',pre:'SO',stock:0,cash:0,price:'sellPrice',party:'customer',order:true},
  purchase_order:{l:'ক্রয় অর্ডার',pre:'PO',stock:0,cash:0,price:'buyPrice',party:'supplier',order:true},
  sale_return:{l:'বিক্রয় ফেরত',pre:'SR',stock:+1,cash:-1,price:'sellPrice',party:'customer',money:true},
  purchase_return:{l:'ক্রয় ফেরত',pre:'PR',stock:-1,cash:+1,price:'buyPrice',party:'supplier',money:true}
};
function cashEffect(kind,r){ // returns [cash,bank] delta
  const a=num(r.amount??r.paid),m=r.method==='bank'?1:0,v=[0,0];
  if(r.type){const t=TYPES[r.type];if(!t||!t.money)return v;if(r.payCash!==undefined){v[0]=t.cash*num(r.payCash);v[1]=t.cash*num(r.payBank);return v}v[m]=t.cash*num(r.paid);return v}
  switch(r.kind){
    case 'payment_in':v[m]=a;break;case 'payment_out':v[m]=-a;break;case 'expense':v[m]=-a;break;
    case 'cash_in':v[0]=a;break;case 'cash_out':v[0]=-a;break;case 'bank_in':v[1]=a;break;case 'bank_out':v[1]=-a;break;
    case 'c2b':v[0]=-a;v[1]=a;break;case 'b2c':v[0]=a;v[1]=-a;break}
  return v;
}
function idx(){
  if(IDXC)return IDXC;
  const stock={},net={},X={stock,net,cash:num(biz().openCash),bank:num(biz().openBank)};
  S.products.forEach(p=>{if(!p.del)stock[p.id]=num(p.openQty)});
  S.docs.forEach(d=>{if(d.del)return;const t=TYPES[d.type];if(!t)return;
    if(t.stock)(d.items||[]).forEach(i=>{if(i.pid in stock)stock[i.pid]+=t.stock*num(i.qty)});
    const e=cashEffect(0,d);X.cash+=e[0];X.bank+=e[1];
    if(d.partyId&&!t.order){const due=num(d.total)-num(d.paid);
      const k=d.type==='sale'?1:d.type==='sale_return'?-1:d.type==='purchase'?-1:d.type==='purchase_return'?1:0; // net = they owe us
      net[d.partyId]=(net[d.partyId]||0)+k*due}});
  S.money.forEach(m=>{if(m.del)return;const e=cashEffect(0,m);X.cash+=e[0];X.bank+=e[1];
    if(m.partyId){net[m.partyId]=(net[m.partyId]||0)+(m.kind==='payment_in'?-num(m.amount):m.kind==='payment_out'?num(m.amount):0)}});
  return IDXC=X;
}
const stockOf=id=>idx().stock[id]||0;
function dueOf(p){const n=idx().net[p.id]||0,o=num(p.opening);return p.type==='supplier'?o-n:o+n}
const isOwner=()=>ME&&ME.role==='owner';

/* ========== GitHub sync (sharded files: data/docs-YYYY-MM.json ...) ========== */
let syncing=false,syncTimer=null,lastErr='';
const syncOn=()=>!!(SYNC.owner&&SYNC.repo&&SYNC.token);
function gh(path,opt={}){return fetch(`https://api.github.com/repos/${SYNC.owner}/${SYNC.repo}/${path}`,{cache:'no-store',...opt,headers:{Authorization:'token '+SYNC.token,Accept:'application/vnd.github+json',...(opt.headers||{})}})}
async function listRemote(){
  const r=await gh(`contents/data?ref=${encodeURIComponent(SYNC.branch)}`);
  if(r.status===404)return{};
  if(!r.ok)throw new Error(r.status===401?'টোকেন ভুল বা মেয়াদ শেষ':'GitHub ত্রুটি '+r.status);
  const o={};(await r.json()).forEach(f=>{if(f.name.endsWith('.json'))o[f.name.slice(0,-5)]=f.sha});return o;
}
function mergeRows(store,rows){const ch=[];for(const r of rows){const l=S[store].get(r.id);if(!l||num(r.updatedAt)>num(l.updatedAt)){S[store].set(r.id,r);ch.push(r)}}return ch}
async function pullShard(shard,sha){
  const store=shard.split('-')[0];if(!S[store])return 0;
  const r=await gh(`contents/data/${shard}.json?ref=${encodeURIComponent(SYNC.branch)}`,{headers:{Accept:'application/vnd.github.raw+json'}});
  if(!r.ok)throw new Error('ডাউনলোড ত্রুটি '+r.status);
  const j=await r.json();const ch=mergeRows(store,j.rows||[]);
  if(ch.length){await IDB.putMany(store,ch);IDXC=null}
  SYNC.sha[shard]=sha;return ch.length;
}
async function pushShard(shard,remote){
  const store=shard.split('-')[0];
  for(let a=0;a<3;a++){
    const ver=DIRTY[shard];if(!ver)return;
    const rows=[...S[store].values()].filter(r=>shardOf(store,r)===shard);
    if(!rows.length&&!remote[shard]){delete DIRTY[shard];return}
    const body={message:'sync '+shard,content:toB64(JSON.stringify({v:1,store,rows})),branch:SYNC.branch};
    if(remote[shard])body.sha=remote[shard];
    const r=await gh(`contents/data/${shard}.json`,{method:'PUT',body:JSON.stringify(body)});
    if(r.ok){const j=await r.json();remote[shard]=SYNC.sha[shard]=j.content.sha;if(DIRTY[shard]===ver)delete DIRTY[shard];return}
    if(r.status===409||r.status===422){const l=await listRemote();remote[shard]=l[shard];if(l[shard])await pullShard(shard,l[shard]);continue}
    throw new Error(r.status===401||r.status===403||r.status===404?'লেখার অনুমতি নেই/repo পাওয়া যায়নি ('+r.status+')':'আপলোড ত্রুটি '+r.status);
  }
  throw new Error('সিঙ্ক দ্বন্দ্ব, আবার চেষ্টা করুন');
}
async function doSync(manual){
  if(!syncOn()||syncing)return;
  if(!navigator.onLine){setStatus();return}
  syncing=true;setStatus();let pulled=0;
  try{
    const remote=await listRemote();
    for(const[shard,sha]of Object.entries(remote)){if(SYNC.sha[shard]!==sha)pulled+=await pullShard(shard,sha)}
    for(const shard of Object.keys(DIRTY))await pushShard(shard,remote);
    SYNC.last=Date.now();lastErr='';saveKV();
    if(pulled&&window.onSynced)window.onSynced(pulled);
    if(manual)toast('সিঙ্ক সম্পন্ন'+(pulled?` (${pulled}টি নতুন তথ্য)`:''),'k');
  }catch(e){lastErr=e.message||String(e);saveKV();if(manual)toast(lastErr,'e')}
  syncing=false;setStatus();
}
function syncSoon(){setStatus();if(!syncOn())return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>doSync(),2500)}
function setStatus(){
  const p=$('#pill');if(!p)return;const n=Object.keys(DIRTY).length;
  p.textContent=!syncOn()?'☁ সিঙ্ক বন্ধ':syncing?'⟳ সিঙ্ক হচ্ছে…':!navigator.onLine?'⚠ অফলাইন'+(n?` (${n})`:''):lastErr?'⚠ সিঙ্ক ত্রুটি':n?`☁ অপেক্ষমান (${n})`:'✓ সিঙ্ক হয়েছে';
  p.title=lastErr||'ট্যাপ করে এখনই সিঙ্ক করুন';
}
async function pushAll(){const set={};SYNCED.forEach(s=>S[s].forEach(r=>{DIRTY[shardOf(s,r)]=++dirtyV}));saveKV();await doSync(true)}
setInterval(()=>{if(syncOn()&&!syncing&&navigator.onLine)doSync()},45000);
addEventListener('online',()=>{setStatus();doSync()});addEventListener('offline',setStatus);
