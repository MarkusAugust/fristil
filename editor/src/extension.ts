/**
 * Kobler diagnostikken til VS Code, og gir fullføring, forklaring og
 * hurtigrettelser oppå den.
 *
 * Alt som sjekker noe står i `diagnostics.ts`, uten VS Code i seg. Her leses
 * `elements.json` og `classes.json` fra utvidelsens mappe, og:
 *
 *   - hvert dokument i et av språkene i `fristil.languages` kjøres gjennom
 *     når det åpnes og endres, og funnene blir røde og gule streker med
 *     komponentsiden som lenke. Endringer ventes ut i et kort øyeblikk, og
 *     en ventende kjøring for et dokument som lukkes avlyses;
 *   - funn med en rettelse blir en lyspære, som bytter navnet, tar bort
 *     attributtet eller setter inn ledeteksten;
 *   - inne i `class="…"` fullføres `fs-`-klassene, og inne i et attributt en
 *     klasse tar, som `data-variant` på `fs-button`, fullføres verdiene.
 *     I andre språk enn HTML, der VS Codes egen HTML-tjeneste ikke er med,
 *     fullføres også `<fs-…>`-elementene og attributtene deres;
 *   - musa over en `fs-`-klasse gir komponenten, beskrivelsen og lenken.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import * as vscode from "vscode"
import {
  type Classes,
  diagnose,
  type Elements,
  type Finding,
} from "./diagnostics"

const DELAY_MS = 250
const SOURCE = "Fristil"

export function activate(context: vscode.ExtensionContext) {
  const read = <T>(file: string): T =>
    JSON.parse(readFileSync(join(context.extensionPath, file), "utf8"))
  const elements = read<Elements>("elements.json")
  const classes = read<Classes>("classes.json")
  const classNames = Object.keys(classes)
  const elementNames = Object.keys(elements)

  const languages = () =>
    vscode.workspace.getConfiguration("fristil").get<string[]>("languages") ?? [
      "html",
    ]
  const supported = (document: vscode.TextDocument) =>
    languages().includes(document.languageId)
  const selector = (): vscode.DocumentSelector =>
    languages().map((language) => ({ language }))

  /* Diagnostikken */

  const collection = vscode.languages.createDiagnosticCollection("fristil")
  const pending = new Map<string, ReturnType<typeof setTimeout>>()
  /** Siste funn per dokument, så lyspæra finner rettelsen til en strek. */
  const latest = new Map<string, Finding[]>()

  const rangeOf = (document: vscode.TextDocument, start: number, end: number) =>
    new vscode.Range(document.positionAt(start), document.positionAt(end))

  const toDiagnostic = (document: vscode.TextDocument, finding: Finding) => {
    const diagnostic = new vscode.Diagnostic(
      rangeOf(document, finding.start, finding.end),
      finding.message,
      finding.severity === "error"
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning,
    )
    diagnostic.source = SOURCE
    diagnostic.code = {
      value: "dokumentasjon",
      target: vscode.Uri.parse(finding.link),
    }
    return diagnostic
  }

  const check = (document: vscode.TextDocument) => {
    if (!supported(document) || document.isClosed) return
    const findings = diagnose(document.getText(), elements, classes)
    latest.set(document.uri.toString(), findings)
    collection.set(
      document.uri,
      findings.map((finding) => toDiagnostic(document, finding)),
    )
  }

  const cancel = (document: vscode.TextDocument) => {
    const key = document.uri.toString()
    clearTimeout(pending.get(key))
    pending.delete(key)
  }

  const checkSoon = (document: vscode.TextDocument) => {
    if (!supported(document)) return
    cancel(document)
    pending.set(
      document.uri.toString(),
      setTimeout(() => {
        pending.delete(document.uri.toString())
        check(document)
      }, DELAY_MS),
    )
  }

  const checkAll = () => {
    for (const document of vscode.workspace.textDocuments) check(document)
  }

  /* Lyspærene */

  const codeActions: vscode.CodeActionProvider = {
    provideCodeActions(document, _range, actionContext) {
      const findings = latest.get(document.uri.toString()) ?? []
      const actions: vscode.CodeAction[] = []
      for (const diagnostic of actionContext.diagnostics) {
        if (diagnostic.source !== SOURCE) continue
        const finding = findings.find(
          (f) =>
            f.fix &&
            f.message === diagnostic.message &&
            rangeOf(document, f.start, f.end).isEqual(diagnostic.range),
        )
        if (!finding?.fix) continue
        const action = new vscode.CodeAction(
          finding.fix.title,
          vscode.CodeActionKind.QuickFix,
        )
        action.diagnostics = [diagnostic]
        action.isPreferred = true
        action.edit = new vscode.WorkspaceEdit()
        action.edit.replace(
          document.uri,
          rangeOf(document, finding.fix.start, finding.fix.end),
          finding.fix.text,
        )
        actions.push(action)
      }
      return actions
    },
  }

  /* Fullføringen */

  const markdown = (text: string) => {
    const md = new vscode.MarkdownString(text)
    md.isTrusted = false
    return md
  }
  const classDocumentation = (name: string) => {
    const info = classes[name]
    const takes = Object.entries(info.attributes)
      .map(
        ([attribute, a]) =>
          `\`${attribute}\`: ${a.values.join(", ")}` +
          (a.default ? ` (${a.default} uten attributt)` : ""),
      )
      .join("  \n")
    return markdown(
      `**${info.title}** · ${info.description}\n\n${takes ? `${takes}\n\n` : ""}[Dokumentasjon](${info.link})`,
    )
  }

  /** Teksten fra taggen begynner til markøren, om markøren står i en tagg. */
  const tagBefore = (
    document: vscode.TextDocument,
    position: vscode.Position,
  ) => {
    const before = document.getText(
      new vscode.Range(new vscode.Position(0, 0), position),
    )
    const start = before.lastIndexOf("<")
    if (start < 0) return undefined
    const tag = before.slice(start)
    return tag.includes(">") ? undefined : tag
  }

  const completions: vscode.CompletionItemProvider = {
    provideCompletionItems(document, position) {
      const tag = tagBefore(document, position)
      if (!tag) return undefined
      const items: vscode.CompletionItem[] = []
      const wordRange =
        document.getWordRangeAtPosition(position, /[A-Za-z0-9_-]+/) ??
        new vscode.Range(position, position)

      // Klassene, inne i class="…".
      if (/\bclass\s*=\s*["']?[^"'>]*$/i.test(tag)) {
        for (const name of classNames) {
          const item = new vscode.CompletionItem(
            name,
            vscode.CompletionItemKind.Value,
          )
          item.detail = classes[name].title
          item.documentation = classDocumentation(name)
          item.range = wordRange
          items.push(item)
        }
        return items
      }

      // Verdiene til et attributt en klasse på taggen tar.
      const inValue = /([A-Za-z][\w:-]*)\s*=\s*["']?[^"'>]*$/.exec(tag)
      if (inValue) {
        const attribute = inValue[1].toLowerCase()
        const present =
          tag.match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1]?.split(/\s+/) ?? []
        for (const name of present) {
          const takes = classes[name]?.attributes[attribute]
          if (!takes) continue
          for (const value of takes.values) {
            const item = new vscode.CompletionItem(
              value,
              vscode.CompletionItemKind.EnumMember,
            )
            item.detail = `${attribute} på ${classes[name].title}`
            item.range = wordRange
            items.push(item)
          }
          if (takes.default) {
            const item = new vscode.CompletionItem(
              takes.default,
              vscode.CompletionItemKind.EnumMember,
            )
            item.detail = `standard: det samme som uten ${attribute}`
            item.range = wordRange
            items.push(item)
          }
        }
        if (items.length) return items
      }

      // Utenfor HTML finnes ingen HTML-tjeneste, så elementene og attributtene
      // deres fullføres her.
      if (document.languageId === "html") return undefined
      const element = /^<(fs-[a-z0-9-]*)$/i.exec(tag)
      if (element) {
        for (const name of elementNames) {
          const item = new vscode.CompletionItem(
            name,
            vscode.CompletionItemKind.Class,
          )
          item.documentation = markdown(
            `[Dokumentasjon](${elements[name].link})`,
          )
          item.range = wordRange
          items.push(item)
        }
        return items
      }
      const inElement = /^<(fs-[a-z0-9-]+)\s[^>]*?([a-z-]*)$/i.exec(tag)
      if (inElement && elements[inElement[1].toLowerCase()]) {
        for (const [name, a] of Object.entries(
          elements[inElement[1].toLowerCase()].attributes,
        )) {
          const item = new vscode.CompletionItem(
            name,
            vscode.CompletionItemKind.Property,
          )
          item.detail = a.type === "values" ? a.values.join(" | ") : a.type
          item.range = wordRange
          items.push(item)
        }
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
      return new vscode.Hover(classDocumentation(word), range)
    },
  }

  /* Registreringen. Byttes språklista, registreres alt på nytt. */

  const providers: vscode.Disposable[] = []
  const register = () => {
    for (const p of providers) p.dispose()
    providers.length = 0
    providers.push(
      vscode.languages.registerCodeActionsProvider(selector(), codeActions, {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
      }),
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
    collection.clear()
    latest.clear()
    checkAll()
  }

  context.subscriptions.push(
    collection,
    vscode.workspace.onDidOpenTextDocument(check),
    vscode.workspace.onDidChangeTextDocument((event) =>
      checkSoon(event.document),
    ),
    vscode.workspace.onDidCloseTextDocument((document) => {
      cancel(document)
      collection.delete(document.uri)
      latest.delete(document.uri.toString())
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("fristil.languages")) register()
    }),
    {
      dispose() {
        for (const timer of pending.values()) clearTimeout(timer)
        pending.clear()
        for (const p of providers) p.dispose()
      },
    },
  )
  register()
}

export function deactivate() {}
