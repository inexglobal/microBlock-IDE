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

const getWorkspaceBlockLabel = block => {
    try {
        return String(block.toString() || block.type).replace(/\s+/g, " ").trim();
    } catch (error) {
        return String(block.type);
    }
};

const getBlockSearchText = block => {
    const values = [block.type, getWorkspaceBlockLabel(block)];
    try {
        values.push(...(block.getVars ? block.getVars() : []));
    } catch (error) {
        // Variable discovery is optional for third-party blocks.
    }
    return values.filter(Boolean).join(" ");
};

const getWorkspaceSearchCategories = blocks => {
    const toolbox = blocklyWorkspace.getToolbox();
    const items = toolbox ? toolbox.getToolboxItems() : [];
    const categories = [];
    const byType = new Map();
    const dynamicCategories = [];
    items.forEach((item, index) => {
        if (typeof item.getName !== "function" || typeof item.getContents !== "function") return;
        const icon = item.getDiv().querySelector(".blocklyTreeIcon img");
        const category = {
            id: `category-${index}`,
            name: item.getName(),
            icon: icon ? icon.src : "",
            blocks: []
        };
        categories.push(category);
        const contents = item.getContents();
        if (typeof contents === "string") {
            dynamicCategories.push({ callback: contents, category });
            return;
        }
        for (const entry of contents || []) {
            if (String(entry.kind || "").toLowerCase() !== "block") continue;
            let type = entry.type;
            if (!type && entry.blockxml) {
                try {
                    const xml = typeof entry.blockxml === "string"
                        ? Blockly.utils.xml.textToDom(entry.blockxml) : entry.blockxml;
                    type = xml.getAttribute("type");
                } catch (error) {
                    // Unknown extension entries can still be shown under Other blocks.
                }
            }
            // Only top-level entries define ownership, not their input shadows.
            if (type && !byType.has(type)) byType.set(type, category);
        }
    });
    const other = { id: "other", name: "Other blocks", icon: "", blocks: [] };
    const byBlock = new Map();
    for (const block of blocks) {
        const dynamic = dynamicCategories.find(({ callback }) =>
            ((callback === "VARIABLE" || callback === "VARIABLE_DYNAMIC")
                && (block.type.startsWith("variables_") || block.type === "math_change"))
            || (callback === "PROCEDURE" && block.type.startsWith("procedures_"))
        );
        const category = byType.get(block.type) || (dynamic && dynamic.category) || other;
        category.blocks.push(block);
        byBlock.set(block.id, category);
    }
    if (other.blocks.length) categories.push(other);
    return { categories: categories.filter(category => category.blocks.length), byBlock };
};

let workspaceSearchSelectedCategory = "all";

const createWorkspaceSearchEmptyState = (title, description, icon = "fa-search") =>
    $("<div>").addClass("workspace-search-empty")
        .append($("<span>").addClass("workspace-search-empty-icon").attr("aria-hidden", "true")
            .append($("<i>").addClass(`fas ${icon}`)))
        .append($("<strong>").text(title))
        .append($("<p>").text(description));

const highlightWorkspaceSearchLabel = (element, label, query) => {
    if (!query) return element.text(label);
    const normalizedLabel = label.toLocaleLowerCase();
    let start = 0;
    let match = normalizedLabel.indexOf(query);
    while (match >= 0) {
        element.append(document.createTextNode(label.slice(start, match)));
        element.append($("<mark>").text(label.slice(match, match + query.length)));
        start = match + query.length;
        match = normalizedLabel.indexOf(query, start);
    }
    element.append(document.createTextNode(label.slice(start)));
    return element;
};

let workspaceSearchPreviewId = 0;
let workspaceSearchPreviewObserver = null;

const appendWorkspaceSearchBlockPreview = (container, block) => {
    const preview = $("<span>").addClass("workspace-search-block-preview").attr("aria-hidden", "true");
    container.append(preview);
    try {
        const source = block.getSvgRoot();
        if (!source) throw new Error("Block has not rendered yet");
        const nextBlock = block.getNextBlock();
        const excluded = nextBlock && nextBlock.getSvgRoot();
        const elementPairs = [];
        // Retain input values and statement bodies, but not the following stack.
        const cloneBlockNode = node => {
            if (node === excluded || (node.nodeType === Node.ELEMENT_NODE && node.localName === "script")) return null;
            const clone = node.cloneNode(false);
            if (node.nodeType === Node.ELEMENT_NODE) elementPairs.push([node, clone]);
            for (const child of node.childNodes) {
                const clonedChild = cloneBlockNode(child);
                if (clonedChild) clone.appendChild(clonedChild);
            }
            return clone;
        };
        const clone = cloneBlockNode(source);
        inlineComputedSVGStyles(source, clone, elementPairs);
        clone.removeAttribute("transform");
        clone.style.removeProperty("display");

        // Keep clone-only IDs unique; existing workspace definitions stay shared.
        const idMap = new Map();
        const prefix = `workspace-search-preview-${++workspaceSearchPreviewId}`;
        elementPairs.forEach(([, element], index) => {
            const id = element.getAttribute("id");
            if (id) {
                idMap.set(id, `${prefix}-${index}`);
                element.setAttribute("id", idMap.get(id));
            }
        });
        elementPairs.forEach(([, element]) => {
            element.removeAttribute("tabindex");
            element.removeAttribute("data-id");
            element.setAttribute("focusable", "false");
            for (const attribute of Array.from(element.attributes)) {
                if (/^on/i.test(attribute.name)) {
                    element.removeAttribute(attribute.name);
                    continue;
                }
                const value = attribute.value.replace(/url\(\s*["']?([^\)"']+)["']?\s*\)/g, (match, reference) => {
                    const id = reference.slice(reference.lastIndexOf("#") + 1);
                    return idMap.has(id) ? `url(#${idMap.get(id)})` : match;
                });
                element.setAttribute(attribute.name, value.startsWith("#") && idMap.has(value.slice(1))
                    ? `#${idMap.get(value.slice(1))}` : value);
            }
        });

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        svg.setAttribute("preserveAspectRatio", "xMinYMid meet");
        svg.appendChild(clone);
        preview.append(svg);
        const bounds = clone.getBBox();
        if (!bounds.width || !bounds.height) throw new Error("Block preview is empty");
        const padding = 6;
        const width = Math.ceil(bounds.width + padding * 2);
        const height = Math.ceil(bounds.height + padding * 2);
        svg.setAttribute("viewBox", `${bounds.x - padding} ${bounds.y - padding} ${width} ${height}`);
        svg.setAttribute("width", width);
        svg.setAttribute("height", height);
        svg.style.maxWidth = `${width}px`;
    } catch (error) {
        preview.empty().addClass("preview-unavailable").text("Preview unavailable");
    }
};

let workspaceSearchReturnFocus = null;
let workspaceSearchFocusTimer = null;

const restoreWorkspaceSearchFocus = () => {
    if (workspaceSearchPreviewObserver) workspaceSearchPreviewObserver.disconnect();
    const dialog = $("#workspace-search-dialog");
    const target = workspaceSearchReturnFocus;
    const restore = () => {
        if (dialog.hasClass("show")) return;
        clearTimeout(workspaceSearchFocusTimer);
        workspaceSearchFocusTimer = null;
        dialog.off("animationend.workspaceSearchFocus");
        workspaceSearchReturnFocus = null;
        if (target && target.isConnected && typeof target.focus === "function") target.focus();
    };
    clearTimeout(workspaceSearchFocusTimer);
    dialog.off("animationend.workspaceSearchFocus").on("animationend.workspaceSearchFocus", event => {
        if (event.target === dialog[0] && event.originalEvent.animationName === "dialogHide") restore();
    });
    workspaceSearchFocusTimer = setTimeout(restore, 450);
};

const closeWorkspaceSearch = () => {
    restoreWorkspaceSearchFocus();
    CloseDialog($("#workspace-search-dialog"));
};

const renderWorkspaceSearchResults = query => {
    if (workspaceSearchPreviewObserver) workspaceSearchPreviewObserver.disconnect();
    workspaceSearchPreviewObserver = null;
    const results = $("#workspace-search-results").empty().scrollTop(0);
    const normalizedQuery = String(query || "").trim().toLocaleLowerCase();
    const blocks = blocklyWorkspace.getAllBlocks(false);
    const { categories, byBlock } = getWorkspaceSearchCategories(blocks);
    const categorySelect = $("#workspace-search-category").empty()
        .append($("<option>").val("all").text("All categories"));
    categories.forEach(category => categorySelect.append($("<option>").val(category.id).text(category.name)));
    if (!categories.some(category => category.id === workspaceSearchSelectedCategory)) workspaceSearchSelectedCategory = "all";
    categorySelect.val(workspaceSearchSelectedCategory);
    $("#workspace-search-clear").prop("hidden", !String(query || "").length);

    if (blocks.length === 0) {
        $("#workspace-search-summary").text("0 blocks in this workspace");
        results.append(createWorkspaceSearchEmptyState("Your workspace is empty", "Add blocks to your program, then find them here.", "fa-cubes"));
        return;
    }

    const matches = blocks.filter(block =>
        (workspaceSearchSelectedCategory === "all" || byBlock.get(block.id).id === workspaceSearchSelectedCategory)
        && (!normalizedQuery || getBlockSearchText(block).toLocaleLowerCase().includes(normalizedQuery))
    );
    const resultLimit = normalizedQuery ? 100 : matches.length;
    $("#workspace-search-summary").text(!normalizedQuery
        ? `${matches.length} block${matches.length === 1 ? "" : "s"} in this ${workspaceSearchSelectedCategory === "all" ? "workspace" : "category"}`
        : matches.length > resultLimit
            ? `Showing ${resultLimit} of ${matches.length} results`
            : `${matches.length} result${matches.length === 1 ? "" : "s"}`);

    if (matches.length === 0) {
        results.append(createWorkspaceSearchEmptyState("No results found", workspaceSearchSelectedCategory === "all"
            ? "Try another word, a shorter name, or text shown on a block."
            : "Try another word or choose All categories."));
        return;
    }

    // Render snapshots near the visible results instead of blocking every keystroke.
    const observer = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => {
        if (workspaceSearchPreviewObserver !== observer) return;
        entries.forEach(entry => {
            if (!entry.isIntersecting || !entry.target.isConnected) return;
            observer.unobserve(entry.target);
            const body = $(entry.target).find(".result-body");
            body.find(".workspace-search-block-preview.is-pending").remove();
            const block = blocklyWorkspace.getBlockById(entry.target.getAttribute("data-block-id"));
            if (block) appendWorkspaceSearchBlockPreview(body, block);
        });
    }, { root: results[0], rootMargin: "160px 0px" }) : null;
    workspaceSearchPreviewObserver = observer;

    const matchedIds = new Set(matches.map(block => block.id));
    const groups = categories.map(category => ({ category, matches: category.blocks.filter(block => matchedIds.has(block.id)), shown: [] }))
        .filter(group => group.matches.length);
    // Browse all blocks when the query is empty; share a search cap across categories.
    let remaining = resultLimit;
    while (remaining > 0) {
        let added = false;
        for (const group of groups) {
            if (!remaining) break;
            if (group.shown.length >= group.matches.length) continue;
            group.shown.push(group.matches[group.shown.length]);
            remaining--;
            added = true;
        }
        if (!added) break;
    }
    groups.forEach(({ category, matches: categoryMatches, shown }) => {
        if (!shown.length) return;
        const headingId = `workspace-search-heading-${category.id}`;
        const section = $("<section>").addClass("workspace-search-category").attr({ role: "group", "aria-labelledby": headingId });
        const heading = $("<header>").addClass("workspace-search-category-heading");
        const headingIcon = $("<span>").addClass("category-icon").attr("aria-hidden", "true");
        headingIcon.append(category.icon ? $("<img>").attr({ src: category.icon, alt: "" }) : $("<i>").addClass("fas fa-cubes"));
        heading.append(headingIcon)
            .append($("<h3>").attr("id", headingId).text(category.name))
            .append($("<span>").addClass("category-count").text(shown.length < categoryMatches.length
                ? `${shown.length} of ${categoryMatches.length}` : `${categoryMatches.length} result${categoryMatches.length === 1 ? "" : "s"}`));
        section.append(heading);
        results.append(section);
        shown.forEach(block => {
            const label = getWorkspaceBlockLabel(block);
            const kind = block.type.startsWith("procedures_") ? "Function"
                : block.type.startsWith("variables_") ? "Variable" : "Block";
            const icon = kind === "Function" ? "fa-code" : kind === "Variable" ? "fa-tag" : "fa-cube";
            const button = $("<button>").attr({
                type: "button",
                "data-block-id": block.id,
                "aria-label": `Go to block: ${label}`
            }).addClass("productivity-list-item");
            button.append($("<span>").addClass("result-icon").attr("aria-hidden", "true")
                .append($("<i>").addClass(`fas ${icon}`)));
            const body = $("<span>").addClass("result-body");
            body.append(
                $("<span>").addClass("item-copy")
                    .append(highlightWorkspaceSearchLabel($("<strong>").attr("title", label), label, normalizedQuery))
                    .append($("<small>").text(`${category.name} · ${block.type}`))
            );
            button.append(body);
            button.append($("<span>").addClass("result-action").attr("aria-hidden", "true")
                .append($("<span>").text("Go to block"))
                .append($("<i>").addClass("fas fa-arrow-right")));
            button.click(() => {
                focusWorkspaceBlock(block.id);
                closeWorkspaceSearch();
            });
            section.append(button);
            if (observer) {
                body.append($("<span>").addClass("workspace-search-block-preview is-pending").attr("aria-hidden", "true"));
                observer.observe(button[0]);
            } else {
                appendWorkspaceSearchBlockPreview(body, block);
            }
        });
    });
};

const openWorkspaceSearch = () => {
    if (useMode === "code" && editor) {
        editor.getAction("actions.find").run();
        return;
    }

    if ($("#workspace-search-dialog").hasClass("show")) {
        const input = document.getElementById("workspace-search-input");
        input.focus();
        input.select();
        return;
    }

    clearTimeout(workspaceSearchFocusTimer);
    workspaceSearchFocusTimer = null;
    $("#workspace-search-dialog").off("animationend.workspaceSearchFocus");
    const currentFocus = document.activeElement;
    workspaceSearchReturnFocus = currentFocus && currentFocus !== document.body
        ? currentFocus : document.getElementById("open-workspace-search");
    workspaceSearchSelectedCategory = "all";
    ShowDialog($("#workspace-search-dialog"));
    $("#workspace-search-input").val("");
    renderWorkspaceSearchResults("");
    setTimeout(() => $("#workspace-search-input").trigger("focus"), 20);
};

$("#open-workspace-search").click(openWorkspaceSearch);
$("#workspace-search-input").on("input", function() {
    renderWorkspaceSearchResults(this.value);
});
$("#workspace-search-category").on("change", function() {
    workspaceSearchSelectedCategory = this.value;
    renderWorkspaceSearchResults($("#workspace-search-input").val());
});
$("#workspace-search-clear").click(() => {
    $("#workspace-search-input").val("").trigger("input").trigger("focus");
});

$("#workspace-search-dialog .close-dialog").on("click", restoreWorkspaceSearchFocus);
$("#workspace-search-dialog").on("keydown", event => {
    if ((event.originalEvent && event.originalEvent.isComposing) || event.keyCode === 229) return;

    if (event.key === "Escape") {
        event.preventDefault();
        closeWorkspaceSearch();
        return;
    }

    const input = document.getElementById("workspace-search-input");
    const buttons = $("#workspace-search-results .productivity-list-item").toArray();
    const index = buttons.indexOf(event.target);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (event.target !== input && index < 0) return;
        if (!buttons.length) return;
        event.preventDefault();
        if (event.key === "ArrowUp" && index === 0) {
            input.focus();
            return;
        }
        const next = index < 0 ? (event.key === "ArrowDown" ? 0 : buttons.length - 1)
            : Math.min(buttons.length - 1, index + (event.key === "ArrowDown" ? 1 : -1));
        buttons[next].focus();
    } else if (event.key === "Enter" && event.target === input && buttons.length) {
        event.preventDefault();
        buttons[0].click();
    } else if (event.key === "Tab") {
        const focusable = $("#workspace-search-dialog").find("button, input, select").filter(":visible").toArray();
        if (event.shiftKey && event.target === focusable[0]) {
            event.preventDefault();
            focusable[focusable.length - 1].focus();
        } else if (!event.shiftKey && event.target === focusable[focusable.length - 1]) {
            event.preventDefault();
            focusable[0].focus();
        }
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
