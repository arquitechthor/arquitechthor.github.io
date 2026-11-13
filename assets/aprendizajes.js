/**
 * Páginas de Aprendizajes (aprendizajes/*.html).
 *
 * 1. Colorea los bloques <pre><code data-lang="java|ts|sql|json|txt"> con un tokenizador mínimo
 *    (comentarios, cadenas, números, palabras clave y tipos). Sin librerías ni peticiones: el
 *    texto se lee con textContent y se vuelve a escribir escapado.
 * 2. Marca en el índice (.cs-toc) la sección que se está leyendo.
 * 3. En móvil, cierra el índice desplegable al elegir una sección.
 */
(function () {
  const PALABRAS = {
    java: 'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long native new package permits private protected public record return sealed short static super switch synchronized this throw throws transient try var void volatile when while yield null true false',
    ts: 'as async await break case catch class const continue default delete do else enum export extends false finally for from function if implements import in instanceof interface let new null of private public readonly return static super switch this throw true try type typeof undefined var void while',
    sql: 'select from where and or update set insert into values on conflict do returning order by limit for skip locked not null is as join left group having delete begin commit',
    json: 'true false null',
  };
  const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
  const esc = (s) => s.replace(/[&<>]/g, (c) => ESCAPE[c]);

  function patron(lang) {
    const comentario = lang === 'sql' ? String.raw`--[^\n]*` : String.raw`\/\*[\s\S]*?\*\/|\/\/[^\n]*`;
    const cadena = String.raw`"""[\s\S]*?"""|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|` + '`(?:\\\\.|[^`\\\\])*`';
    return new RegExp(`(${comentario})|(${cadena})|(\\b\\d[\\d_]*(?:\\.\\d+)?\\b|0x[0-9a-fA-F_]+)|([A-Za-z_$][\\w$]*)`, 'g');
  }

  function colorear(code) {
    const lang = code.dataset.lang;
    if (!lang || lang === 'txt') return;
    const claves = new Set((PALABRAS[lang] || '').split(' '));
    const texto = code.textContent;
    const re = patron(lang);
    let html = '';
    let ultimo = 0;
    for (const m of texto.matchAll(re)) {
      html += esc(texto.slice(ultimo, m.index));
      ultimo = m.index + m[0].length;
      const t = esc(m[0]);
      if (m[1]) html += `<span class="tk-c">${t}</span>`;
      else if (m[2]) html += `<span class="tk-s">${t}</span>`;
      else if (m[3]) html += `<span class="tk-n">${t}</span>`;
      else if (claves.has(lang === 'sql' ? m[0].toLowerCase() : m[0])) html += `<span class="tk-k">${t}</span>`;
      else if (lang !== 'sql' && /^[A-Z][a-z]/.test(m[0])) html += `<span class="tk-t">${t}</span>`;
      else html += t;
    }
    code.innerHTML = html + esc(texto.slice(ultimo));
  }

  document.querySelectorAll('pre code[data-lang]').forEach(colorear);

  const toc = document.querySelector('.cs-toc');
  if (!toc) return;
  const enlaces = [...toc.querySelectorAll('a[href^="#"]')];
  const pares = enlaces
    .map((a) => [a, document.getElementById(decodeURIComponent(a.hash.slice(1)))])
    .filter(([, s]) => s);

  function actualizar() {
    const corte = window.innerHeight * 0.3;
    let activo = pares.length ? pares[0][0] : null;
    for (const [a, s] of pares) if (s.getBoundingClientRect().top <= corte) activo = a;
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2 && pares.length) {
      activo = pares[pares.length - 1][0];
    }
    for (const [a] of pares) a.classList.toggle('activo', a === activo);
  }
  window.addEventListener('scroll', actualizar, { passive: true });
  window.addEventListener('resize', actualizar);
  actualizar();

  const desplegable = toc.matches('details') ? toc : null;
  if (desplegable) {
    // Abierto en escritorio (el <summary> está oculto), cerrado en móvil hasta que se pulse.
    const ancho = window.matchMedia('(max-width: 1000px)');
    const ajustar = () => { desplegable.open = !ancho.matches; };
    ajustar();
    ancho.addEventListener('change', ajustar);
    toc.addEventListener('click', (e) => { if (e.target.closest('a') && ancho.matches) desplegable.open = false; });
  }
})();
