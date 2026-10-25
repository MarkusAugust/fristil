/**
 * Kjøres inne i VS Code av `scripts/sjekk-vscode.ts`: utvidelsen er lastet,
 * og språkserveren skal gi funn og hurtigrettelser i et ekte dokument.
 */

const assert = require("node:assert")
const vscode = require("vscode")

/** Venter til funnene for dokumentet er slik testen vil, eller gir opp. */
async function diagnosticsFor(uri, wanted) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const found = vscode.languages.getDiagnostics(uri)
    if (wanted(found)) return found
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(
    `Ventet forgjeves på funnene: ${JSON.stringify(vscode.languages.getDiagnostics(uri))}`,
  )
}

exports.run = async () => {
  const document = await vscode.workspace.openTextDocument({
    language: "html",
    content: '<p>🧾</p>\n<button class="fs-buton">Send</button>\n',
  })
  await vscode.window.showTextDocument(document)

  const found = await diagnosticsFor(document.uri, (d) => d.length > 0)
  assert.strictEqual(found.length, 1, "ett funn")
  assert.strictEqual(found[0].source, "Fristil")
  assert.strictEqual(found[0].range.start.line, 1)
  assert.strictEqual(found[0].range.start.character, 15)
  assert.strictEqual(
    typeof found[0].code === "object" ? found[0].code.value : found[0].code,
    "ukjent-klasse",
  )

  const actions = await vscode.commands.executeCommand(
    "vscode.executeCodeActionProvider",
    document.uri,
    found[0].range,
  )
  const fix = actions.find((a) => a.title === "Bytt til fs-button")
  assert.ok(
    fix,
    `ingen rettelse blant ${actions.map((a) => a.title).join(", ")}`,
  )
  await vscode.workspace.applyEdit(fix.edit)
  assert.ok(
    document.getText().includes('class="fs-button"'),
    "rettelsen ble ikke brukt",
  )
  await diagnosticsFor(document.uri, (d) => d.length === 0)

  // To endringer av språklista rett etter hverandre gir én server, ikke to:
  // funnet skal komme én gang.
  const config = vscode.workspace.getConfiguration("fristil")
  const languages = config.get("languages")
  await Promise.all([
    config.update("languages", [...languages, "plaintext"], true),
    config.update("languages", languages, true),
  ])
  const second = await vscode.workspace.openTextDocument({
    language: "html",
    content: '<button class="fs-buton">Send</button>\n',
  })
  await new Promise((resolve) => setTimeout(resolve, 3000))
  const once = await diagnosticsFor(second.uri, (d) => d.length > 0)
  assert.strictEqual(
    once.filter((d) => d.source === "Fristil").length,
    1,
    `funnet kom ${once.length} ganger etter to omstarter`,
  )

  // Fullføringen er fortsatt utvidelsens egen.
  const edit = new vscode.WorkspaceEdit()
  edit.insert(document.uri, new vscode.Position(2, 0), '<b class="fs-')
  await vscode.workspace.applyEdit(edit)
  const list = await vscode.commands.executeCommand(
    "vscode.executeCompletionItemProvider",
    document.uri,
    new vscode.Position(2, 13),
  )
  assert.ok(
    list.items.some((item) => (item.label.label ?? item.label) === "fs-button"),
    "fs-button er ikke blant forslagene",
  )

  // Snippeten for feltet: id-en skrives én gang, og `for` følger med.
  const extension = vscode.extensions.all.find(
    (e) => e.packageJSON.name === "fristil-vscode",
  )
  assert.ok(extension, "fant ikke utvidelsen")
  const snippets = JSON.parse(
    require("node:fs").readFileSync(
      require("node:path").join(extension.extensionPath, "dist/snippets.json"),
      "utf8",
    ),
  )
  const third = await vscode.workspace.openTextDocument({
    language: "html",
    content: "",
  })
  const editor = await vscode.window.showTextDocument(third)
  await editor.insertSnippet(
    new vscode.SnippetString(snippets["fs-field"].body.join("\n")),
  )
  await vscode.commands.executeCommand("type", { text: "epost" })
  const text = third.getText()
  assert.ok(
    text.includes('id="epost"') && text.includes('for="epost"'),
    `id og for følger ikke hverandre i snippeten: ${text}`,
  )
  assert.ok(!text.includes("navn"), `plassholderen står igjen: ${text}`)
}
