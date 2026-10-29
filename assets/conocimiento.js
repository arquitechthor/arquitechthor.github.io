/**
 * Conocimiento: carga y renderiza el contenido público de la API de Kopi (sin autenticación,
 * ver kopi-media-admin/documentation/arquitectura/rutas-api.md#conocimiento) — solo el
 * contenido de un ownerId fijo es público, filtrado siempre server-side. El contenido se
 * administra en Kopi Media Admin; esta web solo lo muestra (vino de kopi-web, que ahora
 * redirige aquí). Requiere https://arquitechthor.github.io en el CORS del API de Kopi.
 * Se usa tanto en la grilla de Temas de index.html como en el detalle de conocimiento.html:
 * cada función comprueba si su contenedor existe en la página actual antes de hacer nada.
 *
 * Carga en dos niveles para no transferir todo el árbol renderizado de golpe:
 *   1. GET /public/knowledge/topics/{id}  → estructura (tópicos + recursos: id, tipo, título).
 *   2. GET /public/knowledge/resources/{id} → cuerpo de UN recurso (HTML del texto enriquecido
 *      o URL prefirmada del fichero), pedido al desplegar el recurso / abrir el tópico.
 */
(function () {
  const API_BASE = 'https://api.kopitools.link';

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  // Acepta youtube.com/watch?v=, youtu.be/ y ya-embebidas youtube.com/embed/ — cualquier otra
  // URL (Vimeo, etc.) cae al enlace simple en vez de intentar un iframe que no funcionaría.
  function youtubeEmbedUrl(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be')) {
        const videoId = u.pathname.slice(1);
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
      }
      if (u.hostname.includes('youtube.com')) {
        if (u.pathname === '/watch' && u.searchParams.get('v')) {
          return `https://www.youtube.com/embed/${u.searchParams.get('v')}`;
        }
        if (u.pathname.startsWith('/embed/')) return url;
      }
    } catch {
      // URL inválida: se ignora, cae al fallback de enlace simple.
    }
    return null;
  }

  // Actualiza (o crea) una etiqueta <meta> del <head> — usada para poner título/descripción/
  // imagen Open Graph del tema una vez cargado, para las previsualizaciones de enlaces.
  // og:* y article:* van por el atributo `property` (namespaces de Open Graph); el resto
  // (twitter:*, description...) por `name`.
  function setMeta(key, content) {
    if (!content) return;
    const attr = key.startsWith('og:') || key.startsWith('article:') ? 'property' : 'name';
    let tag = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(attr, key);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
  }

  // SEO: cada Tema tiene su propia URL canónica (?tema=<id>) — sin esto, Google no sabe cuál
  // es la versión "oficial" a indexar. El <link> de respaldo en el <head> apunta a
  // conocimiento.html a secas; se sobreescribe aquí en cuanto se conoce el tema real.
  function setCanonical(url) {
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = url;
  }

  // Iconos de ojo abierto/cerrado para el botón Mostrar/Ocultar de los recursos de texto
  // enriquecido — SVG inline (sin dependencias externas) que hereda el color del texto.
  const EYE_OPEN_ICON = '<svg class="icon-eye" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_CLOSED_ICON = '<svg class="icon-eye" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.3 21.3 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 5c7 0 11 7 11 7a21.4 21.4 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  // Icono de exportar (descarga) para el botón "Exportar a Noria".
  const EXPORT_ICON = '<svg class="icon-export" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';
  // Icono de interrogación para el botón "Preguntas de repaso".
  const QUESTION_ICON = '<svg class="icon-question" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 1.64-1.83 2.16-2.58 2.78-.4.33-.42.83-.42 1.22"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

  // --- Carga diferida de recursos individuales -------------------------------------------
  // Un recurso se pide una sola vez; la promesa se cachea. Si falla, se descarta para
  // permitir reintento la próxima vez que se despliegue.
  const resourceCache = new Map();
  function fetchResource(id) {
    if (!resourceCache.has(id)) {
      const p = fetch(`${API_BASE}/public/knowledge/resources/${encodeURIComponent(id)}`)
        .then(res => { if (!res.ok) throw new Error('request failed'); return res.json(); });
      p.catch(() => resourceCache.delete(id));
      resourceCache.set(id, p);
    }
    return resourceCache.get(id);
  }

  // --- Exportar a Noria ---------------------------------------------------------------
  // Formato de importación de Noria (ver kopi-docs/importar_temas.md): un archivo .json con
  // { version: 1, temas: [{ nombre, descripcion?, preguntas? }] }, cargado dentro de un Bloque
  // ya existente en la app. Equivalencia de jerarquía Kopi → Noria: Tema → Eje Temático,
  // Tópico → Bloque, Recurso → Tema (de ahí que se exporte SIEMPRE un único tema por recurso,
  // con sus preguntas ya generadas — ver skill /knowledge-questions).
  function sanitizeFilename(str) {
    return str.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function downloadNoriaExport(resourceTitle, topicTitle, subtopicTitle, preguntas) {
    const payload = { version: 1, temas: [{ nombre: resourceTitle, preguntas }] };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Noria - ${sanitizeFilename(topicTitle)} - ${sanitizeFilename(subtopicTitle)} - ${sanitizeFilename(resourceTitle)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Delegado en el contenedor (igual que setupLazyResources): reutiliza el mismo fetch/caché
  // que "Mostrar" para traer las preguntas, así no hace falta desplegar el recurso primero.
  function setupNoriaExport(container) {
    container.addEventListener('click', (event) => {
      const btn = event.target.closest('.noria-export-btn');
      if (!btn) return;
      event.preventDefault();
      const { resourceId, resourceTitle, topicTitle, subtopicTitle } = btn.dataset;
      btn.disabled = true;
      fetchResource(resourceId)
        .then((dto) => {
          if (!dto.preguntas || !dto.preguntas.length) {
            alert('Este recurso todavía no tiene preguntas generadas.');
            return;
          }
          downloadNoriaExport(resourceTitle, topicTitle, subtopicTitle, dto.preguntas);
        })
        .catch(() => alert('No se pudieron exportar las preguntas. Inténtalo de nuevo.'))
        .finally(() => { btn.disabled = false; });
    });
  }

  function noriaExportButton(resource, topicTitle, subtopicTitle) {
    if (!resource.hasQuestions) return '';
    return `<button type="button" class="btn btn-secondary btn-sm noria-export-btn"
      data-resource-id="${escapeHtml(resource.id)}"
      data-resource-title="${escapeHtml(resource.title)}"
      data-topic-title="${escapeHtml(topicTitle)}"
      data-subtopic-title="${escapeHtml(subtopicTitle)}"
      title="Exportar a Noria (Eje Temático: ${escapeHtml(topicTitle)} → Bloque: ${escapeHtml(subtopicTitle)})">
      ${EXPORT_ICON}Exportar a Noria
    </button>`;
  }

  // --- Toolbar de un recurso de texto: Mostrar/Ocultar + Preguntas de repaso -----------
  // Los 3 botones (toggle, preguntas, exportar) son botones normales FUERA del <details>,
  // en su propia fila — así nunca se separan entre sí, tanto colapsado como con el texto o
  // las preguntas expandidas (el <details>, sin botones dentro, es libre de ocupar todo el
  // ancho de la tarjeta sin arrastrarlos). El <details> sigue existiendo por el mecanismo
  // nativo open/[toggle] (lazy-load, un solo recurso abierto a la vez), pero su <summary> es
  // invisible: el botón "Mostrar/Ocultar" de la fila es quien decide `details.open` a mano.
  //
  // Mostrar texto y Mostrar preguntas son mutuamente excluyentes (data-mode: 'text' |
  // 'questions'), y cada botón es su propio toggle:
  //  - "Mostrar/Ocultar": si ya se ve el texto, colapsa; en cualquier otro caso (colapsado o
  //    viendo preguntas) pasa a mostrar el texto.
  //  - "Preguntas de repaso" / "Ocultar preguntas": si ya se ven las preguntas, colapsa; si
  //    no, pasa a mostrarlas (cargándolas la primera vez).
  // data-mode se resetea a texto al colapsar (setupLazyResources), así que siempre reabre
  // mostrando el texto primero.
  function questionsBody(preguntas) {
    if (!preguntas || !preguntas.length) return '<p class="text-faint">Sin preguntas generadas.</p>';
    return `<ol class="resource-questions-list">${preguntas.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}</ol>`;
  }

  function resourceToggleButton(resourceId) {
    return `<button type="button" class="btn btn-secondary btn-sm resource-toggle-btn" data-resource-id="${escapeHtml(resourceId)}">
      <span class="richtext-toggle-label richtext-toggle-show">${EYE_OPEN_ICON}Mostrar</span>
      <span class="richtext-toggle-label richtext-toggle-hide">${EYE_CLOSED_ICON}Ocultar</span>
    </button>`;
  }

  function resourceQuestionsButton(resource) {
    if (!resource.hasQuestions) return '';
    return `<button type="button" class="btn btn-secondary btn-sm resource-questions-btn" data-resource-id="${escapeHtml(resource.id)}">
      <span class="richtext-toggle-label questions-toggle-show">${QUESTION_ICON}Preguntas de repaso</span>
      <span class="richtext-toggle-label questions-toggle-hide">${QUESTION_ICON}Ocultar preguntas</span>
    </button>`;
  }

  // .resource-richtext-toolbar y .resource-richtext-details son HERMANOS (ya no uno dentro
  // del otro — ver renderResource), así que todo se ancla en su padre común, .resource-item.
  function syncToolbarButtons(resourceItem) {
    const details = resourceItem.querySelector('.resource-richtext-details');
    const toggleBtn = resourceItem.querySelector('.resource-toggle-btn');
    const questionsBtn = resourceItem.querySelector('.resource-questions-btn');
    const mode = details.dataset.mode || 'text';
    toggleBtn.classList.toggle('is-open', details.open && mode === 'text');
    if (questionsBtn) questionsBtn.classList.toggle('is-open', details.open && mode === 'questions');
  }

  function setupResourceToolbar(container) {
    container.addEventListener('click', (event) => {
      const toggleBtn = event.target.closest('.resource-toggle-btn');
      const questionsBtn = event.target.closest('.resource-questions-btn');
      if (!toggleBtn && !questionsBtn) return;
      event.preventDefault();

      const resourceItem = (toggleBtn || questionsBtn).closest('.resource-item');
      const details = resourceItem.querySelector('.resource-richtext-details');
      const mode = details.dataset.mode || 'text';

      if (toggleBtn) {
        if (details.open && mode === 'text') details.open = false;
        else { details.open = true; details.dataset.mode = 'text'; syncToolbarButtons(resourceItem); }
        return;
      }

      // questionsBtn
      if (details.open && mode === 'questions') { details.open = false; return; }
      const body = details.querySelector('[data-questions-body]');
      const showQuestions = () => { details.open = true; details.dataset.mode = 'questions'; syncToolbarButtons(resourceItem); };
      if (body.dataset.loaded) { showQuestions(); return; }
      body.dataset.loaded = 'pending';
      fetchResource(details.dataset.resourceId)
        .then((dto) => { body.innerHTML = questionsBody(dto.preguntas); body.dataset.loaded = 'done'; showQuestions(); })
        .catch(() => {
          body.innerHTML = '<p class="text-faint">No se pudieron cargar las preguntas.</p>';
          delete body.dataset.loaded;
        });
    });

    // Único punto que de verdad decide qué botón "gana" el aspecto activo — cubre tanto los
    // cambios de arriba como que enforceSingleOpen cierre este recurso al abrir otro.
    container.addEventListener('toggle', (event) => {
      const details = event.target;
      if (!(details instanceof HTMLElement) || !details.matches('.resource-richtext-details')) return;
      const resourceItem = details.closest('.resource-item');
      if (resourceItem) syncToolbarButtons(resourceItem);
    }, true);
  }

  function fileResourceBody(dto) {
    const unavailable = '<p class="text-faint">Recurso no disponible.</p>';
    switch (dto.tipo) {
      case 'AUDIO':
        return dto.fileUrl ? `<audio controls preload="none" src="${dto.fileUrl}"></audio>` : unavailable;
      case 'VIDEO':
        return dto.fileUrl ? `<video controls preload="none" src="${dto.fileUrl}"></video>` : unavailable;
      case 'IMAGE':
        return dto.fileUrl ? `<img src="${dto.fileUrl}" alt="${escapeHtml(dto.title)}" loading="lazy">` : unavailable;
      case 'DOCUMENT':
        return dto.fileUrl
          ? `<a class="btn btn-secondary btn-sm" href="${dto.fileUrl}" download>Descargar${dto.originalName ? ` ${escapeHtml(dto.originalName)}` : ''} ↓</a>`
          : unavailable;
      default:
        return '';
    }
  }

  function hydrateFileResource(el) {
    if (el.dataset.loaded) return;
    el.dataset.loaded = 'pending';
    fetchResource(el.dataset.resourceId)
      .then(dto => { el.innerHTML = fileResourceBody(dto); el.dataset.loaded = 'done'; })
      .catch(() => {
        el.innerHTML = '<p class="text-faint">No se pudo cargar el recurso.</p>';
        delete el.dataset.loaded;
      });
  }

  function hydrateRichText(details) {
    if (details.dataset.loaded) return;
    details.dataset.loaded = 'pending';
    const body = details.querySelector('[data-richtext-body]');
    fetchResource(details.dataset.resourceId)
      .then(dto => { body.innerHTML = dto.html || '<p class="text-faint">Sin contenido.</p>'; details.dataset.loaded = 'done'; })
      .catch(() => {
        body.innerHTML = '<p class="text-faint">No se pudo cargar el contenido.</p>';
        delete details.dataset.loaded;
      });
  }

  // El texto enriquecido se pide al pulsar "Mostrar"; los ficheros (audio/vídeo/imagen/
  // documento) al abrir su tópico — así una URL prefirmada nunca caduca esperando en la
  // página y no se descarga nada de un tópico que no se abre.
  function setupLazyResources(container) {
    container.addEventListener('toggle', (event) => {
      const el = event.target;
      if (!(el instanceof HTMLElement)) return;
      if (el.matches('details.resource-richtext-details[data-resource-id]')) {
        if (el.open) hydrateRichText(el);
        else delete el.dataset.mode; // la próxima vez que se abra, arranca en modo texto
      } else if (el.open && el.matches('details.subtopic-accordion')) {
        el.querySelectorAll('.resource-file[data-resource-id]').forEach(hydrateFileResource);
      }
    }, true);
  }

  // --- Render ---------------------------------------------------------------------------
  // `resource.html` / `resource.fileUrl` presentes = respuesta antigua de
  // getPublicKnowledgeTopic (cuerpo embebido) → se renderiza directo. Ausentes = respuesta
  // nueva (solo estructura) → marcador que se hidrata bajo demanda. Así kopi-web y el backend
  // se pueden desplegar en cualquier orden sin que la página deje de funcionar.
  function renderResource(resource, topicTitle, subtopicTitle) {
    let body;
    switch (resource.tipo) {
      case 'RICH_TEXT': {
        // data-resource-id siempre presente (no solo en la rama diferida): "Preguntas de
        // repaso" necesita pedir el recurso aunque el texto ya viniera embebido.
        const textBody = resource.html != null
          ? `<div class="resource-richtext resource-content-text">${resource.html}</div>`
          : `<div class="resource-richtext resource-content-text" data-richtext-body><p class="text-faint">Cargando…</p></div>`;
        // <summary> vacío y oculto (ver CSS): solo existe para que el navegador no dibuje su
        // triángulo por defecto — el botón "Mostrar/Ocultar" de la fila es quien controla
        // `details.open` a mano (ver setupResourceToolbar), así el <details> nunca comparte
        // fila con los botones y nunca los arrastra al expandirse.
        const details = `<details class="resource-richtext-details" data-resource-id="${escapeHtml(resource.id)}">
               <summary></summary>
               ${textBody}
               <div class="resource-richtext resource-content-questions" data-questions-body></div>
             </details>`;
        body = `<div class="resource-richtext-toolbar">${resourceToggleButton(resource.id)}${resourceQuestionsButton(resource)}${noriaExportButton(resource, topicTitle, subtopicTitle)}</div>${details}`;
        break;
      }
      case 'AUDIO':
      case 'VIDEO':
      case 'IMAGE':
      case 'DOCUMENT':
        body = resource.fileUrl != null
          ? fileResourceBody(resource)
          : `<div class="resource-file" data-resource-id="${escapeHtml(resource.id)}"><p class="text-faint">Cargando…</p></div>`;
        break;
      case 'VIDEO_EMBED': {
        const embed = resource.url ? youtubeEmbedUrl(resource.url) : null;
        body = embed
          ? `<div class="resource-embed"><iframe src="${embed}" title="${escapeHtml(resource.title)}" allowfullscreen loading="lazy"></iframe></div>`
          : (resource.url ? `<a class="btn btn-secondary btn-sm" href="${resource.url}" target="_blank" rel="noopener">Ver vídeo ↗</a>` : '');
        break;
      }
      case 'LINK':
        body = resource.url ? `<a class="btn btn-secondary btn-sm" href="${resource.url}" target="_blank" rel="noopener">Abrir enlace ↗</a>` : '';
        break;
      default:
        body = '';
    }
    return `<div class="resource-item"><h3>${escapeHtml(resource.title)}</h3>${body}</div>`;
  }

  // h1 (tema, ver loadTopicDetail) -> h2 (tópico) -> h3 (recurso): antes el tópico no tenía
  // ningún heading (solo <summary> sin más) y se saltaba directo a h4 en el recurso. El <h2>
  // dentro de <summary> es válido en HTML (contenido permitido: "un heading + phrasing
  // content") y no cambia el aspecto — ver reset en styles.css.
  function renderSubtopic(subtopic, topicTitle) {
    const emoji = subtopic.emoji ? `${subtopic.emoji} ` : '';
    const resourcesHtml = (subtopic.resources || []).map((r) => renderResource(r, topicTitle, subtopic.title)).join('')
      || '<p class="text-faint">Sin recursos todavía.</p>';
    return `
      <details class="subtopic-accordion">
        <summary><h2>${emoji}${escapeHtml(subtopic.title)}</h2></summary>
        <div class="subtopic-body">
          ${subtopic.description ? `<p>${escapeHtml(subtopic.description)}</p>` : ''}
          <div class="resource-list">${resourcesHtml}</div>
        </div>
      </details>`;
  }

  // La portada ocupa toda la tarjeta; el título e ícono van superpuestos abajo. La
  // descripción del tema no se muestra aquí (sí en conocimiento.html). Se pinta la miniatura
  // (thumbnailUrl) con data-full = portada completa, a la que cae onImageFallback si la
  // miniatura aún no existe (tema anterior a las miniaturas).
  function renderTopicCard(topic) {
    const src = topic.thumbnailUrl || topic.imageUrl;
    const full = topic.imageUrl && topic.imageUrl !== src ? ` data-full="${escapeHtml(topic.imageUrl)}"` : '';
    const img = src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(topic.title)}" loading="lazy"${full}>` : '';
    const icon = topic.emoji ? `<span class="card-tema-icon">${topic.emoji}</span>` : '';
    return `
      <a class="card card-tema" href="conocimiento.html?tema=${encodeURIComponent(topic.id)}">
        ${img}
        <div class="card-tema-caption">
          ${icon}<h3>${escapeHtml(topic.title)}</h3>
        </div>
      </a>`;
  }

  // Una miniatura que 404 (tema anterior a las miniaturas): se reintenta una vez con la
  // portada completa que quedó en data-full.
  function onImageFallback(event) {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.full) return;
    const full = img.dataset.full;
    delete img.dataset.full;
    img.src = full;
  }

  function loadTopicsGrid() {
    const grid = document.getElementById('conocimiento-grid');
    if (!grid) return;

    grid.addEventListener('error', onImageFallback, true);

    fetch(`${API_BASE}/public/knowledge/topics`)
      .then(res => { if (!res.ok) throw new Error('request failed'); return res.json(); })
      .then(topics => {
        grid.innerHTML = topics.length
          ? topics.map(renderTopicCard).join('')
          : '<p class="text-faint center">Todavía no hay contenido publicado.</p>';
      })
      .catch(() => {
        grid.innerHTML = '<p class="text-faint center">No se pudo cargar el contenido. Inténtalo de nuevo más tarde.</p>';
      });
  }

  // Tanto los Tópicos (<details class="subtopic-accordion">) como los recursos de texto
  // enriquecido (<details class="resource-richtext-details">) deben comportarse como un
  // acordeón de un solo elemento abierto a la vez. El evento 'toggle' no burbujea, así que se
  // escucha en fase de captura sobre el contenedor para detectar la apertura de cualquiera de
  // ellos y cerrar los demás de su mismo grupo.
  function enforceSingleOpen(container, className) {
    container.addEventListener('toggle', (event) => {
      const details = event.target;
      if (!(details instanceof HTMLElement) || !details.classList.contains(className)) return;
      if (!details.open) return;
      container.querySelectorAll(`details.${className}[open]`).forEach((other) => {
        if (other !== details) other.open = false;
      });
    }, true);
  }

  function loadTopicDetail() {
    const container = document.getElementById('tema-detail');
    if (!container) return;
    enforceSingleOpen(container, 'subtopic-accordion');
    enforceSingleOpen(container, 'resource-richtext-details');
    setupLazyResources(container);
    setupNoriaExport(container);
    setupResourceToolbar(container);

    const id = new URLSearchParams(window.location.search).get('tema');
    if (!id) {
      container.innerHTML = '<p class="text-faint">Tema no especificado.</p>';
      return;
    }

    fetch(`${API_BASE}/public/knowledge/topics/${encodeURIComponent(id)}`)
      .then(res => { if (!res.ok) throw new Error('request failed'); return res.json(); })
      .then(topic => {
        const pageTitle = `${topic.title} — Conocimiento — Héctor Guzmán`;
        document.title = pageTitle;
        setMeta('description', topic.description);
        setMeta('og:title', pageTitle);
        setMeta('og:description', topic.description);
        setMeta('og:image', topic.imageUrl);
        setMeta('og:url', window.location.href);
        setMeta('twitter:title', pageTitle);
        setMeta('twitter:description', topic.description);
        setCanonical(window.location.href);

        const emoji = topic.emoji ? `${topic.emoji} ` : '';
        const img = topic.imageUrl ? `<img class="tema-cover" src="${topic.imageUrl}" alt="${escapeHtml(topic.title)}" loading="lazy">` : '';
        const subtopicsHtml = (topic.subtopics || []).map((s) => renderSubtopic(s, topic.title)).join('')
          || '<p class="text-faint">Este tema todavía no tiene tópicos.</p>';

        container.innerHTML = `
          <div class="section-head" style="text-align:left; margin:0 0 32px; max-width:none;">
            <span class="eyebrow">Conocimiento</span>
            <h1>${emoji}${escapeHtml(topic.title)}</h1>
            ${topic.description ? `<p>${escapeHtml(topic.description)}</p>` : ''}
          </div>
          ${img}
          <div class="subtopic-list">${subtopicsHtml}</div>`;
      })
      .catch(() => {
        container.innerHTML = '<p class="text-faint">No se pudo cargar este tema. Puede que ya no esté disponible.</p>';
      });
  }

  loadTopicsGrid();
  loadTopicDetail();
})();
