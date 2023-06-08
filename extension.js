const vscode = require('vscode');
var textCounter = 0
const JOSIM_MODE = { scheme: 'file', language: 'josim' };
const subcktPattern = /^\.subckt\s+(\w+)/m;
function findwhere(document, currentWord, mode = "loc") {
    if (currentWord == ".subckt") {
        return Promise.resolve('This is the definition.');
    }

    var text = document.getText();
    var nonl_text = text.replace(/[\s\n]/mg, "o");
    var searchStr = new RegExp(/\.include\s+(\S+)/, "g");
    var incFileName = text.match(searchStr) || [];
    var refFileName = [];

    for (var i = 0; i < incFileName.length; i++) {
        var tmp = incFileName[i].match(/\.include\s+(\S+)/m);
        refFileName[i] = tmp[1];
    }

    var promises = refFileName.map((fileName) => {
        var tmp = vscode.Uri.file(fileName);
        const uri = vscode.Uri.parse(tmp, true);
        return vscode.workspace.openTextDocument(uri).then((refDoc) => {
            return findwhere(refDoc, currentWord, mode);
        });
    });

    return Promise.all(promises).then((results) => {
        var returnValue = null;

        for (var i = 0; i < results.length; i++) {
            if (results[i] !== null) {
                returnValue = results[i];
                break;
            }
        }

        var loc = null; // locの初期値を設定

        if (refFileName.length === 0) {
            const text = document.getText();
            const searchStr = new RegExp("^\\.subckt\\s+" + currentWord, "m");
            const startIndex = text.search(searchStr);
            const position = document.positionAt(startIndex);
            const trueUri = vscode.Uri.file(document.fileName);
            const pos = position;
            const sub_endIndex = nonl_text.indexOf("ends", startIndex);
            const endIndex = nonl_text.indexOf("\s", sub_endIndex);
            const endposition = document.positionAt(endIndex);
            const range = new vscode.Range(position, endposition);
            loc = new vscode.Location(trueUri, pos); // locの値を設定
            const hitchar = document.lineAt(position).text.indexOf(currentWord);

            if (mode === "loc") return loc;
            else if (mode === "uri") return trueUri;
            else if (mode === "hitline") return document.lineAt(position);
            else if (mode === "hitchar") return hitchar;
            else if (mode === "range") return range;
            else return null;
        } else {
            console.log(returnValue);
            return returnValue;
        }
    }).catch((error) => {
        console.error(error);
        return null;
    });
}


function getCurrentWord(document, position) {
    const wordRange = document.getWordRangeAtPosition(position, /[\.a-zA-Z0-9_]+/);
    if (!wordRange) return Promise.reject('No word here.');
    const currentWord = document.lineAt(position.line).text.slice(wordRange.start.character, wordRange.end.character);
    return currentWord
}
class JOSIM_HoverProvider {
    provideHover(document, position, token) {
        const currentWord = getCurrentWord(document, position)
        if (currentWord == ".subckt") {
            return Promise.resolve('This is definition.')
        }
        var text = document.getText()
        var nonl_text = text.replace(/[\s\n]/mg, "o")
        const searchStr = new RegExp("^\.subckt +" + currentWord, "m")
        const startIndex = text.search(searchStr)
        const Point = document.positionAt(startIndex);
        if (Point == vscode.Point(0, 0)) {
            return
        }
        const sub_endIndex = nonl_text.indexOf("ends", startIndex);
        var endIndex = nonl_text.indexOf("\s", sub_endIndex) + 1;
        const endposition = document.positionAt(endIndex)
        const range = new vscode.Range(Point, endposition)
        var gotText = document.getText(range)
        var hoverstring = new vscode.MarkdownString
        hoverstring.appendCodeblock(gotText, "josim")
        return Promise.resolve(new vscode.Hover(hoverstring));
    }
}
class JOSIM_DefinitionProvider {
    provideDefinition(document, position, token) {
        const currentWord = getCurrentWord(document, position);
        return findwhere(document, currentWord).then((loc) => {
            console.log(loc);
            return loc;
        });
    }
}


class JOSIM_FoldingRangeProvider {
    provideFoldingRange(document, context, token) {
        console.log("foldrange on")
        var text = document.getText()
        const lines = text.toString().split("\n");
        var line_counter = 0
        var hitline_counter = 0
        var hitline = []
        var endline = []
        const searchStr = ".subckt"
        const endchar = ".ends"
        for (var line in lines) {
            if (lines[line].indexOf(searchStr) > -1) {
                hitline[hitline_counter] = line + 1;
            }
            if (lines[line].indexOf(endchar) > -1) {
                endline[hitline_counter] = line;
                hitline_counter++
            }
            line_counter++
        }
        var range = []
        for (var i in hitline_counter) {
            range[i] = vscode.Range(vscode.Position(hitline[i], 0), vscode.Position(endline[i]), length(endchar))
        }
        console.log(range)
        const uri = vscode.Uri.file(document.fileName);
        // const foldRange = vscode.Range.range;
        return Promise.providerre(range)
    }
}


function activate(context) {
    context.subscriptions.push(vscode.languages.registerHoverProvider(JOSIM_MODE, new JOSIM_HoverProvider()));
    context.subscriptions.push(vscode.languages.registerFoldingRangeProvider(JOSIM_MODE, new JOSIM_FoldingRangeProvider()));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(JOSIM_MODE, new JOSIM_DefinitionProvider()));
    // let a = new JOSIM_FoldingRangeProvider;
    // a.provideFoldingRange(document);
    // console.log(context)
    // console.log(context.workspaceState)
}

function deactivate() {
    return undefined;
}

module.exports = { activate, deactivate };


