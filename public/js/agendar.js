import { exigirPapel } from './guard.js';
import { db } from './firebase-config.js';
import {
  doc, getDoc, getDocs, collection, writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const { usuario } = await exigirPapel(['cliente']);
const aviso = document.getElementById('aviso');
const area = document.getElementById('horarios');

const padrao = { diasSemana: [1, 4], inicio: '09:00', fim: '17:00', duracaoMin: 30 };
const cfgSnap = await getDoc(doc(db, 'config', 'disponibilidade'));
const cfg = cfgSnap.exists() ? cfgSnap.data() : padrao;

function gerarSlots() {
  const slots = [];
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [hi, mi] = cfg.inicio.split(':').map(Number);
  const [hf, mf] = cfg.fim.split(':').map(Number);
  const passo = cfg.duracaoMin * 60000;

  for (let i = 1; i <= 14; i++) {
    const dia = new Date(hoje);
    dia.setDate(hoje.getDate() + i);
    if (!cfg.diasSemana.includes(dia.getDay())) continue;

    const limite = new Date(dia);
    limite.setHours(hf, mf, 0, 0);
    let atual = new Date(dia);
    atual.setHours(hi, mi, 0, 0);

    while (atual.getTime() + passo <= limite.getTime()) {
      slots.push(new Date(atual));
      atual = new Date(atual.getTime() + passo);
    }
  }
  return slots;
}

async function mostrar() {
  area.replaceChildren();
  const ocupados = new Set((await getDocs(collection(db, 'ocupados'))).docs.map((d) => d.id));
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
      bloco.className = 'linha';
      area.append(titulo, bloco);
    }

    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = slot.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    b.addEventListener('click', () => reservar(slot));
    bloco.appendChild(b);
  }

  if (!area.hasChildNodes()) area.textContent = 'Não há horários livres no momento.';
}

async function reservar(slot) {
  if (!confirm('Confirmar reunião em ' + slot.toLocaleString('pt-BR') + '?')) return;

  const id = String(slot.getTime());
  const fim = new Date(slot.getTime() + cfg.duracaoMin * 60000);
  const lote = writeBatch(db);

  lote.set(doc(db, 'ocupados', id), { inicio: slot.toISOString() });
  lote.set(doc(db, 'agendamentos', id), {
    clienteUid: usuario.uid,
    clienteNome: usuario.displayName,
    clienteEmail: usuario.email,
    inicio: slot.toISOString(),
    fim: fim.toISOString(),
    status: 'pendente',
    criadoEm: serverTimestamp()
  });

  try {
    await lote.commit();
    aviso.textContent = 'Solicitação enviada! A advogada vai confirmar o horário.';
  } catch (erro) {
    console.error(erro);
    aviso.textContent = 'Esse horário acabou de ser ocupado. Escolha outro.';
  }
  mostrar();
}

mostrar();