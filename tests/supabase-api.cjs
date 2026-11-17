// Integração real. Exige quatro contas QA descartáveis criadas no ambiente de teste.
// Nenhum token é escrito em disco ou exibido. Não executar contra produção.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const base='https://tqhannrxpdubfmhcclyo.supabase.co';
const key='sb_publishable_UiFJpD8r3EbmSZgDp7y0TQ_h0yaxKBO';
const ids=[1,2,3,4].map(n=>`a1712026-0000-4000-8000-00000000000${n}`);
const tokens=[];
async function api(path,{who,method='GET',body,raw=false,mime='text/plain'}={}) {
 const headers={apikey:key}; if(who!==undefined)headers.Authorization='Bearer '+tokens[who];
 if(body!==undefined)headers['Content-Type']=raw?mime:'application/json';
 const r=await fetch(base+path,{method,headers,body:body===undefined?undefined:raw?body:JSON.stringify(body)});
 const text=await r.text();let data;try{data=JSON.parse(text);}catch{data=text;}
 return {ok:r.ok,status:r.status,data};
}
function ok(r,label){assert(r.ok,label+': '+JSON.stringify(r.data));return r.data;}
const rpc=(name,body,who)=>api('/rest/v1/rpc/'+name,{method:'POST',body,who});
const marker='qa-api-171';
const caso=randomUUID();const path=`casos/${ids[0]}/${caso}/${marker}.txt`;
let uploaded=false,oldAvailability,originalProfile,profileChanged=false,photoUploaded=false;
(async()=>{
 assert(process.env.QA_PASSWORD,'Configure QA_PASSWORD com a senha temporária.');
 for(let i=0;i<4;i++)tokens[i]=ok(await api('/auth/v1/token?grant_type=password',{method:'POST',body:{email:`qa-171-${i+1}@example.invalid`,password:process.env.QA_PASSWORD}}),'Login QA').access_token;
 console.log('PASS: autenticação das quatro sessões independentes');
 const profile=ok(await api('/rest/v1/perfil_publico?select=*',{who:3}),'Ler conteúdo')[0];
 assert(profile?.dados?.areas?.length,'Conteúdo institucional inicial ausente');
 originalProfile=profile.dados;
 const edited={...profile.dados,areas:[...profile.dados.areas,{titulo:'QA temporário',descricao:marker}]};
 ok(await api('/rest/v1/perfil_publico?id=eq.true',{who:3,method:'PATCH',body:{dados:edited}}),'Adicionar área');profileChanged=true;
 assert.deepEqual(ok(await api('/rest/v1/perfil_publico?select=*'),'Nova leitura da área')[0].dados,edited);
 ok(await api('/rest/v1/perfil_publico?id=eq.true',{who:3,method:'PATCH',body:{dados:profile.dados}}),'Salvar conteúdo');
 profileChanged=false;
 assert.deepEqual(ok(await api('/rest/v1/perfil_publico?select=*'),'Recarregar conteúdo')[0].dados,profile.dados);
 const denied=await api('/rest/v1/perfil_publico?id=eq.true',{who:0,method:'PATCH',body:{dados:{resumo:'INDEVIDO'}}});
 assert.deepEqual(ok(await api('/rest/v1/perfil_publico?select=*'),'Conteúdo protegido')[0].dados,profile.dados);
 console.log('PASS: conteúdo persistido e protegido contra edição por cliente');
 const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 ok(await api('/storage/v1/object/institucional/site/qa-api-171.png',{who:3,method:'POST',body:pixel,raw:true,mime:'image/png'}),'Foto institucional');photoUploaded=true;
 const photo=await fetch(base+'/storage/v1/object/public/institucional/site/qa-api-171.png');assert(photo.ok);assert.deepEqual(Buffer.from(await photo.arrayBuffer()),pixel);
 assert(!(await api('/storage/v1/object/institucional/site/qa-proibido.png',{who:0,method:'POST',body:pixel,raw:true,mime:'image/png'})).ok,'Cliente alterou fotos institucionais');
 console.log('PASS: foto persistida, leitura pública e edição restrita');
 ok(await api('/rest/v1/casos',{who:0,method:'POST',body:{id:caso,cliente_id:ids[0],assunto:marker,resumo:'Documento fictício de integração, sem dados pessoais.',status:'uploading'}}),'Criar caso');
 ok(await api('/storage/v1/object/documentos/'+path,{who:0,method:'POST',body:marker,raw:true}),'Upload privado');uploaded=true;
 ok(await api('/rest/v1/documentos',{who:0,method:'POST',body:{caso_id:caso,caminho:path,nome:'teste.txt',tipo:'text/plain',tamanho:marker.length}}),'Metadados documento');
 ok(await rpc('finalizar_caso',{p_caso:caso},0),'Finalizar caso');
 assert.equal(ok(await api('/rest/v1/casos?id=eq.'+caso+'&select=*,documentos(*)',{who:0}),'Ler caso')[0].documentos.length,1);
 assert.equal(ok(await api('/rest/v1/casos?id=eq.'+caso,{who:1}),'Cliente alheio').length,0);
 for(const who of [undefined,1,2])assert(!(await api('/storage/v1/object/sign/documentos/'+path,{who,method:'POST',body:{expiresIn:60}})).ok,'Download não autorizado');
 for(const who of [0,3]){
 const signed=ok(await api('/storage/v1/object/sign/documentos/'+path,{who,method:'POST',body:{expiresIn:60}}),'URL privada');
 const response=await fetch(base+'/storage/v1'+signed.signedURL);assert.equal(await response.text(),marker);
 }
 ok(await api('/rest/v1/casos?id=eq.'+caso,{who:3,method:'PATCH',body:{estagiario_id:ids[2],liberado_para_estagiario:true}}),'Atribuir caso');
 ok(await api('/storage/v1/object/sign/documentos/'+path,{who:2,method:'POST',body:{expiresIn:60}}),'Estagiário autorizado');
 ok(await api('/rest/v1/casos?id=eq.'+caso,{who:3,method:'PATCH',body:{liberado_para_estagiario:false}}),'Revogar caso');
 assert(!(await api('/storage/v1/object/sign/documentos/'+path,{who:2,method:'POST',body:{expiresIn:60}})).ok,'Revogação do download');
 console.log('PASS: upload, metadados, download íntegro, isolamento e revogação');
 oldAvailability=ok(await api('/rest/v1/disponibilidade?select=*',{who:3}),'Ler agenda');
 if(!oldAvailability.length)ok(await api('/rest/v1/disponibilidade',{who:3,method:'POST',body:{id:true,dias_semana:[0,1,2,3,4,5,6],inicio:'09:00',fim:'17:00',duracao_min:30}}),'Configurar agenda QA');
 const slots=ok(await rpc('listar_horarios',{},0),'Listar horários');assert(slots.length);
 const inicio=slots[slots.length-1].inicio;
 const results=await Promise.all([rpc('reservar_horario',{p_inicio:inicio},0),rpc('reservar_horario',{p_inicio:inicio},1)]);
 assert.equal(results.filter(r=>r.ok).length,1,JSON.stringify(results));
 assert.equal(ok(await api('/rest/v1/agendamentos?status=neq.cancelado&inicio=eq.'+encodeURIComponent(inicio),{who:3}),'Consultar disputa').length,1);
 const winner=results.findIndex(r=>r.ok);ok(await rpc('cancelar_agendamento',{p_id:results[winner].data},winner),'Cancelar reserva QA');
 console.log('PASS: duas requisições simultâneas, exatamente uma reserva aceita');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{
 if(profileChanged)ok(await api('/rest/v1/perfil_publico?id=eq.true',{who:3,method:'PATCH',body:{dados:originalProfile}}),'Restaurar conteúdo');
 if(photoUploaded)ok(await api('/storage/v1/object/institucional',{who:3,method:'DELETE',body:{prefixes:['site/qa-api-171.png']}}),'Remover foto QA');
 if(uploaded){const r=await api('/storage/v1/object/documentos',{who:3,method:'DELETE',body:{prefixes:[path]}});console.log(r.ok?'CLEANUP: arquivo QA removido':'CLEANUP PENDENTE: arquivo QA '+path);}
 if(oldAvailability && !oldAvailability.length)ok(await api('/rest/v1/disponibilidade?id=eq.true',{who:3,method:'DELETE'}),'Restaurar agenda vazia');
 for(let i=0;i<tokens.length;i++)await api('/auth/v1/logout',{who:i,method:'POST'});
 console.log('CLEANUP: executar remoção SQL dos registros e usuários QA a1712026; caso '+caso);
});
