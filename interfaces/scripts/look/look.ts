/**
 * The look server: one sheet per component, three versions side by side.
 *
 * A prototype. It serves a page with three iframes, one per version of the
 * package (released, master, branch), and the page computes the difference
 * between them from computed style and geometry, in the browser. The branch
 * iframes are restyled over a WebSocket when a stylesheet on disk changes.
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

/** The width every copy of the sheet is laid out at, so a crop from one matches a crop from another. */
const SHEET_WIDTH = 560

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
const SHEET_WIDTH = ${SHEET_WIDTH};
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
function compareStyles(key, index, a, b, differences, where) {
  const n = a.length;
  if (n !== b.length) { differences.push({ key: key + "|length", index, from: b.length, to: n, where, derived: false }); }
  for (let i = 0; i < n; i++) {
    const p = a[i];
    const va = a.getPropertyValue(p), vb = b.getPropertyValue(p);
    if (va !== vb) differences.push({ key: key + "|" + p, index, from: vb, to: va, where, derived: DERIVED.has(p) });
  }
}
function clearMarks(doc) {
  for (const el of doc.querySelectorAll("[data-look-changed]")) el.removeAttribute("data-look-changed");
}
/** Marks the elements at the given positions in a copy of the sheet. */
function mark(doc, indices) {
  clearMarks(doc);
  const walker = doc.createTreeWalker(doc.getElementById("sheet"), NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let index = 0;
  for (let node = walker.currentNode; node; node = walker.nextNode(), index++) {
    if (indices.has(index) && node.nodeType === 1) node.setAttribute("data-look-changed", "");
  }
}
/** Walks both documents in step and compares each node. a is the branch, b the reference. */
function diffDocuments(docA, docB) {
  const differences = [];
  const nodesA = [], nodesB = [];
  const rootA = docA.getElementById("sheet"), rootB = docB.getElementById("sheet");
  const wA = docA.defaultView, wB = docB.defaultView;
  const walkA = docA.createTreeWalker(rootA, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  const walkB = docB.createTreeWalker(rootB, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let values = 0;
  let a = rootA, b = rootB, index = 0;
  while (a && b) {
    nodesA.push(a); nodesB.push(b);
    const key = index + ":" + (a.nodeType === 1 ? a.localName : "#text");
    if (a.nodeType !== b.nodeType || a.localName !== b.localName) { differences.push({ key, index, from: "different markup", to: "", where: describe(a), derived: false }); break; }
    if (a.nodeType === 3) {
      const ra = textRects(docA, a), rb = textRects(docB, b);
      values++;
      if (ra !== rb) differences.push({ key: key + "|rects", index, from: rb, to: ra, where: describe(a), derived: true });
    } else {
      const ra = rect(a), rb = rect(b);
      values++;
      if (ra !== rb) differences.push({ key: key + "|rect", index, from: rb, to: ra, where: describe(a), derived: true });
      const csA = wA.getComputedStyle(a), csB = wB.getComputedStyle(b);
      values += csA.length;
      compareStyles(key, index, csA, csB, differences, describe(a));
      for (const pseudo of pseudos(a, csA)) {
        const pa = wA.getComputedStyle(a, pseudo), pb = wB.getComputedStyle(b, pseudo);
        if (pseudo === "::before" || pseudo === "::after") {
          const ca = pa.getPropertyValue("content"), cb = pb.getPropertyValue("content");
          values++;
          if (ca !== cb) differences.push({ key: key + pseudo + "|content", index, from: cb, to: ca, where: describe(a) + pseudo, derived: false });
          if (ca === "none" || ca === "normal") continue;
        }
        values += pa.length;
        compareStyles(key + pseudo, index, pa, pb, differences, describe(a) + pseudo);
      }
    }
    a = walkA.nextNode(); b = walkB.nextNode(); index++;
  }
  if (a || b) differences.push({ key: index + ":end", index, from: b ? "more nodes" : "", to: a ? "more nodes" : "", where: "the sheet", derived: false });
  return { differences, values, nodesA, nodesB };
}

/** Logical and vendor names repeat the physical ones, so the summary leaves them out. */
const ALIAS = /^(-webkit-|.*-(block|inline)(-|$)|.*-(start|end)-(start|end)-)/;
/**
 * Groups the differences by change, not by element: one group per set of
 * properties that went from the same value to the same value on the same
 * elements. A changed padding is then one group, with the elements behind it.
 */
function groupChanges(diffs) {
  const byChange = new Map();
  const changedIndices = new Set();
  const movedIndices = new Set();
  for (const d of diffs) {
    if (d.derived) { movedIndices.add(d.index); continue; }
    const prop = d.key.split("|")[1] ?? d.key;
    if (ALIAS.test(prop)) continue;
    const change = prop + "|" + d.from + "|" + d.to;
    if (!byChange.has(change)) byChange.set(change, { prop, from: d.from, to: d.to, elements: new Map() });
    byChange.get(change).elements.set(d.index, d.where);
    changedIndices.add(d.index);
  }
  for (const i of changedIndices) movedIndices.delete(i);
  const merged = new Map();
  for (const change of byChange.values()) {
    const signature = change.from + "|" + change.to + "|" + Array.from(change.elements.keys()).sort((x, y) => x - y).join(",");
    if (!merged.has(signature)) merged.set(signature, { props: [], from: change.from, to: change.to, elements: change.elements });
    merged.get(signature).props.push(change.prop);
  }
  return { groups: Array.from(merged.values()), changedIndices, moved: movedIndices.size };
}

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/*
 * A window is a crop of one copy of the sheet: a box the size of the element
 * with an iframe of the sheet behind it, shifted so the element shows. The
 * iframes are kept in a pool by version and position, so a new diff reuses
 * them and nothing reloads.
 */
const MARGIN = 14;
const pool = new Map();
function windowFor(version, index, slot) {
  const key = version + ":" + index + ":" + slot;
  if (!pool.has(key)) {
    const box = document.createElement("div");
    box.className = "window " + version;
    const iframe = document.createElement("iframe");
    iframe.src = "/frame/button/" + version;
    iframe.dataset.version = version;
    iframe.title = version;
    iframe.width = SHEET_WIDTH;
    iframe.height = 1600;
    box.append(iframe);
    pool.set(key, { box, iframe });
  }
  return pool.get(key);
}
function placeWindow(entry, x, y, w, h) {
  entry.box.style.width = (w + 2 * MARGIN) + "px";
  entry.box.style.height = (h + 2 * MARGIN) + "px";
  entry.iframe.style.left = (MARGIN - x) + "px";
  entry.iframe.style.top = (MARGIN - y) + "px";
}
function union(a, b) {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.right, b.right) - x, h: Math.max(a.bottom, b.bottom) - y };
}

/** The crops: for each group, before and after of the first few elements. */
function renderChanges(result) {
  const container = document.getElementById("changes");
  for (const { box } of pool.values()) box.remove();
  container.innerHTML = "";
  const { groups, moved } = result.grouped;
  groups.forEach((group, n) => {
    const section = document.createElement("section");
    section.className = "change";
    const examples = Array.from(group.elements.entries()).slice(0, 4);
    const names = Array.from(new Set(group.elements.values()));
    section.innerHTML = "<h2><span class=\\"n\\">" + (n + 1) + "</span> "
      + group.props.map(p => "<code>" + esc(p) + "</code>").join(", ")
      + " <span class=\\"from\\">" + esc(group.from) + "</span> <span class=\\"arrow\\">\\u2192</span> <span class=\\"to\\">" + esc(group.to) + "</span>"
      + "<small>on " + group.elements.size + " element" + (group.elements.size === 1 ? "" : "s") + ": " + esc(names.slice(0, 3).join(", ")) + (names.length > 3 ? " and " + (names.length - 3) + " more" : "") + "</small></h2>";
    const row = document.createElement("div");
    row.className = "pairs";
    for (const [index, where] of examples) {
      const nodeA = result.nodesA[index], nodeB = result.nodesB[index];
      if (!nodeA || nodeA.nodeType !== 1) continue;
      const u = union(nodeA.getBoundingClientRect(), nodeB.getBoundingClientRect());
      const pair = document.createElement("div");
      pair.className = "pair";
      pair.innerHTML = "<div class=\\"labels\\"><span>before</span><span>after</span></div>";
      const before = windowFor("master", index, n), after = windowFor("branch", index, n);
      placeWindow(before, u.x, u.y, u.w, u.h);
      placeWindow(after, u.x, u.y, u.w, u.h);
      const crops = document.createElement("div");
      crops.className = "crops";
      crops.append(before.box, after.box);
      pair.append(crops);
      const caption = document.createElement("div");
      caption.className = "caption";
      caption.textContent = where;
      pair.append(caption);
      row.append(pair);
    }
    section.append(row);
    container.append(section);
  });
  if (moved) {
    const p = document.createElement("p");
    p.className = "moved";
    p.textContent = moved + " element" + (moved === 1 ? "" : "s") + " moved or resized as a consequence.";
    container.append(p);
  }
}

function renderStatus(result) {
  const n = result.grouped.groups.length;
  const status = document.getElementById("status");
  status.className = n ? "changed" : "same";
  status.textContent = n === 0 ? "No change against master" : n === 1 ? "1 change against master" : n + " changes against master";
  const r = result.releasedGroups.length;
  document.getElementById("released-status").textContent = r === 0 ? "Same as the released " + RELEASED + "." : r + " change" + (r === 1 ? "" : "s") + " against the released " + RELEASED + ".";
  document.getElementById("timing").textContent = result.keys + " values compared per copy in " + result.totalMs.toFixed(1) + " ms";
  document.title = (n ? n + " changed, " : "") + "lt-button";
}

window.lookDiff = function lookDiff(withReleased = true) {
  const frame = (v) => document.getElementById("frame-" + v).contentDocument;
  clearMarks(frame("branch"));
  const t0 = performance.now();
  const master = diffDocuments(frame("branch"), frame("master"));
  const t1 = performance.now();
  const released = withReleased ? diffDocuments(frame("branch"), frame("released")) : { differences: [], values: 0 };
  const grouped = groupChanges(master.differences);
  const result = {
    againstMaster: master.differences,
    againstReleased: released.differences,
    keys: master.values,
    snapshotMs: t1 - t0,
    totalMs: performance.now() - t0,
    grouped,
    releasedGroups: groupChanges(released.differences).groups,
    nodesA: master.nodesA,
    nodesB: master.nodesB,
  };
  renderStatus(result);
  renderChanges(result);
  mark(frame("branch"), grouped.changedIndices);
  mark(document.getElementById("compare-branch").contentDocument, grouped.changedIndices);
  // What Playwright reads: no nodes, they do not serialise.
  return { againstMaster: result.againstMaster, againstReleased: result.againstReleased, keys: result.keys, snapshotMs: result.snapshotMs, totalMs: result.totalMs };
};

// Hot swap: the server sends the branch stylesheet when a file on disk changes.
const socket = new WebSocket("ws://" + location.host + "/ws");
socket.onmessage = (event) => {
  const received = performance.now();
  const message = JSON.parse(event.data);
  if (message.type !== "css") return;
  for (const iframe of document.querySelectorAll("iframe[data-version=branch]")) {
    const style = iframe.contentDocument && iframe.contentDocument.getElementById("package");
    if (style) style.textContent = message.css;
  }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const result = window.lookDiff(true);
    result.swapToDiffMs = performance.now() - received;
    window.lastSwap = result;
    document.getElementById("timing").textContent += ", " + result.swapToDiffMs.toFixed(1) + " ms from the stylesheet arriving";
    document.dispatchEvent(new CustomEvent("look-swapped", { detail: result }));
  }));
};

// The whole sheet: master under, branch on top, clipped by the slider.
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
document.getElementById("whole-toggle").addEventListener("click", () => {
  document.getElementById("whole").classList.toggle("open");
});

window.addEventListener("load", () => {
  const frames = document.querySelectorAll(".sources iframe, #compare iframe");
  let pending = frames.length;
  frames.forEach(f => {
    const done = () => { if (--pending === 0) { window.lookDiff(true); window.lookReady = true; document.dispatchEvent(new Event("look-ready")); } };
    if (f.contentDocument && f.contentDocument.readyState === "complete" && f.contentDocument.getElementById("sheet")) done(); else f.addEventListener("load", done);
  });
});
`

async function lookPage(): Promise<string> {
  const sources = VERSIONS.map(
    (v) =>
      `<iframe id="frame-${v}" title="${v}, source" data-version="${v}" src="/frame/button/${v}" width="${SHEET_WIDTH}" height="1600"></iframe>`,
  ).join("")
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>lt-button</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #f4f4f4; color: #111; }
  header { padding: 16px 24px 8px; }
  header h1 { font-size: 15px; font-weight: 500; margin: 0; color: #666; }
  #status { font-size: 32px; font-weight: 700; margin: 4px 0 0; }
  #status.same { color: #1a8a4a; }
  #status.changed { color: #c400c4; }
  #released-status { margin: 2px 0 0; font-size: 14px; color: #444; }
  #timing { font: 12px ui-monospace, monospace; color: #888; margin-top: 4px; }
  #changes { padding: 8px 24px 24px; }
  .change { background: #fff; border-radius: 8px; padding: 16px 20px; margin-top: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
  .change h2 { font-size: 20px; font-weight: 600; margin: 0 0 12px; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .change h2 .n { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: #c400c4; color: #fff; font-size: 14px; }
  .change h2 code { background: #f3e5f3; padding: 2px 6px; border-radius: 4px; font-size: 18px; }
  .change h2 .from { color: #888; text-decoration: line-through; }
  .change h2 .arrow { color: #888; }
  .change h2 .to { color: #c400c4; }
  .change h2 small { flex-basis: 100%; font-size: 13px; font-weight: 400; color: #666; }
  .pairs { display: flex; flex-wrap: wrap; gap: 24px; }
  .pair .labels { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; color: #888; margin-bottom: 4px; }
  .crops { display: flex; gap: 12px; align-items: flex-start; }
  .window { position: relative; overflow: hidden; border: 2px solid #ddd; border-radius: 6px; background: #fff; }
  .window.branch { border-color: #c400c4; }
  .window iframe { position: absolute; border: 0; pointer-events: none; }
  .caption { font: 12px ui-monospace, monospace; color: #666; margin-top: 6px; }
  .moved { color: #666; font-size: 13px; margin: 12px 0 0; }
  #whole { padding: 0 24px 24px; }
  #whole-toggle { font: inherit; font-size: 14px; background: none; border: 1px solid #bbb; border-radius: 6px; padding: 6px 12px; cursor: pointer; }
  #whole .panel { display: none; margin-top: 12px; }
  #whole.open .panel { display: block; }
  #whole h2 { font-size: 13px; font-weight: normal; margin: 0 0 4px; display: flex; gap: 16px; align-items: center; width: ${SHEET_WIDTH * 2}px; }
  #whole h2 input[type=range] { flex: 1; }
  #compare { position: relative; width: ${SHEET_WIDTH * 2}px; height: 800px; overflow: auto; background: #fff; }
  #compare iframe { position: absolute; inset: 0; width: ${SHEET_WIDTH * 2}px; height: 1600px; border: 0; }
  #compare-branch { z-index: 1; }
  #divider { position: absolute; top: 0; bottom: 0; width: 2px; background: #c400c4; z-index: 2; pointer-events: none; }
  #compare.difference #compare-branch { mix-blend-mode: difference; }
  #compare.difference { filter: contrast(3) brightness(1.5); }
  #compare.difference #divider { display: none; }
  .sources { position: absolute; left: -20000px; top: 0; }
  .sources iframe { border: 0; }
</style></head><body>
<header>
  <h1>lt-button, this branch</h1>
  <p id="status">Loading the three versions</p>
  <p id="released-status"></p>
  <div id="timing"></div>
</header>
<div id="changes"></div>
<div id="whole">
  <button id="whole-toggle" type="button">The whole sheet, master against branch</button>
  <div class="panel">
    <h2>master <input id="slider" type="range" min="0" max="100" value="50" aria-label="How much of the branch to show"> branch
      <label><input id="difference" type="checkbox"> difference</label></h2>
    <div id="compare">
      <iframe id="compare-master" title="master, whole sheet" data-version="master" src="/frame/button/master"></iframe>
      <iframe id="compare-branch" title="branch, whole sheet" data-version="branch" src="/frame/button/branch"></iframe>
      <div id="divider"></div>
    </div>
  </div>
</div>
<div class="sources" aria-hidden="true">${sources}</div>
<script>const RELEASED = ${JSON.stringify(RELEASED_TAG)};${DIFF_SCRIPT}</script>
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
