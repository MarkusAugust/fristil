/**
 * VS Code-utvidelsen: språkserveren for funnene og rettelsene, og
 * fullføring og forklaring oppå.
 *
 * Funnene og hurtigrettelsene kommer fra språkserveren, `fristil lsp`, den
 * samme som Neovim, Zed og Helix bruker, skrevet i Rust og kjørt som
 * WASI-modul (se `server.ts`). Den leser manifestet prosjektet faktisk har,
 * også med komponenter tatt over med `fristil overta`. Her er resten:
 *
 *   - inne i `class="…"` fullføres `fs-`-klassene, og inne i et attributt en
 *     klasse tar, som `data-variant` på `fs-button`, fullføres verdiene.
 *     I andre språk enn HTML, der VS Codes egen HTML-tjeneste ikke er med,
 *     fullføres også `<fs-…>`-elementene, attributtene og verdiene deres;
 *   - musa over en `fs-`-klasse i et `class`-attributt gir komponenten,
 *     beskrivelsen og lenken.
 *
 * Taggen markøren står i leses fra et vindu bakover, ikke fra hele
 * dokumentet: fullføringen utløses på mellomrom og bindestrek, og en stor
 * fil skal ikke kopieres for hvert tastetrykk.
 */

import * as vscode from "vscode"
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind,
} from "vscode-languageclient/node"
/*
 * Ordforrådet hentes fra kilden i pakken: utvidelsen pakkes til én fil, og
 * leter ikke etter pakken i `node_modules`.
 */
import { classes } from "../../designsystem/src/vocabulary/classes.js"
import { elements } from "../../designsystem/src/vocabulary/elements.js"

/** Så langt bakover det leses etter taggen markøren står i. En tagg er kortere. */
const WINDOW = 4000

/**
 * Der taggen som begynner før `from` slutter, eller -1 når den ikke er lukket.
 * `>` i en verdi i anførselstegn, og i `<?…?>` og `<%…%>`, avslutter den ikke.
 */
function tagEnd(text: string, from: number): number {
  let quote: string | null = null
  for (let i = from; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") quote = char
    else if (char === "<" && (text[i + 1] === "?" || text[i + 1] === "%")) {
      const closer = text.indexOf(`${text[i + 1]}>`, i + 2)
      if (closer < 0) return -1
      i = closer + 1
    } else if (char === ">") return i
  }
  return -1
}

export function activate(context: vscode.ExtensionContext) {
  const classNames = Object.keys(classes)
  const elementNames = Object.keys(elements)

  const languages = () =>
    vscode.workspace.getConfiguration("fristil").get<string[]>("languages") ?? [
      "html",
    ]
  const selector = (): vscode.DocumentSelector =>
    languages().map((language) => ({ language }))

  /* Språkserveren */

  let client: LanguageClient | undefined
  const serverOptions: ServerOptions = {
    module: vscode.Uri.joinPath(context.extensionUri, "dist", "server.js")
      .fsPath,
    transport: TransportKind.stdio,
  }
  // Et nytt bygg eller en oppgradering av pakken endrer manifestet. Én
  // overvåker for hele levetiden, ikke én per omstart.
  const manifests = vscode.workspace.createFileSystemWatcher(
    "**/{build/fristil/manifest.json,node_modules/@fristil/designsystem/manifest/manifest.json}",
  )
  context.subscriptions.push(manifests)

  /*
   * Omstartene står i kø. To endringer av språklista rett etter hverandre
   * ventet ellers begge på den samme gamle klienten, og startet hver sin
   * server: funnene kom to ganger, og den ene serveren ble aldri stoppet.
   */
  /*
   * En klient som ikke klarte å starte, kaster når den stoppes. Da ble alle
   * senere omstarter stående i `catch`, og funnene kom ikke tilbake før
   * vinduet ble lastet på nytt.
   */
  const stopClient = async () => {
    const old = client
    client = undefined
    try {
      await old?.stop()
    } catch {
      // Den kjørte ikke, og er ikke noe å stoppe.
    }
  }
  let restarts: Promise<void> = Promise.resolve()
  const startClient = () => {
    restarts = restarts
      .then(async () => {
        await stopClient()
        client = new LanguageClient("fristil", "Fristil", serverOptions, {
          documentSelector: languages().flatMap((language) => [
            { scheme: "file", language },
            { scheme: "untitled", language },
          ]),
          synchronize: { fileEvents: manifests },
        } satisfies LanguageClientOptions)
        await client.start()
      })
      .catch((error: unknown) => {
        void vscode.window.showErrorMessage(
          `Fristil kunne ikke starte språkserveren: ${error instanceof Error ? error.message : String(error)}`,
        )
      })
    return restarts
  }

  /* Taggen markøren står i */

  type Tag = {
    /** Fra `<` til markøren. */
    before: string
    /** Fra markøren til `>`, tom når taggen ikke er lukket i vinduet. */
    after: string
  }

  /** Anførselstegnet teksten slutter inne i, om noe. */
  const openQuote = (text: string) => {
    let quote: string | null = null
    for (const char of text) {
      if (quote) {
        if (char === quote) quote = null
      } else if (char === '"' || char === "'") quote = char
    }
    return quote
  }

  const tagAt = (
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Tag | undefined => {
    const offset = document.offsetAt(position)
    const before = document.getText(
      new vscode.Range(
        document.positionAt(Math.max(0, offset - WINDOW)),
        position,
      ),
    )
    const start = before.lastIndexOf("<")
    if (start < 0) return undefined
    const head = before.slice(start)
    // En `>` inne i en verdi, som `x-show="n > 0"`, avslutter ikke taggen.
    if (tagEnd(head, 1) >= 0) return undefined
    const rest = document.getText(
      new vscode.Range(position, document.positionAt(offset + WINDOW)),
    )
    // Står markøren inne i en verdi, lukkes den først, ellers snur pariteten
    // og en `"` i en senere tagg leses som en åpning.
    const quote = openQuote(head)
    const from = quote ? rest.indexOf(quote) : -1
    const end = quote && from < 0 ? -1 : tagEnd(rest, quote ? from + 1 : 0)
    return { before: head, after: end < 0 ? "" : rest.slice(0, end) }
  }

  /** Klassene i taggen, foran og bak markøren. `class` går foran `:class`. */
  const classesIn = (tag: Tag) => {
    const text = tag.before + tag.after
    const hit =
      text.match(/(?:^|\s)class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i) ??
      text.match(/(?:^|\s):class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i)
    return (
      hit
        ?.slice(1)
        .find((v) => v !== undefined)
        ?.split(/\s+/) ?? []
    )
  }

  /** Om markøren står inne i verdien til `class`. */
  const inClassValue = (tag: Tag) =>
    /(?:^|\s):?class\s*=\s*(?:"[^"]*|'[^']*|[^\s"'>]*)$/i.test(tag.before)

  /* Fullføringen */

  const markdown = (text: string) => {
    const md = new vscode.MarkdownString(text)
    md.isTrusted = false
    return md
  }
  const classDocumentation = (name: string) => {
    const info = classes[name]
    const takes = Object.entries(info.attributes)
      .map(([attribute, a]) =>
        a.flag
          ? `\`${attribute}\`: flagg, virker ved å stå der`
          : `\`${attribute}\`: ${a.values.join(", ")}` +
            (a.default ? ` (${a.default} uten attributt)` : ""),
      )
      .join("  \n")
    return markdown(
      `**${info.title}** · ${info.description}\n\n${takes ? `${takes}\n\n` : ""}[Dokumentasjon](${info.link})`,
    )
  }

  const completions: vscode.CompletionItemProvider = {
    provideCompletionItems(document, position) {
      const tag = tagAt(document, position)
      if (!tag) return undefined
      const items: vscode.CompletionItem[] = []
      const wordRange =
        document.getWordRangeAtPosition(position, /[A-Za-z0-9_-]+/) ??
        new vscode.Range(position, position)
      const item = (
        label: string,
        kind: vscode.CompletionItemKind,
        detail?: string,
        documentation?: vscode.MarkdownString,
      ) => {
        const it = new vscode.CompletionItem(label, kind)
        it.detail = detail
        it.documentation = documentation
        it.range = wordRange
        items.push(it)
      }

      // Klassene, inne i class="…".
      if (inClassValue(tag)) {
        for (const name of classNames)
          item(
            name,
            vscode.CompletionItemKind.Value,
            classes[name].title,
            classDocumentation(name),
          )
        return items
      }

      const isHtml = document.languageId === "html"
      const element = /^<(fs-[a-z0-9-]+)(?=[\s/])/i
        .exec(tag.before)?.[1]
        .toLowerCase()

      // Verdiene til et attributt: det en klasse på taggen tar, eller det et
      // <fs-…>-element tar utenfor HTML.
      const inValue = /([A-Za-z][\w:-]*)\s*=\s*["']?[^"'>]*$/.exec(tag.before)
      if (inValue) {
        const attribute = inValue[1].toLowerCase()
        for (const name of classesIn(tag)) {
          const takes = classes[name]?.attributes[attribute]
          if (!takes) continue
          for (const value of takes.values)
            item(
              value,
              vscode.CompletionItemKind.EnumMember,
              `${attribute} på ${classes[name].title}`,
            )
          if (takes.default)
            item(
              takes.default,
              vscode.CompletionItemKind.EnumMember,
              `standard: det samme som uten ${attribute}`,
            )
        }
        if (!isHtml && element && elements[element]) {
          const takes = elements[element].attributes[attribute]
          if (takes?.type === "values")
            for (const value of takes.values)
              item(
                value,
                vscode.CompletionItemKind.EnumMember,
                `${attribute} på <${element}>`,
              )
        }
        return items.length ? items : undefined
      }

      // Utenfor HTML finnes ingen HTML-tjeneste, så elementene og attributtene
      // deres fullføres her.
      if (isHtml) return undefined
      if (/^<fs-[a-z0-9-]*$/i.test(tag.before)) {
        for (const name of elementNames)
          item(
            name,
            vscode.CompletionItemKind.Class,
            undefined,
            markdown(`[Dokumentasjon](${elements[name].link})`),
          )
        return items
      }
      // Attributtnavn: markøren står i taggen, utenfor anførselstegn.
      if (
        element &&
        elements[element] &&
        /^<[^"'>]*(?:"[^"]*"[^"'>]*|'[^']*'[^"'>]*)*$/.test(tag.before)
      ) {
        for (const [name, a] of Object.entries(elements[element].attributes))
          item(
            name,
            vscode.CompletionItemKind.Property,
            a.type === "values" ? a.values.join(" | ") : a.type,
          )
        return items
      }
      return undefined
    },
  }

  /* Forklaringen */

  const hover: vscode.HoverProvider = {
    provideHover(document, position) {
      const range = document.getWordRangeAtPosition(
        position,
        /fs-[A-Za-z0-9_-]+/,
      )
      if (!range) return undefined
      const word = document.getText(range)
      if (!classes[word]) return undefined
      // Bare i et class-attributt: «bruk fs-button her» i løpende tekst er tekst.
      const tag = tagAt(document, range.start)
      if (!tag || !inClassValue(tag)) return undefined
      return new vscode.Hover(classDocumentation(word), range)
    },
  }

  /* Registreringen. Byttes språklista, registreres alt på nytt. */

  const providers: vscode.Disposable[] = []
  const register = () => {
    for (const p of providers) p.dispose()
    providers.length = 0
    providers.push(
      vscode.languages.registerCompletionItemProvider(
        selector(),
        completions,
        '"',
        "'",
        " ",
        "-",
        "<",
        "=",
      ),
      vscode.languages.registerHoverProvider(selector(), hover),
    )
    void startClient()
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("fristil.languages")) register()
    }),
    {
      dispose() {
        for (const p of providers) p.dispose()
        void stopClient()
      },
    },
  )
  register()
}

export function deactivate() {}
