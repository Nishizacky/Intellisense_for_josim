import vscode from "vscode"

export function jsmFormatter(document: vscode.TextDocument) {
  const re = /\s+/g;
  const space_config = vscode.workspace.getConfiguration('formatter');
  const space_amount = space_config.get<number>("wordSpacing", 2);
  const fullText = document.getText();
  // 2回以上の改行でブロック分割
  const blocks = fullText.split(/\n{2,}/);
  let formattedBlocks: string[] = [];

  for (let block of blocks) {
    // ブロック内の行を取得
    const blockLines = block.split(/\n/);
    let lines: { original: string, words: string[] | null }[] = [];
    let maxColumns = 0;
    for (let singleLine of blockLines) {
      let regex = /(^\.|\*|#|(\s+\n))|\+/;
      if (regex.test(singleLine)) {
        lines.push({ original: singleLine, words: null });
        continue;
      }
      let words = singleLine.split(re).filter(word => word.length > 0);
      lines.push({ original: singleLine, words });
      maxColumns = Math.max(maxColumns, words.length);
    }
    // 各列の最大幅を計算
    let columnWidths = new Array(maxColumns).fill(0);
    for (let line of lines) {
      if (line.words) {
        for (let j = 0; j < line.words.length - 1; j++) {
          columnWidths[j] = Math.max(columnWidths[j], line.words[j].length);
        }
      }
    }
    // フォーマット
    let formattedLines: string[] = [];
    for (let line of lines) {
      if (!line.words) {
        formattedLines.push(line.original);
        continue;
      }
      let newline = "";
      let parflag = 0;
      for (let j = 0; j < line.words.length - 1; j++) {
        newline += line.words[j];
        if (line.words[j].includes("(")) { parflag += 1; }
        if (line.words[j].includes(")") && parflag > 0) { parflag -= 1; }
        let spacesToAdd = 0;
        if (parflag < 1) {
          spacesToAdd += columnWidths[j] - line.words[j].length + space_amount;
        } else {
          spacesToAdd += 1;
        }
        newline += " ".repeat(spacesToAdd);
      }
      newline += line.words[line.words.length - 1];
      formattedLines.push(newline);
    }
    formattedBlocks.push(formattedLines.join("\n"));
  }

  // フォーマット済みブロックを2回以上の改行で結合
  const formattedText = formattedBlocks.join("\n\n");

  // 全体を1つのTextEditで置換
  return [vscode.TextEdit.replace(
    new vscode.Range(
      document.positionAt(0),
      document.positionAt(fullText.length)
    ),
    formattedText
  )];
}
