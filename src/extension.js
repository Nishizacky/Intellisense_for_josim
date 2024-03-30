const vscode = require("vscode");
const superFinder = require("./minified/superFinder.min")
const simulationExec = require("./minified/simulation_exec.min")
const JOSIM_MODE = { scheme: "file", language: "josim" };
const jsmFormatter = require("./minified/formatter.min")

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

let disposable = [];

disposable.concat(
  vscode.commands.registerCommand("josim-cli.executeSimulation", () => {
    const activeEditor = vscode.window.activeTextEditor;
    const uri = activeEditor.document.uri;
    simulationExec.showSimulationResult(uri)
  }
  )
)
disposable.concat(
  vscode.languages.registerDocumentFormattingEditProvider('josim', {
    provideDocumentFormattingEdits(document) {
      return jsmFormatter.jsmFormatter(document)
    }
  })
)
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
  for (let i = 0; i < disposable.length; i++) { context.subscriptions.push(disposable[i]) }

}

function deactivate() {
  return undefined;
}

module.exports = { activate, deactivate };
