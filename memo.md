'''
 provideDefinition (
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ) {
    const targetText = document.getText()
    const editor = vscode.window.activeTextEditor
 
    const selection = document.getWordRangeAtPosition(
      editor?.selection.active ?? new vscode.Position(0, 0)
    )
    const selectedText = document.getText(selection)
 
    return this.genSassClassDefinitionsFromText(targetText)
      .filter(sassClass => sassClass.className === selectedText)
      .map(
        targetSassClass =>
          new vscode.Location(
            document.uri,
            new vscode.Range(
              document.positionAt(targetSassClass.start),
              document.positionAt(targetSassClass.end)
            )
          )
      )
  }
'''
\.subckt ZZPSQ_jtl_1(.|\n)*?(\.ends)
  https://codelic.co/BlogDetail/RHpaTnanCJ9LLz273PKD