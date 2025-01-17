'use strict';
import * as vscode from 'vscode';
import { exec } from 'child_process'

export function checkSyntax(document: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
	const fspath = document.uri.fsPath
	const re = /\/[^\/]+$/
	let filePath = String(fspath).replace(re, "");
	if (filePath.includes(' ')) {
		vscode.window.showInformationMessage("filename should not contain ' '.");
	}

	
	var fileContent:string = document.getText().toUpperCase();
	const re_tran:RegExp = /\.TRAN.+/
	let fileContentInput:string=fileContent.replace(re_tran,".tran 1p 1p 1p 1p")
	const string_for_exec:string = 'josim-cli -i -m\n' + fileContentInput
	exec(string_for_exec, (err: Error|null, stdout: string, stderr: string) => {
		collection.clear()
		const match = stderr.match(/Infringing line: (.+)/)
		if (match) {
			let err_srcCode = match[1]
			let re = err_srcCode.replace(/ /img, "\\s+")
			let reg = new RegExp(`${re}`, "img")
			let start_offset = document.getText().search(reg);
			let start_position = document.positionAt(start_offset);
			let range = document.lineAt(start_position).range
			// console.log(range);

			collection.set(document.uri, [{
				code: '',
				message: 'Invalid component declaration',
				range: range,
				severity: vscode.DiagnosticSeverity.Error,
				source: '',
			}]);
			console.log("dignosis");
		}

	})

}