# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal "about me" site of Héctor Guzmán (arquitechthor), served by GitHub Pages as the
**user site** at `https://arquitechthor.github.io/` (repo `arquitechthor/arquitechthor.github.io`,
published from `main`, root folder — every push redeploys). Plain HTML/CSS, no build step, no
dependencies. `.nojekyll` disables Jekyll processing.

Because it's the user site, the account's project sites are served under it:
`aws-cert-study` at `/aws-cert-study/` and the profile repo `arquitechthor` at `/arquitechthor/`
(which only holds a redirect back here — the site briefly lived there). Don't add folders
named `aws-cert-study` or `arquitechthor` here — they would shadow those project sites.

```
index.html          # home: #top (Sobre mí hero) → #certificaciones → #conocimiento → #proyectos (intro) → #apuntes-aws → #kopi → #kopi-chess → #prompt-quest
                    # menu: Inicio · Certificaciones · Conocimiento · "Mis proyectos" dropdown (Todos, Apuntes AWS, Kopi Tools, Kopi Chess, Prompt Quest)
conocimiento.html   # Tema detail page (?tema=<id>), rendered client-side by assets/conocimiento.js — see "Conocimiento"
styles.css          # same palette/tokens as kopi-web and aws-cert-study (copied, not shared)
robots.txt          # the domain-wide robots.txt (crawlers only read /robots.txt): lists this site's sitemap.xml and aws-cert-study's
sitemap.xml         # home + one URL per Conocimiento Tema; regenerate with `node scripts/generate-sitemap.mjs` (reads the API) and commit it
scripts/generate-sitemap.mjs  # no deps, Node 18+; there's no CI here, so run it by hand when index.html or the Temas change
assets/
  arquitechthor.jpg      # profile photo (also the source of the favicons)
  kopi-mascot.jpg        # 560px downscale of kopi-web/assets/kopi-mascot.png
  kopi-chess-review.jpg  # 720px downscale of kopi-chess/docs/img/review.png
  prompt-quest-arena.jpg # 720px downscale of prompt-quest/docs/img/stand-partida.png
  insignias/*.png        # Credly badge images, downscaled to 240px
  conocimiento.js        # fetches the public Conocimiento API of Kopi — see "Conocimiento"
  nav.js                 # mobile menu toggle + active-link highlight (same block as kopi-web and aws-cert-study; policy "Mismo menú y pie en las tres webs" in ../kopi-docs/politicas.md) + the "Mis proyectos" dropdown, which only this site has
```

## Relationship with the other sites

- This page replaced the old `#sobre-mi` section of `kopi-web`. Both `kopi-web` and
  `aws-cert-study` link their "Sobre mí" entries here.
- Conocimiento moved here from `kopi-web` on 2026-10-29. `kopitools.link/conocimiento.html?tema=<id>`
  and `kopitools.link/#conocimiento` redirect here, and kopi-web's menus link to `#conocimiento`.

## Conocimiento

`#conocimiento` (Tema card grid) and `conocimiento.html` (one Tema) are rendered client-side by
`assets/conocimiento.js`, copied from kopi-web together with its CSS (the "Conocimiento" block in
`styles.css`). The content is managed in Kopi Media Admin and read from the **public,
unauthenticated** Kopi API: `GET https://api.kopitools.link/public/knowledge/topics`,
`.../topics/{id}` and `.../resources/{id}` (see
`kopi-media-admin/documentation/arquitectura/rutas-api.md#conocimiento`), which only return the
content of one fixed `ownerId`. Cards use the API's `thumbnailUrl` and fall back to `imageUrl`.
**Two-tier load**: `topics/{id}` returns only the structure; each resource's body (rich-text HTML
or a presigned S3 URL, 1 h TTL) is fetched from `resources/{id}` when it's expanded / its Tópico
is opened. Because those URLs expire, the content can't be snapshotted into static files.

**CORS**: the API (HTTP API `kopi-api`) must keep `https://arquitechthor.github.io` in its
allow-origins, or every `fetch` fails ("No se pudo cargar…"). For local preview serve on port
4200 (`python -m http.server 4200`): `http://localhost:4200` is also allowed, other ports aren't.

## Certificaciones

Hardcoded from the public Credly profile
(`https://www.credly.com/users/hector-guzman.61ef69dd`). Only **currently valid** badges are
shown (expired ones — e.g. the 2020 Scrum Foundation / Lifelong Learning — are omitted). To
refresh: `curl -s -H "Accept: application/json" "https://www.credly.com/users/hector-guzman.61ef69dd/badges.json"`
lists every badge with `issued_at_date`, `expires_at_date`, template name/image and badge `id`
(public link: `https://www.credly.com/badges/<id>/public_url`). Keep the JSON-LD
`hasCredential` list in `<head>` in sync with the certifications (not the plain badges).

## UI language

All user-facing text is in **Spanish**.
