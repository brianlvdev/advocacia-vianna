import { exigirPapel } from './guard.js';
import { auth, db, storage, functions } from './backend.js';
import { signOut } from './backend.js';
import {
  collection, doc, setDoc, updateDoc, getDocs, query, where, serverTimestamp
} from './backend.js';
import { ref, uploadBytes, abrirDocumento } from './backend.js';
import { httpsCallable } from './backend.js';
const cancelarReuniao = httpsCallable(functions, 'cancelarMeuAgendamento');

const { usuario } = await exigirPapel(['cliente']);
document.getElementById('boas-vindas').textContent =
  'Olá, ' + (usuario.displayName || 'bem-vindo(a)');
document.getElementById('btn-sair').addEventListener('click', async () => {
  await signOut(auth);
  window.location.replace('index.html');
});

const TIPOS = new Set(['application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'image/webp']);
const LIMITE = 10 * 1024 * 1024;
const aviso = document.getElementById('aviso');
const formulario = document.getElementById('form-caso');
const enviar = formulario.querySelector('button[type=submit]');

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const arquivos = [...document.getElementById('arquivos').files];
  const resumo = document.getElementById('resumo').value.trim();
  if (resumo.length < 10 || resumo.length > 8000) {
    aviso.textContent = 'Descreva seu caso entre 10 e 8.000 caracteres.';
    return;
  }
  if (arquivos.length > 8 || arquivos.some(a => !TIPOS.has(a.type) || a.size > LIMITE)) {
    aviso.textContent = 'Envie até 8 arquivos PDF, TXT, JPEG, PNG ou WEBP com até 10 MB cada.';
    return;
  }
  enviar.disabled = true;
  aviso.textContent = 'Registrando seu caso...';
  try {
    const casoRef = doc(collection(db, 'casos'));
    await setDoc(casoRef, {
      clienteUid: usuario.uid,
      clienteNome: (usuario.displayName || 'Cliente').slice(0, 120),
      clienteEmail: usuario.email,
      assunto: document.getElementById('assunto').value,
      resumo,
      arquivos: [],
      status: 'uploading',
      liberadoParaEstagiario: false,
      criadoEm: serverTimestamp()
    });
    const enviados = [];
    for (const arquivo of arquivos) {
      const id = crypto.randomUUID();
      const caminho = 'casos/' + usuario.uid + '/' + casoRef.id + '/' + id;
      aviso.textContent = 'Enviando ' + arquivo.name + '...';
      await uploadBytes(ref(storage, caminho), arquivo, { contentType: arquivo.type });
      enviados.push({
        nome: arquivo.name.slice(0, 180),
        caminho, tipo: arquivo.type, tamanho: arquivo.size
      });
    }
    await updateDoc(casoRef, { arquivos: enviados, status: 'novo' });
    formulario.reset();
    aviso.textContent = 'Caso enviado. O escritório analisará suas informações.';
    await carregarCasos();
  } catch (erro) {
    console.error(erro);
    aviso.textContent = 'Falha no envio. Se o registro foi iniciado, entre em contato com o escritório antes de reenviar.';
  } finally {
    enviar.disabled = false;
  }
});

async function carregarCasos() {
  const lista = document.getElementById('lista-casos');
  lista.replaceChildren();
  try {
    const resultado = await getDocs(query(collection(db, 'casos'), where('clienteUid', '==', usuario.uid)));
    const casos = resultado.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
    if (!casos.length) lista.textContent = 'Você ainda não enviou nenhum caso.';
    for (const caso of casos) {
      const card = document.createElement('article');
      card.className = 'caso';
      const titulo = document.createElement('h3');
      titulo.textContent = caso.assunto;
      const etiqueta = document.createElement('span');
      etiqueta.className = 'etiqueta';
      etiqueta.textContent = caso.status === 'uploading' ? 'Envio incompleto' : caso.status;
      const texto = document.createElement('p');
      texto.textContent = caso.resumo;
      card.append(titulo, etiqueta, texto);
      for (const arq of caso.arquivos || []) {
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = arq.nome;
        link.addEventListener('click', async e => {
          e.preventDefault();
          try {
            await abrirDocumento(ref(storage, arq.caminho));
          } catch (erro) {
            console.error(erro);
            alert('Não foi possível abrir o documento.');
          }
        });
        card.append(link);
      }
      lista.appendChild(card);
    }
  } catch (erro) {
    console.error(erro);
    lista.textContent = 'Não foi possível carregar os casos.';
  }
}

async function carregarReunioes() {
  const lista = document.getElementById('lista-reunioes');
  try {
    const resultado = await getDocs(query(collection(db, 'agendamentos'),
      where('clienteUid', '==', usuario.uid)));
    const reunioes = resultado.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
    lista.replaceChildren();
    if (!reunioes.length) lista.textContent = 'Nenhuma reunião solicitada.';
    reunioes.forEach(a => {
      const card = document.createElement('article');
      card.className = 'caso';
      const h = document.createElement('h3');
      h.textContent = new Date(a.inicio).toLocaleString('pt-BR');
      const p = document.createElement('p');
      p.textContent = 'Situação: ' + a.status;
      card.append(h, p);
      if (a.status === 'pendente') {
        const cancelar = document.createElement('button');
        cancelar.type = 'button';
        cancelar.className = 'btn btn-secundario';
        cancelar.textContent = 'Cancelar solicitação';
        cancelar.addEventListener('click', async () => {
          if (!confirm('Cancelar esta solicitação de reunião?')) return;
          cancelar.disabled = true;
          try {
            await cancelarReuniao({ id: a.id });
            await carregarReunioes();
          } catch (erro) {
            console.error(erro);
            alert('Não foi possível cancelar. Verifique se a reunião ainda está pendente.');
            cancelar.disabled = false;
          }
        });
        card.append(cancelar);
      }
      if (a.status === 'confirmado' && a.meetUrl) {
        const link = document.createElement('a');
        link.href = a.meetUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Acessar reunião';
        card.append(link);
      }
      lista.append(card);
    });
  } catch (erro) {
    console.error(erro);
    lista.textContent = 'Não foi possível consultar as reuniões.';
  }
}

await Promise.all([carregarCasos(), carregarReunioes()]);
