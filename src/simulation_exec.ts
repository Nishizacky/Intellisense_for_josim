'use strict';
import { exec } from 'child_process';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from "path";
import * as csv from '@fast-csv/parse';
import * as util from './util';
import * as zstd from 'zstd.ts';


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



export async function showSimulationResult(uri: vscode.Uri, previewFlag: boolean): Promise<void> {
    let fspath = uri.fsPath
    if (fspath.includes(" ")) {
        let suggest = fspath.replaceAll(" ", "_")
        let message = "Josim file name should not have 'space', please rename it.\nsuggested: " + suggest
        vscode.window.showErrorMessage(message)
    } else {
        let tmp = await util.getFileNamesInFolder(path.join(path.dirname(fspath), "josim_resultCSV"))
        console.log(tmp);
        
        util.autoDeleteTmpFiles(tmp)
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
                    } catch (err) {
                        console.error(`Failed to kill process ${pid}:`, err);
                    }
                }
                return
            });
            progress.report({ increment: 0 });
            progress.report({ increment: 10, message: "Simulation progressing" });
            let resultFilePath = await simulation_exec(fspath);
            progress.report({ increment: 20, message: "Exporting output file" });
            let result_html = await simulationResult2html(resultFilePath,progress);
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
    const y = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const minu = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    const timestump = `${y}${mm}${dd}_${hh}${minu}${ss}`
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
            fs.writeFileSync(outputFilePath.replace(".csv", ".jsm"), fs.readFileSync(fspath, 'utf-8'));
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
const config = {
    "responsive": true,
    'modeBarButtonsToRemove': ['toImage'],
    "editable": true
};

async function simulationResult2html(csvFilePath: any, progress: any) {
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
    const currentTitle = "Current [A]"
    const voltageTitle = "Voltage [V]"
    load_config()
    const xaxisLabelPrefixUnit = prefixUnit.substr(0, 1)
    const xaxis = {
        title: "Time [" + xaxisLabelPrefixUnit + "s]",
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
            tickformat: "e",
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

    progress.report({ increment: 30, message: "Extracting data from " + csvFilePath + ": " + fs.statSync(csvFilePath).size + " bytes" });
    let resolve = await getCsvResultFromSimulation(csvFilePath);
    // @ts-expect-error TS(2571): Object is of type 'unknown'.
    name = resolve[0];
    // @ts-expect-error TS(2571): Object is of type 'unknown'.
    resolve.shift();
    name.shift();
    progress.report({ increment: 40, message: "Transposing data" });
    const transposed = transpose(resolve);
    progress.report({ increment: 50, message: "Processing data scale" });
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
    progress.report({ increment: 60, message: "Mapping data" });
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
                return val
            })
            currentData.push(data[i])
        } else if (reV.test(name[i])) {
            // @ts-expect-error TS(2304): Cannot find name 'i'.
            data[i].y = data[i].y.map((val: any) => {
                return val
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
        phaseDataScript = `var phaseData=[];for(let i=0;i<data.length;i++){if(data[i].name.startsWith("P")){phaseData.push(data[i])}} Plotly.newPlot("phasePlot",phaseData,${JSON.stringify(phaseLayout)},${JSON.stringify(config)});`;
        htmlScript += phaseDataScript
        divScript += `<div id="phasePlot"></div><button onclick="saveAsImage('phasePlot')">↑Save as ${toImageFormat}</button>`
    }
    if (iFlag > 0) {
        unit = currentTitle
        currentDataScript = `var currentData=[];for(let i=0;i<data.length;i++){if(data[i].name.startsWith("I")){currentData.push(data[i])}} Plotly.newPlot("currentPlot",currentData,${JSON.stringify(layout(unit))},${JSON.stringify(config)});`;
        htmlScript += currentDataScript
        divScript += ` <div id="currentPlot"></div><button onclick="saveAsImage('currentPlot')">↑Save as ${toImageFormat}</button>`
    }
    if (vFlag > 0) {
        unit = voltageTitle
        vonltageDataScript = `var voltageData=[];for(let i=0;i<data.length;i++){if(data[i].name.startsWith("V")){voltageData.push(data[i])}} Plotly.newPlot("voltagePlot",voltageData,${JSON.stringify(layout(unit))},${JSON.stringify(config)});`;
        htmlScript += vonltageDataScript
        divScript += `<div id="voltagePlot"></div><button onclick="saveAsImage('voltagePlot')">↑Save as ${toImageFormat}</button>`
    }
    progress.report({ increment: 70, message: "Compressing data" });
    let compressedData64 = "";
    try{
        const compressedData = await zstd.compress({ input: JSON.stringify(data) , compressLevel: 2});
        compressedData64 = compressedData.toString('base64');
    }catch(e){
        vscode.window.showErrorMessage("Compression failed: " + (e instanceof Error ? e.message : String(e)));
    }
    let selectData = `Plotly.newPlot("mixPlot",${JSON.stringify([])},${JSON.stringify(layout(unit))},${JSON.stringify(config)});`;
    htmlScript += selectData;
    let mixDataScript = `function rewritePlot(){var xname=document.getElementById("xaxisSelect").value;var yname=document.getElementById("yaxisSelect").value;var xData,yData;for(var i=0;i<data.length;i++){if(data[i].name==xname){xData=data[i].y} if(data[i].name==yname){yData=data[i].y}} var trace={x:xData,y:yData,type:'scatter'};var layout={xaxis:{title:xname},yaxis:{title:yname}};Plotly.newPlot('mixPlot',[trace],layout,${JSON.stringify(config)})};`;
    htmlScript += mixDataScript;
    let select = [];
    select.push(`<option value="" selected disabled hidden>Select trace</option>`);
    for (let i = 0; i < name.length; i++) {
        select.push(`<option value="${name[i]}">${name[i]}</option>`);
    }

    divScript += `<div id="mixPlot"></div><label> X-axis </label><select id="xaxisSelect" onchange="rewritePlot()">${select.join("")}</select><label> Y-axis </label><select id="yaxisSelect" onchange="rewritePlot()">${select.join("")}</select><button onclick="saveAsImage('mixPlot')">↑Save as ${toImageFormat}</button>`;

    const showdata = {
        script: htmlScript,
        div: divScript
    }
    const saveImageConfig = `{format: '${toImageFormat}' , width: ${downloadImageWidth}, height: ${downloadImageHeight}}`
    const result_html = `<!doctype html><script src="https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS-MML_SVG"></script><script src=https://cdn.plot.ly/plotly-latest.min.js></script><script src=https://unpkg.com/fzstd></script><script src=https://cdn.jsdelivr.net/npm/fzstd/umd/index.js></script>${showdata.div}<script>const compressedData64='${compressedData64}';const binStr=atob(compressedData64);const charCodes=new Uint8Array(binStr.length);for(let i=0;i<binStr.length;i++)charCodes[i]=binStr.charCodeAt(i);const decompressed=new TextDecoder().decode(fzstd.decompress(charCodes));const data=JSON.parse(decompressed);${showdata.script} function saveAsImage(id){var plotlyGraph=document.getElementById(id);Plotly.toImage(plotlyGraph,${saveImageConfig}).then(function(url){var a=document.createElement('a');a.href=url;a.download='plot.${toImageFormat}';a.click()})}</script>`;
    const outputHtmlPath = csvFilePath.replace(".csv", ".html");
    progress.report({ increment: 80, message: "Writing HTML file" });
    fs.writeFileSync(outputHtmlPath, result_html.replace("<!DOCTYPE html>\n", ""));
    return result_html
}

