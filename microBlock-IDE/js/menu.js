if (isElectron) {
    const { Menu, MenuItem } = remote;

    const getRecentProjectMenuItems = () => {
        let recentPaths = [];
        try {
            recentPaths = JSON.parse(localStorage.getItem("recentProjectPaths") || "[]");
            if (!Array.isArray(recentPaths)) recentPaths = [];
        } catch (error) {
            recentPaths = [];
        }

        recentPaths = recentPaths.filter(filePath => nodeFS.existsSync(filePath)).slice(0, 8);
        localStorage.setItem("recentProjectPaths", JSON.stringify(recentPaths));
        if (recentPaths.length === 0) {
            return [{ label: "No Recent Projects", enabled: false }];
        }

        return recentPaths.map(filePath => ({
            label: path.basename(filePath),
            sublabel: filePath,
            click: () => openProject(filePath)
        }));
    };

    const buildApplicationMenu = () => Menu.setApplicationMenu(Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                {
                    label: "New",
                    accelerator: 'Ctrl+N',
                    click: () => $("#new-project").click()
                },
                {
                    label: "Open",
                    accelerator: 'Ctrl+O',
                    click: () => $("#open-project").click()
                },
                {
                    label: "Recent Projects",
                    submenu: getRecentProjectMenuItems()
                },
                {
                    label: "Project History & Recovery",
                    click: () => $("#open-project-history").click()
                },
                {
                    label: "Save",
                    accelerator: 'Ctrl+S',
                    click: () => $("#save-project").click()
                },
                {
                    label: "Save As",
                    accelerator: 'Ctrl+Shift+S',
                    click: () => {
                        saveAsFlag = true;
                        $("#save-project").click();
                    }
                },
                {
                    label: "Export",
                    click: () => $("#code-share").click()
                },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'delete' },
                { type: 'separator' },
                { role: 'selectAll' },
                { type: 'separator' },
                {
                    label: "Find in Workspace",
                    accelerator: "Ctrl+F",
                    click: () => $("#open-workspace-search").click()
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forcereload' },
                { role: 'toggledevtools' },
                { type: 'separator' },
                { role: 'resetzoom' },
                { role: 'zoomin' },
                { role: 'zoomout' },
                { type: 'separator' },
                {
                    label: "Block Styles",
                    submenu: [
                        {
                            type: "radio",
                            label: "Geras",
                            click: () => selectRenderer("geras"),
                            checked: localStorage.getItem("renderer") === "geras"
                        },
                        {
                            type: "radio",
                            label: "Zelos",
                            click: () => selectRenderer("zelos"),
                            checked: localStorage.getItem("renderer") === "zelos"
                        },
                    ]
                },
                {
                    label: "Console",
                    submenu: [
                        {
                            type: "checkbox",
                            label: "Board initial",
                            click: e => localStorage.setItem("show-console-board-initial", e.checked ? "1" : "-1"),
                            checked: +localStorage.getItem("show-console-board-initial") !== -1
                        },
                        {
                            type: "checkbox",
                            label: "Upload",
                            click: e => localStorage.setItem("show-console-upload", e.checked ? "1" : "-1"),
                            checked: +localStorage.getItem("show-console-upload") !== -1
                        },
                    ]
                },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Board',
            submenu: [
                {
                    label: 'Upload',
                    click: () => $("#upload-program").click()
                },
                { type: 'separator' },
                {
                    label: 'Toggle Terminal',
                    click: () => $("#open-terminal").click()
                },
                {
                    label: 'Connect',
                    click: () => $("#connect-device").click()
                },
                {
                    label: 'Disconnect',
                    click: () => $("#disconnect-device").click()
                },
                { type: 'separator' },
                {
                    label: 'Update Firmware',
                    click: () => {
                        if (typeof globalThis.firmwareUpgradeFlow === "function") {
                            globalThis.firmwareUpgradeFlow();
                        } else {
                            console.error("firmwareUpgradeFlow is not available on globalThis");
                        }
                    }
                }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                { role: 'close' }
            ]
        },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Documentation',
                    click: () => $("#open-help").click()
                },
                { type: 'separator' },
                {
                    label: 'Join Us on Facebook',
                    click: () => shell.openExternal('https://www.facebook.com/innovativeexperiment/')
                },
                {
                    label: 'Report Issue',
                    click: () => shell.openExternal('https://github.com/inexglobal/microBlock-IDE/issues')
                },
                { type: 'separator' },
                {
                    label: 'Check of Updates...',
                    click: () => checkUpdate()
                },
                {
                    label: 'Download Last version',
                    click: () => shell.openExternal('https://github.com/inexglobal/microBlock-IDE/releases')
                },
                { type: 'separator' },
                {
                    label: 'About',
                    click: async () => {
                        dialog.showMessageBox({
                            type: "info",
                            title: "About",
                            message: `microBlock IDE offline version ${pjson.version}`
                        });
                    }
                },
            ]
        }
    ]));

    globalThis.refreshApplicationMenu = buildApplicationMenu;
    buildApplicationMenu();
}
