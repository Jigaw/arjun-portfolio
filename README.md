# Arjun H · Portfolio

An interactive 3D portfolio: a burning **ARJUN** made of blocks on a lava field. Hover (or tap) the lava stones to uncover the CV, switch between five themes, and pull the moon out of its hole in the sky.

Open `index.html` in a modern browser. Three.js and the fonts load from public CDNs (pinned version with an integrity hash, locked down by a Content-Security-Policy); everything else is inside the page.

## What's in it

- **Fire (the portfolio):** five lava stones hold Education, Projects, Skills, Experience and Languages. Uncover all five for a hint.
- **Themes:** Snow, Stone, Water and Electric, from the theme button at the bottom right.
- **The moon:** it hangs on a rope through a hole in a rubber sky. Pull hard enough and a gift pops out.
- **Phones:** the letter A, stones in front of it, a folding theme button and lighter rendering.
- **No GPU:** software rendering is detected and drawn at lower resolution so it still runs (force it with `?lite`).

## Editing

`index.html` is generated. Edit the sources and run:

```
python build.py
```

| File | What |
|---|---|
| `original.html` | the ARJUN themes scene (Three.js, textures and Blender blocks inline) |
| `src/lv.html / lv.css / lv.js` | the lava-stone CV layer, theme chrome, loading screen |
| `src/moon.js` | the moon, rope, rubber sky and the gift |
| `build.py` | patches the scene and assembles `index.html` |

Preview locally with `python -m http.server` and open `http://localhost:8000`.

## Updating the CV

`Arjun_H_CV.pdf` (the download buttons) is rendered from `src/cv.html`. With the local preview running:

```
chrome --headless=new --no-pdf-header-footer --print-to-pdf=Arjun_H_CV.pdf http://localhost:8000/src/cv.html
```

