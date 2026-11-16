import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  ENDERECO_ESCRITORIO, enderecoSeguro, ehTextoTeste,
  limparBioTeste, lerPercentual, registroTeste
} from './conteudo-institucional.js';

function externo(id, destino) {
  try {
    const url = new URL(destino);
    if (url.protocol !== 'https:') return;
    const link = document.getElementById(id);
    if (!link) return;
    link.href = url.href;
    link.hidden = false;
  } catch (erro) { console.warn('Link público inválido:', id, erro); }
}

function atualizarEndereco(valor) {
  const endereco = enderecoSeguro(valor);
  document.getElementById('item-endereco').textContent = endereco;
  document.getElementById('endereco-mapa').textContent = endereco + ', Brasil';
  document.getElementById('mapa-escritorio').src =
    'https://www.google.com/maps?q=' + encodeURIComponent(endereco) + '&output=embed';
  document.getElementById('link-como-chegar').href =
    'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(endereco);
}

function criarArea(area, indice) {
  const card = document.createElement('article');
  card.className = 'card';
  const numero = document.createElement('span'); numero.className = 'card-numero';
  numero.textContent = String(indice + 1).padStart(2, '0');
  const h = document.createElement('h3'); h.textContent = area.titulo;
  const p = document.createElement('p'); p.textContent = area.descricao || '';
  card.append(numero, h, p);
  return card;
}

function criarCirculo(rotulo, percentual) {
  const card = document.createElement('article');
  card.className = 'card card-percentual';
  const grafico = document.createElement('div');
  grafico.className = 'grafico-percentual';
  grafico.style.setProperty('--progresso', percentual + '%');
  grafico.setAttribute('role', 'img');
  const numeroFormatado = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(percentual);
  grafico.setAttribute('aria-label', rotulo + ': ' + numeroFormatado + ' por cento, valor informado manualmente');
  const miolo = document.createElement('span'); miolo.className = 'grafico-miolo';
  const valor = document.createElement('strong'); valor.textContent = numeroFormatado + '%';
  miolo.append(valor); grafico.append(miolo);
  const texto = document.createElement('p'); texto.className = 'percentual-rotulo';
  texto.textContent = rotulo;
  card.append(grafico, texto);
  return card;
}

// A página estática mostra o endereço correto mesmo se o Firestore
// ainda conservar o antigo endereço de teste.
atualizarEndereco(ENDERECO_ESCRITORIO);

try {
  const snap = await getDoc(doc(db, 'site', 'perfil'));
  if (snap.exists()) {
    const d = snap.data();
    if (typeof d.resumo === 'string') {
      const resumo = limparBioTeste(d.resumo);
      if (resumo && !ehTextoTeste(resumo)) {
        document.getElementById('texto-sobre').textContent = resumo;
      }
    }
    if (d.fotoUrl) {
      try {
        const url = new URL(d.fotoUrl);
        if (url.protocol === 'https:') {
          document.getElementById('foto-advogada').src = url.href;
          document.getElementById('foto-advogada-capa').src = url.href;
        }
      } catch (erro) { console.warn('Foto institucional inválida:', erro); }
    }
    atualizarEndereco(d.endereco);

    if (typeof d.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
      const a = document.getElementById('link-email');
      a.href = 'mailto:' + d.email;
      a.hidden = false;
    }
    if (typeof d.whatsapp === 'string' && /^\d{10,15}$/.test(d.whatsapp)) {
      document.getElementById('link-whats').href = 'https://wa.me/' + d.whatsapp +
        '?text=' + encodeURIComponent('Olá, gostaria de informações sobre atendimento jurídico.');
    }
    if (typeof d.instagram === 'string' && /^[a-zA-Z0-9._]{1,30}$/.test(d.instagram)) {
      externo('link-instagram', 'https://www.instagram.com/' + d.instagram + '/');
    }
    if (d.linkedinUrl) externo('link-linkedin', d.linkedinUrl);
    if (d.jusbrasilUrl) externo('link-jusbrasil', d.jusbrasilUrl);

    const areas = Array.isArray(d.areas)
      ? d.areas.filter(a => a && typeof a.titulo === 'string' &&
          a.titulo.trim() && !registroTeste(a) && !ehTextoTeste(a.descricao)).slice(0, 12)
      : [];
    if (areas.length) {
      const lista = document.getElementById('lista-areas');
      lista.replaceChildren();
      areas.forEach((area, i) => lista.append(criarArea(area, i)));
    }

    const indicadores = [];
    const vistos = new Set();
    const adicionar = (rotulo, valor) => {
      if (typeof rotulo !== 'string' || !rotulo.trim() || ehTextoTeste(rotulo)) return;
      const percentual = lerPercentual(valor);
      if (percentual === null) return;
      const chave = rotulo.trim().toLocaleLowerCase('pt-BR');
      if (vistos.has(chave)) return;
      vistos.add(chave);
      indicadores.push({ rotulo: rotulo.trim(), percentual });
    };
    // Preferência para a porcentagem vinculada diretamente à área.
    areas.forEach(area => adicionar(area.titulo, area.percentual));
    // Compatibilidade com indicadores manuais já salvos no Firestore.
    if (Array.isArray(d.estatisticas)) {
      d.estatisticas.filter(s => s && !registroTeste(s))
        .forEach(s => adicionar(s.rotulo, s.valor));
    }
    if (indicadores.length) {
      const lista = document.getElementById('lista-stats');
      lista.replaceChildren();
      indicadores.slice(0, 12).forEach(i => lista.append(criarCirculo(i.rotulo, i.percentual)));
      document.getElementById('numeros').hidden = false;
    }
  }
} catch (erro) {
  console.error('Não foi possível carregar o perfil institucional:', erro);
}
