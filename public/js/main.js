document.getElementById('ano')?.replaceChildren(String(new Date().getFullYear()));
// Navegação entre seções sem acrescentar #inicio, #contato etc. à barra.
function irParaSecao(hash) {
  const alvo = document.getElementById(hash.slice(1));
  if (!alvo) return false;
  alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  alvo.setAttribute('tabindex', '-1'); alvo.focus({ preventScroll: true });
  if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
  return true;
}
document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  if (irParaSecao(link.getAttribute('href'))) event.preventDefault();
}));
// Preservar o fragmento OAuth: só tratar hashes que identifiquem uma seção real.
if (location.hash && document.getElementById(location.hash.slice(1))) {
  requestAnimationFrame(() => irParaSecao(location.hash));
}
const toggle = document.getElementById('menu-toggle');
const nav = document.getElementById('menu-principal');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    nav.classList.toggle('menu-aberto', !expanded);
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('menu-aberto');
    toggle.setAttribute('aria-expanded', 'false');
  }));
}
