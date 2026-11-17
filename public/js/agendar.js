import { exigirPapel } from './guard.js';
import { functions } from './backend.js';
import { httpsCallable } from './backend.js';

await exigirPapel(['cliente']);
const aviso = document.getElementById('aviso');
const area = document.getElementById('horarios');
const consultar = httpsCallable(functions, 'listarHorarios');
const reservar = httpsCallable(functions, 'criarAgendamento');
const opcoesData = { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long' };
const opcoesHora = { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' };
let enviando = false;

async function carregarHorarios() {
  area.replaceChildren();
  const carregando = document.createElement('p');
  carregando.textContent = 'Consultando horários disponíveis...';
  area.append(carregando);
  try {
    const resposta = await consultar({});
    const horarios = resposta.data?.horarios || [];
    area.replaceChildren();
    let diaAtual = '';
    let linha = null;
    for (const inicioMs of horarios) {
      if (!Number.isSafeInteger(inicioMs)) continue;
      const data = new Date(inicioMs);
      const dia = data.toLocaleDateString('pt-BR', opcoesData);
      if (dia !== diaAtual) {
        diaAtual = dia;
        const titulo = document.createElement('h3');
        titulo.textContent = dia;
        linha = document.createElement('div');
        linha.className = 'linha horarios-linha';
        area.append(titulo, linha);
      }
      const botao = document.createElement('button');
      botao.className = 'btn btn-horario';
      botao.type = 'button';
      botao.textContent = data.toLocaleTimeString('pt-BR', opcoesHora);
      botao.addEventListener('click', async () => {
        if (enviando) return;
        const dataCompleta = data.toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short'
        });
        if (!confirm('Solicitar reunião em ' + dataCompleta + '?')) return;
        enviando = true;
        botao.disabled = true;
        aviso.textContent = 'Registrando solicitação...';
        try {
          await reservar({ inicioMs });
          aviso.textContent = 'Solicitação enviada. Aguarde a confirmação do escritório.';
        } catch (erro) {
          console.error(erro);
          aviso.textContent = erro.code?.includes('already-exists')
            ? 'Este horário foi reservado. Escolha outro.'
            : 'Não foi possível reservar. Atualize e tente novamente.';
        } finally {
          enviando = false;
          await carregarHorarios();
        }
      });
      linha.append(botao);
    }
    if (!area.hasChildNodes()) {
      area.textContent = 'Não há horários disponíveis para os próximos 14 dias.';
    }
  } catch (erro) {
    console.error(erro);
    area.textContent = 'Não foi possível consultar a agenda.';
    aviso.textContent = 'Verifique sua conexão e tente novamente.';
    const atualizar = document.createElement('button');
    atualizar.type = 'button';
    atualizar.className = 'btn btn-secundario';
    atualizar.textContent = 'Tentar novamente';
    atualizar.addEventListener('click', carregarHorarios);
    area.append(atualizar);
  }
}
await carregarHorarios();
