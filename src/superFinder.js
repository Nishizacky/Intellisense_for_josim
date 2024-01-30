const vscode = require("vscode")
exports.superFinder = async function (document, currentWord, mode) {
    var uri = await docSelector(document);
    if (uri != null) {
        for (const docuri of uri) {
            const refDoc = await vscode.workspace.openTextDocument(docuri);
            var result = findwhere(refDoc, currentWord, mode);
            if (result != null) {
                return result;
            }
        }
    }
    var result = findwhere(document, currentWord, mode);
    if (result != null) {
        return result;
    }
    return null
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
    // var rejectStr = new RegExp(/^(L|R|B|C|[0-9])/, "g");
    // if (currentWord.match(rejectStr) != null) {
    //   return null;
    // }
    if (currentWord == ".subckt") {
        return vscode.window.showInformationMessage("This is the definition.");
    }
    var text = document.getText();
    var loc = null;
    const searchStr = new RegExp("^\\.subckt\\s+" + currentWord, "m");
    const startIndex = text.search(searchStr);
    const searchStr_alt = new RegExp("^" + currentWord, "m");
    const startIndex_alt = text.search(searchStr_alt)
    if (startIndex > -1) {
        const pos = document.positionAt(startIndex);
        var nonl_text = text.replace(/[\s\n]/gm, "o");
        const sub_endIndex = nonl_text.indexOf("ends", startIndex);
        const endIndex = nonl_text.indexOf("s", sub_endIndex);
        const endposition = document.positionAt(endIndex + 1);
        const range = new vscode.Range(pos, endposition);
        loc = new vscode.Location(document.uri, pos); // locの値を設定
        const hitchar = document.lineAt(pos).text.indexOf(currentWord);
        if (mode === "loc") return loc;
        else if (mode === "hitline") return document.lineAt(position);
        else if (mode === "hitchar") return hitchar;
        else if (mode === "range") {
            return document.getText(range);
        } else console.log("mode isn't defined");
    } else if (startIndex_alt > -1) {
        const pos = document.positionAt(startIndex_alt);
        const scriptRange = document.lineAt(pos)
        loc = new vscode.Location(document.uri, pos); // locの値を設定
        const hitchar = document.lineAt(pos).text.indexOf(currentWord);
        if (mode === "loc") return loc;
        else if (mode === "hitline") return document.lineAt(position);
        else if (mode === "hitchar") return hitchar;
        else if (mode === "range") {
            return scriptRange.text;
        } else console.log("mode isn't defined");
    } else console.log("search failed")
    return null;
}