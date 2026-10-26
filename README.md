# lukaskoebis.com

### Local dev

```
npx serve -s -l 3000 --no-cache --symlinks
```

### Diving media

Clips, loops and posters for `diving.html` are on Cloudflare R2 (bucket
`lukaskoebis-video`, served at `video.lukaskoebis.com` under `clips/`, `loops/`,
`posters/`). Locally the page reads them from `video-local/`, a gitignored
symlink to the mirror folder (`~/Downloads/diving/web`).
