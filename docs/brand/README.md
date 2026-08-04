# Brand assets

| File | Use |
|---|---|
| `hero.png` | README banner, 2400x600, rendered at 1200x300 |
| `hero.svg` | Editable source for the banner |
| `social-preview.png` | GitHub social preview, exactly 1280x640 |
| `social-preview.svg` | Editable source for the social preview |

`social-preview.png` is not referenced by any document. GitHub only accepts it
through Settings, General, Social preview, where it becomes the card shown when
a repository link is pasted into a chat or a feed.

The PNG files are committed rather than rendered on demand because both SVG
sources set live text in Avenir Next and Menlo. Those fonts exist on macOS and
not on a Linux or Windows viewer, so an SVG embedded directly in the README
would reflow on the machines most readers use.

## Design

The ledger motif is the product in one image: eighteen rows, one per audit
domain, each with a result cell. The accent color `#2f6fed` matches the
repository badges and is limited to result cells and alignment marks, so it
reads as data rather than decoration.

## Regenerating

Edit the SVG, then rasterize at twice the display size:

```bash
python3 -c "import cairosvg; cairosvg.svg2png(url='hero.svg', write_to='hero.png', output_width=2400, output_height=600)"
python3 -c "import cairosvg; cairosvg.svg2png(url='social-preview.svg', write_to='social-preview.png', output_width=1280, output_height=640)"
```

The social preview must stay exactly 1280x640. Verify with
`sips -g pixelWidth -g pixelHeight social-preview.png`.
