// Camada de dados Supabase. Mantém o contrato dos painéis durante a migração.
import { supabase } from './supabase-config.js';
export const db = {}, storage = {}, functions = {};
export const auth = { currentUser: null };
const tables = {users:'perfis',site:'perfil_publico',config:'disponibilidade'};
const fields = {clienteUid:'cliente_id',estagiarioUid:'estagiario_id',liberadoParaEstagiario:'liberado_para_estagiario',criadoEm:'criado_em',role:'papel',diasSemana:'dias_semana',duracaoMin:'duracao_min',meetUrl:'meet_url'};
function check({data,error}) { if(error) throw error; return data; }
function user(u) { return u ? {...u,uid:u.id,displayName:u.user_metadata?.full_name || 'Cliente'} : null; }
export function onAuthStateChanged(_, callback, failure=console.error) {
  let active=true;
  const deliver=async()=>{
    try { const result=await supabase.auth.getUser(); if(result.error && (await supabase.auth.getSession()).data.session) throw result.error;
      auth.currentUser=user(result.data.user); if(active) await callback(auth.currentUser);
    } catch(e) { if(active) failure(e); }
  };
  const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>setTimeout(deliver,0));
  return ()=>{active=false;subscription.unsubscribe();};
}
export class GoogleAuthProvider {}
export async function signInWithPopup() { check(await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:new URL('index.html',location.href).href}})); }
export async function signOut() { check(await supabase.auth.signOut()); auth.currentUser=null; }
export const serverTimestamp=()=>new Date().toISOString();
export function collection(_,name) { return {table:tables[name]||name}; }
export function doc(source,name,id) { return source.table ? {...source,id:name||crypto.randomUUID()} : {...collection(null,name),id:['config','site'].includes(name)?true:id}; }
export const where=(key,op,value)=>{if(op!=='==')throw new Error('Filtro não suportado');return {key:fields[key]||key,value};};
export const query=(ref,...filters)=>({...ref,filters});
function unpack(row,table) {
  if(table==='perfil_publico')return row.dados;
  const value={...row}; for(const [legacy,key] of Object.entries(fields)) if(key in row)value[legacy]=row[key];
  if(row.criado_em)value.criadoEm={seconds:Date.parse(row.criado_em)/1000};
  if(row.documentos)value.arquivos=row.documentos;
  if(row.cliente)value.clienteNome=row.cliente.nome;
  return value;
}
function pack(data) { const value={}; for(const [key,v] of Object.entries(data)) {
  if(['clienteNome','clienteEmail','arquivos'].includes(key))continue;
  value[fields[key]||key]=v;
} return value; }
const snap=(row,table)=>({id:row?.id,exists:()=>!!row,data:()=>row?unpack(row,table):undefined});
function selection(table) {return table==='casos'?'*,documentos(*),cliente:perfis!casos_cliente_id_fkey(nome)':table==='agendamentos'?'*,cliente:perfis!agendamentos_cliente_id_fkey(nome)':'*';}
export async function getDoc(ref) {const data=check(await supabase.from(ref.table).select(selection(ref.table)).eq('id',ref.id).maybeSingle());return snap(data,ref.table);}
export async function getDocs(ref) {let q=supabase.from(ref.table).select(selection(ref.table));for(const f of ref.filters||[])q=q.eq(f.key,f.value);return {docs:check(await q).map(row=>snap(row,ref.table))};}
export async function setDoc(ref,data,options={}) {
  if(ref.table==='perfis')throw new Error('Perfis são criados pelo servidor. Entre novamente.');
  if(ref.table==='perfil_publico') {
    const old=options.merge?await getDoc(ref):null;
    check(await supabase.from(ref.table).upsert({id:true,dados:{...(old?.data()||{}),...data}}));return;
  }
  const value={id:ref.id,...pack(data)};
  check(await (ref.table==='disponibilidade'?supabase.from(ref.table).upsert(value):supabase.from(ref.table).insert(value)));
}
export async function addDoc(ref,data) {const item=doc(ref);await setDoc(item,data);return item;}
export async function updateDoc(ref,data) {
  if(ref.table==='casos' && data.arquivos) {
    if(data.arquivos.length)check(await supabase.from('documentos').insert(data.arquivos.map(a=>({...a,caso_id:ref.id}))));
    check(await supabase.rpc('finalizar_caso',{p_caso:ref.id}));return;
  }
  const rows=check(await supabase.from(ref.table).update(pack(data)).eq('id',ref.id).select('*'));
  if(!rows.length)throw new Error('Registro indisponível ou acesso negado.');
  return unpack(rows[0],ref.table);
}
export async function deleteDoc(ref) {const rows=check(await supabase.from(ref.table).delete().eq('id',ref.id).select('id'));if(!rows.length)throw new Error('Acesso negado.');}
export const ref=(_,path)=>({path,bucket:path.startsWith('site/')?'institucional':'documentos'});
export async function uploadBytes(target,file) {check(await supabase.storage.from(target.bucket).upload(target.path,file,{contentType:file.type,upsert:target.bucket==='institucional'}));}
export async function getDownloadURL(target) {
  if(target.bucket==='institucional')return supabase.storage.from(target.bucket).getPublicUrl(target.path).data.publicUrl;
  return check(await supabase.storage.from(target.bucket).createSignedUrl(target.path,60)).signedUrl;
}
export async function abrirDocumento(target) {
  // Abrir durante o clique; depois do await o navegador pode bloquear a janela.
  const janela = window.open('about:blank', '_blank');
  if (!janela) throw new Error('Permita abrir uma nova aba para visualizar o documento.');
  janela.opener = null;
  try { janela.location.replace(await getDownloadURL(target)); }
  catch (erro) { janela.close(); throw erro; }
}
export function httpsCallable(_,name) {return async(args)=>{
  let data;
  if(name==='listarHorarios')data={horarios:check(await supabase.rpc('listar_horarios')).map(r=>Date.parse(r.inicio))};
  else if(name==='criarAgendamento') {
    const result=await supabase.rpc('reservar_horario',{p_inicio:new Date(args.inicioMs).toISOString()});
    if(['23505','23P01'].includes(result.error?.code) || result.error?.message==='Horário indisponível')throw Object.assign(new Error('Horário reservado'),{code:'already-exists'});
    data=check(result);
  } else if(name==='cancelarMeuAgendamento')data=check(await supabase.rpc('cancelar_agendamento',{p_id:args.id}));
  else if(name==='atualizarAgendamento')await updateDoc({table:'agendamentos',id:args.id},{status:args.acao==='confirmar'?'confirmado':'cancelado',meetUrl:args.meetUrl||null});
  else throw new Error('Operação desconhecida');
  return {data};
};}
