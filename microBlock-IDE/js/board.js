let boards = [];
let boardId = null;
let levelName = null;

let addBoard = board => boards.push(board);

let boardIdSelect = null;

// Remove only registrations still owned by the previous board. Extensions may
// replace or decorate them after loading, so preserve those later changes.
let previousBoardRegistrations = [];
let blockRegistrationLoadQueue = Promise.resolve();
const queueBlockRegistrationLoad = task => {
    const execution = blockRegistrationLoadQueue.then(task);
    blockRegistrationLoadQueue = execution.catch(() => {});
    return execution;
};
const snapshotBoardRegistration = (registry, key) => {
    const hasValue = Object.prototype.hasOwnProperty.call(registry, key);
    const value = registry[key];
    const properties = value && (typeof value === "object" || typeof value === "function")
        ? Object.getOwnPropertyDescriptors(value) : null;
    return { hasValue, value, properties };
};
const sameBoardRegistration = (left, right) => {
    if (left.hasValue !== right.hasValue || left.value !== right.value) return false;
    if (!left.properties || !right.properties) return left.properties === right.properties;
    const keys = Reflect.ownKeys(left.properties);
    if (keys.length !== Reflect.ownKeys(right.properties).length) return false;
    return keys.every(key => {
        const first = left.properties[key];
        const second = right.properties[key];
        return second && first.value === second.value && first.get === second.get && first.set === second.set
            && first.writable === second.writable && first.enumerable === second.enumerable
            && first.configurable === second.configurable;
    });
};
const restoreBlockRegistrations = records => {
    for (const { registry, key, before, loaded } of records) {
        if (!sameBoardRegistration(snapshotBoardRegistration(registry, key), loaded)) continue;
        if (before.hasValue) {
            if (before.value === loaded.value && before.properties) {
                for (const property of Reflect.ownKeys(loaded.properties)) {
                    if (!Object.prototype.hasOwnProperty.call(before.properties, property)) delete before.value[property];
                }
                Object.defineProperties(before.value, before.properties);
            }
            registry[key] = before.value;
        } else {
            delete registry[key];
        }
    }
    records.length = 0;
};
const restorePreviousBoardRegistrations = () => restoreBlockRegistrations(previousBoardRegistrations);

// Snapshot inside runJavaScript's execution queue, not before its asynchronous
// script load. Otherwise another script's changes can be assigned to this owner.
const registrationLoadHooks = records => ({
    beforeExecute: () => {
        const registries = [Blockly.Blocks];
        for (const generator of availableBlockGenerators()) {
            registries.push(generator.forBlock, generator);
        }
        return registries.map(registry => {
            const generatorState = availableBlockGenerators().includes(registry)
                ? legacyBlockGeneratorStateFor(registry) : null;
            const include = key => !generatorState || (!generatorState.reserved.has(key)
                && typeof registry[key] === "function");
            return { registry, include, before: new Map(Reflect.ownKeys(registry).filter(include)
                .map(key => [key, snapshotBoardRegistration(registry, key)])) };
        });
    },
    afterExecute: (error, snapshots) => {
        if (!snapshots) return;
        for (const { registry, include, before } of snapshots) {
            for (const key of new Set([...before.keys(), ...Reflect.ownKeys(registry).filter(include)])) {
                const prior = before.get(key) || { hasValue: false, value: undefined, properties: null };
                const loaded = snapshotBoardRegistration(registry, key);
                if (sameBoardRegistration(prior, loaded)) continue;
                const existing = records.find(record => record.registry === registry && record.key === key);
                if (existing) {
                    // Preserve a change made by another owner between scripts.
                    if (!sameBoardRegistration(existing.loaded, prior)) existing.before = prior;
                    existing.loaded = loaded;
                    if (sameBoardRegistration(existing.before, loaded)) records.splice(records.indexOf(existing), 1);
                } else {
                    records.push({ registry, key, before: prior, loaded });
                }
            }
        }
    }
});

$("#new-project").click(async () => {
    if (!(await NotifyConfirm("All blocks will lost. Are you sure of new project ?"))) {
        return;
    }

    boardIdSelect = boardId || "kidbright32-v1.3";

    const tags_list =   [ "Recommend" ]
                        .concat(boards
                                    .map(a => a.tags)
                                    .reduce((accumulator, currentValue) => accumulator.concat(currentValue))
                                    .filter((item, index, arr) => arr.indexOf(item) === index)
                                    .sort()
                                );
    // console.log("tags list", tags_list);
    $("#boards-tags-list").html(tags_list.map(tag => `<li>${tag}</li>`).join(""));
    $("#boards-tags-list > li").click(e => {
        $("#boards-tags-list > li").removeClass("active");
        $(e.currentTarget).addClass("active");

        const tag_select = e.currentTarget.textContent;
        // console.log(tag_select);
        let board_id_in_tag_list = [];
        if (tag_select === "Recommend") {
            board_id_in_tag_list = [
                boardId,
                "kidbright32-v1.3",
                "kidbright32i",
                "kidbright32iP",
                "kidbright32iA",
                "kidbright32-v1.6"
            ].filter((item, index, arr) => arr.indexOf(item) === index).slice(0, 5);
        } else {
            board_id_in_tag_list = boards.filter(board => board.tags.indexOf(tag_select) >= 0).map(board => board.id);
        }

        $("#hardware-select ul").html(
            board_id_in_tag_list.map(board_id => {
                const board = boards.find(a => a.id === board_id);
                if ((!isElectron) && board?.isArduinoPlatform) {
                    return "";
                }

                return `
                    <li>
                        <div data-board-id="${board.id}"${board.id === boardIdSelect ?  'class="active"' : ""}>
                            <div class="image"><img src="${rootPath}/boards/${board.id}/${board.image}" alt=""></div>
                            <div class="name">${board.name}</div>
                        </div>
                    </li>
                `
            }).join("")
        );

        $("#hardware-select ul > li > div").click(e => {
            $("#hardware-select ul > li > div").removeClass("active");
            $(e.currentTarget).addClass("active");

            boardIdSelect = $(e.currentTarget).attr("data-board-id");
            // console.log(boardIdSelect);
        });
    });

    $("#boards-tags-list > li:first-child").click();

    $("#project-create-dialog").show();
});

$("#project-create-dialog .close-btn").click(() => $("#project-create-dialog").hide())

let arduinoConsoleTerm = {
    scroll: () => {
        $("#arduino-console-dialog pre").scrollTop($("#arduino-console-dialog pre")[0].scrollHeight);
    },
    writeln: text => {
        $("#arduino-console-dialog pre")[0].innerText += text + "\r\n";
        arduinoConsoleTerm.scroll();
    },
    write: text => {
        $("#arduino-console-dialog pre")[0].innerText += text;
        arduinoConsoleTerm.scroll();
    },
    clear: () => {
        $("#arduino-console-dialog pre")[0].innerText = "";
    }
};

let boardLoadId = 0;
let loadBoard = () => {
    const requestedId = ++boardLoadId;
    const requestedBoardId = boardId;
    const requestedLevelName = levelName;
    return queueBlockRegistrationLoad(() => loadRequestedBoard(requestedId, requestedBoardId, requestedLevelName));
};
const loadRequestedBoard = async (requestedId, requestedBoardId, requestedLevelName) => {
    if (!requestedBoardId || !requestedLevelName || requestedId !== boardLoadId) return;
    const board = boards.find(board => board.id === requestedBoardId);
    if (!board) throw new Error(`Unknown board: ${requestedBoardId}`);
    // Restore extension overrides first, exposing the old board's registrations
    // so they can be removed before the new board is loaded.
    restorePreviousExtensionRegistrations();
    restorePreviousBoardRegistrations();
    let scripts = [ ];
    scripts = scripts.concat(board.script);
    scripts = scripts.concat(board.blocks);
    if (typeof board.simulator !== "undefined") {
        scripts = scripts.concat(board.simulator.script);
    }
    for (let fPath of scripts) {
        if (requestedId !== boardLoadId) return;
        let script;
        try {
            script = await fetch(`${rootPath}/boards/${board.id}/${fPath}`);
        } catch (e) {
            console.warn(e);
            continue;
        }
        if (script.status === 200) {
            try {
                await runJavaScript(await script.text(), `${rootPath}/boards/${board.id}/${fPath}`,
                    registrationLoadHooks(previousBoardRegistrations));
            } catch (e) {
                console.warn(e);
            }
        } else {
            console.warn(script);
        }
    }

    if (requestedId !== boardLoadId) return;
    await loadInstalledExtensionRegistrations();
    if (requestedId !== boardLoadId) return;

    for (let fPath of board.css) {
        let link = document.createElement('link');
        link.rel = "stylesheet";
        link.href = `${rootPath}/boards/${board.id}/${fPath}`;
        document.head.appendChild(link);
    }

    await updateBlockCategory();
    if (requestedId !== boardLoadId) return;

    autoCompletionDictionary = board.autoCompletion;

    $("#board-name").text(board.name);
    $("#level-name").text(requestedLevelName);

    if (typeof board.simulator !== "undefined") {
        let last_deivce_mode = +localStorage.getItem("last_deivce_mode");
        switchModeTo(last_deivce_mode);
    } else {
        switchModeTo(MODE_REAL_DEVICE);
    }

    if (typeof board?.onLoad === "function") {
        await board.onLoad(blocklyWorkspace, board);
    }
    if (requestedId !== boardLoadId) return;

    Blockly.Events.refreshBlockValidation(blocklyWorkspace);

    if (board?.isArduinoPlatform) {
        if (+localStorage.getItem("show-console-board-initial") !== -1) {
            // console.log("show", +localStorage.getItem("show-console-board-initial"), +localStorage.getItem("show-console-board-initial") !== -1);
            $("#arduino-console-dialog .title").text("Loading...");
            ShowDialog($("#arduino-console-dialog"));
        }
        arduinoConsoleTerm.clear();
        /*
        if (typeof arduinoInitTerm === "undefined") {
            arduinoInitTerm = new Terminal();
            if (typeof arduinInitFitAddon === "undefined") {
                arduinInitFitAddon = new FitAddon.FitAddon();
            }
            arduinoInitTerm.loadAddon(arduinInitFitAddon);
            arduinoInitTerm.open($("#arduino-console-dialog > section")[0]);
            try {
                arduinInitFitAddon.fit();
            } catch(e) {
                
            }
        } else {
            arduinoInitTerm.clear();
        }
        */
        // await arduino_board_init();
        arduino_board_init().then(() => {
            $("#arduino-console-dialog .title").text("Finish");
            CloseDialog($("#arduino-console-dialog"));
        }).catch(e => {
            console.warn(e);
            $("#arduino-console-dialog .title").text("Load board FAIL");
        });
    }
};

$("#create-project-btn").click(async () => {
    {
        const board = boards.find(board => board.id === (boardId || "kidbright32-v1.3"));
        if (typeof board?.onDispose === "function") {
            await board.onDispose(blocklyWorkspace, board);
        }
    }

    let projectName = $("#project-name-input").val();
    // boardId = $("#project-create-dialog #hardware-select ul > li > div.active").attr("data-board-id");
    // levelName = $("#project-create-dialog #level-select ul > li > div.active").attr("data-level-name");
    boardId = boardIdSelect;
    levelName = boards.find(board => board.id === boardId).level[0].name;

    await loadBoard();

    // Delete old file
    fs.ls("/").filter(a => a.endsWith(".py") || a.endsWith(".xml")).map(a => fs.remove("/" + a));

    blocklyWorkspace.clear();
    if (editor) editor.setValue("");
    
    file_name_select = "main." + (useMode === "block" ? "xml" : "py");

    {
        const board = boards.find(board => board.id === (boardId || "kidbright32-v1.3"));
        if (board?.defaultCode) {
            Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(board.defaultCode), blocklyWorkspace);
        }
    }

    // vFSTree = "";
    // vFSTree = { };
    if (useMode === "block") {
        // fs.write("/main.xml", "");
        Blockly.Events.refreshBlockValidation(blocklyWorkspace);
        blocklyWorkspace.setScale(1);
        blocklyWorkspace.scrollCenter();
    } else if (useMode === "code") {
        // fs.write("/main.py", "");
    }

    $("#project-name").val(projectName);
    projectFilePath = null;
    saveAsFlag = false;

    $("#project-create-dialog").hide();
    NotifyS("New project " + projectName);
    statusLog("New project " + projectName);

    saveCodeToLocal();
});
