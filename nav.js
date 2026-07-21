const navLinks = [
  { href: '/', label: 'About' },
  { href: '/investments.html', label: 'Investments' },
  { href: '/photography.html', label: 'Photography' },
  { href: '/travel.html', label: 'Travel' },
  { href: '/health.html', label: 'Health' },
  { href: '/music.html', label: 'Music' },
];

if (!document.querySelector('link[rel="icon"]')) {
  const favicon = document.createElement('link');
  favicon.rel = 'icon';
  favicon.type = 'image/png';
  favicon.href = '/favicon.png';
  document.head.appendChild(favicon);
}

const nav = document.createElement('nav');
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

document.body.prepend(nav);
