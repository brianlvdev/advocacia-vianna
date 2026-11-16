import { exigirPapel } from './guard.js';
import { auth, db, storage } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { ref, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import {
  collection, doc, getDocs, query, where, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const { usuario } = await exigirPapel(['estagiario']);
document.getElementById('boas-vindas').textContent =
  'Olá, ' + (usuario.displayName || 'bem-vindo(a)');
document.getElementById('btn-sair').addEventListener('click', async () => {
  await signOut(auth);
  window.location.replace('index.html');
});

try {
  const tarefas = (await getDocs(query(collection(db, 'tarefas'),
    where('estagiarioUid', '==', usuario.uid))))
    .docs.map(d => ({ id: d.id, ...d.data() }));

  if (window.FullCalendar) {
    new FullCalendar.Calendar(document.getElementById('calendario'), {
      locale: 'pt-br',
      initialView: 'dayGridMonth',
      headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
      events: tarefas.map(t => ({
        title: t.titulo, start: t.data, color: t.concluida ? '#999' : '#a37a40'
      }))
    }).render();
  }

  const lista = document.getElementById('lista-tarefas');
  if (!tarefas.length) lista.textContent = 'Nenhuma tarefa atribuída.';
  tarefas.forEach(t => {
    const linha = document.createElement('label');
    linha.className = 'tarefa-linha';
    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.checked = Boolean(t.concluida);
    caixa.addEventListener('change', async () => {
      try {
        await updateDoc(doc(db, 'tarefas', t.id), { concluida: caixa.checked });
      } catch (erro) {
        console.error(erro);
        caixa.checked = !caixa.checked;
        alert('Não foi possível salvar a tarefa.');
      }
    });
    linha.append(caixa, ' ' + t.titulo + ' (' + t.data + ')');
    lista.appendChild(linha);
  });

  const casos = (await getDocs(query(
    collection(db, 'casos'),
    where('liberadoParaEstagiario', '==', true),
    where('estagiarioUid', '==', usuario.uid)
  ))).docs.map(d => d.data());

  const areaCasos = document.getElementById('lista-casos');
  if (!casos.length) areaCasos.textContent = 'Nenhum caso atribuído.';
  casos.forEach(c => {
    const card = document.createElement('article');
    card.className = 'caso';
    const titulo = document.createElement('h3');
    titulo.textContent = c.assunto;
    const texto = document.createElement('p');
    texto.textContent = c.resumo;
    card.append(titulo, texto);
    for (const documento of c.arquivos || []) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-secundario';
      b.textContent = 'Abrir documento: ' + documento.nome;
      b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          const url = await getDownloadURL(ref(storage, documento.caminho));
          window.open(url, '_blank', 'noopener');
        } catch (erro) {
          console.error(erro);
          alert('Acesso ao documento negado ou arquivo indisponível.');
        } finally { b.disabled = false; }
      });
      card.appendChild(b);
    }
    areaCasos.appendChild(card);
  });
} catch (erro) {
  console.error(erro);
  document.getElementById('aviso').textContent = 'Não foi possível carregar o painel.';
}
