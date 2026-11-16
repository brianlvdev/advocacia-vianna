import { exigirPapel } from './guard.js';
import { auth, db, storage } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, collection, getDocs, updateDoc, getDoc, setDoc, query, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const { usuario } = await exigirPapel(['admin']);
const agendamentos = await getDocs(collection(db, 'agendamentos'));

const cores = { confirmado: '#2e7d32', pendente: '#b8975a', cancelado: '#9e9e9e' };
const eventos = agendamentos.docs.map((d) => {
  const a = d.data();
  return { id: d.id, title: a.clienteNome, start: a.inicio, end: a.fim, color: cores[a.status] };
});

const calendario = new FullCalendar.Calendar(document.getElementById('calendario'), {
  locale: 'pt-br',
  initialView: 'dayGridMonth',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay'
  },
  events: eventos,
  eventClick: async (info) => {
    const acao = prompt('Digite 1 para CONFIRMAR ou 2 para CANCELAR esta reunião.');
    const ref = doc(db, 'agendamentos', info.event.id);

    if (acao === '1') {
      const link = prompt('Cole o link do Google Meet (pode deixar em branco):') || '';
      await updateDoc(ref, { status: 'confirmado', meetUrl: link });
    } else if (acao === '2') {
      await updateDoc(ref, { status: 'cancelado' });
    } else {
      return;
    }
    window.location.reload();
  }
});

calendario.render();


document.getElementById('boas-vindas').textContent = 'Olá, ' + usuario.displayName;
document.getElementById('btn-sair').addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'index.html';
});
const dispRef = doc(db, 'config', 'disponibilidade');
const dispSnap = await getDoc(dispRef);

if (dispSnap.exists()) {
  const d = dispSnap.data();
  document.querySelectorAll('input[name=dia]').forEach((c) => { c.checked = d.diasSemana.includes(Number(c.value)); });
  document.getElementById('disp-inicio').value = d.inicio;
  document.getElementById('disp-fim').value = d.fim;
  document.getElementById('disp-duracao').value = d.duracaoMin;
}

document.getElementById('form-disp').addEventListener('submit', async (e) => {
  e.preventDefault();
  const dias = [...document.querySelectorAll('input[name=dia]:checked')].map((c) => Number(c.value));
  await setDoc(dispRef, {
    diasSemana: dias,
    inicio: document.getElementById('disp-inicio').value,
    fim: document.getElementById('disp-fim').value,
    duracaoMin: Number(document.getElementById('disp-duracao').value)
  });
  alert('Disponibilidade salva!');
});
const perfilRef = doc(db, 'site', 'perfil');
const CAMPOS = ['resumo', 'endereco', 'whatsapp', 'email', 'instagram', 'jusbrasilUrl', 'agendaUrl'];
const CAMPOS_AREA = [{ chave: 'titulo', rotulo: 'Título' }, { chave: 'descricao', rotulo: 'Descrição' }];
const CAMPOS_STAT = [{ chave: 'rotulo', rotulo: 'Rótulo (ex: Casos)' }, { chave: 'valor', rotulo: 'Valor (ex: 120)' }];

const listaAreas = document.getElementById('lista-areas');
const listaStats = document.getElementById('lista-stats');

function criarLinha(lista, campos, valores) {
  const linha = document.createElement('div');
  linha.className = 'linha';

  campos.forEach((c) => {
    const input = document.createElement('input');
    input.placeholder = c.rotulo;
    input.dataset.campo = c.chave;
    input.value = valores[c.chave] || '';
    linha.appendChild(input);
  });

  const remover = document.createElement('button');
  remover.type = 'button';
  remover.textContent = 'Remover';
  remover.addEventListener('click', () => linha.remove());
  linha.appendChild(remover);

  lista.appendChild(linha);
}

function lerLinhas(lista) {
  return [...lista.querySelectorAll('.linha')]
    .map((linha) => {
      const obj = {};
      linha.querySelectorAll('input').forEach((i) => { obj[i.dataset.campo] = i.value.trim(); });
      return obj;
    })
    .filter((obj) => Object.values(obj).some((v) => v));
}

// Carregar dados existentes
const snap = await getDoc(perfilRef);
const dados = snap.exists() ? snap.data() : {};
CAMPOS.forEach((c) => { document.getElementById(c).value = dados[c] || ''; });
(dados.areas || []).forEach((a) => criarLinha(listaAreas, CAMPOS_AREA, a));
(dados.estatisticas || []).forEach((e) => criarLinha(listaStats, CAMPOS_STAT, e));

document.getElementById('add-area').addEventListener('click', () => criarLinha(listaAreas, CAMPOS_AREA, {}));
document.getElementById('add-stat').addEventListener('click', () => criarLinha(listaStats, CAMPOS_STAT, {}));

// Salvar
document.getElementById('form-perfil').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const aviso = document.getElementById('aviso');
  aviso.textContent = 'Salvando...';

  try {
    const novo = {};
    CAMPOS.forEach((c) => { novo[c] = document.getElementById(c).value.trim(); });
    novo.areas = lerLinhas(listaAreas);
    novo.estatisticas = lerLinhas(listaStats);
    novo.atualizadoEm = new Date().toISOString();

    const arquivo = document.getElementById('foto').files[0];
    if (arquivo) {
      const fotoRef = ref(storage, 'site/foto-perfil');
      await uploadBytes(fotoRef, arquivo);
      novo.fotoUrl = await getDownloadURL(fotoRef);
    }

    await setDoc(perfilRef, novo, { merge: true });
    aviso.textContent = 'Salvo com sucesso!';
  } catch (erro) {
    console.error(erro);
    aviso.textContent = 'Erro ao salvar. Tente novamente.';
  }
});
const listaCasos = document.getElementById('lista-casos');

function botao(texto, acao) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = texto;
  b.addEventListener('click', async () => {
    await acao();
    carregarCasos();
  });
  return b;
}

async function carregarCasos() {
  listaCasos.replaceChildren();

  const usuarios = await getDocs(query(collection(db, 'users'), where('role', '==', 'estagiario')));
  const estagiarios = usuarios.docs.map((d) => ({ uid: d.id, ...d.data() }));

  const todos = await getDocs(collection(db, 'casos'));
  const casos = todos.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));

  for (const c of casos) {
    const card = document.createElement('article');
    card.className = 'caso';

    const titulo = document.createElement('h3');
    titulo.textContent = c.clienteNome + ' - ' + c.assunto;
    const etiqueta = document.createElement('span');
    etiqueta.className = 'etiqueta';
    etiqueta.textContent = c.status;
    const texto = document.createElement('p');
    texto.textContent = c.resumo;
    card.append(titulo, etiqueta, texto);

    for (const arq of c.arquivos || []) {
      const link = document.createElement('a');
      link.href = await getDownloadURL(ref(storage, arq.caminho));
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = arq.nome;
      card.append(document.createElement('br'), link);
    }

    const casoRef = doc(db, 'casos', c.id);
    const acoes = document.createElement('div');
    acoes.className = 'linha';
    acoes.append(
      botao('Aceitar', () => updateDoc(casoRef, { status: 'aceito' })),
      botao('Recusar', () => updateDoc(casoRef, { status: 'recusado' }))
    );

    if (estagiarios.length) {
      const seletor = document.createElement('select');
      estagiarios.forEach((e) => {
        const op = document.createElement('option');
        op.value = e.uid;
        op.textContent = e.nome;
        seletor.appendChild(op);
      });
      acoes.append(
        seletor,
        botao('Passar ao estagiário', () => updateDoc(casoRef, {
          liberadoParaEstagiario: true,
          estagiarioUid: seletor.value,
          status: 'com-estagiario'
        }))
      );
    }

    card.appendChild(acoes);
    listaCasos.appendChild(card);
  }
}

carregarCasos();
async function carregarEquipe() {
  const area = document.getElementById('lista-clientes');
  area.replaceChildren();

  const clientes = await getDocs(query(collection(db, 'users'), where('role', '==', 'cliente')));
  clientes.docs.forEach((d) => {
    const linha = document.createElement('div');
    linha.className = 'linha';
    const nome = document.createElement('span');
    nome.textContent = d.data().nome + ' (' + d.data().email + ')';
    linha.append(nome, botao('Tornar estagiário', async () => {
      await updateDoc(doc(db, 'users', d.id), { role: 'estagiario' });
      carregarEquipe();
    }));
    area.appendChild(linha);
  });
}

carregarEquipe();
await addDoc(collection(db, 'tarefas'), {
  titulo,
  data,
  estagiarioUid,
  concluida: false,
  criadoEm: serverTimestamp()
});