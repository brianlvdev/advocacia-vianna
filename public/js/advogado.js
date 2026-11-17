import { exigirPapel } from './guard.js';
import { auth, db, storage, functions } from './backend.js';
import { signOut } from './backend.js';
import {
  doc, collection, getDocs, updateDoc, getDoc, setDoc, addDoc, deleteDoc,
  query, where, serverTimestamp
} from './backend.js';
import { ref, uploadBytes, getDownloadURL, abrirDocumento } from './backend.js';
import { httpsCallable } from './backend.js';

const { usuario } = await exigirPapel(['admin']);
const status = document.getElementById('aviso');
const marcar = httpsCallable(functions, 'atualizarAgendamento');
document.getElementById('boas-vindas').textContent = 'Olá, ' + (usuario.displayName || 'bem-vinda');
document.getElementById('btn-sair').addEventListener('click', async () => {
  await signOut(auth); location.replace('index.html');
});
function mensagem(texto) { status.textContent = texto; }
function falha(descricao, erro) {
  console.error(descricao, erro);
  mensagem('Não foi possível ' + descricao + '. Verifique sua conexão e as permissões.');
}
function botao(texto, fn) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'btn btn-secundario'; b.textContent = texto;
  b.addEventListener('click', async () => {
    b.disabled = true;
    try { await fn(); } catch (e) { falha('executar a operação', e); }
    finally { b.disabled = false; }
  });
  return b;
}
async function carregarAgenda() {
  const registros = await getDocs(collection(db, 'agendamentos'));
  const elem = document.getElementById('calendario');
  if (!window.FullCalendar) { elem.textContent = 'Calendário indisponível.'; return; }
  new FullCalendar.Calendar(elem, {
    locale: 'pt-br', initialView: 'dayGridMonth',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
    events: registros.docs.map(d => {
      const a = d.data();
      return { id: d.id, title: a.clienteNome || 'Solicitação', start: a.inicio, end: a.fim,
        color: { pendente: '#b8975a', confirmado: '#347c65', cancelado: '#999' }[a.status] || '#777',
        extendedProps: { status: a.status } };
    }),
    eventClick: async info => {
      if (info.event.extendedProps.status === 'cancelado') return alert('Este agendamento foi cancelado.');
      const acao = prompt('1: confirmar reunião; 2: cancelar reunião');
      if (!['1', '2'].includes(acao)) return;
      if (acao === '2' && !confirm('Cancelar esta reunião?')) return;
      const meetUrl = acao === '1' ? prompt('Link Google Meet (opcional):') : '';
      if (meetUrl === null) return;
      try {
        await marcar({ id: info.event.id, acao: acao === '1' ? 'confirmar' : 'cancelar',
          meetUrl: (meetUrl || '').trim() });
        location.reload();
      } catch (e) { falha('alterar a reunião', e); }
    }
  }).render();
}
const dispRef = doc(db, 'config', 'disponibilidade');
async function carregarDisponibilidade() {
  const snap = await getDoc(dispRef);
  if (!snap.exists()) return;
  const d = snap.data();
  document.querySelectorAll('input[name=dia]').forEach(c => {
    c.checked = (d.diasSemana || []).includes(Number(c.value));
  });
  document.getElementById('disp-inicio').value = d.inicio || '09:00';
  document.getElementById('disp-fim').value = d.fim || '17:00';
  document.getElementById('disp-duracao').value = d.duracaoMin || 30;
}
document.getElementById('form-disp').addEventListener('submit', async e => {
  e.preventDefault();
  const diasSemana = [...document.querySelectorAll('input[name=dia]:checked')].map(c => Number(c.value));
  const inicio = document.getElementById('disp-inicio').value;
  const fim = document.getElementById('disp-fim').value;
  const duracaoMin = Number(document.getElementById('disp-duracao').value);
  if (!diasSemana.length || inicio >= fim || !Number.isInteger(duracaoMin) ||
      duracaoMin < 15 || duracaoMin > 120) {
    mensagem('Selecione dias, início anterior ao fim e duração de 15 a 120 minutos.');
    return;
  }
  try { await setDoc(dispRef, { diasSemana, inicio, fim, duracaoMin }); mensagem('Disponibilidade salva.'); }
  catch (e) { falha('salvar disponibilidade', e); }
});

const perfilRef = doc(db, 'site', 'perfil');
const campos = ['resumo', 'endereco', 'whatsapp', 'email', 'instagram', 'linkedinUrl', 'jusbrasilUrl', 'agendaUrl'];
function linha(lista, chaves, valores = {}) {
  const wrapper = document.createElement('div'); wrapper.className = 'linha';
  for (const [key, rotulo] of chaves) {
    const input = document.createElement('input');
    input.dataset.key = key; input.placeholder = rotulo;
    input.setAttribute('aria-label', rotulo); input.value = valores[key] || '';
    wrapper.append(input);
  }
  wrapper.append(botao('Remover', () => wrapper.remove())); lista.append(wrapper);
}
const chavesArea = [['titulo', 'Título'], ['descricao', 'Descrição']];
const chavesStats = [['rotulo', 'Rótulo'], ['valor', 'Valor']];
const areas = document.getElementById('lista-areas');
const stats = document.getElementById('lista-stats');
document.getElementById('add-area').addEventListener('click', () => linha(areas, chavesArea));
document.getElementById('add-stat').addEventListener('click', () => linha(stats, chavesStats));
function lerLinhas(lista) {
  return [...lista.querySelectorAll('.linha')].map(el => {
    const d = {};
    el.querySelectorAll('input').forEach(input => { d[input.dataset.key] = input.value.trim(); });
    return d;
  }).filter(v => Object.values(v).some(Boolean));
}
async function carregarPerfil() {
  const snap = await getDoc(perfilRef);
  const p = snap.exists() ? snap.data() : {};
  for (const c of campos) document.getElementById(c).value = p[c] || '';
  areas.replaceChildren(); stats.replaceChildren();
  (p.areas || []).forEach(a => linha(areas, chavesArea, a));
  (p.estatisticas || []).forEach(a => linha(stats, chavesStats, a));
}
document.getElementById('form-perfil').addEventListener('submit', async e => {
  e.preventDefault();
  mensagem('Salvando conteúdo...');
  try {
    const novo = {};
    for (const c of campos) novo[c] = document.getElementById(c).value.trim();
    novo.areas = lerLinhas(areas);
    novo.estatisticas = lerLinhas(stats);
    novo.atualizadoEm = new Date().toISOString();
    const foto = document.getElementById('foto').files[0];
    if (foto) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(foto.type) || foto.size > 5 * 1024 * 1024) {
        mensagem('Foto inválida. Utilize JPEG, PNG ou WEBP com até 5 MB.'); return;
      }
      const destino = ref(storage, 'site/foto-perfil');
      await uploadBytes(destino, foto, { contentType: foto.type });
      novo.fotoUrl = await getDownloadURL(destino);
      novo.fotoUrl += '?v=' + Date.now();
    }
    await setDoc(perfilRef, novo, { merge: true });
    mensagem('Informações institucionais salvas.');
  } catch (e) { falha('salvar conteúdo institucional', e); }
});

let equipe = [];
async function carregarEquipe() {
  const lista = document.getElementById('lista-clientes');
  const seletor = document.getElementById('tarefa-estagiario');
  lista.replaceChildren();
  const usuarios = await getDocs(collection(db, 'users'));
  equipe = usuarios.docs.map(d => ({ uid: d.id, ...d.data() }));
  seletor.replaceChildren();
  const vazio = document.createElement('option'); vazio.value = ''; vazio.textContent = 'Selecione um estagiário';
  seletor.append(vazio);
  equipe.filter(p => p.role === 'estagiario').forEach(p => {
    const op = document.createElement('option'); op.value = p.uid; op.textContent = p.nome || p.email;
    seletor.append(op);
  });
  const clientes = equipe.filter(p => p.role === 'cliente');
  if (!clientes.length) lista.textContent = 'Nenhum cliente disponível para atribuição.';
  clientes.forEach(p => {
    const item = document.createElement('div'); item.className = 'linha equipe-linha';
    const nome = document.createElement('span'); nome.textContent = (p.nome || 'Cliente') + ' — ' + (p.email || '');
    item.append(nome, botao('Conceder papel de estagiário', async () => {
      if (!confirm('Confirma a autorização de acesso à equipe para esta conta?')) return;
      await updateDoc(doc(db, 'users', p.uid), { role: 'estagiario' });
      await carregarEquipe(); await carregarCasos(); mensagem('Papel atualizado.');
    })); lista.append(item);
  });
}
async function carregarCasos() {
  const lista = document.getElementById('lista-casos'); lista.replaceChildren();
  const result = await getDocs(collection(db, 'casos'));
  const casos = result.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
  if (!casos.length) lista.textContent = 'Nenhuma solicitação recebida.';
  for (const c of casos) {
    const card = document.createElement('article'); card.className = 'caso';
    const h = document.createElement('h3'); h.textContent = (c.clienteNome || 'Cliente') + ' — ' + (c.assunto || 'Caso');
    const p = document.createElement('p'); p.textContent = c.resumo || '';
    const situacao = document.createElement('span'); situacao.className = 'etiqueta';
    const rotulos = { uploading: 'Envio incompleto', novo: 'Aguardando análise', aceito: 'Aceito', recusado: 'Recusado', 'com-estagiario': 'Com estagiário' };
    const atualizarSituacao = () => {
      situacao.textContent = rotulos[c.status] || c.status;
      situacao.dataset.status = c.status;
    };
    atualizarSituacao();
    card.append(h, situacao, p);
    for (const a of c.arquivos || []) {
      const b = botao('Abrir: ' + a.nome, async () => {
        await abrirDocumento(ref(storage, a.caminho));
      });
      card.append(b);
    }
    if (c.status !== 'uploading') {
      const actions = document.createElement('div'); actions.className = 'linha';
      const retorno = document.createElement('p'); retorno.className = 'caso-retorno';
      retorno.setAttribute('role', 'status'); retorno.setAttribute('aria-live', 'polite');
      const responsavel = document.createElement('p');
      let salvando = false;
      async function salvarCaso(dados, texto) {
        if (salvando) return;
        salvando = true; sincronizar(); retorno.textContent = 'Salvando alteração...';
        try {
          const registro = await updateDoc(doc(db, 'casos', c.id), dados);
          Object.assign(c, registro);
          atualizarSituacao(); retorno.textContent = texto;
        } catch (erro) {
          console.error('Não foi possível atualizar o caso', erro);
          retorno.textContent = 'Não foi possível salvar a alteração. Tente novamente.';
        } finally { salvando = false; sincronizar(); }
      }
      // Não recriar a lista: manter o foco, a posição e o resultado junto do caso.
      function acao(texto, fn) {
        const b = document.createElement('button'); b.type = 'button';
        b.className = 'btn btn-secundario'; b.textContent = texto;
        b.addEventListener('click', fn); return b;
      }
      const aceitar = acao('Aceitar', () => salvarCaso({ status: 'aceito', estagiarioUid: null, liberadoParaEstagiario: false }, 'Caso aceito e salvo.'));
      const recusar = acao('Recusar', () => salvarCaso({ status: 'recusado', estagiarioUid: null, liberadoParaEstagiario: false }, 'Caso recusado e salvo. O acesso da equipe foi removido.'));
      actions.append(aceitar, recusar);
      const estagiarios = equipe.filter(e => e.role === 'estagiario');
      const atribuicao = document.createElement('div'); atribuicao.className = 'caso-atribuicao'; atribuicao.hidden = true;
      atribuicao.id = 'atribuicao-' + c.id;
      const abrir = acao('Encaminhar para estagiário', () => {
        atribuicao.hidden = !atribuicao.hidden;
        abrir.setAttribute('aria-expanded', String(!atribuicao.hidden));
      });
      abrir.setAttribute('aria-expanded', 'false'); abrir.setAttribute('aria-controls', atribuicao.id);
      actions.append(abrir);
      const select = document.createElement('select'); select.setAttribute('aria-label', 'Estagiário responsável');
      const vazio = document.createElement('option'); vazio.value = ''; vazio.textContent = 'Selecione um estagiário'; select.append(vazio);
      const atribuir = acao('Salvar responsável', () => {
        if (!estagiarios.some(e => e.uid === select.value)) {
          retorno.textContent = 'Selecione um estagiário antes de encaminhar o caso.'; return;
        }
        return salvarCaso({ estagiarioUid: select.value, liberadoParaEstagiario: true, status: 'com-estagiario' }, 'Caso encaminhado. O estagiário já pode acessar os documentos.');
      });
      if (estagiarios.length) {
        for (const e of estagiarios) {
          const opt = document.createElement('option'); opt.value = e.uid; opt.textContent = e.nome || e.email;
          opt.selected = e.uid === c.estagiarioUid; select.append(opt);
        }
        select.value = c.estagiarioUid || '';
        atribuicao.append(select, atribuir);
      } else {
        const ajuda = document.createElement('p'); ajuda.textContent = 'Nenhum estagiário cadastrado. Você pode aceitar o caso agora e encaminhá-lo depois.';
        const link = document.createElement('a'); link.href = '#equipe'; link.textContent = 'Adicionar estagiário na equipe';
        atribuicao.append(ajuda, link);
      }
      const revogar = acao('Revogar acesso da equipe', () => salvarCaso({ liberadoParaEstagiario: false, estagiarioUid: null, status: 'aceito' }, 'Acesso da equipe revogado. O caso continua aceito.'));
      actions.append(revogar);
      function sincronizar() {
        aceitar.disabled = salvando || ['aceito', 'com-estagiario'].includes(c.status);
        recusar.disabled = salvando || c.status === 'recusado';
        atribuir.disabled = salvando; select.disabled = salvando;
        abrir.disabled = salvando; revogar.disabled = salvando;
        revogar.hidden = !c.liberadoParaEstagiario;
        const pessoa = equipe.find(e => e.uid === c.estagiarioUid);
        responsavel.textContent = c.liberadoParaEstagiario
          ? 'Responsável: ' + (pessoa?.nome || pessoa?.email || 'Estagiário atribuído') : 'Estagiário: ainda não atribuído.';
      }
      sincronizar();
      card.append(responsavel, actions, atribuicao, retorno);
    }
    lista.append(card);
  }
}
async function carregarTarefas() {
  const lista = document.getElementById('lista-tarefas'); lista.replaceChildren();
  const result = await getDocs(collection(db, 'tarefas'));
  const tarefas = result.docs.map(d => ({ id:d.id, ...d.data() }))
    .sort((a,b) => String(a.data).localeCompare(String(b.data)));
  if (!tarefas.length) lista.textContent = 'Nenhuma tarefa cadastrada.';
  for (const t of tarefas) {
    const card = document.createElement('article'); card.className = 'caso';
    const h = document.createElement('h3'); h.textContent = t.titulo;
    const p = document.createElement('p');
    const resp = equipe.find(e => e.uid === t.estagiarioUid);
    p.textContent = (t.data || '') + ' — ' + (resp?.nome || resp?.email || 'Não atribuído')
      + ' — ' + (t.concluida ? 'Concluída' : 'Pendente');
    card.append(h,p,botao('Excluir', async () => {
      if (!confirm('Excluir esta tarefa?')) return;
      await deleteDoc(doc(db, 'tarefas', t.id)); await carregarTarefas();
    }));
    lista.append(card);
  }
}
document.getElementById('form-tarefa').addEventListener('submit', async e => {
  e.preventDefault();
  const titulo = document.getElementById('tarefa-titulo').value.trim();
  const data = document.getElementById('tarefa-data').value;
  const estagiarioUid = document.getElementById('tarefa-estagiario').value;
  if (titulo.length < 3 || titulo.length > 150 || !/^\d{4}-\d{2}-\d{2}$/.test(data)
      || !equipe.some(p => p.uid === estagiarioUid && p.role === 'estagiario')) {
    mensagem('Verifique descrição, data e estagiário responsável.'); return;
  }
  try {
    await addDoc(collection(db, 'tarefas'), { titulo, data, estagiarioUid,
      concluida: false, criadoEm: serverTimestamp() });
    e.target.reset(); mensagem('Tarefa criada.'); await carregarTarefas();
  } catch (error) { falha('criar a tarefa', error); }
});
for (const [nome,fn] of [
  ['agenda',carregarAgenda], ['disponibilidade',carregarDisponibilidade],
  ['perfil',carregarPerfil], ['equipe',carregarEquipe],
  ['casos',carregarCasos], ['tarefas',carregarTarefas]
]) {
  try { await fn(); } catch (e) { falha('carregar ' + nome, e); }
}
