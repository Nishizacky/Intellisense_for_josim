const vscode = require("vscode");
const superFinder = require("./superFinder")
const simulationExec = require("./simulation_exec")
const JOSIM_MODE = { scheme: "file", language: "josim" };

function getCurrentWord(document, position) {
  const wordRange = document.getWordRangeAtPosition(
    position,
    /[\.a-zA-Z0-9_]+/
  );
  if (!wordRange) return null;
  const currentWord = document
    .lineAt(position.line)
    .text.slice(wordRange.start.character, wordRange.end.character);
  return currentWord;
}
class JOSIM_HoverProvider {
  async provideHover(document, position, token) {
    const currentWord = getCurrentWord(document, position);
    var gotText = await superFinder.superFinder(document, currentWord, "range");
    var hoverstring = new vscode.MarkdownString();
    hoverstring.appendCodeblock(gotText, "josim");
    return Promise.resolve(new vscode.Hover(hoverstring));
  }
}
class JOSIM_DefinitionProvider {
  async provideDefinition(document, position, token) {
    const currentWord = getCurrentWord(document, position);
    return superFinder.superFinder(document, currentWord, "loc");
  }
}

let disposable = vscode.commands.registerCommand('extension.playButton', () => {
  const activeEditor = vscode.window.activeTextEditor;
  const path = activeEditor.document.uri.fsPath;
  simulationExec.showSimulationResult(path)
})

function activate(context) {
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
  context.subscriptions.push(disposable);
}

function deactivate() {
  return undefined;
}

module.exports = { activate, deactivate };
