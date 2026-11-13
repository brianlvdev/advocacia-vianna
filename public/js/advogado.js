import { exigirPapel } from './guard.js';
import { auth, db, storage } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const { usuario } = await exigirPapel(['admin']);

document.getElementById('boas-vindas').textContent = 'Olá, ' + usuario.displayName;
document.getElementById('btn-sair').addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'index.html';
});

const perfilRef = doc(db, 'site', 'perfil');
const CAMPOS = ['resumo', 'endereco', 'whatsapp', 'email', 'instagram', 'jusbrasilUrl'];
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