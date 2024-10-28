const vscode = require("vscode")
const { spawn } = require("child_process")
exports.jsmAnalyzer = async function (documnet) {
    let filename = documnet.uri.fsPath
    let buffer = ""
    let bufferFlag = false
    let array    
    const childProcess = spawn('josim-cli', [filename])
    childProcess.stderr.on('data', (str) => {
        buffer += str.toString()
        if (buffer.includes("E:")) {
            buffer = buffer.replace("\nE:","E:")
            bufferFlag = true
        }
        if (bufferFlag == true && buffer.includes("\n\n")) {
            buffer = buffer.replace("\n\n", "")
            array = buffer.split("\n")
            bufferFlag = false
        }

        if (!bufferFlag && buffer.length > 3) {
            buffer = ""
        }
        console.log(array);
        let re = RegExp(array[2].replaceAll(" ","\\s+"))
        console.log(re);
        for(let i=0;i<document.lineCount;i++){
            
        }
        
        array = ""

    })
    childProcess.stdout.on('close', () => {
        console.log("closed");
    })

}