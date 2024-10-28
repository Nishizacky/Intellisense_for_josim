const vscode = require("vscode")
const exec = require('child_process').exec

exports.checkSyntax = function (document, collection) {
	const fspath = document.uri.fsPath
	const re = /\/[^\/]+$/
	let filePath = String(fspath).replace(re, "");
	if (filePath.includes(' ')) {
		vscode.window.showInformationMessage("filename should not contain ' '.");
	}

	const string_for_exec = 'josim-cli -m ' + fspath

	exec(string_for_exec, (err, stdout, stderr) => {
		collection.clear()
		let err_srcCode = stderr.match(/Infringing line: (.+)/)[1]
		let re = err_srcCode.replace(/ /img, "\\s+")
		let reg = new RegExp(`${re}`, "img")
		let start_offset = document.getText().search(reg);
		let start_position = document.positionAt(start_offset);
		let range = document.lineAt(start_position).range
		console.log(range);
		
		collection.set(document.uri, [{
			code: '',
			message: 'Invalid component declaration',
			range: range,
			severity: vscode.DiagnosticSeverity.Error,
			source: '',
		}]);
		console.log("dignosis");

	})

}