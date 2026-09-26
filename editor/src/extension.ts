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
 *     attributtet eller setter inn ledeteksten. Den sikre rettelsen, samme
 *     bokstaver skrevet annerledes, er foretrukket; et forslag på avstand
 *     er et forslag;
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

import { readFileSync } from "node:fs"
import { join } from "node:path"
import * as vscode from "vscode"
import {
  type Classes,
  diagnose,
  type Elements,
  type Finding,
  tagEnd,
} from "./diagnostics"

const DELAY_MS = 250
const SOURCE = "Fristil"
/** Så langt bakover det leses etter taggen markøren står i. En tagg er kortere. */
const WINDOW = 4000

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
        action.isPreferred = finding.fix.preferred ?? false
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

  /* Taggen markøren står i */

  type Tag = {
    /** Fra `<` til markøren. */
    before: string
    /** Fra markøren til `>`, eller til vinduet slutter. */
    after: string
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
    const after = document.getText(
      new vscode.Range(position, document.positionAt(offset + WINDOW)),
    )
    const end = tagEnd(after, 0)
    return { before: head, after: end < 0 ? after : after.slice(0, end) }
  }

  /** Klassene i taggen, foran og bak markøren, med eller uten anførselstegn. */
  const classesIn = (tag: Tag) =>
    (tag.before + tag.after)
      .match(/(?:^|\s):?class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i)
      ?.slice(1)
      .find((v) => v !== undefined)
      ?.split(/\s+/) ?? []

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
