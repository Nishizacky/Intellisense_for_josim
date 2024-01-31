const vscode = require("vscode")

vscode.languages.registerDocumentFormattingEditProvider('jsm', {
    provideDocumentFormattingEdits(document){
      const firstLine = document.lineAt(0);
      if (firstLine.text !== '42') {
        return [vscode.TextEdit.insert(firstLine.range.start, '42\n')];
      }
    }
  });
  