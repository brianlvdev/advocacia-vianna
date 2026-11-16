document.getElementById('ano')?.replaceChildren(String(new Date().getFullYear()));
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
