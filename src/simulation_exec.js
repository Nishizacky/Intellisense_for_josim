const { exec } = require('child_process')
const vscode = require("vscode")
const fs = require('fs')
const csv = require('csv')
exports.showSimulationResult = async function (fspath) {
    let resultFilePath = await simulation_exec(fspath);
    let htmlScript = await csv2html(resultFilePath);
    ShowPlotDraw(htmlScript)
}
async function simulation_exec(fspath) {
    const re = /\/[^\/]+$/
    let filePath = String(fspath).replace(re, "");
    if (filePath.includes(' ')) {
        vscode.window.showInformationMessage("filename should not contain ' '.");
    }
    filePath = filePath + "/josim_resultCSV"
    fs.mkdir(filePath, (err) => {
        if (err) { throw "err: " + err }
    })
    const date = new Date();
    const outputFilePath = filePath + '/jsm_out' + date.getTime() + '.csv';
    const string_for_exec = 'josim-cli ' + fspath + ' -o ' + outputFilePath + ' -m'
    return new Promise((resolve, reject) => {
        exec(string_for_exec, (err, stdout, stderr) => {
            if (err) {
                reject(vscode.window.showErrorMessage("josim-cli\n" + stderr));
            }
            resolve(outputFilePath)
        })
    })
}

function getCurrentWorkspaceFolder() {
    const activeEditor = vscode.window.activeTextEditor
    if (activeEditor) {
        let activeFileUri = activeEditor.document.uri
        let workspaceFolder = vscode.workspace.getWorkspaceFolder(activeFileUri);
        if (workspaceFolder) {
            return workspaceFolder.uri.fsPath
        }
    }
}

function ShowPlotDraw(htmlScript) {
    //返り値はhtmlの文章に使う
    let panel = vscode.window.createWebviewPanel(
        "plotData",
        "Plot-result",
        vscode.ViewColumn.One,
        {
            enableScripts: true,
        }
    );
    let layout = {
        xaxis: {
            title: "Time [s]"
        }
    }
    panel.webview.html = `<!DOCTYPE html>
    <html>
        <head>
            <script src="https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS-MML_SVG"></script>
            <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
        </head>
        <div id="out"></div>
        <div id="out0"></div>
        <div id="out1"></div>
        <div id="out2"></div>
        <script>
            ${htmlScript}
        </script>
    </html>
  `;
}

function getCsvResultFromSimulation(csvFilePath) {
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(csvFilePath)
            .pipe(csv.parse());
        stream.on('error', (error) => reject(error));
        const data = [];
        stream.on('data', (chunk) => data.push(chunk));
        stream.on('end', () => resolve(data));
    })
}

const transpose = a => a[0].map((_, c) => a.map(r => r[c]));

async function csv2html(csvFilePath) {
    let htmlScript;
    let time = [];
    let value = [];
    let trace = [];
    let name = [];
    let data = [];
    let pFlag = 0;
    let iFlag = 0;
    let vFlag = 0;
    const reP = /^P/;
    const reI = /^I/;
    const reV = /^V/;
    const phaseTitle = "Phase [rad]"
    const currentTitle = "Current [μA]"
    const voltageTitle = "Voltage [μV]"
    const xaxis = {
        title: "Time [ns]",
        showexponent: 'all',
        exponentformat: 'e'
    }
    const font = {
        family: "Times New Roman"
    }
    let layout = (unit) => {
        return {
            xaxis: xaxis,
            yaxis: {
                title: unit,
            },
            font: font
        }
    }
    let phaseData = []
    let currentData = []
    let voltageData = []
    let unit
    let phaseLayout = {
        xaxis: xaxis,
        yaxis: {
            title: phaseTitle,
            tickvals: [],
            ticktext: [],
            tickmode: "array",
            tickangle: "auto"
        },
        font: font
    }
    let resolve = await getCsvResultFromSimulation(csvFilePath);
    name = resolve[0];
    resolve.shift();
    name.shift();
    const transposed = transpose(resolve);
    time = transposed[0].map(val => val * 1e9)
    value = transposed
    value.shift();
    for (i = 0; i < name.length; i++) {
        if (reP.test(name[i])) {
            pFlag = 1
        }
        if (reI.test(name[i])) {
            iFlag = 1
        }
        if (reV.test(name[i])) {
            vFlag = 1
        }
    }
    for (i = 0; i < name.length; i++) {
        trace = {
            x: time,
            y: value[i],
            name: name[i],
            type: 'scatter',
        };
        data.push(trace)
    }


    for (i = 0; i < name.length; i++) {
        if (reP.test(name[i])) {
            data[i].y = data[i].y.map((val) => {
                return val / Math.PI
            })
            phaseData.push(data[i])
        } else if (reI.test(name[i])) {
            data[i].y = data[i].y.map((val) => {
                return val * 1e6
            })
            currentData.push(data[i])
        } else if (reV.test(name[i])) {
            data[i].y = data[i].y.map((val) => {
                return val * 1e6
            })
            voltageData.push(data[i])
        }
    }
    let phaseMaxes = []
    let phaseMins = []
    const aryMax = function (a, b) { return Math.max(a, b) }
    const aryMin = function (a, b) { return Math.min(a, b) }
    for (i = 0; i < Object.keys(phaseData).length; i++) {
        phaseMaxes.push(phaseData[i].y.reduce(aryMax))
        phaseMins.push(phaseData[i].y.reduce(aryMin))
    }
    const phaseMax = Math.trunc(phaseMaxes.reduce(aryMax))
    const phaseMin = Math.trunc(phaseMins.reduce(aryMin))
    for (i = phaseMin; i <= phaseMax; i++) {
        phaseLayout.yaxis.tickvals.push(i)
        let txt
        if (i == -1) {
            txt = `$-\\pi$`
        } else if (i == 0) {
            txt = `$0$`
        }
        else if (i == 1) {
            txt = `$\\pi$`
        } else {
            txt = `$${String(i)}\\pi$`
        }
        phaseLayout.yaxis.ticktext.push(txt)
    }
    let phaseDataScript = `
        Plotly.newPlot(
            "out0",
            ${JSON.stringify(phaseData)},
            ${JSON.stringify(phaseLayout)},
            {"responsive":true}
        )`;
    unit = currentTitle
    let currentDataScript = `
        Plotly.newPlot(
            "out1",
            ${JSON.stringify(currentData)},
            ${JSON.stringify(layout(unit))},
            {"responsive":true}
        )`;
    unit = voltageTitle
    let vonltageDataScript = `
        Plotly.newPlot(
            "out2",
            ${JSON.stringify(voltageData)},
            ${JSON.stringify(layout(unit))},
            {"responsive":true}
        )`;
    if (pFlag) {
        htmlScript += phaseDataScript
    }
    if (iFlag) {
        htmlScript += currentDataScript
    }
    if (vFlag) {
        htmlScript += vonltageDataScript
    }
    return htmlScript


}
