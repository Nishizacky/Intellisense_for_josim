const { exec } = require('child_process')
const vscode = require("vscode")
const fs = require('fs')
const path = require("path")
const csv = require('csv')
const { exit } = require('process')
const saveImage = vscode.workspace.getConfiguration('saveImage');
const toImageFormat = saveImage.get('Format');
const downloadImageWidth = saveImage.get('Width');
const downloadImageHeight = saveImage.get('Height')
const downloadImageFontSize = saveImage.get('fontsize')
const tmpFiles = vscode.workspace.getConfiguration("tmpFiles")
const saveCount = tmpFiles.get("saveCount")
const graphConfig = vscode.workspace.getConfiguration("graph")
const prefixUnit = graphConfig.get("timescale")

exports.showSimulationResult = async function (uri) {
    let fspath = uri.fsPath
    if (fspath.includes(" ")) {
        let suggest = fspath.replaceAll(" ","_")
        let message = "Josim file name should not have 'space', please change it.\nsuggested: "+suggest
        vscode.window.showErrorMessage(message)
    } else {
        let tmp = await getFileNamesInFolder(path.dirname(fspath) + "/josim_resultCSV")
        autoDeleteTmpFiles(tmp)
        //マージンを取る時もこれより下の部分を書き換えれば対応できる。
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "",
            cancellable: true
        }, async (progress, token) => {
            token.onCancellationRequested(() => {
                console.log("User canceled the long running operation");
            });
            progress.report({ increment: 0 });
            progress.report({ increment: 10, message: "Simulation progressing" });
            let resultFilePath = await simulation_exec(fspath);
            progress.report({ increment: 70, message: "Exporting output file" });
            let result_html = await simulationResult2html(resultFilePath);
            progress.report({ increment: 80, message: "Loading HTML" });
            ShowPlotDraw(result_html)
        })
    }


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
    const timestump = String(date.getHours()) + String(date.getMinutes()) + String(date.getSeconds()) + "_" + String(date.getMonth() + 1) + String(date.getDate()) + "_" + String(date.getFullYear())
    const outputFilePath = filePath + '/jsm_out' + "_" + timestump + '.csv';
    const string_for_exec = 'josim-cli ' + fspath + ' -o ' + outputFilePath + ' -m'
    return new Promise((resolve, reject) => {
        exec(string_for_exec, (err, stdout, stderr) => {
            if (err) {

                reject(vscode.window.showErrorMessage(stderr));
            }
            resolve(outputFilePath)
        })
    })
}

function ShowPlotDraw(result_html) {
    //返り値はhtmlの文章に使う
    let panel = vscode.window.createWebviewPanel(
        "plotData",
        "Plot-result",
        vscode.ViewColumn.One,
        {
            enableScripts: true,
        }
    );

    panel.webview.html = result_html
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

async function simulationResult2html(csvFilePath) {
    let htmlScript = " ";
    let divScript = " ";
    let unit;
    let phaseDataScript = " ";
    let currentDataScript = " ";
    let vonltageDataScript = " ";
    let time = [];
    let value = [];
    let trace = [];
    let name = [];
    let data = [];
    let phaseData = []
    let currentData = []
    let voltageData = []
    let phaseMaxes = []
    let phaseMins = []
    let pFlag = 0;
    let iFlag = 0;
    let vFlag = 0;
    const reP = /^P/;
    const reI = /^I/;
    const reV = /^V/;
    const phaseTitle = "Phase [rad]"
    const currentTitle = "Current [μA]"
    const voltageTitle = "Voltage [μV]"
    
    xaxisLabelPrefixUnit = prefixUnit.substr(0,1)
    console.log(prefixUnit);
    console.log(xaxisLabelPrefixUnit);
    const xaxis = {
        title: "Time ["+xaxisLabelPrefixUnit+"s]",
        showexponent: 'all',
        exponentformat: 'e'
    }
    const font = {
        family: "Times New Roman",
        size: downloadImageFontSize
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


    const config = {
        "responsive": true,
        'modeBarButtonsToRemove': ['toImage'],
        "editable": true
    }
    let resolve = await getCsvResultFromSimulation(csvFilePath);
    name = resolve[0];
    resolve.shift();
    name.shift();
    const transposed = transpose(resolve);
    let digitLength = 0
    switch (xaxisLabelPrefixUnit) {
        case "m":
            digitLength = 1e3
            break;
        case "u":
            digitLength = 1e6
            break;
        case "n":
            digitLength = 1e9
            break;
        case "p":
            digitLength = 1e12
            break;
        case "f":
            digitLength = 1e15
            break;
        default:
            break;
    }
    time = transposed[0].map(val => val * digitLength)
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

    if (pFlag > 0) {
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
        phaseDataScript = `
        Plotly.newPlot(
            "phasePlot",
            ${JSON.stringify(phaseData)},
            ${JSON.stringify(phaseLayout)},
            ${JSON.stringify(config)}
        )
        `;
        htmlScript += phaseDataScript
        divScript += `<div id="phasePlot"></div>
        <button onclick="saveAsImage('phasePlot')">↑Save as ${toImageFormat}</button>
        `
    }
    if (iFlag > 0) {
        unit = currentTitle
        currentDataScript = `
        Plotly.newPlot(
            "currentPlot",
            ${JSON.stringify(currentData)},
            ${JSON.stringify(layout(unit))},
            ${JSON.stringify(config)}
        )
        `;
        htmlScript += currentDataScript
        divScript += ` <div id="currentPlot"></div>
        <button onclick="saveAsImage('currentPlot')">↑Save as ${toImageFormat}</button>
        `
    }
    if (vFlag > 0) {
        unit = voltageTitle
        vonltageDataScript = `
        Plotly.newPlot(
            "voltagePlot",
            ${JSON.stringify(voltageData)},
            ${JSON.stringify(layout(unit))},
            ${JSON.stringify(config)}
        )
        `;
        htmlScript += vonltageDataScript
        divScript += `<div id="voltagePlot"></div>
        <button onclick="saveAsImage('voltagePlot')">↑Save as ${toImageFormat}</button>
        `
    }
    const showdata = {
        script: htmlScript,
        div: divScript
    }
    const saveImageConfig = `{format: '${toImageFormat}' , width: ${downloadImageWidth}, height: ${downloadImageHeight}}`
    const result_html = `<!DOCTYPE html>
    <html>
        <head>
            <script src="https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS-MML_SVG"></script>
            <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
        </head>
        ${showdata.div}
        <script>
            ${showdata.script}
            function saveAsImage(id) {
                var plotlyGraph = document.getElementById(id);
                Plotly.toImage(plotlyGraph,${saveImageConfig})
                    .then(function (url) {
                        var a = document.createElement('a');
                        a.href = url;
                        a.download = 'plot.${toImageFormat}';
                        a.click();
                    });
            }
        </script>
    </html>
  `;
    const outputHtmlPath = csvFilePath.replace(".csv", ".html");
    fs.writeFileSync(outputHtmlPath, result_html.replace("<!DOCTYPE html>\n", ""));
    return result_html
}

async function getFileNamesInFolder(folderPath) {
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
        let returnArray = []
        sortedFiles.forEach(file => {
            returnArray.push(file.filePath)
        })
        return returnArray;
    } catch (error) {
        console.error('Error occurred while getting file names:', error);
        return [];
    }
}

async function autoDeleteTmpFiles(filenames) {
    let basenameArray = []
    let noDuplicates = []
    filenames.forEach(file => {
        basenameArray.push(file.replace(/\..+/, ""))
    })
    noDuplicates = Array.from(new Set(basenameArray))

    for (i = saveCount - 1; i < noDuplicates.length; i++) {
        let regexSource = noDuplicates[i] + "\..+"
        let re = new RegExp(regexSource)
        filenames.filter(function (value) { return value.match(re) }).forEach(fname => {
            fs.unlinkSync(fname)
        })

    }
    console.log(noDuplicates);
}