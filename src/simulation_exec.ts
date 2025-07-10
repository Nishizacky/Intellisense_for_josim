'use strict';
import { exec } from 'child_process';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from "path";
import * as csv from '@fast-csv/parse';
function load_config() {
    saveImage = vscode.workspace.getConfiguration('saveImage');
    toImageFormat = saveImage.get('Format');
    downloadImageWidth = saveImage.get('Width');
    downloadImageHeight = saveImage.get('Height')
    downloadImageFontSize = saveImage.get('fontsize')
    tmpFiles = vscode.workspace.getConfiguration("tmpFiles")
    saveCount = tmpFiles.get("saveCount")
    graphConfig = vscode.workspace.getConfiguration("graph")
    prefixUnit = graphConfig.get("timescale") as string
    preview = vscode.workspace.getConfiguration("preview")
    reuseWindow = vscode.workspace.getConfiguration("preview").get("reuseWindow")
}
let saveImage = vscode.workspace.getConfiguration('saveImage');
let toImageFormat = saveImage.get('Format');
let downloadImageWidth = saveImage.get('Width');
let downloadImageHeight = saveImage.get('Height')
let downloadImageFontSize = saveImage.get('fontsize')
let tmpFiles = vscode.workspace.getConfiguration("tmpFiles")
let saveCount = tmpFiles.get("saveCount")
let graphConfig = vscode.workspace.getConfiguration("graph")
let prefixUnit = graphConfig.get("timescale") as string
let preview = vscode.workspace.getConfiguration("preview")
let reuseWindow = preview.get("reuseWindow")

let josimProcessPid = [] as number[]

let currentWebviewPanel: vscode.WebviewPanel | undefined;
export let allWebviewPanels: vscode.WebviewPanel[] = [];


// ローディングアニメーション
const loadingHtml = `
<div id="loading-overlay" style="
    width:100vw;height:100vh;
    background:rgba(34,34,34,0.4);
    position:fixed;top:0;left:0;z-index:9999;
    display:flex;align-items:center;justify-content:center;
">
    <div style="
        border: 8px solid #f3f3f3;
        border-top: 8px solid #3498db;
        border-radius: 50%;
        width: 60px;
        height: 60px;
        animation: spin 1s linear infinite;
    "></div>
</div>
<style>
    @keyframes spin {
        0% { transform: rotate(0deg);}
        100% { transform: rotate(360deg);}
    }
</style>
`;

export async function showSimulationResult(uri: vscode.Uri, previewFlag: boolean): Promise<void> {
    let fspath = uri.fsPath
    if (preview.get("reuseWindow") == "" && previewFlag) {
        const selection = await vscode.window.showQuickPick(
            ["Reuse existing window", "Always open new window"],
            { placeHolder: "How do you want to show the preview window?" }
        );
        if (selection === "Reuse existing window") {
            preview.update('reuseWindow', "reuse");
        } else if (selection === "Always open new window") {
            preview.update('reuseWindow', "create");
        }
    }
    if (fspath.includes(" ")) {
        let suggest = fspath.replaceAll(" ", "_")
        let message = "Josim file name should not have 'space', please rename it.\nsuggested: " + suggest
        vscode.window.showErrorMessage(message)
    } else {
        if (currentWebviewPanel != undefined && previewFlag) {
            currentWebviewPanel.webview.html += loadingHtml;
            currentWebviewPanel.reveal(undefined, true);
        }
        let tmp = await getFileNamesInFolder(path.join(path.dirname(fspath), "josim_resultCSV"))
        autoDeleteTmpFiles(tmp)
        //マージンを取る時もこれより下の部分を書き換えれば対応できる。
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "",
            cancellable: true
        }, async (progress: any, token: any) => {
            token.onCancellationRequested(() => {
                if (josimProcessPid.length > 0) {
                    const pid = josimProcessPid.pop() as number;
                    console.log("pid = ", pid);
                    try {
                        process.kill(pid);
                        console.log(`Process ${pid} was terminated`);
                        if (currentWebviewPanel != undefined && previewFlag) {
                            currentWebviewPanel.webview.html = currentWebviewPanel.webview.html.replace(loadingHtml, "");
                            currentWebviewPanel.reveal(undefined, true)
                        }

                    } catch (err) {
                        console.error(`Failed to kill process ${pid}:`, err);
                    }
                }
                return
            });
            progress.report({ increment: 0 });
            progress.report({ increment: 10, message: "Simulation progressing" });
            let resultFilePath = await simulation_exec(fspath);
            progress.report({ increment: 70, message: "Exporting output file" });
            let result_html = await simulationResult2html(resultFilePath);
            if (previewFlag) {
                progress.report({ increment: 80, message: "Loading HTML" });
                ShowPlotDraw(result_html, fspath)
            } else {
                progress.report({ increment: 100, message: "Simulation done!" });
            }
        });
    }


}

async function simulation_exec(fspath: any) {
    let filePath = path.parse(fspath).base;
    if (filePath.includes(' ')) {
        vscode.window.showInformationMessage("filename should not contain ' '.");
    }
    filePath = path.join(path.parse(fspath).dir, "josim_resultCSV")
    fs.mkdir(filePath, (err: any) => {
        if (err) { throw "err: " + err }
    })
    const date = new Date();
    const timestump = String(date.getFullYear()) + String(date.getMonth() + 1) + String(date.getDate()) + "_" + String(date.getHours()) + String(date.getMinutes()) + String(date.getSeconds())
    const outputFilePath = path.join(filePath, 'jsm_out' + "_" + timestump + '.csv');
    const string_for_exec = 'josim-cli ' + fspath + ' -o ' + outputFilePath + ' -m'
    return new Promise((resolve, reject) => {
        const child = exec(string_for_exec, (err, stdout, stderr) => {
            if (err) {
                if (stderr.includes("Terminated")) {
                    reject(vscode.window.showInformationMessage("Simulation ", stderr));
                } else {
                    reject(vscode.window.showErrorMessage(stderr));
                }
            }
            resolve(outputFilePath)
        });
        if (child.pid !== undefined) {
            josimProcessPid.push(child.pid + 1);
        }
    })
}
function ShowPlotDraw(result_html: any, filename: any) {
    let name = path.parse(filename).name
    const panelTitle = `Plot-result: ${name}`
    // 既存のパネルがある場合はHTMLを更新
    reuseWindow = preview.get("reuseWindow")
    if (currentWebviewPanel != undefined && reuseWindow == "reuse") {
        setTimeout(() => {
            if (currentWebviewPanel != undefined) {
                currentWebviewPanel.title = panelTitle;
                currentWebviewPanel.webview.html = result_html;
                currentWebviewPanel.reveal(undefined, true); // パネルをアクティブにする
            }
        }, 150)
        allWebviewPanels.push(currentWebviewPanel);
    } else if (reuseWindow == "create" || currentWebviewPanel == undefined) {
        // 新しいパネルを作成
        currentWebviewPanel = vscode.window.createWebviewPanel(
            "plotData",
            panelTitle,
            {
                viewColumn: vscode.ViewColumn.Two,
                preserveFocus: true
            },
            {
                enableScripts: true
            }
        );

        currentWebviewPanel.webview.html = result_html;
        allWebviewPanels.push(currentWebviewPanel);
    } else {
        preview.update("reuseWindow", "")
    }

    currentWebviewPanel.onDidDispose(() => {
        currentWebviewPanel = undefined;
    });
}

function getCsvResultFromSimulation(csvFilePath: any) {
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(csvFilePath)
            .pipe(csv.parse());
        stream.on('error', (error: any) => reject(error));
        const data: any = [];
        stream.on('data', (chunk: any) => data.push(chunk));
        stream.on('end', () => resolve(data));
    });
}

const transpose = (a: any) => a[0].map((_: any, c: any) => a.map((r: any) => r[c]));

async function simulationResult2html(csvFilePath: any) {
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
    load_config()
    const xaxisLabelPrefixUnit = prefixUnit.substr(0, 1)
    const xaxis = {
        title: "Time [" + xaxisLabelPrefixUnit + "s]",
        showexponent: 'all',
        exponentformat: 'e'
    }
    const font = {
        family: "Times New Roman",
        size: downloadImageFontSize
    }
    let layout = (unit: any) => {
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
    // @ts-expect-error TS(2571): Object is of type 'unknown'.
    name = resolve[0];
    // @ts-expect-error TS(2571): Object is of type 'unknown'.
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
    time = transposed[0].map((val: any) => val * digitLength)
    value = transposed
    value.shift();
    let i = 0
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
            // @ts-expect-error TS(2322): Type '{ x: any; y: any; name: any; type: string; }... Remove this comment to see the full error message
            x: time,
            y: value[i],
            name: name[i],
            type: 'scatter',
        };
        data.push(trace)
    }

    for (i = 0; i < name.length; i++) {
        if (reP.test(name[i])) {
            // @ts-expect-error TS(2304): Cannot find name 'i'.
            data[i].y = data[i].y.map((val: any) => {
                return val / Math.PI
            })
            phaseData.push(data[i])
        } else if (reI.test(name[i])) {
            // @ts-expect-error TS(2304): Cannot find name 'i'.
            data[i].y = data[i].y.map((val: any) => {
                return val * digitLength
            })
            currentData.push(data[i])
        } else if (reV.test(name[i])) {
            // @ts-expect-error TS(2304): Cannot find name 'i'.
            data[i].y = data[i].y.map((val: any) => {
                return val * digitLength
            })
            voltageData.push(data[i])
        }
    }

    if (pFlag > 0) {
        const aryMax = function (a: any, b: any) { return Math.max(a, b) }
        const aryMin = function (a: any, b: any) { return Math.min(a, b) }
        for (let i = 0; i < Object.keys(phaseData).length; i++) {
            // @ts-expect-error TS(2304): Cannot find name 'i'.
            phaseMaxes.push(phaseData[i].y.reduce(aryMax))
            // @ts-expect-error TS(2304): Cannot find name 'i'.
            phaseMins.push(phaseData[i].y.reduce(aryMin))
        }
        const phaseMax = Math.trunc(phaseMaxes.reduce(aryMax))
        const phaseMin = Math.trunc(phaseMins.reduce(aryMin))
        for (let i = phaseMin; i <= phaseMax; i++) {
            phaseLayout.yaxis.tickvals.push(<never>i)
            let txt
            if (i == -1) {
                txt = "\u{1D70B}"
            } else if (i == 0) {
                txt = "0"
            }
            else if (i == 1) {
                txt = "\u{1D70B}"
            } else {
                txt = `${String(i)}\u{1D70B}`
            }
            txt = txt + '\t'
            phaseLayout.yaxis.ticktext.push(<never>txt)
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
        <script src="https://cdn.plot.ly/plotly-latest.min.js" ></script>
        </head>
        <body>
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
        </body>
    </html>
  `;
    const outputHtmlPath = csvFilePath.replace(".csv", ".html");
    fs.writeFileSync(outputHtmlPath, result_html.replace("<!DOCTYPE html>\n", ""));
    return result_html
}

async function getFileNamesInFolder(folderPath: any) {
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

async function autoDeleteTmpFiles(filenames: any) {
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
            fs.unlinkSync(fname)
        })

    }
    // console.log(noDuplicates);
}