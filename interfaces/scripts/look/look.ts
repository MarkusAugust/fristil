/**
 * The look server: one sheet per component, three versions side by side.
 *
 * A prototype. It serves a page with three iframes, one per version of the
 * package (released, master, branch), and the page computes the difference
 * between them from computed style and geometry, in the browser. The branch
 * iframe is restyled over a WebSocket when a stylesheet on disk changes.
 *
 * Versions:
 *   released  git show v<version>:…   (the tag of the version on npm)
 *   master    git show <merge-base>:…
 *   branch    the file on disk
 */
import { watch } from "node:fs"
import { readFile } from "node:fs/promises"
import { join, resolve } from "node:path"

const PACKAGE = resolve(import.meta.dir, "../..")
const ROOT = resolve(PACKAGE, "..")
const PORT = Number(process.env.LOOK_PORT ?? 4196)
const RELEASED_TAG = process.env.LOOK_RELEASED ?? "v0.37.0"

type Version = "released" | "master" | "branch"
const VERSIONS: Version[] = ["released", "master", "branch"]

const STYLESHEETS = [
  "src/tokens/tokens.css",
  "src/components/css/button/button.css",
]

async function git(args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    cwd: ROOT,
    stdout: "pipe",
    stderr: "pipe",
  })
  const out = await new Response(proc.stdout).text()
  if ((await proc.exited) !== 0)
    throw new Error(
      `git ${args.join(" ")} failed: ${await new Response(proc.stderr).text()}`,
    )
  return out
}

const mergeBase = (await git(["merge-base", "HEAD", "master"])).trim()

async function stylesheet(version: Version, path: string): Promise<string> {
  const inRepo = `interfaces/${path}`
  if (version === "released") return git(["show", `${RELEASED_TAG}:${inRepo}`])
  if (version === "master") return git(["show", `${mergeBase}:${inRepo}`])
  return readFile(join(PACKAGE, path), "utf8")
}

async function css(version: Version): Promise<string> {
  const parts = await Promise.all(
    STYLESHEETS.map((s) => stylesheet(version, s)),
  )
  return parts.join("\n")
}

/** The sheet for lt-button: every variant, enabled and disabled, in both themes. */
function buttonSheet(): string {
  const variants = ["primary", "secondary", "ghost", "danger"]
  const row = (theme: string) =>
    `<div data-theme="${theme}" class="theme"><h2>${theme}</h2>${variants
      .map(
        (v) => `<div class="row">
      <button class="lt-button"${v === "primary" ? "" : ` data-variant="${v}"`}>Save ${v}</button>
      <button class="lt-button"${v === "primary" ? "" : ` data-variant="${v}"`} disabled>Save ${v}</button>
      <a class="lt-button"${v === "primary" ? "" : ` data-variant="${v}"`} href="#">Link ${v}</a>
      <div class="narrow"><button class="lt-button"${v === "primary" ? "" : ` data-variant="${v}"`}>A label long enough to wrap in a narrow box</button></div>
    </div>`,
      )
      .join("")}</div>`
  return `${row("light")}${row("dark")}`
}

function frameDocument(styles: string, sheet: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style id="package">${styles}</style>
<style id="sheet-style">
  html, body { margin: 0; }
  body { font-family: Georgia, serif; }
  .theme { padding: 16px; }
  .theme h2 { margin: 0 0 12px; font-size: 14px; font-weight: normal; }
  .row { display: flex; align-items: flex-start; gap: 12px; margin-block-end: 12px; }
  .narrow { width: 120px; }
  [data-look-changed] { outline: 3px dashed #e0e !important; outline-offset: 4px; }
</style></head><body><main id="sheet">${sheet}</main></body></html>`
}

/** Runs inside the look page: the comparison of two frames, from computed style and geometry. */
const DIFF_SCRIPT = `
function rect(node) {
  const r = node.getBoundingClientRect();
  return r.x.toFixed(2) + "," + r.y.toFixed(2) + "," + r.width.toFixed(2) + "," + r.height.toFixed(2);
}
function textRects(doc, node) {
  const range = doc.createRange();
  range.selectNodeContents(node);
  let out = "";
  for (const r of range.getClientRects()) out += r.x.toFixed(2) + "," + r.y.toFixed(2) + "," + r.width.toFixed(2) + "," + r.height.toFixed(2) + ";";
  return out;
}
function pseudos(node, cs) {
  const list = ["::before", "::after"];
  if (cs.display === "list-item") list.push("::marker");
  if (node.localName === "input" || node.localName === "textarea") list.push("::placeholder");
  return list;
}
const DERIVED = new Set(["width", "height", "block-size", "inline-size", "perspective-origin", "transform-origin", "-webkit-logical-width", "-webkit-logical-height"]);
function describe(node) {
  if (node.nodeType === 3) return describe(node.parentNode) + " text";
  let name = node.localName;
  if (node.classList.length) name += "." + Array.from(node.classList).join(".");
  for (const a of ["data-variant", "disabled", "href"]) if (node.hasAttribute(a)) name += "[" + a + (node.getAttribute(a) ? "=" + node.getAttribute(a) : "") + "]";
  const theme = node.closest("[data-theme]");
  if (theme) name += " (" + theme.getAttribute("data-theme") + ")";
  return name;
}
function compareStyles(key, a, b, differences, where) {
  const n = a.length;
  if (n !== b.length) { differences.push({ key: key + "|length", from: b.length, to: n, where, derived: false }); }
  for (let i = 0; i < n; i++) {
    const p = a[i];
    const va = a.getPropertyValue(p), vb = b.getPropertyValue(p);
    if (va !== vb) differences.push({ key: key + "|" + p, from: vb, to: va, where, derived: DERIVED.has(p) });
  }
}
let changedNodes = [];
function clearMarks(doc) {
  for (const el of doc.querySelectorAll("[data-look-changed]")) el.removeAttribute("data-look-changed");
}
function mark(nodes) {
  for (const el of nodes) el.setAttribute("data-look-changed", "");
}
/** Walks both documents in step and compares each node. a is the branch, b the reference. */
function diffDocuments(docA, docB) {
  const differences = [];
  const rootA = docA.getElementById("sheet"), rootB = docB.getElementById("sheet");
  const wA = docA.defaultView, wB = docB.defaultView;
  const walkA = docA.createTreeWalker(rootA, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  const walkB = docB.createTreeWalker(rootB, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let values = 0;
  let a = rootA, b = rootB, index = 0;
  while (a && b) {
    const key = index + ":" + (a.nodeType === 1 ? a.localName : "#text");
    if (a.nodeType !== b.nodeType || a.localName !== b.localName) { differences.push({ key, from: "different markup", to: "" }); break; }
    if (a.nodeType === 3) {
      const ra = textRects(docA, a), rb = textRects(docB, b);
      values++;
      if (ra !== rb) differences.push({ key: key + "|rects", from: rb, to: ra, where: describe(a), derived: true });
    } else {
      const ra = rect(a), rb = rect(b);
      values++;
      if (ra !== rb) differences.push({ key: key + "|rect", from: rb, to: ra, where: describe(a), derived: true });
      const csA = wA.getComputedStyle(a), csB = wB.getComputedStyle(b);
      values += csA.length;
      const before = differences.length;
      compareStyles(key, csA, csB, differences, describe(a));
      if (differences.some((d, i) => i >= before && !d.derived)) changedNodes.push(a);
      for (const pseudo of pseudos(a, csA)) {
        const pa = wA.getComputedStyle(a, pseudo), pb = wB.getComputedStyle(b, pseudo);
        if (pseudo === "::before" || pseudo === "::after") {
          const ca = pa.getPropertyValue("content"), cb = pb.getPropertyValue("content");
          values++;
          if (ca !== cb) differences.push({ key: key + pseudo + "|content", from: cb, to: ca, where: describe(a) + pseudo, derived: false });
          if (ca === "none" || ca === "normal") continue;
        }
        values += pa.length;
        compareStyles(key + pseudo, pa, pb, differences, describe(a) + pseudo);
      }
    }
    a = walkA.nextNode(); b = walkB.nextNode(); index++;
  }
  if (a || b) differences.push({ key: index + ":end", from: b ? "more nodes" : "", to: a ? "more nodes" : "" });
  return { differences, values };
}

window.lookDiff = function lookDiff(withReleased = true) {
  const frame = (v) => document.getElementById("frame-" + v).contentDocument;
  clearMarks(frame("branch"));
  changedNodes = [];
  const t0 = performance.now();
  const master = diffDocuments(frame("branch"), frame("master"));
  const t1 = performance.now();
  const released = withReleased ? diffDocuments(frame("branch"), frame("released")) : { differences: [], values: 0 };
  const result = {
    againstMaster: master.differences,
    againstReleased: released.differences,
    keys: master.values,
    snapshotMs: t1 - t0,
    totalMs: performance.now() - t0,
  };
  mark(changedNodes);
  render(result);
  return result;
};

/** Logical and vendor names repeat the physical ones in the summary, so they are left out there. */
const ALIAS = /^(-webkit-|.*-(block|inline)(-|$))/;
/**
 * Groups the differences by change, not by element: one line per set of
 * properties that went from the same value to the same value on the same
 * elements. Then a changed padding is one line, with the elements behind it.
 */
function summary(diffs) {
  if (diffs.length === 0) return "<p class=\\"same\\">No difference.</p>";
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const byChange = new Map();
  const movedOnly = new Set();
  const changedElements = new Set();
  for (const d of diffs) {
    if (d.derived) { movedOnly.add(d.where); continue; }
    const prop = d.key.split("|")[1];
    if (ALIAS.test(prop)) continue;
    const change = prop + "|" + d.from + "|" + d.to;
    if (!byChange.has(change)) byChange.set(change, { prop, from: d.from, to: d.to, elements: new Map() });
    const elements = byChange.get(change).elements;
    elements.set(d.where, (elements.get(d.where) ?? 0) + 1);
    changedElements.add(d.where);
  }
  for (const w of changedElements) movedOnly.delete(w);
  // Merge changes with the same values on the same elements.
  const merged = new Map();
  for (const change of byChange.values()) {
    const signature = change.from + "|" + change.to + "|" + Array.from(change.elements.keys()).sort().join(",");
    if (!merged.has(signature)) merged.set(signature, { props: [], from: change.from, to: change.to, elements: change.elements });
    merged.get(signature).props.push(change.prop);
  }
  let html = "<ul class=\\"changed\\">";
  for (const change of merged.values()) {
    const names = Array.from(change.elements.keys());
    const count = Array.from(change.elements.values()).reduce((a, b) => a + b, 0);
    html += "<li>" + change.props.map(p => "<code>" + esc(p) + "</code>").join(", ") + " " + esc(change.from) + " \\u2192 " + esc(change.to)
      + " on " + count + " element" + (count === 1 ? "" : "s") + ": " + esc(names.slice(0, 4).join(", ")) + (names.length > 4 ? " and " + (names.length - 4) + " more" : "") + "</li>";
  }
  html += "</ul>";
  if (movedOnly.size) html += "<p class=\\"moved\\">" + movedOnly.size + " element" + (movedOnly.size === 1 ? "" : "s") + " moved or resized as a consequence.</p>";
  return html;
}

function render(result) {
  document.getElementById("timing").textContent = result.keys + " values compared per pair in " + result.totalMs.toFixed(1) + " ms";
  document.getElementById("against-master").innerHTML = summary(result.againstMaster);
  document.getElementById("against-released").innerHTML = summary(result.againstReleased);
  const n = result.againstMaster.filter(d => !d.derived).length;
  document.title = (n ? n + " changed, " : "") + "lt-button";
}

// Hot swap: the server sends the branch stylesheet when a file on disk changes.
const socket = new WebSocket("ws://" + location.host + "/ws");
socket.onmessage = (event) => {
  const received = performance.now();
  const message = JSON.parse(event.data);
  if (message.type !== "css") return;
  for (const id of ["frame-branch", "compare-branch"]) document.getElementById(id).contentDocument.getElementById("package").textContent = message.css;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const result = window.lookDiff(true);
    result.swapToDiffMs = performance.now() - received;
    window.lastSwap = result;
    document.getElementById("timing").textContent += ", " + result.swapToDiffMs.toFixed(1) + " ms from the stylesheet arriving";
    document.dispatchEvent(new CustomEvent("look-swapped", { detail: result }));
  }));
};
// The compare panel: master under, branch on top, clipped by the slider.
const slider = document.getElementById("slider");
const compare = document.getElementById("compare");
function setSlider() {
  const percent = Number(slider.value);
  document.getElementById("compare-branch").style.clipPath = "inset(0 " + (100 - percent) + "% 0 0)";
  document.getElementById("divider").style.left = percent + "%";
}
slider.addEventListener("input", setSlider);
setSlider();
document.getElementById("difference").addEventListener("change", (e) => {
  compare.classList.toggle("difference", e.target.checked);
  if (e.target.checked) { slider.value = 100; setSlider(); }
});
window.addEventListener("load", () => {
  const frames = document.querySelectorAll("iframe");
  let pending = frames.length;
  frames.forEach(f => {
    const done = () => { if (--pending === 0) { window.lookReady = true; document.dispatchEvent(new Event("look-ready")); } };
    if (f.contentDocument && f.contentDocument.readyState === "complete" && f.contentDocument.getElementById("sheet")) done(); else f.addEventListener("load", done);
  });
});
`

async function lookPage(): Promise<string> {
  const frames = VERSIONS.map(
    (v) =>
      `<section><h1>${v}</h1><iframe id="frame-${v}" title="${v}" src="/frame/button/${v}"></iframe></section>`,
  ).join("")
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>lt-button</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #eee; color: #111; }
  header { padding: 12px 16px; background: #fff; border-bottom: 1px solid #ccc; }
  header h1 { font-size: 16px; margin: 0 0 8px; }
  #timing { font: 12px ui-monospace, monospace; color: #555; }
  .report { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 8px; font-size: 13px; }
  .report h2 { font-size: 13px; margin: 0 0 4px; font-weight: 600; }
  .report ul { margin: 0; padding-left: 18px; }
  .report li { margin: 2px 0; }
  .report code { background: #f3f3f3; padding: 0 3px; }
  .same { color: #2a7; margin: 0; }
  .moved { color: #666; margin: 4px 0 0; }
  .layout { display: grid; grid-template-columns: 1136px 1fr; gap: 8px; padding: 8px; align-items: start; }
  .compare-panel h1, section h1 { font-size: 13px; font-weight: normal; margin: 0 0 4px; display: flex; gap: 16px; align-items: center; }
  .compare-panel h1 input[type=range] { flex: 1; }
  #compare { position: relative; width: 1120px; height: 780px; overflow: auto; background: #fff; }
  #compare iframe { position: absolute; inset: 0; width: 1120px; height: 1400px; border: 0; }
  #compare-branch { z-index: 1; }
  #divider { position: absolute; top: 0; bottom: 0; width: 2px; background: #e0e; z-index: 2; pointer-events: none; }
  #compare.difference #compare-branch { mix-blend-mode: difference; }
  #compare.difference { filter: contrast(3) brightness(1.5); }
  #compare.difference #divider { display: none; }
  .frames { display: grid; gap: 8px; }
  .frames iframe { width: 560px; height: 420px; border: 0; background: #fff; display: block; }
</style></head><body>
<header>
  <h1>lt-button</h1>
  <div id="timing">waiting for the frames</div>
  <div class="report">
    <div><h2>This branch against master</h2><div id="against-master"></div></div>
    <div><h2>This branch against the released ${RELEASED_TAG}</h2><div id="against-released"></div></div>
  </div>
</header>
<div class="layout">
  <div class="compare-panel">
    <h1>master <input id="slider" type="range" min="0" max="100" value="50" aria-label="How much of the branch to show"> branch
      <label><input id="difference" type="checkbox"> difference</label></h1>
    <div id="compare">
      <iframe id="compare-master" title="master, for comparison" src="/frame/button/master"></iframe>
      <iframe id="compare-branch" title="branch, for comparison" src="/frame/button/branch"></iframe>
      <div id="divider"></div>
    </div>
  </div>
  <div class="frames">${frames}</div>
</div>
<script>${DIFF_SCRIPT}</script>
</body></html>`
}

const sockets = new Set<import("bun").ServerWebSocket<unknown>>()

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: PORT,
  async fetch(request, server) {
    const url = new URL(request.url)
    if (url.pathname === "/ws")
      return server.upgrade(request)
        ? undefined
        : new Response("no", { status: 400 })
    if (url.pathname === "/" || url.pathname === "/sheet/button") {
      return new Response(await lookPage(), {
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    }
    const frame = url.pathname.match(
      /^\/frame\/button\/(released|master|branch)$/,
    )
    if (frame) {
      const version = frame[1] as Version
      return new Response(frameDocument(await css(version), buttonSheet()), {
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    }
    return new Response("not found", { status: 404 })
  },
  websocket: {
    open(ws) {
      sockets.add(ws)
    },
    close(ws) {
      sockets.delete(ws)
    },
    message() {},
  },
})

let timer: ReturnType<typeof setTimeout> | undefined
watch(join(PACKAGE, "src"), { recursive: true }, (_event, file) => {
  if (!file || !String(file).endsWith(".css")) return
  clearTimeout(timer)
  timer = setTimeout(async () => {
    const text = await css("branch")
    const message = JSON.stringify({ type: "css", css: text, at: Date.now() })
    for (const ws of sockets) ws.send(message)
  }, 5)
})

console.log(
  `look: http://127.0.0.1:${server.port}/sheet/button  (released ${RELEASED_TAG}, master ${mergeBase.slice(0, 7)})`,
)
