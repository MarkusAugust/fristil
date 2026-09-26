/**
 * Kobler diagnostikken til VS Code.
 *
 * Alt som sjekker noe står i `diagnostics.ts`, uten VS Code i seg. Her
 * leses `elements.json` fra utvidelsens mappe, hvert HTML-dokument kjøres
 * gjennom når det åpnes og endres, og funnene blir røde og gule streker med
 * komponentsiden som lenke. Endringer ventes ut i et kort øyeblikk, så ikke
 * hvert tastetrykk gir en kjøring, og en ventende kjøring for et dokument
 * som lukkes i mellomtiden avlyses: «Don't Save» tilbakestiller innholdet
 * og lukker, og strekene skal ikke komme tilbake for en fil som er borte.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import * as vscode from "vscode"
import { diagnose, type Elements, type Finding } from "./diagnostics"

const DELAY_MS = 250

export function activate(context: vscode.ExtensionContext) {
  const elements: Elements = JSON.parse(
    readFileSync(join(context.extensionPath, "elements.json"), "utf8"),
  )
  const collection = vscode.languages.createDiagnosticCollection("fristil")
  const pending = new Map<string, ReturnType<typeof setTimeout>>()

  const toDiagnostic = (document: vscode.TextDocument, finding: Finding) => {
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(
        document.positionAt(finding.start),
        document.positionAt(finding.end),
      ),
      finding.message,
      finding.severity === "error"
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning,
    )
    diagnostic.source = "Fristil"
    diagnostic.code = {
      value: "dokumentasjon",
      target: vscode.Uri.parse(finding.link),
    }
    return diagnostic
  }

  const isHtml = (document: vscode.TextDocument) =>
    document.languageId === "html"

  const check = (document: vscode.TextDocument) => {
    if (!isHtml(document) || document.isClosed) return
    collection.set(
      document.uri,
      diagnose(document.getText(), elements).map((finding) =>
        toDiagnostic(document, finding),
      ),
    )
  }

  const cancel = (document: vscode.TextDocument) => {
    const key = document.uri.toString()
    clearTimeout(pending.get(key))
    pending.delete(key)
  }

  const checkSoon = (document: vscode.TextDocument) => {
    if (!isHtml(document)) return
    cancel(document)
    pending.set(
      document.uri.toString(),
      setTimeout(() => {
        pending.delete(document.uri.toString())
        check(document)
      }, DELAY_MS),
    )
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
    }),
    {
      dispose() {
        for (const timer of pending.values()) clearTimeout(timer)
        pending.clear()
      },
    },
  )
  for (const document of vscode.workspace.textDocuments) check(document)
}

export function deactivate() {}
