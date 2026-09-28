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
index.html          # single page: #top (Sobre mí hero) → #kopi → #apuntes-aws → #certificaciones
styles.css          # same palette/tokens as kopi-web and aws-cert-study (copied, not shared)
assets/
  arquitechthor.jpg      # profile photo (also the source of the favicons)
  kopi-mascot.jpg        # 560px downscale of kopi-web/assets/kopi-mascot.png
  insignias/*.png        # Credly badge images, downscaled to 240px
  nav.js                 # mobile menu toggle + active-link highlight (same block as kopi-web and aws-cert-study; policy "Mismo menú y pie en las tres webs" in ../kopi-docs/politicas.md)
```

## Relationship with the other sites

- This page replaced the old `#sobre-mi` section of `kopi-web`. Both `kopi-web` and
  `aws-cert-study` link their "Sobre mí" entries here.
- Kopi's Conocimiento section stays in `kopi-web` (it needs the Kopi backend/DB).

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
