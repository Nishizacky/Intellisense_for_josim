const vscode = require('vscode');
const fs = require('fs');

const JOSIM_MODE = { scheme: 'file', language: 'josim' };
function findwhere(document, currentWord, mode = "loc") {
    var text = fs.readFileSync(document.fileName);
    const lines = text.toString().split("\n");
    var hitline = 0
    var hitchar = 0
    const searchStr = new RegExp("^\.subckt +" + currentWord)
    for (var line in lines) {
        if (lines[line].match(searchStr) != null) {
            hitchar = lines[line].indexOf(currentWord);
            break;
        }
        hitline++
    }
    // fs.close()
    const uri = vscode.Uri.file(document.fileName);
    const pos = new vscode.Position(hitline, hitchar);
    const loc = new vscode.Location(uri, pos);
    if (mode == "loc") return loc;
    else if (mode == "uri") return uri;
    else if (mode == "hitline") return hitline;
    else if (mode == "hitchar") return hitchar;
}

function getCurrentWord(document, position) {
    const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_]+/);
    if (!wordRange) return Promise.reject('No word here.');
    const currentWord = document.lineAt(position.line).text.slice(wordRange.start.character, wordRange.end.character);
    return currentWord
}
class JOSIM_HoverProvider {
    provideHover(document, position, token) {
        const currentWord = getCurrentWord(document,position)
        
        // const currentWord = getCurrentWord(document, position)
        // const loc = findwhere(document,position)
        // const range = new vscode.Range(start = loc,endLine=154,endCharactor = 0)
        return Promise.resolve(new vscode.Hover(currentWord));
    }
}
class JOSIM_DefinitionProvider {
    provideDefinition(document, position, token) {
        const currentWord = getCurrentWord(document, position)
        const loc = findwhere(document, currentWord)
        return Promise.resolve(loc);
    }
}
class JOSIM_DefinitionPeekProvider{
    provided
}


function activate(context) {
    context.subscriptions.push(vscode.languages.registerHoverProvider(JOSIM_MODE, new JOSIM_HoverProvider()));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(JOSIM_MODE, new JOSIM_DefinitionProvider()));
}

function deactivate() {
    return undefined;
}

module.exports = { activate, deactivate };


