const ICONS={home:'<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',plus:'<rect x="3" y="3" width="18" height="18" rx="6"/><path d="M12 8v8M8 12h8"/>',bell:'<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 8H4c0-1 2-2 2-8zM10 21h4"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',heart:'<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',chat:'<path d="M4 5h16v11H9l-5 4z"/>',back:'<path d="M15 5l-7 7 7 7"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>',img:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.5"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',refresh:'<path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/>',trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'};
const svg=(n,s=24)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
document.querySelectorAll('i[data-i]').forEach(e=>e.outerHTML=svg(e.dataset.i,e.closest('.nav')?26:24));

const $=id=>document.getElementById(id), API=window.OPENLY_API_URL;
const S={token:localStorage.getItem('ol_token'),me:null,pid:null,img:'',foto:''};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ago=t=>{const s=(Date.now()-t)/1e3;return s<60?'ahora':s<3600?Math.floor(s/60)+' min':s<86400?Math.floor(s/3600)+' h':Math.floor(s/86400)+' d'};
async function api(a,d={}){
  if(!API||API.startsWith('PEGA'))throw new Error('Falta la URL de Apps Script en config.js');
  const r=await fetch(API,{method:'POST',body:JSON.stringify({a,token:S.token,...d})}),j=await r.json();
  if(!j.ok)throw new Error(j.error);return j.d;
}
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),2800)}
const run=async(f,b)=>{try{if(b)b.disabled=true;await f()}catch(e){toast(e.message||'Error de conexión')}finally{if(b)b.disabled=false}};
const shrink=(f,m=1000)=>new Promise((ok,no)=>{const i=new Image,u=URL.createObjectURL(f);i.onload=()=>{const k=Math.min(1,m/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);URL.revokeObjectURL(u);ok(c.toDataURL('image/jpeg',.8))};i.onerror=()=>no(new Error('Imagen inválida'));i.src=u});

const av=(u,c='')=>`<div class="av ${c}" data-user="${esc(u.usuario)}" ${u.foto?`style="background-image:url('${esc(u.foto)}')"`:''}>${u.foto?'':esc((u.nombre||u.usuario||'?').slice(0,2).toUpperCase())}</div>`;
const post=p=>`<article class="p" data-pid="${p.id}">${av(p.autor)}<div class="pc"><div class="pn"><b data-user="${esc(p.autor.usuario)}">${esc(p.autor.nombre)}</b><span class="m">@${esc(p.autor.usuario)} · ${ago(p.fecha)}</span>${p.es_mio?`<button class="del" aria-label="Eliminar">${svg('trash',18)}</button>`:''}</div><div class="tx" data-open>${esc(p.texto)}</div>${p.imagen?`<img class="img" src="${esc(p.imagen)}" alt="" data-open>`:''}<div class="ac"><button class="like${p.mio?' on':''}">${svg('heart',19)}<span>${p.likes}</span></button><button data-open>${svg('chat',19)} ${p.comentarios}</button></div></div></article>`;
const list=(a,empty)=>a.length?a.join(''):`<p class="m c e">${empty}</p>`;

const AUTH=['registro','login','recuperar'],SUB=['publicar','detalle','editar','ajustes'];
const chip=()=>{const c=$('chip');c.dataset.user=S.me.usuario;c.innerHTML=av(S.me)+`<div><b>${esc(S.me.nombre)}</b><span class="m">@${esc(S.me.usuario)}</span></div>`};
const suggest=()=>api('buscar',{q:''}).then(r=>{$('sug').innerHTML=r.filter(u=>!u.yo_sigo).slice(0,5).map(u=>`<div class="row2">${av(u)}<div class="grow"><b data-user="${esc(u.usuario)}">${esc(u.nombre)}</b><span class="m">@${esc(u.usuario)}</span></div><button class="pill follow" data-u="${esc(u.usuario)}">Seguir</button></div>`).join('')||'<p class="m e">Ya sigues a todos por ahora.</p>'}).catch(()=>0);
function go(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on',s.id===id));
  document.body.classList.toggle('auth',AUTH.includes(id));document.body.classList.toggle('sub',SUB.includes(id));
  document.querySelectorAll('[data-n]').forEach(b=>b.classList.toggle('on',b.dataset.go===id));
  if(S.me&&!AUTH.includes(id))chip();
  const h={feed:()=>{suggest();return loadFeed()},buscar:()=>buscar(),notificaciones:loadNotifs,publicar:()=>{$('pubAv').innerHTML=av(S.me)}}[id];
  if(h)run(h);
}
function start(d){S.token=d.token;localStorage.setItem('ol_token',d.token);S.me=d.yo;go('feed')}
async function loadFeed(){$('feedList').innerHTML=list((await api('feed')).map(post),'Aún no hay publicaciones')}
async function openPerfil(usuario){
  go('perfil');const u=await api('perfil',{usuario});
  $('pAv').innerHTML=av(u,'big');$('pNom').textContent=u.nombre;$('pUsr').textContent='@'+u.usuario;$('pBio').textContent=u.bio;
  $('pSt').innerHTML=`<b>${u.siguiendo}</b> <span class="m">siguiendo</span> &nbsp; <b>${u.seguidores}</b> <span class="m">seguidores</span>`;
  const b=$('pBtn');b.dataset.u=u.usuario;b.dataset.me=u.es_yo?1:'';b.className='pill'+(u.es_yo||u.yo_sigo?' o':'');b.textContent=u.es_yo?'Editar perfil':u.yo_sigo?'Siguiendo':'Seguir';
  $('mine').innerHTML=list((await api('feed',{usuario})).map(post),'Sin publicaciones todavía');
}
async function openDetalle(pid){
  S.pid=pid;go('detalle');const [p,c]=await Promise.all([api('feed',{pid}),api('comentarios',{pid})]);
  $('detalleList').innerHTML=(p[0]?post(p[0]):'')+c.map(x=>`<div class="p">${av(x.autor)}<div class="pc"><div class="pn"><b data-user="${esc(x.autor.usuario)}">${esc(x.autor.nombre)}</b><span class="m">@${esc(x.autor.usuario)} · ${ago(x.fecha)}</span></div><div class="tx">${esc(x.texto)}</div></div></div>`).join('');
}
async function buscar(){
  const r=await api('buscar',{q:$('qIn').value});
  $('people').innerHTML=list(r.map(u=>`<div class="row2">${av(u)}<div class="grow"><b data-user="${esc(u.usuario)}">${esc(u.nombre)}</b><span class="m">@${esc(u.usuario)}</span></div><button class="pill follow${u.yo_sigo?' o':''}" data-u="${esc(u.usuario)}">${u.yo_sigo?'Siguiendo':'Seguir'}</button></div>`),'Sin resultados');
}
async function loadNotifs(){
  const T={like:'le gustó tu publicación',comment:'comentó tu publicación',follow:'empezó a seguirte'};
  $('notifs').innerHTML=list((await api('notifs')).map(n=>`<div class="n" ${n.pid?`data-pid="${n.pid}" data-open`:`data-user="${esc(n.de.usuario)}"`}>${svg(n.tipo==='follow'?'user':n.tipo==='like'?'heart':'chat',22)}${av(n.de)}<div><b>${esc(n.de.nombre)}</b> ${T[n.tipo]||''}<div class="m">${ago(n.fecha)}</div></div></div>`),'Aún no tienes notificaciones');
}
function openEditar(){go('editar');S.foto='';$('eAv').innerHTML=av(S.me,'big');$('eNom').value=S.me.nombre;$('eBio').value=S.me.bio||''}

document.addEventListener('click',e=>{
  const t=e.target,q=s=>t.closest(s);
  let el;if(t.closest('a[href="#"]'))e.preventDefault();
  if(el=q('[data-act]')){const a=el.dataset.act;if(a==='editar')openEditar();if(a==='logout')run(async()=>{await api('logout').catch(()=>0);localStorage.removeItem('ol_token');S.token=S.me=null;go('login')});return}
  if(el=q('[data-go]')){const g=el.dataset.go;g==='perfil'?run(()=>openPerfil(S.me.usuario)):go(g);return}
  if(el=q('#pBtn')){if(el.dataset.me)return openEditar();run(async()=>{const s=await api('seguir',{usuario:el.dataset.u});el.textContent=s?'Siguiendo':'Seguir';el.classList.toggle('o',s)});return}
  if(el=q('.follow')){run(async()=>{const s=await api('seguir',{usuario:el.dataset.u});el.textContent=s?'Siguiendo':'Seguir';el.classList.toggle('o',s)});return}
  if(el=q('.like')){const sp=el.querySelector('span'),on=!el.classList.contains('on');el.classList.toggle('on',on);sp.textContent=+sp.textContent+(on?1:-1);
    run(async()=>{try{await api('like',{pid:q('[data-pid]').dataset.pid})}catch(x){el.classList.toggle('on',!on);sp.textContent=+sp.textContent+(on?-1:1);throw x}});return}
  if(el=q('.del')){if(confirm('¿Eliminar esta publicación?'))run(async()=>{await api('eliminar',{pid:q('[data-pid]').dataset.pid});S.pid&&$('detalle').classList.contains('on')?go('feed'):q('[data-pid]').remove()});return}
  if(el=q('[data-user]')){run(()=>openPerfil(el.dataset.user));return}
  if(el=q('[data-open]')){const p=q('[data-pid]');if(p&&!($('detalle').classList.contains('on')))run(()=>openDetalle(p.dataset.pid));return}
});
$('bRef').onclick=()=>run(loadFeed);
let tm;$('rU').oninput=e=>{clearTimeout(tm);const v=e.target.value;tm=setTimeout(()=>{if(v.length<3){$('rOk').textContent='';return}api('disponible',{usuario:v}).then(ok=>$('rOk').textContent=ok?'@'+v.toLowerCase().replace('@','')+' disponible':'No disponible').catch(()=>0)},400)};
$('bReg').onclick=e=>run(async()=>start(await api('registro',{email:$('rE').value,pass:$('rP').value,usuario:$('rU').value})),e.currentTarget);
$('bLog').onclick=e=>run(async()=>start(await api('login',{email:$('lE').value,pass:$('lP').value})),e.currentTarget);
$('bCode').onclick=e=>run(async()=>{await api('recuperar',{email:$('cE').value});toast('Si el correo existe, te enviamos un código')},e.currentTarget);
$('bReset').onclick=e=>run(async()=>{await api('reset',{email:$('cE').value,codigo:$('cC').value,pass:$('cP').value});toast('Contraseña actualizada');go('login')},e.currentTarget);
$('pTxt').oninput=e=>$('pCnt').textContent=e.target.value.length+' / 280';
$('bImg').onclick=()=>$('pFile').click();
$('pFile').onchange=e=>run(async()=>{const f=e.target.files[0];if(!f)return;S.img=await shrink(f);$('pPrev').innerHTML=`<img class="img" src="${S.img}" alt="">`});
$('bPub').onclick=e=>run(async()=>{await api('publicar',{texto:$('pTxt').value,imagen:S.img});$('pTxt').value='';$('pCnt').textContent='0 / 280';$('pPrev').innerHTML='';S.img='';go('feed')},e.currentTarget);
$('bCom').onclick=e=>run(async()=>{const v=$('cTxt').value;if(!v.trim())return;await api('comentar',{pid:S.pid,texto:v});$('cTxt').value='';await openDetalle(S.pid)},e.currentTarget);
let tq;$('qIn').oninput=()=>{clearTimeout(tq);tq=setTimeout(()=>run(buscar),350)};
$('bFoto').onclick=()=>$('eFile').click();
$('eFile').onchange=e=>run(async()=>{const f=e.target.files[0];if(!f)return;S.foto=await shrink(f,400);$('eAv').innerHTML=av({...S.me,foto:S.foto},'big')});
$('bSave').onclick=e=>run(async()=>{S.me=await api('editar',{nombre:$('eNom').value,bio:$('eBio').value,foto:S.foto});await openPerfil(S.me.usuario)},e.currentTarget);

(async()=>{if(!S.token)return go('registro');try{S.me=await api('yo');go('feed')}catch(x){localStorage.removeItem('ol_token');go('login');if(!/Falta la URL/.test(x.message))return;toast(x.message)}})();

let tr;$('rq').oninput=e=>{clearTimeout(tr);tr=setTimeout(()=>{if(!e.target.value.trim())return;$('qIn').value=e.target.value;go('buscar')},400)};
const ENT={lE:'bLog',lP:'bLog',rE:'bReg',rP:'bReg',rU:'bReg',cC:'bReset',cP:'bReset',cTxt:'bCom'};
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&ENT[e.target.id]){e.preventDefault();$(ENT[e.target.id]).click()}});
