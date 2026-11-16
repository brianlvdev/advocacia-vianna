import { exigirPapel } from "./guard.js";
import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const { usuario } = await exigirPapel(['estagiario']);

document.getElementById('boas-vindas').textContent = 'Olá, ' + usuario.displayName;

document.getElementById('btn-sair').addEventListener('click', async() => {
    await signOut(auth);
    window.location.href ='index.html';
})
import { exigirPapel } from './guard.js';
import { auth, db } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  collection, doc, getDocs, query, where, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const { usuario } = await exigirPapel(['estagiario']);

document.getElementById('btn-sair').addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'index.html';
});

const tarefas = (await getDocs(query(
  collection(db, 'tarefas'), where('estagiarioUid', '==', usuario.uid)
))).docs.map((d) => ({ id: d.id, ...d.data() }));

new FullCalendar.Calendar(document.getElementById('calendario'), {
  locale: 'pt-br',
  initialView: 'dayGridMonth',
  headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
  events: tarefas.map((t) => ({
    title: t.titulo,
    start: t.data,
    color: t.concluida ? '#9e9e9e' : '#b8975a'
  }))
}).render();

const lista = document.getElementById('lista-tarefas');
tarefas.forEach((t) => {
  const linha = document.createElement('label');
  const caixa = document.createElement('input');
  caixa.type = 'checkbox';
  caixa.checked = t.concluida;
  caixa.addEventListener('change', () => updateDoc(doc(db, 'tarefas', t.id), { concluida: caixa.checked }));
  linha.append(caixa, ' ' + t.titulo + ' (' + t.data + ')');
  lista.appendChild(linha);
});

const casos = (await getDocs(query(
  collection(db, 'casos'),
  where('liberadoParaEstagiario', '==', true),
  where('estagiarioUid', '==', usuario.uid)
))).docs.map((d) => ({ id: d.id, ...d.data() }));

const areaCasos = document.getElementById('lista-casos');
casos.forEach((c) => {
  const card = document.createElement('article');
  card.className = 'caso';
  const titulo = document.createElement('h3');
  titulo.textContent = c.assunto;
  const texto = document.createElement('p');
  texto.textContent = c.resumo;
  card.append(titulo, texto);
  areaCasos.appendChild(card);
});