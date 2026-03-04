const navLinks = [
  { href: '/', label: 'About' },
  { href: '/investments.html', label: 'Investments' },
  { href: '/photography.html', label: 'Photography' },
  { href: '/travel.html', label: 'Travel' },
  { href: '/health.html', label: 'Health' },
  { href: '/music.html', label: 'Music' },
];

const nav = document.createElement('nav');
const path = location.pathname;

navLinks.forEach(({ href, label }) => {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = label;
  if (path === href || (href !== '/' && path.endsWith(href))) {
    a.classList.add('active');
  }
  nav.appendChild(a);
});

document.body.prepend(nav);
