const { app, BrowserWindow, session, protocol } = require('electron')
const path = require('path');
var ipcMain = require('electron').ipcMain;

app.allowRendererProcessReuse = false;

global.sharedObj = {
    argv: process.argv,
    mainWin: null,
    dashboardWin: null,
    extensionDir: path.normalize(`${__dirname}/extension`),
    rootPath: path.normalize(`${__dirname}/microBlock-IDE`),
};

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'microblock',
        privileges: {
            standard: true,
            supportFetchAPI: true,
            secure: true
        }
    }
]);

function createWindow() {
    const partition = 'persist:microblock_dev'; // change from persist:microblock
    const ses = session.fromPartition(partition);

    // ses.protocol.registerFileProtocol('microblock', (request, callback) => {
    //     const url = request.url.substr(13);
    //     callback({ path: path.normalize(`${__dirname}/microBlock-IDE/${url}`) })
    // });
    ses.protocol.registerFileProtocol('microblock', (request, callback) => {
        try {
            const u = new URL(request.url);

            // English comments as requested:
            // Some URLs may come as microblock:///path (no hostname)
            // Others may come as microblock://hostname/path
            // We map both to a single local path under microBlock-IDE/
            const virtualPath = decodeURIComponent((u.hostname ? `/${u.hostname}` : '') + u.pathname);

            // Remove leading slashes to make path.join behave on Windows
            const rel = virtualPath.replace(/^\/+/, '');

            callback({ path: path.join(__dirname, 'microBlock-IDE', rel) });
        } catch (e) {
            // -6 = net::ERR_FILE_NOT_FOUND
            callback({ error: -6 });
        }
    });


    global.sharedObj.mainWin = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            webSecurity: false,
            nodeIntegration: true,
            partition
        },
        icon: path.join(__dirname, "microBlock-IDE/favicon.png")
    })
    // global.sharedObj.mainWin.loadFile("microBlock-IDE/index.html");
    global.sharedObj.mainWin.loadURL("microblock://./index.html");
    global.sharedObj.mainWin.maximize();

    // Open the DevTools.
    // mainWin.webContents.openDevTools()

    global.sharedObj.mainWin.on('close', () => {
        if (global.sharedObj.dashboardWin) {
            global.sharedObj.dashboardWin.close();
        }
    });
}

ipcMain.on("show-dashboard", (event) => {
    if (global.sharedObj.dashboardWin) {
        if (!global.sharedObj.dashboardWin.isDestroyed()) {
            global.sharedObj.dashboardWin.focus();
            return;
        }
    }

    global.sharedObj.dashboardWin = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true
        },
        icon: path.join(__dirname, "microBlock-IDE/favicon.png")
    });

    global.sharedObj.dashboardWin.loadFile("microBlock-IDE/dashboard/index.html");

    // global.sharedObj.dashboardWin.maximize();

    global.sharedObj.dashboardWin.on('close', () => {
        global.sharedObj.dashboardWin = null;
    });
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
    const ses = session.fromPartition('persist:microblock');
    await ses.clearStorageData(); // dev-only: clears localStorage/indexeddb/cache, etc.
    createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.