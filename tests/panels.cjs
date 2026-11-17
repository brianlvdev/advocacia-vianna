// Executa os módulos reais com DOM e transporte Supabase controlados.
// Complementa supabase-api.cjs (RLS/API real), sem abrir navegador.
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {webcrypto}=require('node:crypto');
class Element {
 constructor(tag='div'){this.tag=tag;this.children=[];this.events={};this.dataset={};this.files=[];this.value='';this.className='';this.hidden=false;}
 append(...items){for(const item of items){this.children.push(item);if(item instanceof Element)item.parent=this;}}
 appendChild(item){this.append(item);return item;}
 replaceChildren(...items){this.children=[];this.append(...items);}
 hasChildNodes(){return this.children.length>0;}
 setAttribute(key,value){this[key]=value;}
 addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
 async fire(name){if(name==='click'&&this.disabled)return;for(const fn of this.events[name]||[])await fn({preventDefault(){},target:this});}
 querySelectorAll(selector){const all=this.children.filter(c=>c instanceof Element).flatMap(c=>[c,...c.querySelectorAll('*')]);return selector==='*'?all:all.filter(c=>selector==='input'?c.tag==='input':selector==='.linha'?c.className.split(' ').includes('linha'):false);}
 querySelector(){return new Element('button');}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
 reset(){}
}
async function scenario(role,page,options={}){
 const current={id:role,email:role+'@example.invalid',user_metadata:{full_name:role}};
 const rows={perfis:[{id:'admin',papel:'admin',nome:'Admin'},{id:'cliente',papel:'cliente',nome:'Cliente'},{id:'estagiario',papel:'estagiario',nome:'Estagiário'}],perfil_publico:[{id:true,dados:{areas:[],estatisticas:[],endereco:'Endereço preservado'}}],disponibilidade:[{id:true,dias_semana:[1],inicio:'09:00',fim:'17:00',duracao_min:30}],casos:[],documentos:[],agendamentos:[],tarefas:[{id:'tarefa',titulo:'Tarefa de teste',data:'2026-11-20',estagiario_id:'estagiario',concluida:false}]};
 options.setup?.(rows);
 const writes=[];
 class Query {
  constructor(table){this.table=table;this.filters=[];this.action='read';}
  select(){return this;}
  eq(key,value){this.filters.push([key,value]);return this;}
  single(){this.one=true;return this;}
  maybeSingle(){this.one=true;return this;}
  insert(data){this.action='insert';this.data=data;return this;}
  upsert(data){this.action='upsert';this.data=data;return this;}
  update(data){this.action='update';this.data=data;return this;}
  delete(){this.action='delete';return this;}
  then(resolve,reject){return Promise.resolve().then(()=>{
   const list=rows[this.table];assert(list,'Tabela desconhecida '+this.table);
   let selected=list.filter(row=>this.filters.every(([k,v])=>row[k]===v));
   if(this.action!=='read')writes.push({table:this.table,action:this.action,data:this.data});
   if(this.action==='update'&&options.failUpdate)return {data:null,error:{message:'Falha simulada'}};
   if(['insert','upsert'].includes(this.action)){
    selected=(Array.isArray(this.data)?this.data:[this.data]).map(data=>{let row=this.action==='upsert'?list.find(r=>r.id===data.id):null;if(row)Object.assign(row,data);else{row={...data};list.push(row);}return row;});
   }else if(this.action==='update')selected.forEach(row=>Object.assign(row,this.data));
   else if(this.action==='delete')rows[this.table]=list.filter(row=>!selected.includes(row));
   const result=selected.map(row=>({...row,...(this.table==='casos'?{documentos:rows.documentos.filter(d=>d.caso_id===row.id)}:{})}));
   return {data:this.one?result[0]||null:result,error:null};
  }).then(resolve,reject);}
 }
 const supabase={
  auth:{getUser:async()=>({data:{user:role==='visitante'?null:current},error:null}),getSession:async()=>({data:{session:role==='visitante'?null:{}},error:null}),signOut:async()=>({error:null}),
   signInWithOAuth:async data=>{writes.push({oauth:data});return {data:{},error:null};},
   onAuthStateChange:fn=>{fn();return {data:{subscription:{unsubscribe(){}}}};}},
  from:table=>new Query(table),
  rpc:async(name,args)=>{writes.push({rpc:name,args});if(name==='finalizar_caso')rows.casos.find(c=>c.id===args.p_caso).status='novo';return {data:name==='listar_horarios'?(options.slots||[]):null,error:name==='reservar_horario'?options.reservationError||null:null};},
  storage:{from:bucket=>({upload:async(file)=>{writes.push({bucket,file});return {data:{},error:null};},getPublicUrl:()=>({data:{publicUrl:'https://example.invalid/foto.png'}}),createSignedUrl:async()=>({data:{signedUrl:'https://example.invalid/documento'},error:null})})}
 };
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
 node('lista-areas').append(new Element('article')); // conteúdo estático inicial
 const days=[1,2,3,4,5].map(value=>Object.assign(new Element('input'),{value:String(value),checked:value===1}));
 const document={getElementById:node,createElement:tag=>new Element(tag),querySelectorAll:selector=>selector.includes(':checked')?days.filter(d=>d.checked):days};
 const errors=[],alerts=[],redirects=[];const location={href:'https://example.invalid/'+page+'.html',replace:url=>redirects.push(url),reload(){redirects.push('reload');}};
 const sessionValues=new Map(Object.entries(options.session||{}));
 const sessionStorage={getItem:key=>sessionValues.get(key)||null,setItem:(key,value)=>sessionValues.set(key,value),removeItem:key=>sessionValues.delete(key)};
 const window={location};
 const context=vm.createContext({document,window,location,sessionStorage,crypto:webcrypto,URL,console:{error:(...args)=>errors.push(args),warn(){},log(){}},alert:m=>alerts.push(m),confirm:()=>true,prompt:()=>null,setTimeout});
 const config=new vm.SyntheticModule(['supabase'],function(){this.setExport('supabase',supabase);},{context});
 const cache=new Map();
 async function load(file){if(cache.has(file))return cache.get(file);const m=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file});cache.set(file,m);await m.link((spec,ref)=>spec==='./supabase-config.js'?config:load(path.resolve(path.dirname(ref.identifier),spec)));return m;}
 const mod=await load(path.resolve(__dirname,'../public/js/'+page+'.js'));
 await mod.evaluate();
 if(page==='auth')await new Promise(resolve=>setTimeout(resolve,20));
 return {rows,writes,node,errors,alerts,redirects,context,sessionValues};
}
(async()=>{
 const admin=await scenario('admin','advogado');
 assert.equal(admin.errors.length,0,JSON.stringify(admin.errors));
 await admin.node('add-area').fire('click');
 const area=admin.node('lista-areas').children[0];assert(area,'Adicionar área não criou campos');
 area.children[0].value='Nova área';area.children[1].value='Descrição persistida';
 await admin.node('form-perfil').fire('submit');
 assert.equal(admin.rows.perfil_publico[0].dados.areas[0].titulo,'Nova área');
 assert.equal(admin.rows.perfil_publico[0].dados.endereco,'Endereço preservado');
 await area.children[2].fire('click');
 await admin.node('add-stat').fire('click');
 const info=admin.node('lista-stats').children[0];info.children[0].value='Atendimento';info.children[1].value='Agendado';
 await admin.node('form-perfil').fire('submit');
 assert.equal(admin.rows.perfil_publico[0].dados.areas.length,0);
 assert.equal(admin.rows.perfil_publico[0].dados.estatisticas[0].valor,'Agendado');
 admin.node('disp-inicio').value='10:00';await admin.node('form-disp').fire('submit');
 assert.equal(admin.rows.disponibilidade[0].inicio,'10:00');
 admin.node('tarefa-titulo').value='Nova tarefa';admin.node('tarefa-data').value='2026-11-20';admin.node('tarefa-estagiario').value='estagiario';
 await admin.node('form-tarefa').fire('submit');assert(admin.rows.tarefas.some(t=>t.titulo==='Nova tarefa'));
 assert.equal(admin.errors.length,0,JSON.stringify(admin.errors));
 console.log('PASS: advogado adiciona área, salva conteúdo, disponibilidade e tarefa');
 const client=await scenario('cliente','cliente');
 client.node('resumo').value='Descrição completa de caso para teste';client.node('assunto').value='Civil';
 client.node('arquivos').files=[{name:'teste.txt',type:'text/plain',size:10}];
 await client.node('form-caso').fire('submit');
 assert.equal(client.rows.casos.length,1);assert.equal(client.rows.casos[0].cliente_id,'cliente');assert.equal(client.rows.casos[0].status,'novo');
 assert.equal(client.rows.documentos.length,1);assert.equal(client.errors.length,0,JSON.stringify(client.errors));
 console.log('PASS: cliente envia caso e documento com metadados persistidos');
 const intern=await scenario('estagiario','estagiario');
 const checkbox=intern.node('lista-tarefas').children[0].children[0];checkbox.checked=true;await checkbox.fire('change');
 assert.equal(intern.rows.tarefas[0].concluida,true);assert.equal(intern.errors.length,0,JSON.stringify(intern.errors));
 console.log('PASS: estagiário salva conclusão da tarefa');
 await assert.rejects(()=>scenario('cliente','advogado'),/permissão/);
 await assert.rejects(()=>scenario('estagiario','advogado'),/permissão/);
 console.log('PASS: guard bloqueia cliente e estagiário no painel do advogado');
 const site=await scenario('cliente','perfil-publico');
 assert.equal(site.node('lista-areas').children.length,0);
 assert.equal(site.node('numeros').hidden,true);
 assert.equal(site.errors.length,0,JSON.stringify(site.errors));
 console.log('PASS: remover áreas e salvar lista vazia atualiza a página pública');
 const caseSetup=rows=>rows.casos.push({id:'caso-acao',cliente_id:'cliente',status:'novo',resumo:'Caso de teste de ações',estagiario_id:null,liberado_para_estagiario:false});
 const manager=await scenario('admin','advogado',{setup:caseSetup});
 const card=manager.node('lista-casos').children[0];
 const button=text=>card.querySelectorAll('*').find(e=>e.tag==='button'&&e.textContent===text);
 await button('Aceitar').fire('click');
 assert.equal(manager.rows.casos[0].status,'aceito');assert.equal(card.children[1].textContent,'Aceito');
 assert(button('Aceitar').disabled);assert.match(card.children.at(-1).textContent,/aceito e salvo/);
 assert.equal(manager.node('lista-casos').children[0],card,'A ação recriou o cartão');
 await button('Recusar').fire('click');assert.equal(manager.rows.casos[0].status,'recusado');assert.equal(card.children[1].textContent,'Recusado');
 assert(button('Recusar').disabled);assert(!button('Aceitar').disabled);
 await button('Encaminhar para estagiário').fire('click');
 const assignment=card.querySelectorAll('*').find(e=>e.className==='caso-atribuicao');assert.equal(assignment.hidden,false);
 await button('Salvar responsável').fire('click');assert.equal(manager.rows.casos[0].status,'recusado','Atribuiu sem selecionar');
 assignment.children[0].value='estagiario';await button('Salvar responsável').fire('click');
 assert.equal(manager.rows.casos[0].estagiario_id,'estagiario');assert.equal(manager.rows.casos[0].liberado_para_estagiario,true);
 assert.equal(card.children[1].textContent,'Com estagiário');
 await button('Recusar').fire('click');assert.equal(manager.rows.casos[0].estagiario_id,null);assert.equal(manager.rows.casos[0].liberado_para_estagiario,false);
 assert.equal(manager.redirects.length,0);assert.equal(manager.errors.length,0);
 console.log('PASS: aceitar, recusar e atribuir persistem e atualizam o cartão sem recarregar');
 const failure=await scenario('admin','advogado',{setup:caseSetup,failUpdate:true});
 const failedCard=failure.node('lista-casos').children[0];
 await failedCard.querySelectorAll('*').find(e=>e.textContent==='Aceitar').fire('click');
 assert.equal(failure.rows.casos[0].status,'novo');assert.equal(failedCard.children[1].textContent,'Aguardando análise');
 assert.match(failedCard.children.at(-1).textContent,/Não foi possível salvar/);
 const emptyTeam=await scenario('admin','advogado',{setup:rows=>{caseSetup(rows);rows.perfis=rows.perfis.filter(p=>p.papel!=='estagiario');}});
 const emptyCard=emptyTeam.node('lista-casos').children[0];
 await emptyCard.querySelectorAll('*').find(e=>e.textContent==='Encaminhar para estagiário').fire('click');
 const emptyAssignment=emptyCard.querySelectorAll('*').find(e=>e.className==='caso-atribuicao');
 assert.equal(emptyAssignment.hidden,false);assert.equal(emptyAssignment.children[1].href,'#equipe');
 console.log('PASS: falha de gravação mantém estado anterior; equipe vazia permite atribuir depois');
 const slots=[{inicio:'2026-11-24T13:00:00Z'},{inicio:'2026-11-23T13:00:00Z'},{inicio:'2026-11-23T12:00:00Z'}];
 const schedule=await scenario('cliente','agendar',{slots});
 const days=schedule.node('horarios').children;assert.equal(days.length,2);assert.match(days[0].children[0].textContent,/segunda/);
 assert.equal(days[0].children[1].children[0].textContent,'09:00');
 await days[0].children[1].children[0].fire('click');
 assert.equal(schedule.writes.find(w=>w.rpc==='reservar_horario').args.p_inicio,'2026-11-23T12:00:00.000Z');
 assert.match(schedule.node('aviso').textContent,/Solicitação enviada/);
 const conflict=await scenario('cliente','agendar',{slots,reservationError:{code:'23505'}});
 await conflict.node('horarios').children[0].children[1].children[0].fire('click');
 assert.match(conflict.node('aviso').textContent,/reservado/);
 const visitor=await scenario('visitante','agendar');
 await visitor.node('horarios').children[1].fire('click');
 assert.equal(visitor.sessionValues.get('apos-login'),'agendar.html');
 assert.equal(visitor.writes[0].oauth.options.redirectTo,'https://example.invalid/index.html');
 assert(!visitor.writes.some(w=>w.rpc),'Visitante consultou API restrita');
 const returnLogin=await scenario('cliente','auth',{session:{'apos-login':'agendar.html'}});
 assert.deepEqual(returnLogin.redirects,['agendar.html']);assert.equal(returnLogin.sessionValues.size,0);
 console.log('PASS: agenda por dia, reserva/conflito e retorno do login para agendar');
})().catch(e=>{console.error(e);process.exitCode=1;});
