/* OPENLY — backend en Google Apps Script. Base de datos: la hoja de cálculo a la que está vinculado. */
const T={
 Usuarios:['id','email','hash','salt','usuario','nombre','bio','foto','creado','codigo','codigo_exp'],
 Sesiones:['token','uid','creado'],
 Publicaciones:['id','uid','texto','imagen','fecha'],
 Likes:['pid','uid','fecha'],
 Comentarios:['id','pid','uid','texto','fecha'],
 Seguidores:['uid','seguido','fecha'],
 Notificaciones:['id','para','de','tipo','pid','fecha']
};
const DB=()=>SpreadsheetApp.getActive();
function setup(){ // ejecútala UNA vez
  const ss=DB();
  Object.keys(T).forEach(n=>{
    const s=ss.getSheetByName(n)||ss.insertSheet(n);
    if(s.getLastRow()==0){s.appendRow(T[n]);s.setFrozenRows(1);}
    s.getRange(1,1,s.getMaxRows(),T[n].length).setNumberFormat('@'); // todo texto: evita fórmulas inyectadas
  });
  const d=ss.getSheetByName('Hoja 1')||ss.getSheetByName('Sheet1'); if(d)ss.deleteSheet(d);
}
const rows=n=>{const v=DB().getSheetByName(n).getDataRange().getValues(),h=v.shift();return v.map(r=>{const o={};h.forEach((k,i)=>o[k]=r[i]===''?'':String(r[i]));return o;});};
const add=(n,o)=>DB().getSheetByName(n).appendRow(T[n].map(k=>o[k]===undefined?'':String(o[k])));
const each=(n,f)=>{const s=DB().getSheetByName(n),v=s.getDataRange().getValues(),h=v[0];for(let i=v.length-1;i>0;i--){const o={};h.forEach((k,j)=>o[k]=String(v[i][j]));f(o,s,i+1,h);}};
const rm=(n,p)=>each(n,(o,s,r)=>{if(p(o))s.deleteRow(r);});
const upd=(n,p,patch)=>each(n,(o,s,r,h)=>{if(p(o))Object.keys(patch).forEach(k=>s.getRange(r,h.indexOf(k)+1).setValue(String(patch[k])));});
const now=()=>Date.now(), uid=()=>Utilities.getUuid();
const sha=s=>Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
const pub=u=>({id:u.id,usuario:u.usuario,nombre:u.nombre||u.usuario,bio:u.bio||'',foto:u.foto||''});
const clean=(s,max)=>String(s||'').trim().slice(0,max);

function me(t){
  const s=rows('Sesiones').find(x=>x.token===String(t)&&now()-Number(x.creado)<30*864e5);
  const u=s&&rows('Usuarios').find(x=>x.id===s.uid);
  if(!u)throw 'Sesión expirada, inicia sesión de nuevo';
  return u;
}
function login(u){const token=uid()+uid();add('Sesiones',{token,uid:u.id,creado:now()});return {token,yo:pub(u)};}
function img(d){
  const m=/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(d||''); if(!m)return '';
  const it=DriveApp.getFoldersByName('OPENLY_img'); const fo=it.hasNext()?it.next():DriveApp.createFolder('OPENLY_img');
  const f=fo.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]),m[1],uid()));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
  return 'https://lh3.googleusercontent.com/d/'+f.getId();
}
const notify=(para,de,tipo,pid)=>{if(para!==de)add('Notificaciones',{id:uid(),para,de,tipo,pid:pid||'',fecha:now()});};
function posts(filter,u){
  const us={};rows('Usuarios').forEach(x=>us[x.id]=x);const L=rows('Likes'),C=rows('Comentarios');
  return rows('Publicaciones').filter(filter).sort((a,b)=>b.fecha-a.fecha).slice(0,50).map(p=>({
    id:p.id,texto:p.texto,imagen:p.imagen,fecha:Number(p.fecha),autor:pub(us[p.uid]||{}),
    likes:L.filter(l=>l.pid===p.id).length,mio:L.some(l=>l.pid===p.id&&l.uid===u.id),
    comentarios:C.filter(c=>c.pid===p.id).length,es_mio:p.uid===u.id}));
}
const byUser=n=>rows('Usuarios').find(x=>x.usuario===String(n||'').toLowerCase().replace('@',''));

const H={
 disponible:q=>!byUser(q.usuario)&&/^[a-z][a-z0-9_]{2,19}$/.test(String(q.usuario).toLowerCase()),
 registro:q=>{
  const email=clean(q.email,120).toLowerCase(),usuario=clean(q.usuario,20).toLowerCase().replace('@','');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw 'Correo inválido';
  if(String(q.pass||'').length<6)throw 'La contraseña debe tener mínimo 6 caracteres';
  if(!/^[a-z][a-z0-9_]{2,19}$/.test(usuario))throw 'Usuario: 3-20 caracteres, empieza con letra (a-z, 0-9, _)';
  if(rows('Usuarios').some(x=>x.email===email))throw 'Ese correo ya está registrado';
  if(byUser(usuario))throw 'Ese @usuario ya existe';
  const salt=uid(),u={id:uid(),email,salt,hash:sha(salt+q.pass),usuario,nombre:usuario,creado:now()};
  add('Usuarios',u);return login(u);
 },
 login:q=>{
  const u=rows('Usuarios').find(x=>x.email===clean(q.email,120).toLowerCase());
  if(!u||u.hash!==sha(u.salt+String(q.pass)))throw 'Correo o contraseña incorrectos';
  return login(u);
 },
 logout:q=>{rm('Sesiones',s=>s.token===String(q.token));return true;},
 recuperar:q=>{
  const u=rows('Usuarios').find(x=>x.email===clean(q.email,120).toLowerCase());
  if(u){const c=String(100000+Math.floor(Math.random()*900000));
   upd('Usuarios',x=>x.id===u.id,{codigo:sha(c),codigo_exp:now()+15*6e4});
   MailApp.sendEmail(u.email,'OPENLY — código para recuperar tu contraseña','Tu código es: '+c+'\nVence en 15 minutos.');}
  return true;
 },
 reset:q=>{
  const u=rows('Usuarios').find(x=>x.email===clean(q.email,120).toLowerCase());
  if(!u||!u.codigo||now()>Number(u.codigo_exp)||u.codigo!==sha(String(q.codigo).trim()))throw 'Código inválido o vencido';
  if(String(q.pass||'').length<6)throw 'La contraseña debe tener mínimo 6 caracteres';
  const salt=uid();upd('Usuarios',x=>x.id===u.id,{salt,hash:sha(salt+q.pass),codigo:'',codigo_exp:''});
  rm('Sesiones',s=>s.uid===u.id);return true;
 },
 yo:q=>pub(me(q.token)),
 perfil:q=>{
  const y=me(q.token),u=byUser(q.usuario);if(!u)throw 'Usuario no encontrado';
  const S=rows('Seguidores');
  return Object.assign(pub(u),{es_yo:u.id===y.id,seguidores:S.filter(s=>s.seguido===u.id).length,siguiendo:S.filter(s=>s.uid===u.id).length,yo_sigo:S.some(s=>s.uid===y.id&&s.seguido===u.id)});
 },
 editar:q=>{
  const y=me(q.token),p={nombre:clean(q.nombre,40)||y.usuario,bio:clean(q.bio,160)};
  if(q.foto)p.foto=img(q.foto);
  upd('Usuarios',x=>x.id===y.id,p);return pub(Object.assign(y,p));
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
 comentarios:q=>{
  me(q.token);const us={};rows('Usuarios').forEach(x=>us[x.id]=x);
  return rows('Comentarios').filter(c=>c.pid===q.pid).sort((a,b)=>a.fecha-b.fecha).map(c=>({id:c.id,texto:c.texto,fecha:Number(c.fecha),autor:pub(us[c.uid]||{})}));
 },
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
 buscar:q=>{
  const y=me(q.token),t=String(q.q||'').toLowerCase().replace('@',''),S=rows('Seguidores').filter(s=>s.uid===y.id).map(s=>s.seguido);
  return rows('Usuarios').filter(u=>u.id!==y.id&&(!t||u.usuario.indexOf(t)>-1||String(u.nombre).toLowerCase().indexOf(t)>-1)).slice(0,20).map(u=>Object.assign(pub(u),{yo_sigo:S.indexOf(u.id)>-1}));
 },
 notifs:q=>{
  const y=me(q.token),us={};rows('Usuarios').forEach(x=>us[x.id]=x);
  return rows('Notificaciones').filter(n=>n.para===y.id).sort((a,b)=>b.fecha-a.fecha).slice(0,40).map(n=>({tipo:n.tipo,pid:n.pid,fecha:Number(n.fecha),de:pub(us[n.de]||{})}));
 }
};
const out=o=>ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
function doGet(){return out({ok:true,d:'OPENLY API'});}
function doPost(e){
  const l=LockService.getScriptLock();l.waitLock(20000);
  try{const q=JSON.parse(e.postData.contents),f=H[q.a];if(!f)throw 'Acción inválida';return out({ok:true,d:f(q)});}
  catch(x){return out({ok:false,error:String(x&&x.message||x)});}
  finally{l.releaseLock();}
}
