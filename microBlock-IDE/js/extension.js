const extensionIndexURL = "https://microblock-ide.github.io/microBlock-extension-index/main.json";
let extensionIndex = null;

let updateExtensionIndex = async () => {
    try {
        const response = await fetch(extensionIndexURL, { redirect: "follow" });
        if (!response.ok) throw new Error(`Extension index returned ${response.status}`);
        const index = await response.json();
        if (!index || typeof index !== "object" || Array.isArray(index)) throw new Error("Invalid extension index");
        extensionIndex = index;
        return true;
    } catch (error) {
        console.warn("Could not load extension index", error);
        NotifyE("Load extension index fail");
        return false;
    }
}

let installExtension = async (extensionId) => {
    if (!extensionIndex || typeof extensionIndex[extensionId] === "undefined") {
        NotifyE("Not found " + extensionId + " in extension index");
        return false;
    }
    const extension = extensionIndex[extensionId];
    const extensionLocalPath = `/extension/${extensionId}`;
    
    let downloadRepo = await downloadRepoFromGitHubStoreInFS(extension.github, extensionLocalPath, msg => NotifyE(msg));
    if (!downloadRepo) {
        NotifyE("Download " + extension.name + " fail");
        return false;
    }

    if (extension?.supportArduinoPlatform && Array.isArray(extension?.depends)) {
        await arduino_check_and_install_library(extension?.depends);
    }

    await updataWorkspaceAndCategoryFromvFS(true);

    NotifyS(`Install ${extension.name} extension successful`);
    saveCodeToLocal();

    return true;
}

let removeExtension = async (extensionId) => {
    // An extension ID is one directory name, never an arbitrary removal path.
    if (typeof extensionId !== "string" || !extensionId || extensionId === "."
        || extensionId === ".." || /[\\/]/.test(extensionId)) {
        NotifyE("Invalid extension ID");
        return false;
    }
    fs.remove(`/extension/${extensionId}`);
    if (isElectron) {
        const extensionRoot = path.resolve(sharedObj.extensionDir);
        const extensionPath = path.resolve(extensionRoot, extensionId);
        if (extensionPath === extensionRoot || path.dirname(extensionPath) !== extensionRoot) {
            throw new Error("Extension removal must stay inside the extension directory");
        }
        if (nodeFS.existsSync(extensionPath)) {
            nodeFS.rmdirSync(extensionPath, { recursive: true });
        }
    }

    await updataWorkspaceAndCategoryFromvFS(true);

    NotifyS(`Uninstall ${extensionId} successful`);
    saveCodeToLocal();

    return true;
}

$("#open-extension-dialog").click(async () => {
    $("#extension-dialog .extension-list").html('');

    ShowDialog($("#extension-dialog"));

    Notiflix.Block.Standard("#extension-dialog > section", 'Loading...');

    if (!extensionIndex) {
        if (!(await updateExtensionIndex())) {
            // Installed extensions remain usable when offline or the index is down.
            const installed = {};
            for (const record of await getInstalledExtensionRecords()) {
                installed[record.id] = { ...record.extension, icon: record.icon };
            }
            await showExtensionList(installed);
            $(".extension-category-list > li").removeClass("active").filter(function() {
                return $(this).text() === "Installed";
            }).addClass("active");
            Notiflix.Block.Remove("#extension-dialog > section");
            return;
        }
    }

    $(".extension-category-list > li:first-child").click();
    
    Notiflix.Block.Remove("#extension-dialog > section");
});

let uploadModuleList = [];

Blockly.Python.addUploadModule = (module) => {
    uploadModuleList.push(module);
}

$("#open-extension-creator").click(() => {
    $(".add-extension-box").fadeIn();
});

let showExtensionList = async (extensionList) => {
    $("#extension-dialog .extension-list").html('');

    const extensionInstalledIds = new Set((await getInstalledExtensionSources()).map(source => source.id));
    const board = boards.find(board => board.id === boardId);
    for (const [id, info] of Object.entries(extensionList)) {
        if (Array.isArray(info?.chip) && (!info.chip.includes(board?.chip))) { // Skip if chip not support
            continue;
        }

        if (board?.isArduinoPlatform && (!info?.supportArduinoPlatform)) { // Skip if Arduino and extension not defined support Arduino
            continue;
        }

        $("#extension-dialog .extension-list").append(`
        <li>
            <div class="extension-box${extensionInstalledIds.has(id) ? " installed" : ""}" data-extension-id="${id}">
                <div class="header">
                    <div class="cover">
                        <img src="${info.icon}" alt="${info.name}">
                    </div>
                    <div class="detail">
                        <div class="name">${info.name}<span class="installed-icon"><i class="fas fa-check-circle"></i></span></div>
                        <div class="author">${info.author ? info.author : 'None'}</div>
                        <div class="other">
                            <span class="version" style="background-color: ${info.color}">${info.version ? info.version : 'None'}</span>
                            <a href=";" onclick="shell.openExternal('${info.github ? info.github : '#'}'); return false;" target="_blank"><i class="fab fa-github"></i></a>
                        </div>
                    </div>
                </div>
                <div class="description">${info.description ? info.description : '<i>No description</i>'}</div>
                <div class="button">
                    <button class="extension-install"><i class="fas fa-download"></i> Install</button>
                    <button class="extension-uninstall"><i class="fas fa-trash-alt"></i> Uninstall</button>
                </div>
            </div>
        </li>
        `);
    }

    $(".extension-install").click(async function() {
        let extensionId = $(this).parents(".extension-box").attr("data-extension-id");
        let queryBox = `.extension-box[data-extension-id='${extensionId}']`;
        Notiflix.Block.Standard(queryBox, 'Installing...');

        try {
            if (await installExtension(extensionId)) {
                $(queryBox).addClass("installed");
            }
        } catch (error) {
            console.error("Could not install extension", extensionId, error);
            NotifyE("Install extension fail");
        } finally {
            Notiflix.Block.Remove(queryBox);
        }
    });

    $(".extension-uninstall").click(async function() {
        let extensionId = $(this).parents(".extension-box").attr("data-extension-id");
        let queryBox = `.extension-box[data-extension-id='${extensionId}']`;

        try {
            if (await removeExtension(extensionId)) {
                $(queryBox).removeClass("installed");
            }
        } catch (error) {
            console.error("Could not uninstall extension", extensionId, error);
            NotifyE("Uninstall extension fail");
        }
    });
}

$(".extension-category-list > li").click(async function() {
    let categoryName = $(this).text();

    let extensionList = { };
    if (categoryName != "Installed") {
        for (const [id, info] of Object.entries(extensionIndex || {})) {
            if (categoryName !== "All" && categoryName !== info.category) {
                continue;
            }
            extensionList[id] = JSON.parse(JSON.stringify(info));
            extensionList[id].icon = `${info.github}/raw/master/${info.icon}`;
        }
    } else {
        for (const record of await getInstalledExtensionRecords()) {
            extensionList[record.id] = { ...record.extension, icon: record.icon };
        }
    }

    await showExtensionList(extensionList);

    $(".extension-category-list > li").removeClass("active");
    $(this).addClass("active");
});

$("#extension-keyword").keyup(async function() {
    let keyword = $(this).val().toLowerCase();

    $(".extension-category-list > li").removeClass("active");

    let extensionList = { };
    for (const [id, info] of Object.entries(extensionIndex || {})) {
        if (info.name.toLowerCase().indexOf(keyword) < 0) {
            continue;
        }
        extensionList[id] = JSON.parse(JSON.stringify(info));
        extensionList[id].icon = `${info.github}/raw/master/${info.icon}`;
    }

    await showExtensionList(extensionList);
});

$("#form-add-extension").submit(async function(e) {
    e.preventDefault();

    let gitHubURL = $("#extension-github-url").val().match(/https:\/\/github\.com\/[^\/]+\/[^\/]+/);
    if (gitHubURL == null) {
        NotifyE("GitHub url not match");
        return;
    }
    gitHubURL = gitHubURL[0];

    Notiflix.Block.Standard(".add-extension-box", 'Loading...');

    // Call to API, See microBlock Back-end: https://github.com/microBlock-IDE/microBlock-backend
    let addExtensionToIndex = await fetch("https://us-central1-ublock-c0a08.cloudfunctions.net/extension", { 
        method: "post",
        body: gitHubURL,
        redirect: "follow"
    });
    let rosAddExtension = await addExtensionToIndex.json();
    if (addExtensionToIndex.status !== 200) {
        console.log("Add extension error", rosAddExtension);
        NotifyE("Add extension error, See console to more detail");
    } else {
        NotifyS(`Add/Update ${rosAddExtension.extension.name} extension successful`);
        $("#extension-github-url").val("");
    }

    Notiflix.Block.Remove(".add-extension-box");
});

$("#form-add-extension button[type='reset']").click(() => {
    $(".add-extension-box").fadeOut();
});

// $("#open-extension-dialog").click();
