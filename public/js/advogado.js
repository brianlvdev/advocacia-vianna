import { exigirPapel } from './guard.js';
import { auth, db, storage, functions } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc, collection, getDocs, updateDoc, getDoc, setDoc, addDoc, deleteDoc,
  query, where, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { enderecoSeguro, ehTextoTeste, limparBioTeste, lerPercentual, registroTeste }
  from './conteudo-institucional.js';

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
const CAMPOS = ['resumo', 'endereco', 'whatsapp', 'email', 'instagram', 'linkedinUrl', 'jusbrasilUrl', 'agendaUrl'];
const camposArea = [
  { chave: 'titulo', rotulo: 'Área de atuação', tipo: 'text', obrigatorio: true },
  { chave: 'descricao', rotulo: 'Descrição da área', tipo: 'text' },
  { chave: 'percentual', rotulo: 'Percentual de atuação (0 a 100, opcional)', tipo: 'number' }
];
const camposIndicador = [
  { chave: 'rotulo', rotulo: 'Nome do indicador', tipo: 'text', obrigatorio: true },
  { chave: 'valor', rotulo: 'Percentual (0 a 100)', tipo: 'number' }
];
const areas = document.getElementById('lista-areas');
const stats = document.getElementById('lista-stats');
const enderecoInput = document.getElementById('endereco');
const formularioPerfil = document.getElementById('form-perfil');
const botaoSalvarPerfil = formularioPerfil.querySelector('button[type="submit"]');

function adicionarLinha(lista, definicoes, valores = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'linha linha-conteudo';
  for (const campo of definicoes) {
    const rotulo = document.createElement('label');
    rotulo.className = 'campo-dinamico';
    rotulo.textContent = campo.rotulo;
    const input = document.createElement('input');
    input.dataset.key = campo.chave;
    input.type = campo.tipo;
    if (campo.tipo === 'number') {
      input.min = '0'; input.max = '100'; input.step = '0.1';
    }
    const original = valores[campo.chave];
    const num = campo.tipo === 'number' ? lerPercentual(original) : null;
    input.value = campo.tipo === 'number'
      ? (num === null ? '' : String(num))
      : (original ?? '');
    rotulo.append(input);
    wrapper.append(rotulo);
  }
  wrapper.append(botao('Remover', () => wrapper.remove()));
  lista.append(wrapper);
}
document.getElementById('add-area').addEventListener('click', () => adicionarLinha(areas, camposArea));
document.getElementById('add-stat').addEventListener('click', () => adicionarLinha(stats, camposIndicador));

function lerLista(lista, tipo) {
  const resultado = [];
  for (const wrapper of lista.querySelectorAll('.linha-conteudo')) {
    const dados = {};
    for (const input of wrapper.querySelectorAll('input[data-key]')) {
      dados[input.dataset.key] = input.value.trim();
    }
    if (Object.values(dados).every(v => v === '')) continue;
    if (tipo === 'areas') {
      if (!dados.titulo) throw new Error('Cada área precisa de um título. Edite ou remova a linha incompleta.');
      if (ehTextoTeste(dados.titulo)) continue;
      const area = { titulo: dados.titulo, descricao: limparBioTeste(dados.descricao) };
      if (dados.percentual !== '') {
        const percentual = lerPercentual(dados.percentual);
        if (percentual === null) throw new Error('Informe um percentual entre 0 e 100 para ' + area.titulo + '.');
        area.percentual = percentual;
      }
      resultado.push(area);
    } else {
      if (!dados.rotulo) throw new Error('Cada indicador precisa de um nome. Edite ou remova a linha incompleta.');
      if (ehTextoTeste(dados.rotulo)) continue;
      const percentual = lerPercentual(dados.valor);
      if (percentual === null) throw new Error('Informe um percentual entre 0 e 100 para ' + dados.rotulo + '.');
      resultado.push({ rotulo: dados.rotulo, valor: percentual });
    }
  }
  return resultado;
}

async function carregarPerfil() {
  const snap = await getDoc(perfilRef);
  const p = snap.exists() ? snap.data() : {};
  for (const campo of CAMPOS) {
    const input = document.getElementById(campo);
    input.value = campo === 'endereco' ? enderecoSeguro(p.endereco) : (p[campo] || '');
  }
  if (typeof p.resumo === 'string') {
    document.getElementById('resumo').value = limparBioTeste(p.resumo);
  }
  areas.replaceChildren(); stats.replaceChildren();
  (Array.isArray(p.areas) ? p.areas : [])
    .filter(a => !registroTeste(a)).forEach(a => adicionarLinha(areas, camposArea, a));
  (Array.isArray(p.estatisticas) ? p.estatisticas : [])
    .filter(i => !registroTeste(i)).forEach(i => adicionarLinha(stats, camposIndicador, i));
  const temTeste = (p.endereco && enderecoSeguro(p.endereco) !== p.endereco.trim()) ||
    (p.resumo && limparBioTeste(p.resumo) !== p.resumo.trim()) ||
    (Array.isArray(p.areas) && p.areas.some(registroTeste)) ||
    (Array.isArray(p.estatisticas) && p.estatisticas.some(registroTeste));
  const avisoTeste = document.getElementById('aviso-conteudo-teste');
  avisoTeste.hidden = !temTeste;
  avisoTeste.textContent = temTeste
    ? 'Há dados de teste antigos no Firebase. Eles já são ocultados no site; use "Limpar dados de teste" para corrigi-los no banco.'
    : '';
}

formularioPerfil.addEventListener('submit', async evento => {
  evento.preventDefault();
  botaoSalvarPerfil.disabled = true;
  mensagem('Salvando informações institucionais...');
  try {
    const novo = {};
    for (const campo of CAMPOS) novo[campo] = document.getElementById(campo).value.trim();
    if (!novo.endereco || ehTextoTeste(novo.endereco) || /rua\s+do\s+doce/i.test(novo.endereco)) {
      throw new Error('Informe o endereço verdadeiro do escritório.');
    }
    novo.resumo = limparBioTeste(novo.resumo);
    novo.areas = lerLista(areas, 'areas');
    novo.estatisticas = lerLista(stats, 'estatisticas');
    novo.atualizadoEm = new Date().toISOString();
    const foto = document.getElementById('foto').files[0];
    if (foto) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(foto.type)
          || foto.size > 5 * 1024 * 1024) {
        throw new Error('A foto deve ser JPEG, PNG ou WEBP com até 5 MB.');
      }
      const destino = ref(storage, 'site/foto-perfil');
      await uploadBytes(destino, foto, { contentType: foto.type });
      novo.fotoUrl = await getDownloadURL(destino);
    }
    await setDoc(perfilRef, novo, { merge: true });
    document.getElementById('aviso-conteudo-teste').hidden = true;
    mensagem('Informações salvas. Alterações de áreas, percentuais e exclusões aparecerão no site.');
    await carregarPerfil();
  } catch (erro) {
    console.error('Falha ao salvar perfil', erro);
    mensagem(erro.message || 'Não foi possível salvar o perfil.');
  } finally {
    botaoSalvarPerfil.disabled = false;
  }
});

// Corrige somente os valores de demonstração conhecidos, preservando
// os demais dados institucionais e exigindo confirmação do administrador.
document.getElementById('limpar-conteudo-teste').addEventListener('click', async evento => {
  const botaoLimpar = evento.currentTarget;
  botaoLimpar.disabled = true;
  try {
    const snap = await getDoc(perfilRef);
    if (!snap.exists()) {
      mensagem('O perfil ainda não existe no Firestore. Preencha e salve o formulário.');
      return;
    }
    const atual = snap.data();
    const ajustes = {};
    const corrigirEndereco = enderecoSeguro(atual.endereco);
    if (typeof atual.endereco !== 'string' || corrigirEndereco !== atual.endereco.trim()) {
      ajustes.endereco = corrigirEndereco;
    }
    if (typeof atual.resumo === 'string') {
      const resumoLimpo = limparBioTeste(atual.resumo);
      if (resumoLimpo !== atual.resumo.trim()) ajustes.resumo = resumoLimpo;
    }
    if (Array.isArray(atual.areas)) {
      const mantidas = atual.areas.filter(item => !registroTeste(item));
      if (mantidas.length !== atual.areas.length) ajustes.areas = mantidas;
    }
    if (Array.isArray(atual.estatisticas)) {
      const mantidas = atual.estatisticas.filter(item => !registroTeste(item));
      if (mantidas.length !== atual.estatisticas.length) ajustes.estatisticas = mantidas;
    }
    const camposAlterados = Object.keys(ajustes);
    if (!camposAlterados.length) {
      mensagem('Nenhum dos dados de teste conhecidos foi encontrado no Firebase.');
      return;
    }
    if (!confirm('Corrigir no Firestore os dados de teste nos campos: ' +
      camposAlterados.join(', ') + '? Essa operação sobrescreve apenas esses campos.')) return;
    await updateDoc(perfilRef, { ...ajustes, atualizadoEm: new Date().toISOString() });
    await carregarPerfil();
    mensagem('Dados de teste corrigidos no Firebase. Atualize a página pública para conferir.');
  } catch (erro) { falha('limpar os dados de teste', erro); }
  finally { botaoLimpar.disabled = false; }
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
      await carregarEquipe(); mensagem('Papel atualizado.');
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
    situacao.textContent = c.status === 'uploading' ? 'Envio incompleto' : c.status;
    card.append(h, situacao, p);
    for (const a of c.arquivos || []) {
      const b = botao('Abrir: ' + a.nome, async () => {
        const url = await getDownloadURL(ref(storage, a.caminho));
        window.open(url, '_blank', 'noopener');
      });
      card.append(b);
    }
    if (c.status !== 'uploading') {
      const actions = document.createElement('div'); actions.className = 'linha';
      actions.append(
        botao('Aceitar', async () => { await updateDoc(doc(db, 'casos', c.id), { status: 'aceito' }); await carregarCasos(); }),
        botao('Recusar', async () => { await updateDoc(doc(db, 'casos', c.id), { status: 'recusado', liberadoParaEstagiario: false }); await carregarCasos(); })
      );
      const estagiarios = equipe.filter(e => e.role === 'estagiario');
      if (estagiarios.length) {
        const select = document.createElement('select'); select.setAttribute('aria-label', 'Estagiário responsável');
        for (const e of estagiarios) {
          const opt = document.createElement('option'); opt.value = e.uid; opt.textContent = e.nome || e.email;
          opt.selected = e.uid === c.estagiarioUid; select.append(opt);
        }
        actions.append(select, botao('Atribuir', async () => {
          await updateDoc(doc(db, 'casos', c.id), {
            estagiarioUid: select.value, liberadoParaEstagiario: true, status: 'com-estagiario'
          });
          await carregarCasos();
        }));
      }
      if (c.liberadoParaEstagiario) {
        actions.append(botao('Revogar acesso da equipe', async () => {
          await updateDoc(doc(db, 'casos', c.id), { liberadoParaEstagiario: false, estagiarioUid: null, status: 'aceito' });
          await carregarCasos();
        }));
      }
      card.append(actions);
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
