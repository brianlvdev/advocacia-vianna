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
  const firebase = JSON.parse(readFileSync(join(raiz, 'firebase.json'), 'utf8'));
  assert(firebase.firestore.rules && firebase.storage.rules && firebase.functions);
  for (const hosting of firebase.hosting) {
    assert.equal(hosting.cleanUrls, true);
    assert.equal(hosting.trailingSlash, false);
    assert(hosting.redirects.some(r => r.source === '/index.html' && r.destination === '/'));
  }
  for (const pagina of readdirSync(join(raiz, 'public')).filter(f => f.endsWith('.html'))) {
    const html = readFileSync(join(raiz, 'public', pagina), 'utf8');
    assert(/rel="icon"[^>]*href="\/?img\/logo\.png"/.test(html), pagina + ': favicon ausente');
  }
  const indices = JSON.parse(readFileSync(join(raiz, 'firestore.indexes.json'), 'utf8'));
  assert(Array.isArray(indices.indexes));
  console.log('Verificação estática: OK (' + js.length + ' módulos JS, 5 páginas).');
} finally {
  rmSync(temporaria, { recursive: true, force: true });
}
