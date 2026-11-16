"use strict";

const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
admin.initializeApp();
const db = admin.firestore();
const REGIAO = "southamerica-east1";
const ZONA = "America/Sao_Paulo";

function falhar(codigo, mensagem) { throw new HttpsError(codigo, mensagem); }
function autenticado(req) {
  if (!req.auth || !req.auth.uid) falhar("unauthenticated", "Entre na sua conta para continuar.");
  return req.auth.uid;
}
async function conferirPapel(uid, permitido) {
  const perfil = await db.collection("users").doc(uid).get();
  if (!perfil.exists || perfil.get("role") !== permitido) {
    falhar("permission-denied", "Você não tem permissão para esta operação.");
  }
}
function horaMinutos(valor) {
  if (typeof valor !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) return NaN;
  const [h, m] = valor.split(":").map(Number);
  return h * 60 + m;
}
function horarioLocal(data) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA, weekday: "short", hour: "2-digit",
    minute: "2-digit", hourCycle: "h23"
  }).formatToParts(data);
  const obj = Object.fromEntries(partes.map(({type, value}) => [type, value]));
  return {
    dia: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(obj.weekday),
    minutos: Number(obj.hour) * 60 + Number(obj.minute)
  };
}
function diaLocal(data) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(data);
}

// App Check deve ser ativado com enforceAppCheck: true após registrar
// o app web e instalar o provedor correspondente no front-end.
exports.criarAgendamento = onCall({
  region: REGIAO, maxInstances: 5, timeoutSeconds: 30
}, async (req) => {
  const uid = autenticado(req);
  await conferirPapel(uid, "cliente");

  const inicioMs = req.data && req.data.inicioMs;
  if (!Number.isSafeInteger(inicioMs)) falhar("invalid-argument", "Horário inválido.");
  const agora = Date.now();
  if (inicioMs < agora + 30 * 60 * 1000 || inicioMs > agora + 14 * 86400000) {
    falhar("invalid-argument", "Escolha um horário entre 30 minutos e 14 dias no futuro.");
  }

  const configuracao = await db.doc("config/disponibilidade").get();
  const cfg = configuracao.exists ? configuracao.data() : {
    diasSemana: [1, 4], inicio: "09:00", fim: "17:00", duracaoMin: 30
  };
  const duracao = cfg.duracaoMin;
  const horario = horarioLocal(new Date(inicioMs));
  const primeira = horaMinutos(cfg.inicio);
  const ultima = horaMinutos(cfg.fim);

  if (!Array.isArray(cfg.diasSemana) || !cfg.diasSemana.includes(horario.dia) ||
      !Number.isInteger(duracao) || duracao < 15 || duracao > 120 ||
      !Number.isFinite(primeira) || !Number.isFinite(ultima) ||
      horario.minutos < primeira || horario.minutos + duracao > ultima ||
      (horario.minutos - primeira) % duracao !== 0 || inicioMs % 60000 !== 0) {
    falhar("invalid-argument", "O horário não está disponível para agendamento.");
  }

  const id = String(inicioMs);
  const reservaRef = db.collection("ocupados").doc(id);
  const agendaRef = db.collection("agendamentos").doc(id);
  const quotaRef = db.collection("controlesAgenda").doc(uid);
  const dia = diaLocal(new Date());
  const usuarioRef = db.collection("users").doc(uid);

  return db.runTransaction(async (tx) => {
    const [ocupado, agendado, quota, usuario] = await Promise.all([
      tx.get(reservaRef), tx.get(agendaRef), tx.get(quotaRef), tx.get(usuarioRef)
    ]);
    if (ocupado.exists || (agendado.exists && agendado.get("status") !== "cancelado")) {
      if (agendado.exists && agendado.get("clienteUid") === uid &&
          agendado.get("status") !== "cancelado") {
        return { id, jaExistia: true };
      }
      falhar("already-exists", "Este horário já foi reservado.");
    }
    const usados = quota.exists && quota.get("dia") === dia ? quota.get("quantidade") || 0 : 0;
    if (usados >= 3) {
      falhar("resource-exhausted", "Limite de três solicitações de agendamento por dia atingido.");
    }

    const inicio = new Date(inicioMs);
    const fim = new Date(inicioMs + duracao * 60000);
    tx.create(reservaRef, { inicio: inicio.toISOString() });
    const agendamento = {
      clienteUid: uid,
      clienteNome: String(usuario.get("nome") || "").slice(0, 120),
      clienteEmail: String(usuario.get("email") || "").slice(0, 180),
      inicio: inicio.toISOString(), fim: fim.toISOString(),
      status: "pendente",
      criadoEm: admin.firestore.FieldValue.serverTimestamp()
    };
    if (agendado.exists) tx.set(agendaRef, agendamento);
    else tx.create(agendaRef, agendamento);
    tx.set(quotaRef, {
      dia, quantidade: usados + 1,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
    });
    return { id, jaExistia: false };
  });
});

exports.atualizarAgendamento = onCall({
  region: REGIAO, maxInstances: 5, timeoutSeconds: 30
}, async (req) => {
  const uid = autenticado(req);
  await conferirPapel(uid, "admin");

  const id = req.data && req.data.id;
  const acao = req.data && req.data.acao;
  const meetUrl = String((req.data && req.data.meetUrl) || "").trim();
  if (typeof id !== "string" || !/^\d{13}$/.test(id) ||
      !["confirmar", "cancelar"].includes(acao)) {
    falhar("invalid-argument", "Solicitação inválida.");
  }
  if (acao === "confirmar" && meetUrl &&
      (meetUrl.length > 250 || !/^https:\/\/meet\.google\.com\/[a-z0-9-]+\/?$/i.test(meetUrl))) {
    falhar("invalid-argument", "Use somente um link válido do Google Meet.");
  }

  const agendaRef = db.collection("agendamentos").doc(id);
  const ocupadoRef = db.collection("ocupados").doc(id);
  return db.runTransaction(async (tx) => {
    const [agenda, ocupado] = await Promise.all([
      tx.get(agendaRef), tx.get(ocupadoRef)
    ]);
    if (!agenda.exists) falhar("not-found", "Agendamento não encontrado.");
    if (agenda.get("status") === "cancelado") {
      falhar("failed-precondition", "Este agendamento já foi cancelado.");
    }
    if (acao === "cancelar") {
      tx.update(agendaRef, { status: "cancelado", atualizadoEm: admin.firestore.FieldValue.serverTimestamp() });
      if (ocupado.exists) tx.delete(ocupadoRef);
    } else {
      tx.update(agendaRef, {
        status: "confirmado", meetUrl,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    return { ok: true };
  });
});


// Clientes podem cancelar apenas solicitações ainda pendentes.
// A transação libera o horário na mesma operação que altera o status.
exports.cancelarMeuAgendamento = onCall({
  region: REGIAO, maxInstances: 5, timeoutSeconds: 30
}, async (req) => {
  const uid = autenticado(req);
  await conferirPapel(uid, "cliente");
  const id = req.data && req.data.id;
  if (typeof id !== "string" || !/^\d{13}$/.test(id)) {
    falhar("invalid-argument", "Agendamento inválido.");
  }
  const agendaRef = db.collection("agendamentos").doc(id);
  const ocupadoRef = db.collection("ocupados").doc(id);
  return db.runTransaction(async (tx) => {
    const [agenda, ocupado] = await Promise.all([tx.get(agendaRef), tx.get(ocupadoRef)]);
    if (!agenda.exists || agenda.get("clienteUid") !== uid) {
      falhar("permission-denied", "Agendamento não localizado na sua conta.");
    }
    if (agenda.get("status") !== "pendente") {
      falhar("failed-precondition", "Apenas solicitações pendentes podem ser canceladas.");
    }
    tx.update(agendaRef, {
      status: "cancelado",
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
    });
    if (ocupado.exists) tx.delete(ocupadoRef);
    return { ok: true };
  });
});


function partesNoFuso(data) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(data);
  const obj = Object.fromEntries(partes.map(({ type, value }) => [type, Number(value)]));
  return obj;
}
function deslocamentoFusoMinutos(data) {
  const x = partesNoFuso(data);
  const asUTC = Date.UTC(x.year, x.month - 1, x.day, x.hour, x.minute, x.second);
  return Math.round((asUTC - data.getTime()) / 60000);
}
function instanteHorarioLocal(ano, mes, dia, hora, minuto) {
  let t = Date.UTC(ano, mes - 1, dia, hora, minuto);
  t -= deslocamentoFusoMinutos(new Date(t)) * 60000;
  t = Date.UTC(ano, mes - 1, dia, hora, minuto) -
    deslocamentoFusoMinutos(new Date(t)) * 60000;
  return t;
}

// O navegador não recebe documentos da coleção de ocupação nem precisa
// interpretar o fuso do escritório.
exports.listarHorarios = onCall({
  region: REGIAO, maxInstances: 5, timeoutSeconds: 30
}, async (req) => {
  const uid = autenticado(req);
  await conferirPapel(uid, "cliente");
  const snap = await db.doc("config/disponibilidade").get();
  const cfg = snap.exists ? snap.data() :
    { diasSemana: [1, 4], inicio: "09:00", fim: "17:00", duracaoMin: 30 };
  const primeira = horaMinutos(cfg.inicio);
  const ultima = horaMinutos(cfg.fim);
  const passo = cfg.duracaoMin;
  if (!Array.isArray(cfg.diasSemana) || !Number.isFinite(primeira) ||
      !Number.isFinite(ultima) || !Number.isInteger(passo) ||
      passo < 15 || passo > 120 || primeira >= ultima) {
    falhar("failed-precondition", "Disponibilidade não configurada corretamente.");
  }
  const agora = Date.now();
  const hoje = partesNoFuso(new Date(agora));
  const limiar = instanteHorarioLocal(hoje.year, hoje.month, hoje.day, 0, 0);
  const fimJanela = agora + 14 * 86400000;
  const ocupados = await db.collection("ocupados")
    .orderBy(admin.firestore.FieldPath.documentId())
    .startAt(String(limiar))
    .endAt(String(fimJanela))
    .get();
  const bloqueados = new Set(ocupados.docs.map(doc => doc.id));
  const horarios = [];
  for (let d = 0; d <= 14; d++) {
    const data = new Date(Date.UTC(hoje.year, hoje.month - 1, hoje.day + d));
    if (!cfg.diasSemana.includes(data.getUTCDay())) continue;
    for (let minuto = primeira; minuto + passo <= ultima; minuto += passo) {
      const inicioMs = instanteHorarioLocal(data.getUTCFullYear(), data.getUTCMonth() + 1,
        data.getUTCDate(), Math.floor(minuto / 60), minuto % 60);
      // Impede horários inválidos durante eventuais transições de fuso.
      const local = horarioLocal(new Date(inicioMs));
      if (local.dia !== data.getUTCDay() || local.minutos !== minuto) continue;
      if (inicioMs > agora + 30 * 60000 && inicioMs <= fimJanela &&
          !bloqueados.has(String(inicioMs))) {
        horarios.push(inicioMs);
      }
    }
  }
  return { horarios, fuso: ZONA };
});
