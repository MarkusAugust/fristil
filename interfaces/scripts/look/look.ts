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
function compareStyles(key, a, b, differences) {
  const n = a.length;
  if (n !== b.length) { differences.push({ key: key + "|length", from: b.length, to: n }); }
  for (let i = 0; i < n; i++) {
    const p = a[i];
    const va = a.getPropertyValue(p), vb = b.getPropertyValue(p);
    if (va !== vb) differences.push({ key: key + "|" + p, from: vb, to: va });
  }
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
      if (ra !== rb) differences.push({ key: key + "|rects", from: rb, to: ra });
    } else {
      const ra = rect(a), rb = rect(b);
      values++;
      if (ra !== rb) differences.push({ key: key + "|rect", from: rb, to: ra });
      const csA = wA.getComputedStyle(a), csB = wB.getComputedStyle(b);
      values += csA.length;
      compareStyles(key, csA, csB, differences);
      for (const pseudo of pseudos(a, csA)) {
        const pa = wA.getComputedStyle(a, pseudo), pb = wB.getComputedStyle(b, pseudo);
        if (pseudo === "::before" || pseudo === "::after") {
          const ca = pa.getPropertyValue("content"), cb = pb.getPropertyValue("content");
          values++;
          if (ca !== cb) differences.push({ key: key + pseudo + "|content", from: cb, to: ca });
          if (ca === "none" || ca === "normal") continue;
        }
        values += pa.length;
        compareStyles(key + pseudo, pa, pb, differences);
      }
    }
    a = walkA.nextNode(); b = walkB.nextNode(); index++;
  }
  if (a || b) differences.push({ key: index + ":end", from: b ? "more nodes" : "", to: a ? "more nodes" : "" });
  return { differences, values };
}

window.lookDiff = function lookDiff(withReleased = true) {
  const t0 = performance.now();
  const frame = (v) => document.getElementById("frame-" + v).contentDocument;
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
  render(result);
  return result;
};

function render(result) {
  const el = document.getElementById("result");
  const line = (name, diffs) => name + ": " + diffs.length + (diffs.length ? " (" + diffs.slice(0, 5).map(d => d.key + " " + d.from + " -> " + d.to).join("; ") + ")" : "");
  el.textContent = [
    result.keys + " values compared per pair, " + result.totalMs.toFixed(1) + " ms in all (" + result.snapshotMs.toFixed(1) + " ms against master)",
    line("branch vs master", result.againstMaster),
    line("branch vs released", result.againstReleased),
  ].join("\\n");
}

// Hot swap: the server sends the branch stylesheet when a file on disk changes.
const socket = new WebSocket("ws://" + location.host + "/ws");
socket.onmessage = (event) => {
  const received = performance.now();
  const message = JSON.parse(event.data);
  if (message.type !== "css") return;
  const frame = document.getElementById("frame-branch").contentDocument;
  frame.getElementById("package").textContent = message.css;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const result = window.lookDiff(false);
    result.swapToDiffMs = performance.now() - received;
    window.lastSwap = result;
    document.getElementById("result").textContent += "\\nswap to diff: " + result.swapToDiffMs.toFixed(1) + " ms";
    document.dispatchEvent(new CustomEvent("look-swapped", { detail: result }));
  }));
};
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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>lt-button, three versions</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #eee; color: #111; }
  .frames { display: grid; grid-template-columns: repeat(3, 560px); gap: 8px; padding: 8px; overflow-x: auto; }
  section h1 { font-size: 13px; font-weight: normal; margin: 0 0 4px; }
  iframe { width: 560px; height: 760px; border: 0; background: #fff; display: block; }
  #result { white-space: pre-wrap; padding: 8px; font: 12px/1.4 ui-monospace, monospace; }
</style></head><body>
<div class="frames">${frames}</div>
<pre id="result">waiting</pre>
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
