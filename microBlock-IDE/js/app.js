let extensionList = [ ];
let projectFilePath = null;
let saveAsFlag = false;

const rememberRecentProject = filePath => {
    if (!isElectron || !filePath) return;

    let recentPaths = [];
    try {
        recentPaths = JSON.parse(localStorage.getItem("recentProjectPaths") || "[]");
        if (!Array.isArray(recentPaths)) recentPaths = [];
    } catch (error) {
        recentPaths = [];
    }
    recentPaths = [filePath, ...recentPaths.filter(item => item !== filePath)].slice(0, 8);
    localStorage.setItem("recentProjectPaths", JSON.stringify(recentPaths));
    if (typeof globalThis.refreshApplicationMenu === "function") {
        globalThis.refreshApplicationMenu();
    }
};

var blocklyWorkspace;

let updateBlockCategory = async () => {
    if (isEmbed) return;

    var categoryIconList = [];
    let toolboxTextXML = `<xml xmlns="https://developers.google.com/blockly/xml">`;

    const board = boards.find(board => board?.id === boardId);
    const level = board?.level?.find(level => level.name === levelName);
    const toolboxTree = level?.blocks || blocksTree;
    // blockTree
    for (let category of toolboxTree) {
        toolboxTextXML += `<category name="${category.name}" colour="${category.color}"${typeof category.blocks === "string" ? ` custom="${category.blocks}"` : ''}>`;
        if (typeof category.blocks === "object") {
            for (let block of category.blocks) {
                if (typeof block === "object") {
                    toolboxTextXML += block.xml;
                } else {
                    if (typeof Blockly.Blocks[block] !== "undefined") {
                        if (typeof Blockly.Blocks[block].xml !== "undefined") {
                            toolboxTextXML += Blockly.Blocks[block].xml;
                        } else {
                            toolboxTextXML += `<block type="${block}"></block>`;
                        }
                    } else {
                        console.warn(block, "undefined, forget add blocks_xxx.js ?");
                    }
                }
            }
        } else if (typeof category.blocks === "function") {
            let xmlList = category.blocks(blocklyWorkspace);
            for (let xml of xmlList) {
                toolboxTextXML += Blockly.Xml.domToText(xml);
            }
        }
        toolboxTextXML += `</category>`;
        categoryIconList.push(category.icon.startsWith("/") ? rootPath + category.icon : `${rootPath}/boards/${boardId}/${category.icon}`);
    }

    // Extenstion
    extenstionTree = [];
    for (const extensionId of fs.ls("/extension")) {
        const extensionPath = `/extension/${extensionId}/extension.js`;
        const extension = await evaluateJavaScriptExpression(fs.read(extensionPath), extensionPath);
        if (board?.isArduinoPlatform && (!extension?.supportArduinoPlatform)) { // Skip if select board arduino but extension not support arduino
            continue;
        }
        extenstionTree.push(extension);
        categoryIconList.push(fs.read(`/extension/${extensionId}/${extension.icon}`));
    }
    if (isElectron) {
        let extensionDir = sharedObj.extensionDir;
        for (const extensionId of nodeFS.ls(extensionDir)) {
            const extensionPath = `${extensionDir}/${extensionId}/extension.js`;
            const extensionSource = (await readFileAsync(extensionPath)).toString();
            const extension = await evaluateJavaScriptExpression(extensionSource, extensionPath);
            extenstionTree.push(extension);
            const iconPath = path.join(extensionDir, extensionId, extension.icon);
            categoryIconList.push(await readFileAsDataURL(iconPath));
        }
    }

    for (let category of extenstionTree) {
        toolboxTextXML += `<category name="${category.name}" colour="${category.color}"${typeof category.blocks === "string" ? ` custom="${category.blocks}"` : ''}>`;
        if (typeof category.blocks === "object") {
            for (let block of category.blocks) {
                if (typeof block === "object") {
                    toolboxTextXML += block.xml;
                } else {
                    if (typeof Blockly.Blocks[block] !== "undefined") {
                        if (typeof Blockly.Blocks[block].xml !== "undefined") {
                            toolboxTextXML += Blockly.Blocks[block].xml;
                        } else {
                            toolboxTextXML += `<block type="${block}"></block>`;
                        }
                    } else {
                        console.warn(block, "undefined, forget add blocks_xxx.js ?");
                    }
                }
            }
        } else if (typeof category.blocks === "function") {
            let xmlList = category.blocks(blocklyWorkspace);
            for (let xml of xmlList) {
                toolboxTextXML += Blockly.Xml.domToText(xml);
            }
        }
        toolboxTextXML += `</category>`;
    }

    toolboxTextXML += `</xml>`;

    let toolboxXML = Blockly.utils.xml.textToDom(toolboxTextXML);

    blocklyWorkspace.updateToolbox(toolboxXML);
    /* blocklyWorkspace.scrollbar.resize(); */

    for (const [index, element] of Object.entries($("span.blocklyTreeIcon"))) {
        if (typeof element === "object" && element.nodeType !== undefined) {
            $(element).append(`<img src="${categoryIconList[index]}" alt="">`);
        }
    }
};

Blockly.triggleResize = function(e) {
    // Compute the absolute coordinates and dimensions of blocklyArea.
    var element = blocklyArea;
    var x = 0;
    var y = 0;
    do {
        x += element.offsetLeft;
        y += element.offsetTop;
        element = element.offsetParent;
    } while (element);
    // Position blocklyDiv over blocklyArea.
    blocklyDiv.style.left = x + 'px';
    blocklyDiv.style.top = y + 'px';
    blocklyDiv.style.width = blocklyArea.offsetWidth + 'px';
    blocklyDiv.style.height = blocklyArea.offsetHeight + 'px';
    Blockly.svgResize(blocklyWorkspace);
};

let embedOption = {
    id: "",
    width: 0,
    height: 0,
    blockOnly: 0,
    fit: 0
};

if (isEmbed) {
    $(".page").addClass("embed");
    $(".page > .main > footer").hide();
    $(".top-bar-button").hide();
    $(".blocklyToolboxDiv").hide();
    $(".embed-only").show();

    $("#embed-edit").click(() => {
        const editURL = new URL(window.location.href);
        editURL.searchParams.delete("embed");
        editURL.searchParams.delete("id");
        editURL.searchParams.delete("width");
        editURL.searchParams.delete("height");
        editURL.searchParams.delete("blockOnly");
        editURL.searchParams.delete("fit");
        window.open(editURL.toString(), "_blank");
    });

    let allParams = { };
    for (let p of pageParams) {
        allParams[p[0]] = ((v) => {
            if (v.indexOf("%") > 0) return v;
            return parseInt(v) || 0;
        })(p[1]);
    }
    embedOption = Object.assign(embedOption, allParams);

    if (embedOption.blockOnly == 1) {
        $(".page > .main > header").hide();
        // blocklyWorkspace.scrollbar.dispose();
        // blocklyWorkspace.zoomControls_.dispose();
        // blocklyWorkspace.zoomControls_.svgGroup_.remove();
    }

    // Blockly.triggleResize();
}

var blocklyArea = document.getElementById('blocklyArea');
var blocklyDiv = document.getElementById('blocklyDiv');

const blocklySoundSettingKey = "blocklySoundsEnabled";
let blocklySoundsEnabled = localStorage.getItem(blocklySoundSettingKey) !== "false";
const playBlocklySound = Blockly.WorkspaceAudio.prototype.play;

Blockly.WorkspaceAudio.prototype.play = function(name, volume) {
    if (blocklySoundsEnabled) {
        return playBlocklySound.call(this, name, volume);
    }
};

const updateSoundToggle = () => {
    const button = document.getElementById("toggle-sound");
    if (!button) return;

    const tooltip = blocklySoundsEnabled ? "Turn Sound Off" : "Turn Sound On";
    button.setAttribute("data-tippy-content", tooltip);
    button.setAttribute("aria-label", tooltip);
    button.setAttribute("aria-pressed", String(!blocklySoundsEnabled));
    button.querySelector("i").className = blocklySoundsEnabled ? "fas fa-volume-up" : "fas fa-volume-mute";

    if (button._tippy) {
        button._tippy.setContent(tooltip);
    }
};

$("#toggle-sound").click(() => {
    blocklySoundsEnabled = !blocklySoundsEnabled;
    localStorage.setItem(blocklySoundSettingKey, String(blocklySoundsEnabled));
    updateSoundToggle();
});

updateSoundToggle();

blocklyWorkspace = Blockly.inject(blocklyDiv, {
    media: 'blockly/media/',
    toolbox: document.getElementById('toolbox'),
    grid : {
		spacing : 25, 
		length : 1, 
		colour : '#888', 
		snap : true
    },
    trashcan : true,
    zoom: {
        controls: true,
        wheel: false,
        startScale: 1,
        maxScale: 2.5,
        minScale: 0.3,
        scaleSpeed: 1.05
    },
    scrollbars : (isEmbed && embedOption.blockOnly) ? false : true,
    comments : true, 
	disable : true, 
    maxBlocks : Infinity, 
    rtl : false, 
    oneBasedIndex : false, 
    sounds : true, 
    readOnly: isEmbed,

    /* Option */
    renderer: localStorage.getItem("renderer") || "geras",
});

const addFlyoutBottomPadding = (workspace, paddingPixels = 80) => {
    const flyout = workspace.getFlyout();
    if (!flyout) return;

    const flyoutWorkspace = flyout.getWorkspace();
    const metricsManager = flyoutWorkspace.getMetricsManager();
    if (metricsManager.hasExtraBottomPadding) return;

    const getScrollMetrics = metricsManager.getScrollMetrics.bind(metricsManager);
    metricsManager.getScrollMetrics = function(getWorkspaceCoordinates, viewMetrics, contentMetrics) {
        const metrics = getScrollMetrics(getWorkspaceCoordinates, viewMetrics, contentMetrics);
        const scale = getWorkspaceCoordinates ? (flyoutWorkspace.scale || 1) : 1;
        metrics.height += paddingPixels / scale;
        return metrics;
    };
    metricsManager.hasExtraBottomPadding = true;
    flyoutWorkspace.resizeContents();
};

addFlyoutBottomPadding(blocklyWorkspace);

const updateWorkspaceViewStatus = () => {
    $("#workspace-actual-size").text(`${Math.round(blocklyWorkspace.scale * 100)}%`);

    if (typeof pjson !== "undefined" && pjson.version) {
        $("#app-current-version").text(String(pjson.version));
    }
};

blocklyWorkspace.addChangeListener(updateWorkspaceViewStatus);
updateWorkspaceViewStatus();

const zoomWorkspaceByFivePercent = direction => {
    const currentScale = blocklyWorkspace.scale;
    const targetScale = Math.min(2.5, Math.max(0.3,
        Math.round((currentScale + (direction * 0.05)) * 100) / 100));
    if (targetScale === currentScale) return;

    const scaleSpeed = blocklyWorkspace.options.zoomOptions.scaleSpeed;
    const zoomAmount = Math.log(targetScale / currentScale) / Math.log(scaleSpeed);
    blocklyWorkspace.zoomCenter(zoomAmount);
    updateWorkspaceViewStatus();
};

if (!(isEmbed && embedOption.blockOnly)) {
    blocklyWorkspace.getParentSvg().addEventListener("wheel", event => {
        event.preventDefault();
        event.stopPropagation();
        zoomWorkspaceByFivePercent(event.deltaY < 0 ? 1 : -1);
    }, { passive: false, capture: true });
}

window.addEventListener('resize', Blockly.triggleResize, false);
Blockly.triggleResize();

/** Override Blockly.alert() with custom implementation. */
Blockly.dialog.setAlert((message, callback) => {
    Notiflix.Report.Info("Alert", message, "OK", callback);
});

/** Override Blockly.confirm() with custom implementation. */
Blockly.dialog.setConfirm((message, callback) => {
    Notiflix.Confirm.Show('Are you Confirm ?', message, 'Yes', 'No', function() {
        callback(true);
    },
    function() {
        callback(false);
    });
});

Notiflix.Confirm.Init({
    plainText: false
});

/** Override Blockly.prompt() with custom implementation. */
Blockly.dialog.setPrompt((message, defaultValue, callback) => {
    Notiflix.Confirm.Show("Prompt", `${message}<br><br><input type="text" id="prompt-input" value="${defaultValue}">`, 'OK', 'Cancle', function() {
        callback($("#prompt-input").val());
    },
    function() {
        callback(null);
    });
});

const selectRenderer = renderer => {
    localStorage.setItem("renderer", renderer);
    window.location.reload();
};

if (isElectron) {
    nodeFS.walk = (dir) => {
        return new Promise((resolve, reject) => {
            let files = [ ];
            dive(dir, (err, file) => {
                files.push(file);
            }, () => {
                resolve(files);
            });
        });
    };

    nodeFS.ls = (dir) => nodeFS.readdirSync(dir).filter(f => nodeFS.statSync(path.join(dir, f)).isDirectory());
}

file_name_select = "main.xml";

const updateWorkspace = () => {
    if (file_name_select.endsWith(".xml")) { // Update block
        const code = fs.read(`/${file_name_select}`);
        blocklyWorkspace.clear();
        $("#mode-select-switch > li[data-value='1']").click();
        if (code) {
            try {
                Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(code), blocklyWorkspace);
            } catch (e) {
                console.log(e);
            }
            blocklyWorkspace.scrollCenter();
        }
    }

    if (file_name_select.endsWith(".py")) {  // Update code
        const code = fs.read(`/${file_name_select}`);
        $("#mode-select-switch > li[data-value='2']").click();
        $(async () => {
            while(!editor) {
                await sleep(100);
            }
            editor.updateOptions({ readOnly: false });
        });
        editor.setValue(code || "");
    }
}

/* Auto Save to localStorage */
const updataWorkspaceAndCategoryFromvFS = async (disable_load_fs) => {
    if (!vFSTree) {
        vFSTree = { };
    }

    for (const extensionId of fs.ls("/extension")) {
        let extensionLocalPath = `/extension/${extensionId}`;
        let blocksFile = fs.walk(`${extensionLocalPath}/blocks`);
        for (const file of blocksFile) {
            if (file.endsWith(".js")) {
                let jsContent = fs.read(`${extensionLocalPath}/blocks/${file}`);
                try {
                    await runJavaScript(jsContent, `${extensionLocalPath}/blocks/${file}`);
                } catch (e) {
                    NotifyE("Script run error: " + e.toString());
                    console.error(e);
                }
            } else {
                console.warn("Why file " + file + " in blocks ? support .js only so skip it");
            }
        }
    }

    if (isElectron) {
        // Load local extension
        let extensionDir = sharedObj.extensionDir;
        for (const extensionId of nodeFS.ls(extensionDir)) {
            let extensionLocalPath = `${extensionDir}/${extensionId}`;
            let blocksFile = await nodeFS.walk(`${extensionLocalPath}/blocks`);
            for (const file of blocksFile) {
                if (file.endsWith(".js")) {
                    let jsContent = await readFileAsync(file);
                    jsContent = jsContent.toString();
                    try {
                        await runJavaScript(jsContent, file);
                    } catch (e) {
                        NotifyE("Script run error: " + e.toString());
                        console.error(e);
                    }
                } else {
                    console.warn("Why file " + file + " in blocks ? support .js only so skip it");
                }
            }
        }
    }

    updateBlockCategory();
    
    if (disable_load_fs) {
        return;
    }

    updateWorkspace();
}

let hotUpdate = async () => {
    if (!vFSTree) {
        vFSTree = { };
    }
    let configFileContent = fs.read("/config.json");
    if (configFileContent) {
        let projectConfig = JSON.parse(configFileContent);
        if (projectConfig) {
            // useMode = projectConfig?.mode || "block";
            boardId = projectConfig?.board || null;
            levelName = projectConfig?.level || null;
        }
    }

    const file_list = fs.ls("/");
    if (file_list.indexOf("main.py") >= 0) {
        useMode = "code";
        file_name_select = "main.py";
    } else if (file_list.indexOf("main.xml") >= 0) {
        useMode = "block";
        file_name_select = "main.xml";
    } else {
        useMode = "block";
    }

    if ((!boardId) || (!levelName)) {
        boardId = boards[0].id;
        levelName = boards[0].level[0].name;
    }

    await loadBoard();
    if (useMode === "block") {
        updataWorkspaceAndCategoryFromvFS();
    } else if (useMode === "code") {
        $("#mode-select-switch > li[data-value='2']").click();
        $(async () => {
            while(!editor) {
                await sleep(100);
            }
            updateWorkspace();
            editor.updateOptions({ readOnly: false });
        });
    }
}


let loadCodeAlready = false;
let callHotUpdate = true;

if (isElectron) {
    for (let arg of sharedObj.argv) {
        if (arg.endsWith(".mby")) {
            let filePath = arg;
            console.log(filePath);
            if (nodeFS.existsSync(filePath)) {
                vFSTree = JSON.parse(nodeFS.readFileSync(filePath));
                projectFilePath = filePath;
                rememberRecentProject(filePath);
                $("#project-name").val(path.basename(filePath, ".mby"));
                loadCodeAlready = true;
                sharedObj.argv = [ ];
            }
            break;
        }
    }
}

{
    let openArg = pageParams.get("open");
    if (openArg) {
        (async (fileName) => {
            Notiflix.Block.Standard("body", 'Loading...');

            let fileContent = await fetch(`https://us-central1-ublock-c0a08.cloudfunctions.net/share/files/${fileName}`, { 
                method: "get",
                redirect: "follow"
            });

            fileContent = await fileContent.text();

            await openProjectFromData(fileContent, fileName);

            Notiflix.Block.Remove("body");

            if (isEmbed) {
                if (embedOption.blockOnly == 1) {
                    blocklyWorkspace.zoomControls_.svgGroup_.remove();
                }
                let { width, height } = blocklyWorkspace.getCanvas().getBBox();
                let updateFrameSize = window.parent.microBlock.updateFrameSize;
                if (updateFrameSize) {
                    let fSizeW = embedOption.width;
                    let fSizeH = embedOption.height;
                    if (fSizeW === 0) fSizeW = `${width + 20 + (embedOption.blockOnly != 1 ? 20 : 0)}px`;
                    if (fSizeH === 0) fSizeH = `${height + 20 + (embedOption.blockOnly != 1 ? 60 : 0)}px`;
                    updateFrameSize(embedOption.id, fSizeW, fSizeH);
                    setTimeout(() => {
                        blocklyWorkspace.scrollCenter();
                        if (embedOption.fit == 1) {
                            blocklyWorkspace.zoomToFit();
                        }
                    }, 10);
                }
            }
        })(openArg);
        callHotUpdate = false;
    }
}

if (!loadCodeAlready) {
    vFSTree = JSON.parse(localStorage.getItem("autoSaveFS"));
}

if (callHotUpdate) {
    hotUpdate();
}

let saveCodeToLocal = () => {
    const file_write_path = `/${file_name_select}`;
    if (file_write_path.endsWith(".xml")) {
        // fs.remove("/main.py");
        try {
            var xmlText = Blockly.Xml.domToPrettyText(Blockly.Xml.workspaceToDom(blocklyWorkspace));
            fs.write(file_write_path, xmlText);
        } catch (e) {
            console.log(e);
        }
    } else if (file_write_path.endsWith(".py")) {
        // fs.remove("/main.xml");
        fs.write(file_write_path, editor.getValue());
    }
    fs.write("/config.json", JSON.stringify({
        mode: useMode,
        board: boardId,
        level: levelName
    }));
    localStorage.setItem("autoSaveFS", JSON.stringify(vFSTree));
    if (typeof globalThis.queueProjectHistorySnapshot === "function") {
        globalThis.queueProjectHistorySnapshot("Auto Save");
    }
};

blocklyWorkspace.addChangeListener(saveCodeToLocal);
/* -------------- */

/*
$("#new-project").click(async () => {
    if (await NotifyConfirm("All blocks will lost. Are you sure of new project ?")) {
        blocklyWorkspace.clear();
        if (editor) editor.setValue("");
        vFSTree = "";
        vFSTree = { };

        updateBlockCategory();
    }
});
*/

$("#save-project").click(async () => {
    saveCodeToLocal();

    if (!isElectron) {
        let data = JSON.stringify(vFSTree);
        let blob = new Blob([data], { type: "application/json" });
        let url = window.URL.createObjectURL(blob);

        let link = document.createElement("a");
        link.download = $("#project-name").val() + ".mby";
        link.href = url;
        link.click();

        window.URL.revokeObjectURL(url);
        statusLog("Save project");
        return;
    }

    if ((!projectFilePath) || saveAsFlag) {
        let result = await dialog.showSaveDialog({
            filters: [{
                name: "microBlock IDE",
                extensions: ["mby"]
            }],
            defaultPath: $("#project-name").val() + ".mby"
        });

        if (result.canceled) return;

        projectFilePath = result.filePath;
        saveAsFlag = false;
    }

    nodeFS.writeFile(projectFilePath, JSON.stringify(vFSTree), err => {
        if (err) {
            NotifyE("Save project fail: " + err.toString());
            return;
        }

        NotifyS("Save project at " + projectFilePath);
        statusLog("Save project at " + projectFilePath);
        rememberRecentProject(projectFilePath);
    });
});

let openProjectFromData = async (data, path) => {
    vFSTree = JSON.parse(data);
    await hotUpdate();
    if (!isEmbed) NotifyS("Open project " + path)
    statusLog("Open project " + path);
    $("#project-name").val(path.split(/[\\\/]/).pop().replace(".mby", ""));
}

let openProject = async (filePath) => {
    if (!await NotifyConfirm("All blocks will lost. Are you sure of open project ?")) {
        return;
    }

    if (!isElectron) {
        let input = document.createElement("input");
        input.type = "file";
        input.accept = ".mby";
        input.addEventListener("change", function() {
            // console.log(this.files);
            let fileName = this.files[0].name.replace(".mby", "");
            let fr = new FileReader();
            fr.onload = async () => {
                openProjectFromData(fr.result, fileName);
            };
            fr.readAsText(this.files[0]);
        }, false); 
        input.click();
    } else {
        let OpenFilePath = null;
        if (!filePath) {
            let result = await dialog.showOpenDialogSync({
                properties: [
                'openFile'
                ],
                filters: [{ 
                    name: 'microBlock IDE', 
                    extensions: ['mby'] 
                }]
            });

            if (result == undefined) {
                return;
            }

            OpenFilePath = result[0];
        } else {
            OpenFilePath = filePath;
        }
        
        nodeFS.readFile(OpenFilePath, async (err, data) => {
            if (err) {
                NotifyE("Open project fail: " + err.toString());
                return;
            }

            projectFilePath = OpenFilePath;
            await openProjectFromData(data, OpenFilePath);
            rememberRecentProject(OpenFilePath);
        });
    }
};

$("#open-project").click(async () => {
    openProject();
});

$("#open-help").click(() => {
    ShowDialog($("#help-dialog"));
});

$("#open-help-website").click(() => {
    if (!isElectron) {
        window.open("https://github.com/inexglobal/microBlock-IDE", "_blank");
    } else {
        shell.openExternal("https://github.com/inexglobal/microBlock-IDE");
    }
});

let imageSelectUpdate = (sel) => {
    $(sel).find("li > div").click(function() {
        $(sel).find("li > div").removeClass("active");
        $(this).addClass("active");
    });
};

$(() => {
    for (sel of $(".image-select")) {
        imageSelectUpdate(sel);
    }
});

let statusLog = text => {
    let now = new Date();
    $("#text-status").text(`${text} at ${now.getHours()}:${(now.getMinutes() < 10 ? "0" : "")}${now.getMinutes()}:${(now.getSeconds() < 10 ? "0" : "")}${now.getSeconds()}`);
};

$(document).keydown(function(event) {
    // console.log(event)
    if (event.ctrlKey) {
        let key = event.key;
        if (key === 's') { // Ctrl + S -> Save
            event.preventDefault();
            $("#save-project").click();
        } else if (key === 'n') { // Ctrl + N -> New
            event.preventDefault();
            $("#new-project").click();
        } else if (key === 'o') { // Ctrl + O -> Open
            event.preventDefault();
            $("#open-project").click();
        } else if (key === 'h') { // Ctrl + H -> Help
            event.preventDefault();
            $("#open-help").click();
        } else if (key === 't') { // Ctrl + T -> Terminal
            event.preventDefault();
            $("#open-terminal").click();
        } else if (key === 'u') { // Ctrl + U -> Upload
            event.preventDefault();
            $("#upload-program").click();
        } 
    }

    return true;
});

$("body")[0].addEventListener("drop", (e) => {
    e.preventDefault();

    if (e.dataTransfer.items.length > 0) {
        let fPath = e.dataTransfer.items[0].getAsFile().path;
    
        // console.log(fPath);
        if (fPath.endsWith(".mby")) {
            openProject(fPath);
        }
    }
});

$("body")[0].addEventListener("dragover", (e) => {
    e.preventDefault();
});

// Auto Port connect (only on Electron)
let autoConnectFlag = true;
let timerAutoConnect = null;

let autoConnectCheck = async () => {
    if (autoConnectFlag && boardId && isElectron && !serialPort && deviceMode === MODE_REAL_DEVICE) {
        let board = boards.find(board => board.id === boardId);
        let usbInfo = board.usb[0];
        let portList = await serialAPI.list();
        if (portList) {
            let port = portList.find(info => info.productId === usbInfo.productId && info.vendorId === usbInfo.vendorId);
            if (port) {
                // console.log(port);
                serialConnectElectron(port.path, true);
            }
        }
    }
    if (timerAutoConnect) clearTimeout(timerAutoConnect);
    timerAutoConnect = setTimeout(autoConnectCheck, autoConnectFlag ? 500 : 5000);
};
if (isElectron) {
    autoConnectCheck();

    const compareAppVersions = (leftVersion, rightVersion) => {
        const parseVersion = version => {
            const normalizedVersion = String(version || "")
                .trim()
                .replace(/^v/i, "")
                .split("+")[0];
            const [coreVersion, ...prereleaseParts] = normalizedVersion.split("-");

            return {
                core: coreVersion.split(".").map(part => Number.parseInt(part, 10) || 0),
                prerelease: prereleaseParts.join("-").split(".").filter(Boolean)
            };
        };

        const left = parseVersion(leftVersion);
        const right = parseVersion(rightVersion);
        const coreLength = Math.max(left.core.length, right.core.length);

        for (let index = 0; index < coreLength; index += 1) {
            const leftPart = left.core[index] || 0;
            const rightPart = right.core[index] || 0;

            if (leftPart > rightPart) return 1;
            if (leftPart < rightPart) return -1;
        }

        if (!left.prerelease.length && right.prerelease.length) return 1;
        if (left.prerelease.length && !right.prerelease.length) return -1;

        const prereleaseLength = Math.max(left.prerelease.length, right.prerelease.length);
        for (let index = 0; index < prereleaseLength; index += 1) {
            if (index >= left.prerelease.length) return -1;
            if (index >= right.prerelease.length) return 1;

            const leftPart = left.prerelease[index];
            const rightPart = right.prerelease[index];

            const leftIsNumber = /^\d+$/.test(leftPart);
            const rightIsNumber = /^\d+$/.test(rightPart);
            if (leftIsNumber && !rightIsNumber) return -1;
            if (!leftIsNumber && rightIsNumber) return 1;

            const leftValue = leftIsNumber ? Number(leftPart) : leftPart;
            const rightValue = rightIsNumber ? Number(rightPart) : rightPart;
            if (leftValue > rightValue) return 1;
            if (leftValue < rightValue) return -1;
        }

        return 0;
    };

    // Update Check
    checkUpdate = async () => {
        let lastPackageFile = await fetch("https://api.github.com/repos/inexglobal/microBlock-IDE/contents/package.json");
        if (lastPackageFile.status !== 200) {
            console.error("Get package.json fail");
            return;
        }
        lastPackageFile = await lastPackageFile.json();
        lastPackageFile = Base64.decode(lastPackageFile.content);
        lastPackageFile = JSON.parse(lastPackageFile);
        if (Object.prototype.hasOwnProperty.call(lastPackageFile, "version")) {
            if (compareAppVersions(lastPackageFile.version, pjson.version) > 0) {
                console.log("microBlock IDE offline have new version", lastPackageFile.version, pjson.version);
                NotifyI("microBlock IDE offline have new version");
            } else {
                console.log("microBlock IDE offline now is last version", lastPackageFile.version, pjson.version);
            }
        } else {
            console.error("package.json error", lastPackageFile);
        }
    }

    checkUpdate();
}

$(() => $("#full-loading").fadeOut());

