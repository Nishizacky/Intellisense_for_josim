import vscode from "vscode"
const formatter = vscode.workspace.getConfiguration('formatter');
const wordSpacing = <number>formatter.get("wordSpacing")

export function jsmFormatter(document: vscode.TextDocument) {
  let wordLengthMax = 0
  let maxWord = ""
  let stack = []
  let newline = ""
  let space = 16
  let re = /\s+/g
  let edits = []
  let flag = 0
  //一番文字数の大きい単語を探す
  for (let i = 0; i < document.lineCount; i++) {
    let singleLine = document.lineAt(i).text
    let wordArray = singleLine.split(re)
    if (!(singleLine.startsWith(".") || singleLine.startsWith("*"))) {
      for (let j = 0; j < wordArray.length; j++) {
        if (wordLengthMax < wordArray[j].length) {
          wordLengthMax = wordArray[j].length
          maxWord = wordArray[j]
        }
      }
    }
  }
  //フォーマッター
  for (let i = 0; i < document.lineCount; i++) {
    let singleLine = document.lineAt(i).text
    let regex = /(^\.|\*|#|(\s+\n))/
    if (regex.test(singleLine)) continue;

    stack = singleLine.split(re)
    for (let j = 0; j < stack.length - 1; j++) {
      newline += stack[j]
      if (stack[j].includes("(")) {
        flag = 1
      }
      if (stack[j].includes(")")) {
        flag = 0
      }
      if (flag == 0) {
        let repeatNum = 0
        let subF = stack[j + 1].length
        if (j == 0) { subF += stack[j].length }
        repeatNum = wordSpacing - subF
        while (repeatNum < 1) {
          repeatNum += space
        }
        for (let h = 0; h < repeatNum; h++) {
          newline += " "
        }
      }
      else {
        newline += " "
      }
    }
    newline += stack.pop()
    edits.push(vscode.TextEdit.replace(document.lineAt(i).range, newline))
    newline = ""
    flag = 0
  }
  return edits
}

function blockSeparater(content: string): string[] {
  return content.split("\n\n")
}

function formatOneBlock(block: string) {

}

function joinBlocks(blocks: string[]): string {
  return blocks.join("\n\n")
}