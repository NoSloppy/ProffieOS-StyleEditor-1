# ProffieOS-StyleEditor

Sound enabled. Hum, Smoothswings, accent swings/slashes and ALL effects.
Uses Liquid Static font from https://github.com/profezzorn/SoundFonts as default.
Use sound controls bar to toggle sound on/off, control volume, or load a full font of your own with just a click.
Fullscreen mode option.
All effects use WavLen<> for their timings. (see settings panel to toggle on, or use a global value)

## Demo font preset links

Font demo links can now use a short preset key instead of exposing style text or WAV-list URLs:

`https://nosloppy.github.io/ProffieOS-StyleEditor-1/?font=<preset-key>`

If a link also includes the existing `&S=<encoded-style>` parameter, that explicit shared style still wins while the selected demo font remains active.

The public link only contains the safe preset key. Every approved WAV URL stays in repo-local files referenced by `demo_fonts.json`, never in the shared link.

The root editor default style is also stored repo-locally in `demo_fonts/default_style.txt` and loaded on startup instead of being kept inline in the page script.

### What a font-site owner needs to send the editor maintainer

- desired preset key (safe identifier characters only, for example `terra`)
- display name shown in the editor
- approved demo-only WAV URL list file contents
- default blade-style text to use when the link does not also include `&S=...`

Paid fonts should use a deliberately limited, approved demo subset. Browser playback cannot prevent a visitor from recording what they hear, so full commercial asset packs should not be exposed as demo presets.

### Maintainer file layout

Create repo-local files such as:

- `demo_fonts/<preset-key>_font_urls.txt`
- `demo_fonts/<preset-key>_style.txt`

Then add an entry to `demo_fonts.json`:

```json
{
  "version": 1,
  "presets": {
    "terra": {
      "name": "Terra",
      "font_urls": "demo_fonts/terra_font_urls.txt",
      "style": "demo_fonts/terra_style.txt"
    }
  }
}
```

`demo_fonts.json` ships as an empty starter manifest until approved demo presets are added.

### File formats

`demo_fonts/<preset-key>_font_urls.txt`

- one WAV URL per line
- remote WAV URLs must allow CORS for the editor origin
- relative entries are resolved relative to the list file, but the list file itself must stay repo-local

Example:

```text
https://example.com/demos/terra/hum.wav
https://example.com/demos/terra/clsh01.wav
https://example.com/demos/terra/swng01.wav
```

`demo_fonts/<preset-key>_style.txt`

- plain blade-style text
- same format accepted by the existing `?S=` parameter

Example:

```text
Layers<
  AudioFlicker<White,Blue>,
  InOutTrL<TrWipe<500>,TrWipeIn<500>>
>
```

### CORS requirement

Every remote WAV URL in a preset list must be fetchable by the editor in the browser. The host serving those WAV files must return an appropriate `Access-Control-Allow-Origin` header for each file request.

a test blade style that just does a different color wipe for each effect can be had here:
https://www.dropbox.com/scl/fi/kv3ja216z0jpxgbbeehff/testStyle.txt?rlkey=edjplu9s4dt3we30cp958i2k8&st=fh78wn6b&dl=0
A sound font with all sounds for testing here:
https://www.dropbox.com/scl/fo/ebwocpg9kcacdfvsz5j5w/ANNPnusbNrx6RK07tmnUli4?rlkey=iogr19073ky2wkr7ufdrsmb8a&st=7gah1epu&dl=0

A work in progress still for sure, but it's coming along.
