'use strict';
/* ========== menu & router ========== */
const MENU=[
 ['প্রধান'],['dash','🏠','ড্যাশবোর্ড'],
 ['বিক্রয়'],['pos:sale','🛒','নতুন বিক্রয়'],['pos:sale_order','📝','বিক্রয় অর্ডার'],['pos:sale_return','↩️','বিক্রয় ফেরত'],['pos:free','🎁','ফ্রি আইটেম'],
 ['ক্রয়'],['pos:purchase','📥','নতুন ক্রয়'],['pos:purchase_order','📝','ক্রয় অর্ডার'],['pos:purchase_return','↩️','ক্রয় ফেরত'],
 ['হিসাব'],['invoices','🧾','ইনভয়েস তালিকা'],['due','💳','দেনা-পাওনা'],['expense','💸','খরচ'],['cash','🏦','ক্যাশ ও ব্যাংক'],
 ['তালিকা'],['products','📦','পণ্য'],['parties','👥','পার্টি (কাস্টমার/সাপ্লায়ার)'],
 ['রিপোর্ট'],['reports','📊','রিপোর্ট'],
 ['সেটিংস'],['settings','⚙️','সেটিংস','owner']
];
let CUR={r:'dash',a:null};
function buildMenu(){
  $('#drawer').innerHTML=`<div class="dh"><b>${esc(ME.name)}</b><small>${ME.role==='owner'?'মালিক':'স্টাফ'}</small></div>`+
   MENU.map(m=>m.length===1?`<div class="ms">${m[0]}</div>`:(m[3]==='owner'&&!isOwner()?'':`<div class="mi" data-r="${m[0]}"><span>${m[1]}</span>${m[2]}</div>`)).join('')+
   `<div class="mi" data-r="logout"><span>🚪</span>লগআউট</div>`;
}
function go(r,a){
  if(r==='logout'){localStorage.removeItem('bspro_uid');ME=null;POS=null;location.reload();return}
  if(r.startsWith('pos:')){a=Object.assign({type:r.slice(4)},a||{});r='pos'}
  CUR={r,a};closeDrawer();
  $$('.mi').forEach(e=>e.classList.toggle('on',e.dataset.r===r||e.dataset.r==='pos:'+(a&&a.type)&&r==='pos'));
  $('#main').scrollTop=0;
  try{(SCR[r]||SCR.dash)(a)}catch(e){console.error(e);$('#main').innerHTML='<div class="empty">ত্রুটি: '+esc(e.message)+'</div>'}
}
function closeDrawer(){$('#drawer').classList.remove('open');$('#ov').classList.remove('show')}
const view=h=>{$('#main').innerHTML=h};
const tblc=(cols,rows,foot)=>{const al=cols.map(c=>c[0]==='>');
 return `<div class="tw"><table><thead><tr>${cols.map((c,i)=>`<th class="${al[i]?'n':''}">${esc(al[i]?c.slice(1):c)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map((c,i)=>`<td class="${al[i]?'n':''}">${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${cols.length}" class="empty">কোনো তথ্য নেই</td></tr>`}${foot&&rows.length?`<tr class="tot">${foot.map((c,i)=>`<td class="${al[i]?'n':''}">${c}</td>`).join('')}</tr>`:''}</tbody></table></div>`};
const partyName=id=>{const p=id&&S.parties.get(id);return p?esc(p.name):'ওয়াক-ইন'};
const byDateDesc=(a,b)=>(a.date<b.date?1:a.date>b.date?-1:num(b.createdAt||b.updatedAt)-num(a.createdAt||a.updatedAt));

/* ========== dashboard ========== */
const SCR={};
SCR.dash=()=>{
  const X=idx(),t=today();let sale=0,pur=0,exp=0,n=0;const days={};
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days[d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())]=0}
  S.docs.forEach(d=>{if(d.del)return;if(d.type==='sale'){if(d.date===t){sale+=num(d.total);n++}if(d.date in days)days[d.date]+=num(d.total)}if(d.type==='purchase'&&d.date===t)pur+=num(d.total)});
  S.money.forEach(m=>{if(!m.del&&m.kind==='expense'&&m.date===t)exp+=num(m.amount)});
  let recv=0,pay=0;S.parties.forEach(p=>{if(p.del)return;const d=dueOf(p);if(p.type==='supplier')pay+=d;else recv+=d});
  let sv=0,low=0;S.products.forEach(p=>{if(p.del)return;const s=stockOf(p.id);sv+=Math.max(s,0)*num(p.buyPrice);if(num(p.low)>0&&s<=num(p.low))low++});
  const recent=live('docs').sort(byDateDesc).slice(0,6);const mx=Math.max(1,...Object.values(days));
  view(`<div class="grid g4"><div class="stat g"><small>আজকের বিক্রয় (${n}টি)</small><div>${money(sale)}</div></div><div class="stat o"><small>আজকের ক্রয়</small><div>${money(pur)}</div></div><div class="stat r"><small>আজকের খরচ</small><div>${money(exp)}</div></div><div class="stat"><small>স্টক মূল্য</small><div>${money(sv)}</div></div></div>
  <div class="grid g4" style="margin-top:10px"><div class="stat g"><small>ক্যাশ ব্যালেন্স</small><div>${money(X.cash)}</div></div><div class="stat"><small>ব্যাংক ব্যালেন্স</small><div>${money(X.bank)}</div></div><div class="stat g"><small>কাস্টমারের কাছে পাওনা</small><div>${money(recv)}</div></div><div class="stat r"><small>সাপ্লায়ারকে দেনা</small><div>${money(pay)}</div></div></div>
  <div class="card" style="margin-top:12px"><h3>গত ৭ দিনের বিক্রয়</h3><div class="bars">${Object.entries(days).map(([d,v])=>`<div><i style="height:${Math.round(v/mx*80)}px"></i>${d.slice(8)}</div>`).join('')}</div></div>
  <div class="card"><h3>দ্রুত কাজ</h3><div class="row"><button class="btn" data-go="pos:sale">🛒 নতুন বিক্রয়</button><button class="btn o" data-go="pos:purchase">📥 নতুন ক্রয়</button><button class="btn o" data-go="expense">💸 খরচ</button><button class="btn o" data-go="due">💳 দেনা-পাওনা</button>${low?`<button class="btn d" data-go="products">⚠ লো-স্টক (${low})</button>`:''}</div></div>
  <div class="card"><h3>সাম্প্রতিক লেনদেন</h3>${tblc(['ইনভয়েস','তারিখ','পার্টি','>মোট'],recent.map(d=>[`<a href="#" data-view="${d.id}">${esc(d.no)}</a> <span class="bd bp">${TYPES[d.type].l}</span>`,d.date,partyName(d.partyId),money(d.total)]))}</div>`);
};

/* ========== product form (shared) ========== */
function productForm(p,cb){
  const cats=[...new Set(live('products').map(x=>x.category).filter(Boolean))];
  modal(p?'পণ্য এডিট':'নতুন পণ্য',`<div class="f"><label>নাম *</label><input id="fn" value="${esc(p?.name||'')}"></div>
  <div class="grid g2"><div class="f"><label>ক্যাটাগরি</label><input id="fc" list="cl" value="${esc(p?.category||'')}"><datalist id="cl">${cats.map(c=>`<option value="${esc(c)}">`).join('')}</datalist></div><div class="f"><label>একক</label><input id="fu" value="${esc(p?.unit||'pcs')}"></div></div>
  <div class="grid g2"><div class="f"><label>ক্রয় মূল্য</label><input id="fb" type="number" value="${p?.buyPrice??0}"></div><div class="f"><label>বিক্রয় মূল্য</label><input id="fs" type="number" value="${p?.sellPrice??0}"></div></div>
  <div class="grid g2"><div class="f"><label>${p?'বর্তমান স্টক (সংশোধন করা যাবে)':'শুরুর স্টক'}</label><input id="fq" type="number" value="${p?r2(stockOf(p.id)):0}"></div><div class="f"><label>লো-স্টক এলার্ট</label><input id="fl" type="number" value="${p?.low??0}"></div></div>
  <div class="row"><button class="btn" id="fsv">সেভ করুন</button>${p&&isOwner()?'<button class="btn d" id="fdel">ডিলিট</button>':''}</div>`,()=>{
    $('#fsv').onclick=async()=>{
      const name=$('#fn').value.trim();if(!name)return toast('নাম দিন','e');
      const rec=p||{id:uid(),openQty:0,createdAt:Date.now()};
      const want=num($('#fq').value);
      if(p)rec.openQty=num(rec.openQty)+(want-stockOf(p.id));else rec.openQty=want;
      Object.assign(rec,{name,category:$('#fc').value.trim(),unit:$('#fu').value.trim()||'pcs',buyPrice:num($('#fb').value),sellPrice:num($('#fs').value),low:num($('#fl').value)});
      await save('products',rec);closeModal();toast('সেভ হয়েছে','k');cb&&cb(rec);
    };
    if(p&&isOwner())$('#fdel').onclick=async()=>{if(!confirm('ডিলিট করবেন?'))return;await remove('products',p);closeModal();cb&&cb(null)};
  });
}
function partyForm(p,defType,cb){
  modal(p?'পার্টি এডিট':'নতুন পার্টি',`<div class="f"><label>নাম *</label><input id="pn" value="${esc(p?.name||'')}"></div>
  <div class="grid g2"><div class="f"><label>ধরন</label><select id="pt"><option value="customer">কাস্টমার</option><option value="supplier">সাপ্লায়ার</option></select></div><div class="f"><label>ফোন</label><input id="pp" type="tel" value="${esc(p?.phone||'')}"></div></div>
  <div class="f"><label>ঠিকানা</label><input id="pa" value="${esc(p?.address||'')}"></div>
  <div class="f"><label>শুরুর বকেয়া (কাস্টমার: আমাদের পাওনা / সাপ্লায়ার: আমাদের দেনা)</label><input id="po" type="number" value="${p?.opening??0}"></div>
  <div class="row"><button class="btn" id="psv">সেভ করুন</button>${p&&isOwner()?'<button class="btn d" id="pdel">ডিলিট</button>':''}</div>`,()=>{
    $('#pt').value=p?.type||defType||'customer';
    $('#psv').onclick=async()=>{const name=$('#pn').value.trim();if(!name)return toast('নাম দিন','e');
      const rec=p||{id:uid(),createdAt:Date.now()};
      Object.assign(rec,{name,type:$('#pt').value,phone:$('#pp').value.trim(),address:$('#pa').value.trim(),opening:num($('#po').value)});
      await save('parties',rec);closeModal();toast('সেভ হয়েছে','k');cb&&cb(rec)};
    if(p&&isOwner())$('#pdel').onclick=async()=>{if(!confirm('ডিলিট করবেন?'))return;await remove('parties',p);closeModal();cb&&cb(null)};
  });
}

/* ========== POS: sale / purchase / order / return / free ========== */
let POS=null;
function posStart(type,pre){
  POS={type,editId:pre?.id||null,fromOrder:pre?.fromOrder||null,date:pre?.date||today(),partyId:pre?.partyId||'',
   items:pre?.items?JSON.parse(JSON.stringify(pre.items)):[],disc:num(pre?.disc),paid:pre&&pre.id?num(pre.paid):null,method:pre?.method||'cash',note:pre?.note||'',q:''};
}
SCR.pos=a=>{const type=a.type;if(!POS||POS.type!==type||a.pre){posStart(type,a.pre)}paintPOS()};
function paintPOS(){
  const T=TYPES[POS.type];
  const plist=live('parties').filter(p=>p.type===T.party).sort((a,b)=>a.name.localeCompare(b.name));
  view(`<div class="pos"><div class="pos-l card"><div class="row"><input id="pq" placeholder="পণ্য খুঁজুন..." value="${esc(POS.q)}" style="flex:1"><button class="btn o s" id="pnew">+ নতুন পণ্য</button></div><div class="pg" id="pg"></div></div>
  <div class="pos-r card"><h3>${T.l}${POS.editId?' (এডিট)':''}</h3>
   <div class="grid g2"><div class="f"><label>তারিখ</label><input type="date" id="pd" value="${POS.date}"></div>
   <div class="f"><label>${T.party==='supplier'?'সাপ্লায়ার':'কাস্টমার'}${T.need?' *':''}</label><div class="row" style="flex-wrap:nowrap"><select id="pparty"><option value="">${T.need?'-- নির্বাচন --':'ওয়াক-ইন / কেউ না'}</option>${plist.map(p=>`<option value="${p.id}" ${p.id===POS.partyId?'selected':''}>${esc(p.name)}</option>`).join('')}</select><button class="btn o s" id="pnp">+</button></div></div></div>
   <div id="cart"></div><div class="sm" id="sm"></div>
   <div class="f"><label>নোট</label><input id="pnote" value="${esc(POS.note)}"></div>
   <div class="row"><button class="btn gr" id="psave" style="flex:1">${POS.editId?'আপডেট করুন':'সেভ করুন'}</button><button class="btn o" id="pprint">সেভ ও প্রিন্ট</button><button class="btn o" id="pclr">রিসেট</button></div></div></div>`);
  paintGrid();paintCart();
  $('#pq').oninput=e=>{POS.q=e.target.value;paintGrid()};
  $('#pnew').onclick=()=>productForm(null,p=>{if(p){addItem(p);paintGrid()}});
  $('#pd').onchange=e=>POS.date=e.target.value;$('#pparty').onchange=e=>POS.partyId=e.target.value;$('#pnote').oninput=e=>POS.note=e.target.value;
  $('#pnp').onclick=()=>partyForm(null,T.party,p=>{if(p){POS.partyId=p.id;paintPOS()}});
  $('#psave').onclick=()=>posSave(false);$('#pprint').onclick=()=>posSave(true);
  $('#pclr').onclick=()=>{if(POS.items.length&&!confirm('সব মুছে ফেলবেন?'))return;const ty=POS.type;POS=null;go('pos:'+ty,{})};
}
function paintGrid(){
  const T=TYPES[POS.type],q=POS.q.toLowerCase();
  const rows=live('products').filter(p=>!q||p.name.toLowerCase().includes(q)||(p.category||'').toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,80);
  $('#pg').innerHTML=rows.length?rows.map(p=>{const s=stockOf(p.id);return `<div class="pt" data-pid="${p.id}"><b>${esc(p.name)}</b><span>${T.price?money(p[T.price]):'ফ্রি'}</span><small class="${s<=0?'low':''}">স্টক: ${r2(s)} ${esc(p.unit||'')}</small></div>`}).join(''):'<div class="empty">কোনো পণ্য নেই — "+ নতুন পণ্য" দিন</div>';
  $('#pg').onclick=e=>{const t=e.target.closest('[data-pid]');if(t)addItem(S.products.get(t.dataset.pid))};
}
function addItem(p){
  const T=TYPES[POS.type];const ex=POS.items.find(i=>i.pid===p.id);
  if(ex)ex.qty=num(ex.qty)+1;else POS.items.push({pid:p.id,name:p.name,qty:1,price:T.price?num(p[T.price]):0,cost:num(p.buyPrice)});
  paintCart();
}
function paintCart(){
  const T=TYPES[POS.type];
  $('#cart').innerHTML=POS.items.length?`<div class="cr" style="font-size:11px;color:var(--m)"><span>পণ্য</span><span>পরিমাণ</span><span>দাম</span><span></span></div>`+POS.items.map((it,i)=>`<div class="cr"><span>${esc(it.name)}<br><small id="lt${i}" style="color:var(--pd)">${money(num(it.qty)*num(it.price))}</small></span><input type="number" step="any" data-i="${i}" data-f="qty" value="${it.qty}"><input type="number" step="any" data-i="${i}" data-f="price" value="${it.price}" ${T.price?'':'disabled'}><span class="x" data-x="${i}">✕</span></div>`).join(''):'<div class="empty">বাম দিক থেকে পণ্য ট্যাপ করুন</div>';
  $('#cart').oninput=e=>{const i=e.target.dataset.i;if(i==null)return;POS.items[i][e.target.dataset.f]=num(e.target.value);const it=POS.items[i];$('#lt'+i).textContent=money(num(it.qty)*num(it.price));paintSum(true)};
  $('#cart').onclick=e=>{const x=e.target.dataset.x;if(x!=null){POS.items.splice(x,1);paintCart()}};
  paintSum();
}
function posTotals(){const sub=POS.items.reduce((a,i)=>a+num(i.qty)*num(i.price),0);const total=Math.max(0,sub-num(POS.disc));const paid=POS.paid===null?total:POS.paid;return{sub,total,paid}}
function paintSum(keep){
  const T=TYPES[POS.type],o=posTotals();
  if(keep&&$('#s_total')){$('#s_sub').textContent=money(o.sub);$('#s_total').textContent=money(o.total);if(POS.paid===null&&$('#s_paid'))$('#s_paid').value=r2(o.total);if($('#s_due'))$('#s_due').textContent=money(Math.max(0,o.total-o.paid));return}
  if(T.order||!T.price){$('#sm').innerHTML=`<div class="t"><span>মোট আইটেম</span><span>${r2(POS.items.reduce((a,i)=>a+num(i.qty),0))}</span></div>`+(T.order?`<div class="t"><span>আনুমানিক মোট</span><span id="s_total">${money(o.total)}</span></div><span id="s_sub" hidden></span>`:'');return}
  $('#sm').innerHTML=`<div><span>সাবটোটাল</span><span id="s_sub">${money(o.sub)}</span></div><div><span>ছাড়</span><input type="number" id="s_disc" value="${num(POS.disc)}"></div>
  <div class="t"><span>মোট</span><span id="s_total">${money(o.total)}</span></div>
  <div><span>${T.cash>0?'গ্রহণ (পরিশোধ)':'প্রদান (পরিশোধ)'}</span><input type="number" id="s_paid" value="${r2(o.paid)}"></div>
  <div><span>মাধ্যম</span><select id="s_method" style="width:100px"><option value="cash">ক্যাশ</option><option value="bank">ব্যাংক</option></select></div>
  <div><span>বকেয়া</span><b id="s_due">${money(Math.max(0,o.total-o.paid))}</b></div>`;
  $('#s_method').value=POS.method;
  $('#s_disc').oninput=e=>{POS.disc=num(e.target.value);paintSum(true)};
  $('#s_paid').oninput=e=>{POS.paid=num(e.target.value);$('#s_due').textContent=money(Math.max(0,posTotals().total-POS.paid))};
  $('#s_method').onchange=e=>POS.method=e.target.value;
}
async function posSave(print){
  const T=TYPES[POS.type];if(!POS.items.length)return toast('পণ্য যোগ করুন','e');
  if(POS.items.some(i=>num(i.qty)<=0))return toast('পরিমাণ ০ এর বেশি হতে হবে','e');
  if(T.need&&!POS.partyId)return toast('পার্টি নির্বাচন করুন','e');
  const o=posTotals();const paid=T.money?o.paid:0;
  if(T.money&&paid>o.total+0.001)return toast('পরিশোধ মোটের বেশি হতে পারে না','e');
  if(T.money&&paid<o.total-0.001&&!POS.partyId)return toast('বাকি রাখতে হলে পার্টি নির্বাচন করুন','e');
  if(T.stock<0){const old=POS.editId?S.docs.get(POS.editId):null;
    for(const it of POS.items){let s=stockOf(it.pid);if(old&&TYPES[old.type].stock<0)s+=(old.items.find(x=>x.pid===it.pid)?.qty||0);
      if(s-num(it.qty)<0&&!confirm(`${it.name}: স্টক ${r2(s)}, বিক্রি ${it.qty}। তবুও সেভ করবেন?`))return}}
  const doc=POS.editId?{...S.docs.get(POS.editId)}:{id:uid(),no:nextNo(T.pre),createdAt:Date.now()};
  const oldCost={};(doc.items||[]).forEach(i=>oldCost[i.pid]=i.cost);
  Object.assign(doc,{type:POS.type,date:POS.date||today(),partyId:POS.partyId||'',
    items:POS.items.map(i=>({pid:i.pid,name:i.name,qty:num(i.qty),price:num(i.price),cost:T.price==='buyPrice'?num(i.price):(oldCost[i.pid]??num(S.products.get(i.pid)?.buyPrice??i.cost))})),
    sub:o.sub,disc:num(POS.disc),total:T.price?o.total:0,paid,method:POS.method,note:POS.note});
  if(T.order)doc.status=doc.status||'open';
  await save('docs',doc);
  if(POS.type==='purchase'){const ups=[];POS.items.forEach(i=>{const p=S.products.get(i.pid);if(p&&num(p.buyPrice)!==num(i.price)){ups.push({...p,buyPrice:num(i.price)})}});if(ups.length)await saveMany('products',ups)}
  if(POS.fromOrder){const od=S.docs.get(POS.fromOrder);if(od)await save('docs',{...od,status:'done'})}
  const wasEdit=!!POS.editId,ty=POS.type;POS=null;toast('সেভ হয়েছে: '+doc.no,'k');
  if(print||biz().autoPrint)printDoc(doc);
  if(wasEdit)go('invoices');else go('pos:'+ty,{});
}

/* ========== invoices list / view / print ========== */
let INV={type:'all',from:'',to:'',q:'',lim:100};
SCR.invoices=()=>{
  view(`<div class="card"><div class="tabs">${[['all','সব'],['sale','বিক্রয়'],['purchase','ক্রয়'],['free','ফ্রি'],['order','অর্ডার'],['return','ফেরত']].map(([k,l])=>`<button class="btn s ${INV.type===k?'':'o'}" data-t="${k}">${l}</button>`).join('')}</div>
  <div class="grid g3"><div class="f"><label>শুরু</label><input type="date" id="if" value="${INV.from}"></div><div class="f"><label>শেষ</label><input type="date" id="it" value="${INV.to}"></div><div class="f"><label>খুঁজুন (নং / পার্টি)</label><input id="iq" value="${esc(INV.q)}"></div></div></div><div class="card" id="il"></div>`);
  $$('[data-t]').forEach(b=>b.onclick=()=>{INV.type=b.dataset.t;INV.lim=100;SCR.invoices()});
  $('#if').onchange=e=>{INV.from=e.target.value;paintInv()};$('#it').onchange=e=>{INV.to=e.target.value;paintInv()};$('#iq').oninput=e=>{INV.q=e.target.value;paintInv()};
  paintInv();
};
function paintInv(){
  const q=INV.q.toLowerCase();
  const m={sale:['sale'],purchase:['purchase'],free:['free'],order:['sale_order','purchase_order'],return:['sale_return','purchase_return']}[INV.type];
  const rows=live('docs').filter(d=>(!m||m.includes(d.type))&&(!INV.from||d.date>=INV.from)&&(!INV.to||d.date<=INV.to)&&(!q||d.no.toLowerCase().includes(q)||(S.parties.get(d.partyId)?.name||'').toLowerCase().includes(q))).sort(byDateDesc);
  const sh=rows.slice(0,INV.lim);
  $('#il').innerHTML=tblc(['ইনভয়েস','তারিখ','পার্টি','>মোট','>বকেয়া',''],sh.map(d=>{const t=TYPES[d.type],due=num(d.total)-num(d.paid);
   return [`${esc(d.no)}<br><span class="bd bp">${t.l}</span>${d.status==='done'?' <span class="bd bg">সম্পন্ন</span>':''}`,d.date,partyName(d.partyId),money(d.total),t.money?(due>0.001?`<span class="bd br">${money(due)}</span>`:'<span class="bd bg">পরিশোধিত</span>'):'-',`<button class="btn o s" data-view="${d.id}">দেখুন</button>`]}))+
  `<div class="row sp" style="margin-top:8px"><small>${rows.length}টির মধ্যে ${sh.length}টি দেখানো হচ্ছে</small>${rows.length>sh.length?'<button class="btn o s" id="more">আরও দেখুন</button>':''}</div>`;
  if($('#more'))$('#more').onclick=()=>{INV.lim+=200;paintInv()};
}
function invoiceHTML(d,design){
  const b=biz(),p=d.partyId?S.parties.get(d.partyId):null,t=TYPES[d.type];
  const th=design[0]==='t',w={t80:'76mm',t58:'54mm',a4:'190mm',a5:'135mm'}[design]||'76mm',fs=design==='t58'?10:th?11:design==='a5'?12:13;
  const due=num(d.total)-num(d.paid),pd=p?dueOf(p):0;
  const rows=(d.items||[]).map((i,n)=>`<tr><td>${n+1}</td><td>${esc(i.name)}</td><td class="n">${r2(i.qty)}</td><td class="n">${t.price||d.type==='free'?r2(i.price):'-'}</td><td class="n">${r2(num(i.qty)*num(i.price))}</td></tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(d.no)}</title><style>
  @page{size:${design==='a4'?'A4':design==='a5'?'A5':w+' auto'};margin:${th?'2mm':'10mm'}}*{box-sizing:border-box}
  body{font-family:'Hind Siliguri','Noto Sans Bengali',Arial,sans-serif;font-size:${fs}px;width:${w};margin:0 auto;color:#000}
  h2{margin:2px 0;font-size:${fs+5}px}.c{text-align:center}.n{text-align:right}table{width:100%;border-collapse:collapse}
  th,td{padding:3px 2px;${th?'border-bottom:1px dashed #555':'border:1px solid #999'}}th{background:${th?'none':'#eee'};text-align:left}
  .hd{${th?'':'display:flex;align-items:center;gap:14px;border-bottom:3px solid #6c2bd9;padding-bottom:8px;margin-bottom:8px'}}
  .tt{font-weight:700;text-align:center;margin:6px 0;${th?'':'font-size:'+(fs+3)+'px;letter-spacing:1px'}}.sg{display:flex;justify-content:space-between;margin-top:${th?'10':'50'}px}.sg span{border-top:1px solid #000;padding-top:3px;min-width:${th?'70':'150'}px;text-align:center}
  img.lg{height:${th?38:64}px}.tot td{font-weight:700}</style></head><body>
  <div class="hd ${th?'c':''}">${b.logo?`<img class="lg" src="${b.logo}"><br>`:''}<div><h2>${esc(b.name||'')}</h2>${esc(b.address||'')}${b.phone?'<br>মোবাইল: '+esc(b.phone):''}</div></div>
  <div class="tt">${t.l} ${t.order?'':'ইনভয়েস'}</div>
  <div>নং: <b>${esc(d.no)}</b> &nbsp; তারিখ: ${d.date}</div>${p?`<div>${p.type==='supplier'?'সাপ্লায়ার':'কাস্টমার'}: <b>${esc(p.name)}</b>${p.phone?' ('+esc(p.phone)+')':''}${p.address?'<br>'+esc(p.address):''}</div>`:''}
  <table style="margin-top:6px"><thead><tr><th>#</th><th>বিবরণ</th><th class="n">পরিমাণ</th><th class="n">দর</th><th class="n">টাকা</th></tr></thead><tbody>${rows}
  ${d.type==='free'?`<tr class="tot"><td colspan="5" class="c">ফ্রি আইটেম — মূল্য নেওয়া হয়নি</td></tr>`:`<tr class="tot"><td colspan="4" class="n">সাবটোটাল</td><td class="n">${r2(d.sub)}</td></tr>${num(d.disc)?`<tr><td colspan="4" class="n">ছাড়</td><td class="n">- ${r2(d.disc)}</td></tr>`:''}<tr class="tot"><td colspan="4" class="n">সর্বমোট</td><td class="n">${r2(d.total)}</td></tr>${t.money?`<tr><td colspan="4" class="n">পরিশোধ (${d.method==='bank'?'ব্যাংক':'ক্যাশ'})</td><td class="n">${r2(d.paid)}</td></tr><tr class="tot"><td colspan="4" class="n">এই ইনভয়েসে বকেয়া</td><td class="n">${r2(Math.max(0,due))}</td></tr>`:''}`}</tbody></table>
  ${p&&t.money?`<div style="margin-top:4px">পার্টির মোট বর্তমান বকেয়া: <b>${r2(pd)}</b></div>`:''}${d.note?`<div>নোট: ${esc(d.note)}</div>`:''}
  ${th?'':`<div class="sg"><span>গ্রহীতার স্বাক্ষর</span><span>বিক্রেতার স্বাক্ষর</span></div>`}
  <div class="c" style="margin-top:8px">${esc(b.footer||'ধন্যবাদ')}</div></body></html>`;
}
const printDoc=(d,design)=>printHTML(invoiceHTML(d,design||biz().design||'t80'));
function viewDoc(id){
  const d=S.docs.get(id);if(!d)return;const t=TYPES[d.type];
  const html=invoiceHTML(d,'a5').replace(/<!DOCTYPE html>.*?<body>/s,'').replace('</body></html>','');
  modal(d.no,`<div class="card" style="box-shadow:none;border:1px solid var(--b);overflow-x:auto"><style>#mbody .n{text-align:right}#mbody table{font-size:13px}#mbody th,#mbody td{border:1px solid #ddd!important;padding:4px}#mbody .hd{display:flex;gap:10px;align-items:center}#mbody img.lg{height:50px}#mbody .sg{display:none}</style>${html.replace(/<style>.*?<\/style>/s,'')}</div>
  <div class="row" style="margin-top:8px"><select id="vd" style="width:auto">${[['t80','থার্মাল ৮০মিমি'],['t58','থার্মাল ৫৮মিমি'],['a4','A4'],['a5','A5']].map(([k,l])=>`<option value="${k}" ${k===(biz().design||'t80')?'selected':''}>${l}</option>`).join('')}</select>
  <button class="btn" id="vp">🖨 প্রিন্ট</button><button class="btn o" id="ve">✏️ এডিট</button>${t.order&&d.status!=='done'?'<button class="btn gr" id="vc">ইনভয়েসে রূপান্তর</button>':''}${isOwner()?'<button class="btn d" id="vx">ডিলিট</button>':''}</div>`,()=>{
    $('#vp').onclick=()=>printDoc(d,$('#vd').value);
    $('#ve').onclick=()=>{closeModal();go('pos',{type:d.type,pre:d})};
    if($('#vc'))$('#vc').onclick=()=>{closeModal();const ty=d.type==='sale_order'?'sale':'purchase';POS=null;go('pos',{type:ty,pre:{fromOrder:d.id,partyId:d.partyId,items:d.items,note:d.note}})};
    if($('#vx'))$('#vx').onclick=async()=>{if(!confirm('ইনভয়েসটি ডিলিট করবেন? স্টক ও হিসাব স্বয়ংক্রিয়ভাবে ঠিক হয়ে যাবে।'))return;await remove('docs',d);closeModal();toast('ডিলিট হয়েছে');go(CUR.r,CUR.a)};
  },true);
}
document.addEventListener('click',e=>{const v=e.target.closest('[data-view]');if(v){e.preventDefault();viewDoc(v.dataset.view)}const g=e.target.closest('[data-go]');if(g)go(g.dataset.go)});
