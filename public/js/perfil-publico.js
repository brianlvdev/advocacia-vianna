import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
function externo(id, destino) {
  try {
    const url = new URL(destino);
    if (url.protocol !== 'https:') return;
    const link = document.getElementById(id);
    link.href = url.href;
    link.hidden = false;
  } catch (erro) { console.warn('URL pública inválida:', id); }
}
try {
  const snap = await getDoc(doc(db, 'site', 'perfil'));
  if (snap.exists()) {
    const d = snap.data();
    if (d.resumo) document.getElementById('texto-sobre').textContent = d.resumo;
    if (d.fotoUrl) {
      try {
        const url = new URL(d.fotoUrl);
        if (url.protocol === 'https:') {
          document.getElementById('foto-advogada').src = url.href;
          const capa = document.getElementById('foto-advogada-capa');
          if (capa) capa.src = url.href;
        }
      } catch (erro) { console.warn('Foto inválida.'); }
    }
    if (typeof d.endereco === 'string' && d.endereco.trim()) {
      const endereco = d.endereco.trim();
      document.getElementById('item-endereco').textContent = endereco;
      document.getElementById('endereco-mapa').textContent = endereco + ', Brasil';
      document.getElementById('mapa-escritorio').src =
        'https://www.google.com/maps?q=' + encodeURIComponent(endereco) + '&output=embed';
      document.getElementById('link-como-chegar').href =
        'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(endereco);
    }
    if (typeof d.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
      const a = document.getElementById('link-email');
      a.href = 'mailto:' + d.email;
      a.hidden = false;
    }
    if (typeof d.whatsapp === 'string' && /^\d{10,15}$/.test(d.whatsapp)) {
      const a = document.getElementById('link-whats');
      a.href = 'https://wa.me/' + d.whatsapp + '?text=' + encodeURIComponent('Olá, gostaria de informações sobre atendimento jurídico.');
      a.hidden = false;
    }
    if (typeof d.instagram === 'string' && /^[a-zA-Z0-9._]{1,30}$/.test(d.instagram))
      externo('link-instagram', 'https://www.instagram.com/' + d.instagram + '/');
    if (d.linkedinUrl) externo('link-linkedin', d.linkedinUrl);
    if (d.jusbrasilUrl) externo('link-jusbrasil', d.jusbrasilUrl);
    if (Array.isArray(d.areas) && d.areas.length) {
      const lista = document.getElementById('lista-areas');
      lista.replaceChildren();
      d.areas.filter(a => a && a.titulo).slice(0,12).forEach((a,i) => {
        const card = document.createElement('article');
        card.className = 'card';
        const num = document.createElement('span'); num.className = 'card-numero'; num.textContent = String(i+1).padStart(2,'0');
        const h = document.createElement('h3'); h.textContent = a.titulo;
        const p = document.createElement('p'); p.textContent = a.descricao || '';
        card.append(num,h,p); lista.append(card);
      });
    }
    if (Array.isArray(d.estatisticas) && d.estatisticas.length) {
      const lista = document.getElementById('lista-stats');
      d.estatisticas.filter(s => s && s.rotulo && s.valor).slice(0,8).forEach(s => {
        const card = document.createElement('article'); card.className = 'card';
        const h = document.createElement('h3'); h.textContent = s.valor;
        const p = document.createElement('p'); p.textContent = s.rotulo;
        card.append(h,p); lista.append(card);
      });
      if (lista.hasChildNodes()) document.getElementById('numeros').hidden = false;
    }
  }
} catch (erro) { console.error('Não foi possível carregar os dados institucionais:', erro); }
