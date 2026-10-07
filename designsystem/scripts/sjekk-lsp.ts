/**
 * Prøver språkserveren, `fristil lsp`, over ekte standard inn og ut, slik en
 * editor snakker med den.
 *
 * Standard er den bygde kommandolinja i pakken, kjørt med Node. `FRISTIL_CLI`
 * peker på en annen, som den kjørbare fila fra `kjerne/cli` eller
 * `["java", "-jar", "fristil.jar"]`, så de samme påstandene prøves mot hver
 * vert. VS Code-utvidelsen prøves med `["node", "editor/dist/server.js"]`.
 *
 * Kjør med: bun scripts/sjekk-lsp.ts
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const pakke = fileURLToPath(new URL("..", import.meta.url))
const KOMMANDO: string[] = process.env.FRISTIL_CLI
  ? process.env.FRISTIL_CLI.startsWith("[")
    ? JSON.parse(process.env.FRISTIL_CLI)
    : [process.env.FRISTIL_CLI]
  : ["node", join(pakke, "dist/cli.js")]

type Melding = {
  id?: number
  method?: string
  params?: Record<string, unknown>
  result?: unknown
  error?: { code: number; message: string }
}

const feil: string[] = []
function krev(påstand: boolean, beskrivelse: string): void {
  if (!påstand) feil.push(beskrivelse)
}

/** Én økt med serveren: send meldinger, og vent på det den svarer. */
async function økt(arbeidsmappe: string) {
  const prosess = Bun.spawn([...KOMMANDO, "lsp"], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    cwd: arbeidsmappe,
  })
  const mottatt: Melding[] = []
  const ventende: {
    hvis: (m: Melding) => boolean
    svar: (m: Melding) => void
  }[] = []

  // Leser rammene: hodene, en tom linje og så `Content-Length` byte JSON.
  void (async () => {
    let buffer = new Uint8Array(0)
    const dekoder = new TextDecoder()
    for await (const bit of prosess.stdout) {
      const samlet = new Uint8Array(buffer.length + bit.length)
      samlet.set(buffer)
      samlet.set(bit, buffer.length)
      buffer = samlet
      for (;;) {
        const tekst = dekoder.decode(buffer)
        const slutt = tekst.indexOf("\r\n\r\n")
        if (slutt < 0) break
        const lengde = Number(
          /Content-Length:\s*(\d+)/i.exec(tekst.slice(0, slutt))?.[1],
        )
        const start = new TextEncoder().encode(tekst.slice(0, slutt + 4)).length
        if (buffer.length < start + lengde) break
        const melding = JSON.parse(
          dekoder.decode(buffer.slice(start, start + lengde)),
        ) as Melding
        buffer = buffer.slice(start + lengde)
        mottatt.push(melding)
        const treff = ventende.findIndex((v) => v.hvis(melding))
        if (treff >= 0) ventende.splice(treff, 1)[0].svar(melding)
      }
    }
  })()

  const send = (melding: Record<string, unknown>) => {
    const tekst = JSON.stringify({ jsonrpc: "2.0", ...melding })
    prosess.stdin.write(
      `Content-Length: ${new TextEncoder().encode(tekst).length}\r\n\r\n${tekst}`,
    )
    prosess.stdin.flush()
  }
  const vent = (hvis: (m: Melding) => boolean, hva: string) =>
    new Promise<Melding>((svar, avvis) => {
      const funnet = mottatt.find(hvis)
      if (funnet) return svar(funnet)
      const tid = setTimeout(
        () => avvis(new Error(`ventet forgjeves på ${hva}`)),
        20000,
      )
      ventende.push({
        hvis,
        svar: (m) => {
          clearTimeout(tid)
          svar(m)
        },
      })
    })
  const diagnostikk = (uri: string, versjon: number) =>
    vent(
      (m) =>
        m.method === "textDocument/publishDiagnostics" &&
        m.params?.uri === uri &&
        mottatt.filter((n) => n.params?.uri === uri).length >= versjon,
      `diagnostikk nummer ${versjon} for ${uri}`,
    )
  return { prosess, send, vent, diagnostikk, mottatt }
}

const rot = await mkdtemp(join(tmpdir(), "fristil-lsp-"))
try {
  const s = await økt(rot)
  s.send({
    id: 1,
    method: "initialize",
    params: {
      processId: null,
      rootUri: pathToFileURL(rot).href,
      capabilities: {},
    },
  })
  const start = await s.vent((m) => m.id === 1, "svar på initialize")
  const kan = (start.result as { capabilities: Record<string, unknown> })
    .capabilities
  krev(
    kan.positionEncoding === "utf-16",
    "serveren sier ikke at posisjonene er UTF-16",
  )
  krev(
    kan.codeActionProvider !== undefined,
    "serveren tilbyr ikke hurtigrettelser",
  )
  s.send({ method: "initialized", params: {} })

  // Et dokument med en skrivefeil, etter tegn som er to UTF-16-enheter.
  const uri = pathToFileURL(join(rot, "skjema.html")).href
  s.send({
    method: "textDocument/didOpen",
    params: {
      textDocument: {
        uri,
        languageId: "html",
        version: 1,
        text: '<p>🧾</p>\n<button class="fs-buton">Send</button>',
      },
    },
  })
  const første = (await s.diagnostikk(uri, 1)).params as {
    diagnostics: {
      range: { start: { line: number; character: number } }
      code: string
      message: string
    }[]
  }
  krev(
    første.diagnostics.length === 1,
    `ventet ett funn, fikk ${første.diagnostics.length}`,
  )
  krev(
    første.diagnostics[0]?.code === "ukjent-klasse",
    "funnet har ikke regelnavnet som kode",
  )
  krev(
    første.diagnostics[0]?.range.start.line === 1 &&
      første.diagnostics[0]?.range.start.character === 15,
    `funnet står på feil sted: ${JSON.stringify(første.diagnostics[0]?.range)}`,
  )

  s.send({
    id: 2,
    method: "textDocument/codeAction",
    params: {
      textDocument: { uri },
      range: {
        start: { line: 1, character: 17 },
        end: { line: 1, character: 17 },
      },
      context: { diagnostics: første.diagnostics },
    },
  })
  const rettelser = (await s.vent((m) => m.id === 2, "hurtigrettelsene"))
    .result as {
    title: string
    edit: { changes: Record<string, { newText: string }[]> }
  }[]
  krev(
    rettelser[0]?.title === "Bytt til fs-button",
    `feil rettelse: ${rettelser[0]?.title}`,
  )
  krev(
    rettelser[0]?.edit.changes[uri]?.[0]?.newText === "fs-button",
    "rettelsen bytter ikke til fs-button",
  )

  s.send({
    method: "textDocument/didChange",
    params: {
      textDocument: { uri, version: 2 },
      contentChanges: [{ text: '<button class="fs-button">Send</button>' }],
    },
  })
  const andre = (await s.diagnostikk(uri, 2)).params as {
    diagnostics: unknown[]
  }
  krev(
    andre.diagnostics.length === 0,
    "funnet ble stående etter at det var rettet",
  )

  // Et manifest i arbeidsområdet gjelder fra neste sjekk, uten omstart.
  await mkdir(join(rot, "build/fristil"), { recursive: true })
  const manifest = Bun.spawnSync(
    ["node", join(pakke, "dist/cli.js"), "manifest"],
    {
      cwd: rot,
    },
  ).stdout.toString()
  const medKopi = JSON.parse(manifest)
  medKopi.classes["app-button"] = {
    component: "button",
    title: "Button",
    link: "",
    attributes: {},
  }
  await writeFile(
    join(rot, "build/fristil/manifest.json"),
    JSON.stringify(medKopi),
  )
  s.send({
    method: "textDocument/didChange",
    params: {
      textDocument: { uri, version: 3 },
      contentChanges: [
        { text: '<button class="app-button app-button--x">Send</button>' },
      ],
    },
  })
  const tredje = (await s.diagnostikk(uri, 3)).params as {
    diagnostics: { message: string }[]
  }
  krev(
    tredje.diagnostics.length === 1 &&
      tredje.diagnostics[0].message.includes("app-button--x"),
    `manifestet i build/fristil ble ikke lest: ${JSON.stringify(tredje.diagnostics)}`,
  )

  s.send({
    id: 3,
    method: "textDocument/hover",
    params: { textDocument: { uri }, position: { line: 0, character: 0 } },
  })
  const ukjent = await s.vent(
    (m) => m.id === 3,
    "svar på en forespørsel serveren ikke kan",
  )
  krev(
    ukjent.error?.code === -32601,
    "en ukjent forespørsel fikk ikke feilkoden for en ukjent metode",
  )

  s.send({ id: 4, method: "shutdown" })
  await s.vent((m) => m.id === 4, "svar på shutdown")
  s.send({ method: "exit" })
  const kode = await Promise.race([
    s.prosess.exited,
    Bun.sleep(20000).then(() => "tidsavbrudd"),
  ])
  krev(kode === 0, `serveren avsluttet med ${kode} etter shutdown og exit`)
} catch (error) {
  feil.push(String(error))
} finally {
  await rm(rot, { recursive: true, force: true })
}

if (feil.length > 0) {
  console.error(
    `✗ Språkserveren (${KOMMANDO.join(" ")}):\n\n${feil.map((f) => `  ${f}`).join("\n")}\n`,
  )
  process.exit(1)
}
console.log(`Språkserveren svarer som den skal (${KOMMANDO.join(" ")}).`)
