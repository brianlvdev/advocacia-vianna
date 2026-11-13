import { exigirPapel } from './guard.js';
import { auth, db, storage } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  collection, doc, setDoc, getDocs, query, where, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const { usuario } = await exigirPapel(['cliente']);

document.getElementById('boas-vindas').textContent = 'Olá, ' + usuario.displayName;
document.getElementById('btn-sair')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'index.html';
});

const TIPOS = ['application/pdf', 'text/plain'];
const LIMITE = 10 * 1024 * 1024;

function tipoPermitido(arquivo) {
  return arquivo.type.startsWith('image/') || TIPOS.includes(arquivo.type);
}

document.getElementById('form-caso').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const aviso = document.getElementById('aviso');
  const arquivos = [...document.getElementById('arquivos').files];

  for (const a of arquivos) {
    if (!tipoPermitido(a) || a.size > LIMITE) {
      aviso.textContent = 'Arquivo inválido: ' + a.name + ' (tipo não aceito ou maior que 10 MB).';
      return;
    }
  }

  aviso.textContent = 'Enviando...';

  try {
    const casoRef = doc(collection(db, 'casos'));
    const enviados = [];

    for (const a of arquivos) {
      const caminho = 'casos/' + usuario.uid + '/' + casoRef.id + '/' + a.name;
      await uploadBytes(ref(storage, caminho), a);
      enviados.push({ nome: a.name, caminho, tipo: a.type, tamanho: a.size });
    }
    const perfil = await getDoc(doc(db, 'site', 'perfil'));
    if (perfil.exists() && perfil.data().agendaUrl) {
      const botao = document.getElementById('btn-agendar');
      botao.href = perfil.data().agendaUrl;
      botao.target = '_blank';
      botao.rel = 'noopener';
    }
    await setDoc(casoRef, {
      clienteUid: usuario.uid,
      clienteNome: usuario.displayName,
      clienteEmail: usuario.email,
      assunto: document.getElementById('assunto').value,
      resumo: document.getElementById('resumo').value.trim(),
      arquivos: enviados,
      status: 'novo',
      liberadoParaEstagiario: false,
      criadoEm: serverTimestamp()
    });

    document.getElementById('form-caso').reset();
    aviso.textContent = 'Enviado! A advogada vai analisar o seu caso.';
    carregarCasos();
  } catch (erro) {
    console.error(erro);
    aviso.textContent = 'Erro ao enviar. Tente novamente.';
  }
});
query(collection(db, 'agendamentos'), where('clienteUid', '==', usuario.uid))
async function carregarCasos() {
  const lista = document.getElementById('lista-casos');
  lista.replaceChildren();

  const q = query(collection(db, 'casos'), where('clienteUid', '==', usuario.uid));
  const resultado = await getDocs(q);

  const casos = resultado.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));

  for (const c of casos) {
    const card = document.createElement('article');
    card.className = 'caso';

    const titulo = document.createElement('h3');
    titulo.textContent = c.assunto;

    const etiqueta = document.createElement('span');
    etiqueta.className = 'etiqueta';
    etiqueta.textContent = c.status;

    const texto = document.createElement('p');
    texto.textContent = c.resumo;

    card.append(titulo, etiqueta, texto);

    for (const arq of c.arquivos || []) {
      const url = await getDownloadURL(ref(storage, arq.caminho));
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = arq.nome;
      card.append(document.createElement('br'), link);
    }

    lista.appendChild(card);
  }
}

carregarCasos();