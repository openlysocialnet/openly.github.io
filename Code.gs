/* OPENLY — backend optimizado. Mismo esquema de hojas: los datos existentes no se tocan. */
const T={
 Usuarios:['id','email','hash','salt','usuario','nombre','bio','foto','creado','codigo','codigo_exp'],
 Sesiones:['token','uid','creado'],
 Publicaciones:['id','uid','texto','imagen','fecha'],
 Likes:['pid','uid','fecha'],
 Comentarios:['id','pid','uid','texto','fecha'],
 Seguidores:['uid','seguido','fecha'],
 Notificaciones:['id','para','de','tipo','pid','fecha']
};
const SS=SpreadsheetApp.getActive(),C=CacheService.getScriptCache(),M={};
function setup(){ // opcional: solo crea lo que falte, no borra nada
  Object.keys(T).forEach(n=>{
    const s=SS.getSheetByName(n)||SS.insertSheet(n);
    if(s.getLastRow()==0){s.appendRow(T[n]);s.setFrozenRows(1);}
    s.getRange(1,1,s.getMaxRows(),T[n].length).setNumberFormat('@');
  });
}
/* ---- lectura con caché (10 min) + memo por ejecución. En escrituras (M.F) siempre lee la hoja ---- */
function rows(n){
  if(M[n])return M[n];
  const k='T_'+n;
  if(!M.F&&n!=='Sesiones'){const c=C.get(k);if(c)return M[n]=JSON.parse(c);}
  const v=SS.getSheetByName(n).getDataRange().getValues(),h=v.shift();
  const r=v.map(a=>{const o={};h.forEach((x,i)=>o[x]=a[i]===''?'':String(a[i]));return o;});
  if(n!=='Sesiones')try{C.put(k,JSON.stringify(r),600);}catch(e){}
  return M[n]=r;
}
const dirty=n=>{delete M[n];if(n==='Usuarios')delete M.UM;C.remove('T_'+n);};
const add=(n,o)=>{SS.getSheetByName(n).appendRow(T[n].map(k=>o[k]===undefined?'':String(o[k])));dirty(n);};
function rm(n,p){
  const s=SS.getSheetByName(n),R=[];rows(n).forEach((o,i)=>{if(p(o))R.push(i+2);});
  R.reverse().forEach(r=>s.deleteRow(r));if(R.length)dirty(n);
}
function upd(n,p,patch){
  const s=SS.getSheetByName(n),h=T[n];
  rows(n).forEach((o,i)=>{if(p(o))Object.keys(patch).forEach(k=>s.getRange(i+2,h.indexOf(k)+1).setValue(String(patch[k])));});
  dirty(n);
}
const now=()=>Date.now(), uid=()=>Utilities.getUuid();
const sha=s=>Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
const pub=u=>({id:u.id,usuario:u.usuario,nombre:u.nombre||u.usuario,bio:u.bio||'',foto:u.foto||''});
const clean=(s,max)=>String(s||'').trim().slice(0,max);
const UM=()=>M.UM||(M.UM=Object.fromEntries(rows('Usuarios').map(u=>[u.id,u])));
const byUser=n=>{const t=String(n||'').toLowerCase().replace('@','');return rows('Usuarios').find(x=>x.usuario===t);};
const byMail=e=>rows('Usuarios').find(x=>x.email===clean(e,120).toLowerCase());

/* ---- sesiones: caché + búsqueda directa (sin leer toda la hoja) ---- */
function me(t){
  t=String(t||'');let id=C.get('S_'+t);
  if(!id&&t){
    const s=SS.getSheetByName('Sesiones'),f=s.createTextFinder(t).matchEntireCell(true).findNext();
    if(f&&f.getColumn()==1){const r=s.getRange(f.getRow(),1,1,3).getValues()[0];
      if(now()-Number(r[2])<30*864e5){id=String(r[1]);C.put('S_'+t,id,21600);}}
  }
  const u=id&&UM()[id];
  if(!u)throw 'Sesión expirada, inicia sesión de nuevo';
  return u;
}
function login(u){
  const token=uid()+uid();add('Sesiones',{token,uid:u.id,creado:now()});C.put('S_'+token,u.id,21600);
  if(Math.random()<.05)rm('Sesiones',s=>now()-Number(s.creado)>30*864e5); // limpieza ocasional
  return {token,yo:pub(u)};
}
function img(d){
  const m=/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(d||''); if(!m)return '';
  const P=PropertiesService.getScriptProperties();let id=P.getProperty('FOLDER'),fo;
  try{fo=id&&DriveApp.getFolderById(id);}catch(e){}
  if(!fo){const it=DriveApp.getFoldersByName('OPENLY_img');fo=it.hasNext()?it.next():DriveApp.createFolder('OPENLY_img');P.setProperty('FOLDER',fo.getId());}
  const f=fo.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]),m[1],uid()));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
  return 'https://lh3.googleusercontent.com/d/'+f.getId();
}
const notify=(para,de,tipo,pid)=>{if(para!==de)add('Notificaciones',{id:uid(),para,de,tipo,pid:pid||'',fecha:now()});};

/* ---- publicaciones: conteos en O(n) con mapas ---- */
function posts(filter,u){
  const us=UM(),L={},mine={},K={};
  rows('Likes').forEach(l=>{L[l.pid]=(L[l.pid]||0)+1;if(l.uid===u.id)mine[l.pid]=1;});
  rows('Comentarios').forEach(c=>{K[c.pid]=(K[c.pid]||0)+1;});
  return rows('Publicaciones').filter(filter).sort((a,b)=>b.fecha-a.fecha).slice(0,50).map(p=>({
    id:p.id,texto:p.texto,imagen:p.imagen,fecha:Number(p.fecha),autor:pub(us[p.uid]||{}),
    likes:L[p.id]||0,mio:!!mine[p.id],comentarios:K[p.id]||0,es_mio:p.uid===u.id}));
}
function people(y,q){
  const t=String(q||'').toLowerCase().replace('@',''),S=new Set(rows('Seguidores').filter(s=>s.uid===y.id).map(s=>s.seguido));
  return rows('Usuarios').filter(u=>u.id!==y.id&&(!t||u.usuario.indexOf(t)>-1||String(u.nombre).toLowerCase().indexOf(t)>-1)).slice(0,20).map(u=>Object.assign(pub(u),{yo_sigo:S.has(u.id)}));
}
function coms(pid){
  const us=UM();
  return rows('Comentarios').filter(c=>c.pid===pid).sort((a,b)=>a.fecha-b.fecha).map(c=>({id:c.id,texto:c.texto,fecha:Number(c.fecha),autor:pub(us[c.uid]||{})}));
}

const H={
 disponible:q=>!byUser(q.usuario)&&/^[a-z][a-z0-9_]{2,19}$/.test(String(q.usuario).toLowerCase()),
 registro:q=>{
  const email=clean(q.email,120).toLowerCase(),usuario=clean(q.usuario,20).toLowerCase().replace('@','');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw 'Correo inválido';
  if(String(q.pass||'').length<6)throw 'La contraseña debe tener mínimo 6 caracteres';
  if(!/^[a-z][a-z0-9_]{2,19}$/.test(usuario))throw 'Usuario: 3-20 caracteres, empieza con letra (a-z, 0-9, _)';
  if(byMail(email))throw 'Ese correo ya está registrado';
  if(byUser(usuario))throw 'Ese @usuario ya existe';
  const salt=uid(),u={id:uid(),email,salt,hash:sha(salt+q.pass),usuario,nombre:usuario,creado:now()};
  add('Usuarios',u);return login(u);
 },
 login:q=>{
  const u=byMail(q.email);
  if(!u||u.hash!==sha(u.salt+String(q.pass)))throw 'Correo o contraseña incorrectos';
  return login(u);
 },
 logout:q=>{C.remove('S_'+String(q.token));rm('Sesiones',s=>s.token===String(q.token));return true;},
 recuperar:q=>{
  const u=byMail(q.email);
  if(u){const c=String(100000+Math.floor(Math.random()*900000));
   upd('Usuarios',x=>x.id===u.id,{codigo:sha(c),codigo_exp:now()+15*6e4});
   MailApp.sendEmail(u.email,'OPENLY — código para recuperar tu contraseña','Tu código es: '+c+'\nVence en 15 minutos.');}
  return true;
 },
 reset:q=>{
  const u=byMail(q.email);
  if(!u||!u.codigo||now()>Number(u.codigo_exp)||u.codigo!==sha(String(q.codigo).trim()))throw 'Código inválido o vencido';
  if(String(q.pass||'').length<6)throw 'La contraseña debe tener mínimo 6 caracteres';
  const salt=uid();upd('Usuarios',x=>x.id===u.id,{salt,hash:sha(salt+q.pass),codigo:'',codigo_exp:''});
  const ss=rows('Sesiones').filter(s=>s.uid===u.id);C.removeAll(ss.map(s=>'S_'+s.token));rm('Sesiones',s=>s.uid===u.id);return true;
 },
 yo:q=>pub(me(q.token)),
 /* una sola llamada al abrir la app: yo + feed + sugerencias */
 inicio:q=>{const y=me(q.token);return {yo:pub(y),feed:posts(()=>true,y),sug:people(y,'').filter(u=>!u.yo_sigo).slice(0,5)};},
 /* perfil + publicaciones en una llamada */
 perfil:q=>{
  const y=me(q.token),u=byUser(q.usuario);if(!u)throw 'Usuario no encontrado';
  const S=rows('Seguidores');
  return Object.assign(pub(u),{es_yo:u.id===y.id,seguidores:S.filter(s=>s.seguido===u.id).length,siguiendo:S.filter(s=>s.uid===u.id).length,yo_sigo:S.some(s=>s.uid===y.id&&s.seguido===u.id),posts:posts(p=>p.uid===u.id,y)});
 },
 /* publicación + comentarios en una llamada */
 detalle:q=>{const y=me(q.token);return {p:posts(p=>p.id===q.pid,y)[0]||null,c:coms(q.pid)};},
 editar:q=>{
  const y=me(q.token),p={nombre:clean(q.nombre,40)||y.usuario,bio:clean(q.bio,160)};
  if(q.foto)p.foto=img(q.foto);
  upd('Usuarios',x=>x.id===y.id,p);return pub(Object.assign({},y,p));
 },
 feed:q=>{
  const y=me(q.token);
  if(q.pid)return posts(p=>p.id===q.pid,y);
  if(q.usuario){const u=byUser(q.usuario);return posts(p=>u&&p.uid===u.id,y);}
  if(q.tab==='siguiendo'){const f=rows('Seguidores').filter(s=>s.uid===y.id).map(s=>s.seguido);return posts(p=>f.indexOf(p.uid)>-1,y);}
  return posts(()=>true,y);
 },
 publicar:q=>{
  const y=me(q.token),texto=clean(q.texto,280),imagen=img(q.imagen);
  if(!texto&&!imagen)throw 'Escribe algo o adjunta una imagen';
  add('Publicaciones',{id:uid(),uid:y.id,texto,imagen,fecha:now()});return true;
 },
 eliminar:q=>{
  const y=me(q.token);
  if(!rows('Publicaciones').some(p=>p.id===q.pid&&p.uid===y.id))throw 'No puedes eliminar esta publicación';
  rm('Publicaciones',p=>p.id===q.pid);rm('Likes',l=>l.pid===q.pid);rm('Comentarios',c=>c.pid===q.pid);rm('Notificaciones',n=>n.pid===q.pid);return true;
 },
 like:q=>{
  const y=me(q.token),p=rows('Publicaciones').find(x=>x.id===q.pid);if(!p)throw 'Publicación no encontrada';
  if(rows('Likes').some(l=>l.pid===p.id&&l.uid===y.id)){rm('Likes',l=>l.pid===p.id&&l.uid===y.id);return false;}
  add('Likes',{pid:p.id,uid:y.id,fecha:now()});notify(p.uid,y.id,'like',p.id);return true;
 },
 comentarios:q=>{me(q.token);return coms(q.pid);},
 comentar:q=>{
  const y=me(q.token),p=rows('Publicaciones').find(x=>x.id===q.pid),t=clean(q.texto,280);
  if(!p||!t)throw 'Comentario vacío';
  add('Comentarios',{id:uid(),pid:p.id,uid:y.id,texto:t,fecha:now()});notify(p.uid,y.id,'comment',p.id);return true;
 },
 seguir:q=>{
  const y=me(q.token),u=byUser(q.usuario);if(!u||u.id===y.id)throw 'Usuario inválido';
  if(rows('Seguidores').some(s=>s.uid===y.id&&s.seguido===u.id)){rm('Seguidores',s=>s.uid===y.id&&s.seguido===u.id);return false;}
  add('Seguidores',{uid:y.id,seguido:u.id,fecha:now()});notify(u.id,y.id,'follow','');return true;
 },
 buscar:q=>people(me(q.token),q.q),
 notifs:q=>{
  const y=me(q.token),us=UM();
  return rows('Notificaciones').filter(n=>n.para===y.id).sort((a,b)=>b.fecha-a.fecha).slice(0,40).map(n=>({tipo:n.tipo,pid:n.pid,fecha:Number(n.fecha),de:pub(us[n.de]||{})}));
 }
};
const out=o=>ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const W={registro:1,login:1,logout:1,recuperar:1,reset:1,editar:1,publicar:1,eliminar:1,like:1,comentar:1,seguir:1};
function doGet(){return out({ok:true,d:'OPENLY API'});}
function doPost(e){
  let l;
  try{
    const q=JSON.parse(e.postData.contents),f=H[q.a];if(!f)throw 'Acción inválida';
    if(W[q.a]){M.F=1;l=LockService.getScriptLock();l.waitLock(20000);} // lock SOLO en escrituras; lecturas en paralelo
    return out({ok:true,d:f(q)});
  }catch(x){return out({ok:false,error:String(x&&x.message||x)});}
  finally{if(l)l.releaseLock();}
}
