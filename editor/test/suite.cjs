/**
 * Run inside VS Code by `scripts/check-vscode.ts`: the extension is loaded,
 * and the language server must give findings and quick fixes in a real
 * document.
 */

const assert = require("node:assert")
const vscode = require("vscode")

/** Waits until the document's findings are what the test wants, or gives up. */
async function diagnosticsFor(uri, wanted) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const found = vscode.languages.getDiagnostics(uri)
    if (wanted(found)) return found
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(
    `Waited in vain for the findings: ${JSON.stringify(vscode.languages.getDiagnostics(uri))}`,
  )
}

exports.run = async () => {
  const document = await vscode.workspace.openTextDocument({
    language: "html",
    content: '<p>🧾</p>\n<button class="lt-buton">Send</button>\n',
  })
  await vscode.window.showTextDocument(document)

  const found = await diagnosticsFor(document.uri, (d) => d.length > 0)
  assert.strictEqual(found.length, 1, "one finding")
  assert.strictEqual(found[0].source, "LO-TEK")
  assert.strictEqual(found[0].range.start.line, 1)
  assert.strictEqual(found[0].range.start.character, 15)
  assert.strictEqual(
    typeof found[0].code === "object" ? found[0].code.value : found[0].code,
    "unknown-class",
  )

  const actions = await vscode.commands.executeCommand(
    "vscode.executeCodeActionProvider",
    document.uri,
    found[0].range,
  )
  const fix = actions.find((a) => a.title === "Change to lt-button")
  assert.ok(fix, `no fix among ${actions.map((a) => a.title).join(", ")}`)
  await vscode.workspace.applyEdit(fix.edit)
  assert.ok(
    document.getText().includes('class="lt-button"'),
    "the fix was not applied",
  )
  await diagnosticsFor(document.uri, (d) => d.length === 0)

  // Two changes to the language list in quick succession give one server, not
  // two: the finding must come once.
  const config = vscode.workspace.getConfiguration("lotek")
  const languages = config.get("languages")
  await Promise.all([
    config.update("languages", [...languages, "plaintext"], true),
    config.update("languages", languages, true),
  ])
  const second = await vscode.workspace.openTextDocument({
    language: "html",
    content: '<button class="lt-buton">Send</button>\n',
  })
  await new Promise((resolve) => setTimeout(resolve, 3000))
  const once = await diagnosticsFor(second.uri, (d) => d.length > 0)
  assert.strictEqual(
    once.filter((d) => d.source === "LO-TEK").length,
    1,
    `the finding came ${once.length} times after two restarts`,
  )

  // Completion is still the extension's own.
  const edit = new vscode.WorkspaceEdit()
  edit.insert(document.uri, new vscode.Position(2, 0), '<b class="lt-')
  await vscode.workspace.applyEdit(edit)
  const list = await vscode.commands.executeCommand(
    "vscode.executeCompletionItemProvider",
    document.uri,
    new vscode.Position(2, 13),
  )
  assert.ok(
    list.items.some((item) => (item.label.label ?? item.label) === "lt-button"),
    "lt-button is not among the suggestions",
  )

  // The snippet for the field: the id is typed once, and `for` follows.
  const extension = vscode.extensions.all.find(
    (e) => e.packageJSON.name === "interfaces",
  )
  assert.ok(extension, "did not find the extension")
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
    new vscode.SnippetString(snippets["lt-field"].body.join("\n")),
  )
  // The first tab stop is the form's id, the second the field's, mirrored in `for`.
  await vscode.commands.executeCommand("jumpToNextSnippetPlaceholder")
  await vscode.commands.executeCommand("type", { text: "email" })
  const text = third.getText()
  assert.ok(
    text.includes('id="email"') && text.includes('for="email"'),
    `id and for do not follow each other in the snippet: ${text}`,
  )
  assert.ok(
    text.includes('id="contact-form"'),
    `the first tab stop should have been left untouched: ${text}`,
  )
  assert.ok(
    !text.includes('id="name"'),
    `the placeholder is still there: ${text}`,
  )
}
