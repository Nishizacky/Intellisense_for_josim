import * as vscode from "vscode";
import { superFinder } from "./superFinder"
import { showSimulationResult, allWebviewPanels } from "./simulation_exec"
import { checkSyntax } from "./syntaxChecker"
import { jsmFormatter } from "./formatter"
const JOSIM_MODE = { scheme: "file", language: "josim" };

function getCurrentWord(document: vscode.TextDocument, position: vscode.Position): string {
  const wordRange = document.getWordRangeAtPosition(
    position,
    /[\.a-zA-Z0-9_]+/
  );
  if (wordRange) {
    const currentWord = document
      .lineAt(position.line)
      .text.slice(wordRange.start.character, wordRange.end.character);
    return currentWord;
  }
  throw console.log(`wordRange: ${wordRange}`);
}
class JOSIM_HoverProvider {
  async provideHover(document: any, position: any, token: any) {
    const currentWord = getCurrentWord(document, position);
    let gotText = await superFinder(document, currentWord, "range");
    let hoverstring = new vscode.MarkdownString();
    hoverstring.appendCodeblock(gotText, "josim");
    return Promise.resolve(new vscode.Hover(hoverstring));
  }
}
class JOSIM_DefinitionProvider {
  async provideDefinition(document: any, position: any, token: any) {
    const currentWord = getCurrentWord(document, position);
    return superFinder(document, currentWord, "loc");
  }
}

let disposable: any[] = []; // 修正: 初期化方法を変更

disposable = disposable.concat(
  vscode.commands.registerCommand("josim-cli.executeSimulation", () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      activeEditor.document.save();
      const uri = activeEditor.document.uri;
      showSimulationResult(uri, true)
    }
  })
);

disposable = disposable.concat(
  vscode.languages.registerDocumentFormattingEditProvider('josim', {
    provideDocumentFormattingEdits(document: any) {
      return jsmFormatter(document)
    }
  })
);

disposable = disposable.concat(
  vscode.commands.registerCommand("josim-cli.executeSimulationNoPlot", () => {
    const activeTextEditor = vscode.window.activeTextEditor;
    if (activeTextEditor) {
      activeTextEditor.document.save();
      const uri = activeTextEditor.document.uri;
      showSimulationResult(uri, false)
    }
  })
);

disposable = disposable.concat(
  vscode.commands.registerCommand("josim-cli.closeAllPlots", () => {
    if (Array.isArray(allWebviewPanels)) {
      allWebviewPanels.forEach((pannel: vscode.WebviewPanel) => {
        try {
          pannel.dispose();
        } catch (e) { }
      })
    }
  })
)

function activate(context: any) {
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      JOSIM_MODE,
      new JOSIM_HoverProvider()
    )
  );
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      JOSIM_MODE,
      new JOSIM_DefinitionProvider()
    )
  );
  const collection = vscode.languages.createDiagnosticCollection('jsm_report');

  for (let i = 0; i < disposable.length; i++) { context.subscriptions.push(disposable[i]) }
  // if (vscode.window.activeTextEditor) {
  //   checkSyntax(vscode.window.activeTextEditor.document, collection);
  // }
  // context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor: any) => {
  //   if (editor) {
  //     checkSyntax(editor.document, collection);
  //   }
  // }));
  // context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
  //   if (event.document === vscode.window.activeTextEditor?.document) {
  //     checkSyntax(event.document, collection);
  //   }
  // }));
  // context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
  //   checkSyntax(document, collection);
  // }));
}

function deactivate() {
  return undefined;
}

export { activate, deactivate };
