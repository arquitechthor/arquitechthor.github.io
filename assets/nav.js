/**
 * Menú de navegación móvil — misma lógica que kopi-web y aws-cert-study. Alterna la
 * clase .nav-links-open (los estilos del panel desplegable viven en styles.css) y mantiene
 * aria-expanded en sincronía para lectores de pantalla.
 */
(function () {
  const toggle = document.getElementById('navToggle');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;

  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'navLinks');
  links.id = links.id || 'navLinks';

  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('nav-links-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
})();

/**
 * Enlace activo del menú (igual en kopi-web, aws-cert-study y arquitechthor.github.io).
 * Los enlaces a otra página pueden llevar aria-current="page" en el HTML. Los enlaces a una
 * sección de esta misma página (#id) reciben aria-current="location" mientras esa sección
 * está a la vista; styles.css los resalta igual que al pasar el ratón.
 */
(function () {
  const links = document.querySelector('.nav-links');
  if (!links || links.querySelector('[aria-current="page"]')) return;
  const aqui = location.pathname.replace(/index\.html$/, '');
  const pares = [...links.querySelectorAll('a[href*="#"]')]
    .filter((a) => a.hash && a.pathname.replace(/index\.html$/, '') === aqui && a.origin === location.origin)
    .map((a) => [a, document.getElementById(decodeURIComponent(a.hash.slice(1)))])
    .filter(([, sec]) => sec);
  if (!pares.length) return;

  function actualizar() {
    const nav = document.querySelector('.nav');
    const corte = (nav ? nav.offsetHeight : 0) + window.innerHeight * 0.3;
    let activo = null;
    for (const [a, sec] of pares) {
      if (sec.getBoundingClientRect().top <= corte) activo = a;
    }
    // Al final de la página, la última sección aunque sea corta.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      activo = pares[pares.length - 1][0];
    }
    for (const [a] of pares) {
      if (a === activo) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    }
  }
  window.addEventListener('scroll', actualizar, { passive: true });
  window.addEventListener('resize', actualizar);
  actualizar();
})();
