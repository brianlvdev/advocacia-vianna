import { exigirPapel } from './guard.js';
import { db, functions } from './firebase-config.js';
import {
  doc, getDoc, getDocs, collection
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

await exigirPapel(['cliente']);
const aviso = document.getElementById('aviso');
const area = document.getElementById('horarios');
const reservarHorario = httpsCallable(functions, 'criarAgendamento');
const padrao = { diasSemana: [1, 4], inicio: '09:00', fim: '17:00', duracaoMin: 30 };
let cfg = padrao;

function gerarSlots() {
  const slots = [];
  const agora = Date.now();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [hi, mi] = cfg.inicio.split(':').map(Number);
  const [hf, mf] = cfg.fim.split(':').map(Number);
  const passo = cfg.duracaoMin * 60000;
  if (!Number.isInteger(passo) || passo <= 0) return [];
  for (let i = 0; i <= 14; i++) {
    const dia = new Date(hoje);
    dia.setDate(hoje.getDate() + i);
    if (!cfg.diasSemana.includes(dia.getDay())) continue;
    const limite = new Date(dia);
    limite.setHours(hf, mf, 0, 0);
    let atual = new Date(dia);
    atual.setHours(hi, mi, 0, 0);
    while (atual.getTime() + passo <= limite.getTime()) {
      if (atual.getTime() > agora + 30 * 60000 && atual.getTime() <= agora + 14 * 86400000) {
        slots.push(new Date(atual));
      }
      atual = new Date(atual.getTime() + passo);
    }
  }
  return slots;
}

async function mostrar() {
  area.replaceChildren();
  try {
    const ocupados = new Set((await getDocs(collection(db, 'ocupados'))).docs.map(d => d.id));
    let diaAtual = '';
    let bloco = null;
    for (const slot of gerarSlots()) {
      if (ocupados.has(String(slot.getTime()))) continue;
      const rotuloDia = slot.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
      if (rotuloDia !== diaAtual) {
        diaAtual = rotuloDia;
        const titulo = document.createElement('h3');
        titulo.textContent = rotuloDia;
        bloco = document.createElement('div');
        bloco.className = 'linha horarios-linha';
        area.append(titulo, bloco);
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-horario';
      b.textContent = slot.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      b.addEventListener('click', () => reservar(slot, b));
      bloco.appendChild(b);
    }
    if (!area.hasChildNodes()) area.textContent = 'Não há horários livres no momento.';
  } catch (erro) {
    console.error(erro);
    aviso.textContent = 'Não foi possível consultar os horários. Tente atualizar a página.';
  }
}

async function reservar(slot, botao) {
  if (!confirm('Solicitar reunião em ' + slot.toLocaleString('pt-BR') + '?')) return;
  botao.disabled = true;
  aviso.textContent = 'Enviando sua solicitação...';
  try {
    await reservarHorario({ inicioMs: slot.getTime() });
    aviso.textContent = 'Solicitação recebida. A confirmação será feita pelo escritório.';
  } catch (erro) {
    console.error(erro);
    aviso.textContent = erro.code?.includes('already-exists')
      ? 'Esse horário já foi reservado. Escolha outro.'
      : 'Não foi possível reservar. Verifique o horário ou tente mais tarde.';
  } finally {
    await mostrar();
  }
}

try {
  const cfgSnap = await getDoc(doc(db, 'config', 'disponibilidade'));
  if (cfgSnap.exists()) cfg = { ...padrao, ...cfgSnap.data() };
  await mostrar();
} catch (erro) {
  console.error(erro);
  aviso.textContent = 'Não foi possível carregar a disponibilidade.';
}
