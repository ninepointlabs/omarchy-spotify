// Node test runner (`node --test tests/model.test.cjs`) for the trusted
// executable and closed environment layer in Model.js, plus a static check
// that the QML never starts a program any other way.
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const ROOT = path.join(__dirname, "..")

// Model.js is a QML `.pragma library` script rather than a CommonJS module:
// drop the pragma and evaluate it in a fresh context whose globals are its API.
function loadModel() {
  const source = fs.readFileSync(path.join(ROOT, "Model.js"), "utf8").replace(/^\.pragma library\s*$/m, "")
  const context = vm.createContext({})
  vm.runInContext(source, context, { filename: "Model.js" })
  return context
}

const Model = loadModel()
// Values from the vm context carry that realm's prototypes; compare as JSON.
const plain = (value) => JSON.parse(JSON.stringify(value))

const TOOLS = {
  "uwsm-app": "/usr/bin/uwsm-app",
  "omarchy-launch-or-focus": "/usr/share/omarchy/bin/omarchy-launch-or-focus",
  "omarchy-launch-floating-terminal-with-presentation": "/usr/share/omarchy/bin/omarchy-launch-floating-terminal-with-presentation"
}

test("trustedExecutable accepts only clean paths inside trusted directories", () => {
  assert.equal(Model.trustedExecutable("/usr/bin/python3"), "/usr/bin/python3")
  assert.equal(Model.trustedExecutable("/run/current-system/sw/bin/python3"), "/run/current-system/sw/bin/python3")
  for (const bad of ["python3", "./python3", "/usr/local/bin/python3", "/home/tim/.local/bin/python3",
    "/usr/bin/../../tmp/python3", "/usr/bin/.python3", "/usr/bin/py thon", "/usr/bin/", "/usr/bin/sub/python3",
    "/usr/bin/python3\n", "", null, undefined, 42, ["/usr/bin/python3"]]) {
    assert.equal(Model.trustedExecutable(bad), "", String(bad))
  }
  assert.equal(Model.trustedExecutable("/usr/share/omarchy/bin/omarchy"), "")
  assert.equal(Model.trustedExecutable("/usr/share/omarchy/bin/omarchy", Model.trustedOmarchyDirectories), "/usr/share/omarchy/bin/omarchy")
})

test("the bridge runs under an isolated absolute interpreter or not at all", () => {
  assert.deepEqual(plain(Model.bridgeCommand("/usr/bin/python3", "/p/bin/spotify-bridge", ["search", "a b; $(id)"])),
    ["/usr/bin/python3", "-I", "-B", "/p/bin/spotify-bridge", "search", "a b; $(id)"])
  assert.deepEqual(plain(Model.bridgeCommand("python3", "/p/bin/spotify-bridge", ["status"])), [])
  assert.deepEqual(plain(Model.bridgeCommand("/home/x/bin/python3", "/p/bin/spotify-bridge", ["status"])), [])
  assert.deepEqual(plain(Model.bridgeCommand("/usr/bin/python3", "bin/spotify-bridge", ["status"])), [])
  assert.deepEqual(plain(Model.bridgeCommand("", "/p/bin/spotify-bridge", ["status"])), [])
})

test("every python candidate is probed as an absolute isolated command", () => {
  for (const candidate of Model.pythonCandidates) {
    const command = plain(Model.pythonProbeCommand(candidate))
    assert.equal(command[0], candidate)
    assert.equal(command[1], "-I")
  }
  assert.deepEqual(plain(Model.pythonProbeCommand("python3")), [])
})

test("closedEnvironment keeps only listed single-line values and pins PATH", () => {
  const env = plain(Model.closedEnvironment({
    HOME: "/home/x",
    PATH: "/tmp/evil:/usr/bin",
    LD_PRELOAD: "/tmp/evil.so",
    DBUS_SESSION_BUS_ADDRESS: "unix:path=/run/user/1/bus\nBASH_ENV=/tmp/x",
    USER: ""
  }, ["HOME", "PATH", "DBUS_SESSION_BUS_ADDRESS", "USER"], Model.trustedPathEnvironment, { PATH: "/tmp/nope", OMARCHY_PATH: "/usr/share/omarchy" }))
  assert.deepEqual(env, { HOME: "/home/x", OMARCHY_PATH: "/usr/share/omarchy", PATH: Model.trustedPathEnvironment })
})

test("no environment allow-list carries a code-loading or command variable", () => {
  const forbidden = ["PATH", "LD_PRELOAD", "LD_LIBRARY_PATH", "LD_AUDIT", "BASH_ENV", "ENV", "PYTHONPATH",
    "PYTHONHOME", "PYTHONSTARTUP", "QT_PLUGIN_PATH", "QML2_IMPORT_PATH", "GTK_MODULES", "TERMINAL", "EDITOR",
    "BROWSER", "XDG_DATA_DIRS", "XDG_CONFIG_DIRS", "http_proxy", "https_proxy", "HTTPS_PROXY", "SSL_CERT_FILE",
    "OMARCHY_PATH", "SHELL"]
  for (const list of [Model.bridgeEnvironmentNames, Model.launchEnvironmentNames]) {
    for (const name of plain(list)) {
      assert.ok(!forbidden.includes(name), name)
      assert.ok(!/^BASH_FUNC_|^LD_|^PYTHON/.test(name), name)
    }
  }
  for (const dir of plain(Model.trustedPathEnvironment.split(":")).concat(plain(Model.trustedSessionPathEnvironment.split(":")))) {
    assert.ok(!dir.startsWith("/home") && !dir.startsWith("/usr/local") && dir.startsWith("/"), dir)
  }
})

test("detached launches use trusted absolute tools under their own names", () => {
  assert.deepEqual(plain(Model.appLaunchCommand(TOOLS, "/usr/bin/spotify")), ["/usr/bin/uwsm-app", "--", "/usr/bin/spotify"])
  assert.deepEqual(plain(Model.focusAppCommand(TOOLS)), ["/usr/share/omarchy/bin/omarchy-launch-or-focus", "spotify"])
  assert.deepEqual(plain(Model.installLaunchCommand(TOOLS)),
    ["/usr/share/omarchy/bin/omarchy-launch-floating-terminal-with-presentation", Model.installCommand])

  assert.deepEqual(plain(Model.appLaunchCommand(TOOLS, "/usr/local/bin/spotify")), [])
  assert.deepEqual(plain(Model.appLaunchCommand(TOOLS, "/usr/bin/sh")), [])
  assert.deepEqual(plain(Model.appLaunchCommand({ "uwsm-app": "/home/x/.local/bin/uwsm-app" }, "/usr/bin/spotify")), [])
  assert.deepEqual(plain(Model.appLaunchCommand({ "uwsm-app": "/usr/bin/sh" }, "/usr/bin/spotify")), [])
  assert.deepEqual(plain(Model.appLaunchCommand({ "uwsm-app": "/usr/share/omarchy/bin/uwsm-app" }, "/usr/bin/spotify")), [])
  assert.deepEqual(plain(Model.focusAppCommand({ "omarchy-launch-or-focus": "/tmp/omarchy-launch-or-focus" })), [])
  assert.deepEqual(plain(Model.installLaunchCommand({})), [])
  assert.deepEqual(plain(Model.installLaunchCommand(null)), [])
})

test("the QML starts programs only through closed-environment Process objects", () => {
  const service = fs.readFileSync(path.join(ROOT, "Service.qml"), "utf8")
  const qml = ["Service.qml", "Panel.qml", "BarWidget.qml", "AboutView.qml"].map((file) => fs.readFileSync(path.join(ROOT, file), "utf8")).join("\n")
  // No shell strings, no bar.run, no execDetached, no bare bridge invocation.
  for (const pattern of [/\bbash\b/, /-lc\b/, /execDetached/, /\.run\(/, /command:\s*\[\s*bridge\b/]) {
    assert.ok(!pattern.test(qml), String(pattern))
  }
  const processes = (service.match(/\bProcess\s*\{/g) || []).length
  const closed = (service.match(/clearEnvironment:\s*true/g) || []).length
  assert.ok(processes >= 3)
  assert.equal(closed, processes)
})

test("About: facts come from the repo, details and mailto are well formed", () => {
  const About = require(path.join(ROOT, "About.js"))
  const manifest = fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8")
  assert.equal(About.manifestVersion(manifest), JSON.parse(manifest).version)
  assert.equal(About.manifestVersion("not json"), "")
  assert.equal(About.manifestVersion('{"version":"1.0 <b>"}'), "")
  assert.equal(JSON.parse(manifest).author, "Nine Point Labs")
  assert.equal(About.NAME, JSON.parse(manifest).name)
  assert.equal(About.ORGANIZATION, "Nine Point Labs")
  assert.equal(About.SUPPORT_EMAIL, "help@ninepointlabs.com")

  const license = fs.readFileSync(path.join(ROOT, "LICENSE"), "utf8")
  assert.equal(About.licenseSummary(license), "MIT License, © 2026 Nine Point Labs")
  const body = About.licenseBody(license)
  assert.ok(body.startsWith("MIT License\n\nCopyright (c) 2026 Nine Point Labs\n\nPermission"))
  assert.ok(!body.includes("a copy\nof"))

  assert.equal(About.probedVersion((major, minor) => major === 6 && minor <= 11, 6), "6.11")
  assert.equal(About.probedVersion((major, minor) => major === 0 && minor <= 3, 0), "0.3")
  assert.equal(About.probedVersion(() => false, 6), "")
  assert.equal(About.probedVersion(null, 6), "")

  const versions = { quickshell: "0.3", qt: "6.11", python: "3.14.7" }
  assert.equal(About.builtWith(versions), "Quickshell 0.3, Qt 6.11, Python 3.14.7")
  assert.equal(About.builtWith({}), "Quickshell, Qt and Python")
  const details = About.details("0.1.0", versions, "Hyprland, wayland")
  assert.equal(details, "Omarchy Spotify plugin 0.1.0\nQuickshell 0.3, Qt 6.11, Python 3.14.7\nHyprland, wayland")
  const mail = About.mailto("0.1.0", details)
  assert.ok(mail.startsWith("mailto:help@ninepointlabs.com?subject=Omarchy%20Spotify%20plugin%200.1.0&body="))
  assert.ok(decodeURIComponent(mail.split("&body=")[1]).endsWith("Python 3.14.7\nHyprland, wayland"))
})

test("About: the repo spells the company Nine Point Labs", () => {
  for (const file of ["LICENSE", "manifest.json", "README.md", "About.js"]) {
    const text = fs.readFileSync(path.join(ROOT, file), "utf8")
    assert.ok(!/Ninepoint Labs|NINEPOINT LABS/.test(text), file)
  }
})

test("About is reachable from the header, the `i` key and IPC, and resets on close", () => {
  const panel = fs.readFileSync(path.join(ROOT, "Panel.qml"), "utf8")
  const widget = fs.readFileSync(path.join(ROOT, "BarWidget.qml"), "utf8")
  assert.match(panel, /objectName: "aboutButton"[\s\S]*?onClicked: root\.setAbout\(true\)/)
  assert.match(panel, /t === "i"\) \{ root\.setAbout\(!root\.showAbout\)/)
  assert.match(panel, /if \(root\.showAbout\) \{ root\.setAbout\(false\); return \}/)
  assert.match(panel, /if \(!opened\) \{[\s\S]*?showAbout = false/)
  assert.match(widget, /function about\(\): void \{ root\.open\(\); if \(panelLoader\.item\) panelLoader\.item\.setAbout\(true\) \}/)
})

test("install.sh ships the About page and the LICENSE it reads", () => {
  const install = fs.readFileSync(path.join(ROOT, "install.sh"), "utf8")
  const list = install.match(/^for entry in (.*); do$/m)[1].split(/\s+/)
  for (const file of ["About.js", "AboutView.qml", "LICENSE", "manifest.json", "Panel.qml"]) assert.ok(list.includes(file), file)
})
