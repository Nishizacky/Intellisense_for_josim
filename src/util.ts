import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from "path";
function load_config() {
    tmpFiles = vscode.workspace.getConfiguration("tmpFiles")
    saveCount = tmpFiles.get("saveCount")
}

let tmpFiles = vscode.workspace.getConfiguration("tmpFiles")
let saveCount = tmpFiles.get("saveCount")


export async function getFileNamesInFolder(folderPath: any) {
    try {
        const filesInfo = [];
        const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(folderPath, '*')
        );

        for (const file of files) {
            const fileName = path.basename(file.fsPath);
            const stats = fs.statSync(file.fsPath);
            const createdTime = stats.birthtime.getTime();
            filesInfo.push({ fileName, filePath: file.fsPath, createdTime });
        }
        let sortedFiles = filesInfo.sort((a, b) => b.createdTime - a.createdTime)
        let returnArray: any = []
        sortedFiles.forEach(file => {
            returnArray.push(file.filePath)
        })
        return returnArray;
    } catch (error) {
        console.error('Error occurred while getting file names:', error);
        return [];
    }
}

export async function autoDeleteTmpFiles(filenames: any) {
    load_config()
    let basenameArray: any = []
    let noDuplicates = []
    filenames.forEach((file: any) => {
        basenameArray.push(file.replace(/\..+/, ""))
    })
    noDuplicates = Array.from(new Set(basenameArray))

    for (let i = Number(saveCount) - 1; i < noDuplicates.length; i++) {
        let regexSource = noDuplicates[i] + "\..+"
        let re = new RegExp(regexSource)
        filenames.filter(function (value: any) { return value.match(re) }).forEach((fname: any) => {
            fs.unlink(fname, (err) => {
                if (err) {
                    console.error(`Failed to delete file ${fname}:`, err);
                } else {
                    console.log(`Deleted file: ${fname}`);
                }
            });
        })

    }
}