# Spotify for Omarchy

Spotify in the Omarchy bar. The chip shows the cover of what's playing (or
what played last) next to a scrolling title; click it for a panel with the
full now-playing hero, transport, volume, device switcher, and four tabs —
**Search**, **Playlists**, **Books**, **Podcasts**.

- **Now playing** — cover art, title, artist · album, seekable progress,
  shuffle / previous / play-pause / next / repeat, volume, and a heart to
  save or unsave the current track.
- **Search** — tracks, artists, albums, playlists, podcasts, episodes and
  audiobooks in one query, grouped. Empty search shows recently played.
- **Playlists** — Liked Songs plus every playlist you own or follow; open
  one to see its tracks, play from any row, or shuffle the lot.
- **Books** — your saved audiobooks with chapter lists and resume progress.
- **Podcasts** — shows you follow, episodes with dates, length and how far
  in you are.
- **Devices** — see every Spotify Connect device, switch playback, launch
  the desktop app, or sign out.
- **Keyboard first** — the whole panel drives from the keyboard (see below).

## Requirements

- Omarchy 4 (Quickshell shell).
- **Spotify Premium.** Spotify requires it for playback control, and since
  February 2026 also for any Web API app in development mode.
- A Spotify **developer app** of your own (two-minute one-time setup; the
  panel walks you through it). Spotify no longer lets third-party apps share
  a client ID, so each install brings its own.
- A playback device. The Spotify desktop app is the obvious one
  (`omarchy install service spotify`); a phone or speaker on the same
  account works too.
- Python 3 (standard library only) — the plugin's bridge to the Web API.

## Install

```sh
omarchy plugin add https://github.com/ninepointlabs/omarchy-spotify.git --enable
```

That clones into `~/.config/omarchy/plugins/ninepointlabs.spotify` and adds
the chip to the bar's right section. Move it wherever you like:

```sh
omarchy bar move ninepointlabs.spotify --before omarchy.audio
```

From a local checkout (this repo's own convention is `~/Projects/omarchy-spotify`):

```sh
./install.sh            # copies into ~/.config/omarchy/plugins and enables it
```

## Connect your account

1. Open <https://developer.spotify.com/dashboard> and **Create app**.
   Name and description are yours to pick.
2. Under **Redirect URIs** add exactly
   `http://127.0.0.1:8888/callback` (use the IP, not `localhost` — Spotify
   rejects that). Tick **Web API** and save.
3. Copy the app's **Client ID**, open the panel, paste it, and click
   **Connect…**. Your browser opens Spotify's consent page; approve, and the
   panel flips to the player on its own.

Tokens live in `~/.local/state/omarchy-spotify/auth.json` (mode 0600). No
client secret is involved — the login uses PKCE. Spotify caps a login at six
months; when it lapses the panel shows the connect card again and one click
picks up where you left off. **Sign out** lives under the device button.

If port 8888 is taken, change `redirectPort` in the widget's settings and use
the matching redirect URI in the Spotify dashboard.

## Using it

| Where | Action |
|---|---|
| Bar chip, left click | open / close the panel |
| Bar chip, middle click | play / pause |
| Bar chip, right click | next track |
| Bar chip, scroll | volume ±5 |
| Cover in the panel | play / pause |
| Row, click | play (tracks, episodes, chapters, artists) or open (playlists, albums, podcasts, audiobooks) |
| Row, right or middle click | add to queue |
| Row, hover | reveals **+** (queue) and **▶** (play) buttons |
| Device button | switch Spotify Connect device, launch the app, sign out |

Keyboard, while the panel is open:

| Key | Action |
|---|---|
| `j` / `k`, arrows | move the cursor |
| `Enter` | open or play the row under the cursor |
| `Space` | play / pause |
| `n` / `p` | next / previous |
| `s` | toggle shuffle |
| `f` | save / unsave the current track |
| `+` / `-` | volume ±5 |
| `q` | add the row under the cursor to the queue |
| `/` | focus the search field (`Esc` leaves it, `↓` jumps to results) |
| `1` – `4`, `h` / `l` | switch tabs |
| `h` or `Esc` | back out of a playlist / book / podcast |
| `d` | devices |
| `r` | refresh |
| `Tab` / `Shift+Tab` | next / previous bar panel |
| `Esc` | close |

## Settings

Inline on the widget's entry in `~/.config/omarchy/shell.json`:

| Key | Default | Meaning |
|---|---|---|
| `clientId` | `""` | Your Spotify app's Client ID (the panel writes this for you). |
| `redirectPort` | `8888` | Loopback port for the login redirect. |
| `showTrack` | `true` | Show "Title · Artist" next to the cover in the bar. |
| `maxLabelWidth` | `180` | Pixel width of that label before it scrolls. |
| `defaultTab` | `"search"` | Tab the panel opens on; remembers the last one you picked. |

```sh
omarchy bar set ninepointlabs.spotify showTrack false
```

## Scripting

Two IPC targets are registered:

```sh
omarchy-shell ninepointlabs.spotify toggle      # open/close the panel
omarchy-shell spotify playPause                 # also: next, previous, volumeUp, volumeDown, status
omarchy-shell spotify status                    # JSON: playing, title, artist, device, progress
```

Bind them in `~/.config/hypr/bindings.lua` if you want media keys without
the panel. The `bin/spotify-bridge` helper is a plain CLI too — run it with
`--help` to explore.

## How it works

- `bin/spotify-bridge` (Python, stdlib only) does every request: PKCE login,
  token refresh, player state and control, library reads, search, and
  cover-art caching under `~/.cache/omarchy-spotify/art`. Each call prints
  one JSON envelope so the shell never touches HTTP.
- `Service.qml` is the single per-shell instance the widgets and panels
  share. It polls the player every 4 s while the panel is open, every 15 s
  while something plays with the panel closed, and every 60 s when idle;
  progress is interpolated locally between polls. Actions apply
  optimistically and re-poll shortly after.
- `BarWidget.qml` is the chip; `Panel.qml` is the popup, built on the shell's
  `KeyboardPanel` / `PanelKeyCatcher` so it matches the stock panels. Every
  tab renders into one flat row list, which is what lets a single cursor
  walk Search, Playlists, Books and Podcasts alike.
- Spotify's February 2026 development-mode rules shape a few things: search
  returns at most 10 per type, other people's playlists expose no track list
  (Play still works), and there are no browse or recommendation feeds.

## License

MIT — see `LICENSE`.
