const navLinks = [
  { href: '/', label: 'About' },
  { href: '/investments.html', label: 'Investments' },
  { href: '/photography.html', label: 'Photography' },
  { href: '/travel.html', label: 'Travel' },
  { href: '/health.html', label: 'Health' },
  { href: '/music.html', label: 'Music' },
];

const header = document.createElement('header');
header.className = 'site-nav';

const toggle = document.createElement('button');
toggle.type = 'button';
toggle.className = 'nav-toggle';
toggle.setAttribute('aria-expanded', 'false');
toggle.setAttribute('aria-controls', 'nav-menu');
toggle.setAttribute('aria-label', 'Menu');
toggle.innerHTML = '<span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span>';

const nav = document.createElement('nav');
nav.id = 'nav-menu';
const path = location.pathname;

navLinks.forEach(({ href, label }) => {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = label;
  const base = href.replace('.html', '');
  if (path === href || path === base || (href !== '/' && (path.endsWith(href) || path.endsWith(base)))) {
    a.classList.add('active');
  }
  nav.appendChild(a);
});

toggle.addEventListener('click', () => {
  const open = header.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
});

header.appendChild(toggle);
header.appendChild(nav);
document.body.prepend(header);
