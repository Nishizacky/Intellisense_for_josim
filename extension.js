const vscode = require("vscode");
var textCounter = 0;
const JOSIM_MODE = { scheme: "file", language: "josim" };
const subcktPattern = /^\.subckt\s+(\w+)/m;
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
async function superFinder(document, currentWord, mode) {
  var result = findwhere(document, currentWord, mode);
  if (result != null) {
    return result;
  }
  var uri = await docSelector(document);
  for (const docuri of uri) {
    const refDoc = await vscode.workspace.openTextDocument(docuri);
    var result = findwhere(refDoc, currentWord, mode);
    if (result != null) {
      return result;
    }
  }
}
async function docSelector(document) {
  var text = document.getText();
  var searchStr = new RegExp(/\.include\s+(\S+)/, "g");
  var incFileName = text.match(searchStr) || [];
  var refFileName = [];
  for (var i = 0; i < incFileName.length; i++) {
    var tmp = incFileName[i].match(/\.include\s+(\S+)/m);
    refFileName[i] = tmp[1];
  }
  if (refFileName.length === 0) {
    return null;
  }
  var docUri = [];
  for (const fileName of refFileName) {
    docUri.push(vscode.Uri.file(fileName));
  }
  return docUri;
}
function findwhere(document, currentWord, mode = "loc") {
  var rejectStr = new RegExp(/^(L|R|B|C|[0-9])/, "g");
  if (currentWord.match(rejectStr) != null) {
    return null;
  }
  if (currentWord == ".subckt") {
    return vscode.window.showInformationMessage("This is the definition.");
  }
  var text = document.getText();
  var loc = null;
  const searchStr = new RegExp("^\\.subckt\\s+" + currentWord, "m");
  const startIndex = text.search(searchStr);
  if (startIndex > -1) {
    const pos = document.positionAt(startIndex);
    var nonl_text = text.replace(/[\s\n]/gm, "o");
    const sub_endIndex = nonl_text.indexOf("ends", startIndex);
    const endIndex = nonl_text.indexOf("s", sub_endIndex);
    const endposition = document.positionAt(endIndex);
    const range = new vscode.Range(pos, endposition);
    loc = new vscode.Location(document.uri, pos); // locの値を設定
    const hitchar = document.lineAt(pos).text.indexOf(currentWord);
    if (mode === "loc") return loc;
    else if (mode === "hitline") return document.lineAt(position);
    else if (mode === "hitchar") return hitchar;
    else if (mode === "range") {
      return document.getText(range);
    } else console.log("mode isn't defined");
  } else return;
}

class JOSIM_HoverProvider {
  async provideHover(document, position, token) {
    const currentWord = getCurrentWord(document, position);
    var gotText = await superFinder(document, currentWord, "range");
    var hoverstring = new vscode.MarkdownString();
    hoverstring.appendCodeblock(gotText, "josim");
    return Promise.resolve(new vscode.Hover(hoverstring));
  }
}
class JOSIM_DefinitionProvider {
  async provideDefinition(document, position, token) {
    const currentWord = getCurrentWord(document, position);
    return superFinder(document, currentWord, "loc");
  }
}

class JOSIM_FormatProvider {
  provideDocumentFormattingEdits(document, options, token) {
    const edits = [];
    const text = document.getText();
    var max_indent = 0;
    var text_temp     
    
    for(){

    }

    const formattedText = text.replace(
      /(\d+)\s*([a-zA-Z]+)/g,
      (match, numeric, unit) => {
        const alignedNumeric = numeric.padStart(2, " ");
        return `${alignedNumeric} ${unit}`;
      }
    );

    // 修正情報を作成して配列に追加
    if (formattedText !== text) {
      const range = new vscode.Range(
        document.positionAt(0),
        document.positionAt(text.length)
      );
      const edit = new vscode.TextEdit(range, formattedText);
      edits.push(edit);
    }

    return edits;
    return vscode.window.showInformationMessage("Formatter haven't been developed yet. Please wait until update.")
  }
}

class JOSIM_FoldingRangeProvider {
  provideFoldingRange(document, context, token) {
    console.log("foldrange on");
    var text = document.getText();
    const lines = text.toString().split("\n");
    var line_counter = 0;
    var hitline_counter = 0;
    var hitline = [];
    var endline = [];
    const searchStr = ".subckt";
    const endchar = ".ends";
    for (var line in lines) {
      if (lines[line].indexOf(searchStr) > -1) {
        hitline[hitline_counter] = line + 1;
      }
      if (lines[line].indexOf(endchar) > -1) {
        endline[hitline_counter] = line;
        hitline_counter++;
      }
      line_counter++;
    }
    var range = [];
    for (var i in hitline_counter) {
      range[i] = vscode.Range(
        vscode.Position(hitline[i], 0),
        vscode.Position(endline[i]),
        length(endchar)
      );
    }
    console.log(range);
    const uri = vscode.Uri.file(document.fileName);
    // const foldRange = vscode.Range.range;
    return Promise.providerre(range);
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      JOSIM_MODE,
      new JOSIM_HoverProvider()
    )
  );
  context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider(
      JOSIM_MODE,
      new JOSIM_FoldingRangeProvider()
    )
  );
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      JOSIM_MODE,
      new JOSIM_DefinitionProvider()
    )
  );
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(
      JOSIM_MODE,
      new JOSIM_FormatProvider()
    )
  );
}

function deactivate() {
  return undefined;
}

module.exports = { activate, deactivate };
