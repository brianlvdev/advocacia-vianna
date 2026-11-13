import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const snap = await getDoc(doc(db, 'site', 'perfil'));

if (snap.exists()) {
  const d = snap.data();

  if (d.resumo) document.getElementById('texto-sobre').textContent = d.resumo;
  if (d.fotoUrl) document.getElementById('foto-advogada').src = d.fotoUrl;
  if (d.endereco) document.getElementById('item-endereco').textContent = d.endereco;
  if (d.email) document.getElementById('link-email').href = 'mailto:' + d.email;
  if (d.instagram) document.getElementById('link-instagram').href = 'https://instagram.com/' + d.instagram;

  if (d.whatsapp) {
    const msg = encodeURIComponent('Olá, Dra. Ludmila Vianna');
    document.getElementById('link-whats').href = 'https://wa.me/' + d.whatsapp + '?text=' + msg;
  }

  if (d.jusbrasilUrl) {
    const link = document.getElementById('link-jusbrasil');
    link.href = d.jusbrasilUrl;
    link.hidden = false;
  }

  const listaAreas = document.getElementById('lista-areas');
  (d.areas || []).forEach((a) => {
    const card = document.createElement('article');
    card.className = 'card';
    const titulo = document.createElement('h3');
    titulo.textContent = a.titulo;
    const texto = document.createElement('p');
    texto.textContent = a.descricao;
    card.append(titulo, texto);
    listaAreas.appendChild(card);
  });

  const listaStats = document.getElementById('lista-stats');
  (d.estatisticas || []).forEach((s) => {
    const card = document.createElement('article');
    card.className = 'card';
    const valor = document.createElement('h3');
    valor.textContent = s.valor;
    const rotulo = document.createElement('p');
    rotulo.textContent = s.rotulo;
    card.append(valor, rotulo);
    listaStats.appendChild(card);
  });
}