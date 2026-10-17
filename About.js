// Facts and text for the About view (AboutView.qml), kept out of QML so node
// can check them (tests/model.test.cjs) and Python can check the privacy text
// against every host the bridge may reach (tests/test_bridge.py).
//
// The version comes from manifest.json and the license from LICENSE at run
// time, so neither is copied here and neither can drift from the real file.

var NAME = "Spotify"
var TAGLINE = "Spotify in the Omarchy bar: now playing, controls, search, playlists, audiobooks and podcasts."
var ORGANIZATION = "Nine Point Labs"
var CREATED = "September 2026" // first commit: 2026-09-07
var SUPPORT_EMAIL = "help@ninepointlabs.com"

// Must stay true to what the plugin does. Network: only bin/spotify-bridge
// (API, ACCOUNTS, ART_HOST_RE), plus the panel showing a cover straight from
// the URL Spotify returned when it could not be cached. Files: auth.json and
// last-played.json (both 0600), the art cache, shell.json.
var PRIVACY = "No telemetry and no Nine Point Labs servers: the plugin talks only to Spotify. "
  + "api.spotify.com is used for playback, devices, your library and search; accounts.spotify.com "
  + "for signing in (PKCE, no client secret, no password) and renewing the login; and Spotify's image "
  + "CDNs (*.scdn.co, *.spotifycdn.com) for cover art. Signing in opens accounts.spotify.com in your "
  + "browser, which hands back to a listener on 127.0.0.1 only. Your login (tokens, Client ID and "
  + "Spotify display name) is kept in ~/.local/state/omarchy-spotify/auth.json, readable only by you "
  + "(0600), next to the last item played; cover art is cached in ~/.cache/omarchy-spotify/art; the "
  + "Client ID and panel settings are saved in ~/.config/omarchy/shell.json. Soloist, if you run it, "
  + "is Spotify's own player; this plugin never stores or handles its API key."

// "0.1.0" from manifest.json's text, or "" when it can't be read.
function manifestVersion(text) {
  try {
    var v = JSON.parse(String(text || "")).version
    return typeof v === "string" && /^[0-9A-Za-z.+-]{1,32}$/.test(v) ? v : ""
  } catch (e) {
    return ""
  }
}

// "MIT License, © 2026 Nine Point Labs" from LICENSE's text: its first line
// plus its copyright line, as written there.
function licenseSummary(text) {
  var lines = String(text || "").split("\n")
  var name = ""
  var holder = ""
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim()
    if (line === "") continue
    if (name === "") name = line
    var m = /^Copyright\s+(?:\(c\)|©)\s*(.+)$/i.exec(line)
    if (m) { holder = "© " + m[1]; break }
  }
  return holder ? name + ", " + holder : name
}

// LICENSE with one line per paragraph, so it wraps to the panel's width.
function licenseBody(text) {
  var paras = String(text || "").replace(/\r/g, "").split(/\n\s*\n/)
  var out = []
  for (var i = 0; i < paras.length; i++) {
    var p = paras[i].split(/\s+/).join(" ").trim()
    if (p !== "") out.push(p)
  }
  return out.join("\n\n")
}

// Highest minor version `has(major, minor)` accepts, as "major.minor"
// (Quickshell.hasVersion / hasQtVersion only answer yes or no), or "".
function probedVersion(has, major) {
  if (typeof has !== "function" || !has(major, 0)) return ""
  var minor = 0
  while (minor < 99 && has(major, minor + 1)) minor++
  return major + "." + minor
}

// { quickshell, qt, python } -> "Quickshell 0.3, Qt 6.11, Python 3.14.7".
function builtWith(v) {
  var out = []
  if (v && v.quickshell) out.push("Quickshell " + v.quickshell)
  if (v && v.qt) out.push("Qt " + v.qt)
  if (v && v.python) out.push("Python " + v.python)
  return out.length ? out.join(", ") : "Quickshell, Qt and Python"
}

// Version details to paste into a support email.
function details(version, v, desktop) {
  return "Omarchy " + NAME + " plugin " + (version || "unknown version") + "\n"
    + builtWith(v) + "\n"
    + (desktop || "unknown desktop")
}

function mailto(version, detailText) {
  return "mailto:" + SUPPORT_EMAIL
    + "?subject=" + encodeURIComponent("Omarchy " + NAME + " plugin " + (version || ""))
    + "&body=" + encodeURIComponent("\n\n--\n" + detailText)
}

if (typeof module !== "undefined") {
  module.exports = {
    NAME: NAME, TAGLINE: TAGLINE, ORGANIZATION: ORGANIZATION, CREATED: CREATED,
    SUPPORT_EMAIL: SUPPORT_EMAIL, PRIVACY: PRIVACY,
    manifestVersion: manifestVersion, licenseSummary: licenseSummary, licenseBody: licenseBody,
    probedVersion: probedVersion, builtWith: builtWith, details: details, mailto: mailto
  }
}
