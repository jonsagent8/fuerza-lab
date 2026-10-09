# Fuerza Auto Care

The Fuerza Auto Care site in Fuerza red and chrome. A Portimao Blue BMW M240i (G42) in a dark detailing bay arrives, gets washed, steamed, tinted, wrapped and protected as you scroll. Every scene is a Higgsfield-generated clip exported to WebP frames and scrubbed by scroll on a pinned canvas. After that come paint correction, services, pricing, about, the finale and Cal.com booking with one calendar per service.

Static site, no build step. Open it through any web server (or GitHub Pages). GSAP, ScrollTrigger and Lenis load from CDNs.

## Structure
- `index.html`, `css/style.css` (shared engine), `css/fuerza.css` (Fuerza additions)
- `js/main.js`: scroll choreography, tint/wrap pickers, HUD and Cal.com booking (`CAL_CONFIG`)
- `js/frames.js`: frame-sequence loader + canvas painter; `js/frames-manifest.js`: frame count per clip
- `js/fx.js`: cursor and 2D interactive pieces
- `assets/frames/<clip>/{desktop,mobile}/NNNN.webp`: 24 fps frames, 1600 px and 800 px (phones under 768 px get the 800 px set)
- `assets/ref-car.jpg`: the reference image every clip was generated from

## How the scenes work
- Each `[data-media]` section has a sticky full-bleed `<canvas>`. Its frames lazy-load once the section is within one viewport; frame 0 is drawn straight away as a poster.
- Arrival, wash, interior, PPF, correction and finale scrub with scroll. The arrival lights come on by themselves after the loader, then scroll takes over.
- Tint: the shade chips tween the frame (70% → early frame, 5% → last). Scrolling in plays clear → 35% once. This clip is built locally from two stills (clear and tinted glass) with a squeegee wipe, so only the glass changes.
- Wrap: each swatch plays its own clip; Portimao Blue is frame 0 of all of them. A new color peels back to blue first. Frames preload on hover/touch.
- `prefers-reduced-motion`: one still per scene, no scrubbing, no smooth scroll.
- `?debug` shows fps and per-scene frame/load state.

## Still placeholders
- The Cal.com username goes in `CAL_CONFIG` in `js/main.js`. Event slugs: detailing, window-tint, vinyl-wrap-dropoff, ppf-dropoff.
- Phone, email, area and hours are in `index.html` (`#book`). The Instagram, TikTok and Reviews links are in the footer.
- Prices are carried over from the original Fuerza site.

## Credits
- Video: generated with Higgsfield (Seedance 2.5, 1080p) from `assets/ref-car.jpg`.
