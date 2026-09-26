/**
 * Kobler diagnostikken til VS Code.
 *
 * Alt som sjekker noe står i `diagnostikk.ts`, uten VS Code i seg. Her
 * leses `elementer.json` fra utvidelsens mappe, hvert HTML-dokument kjøres
 * gjennom når det åpnes og endres, og funnene blir røde og gule streker med
 * komponentsiden som lenke. Endringer ventes ut i et kort øyeblikk, så ikke
 * hvert tastetrykk gir en kjøring.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import * as vscode from "vscode"
import { diagnostiser, type Elementer, type Funn } from "./diagnostikk"

const VENT_MS = 250

export function activate(context: vscode.ExtensionContext) {
  const elementer: Elementer = JSON.parse(
    readFileSync(join(context.extensionPath, "elementer.json"), "utf8"),
  )
  const samling = vscode.languages.createDiagnosticCollection("fristil")
  const ventende = new Map<string, ReturnType<typeof setTimeout>>()

  const tilDiagnose = (dokument: vscode.TextDocument, funn: Funn) => {
    const d = new vscode.Diagnostic(
      new vscode.Range(
        dokument.positionAt(funn.start),
        dokument.positionAt(funn.slutt),
      ),
      funn.melding,
      funn.alvor === "feil"
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning,
    )
    d.source = "Fristil"
    d.code = { value: "dokumentasjon", target: vscode.Uri.parse(funn.lenke) }
    return d
  }

  const sjekk = (dokument: vscode.TextDocument) => {
    if (dokument.languageId !== "html") return
    samling.set(
      dokument.uri,
      diagnostiser(dokument.getText(), elementer).map((f) =>
        tilDiagnose(dokument, f),
      ),
    )
  }

  const sjekkSnart = (dokument: vscode.TextDocument) => {
    const nokkel = dokument.uri.toString()
    clearTimeout(ventende.get(nokkel))
    ventende.set(
      nokkel,
      setTimeout(() => {
        ventende.delete(nokkel)
        sjekk(dokument)
      }, VENT_MS),
    )
  }

  context.subscriptions.push(
    samling,
    vscode.workspace.onDidOpenTextDocument(sjekk),
    vscode.workspace.onDidChangeTextDocument((e) => sjekkSnart(e.document)),
    vscode.workspace.onDidCloseTextDocument((d) => samling.delete(d.uri)),
  )
  for (const dokument of vscode.workspace.textDocuments) sjekk(dokument)
}

export function deactivate() {}
