import { supabase } from './supabase-config.js';
import { functions, signInWithPopup } from './backend.js';
import { httpsCallable } from './backend.js';

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
    for (const inicioMs of [...new Set(horarios)].filter(Number.isSafeInteger).sort((a,b) => a-b)) {
      if (!Number.isSafeInteger(inicioMs)) continue;
      const data = new Date(inicioMs);
      const dia = data.toLocaleDateString('pt-BR', opcoesData);
      if (dia !== diaAtual) {
        diaAtual = dia;
        const titulo = document.createElement('h3');
        titulo.textContent = dia;
        const grupo = document.createElement('section'); grupo.className = 'agenda-dia';
        linha = document.createElement('div');
        linha.className = 'agenda-lista';
        grupo.append(titulo, linha); area.append(grupo);
      }
      const botao = document.createElement('button');
      botao.className = 'btn btn-horario';
      botao.type = 'button';
      botao.textContent = data.toLocaleTimeString('pt-BR', opcoesHora);
      botao.setAttribute('aria-label', 'Agendar ' + dia + ' às ' + botao.textContent);
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
async function iniciar() {
  try {
    const { data: sessao, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!sessao.session) {
      const texto = document.createElement('p'); texto.textContent = 'Entre com Google para consultar os horários e solicitar seu atendimento.';
      const entrar = document.createElement('button'); entrar.type = 'button'; entrar.className = 'btn'; entrar.textContent = 'Entrar para agendar';
      entrar.addEventListener('click', async () => {
        entrar.disabled = true;
        try {
          sessionStorage.setItem('apos-login', 'agendar.html');
          await signInWithPopup();
        } catch (erro) {
          console.error(erro); aviso.textContent = 'Não foi possível iniciar o login. Tente novamente.';
        } finally { entrar.disabled = false; }
      });
      area.replaceChildren(texto, entrar); return;
    }
    const { data, error: erroUsuario } = await supabase.auth.getUser();
    if (erroUsuario || !data.user) throw erroUsuario || new Error('Sessão inválida');
    const { data: perfil, error: erroPerfil } = await supabase.from('perfis').select('papel').eq('id', data.user.id).single();
    if (erroPerfil) throw erroPerfil;
    if (perfil?.papel !== 'cliente') {
      area.textContent = 'O agendamento nesta página é destinado aos clientes. Acesse seu painel para gerenciar os atendimentos.';
      document.getElementById('minha-area').href = perfil?.papel === 'admin' ? 'advogado.html' : 'estagiario.html';
      return;
    }
    await carregarHorarios();
  } catch (erro) {
    console.error(erro); aviso.textContent = 'Não foi possível carregar sua conta. Atualize a página para tentar novamente.';
  }
}
await iniciar();
