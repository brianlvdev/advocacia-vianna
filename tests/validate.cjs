'use strict';
const assert = require('node:assert/strict');
const { readdirSync, readFileSync, mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const raiz = resolve(__dirname, '..');
const temporaria = mkdtempSync(join(tmpdir(), 'vianna-js-'));
try {
  const js = readdirSync(join(raiz, 'public/js')).filter(f => f.endsWith('.js'));
  for (const nome of js) {
    const fonte = readFileSync(join(raiz, 'public/js', nome), 'utf8');
    const temporario = join(temporaria, nome + '.mjs');
    writeFileSync(temporario, fonte);
    execFileSync(process.execPath, ['--check', temporario], { stdio: 'pipe' });
  }
  execFileSync(process.execPath, ['--check', join(raiz, 'functions/index.js')], { stdio: 'pipe' });

  const paginas = {
    'advogado.html': ['boas-vindas', 'aviso', 'calendario', 'form-disp', 'form-perfil',
      'lista-casos', 'lista-clientes', 'form-tarefa', 'lista-tarefas', 'tarefa-titulo',
      'tarefa-data', 'tarefa-estagiario', 'lista-areas', 'lista-stats'],
    'cliente.html': ['boas-vindas', 'form-caso', 'resumo', 'arquivos',
      'lista-casos', 'lista-reunioes', 'aviso'],
    'estagiario.html': ['boas-vindas', 'aviso', 'calendario', 'lista-tarefas', 'lista-casos'],
    'agendar.html': ['horarios', 'aviso'],
    'index.html': ['btn-login', 'link-painel', 'lista-areas', 'lista-stats']
  };
  for (const [pagina, ids] of Object.entries(paginas)) {
    const html = readFileSync(join(raiz, 'public', pagina), 'utf8');
    for (const id of ids) {
      assert(html.includes('id="' + id + '"') || html.includes("id='" + id + "'"),
        pagina + ': elemento #' + id + ' ausente');
    }
  }
  const guard = readFileSync(join(raiz, 'public/js/guard.js'), 'utf8');
  assert(/export\\s+function\\s+exigirPapel\\s*\\(/.test(guard),
    'guard.js: funcao exigirPapel precisa ser exportada');

  const admin = readFileSync(join(raiz, 'public/js/advogado.js'), 'utf8');
  const adminHTML = readFileSync(join(raiz, 'public/advogado.html'), 'utf8');
  assert(admin.includes('limpar-conteudo-teste') && adminHTML.includes('id="limpar-conteudo-teste"'),
    'o botao de limpeza precisa estar integrado ao painel');
  assert(admin.includes('add-area') && admin.includes('add-stat'),
    'controles de inclusao precisam ter eventos de click');

  const perfil = readFileSync(join(raiz, 'public/js/perfil-publico.js'), 'utf8');
  assert(perfil.includes('criarCirculo') && perfil.includes('enderecoSeguro'),
    'perfil publico precisa suportar indicadores e endereco institucional');

  const firebase = JSON.parse(readFileSync(join(raiz, 'firebase.json'), 'utf8'));
  assert(firebase.firestore.rules && firebase.storage.rules && firebase.functions);
  const indices = JSON.parse(readFileSync(join(raiz, 'firestore.indexes.json'), 'utf8'));
  assert(Array.isArray(indices.indexes));
  console.log('Verificação estática: OK (' + js.length + ' módulos JS, 5 páginas).');
} finally {
  rmSync(temporaria, { recursive: true, force: true });
}
