import { exigirPapel } from './guard.js';
import { auth, db, storage, functions } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc, collection, getDocs, updateDoc, getDoc, setDoc, query, where
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

const { usuario } = await exigirPapel(['admin']);
const atualizarAgendamento = httpsCallable(functions, 'atualizarAgendamento');
document.getElementById('boas-vindas').textContent =
  'Olá, ' + (usuario.displayName || 'bem-vinda');
document.getElementById('btn-sair').addEventListener('click', async () => {
  await signOut(auth);
  window.location.replace('index.html');
});

const aviso = document.getElementById('aviso');
function erro(operacao, detalhe) {
  console.error(operacao, detalhe);
  aviso.textContent = 'Não foi possível ' + operacao + '. Verifique sua conexão e permissões.';
}
function botao(texto, acao) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn btn-secundario';
  b.textContent = texto;
  b.addEventListener('click', async () => {
    b.disabled = true;
    try { await acao(); } catch (e) { erro('concluir a operação', e); }
    finally { b.disabled = false; }
  });
  return b;
}

async function carregarAgenda() {
  const agendamentos = await getDocs(collection(db, 'agendamentos'));
  const cores = { confirmado: '#347c65', pendente: '#b8975a', cancelado: '#949ba4' };
  const eventos = agendamentos.docs.map(d => {
    const a = d.data();
    return { id: d.id, title: a.clienteNome || 'Reunião', start: a.inicio,
      end: a.fim, color: cores[a.status] || '#666',
      extendedProps: { status: a.status } };
  });
  const elemento = document.getElementById('calendario');
  if (!window.FullCalendar) { elemento.textContent = 'O calendário não pôde ser carregado.'; return; }
  new FullCalendar.Calendar(elemento, {
    locale: 'pt-br', initialView: 'dayGridMonth',
    headerToolbar: { left: 'prev,next today', center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay' },
    events: eventos,
    eventClick: async info => {
      if (info.event.extendedProps.status === 'cancelado') {
        alert('Agendamento cancelado.');
        return;
      }
      const acao = prompt('Digite 1 para CONFIRMAR ou 2 para CANCELAR esta reunião.');
      if (acao !== '1' && acao !== '2') return;
      if (acao === '2' && !confirm('Cancelar este agendamento?')) return;
      const meetUrl = acao === '1'
        ? (prompt('Link do Google Meet (opcional):') || '').trim() : '';
      try {
        await atualizarAgendamento({
          id: info.event.id, acao: acao === '1' ? 'confirmar' : 'cancelar', meetUrl
        });
        window.location.reload();
      } catch (e) { erro('atualizar o agendamento', e); }
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
  try {
    const dias = [...document.querySelectorAll('input[name=dia]:checked')].map(c => Number(c.value));
    const inicio = document.getElementById('disp-inicio').value;
    const fim = document.getElementById('disp-fim').value;
    const duracaoMin = Number(document.getElementById('disp-duracao').value);
    if (!dias.length || inicio >= fim || !Number.isInteger(duracaoMin)
        || duracaoMin < 15 || duracaoMin > 120) {
      aviso.textContent = 'Defina pelo menos um dia, início anterior ao fim e duração entre 15 e 120 minutos.';
      return;
    }
    await setDoc(dispRef, { diasSemana: dias, inicio, fim, duracaoMin });
    aviso.textContent = 'Disponibilidade salva.';
  } catch (e) { erro('salvar disponibilidade', e); }
});

const perfilRef = doc(db, 'site', 'perfil');
const CAMPOS = ['resumo', 'endereco', 'whatsapp', 'email', 'instagram', 'jusbrasilUrl', 'agendaUrl'];
const CAMPOS_AREA = [{ chave: 'titulo', rotulo: 'Título' }, { chave: 'descricao', rotulo: 'Descrição' }];
const CAMPOS_STAT = [{ chave: 'rotulo', rotulo: 'Rótulo' }, { chave: 'valor', rotulo: 'Valor' }];
const listaAreas = document.getElementById('lista-areas');
const listaStats = document.getElementById('lista-stats');
function criarLinha(lista, campos, valores = {}) {
  const linha = document.createElement('div');
  linha.className = 'linha';
  campos.forEach(c => {
    const input = document.createElement('input');
    input.placeholder = c.rotulo;
    input.setAttribute('aria-label', c.rotulo);
    input.dataset.campo = c.chave;
    input.value = valores[c.chave] || '';
    linha.appendChild(input);
  });
  linha.appendChild(botao('Remover', () => linha.remove()));
  lista.appendChild(linha);
}
function lerLinhas(lista) {
  return [...lista.querySelectorAll('.linha')].map(linha => {
    const obj = {};
    linha.querySelectorAll('input').forEach(i => { obj[i.dataset.campo] = i.value.trim(); });
    return obj;
  }).filter(obj => Object.values(obj).some(Boolean));
}
async function carregarPerfil() {
  const snap = await getDoc(perfilRef);
  const dados = snap.exists() ? snap.data() : {};
  CAMPOS.forEach(c => { document.getElementById(c).value = dados[c] || ''; });
  (dados.areas || []).forEach(a => criarLinha(listaAreas, CAMPOS_AREA, a));
  (dados.estatisticas || []).forEach(s => criarLinha(listaStats, CAMPOS_STAT, s));
}
document.getElementById('add-area').addEventListener('click', () => criarLinha(listaAreas, CAMPOS_AREA));
document.getElementById('add-stat').addEventListener('click', () => criarLinha(listaStats, CAMPOS_STAT));
document.getElementById('form-perfil').addEventListener('submit', async e => {
  e.preventDefault();
  aviso.textContent = 'Salvando alterações...';
  try {
    const novo = {};
    CAMPOS.forEach(c => { novo[c] = document.getElementById(c).value.trim(); });
    novo.areas = lerLinhas(listaAreas);
    novo.estatisticas = lerLinhas(listaStats);
    novo.atualizadoEm = new Date().toISOString();
    const arquivo = document.getElementById('foto').files[0];
    if (arquivo) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type)
          || arquivo.size > 5 * 1024 * 1024) {
        aviso.textContent = 'Foto: use JPEG, PNG ou WEBP até 5 MB.';
        return;
      }
      const fotoRef = ref(storage, 'site/foto-perfil');
      await uploadBytes(fotoRef, arquivo, { contentType: arquivo.type });
      novo.fotoUrl = await getDownloadURL(fotoRef);
    }
    await setDoc(perfilRef, novo, { merge: true });
    aviso.textContent = 'Alterações salvas com sucesso.';
  } catch (e) { erro('salvar o perfil', e); }
});

async function carregarCasos() {
  const lista = document.getElementById('lista-casos');
  lista.replaceChildren();
  const [usuarios, todos] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('role', '==', 'estagiario'))),
    getDocs(collection(db, 'casos'))
  ]);
  const estagiarios = usuarios.docs.map(d => ({ uid: d.id, ...d.data() }));
  const casos = todos.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
  if (!casos.length) lista.textContent = 'Nenhum caso recebido até o momento.';
  for (const c of casos) {
    const card = document.createElement('article');
    card.className = 'caso';
    const titulo = document.createElement('h3');
    titulo.textContent = (c.clienteNome || 'Cliente') + ' — ' + c.assunto;
    const etiqueta = document.createElement('span');
    etiqueta.className = 'etiqueta';
    etiqueta.textContent = c.status;
    const texto = document.createElement('p');
    texto.textContent = c.resumo;
    card.append(titulo, etiqueta, texto);
    for (const arq of c.arquivos || []) {
      const link = document.createElement('a');
      link.textContent = arq.nome;
      link.href = '#';
      link.addEventListener('click', async e => {
        e.preventDefault();
        try {
          window.open(await getDownloadURL(ref(storage, arq.caminho)), '_blank', 'noopener');
        } catch (erro) { console.error(erro); alert('Não foi possível abrir o documento.'); }
      });
      card.append(link);
    }
    const casoRef = doc(db, 'casos', c.id);
    const acoes = document.createElement('div');
    acoes.className = 'linha';
    if (c.status !== 'uploading') {
      acoes.append(
        botao('Aceitar', async () => { await updateDoc(casoRef, { status: 'aceito' }); await carregarCasos(); }),
        botao('Recusar', async () => { await updateDoc(casoRef, { status: 'recusado' }); await carregarCasos(); })
      );
      if (estagiarios.length) {
        const seletor = document.createElement('select');
        seletor.setAttribute('aria-label', 'Selecionar estagiário');
        estagiarios.forEach(est => {
          const op = document.createElement('option');
          op.value = est.uid;
          op.textContent = est.nome;
          if (c.estagiarioUid === est.uid) op.selected = true;
          seletor.appendChild(op);
        });
        acoes.append(seletor, botao('Atribuir', async () => {
          await updateDoc(casoRef, { liberadoParaEstagiario: true,
            estagiarioUid: seletor.value, status: 'com-estagiario' });
          await carregarCasos();
        }));
      }
    }
    card.append(acoes);
    lista.appendChild(card);
  }
}

async function carregarEquipe() {
  const area = document.getElementById('lista-clientes');
  area.replaceChildren();
  const clientes = await getDocs(query(collection(db, 'users'), where('role', '==', 'cliente')));
  if (clientes.empty) area.textContent = 'Nenhum cliente cadastrado.';
  clientes.forEach(d => {
    const linha = document.createElement('div');
    linha.className = 'linha equipe-linha';
    const nome = document.createElement('span');
    nome.textContent = (d.data().nome || 'Cliente') + ' (' + (d.data().email || '') + ')';
    linha.append(nome, botao('Tornar estagiário', async () => {
      if (!confirm('Conceder acesso de estagiário a esta conta?')) return;
      await updateDoc(doc(db, 'users', d.id), { role: 'estagiario' });
      await carregarEquipe();
    }));
    area.append(linha);
  });
}

for (const [nome, operacao] of [
  ['agenda', carregarAgenda],
  ['disponibilidade', carregarDisponibilidade],
  ['perfil', carregarPerfil],
  ['casos', carregarCasos],
  ['equipe', carregarEquipe]
]) {
  try { await operacao(); } catch (e) { erro('carregar ' + nome, e); }
}
