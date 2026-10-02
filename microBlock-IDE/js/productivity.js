const projectHistoryStorageKey = "projectHistoryV1";
const projectSessionOpenKey = "projectSessionOpen";
const maximumProjectHistoryEntries = 10;
const maximumProjectHistoryBytes = 3.5 * 1024 * 1024;
let projectHistoryTimer = null;

const readProjectHistory = () => {
    try {
        const history = JSON.parse(localStorage.getItem(projectHistoryStorageKey) || "[]");
        return Array.isArray(history) ? history : [];
    } catch (error) {
        console.warn("Could not read project history", error);
        return [];
    }
};

const writeProjectHistory = history => {
    let limitedHistory = history.slice(0, maximumProjectHistoryEntries);

    while (limitedHistory.length > 1 && JSON.stringify(limitedHistory).length > maximumProjectHistoryBytes) {
        limitedHistory.pop();
    }

    try {
        localStorage.setItem(projectHistoryStorageKey, JSON.stringify(limitedHistory));
    } catch (error) {
        console.warn("Could not save project history", error);
    }
};

const saveRecoverySnapshot = (reason = "Auto Save") => {
    try {
        const data = JSON.stringify(vFSTree || {});
        if (!data || data === "{}") return false;

        const history = readProjectHistory();
        if (history[0] && history[0].data === data) return false;

        history.unshift({
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            timestamp: new Date().toISOString(),
            name: String($("#project-name").val() || "myProject"),
            board: boardId || "Unknown board",
            mode: useMode || "block",
            reason,
            data
        });
        writeProjectHistory(history);
        return true;
    } catch (error) {
        console.warn("Could not create a recovery point", error);
        return false;
    }
};

globalThis.queueProjectHistorySnapshot = (reason = "Auto Save") => {
    clearTimeout(projectHistoryTimer);
    projectHistoryTimer = setTimeout(() => saveRecoverySnapshot(reason), 1400);
};

const formatHistoryTime = value => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown time";
    return date.toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
};

const createEmptyListMessage = text => $("<div>").addClass("productivity-empty").text(text);

const restoreHistoryItem = async item => {
    if (!await NotifyConfirm(`Restore “${item.name}” from ${formatHistoryTime(item.timestamp)}?`)) return;

    try {
        saveRecoverySnapshot("Before Restore");
        projectFilePath = null;
        await openProjectFromData(item.data, `${item.name} (Recovered)`);
        saveCodeToLocal();
        CloseDialog($("#project-history-dialog"));
        NotifyS("Recovery point restored");
        statusLog("Recovery point restored");
    } catch (error) {
        console.error("Restore recovery point failed", error);
        NotifyE("Could not restore this recovery point");
    }
};

const renderProjectHistory = () => {
    const list = $("#project-history-list").empty();
    const history = readProjectHistory();

    if (history.length === 0) {
        list.append(createEmptyListMessage("No recovery points yet. They appear automatically while you work."));
        return;
    }

    history.forEach(item => {
        const row = $("<div>").addClass("productivity-list-item");
        row.append($("<i>").addClass("fas fa-history"));
        row.append(
            $("<div>").addClass("item-copy")
                .append($("<strong>").text(item.name || "Untitled Project"))
                .append($("<small>").text(`${formatHistoryTime(item.timestamp)} · ${item.reason || "Auto Save"} · ${item.board || "Unknown board"}`))
        );
        row.append($("<button>").addClass("item-action").attr("type", "button").html('<i class="fas fa-undo-alt"></i> Restore').click(() => restoreHistoryItem(item)));
        list.append(row);
    });
};

const getRecentProjectPaths = () => {
    try {
        const paths = JSON.parse(localStorage.getItem("recentProjectPaths") || "[]");
        return Array.isArray(paths) ? paths : [];
    } catch (error) {
        return [];
    }
};

const renderRecentProjects = () => {
    const section = $("#recent-projects-section");
    const list = $("#recent-projects-list").empty();
    if (!isElectron) {
        section.hide();
        return;
    }

    section.show();
    const recentPaths = getRecentProjectPaths().filter(filePath => nodeFS.existsSync(filePath));
    if (recentPaths.length === 0) {
        list.append(createEmptyListMessage("Projects opened or saved on this computer will appear here."));
        return;
    }

    recentPaths.forEach(filePath => {
        const row = $("<div>").addClass("productivity-list-item");
        row.append($("<i>").addClass("far fa-folder-open"));
        row.append(
            $("<div>").addClass("item-copy")
                .append($("<strong>").text(path.basename(filePath)))
                .append($("<small>").text(filePath))
        );
        row.append($("<button>").addClass("item-action").attr("type", "button").html('<i class="fas fa-folder-open"></i> Open').click(async () => {
            CloseDialog($("#project-history-dialog"));
            await openProject(filePath);
        }));
        list.append(row);
    });
};

globalThis.openProjectHistoryDialog = () => {
    renderRecentProjects();
    renderProjectHistory();
    ShowDialog($("#project-history-dialog"));
};

$("#open-project-history").click(globalThis.openProjectHistoryDialog);

$("#save-recovery-point").click(() => {
    saveCodeToLocal();
    const saved = saveRecoverySnapshot("Manual Save Point");
    renderProjectHistory();
    saved ? NotifyS("Recovery point saved") : NotifyI("The latest recovery point is already up to date");
});

const focusWorkspaceBlock = blockId => {
    const block = blocklyWorkspace.getBlockById(blockId);
    if (!block) return;

    if (useMode !== "block") {
        $("#mode-select-switch > li[data-value='1']").click();
    }
    blocklyWorkspace.centerOnBlock(blockId);
    if (typeof block.select === "function") block.select();
};

const getBlockSearchText = block => {
    const values = [block.type];
    try {
        values.push(block.toString());
    } catch (error) {
        // Some custom fields can fail while they are still initializing.
    }
    try {
        values.push(...(block.getVars ? block.getVars() : []));
    } catch (error) {
        // Variable discovery is optional for third-party blocks.
    }
    return values.filter(Boolean).join(" ");
};

const renderWorkspaceSearchResults = query => {
    const results = $("#workspace-search-results").empty();
    const normalizedQuery = String(query || "").trim().toLocaleLowerCase();

    if (!normalizedQuery) {
        $("#workspace-search-summary").text("Type to search the current workspace.");
        return;
    }

    const matches = blocklyWorkspace.getAllBlocks(false).filter(block =>
        getBlockSearchText(block).toLocaleLowerCase().includes(normalizedQuery)
    );
    $("#workspace-search-summary").text(`${matches.length} result${matches.length === 1 ? "" : "s"}`);

    if (matches.length === 0) {
        results.append(createEmptyListMessage("No matching blocks, functions, or variables."));
        return;
    }

    matches.slice(0, 100).forEach(block => {
        const label = String(block.toString() || block.type).replace(/\s+/g, " ").trim();
        const button = $("<button>").attr("type", "button").addClass("productivity-list-item");
        button.append($("<span>").addClass("result-icon").append($("<i>").addClass("fas fa-cube")));
        button.append(
            $("<span>").addClass("item-copy")
                .append($("<strong>").text(label || block.type))
                .append($("<small>").text(block.type))
        );
        button.append($("<i>").addClass("fas fa-crosshairs"));
        button.click(() => {
            focusWorkspaceBlock(block.id);
            CloseDialog($("#workspace-search-dialog"));
        });
        results.append(button);
    });
};

const openWorkspaceSearch = () => {
    if (useMode === "code" && editor) {
        editor.getAction("actions.find").run();
        return;
    }

    ShowDialog($("#workspace-search-dialog"));
    $("#workspace-search-input").val("");
    renderWorkspaceSearchResults("");
    setTimeout(() => $("#workspace-search-input").trigger("focus"), 20);
};

$("#open-workspace-search").click(openWorkspaceSearch);
$("#workspace-search-input").on("input", function() {
    renderWorkspaceSearchResults(this.value);
});
$("#workspace-search-input").on("keydown", event => {
    if (event.key === "Escape") {
        event.preventDefault();
        CloseDialog($("#workspace-search-dialog"));
    }
});

document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "f") {
        event.preventDefault();
        openWorkspaceSearch();
    }
});

const previousSessionWasInterrupted = localStorage.getItem(projectSessionOpenKey) === "1";
localStorage.setItem(projectSessionOpenKey, "1");
window.addEventListener("beforeunload", () => {
    try {
        saveCodeToLocal();
        saveRecoverySnapshot("Session Close");
        localStorage.setItem(projectSessionOpenKey, "0");
    } catch (error) {
        console.warn("Could not finish the recovery snapshot", error);
    }
});

setTimeout(() => {
    globalThis.queueProjectHistorySnapshot("Session Start");
    if (previousSessionWasInterrupted && localStorage.getItem("autoSaveFS")) {
        NotifyW("The previous session did not close normally. Your auto-saved project was recovered.");
    }
}, 800);
