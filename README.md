# Fuerza Auto Care (3D site)

The new Fuerza Auto Care site, built on the VANTA Auto Lab engine and rebranded in Fuerza red and chrome. A real-time 3D BMW M240i in Fuerza Red stays on screen as you scroll, and gets hand-washed, steamed, tinted, wrapped and covered in PPF. After that come paint correction, services, pricing, about, and Cal.com booking with one calendar per service.

Static site, no build step. Open it through any web server (or GitHub Pages), not by double-clicking: the 3D model loads with `fetch`. `three.js`, GSAP and Lenis load from CDNs.

## Structure
- `index.html`, `css/style.css` (shared engine), `css/fuerza.css` (Fuerza additions)
- `js/main.js`: scroll choreography, HUD and Cal.com booking (`CAL_CONFIG`)
- `js/car.js`: studio, paint shader and effects; `js/fx.js`: cursor and 2D interactive pieces
- `models/m240i.glb`, `textures/grime.webp`, `assets/logo.jpg`

## Still placeholders
- The Cal.com username goes in `CAL_CONFIG` in `js/main.js`. Event slugs: detailing, window-tint, vinyl-wrap-dropoff, ppf-dropoff.
- Phone, email, area and hours are in `index.html` (`#book`). The Instagram, TikTok and Reviews links are in the footer.
- Prices are carried over from the original Fuerza site.

## Credits
- 3D car: ["2022 BMW M240i Coupe"](https://sketchfab.com/3d-models/2022-bmw-m240i-coupe-822a4e2d8a0e4568beda00539f4ad341) by Nazh Design, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Recolored and modified.
- Road grime: CC0 textures from [ambientCG](https://ambientcg.com).
