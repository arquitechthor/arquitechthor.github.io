// Regenera sitemap.xml: la portada y una URL por Tema de Conocimiento (conocimiento.html?tema=<id>),
// listados desde la API pública de Kopi. GitHub Pages sirve el repo tal cual, sin CI, así que se
// ejecuta a mano (`node scripts/generate-sitemap.mjs`) cuando cambia index.html o se publica o
// retira un Tema en Kopi Media Admin, y el sitemap.xml resultante se commitea. Sin dependencias:
// usa el fetch nativo de Node 18+.
const API_BASE = 'https://api.kopitools.link';
const SITE = 'https://arquitechthor.github.io';

function escapeXml(str) {
  return str.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function urlEntry(loc, lastmod) {
  return `  <url><loc>${escapeXml(loc)}</loc><lastmod>${lastmod}</lastmod></url>`;
}

const today = new Date().toISOString().slice(0, 10);
const res = await fetch(`${API_BASE}/public/knowledge/topics`);
if (!res.ok) throw new Error(`GET /public/knowledge/topics -> ${res.status}`);
const topics = await res.json();

const entries = [
  urlEntry(`${SITE}/`, today),
  ...topics.map((topic) => urlEntry(`${SITE}/conocimiento.html?tema=${encodeURIComponent(topic.id)}`, today)),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

const { writeFileSync } = await import('node:fs');
writeFileSync(new URL('../sitemap.xml', import.meta.url), xml);
console.log(`sitemap.xml: portada + ${topics.length} tema(s)`);
