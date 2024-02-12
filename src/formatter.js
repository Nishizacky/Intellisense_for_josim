const vscode = require("vscode")

exports.jsmFormatter = function (document) {
  let wordLengthMax = 0
  let maxWord = ""
  let space = 20
  let re = /\s+/
  //一番文字数の大きい単語を探す
  for (let i = 0; i < document.lineCount; i++) {
    let lineHead = document.lineAt(i).text
    let wordArray = lineHead.split(re)
    if (!lineHead.startsWith(".")) {
      for (let j = 0; j < wordArray.length; j++) {
        if (wordLengthMax < wordArray[j].length) {
          wordLengthMax = wordArray[j].length
          maxWord = wordArray[j]
        }
      }
    }
  }
  console.log("wordLengthMax: " + maxWord + ", " + wordLengthMax)
  vscode.TextEdit.insert(document.lineAt(0).range.start, wordLengthMax)
}