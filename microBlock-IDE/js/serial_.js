let serialPort = null;
let writer = null, reader = null;
let serialLastData = "";

// Serial freshness timestamp (used by fast-fail checks)
let serialLastRxAt = 0;

// Prevent duplicate upload click / concurrent upload flows
let uploadInProgress = false;

// Active upload method (for forceAbort when disconnect/error occurs)
let activeUploadMethod = null;

let RawREPLMode = false;

// ------------------------------
// Prompt detection helpers (tolerant for RP2350 logs)
// ------------------------------
function sanitizeSerialText(s) {
    if (!s) return "";
    return String(s)
        // ANSI escape
        .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
        // remove control chars except \n \t
        .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "")
        // normalize line endings
        .replace(/\r/g, "\n");
}

function hasRecentPrompt(rawMode = RawREPLMode) {
    let s = sanitizeSerialText(serialLastData || "");
    if (s.length > 500) s = s.slice(-500);

    if (!rawMode) {
        // Normal REPL prompt: >>> or >>> 
        return /(?:^|\n)>>> ?(?:\n|$)/.test(s) || s.endsWith(">>>") || s.endsWith(">>> ");
    } else {
        // Raw REPL prompt: >
        return /(?:^|\n)> ?(?:\n|$)/.test(s) || s.endsWith(">");
    }
}

let microPythonIsReadyNextCommand = () => {
    return hasRecentPrompt(RawREPLMode);
};

async function waitPrompt(timeoutMs = 1200, pollMs = 20, rawMode = RawREPLMode) {
    const tEnd = Date.now() + timeoutMs;
    while (Date.now() < tEnd) {
        if (hasRecentPrompt(rawMode)) return true;
        await sleep(pollMs);
    }
    return false;
}
function getMSCUserErrorMessage(e) {
    const code = e && e.code ? String(e.code) : "";
    const msg = (e && e.message ? String(e.message) : String(e)).toLowerCase();
    const stderr = (e && e.detail && e.detail.stderr ? String(e.detail.stderr) : "").toLowerCase();
    const all = `${code.toLowerCase()} ${msg} ${stderr}`;

    // Real disk full / no space
    if (
        all.includes("enospc") ||
        all.includes("no space left on device") ||
        all.includes("disk full")
    ) {
        return "Not enough space on the MSC drive, or the directory is near its file entry limit.";
    }

    // Locked / permission / busy (common false-full cases)
    if (
        all.includes("eperm") ||
        all.includes("eacces") ||
        all.includes("access denied") ||
        all.includes("permission denied")
    ) {
        return "Cannot write to the MSC drive (file/drive may be locked). Please close Explorer/Finder and try again.";
    }

    if (
        all.includes("ebusy") ||
        all.includes("resource busy") ||
        all.includes("device or resource busy")
    ) {
        return "The MSC drive is busy. Please wait a moment and try again.";
    }

    if (code === "WRITE_TIMEOUT") {
        return "Writing to the MSC drive timed out. Please try again.";
    }

    if (code === "MSC_NOT_ACCESSIBLE") {
        return "Cannot access the MSC drive. Please check the connection or reset hardware and try again.";
    }

    if (code === "MSC_DRIVE_NOT_FOUND") {
        return "MSC drive not found.";
    }

    if (code === "MSC_DRIVE_AMBIGUOUS") {
        return "Multiple drives with the same MSC size were found. Please disconnect other removable drives and try again.";
    }

    return null; // fallback to generic message
}
// ------------------------------
// Upload state reset / abort helpers
// ------------------------------
function resetUploadRunningState(reason = "") {
    uploadInProgress = false;
    try { $("#upload-program").removeClass("loading"); } catch (_) {}

    if (reason) {
        console.warn("[UPLOAD RESET]", reason);
        try { statusLog(`Upload reset: ${reason}`); } catch (_) {}
    }
}

async function abortCurrentUpload(reason = "") {
    try {
        if (activeUploadMethod && typeof activeUploadMethod.forceAbort === "function") {
            await activeUploadMethod.forceAbort();
        }
    } catch (e) {
        console.warn("abortCurrentUpload warning:", e);
    } finally {
        activeUploadMethod = null;
        resetUploadRunningState(reason || "aborted");
    }
}

// ------------------------------
// MSC upload helper utilities
// ------------------------------
class UploadMSCError extends Error {
    constructor(code, message, detail = null) {
        super(message);
        this.name = "UploadMSCError";
        this.code = code;
        this.detail = detail;
    }
}

function withTimeout(promise, ms, err) {
    let timer = null;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => {
                if (err instanceof Error) reject(err);
                else reject(new Error(String(err || "Timeout")));
            }, ms);
        })
    ]).finally(() => {
        if (timer) clearTimeout(timer);
    });
}

// NOTE: microBlock renderer loader may block require("fs").
// So this probe MUST NOT use require("fs") in renderer.
// async function checkPathWritableFast(targetPath, timeoutMs = 700) {
//     if (!targetPath) {
//         throw new UploadMSCError("MSC_NOT_ACCESSIBLE", "MSC path is empty");
//     }

//     // Hotfix: use fixed probe filename (avoid accumulating many probe files)
//     const probePath = path.join(targetPath, "/", ".__mb_probe__.tmp");

//     try {
//         // overwrite same file every time
//         await writeMSCFileWithTimeout(probePath, "", Math.max(400, timeoutMs));
//     } catch (e) {
//         throw new UploadMSCError("MSC_NOT_ACCESSIBLE", `MSC path not accessible: ${targetPath}`, e);
//     }

//     // Best-effort cleanup (optional)
//     // If delete fails, it's okay because next probe reuses same filename.
//     try {
//         if (typeof nodeFS !== "undefined") {
//             if (typeof nodeFS.rm === "function") {
//                 await nodeFS.rm(probePath);
//             } else if (typeof nodeFS.unlink === "function") {
//                 await nodeFS.unlink(probePath);
//             }
//         }
//     } catch (_) {
//         // ignore cleanup error
//     }

//     return true;
// }
async function killChildProcessHard(child) {
    if (!child || !child.pid) return;

    if (os.platform() === "win32") {
        await new Promise(resolve => {
            const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
                windowsHide: true,
                stdio: "ignore",
                shell: false
            });
            killer.on("error", () => resolve());
            killer.on("exit", () => resolve());
        });
    } else {
        try {
            child.kill("SIGKILL");
        } catch (e) {
            // Ignore
        }
    }
}

async function writeMSCFileWithTimeout(filePath, content, timeoutMs = 2500) {
    // Writing to MSC can hang in OS I/O.
    // Use child process so the main UI/upload flow can recover quickly.
    return new Promise((resolve, reject) => {
        let child;
        let done = false;
        let stderr = "";

        const finish = (fn) => (...args) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            fn(...args);
        };

        const script = `
const fs = require("fs");
const p = ${JSON.stringify(filePath)};
const c = ${JSON.stringify(content)};
fs.writeFile(p, c, (err) => {
    if (err) {
        console.error(
    (err && err.code ? String(err.code) + " " : "") +
    (err && err.message ? String(err.message) : String(err))
);
        process.exit(2);
    }
    process.exit(0);
});
`;

        try {
            child = spawn(process.execPath, ["-e", script], {
                windowsHide: true,
                stdio: ["ignore", "ignore", "pipe"],
                env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: "1" })
            });
        } catch (e) {
            reject(new UploadMSCError("WRITE_CHILD_START_FAIL", "Cannot start MSC write child process", e));
            return;
        }

        if (child.stderr) {
            child.stderr.on("data", d => {
                stderr += d.toString();
            });
        }

        const timer = setTimeout(async () => {
            try {
                await killChildProcessHard(child);
            } catch (e) {
                // Ignore
            }

            finish(reject)(
                new UploadMSCError("WRITE_TIMEOUT", `MSC write timeout (${timeoutMs} ms)`, { filePath })
            );
        }, timeoutMs);

        child.on("error", finish((err) => {
            reject(new UploadMSCError("WRITE_CHILD_ERROR", "MSC write child process error", err));
        }));

        child.on("exit", finish((code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new UploadMSCError("WRITE_FAILED", "MSC write failed", {
                    code,
                    stderr: stderr.trim(),
                    filePath
                }));
            }
        }));
    });
}

// ------------------------------
// Serial write helpers (wrapped to abort upload on COM errors)
// ------------------------------
function wrapSerialWriteError(e) {
    const msg = (e && e.message) ? e.message : String(e);
    if (/GetOverlappedResult|Unknown error code 31|port/i.test(msg)) {
        return new UploadMSCError("SERIAL_WRITE_FAIL", "Serial write failed (port disconnected/reset?)", e);
    }
    return (e instanceof Error) ? e : new Error(msg);
}

async function writeSerial(text) {
    if (!serialPort) {
        throw new UploadMSCError("SERIAL_DISCONNECTED", "Serial port is not connected");
    }

    try {
        if (!isElectron) {
            let data = new TextEncoder("utf-8").encode(text);
            let buff = new ArrayBuffer(data.length);
            let view = new Uint8Array(buff);
            view.set(data);
            await writer.write(buff);
        } else {
            let buff = Buffer.from(text, "binary");
            await new Promise((resolve, reject) => {
                if (!serialPort) return reject(new UploadMSCError("SERIAL_DISCONNECTED", "Serial port closed"));
                serialPort.write(buff, (err) => err ? reject(err) : resolve());
            });
        }
    } catch (e) {
        const err = wrapSerialWriteError(e);
        await abortCurrentUpload(err.message);
        throw err;
    }
}

async function writeSerialByte(data) {
    if (!serialPort) {
        throw new UploadMSCError("SERIAL_DISCONNECTED", "Serial port is not connected");
    }

    try {
        if (!isElectron) {
            let buff = new Uint8Array([data]);
            await writer.write(buff);
        } else {
            let b = Buffer.from([data]);
            await new Promise((resolve, reject) => {
                if (!serialPort) return reject(new UploadMSCError("SERIAL_DISCONNECTED", "Serial port closed"));
                serialPort.write(Buffer.from(b), (err) => err ? reject(err) : resolve());
            });
        }
    } catch (e) {
        const err = wrapSerialWriteError(e);
        await abortCurrentUpload(err.message);
        throw err;
    }
}

async function writeSerialBytes(data) {
    if (!serialPort) {
        throw new UploadMSCError("SERIAL_DISCONNECTED", "Serial port is not connected");
    }

    try {
        if (!isElectron) {
            await writer.write(new Uint8Array(data));
        } else {
            let b = Buffer.from(data);
            let writeSize = 0;
            while (writeSize < b.length) {
                const len = Math.min(1024, b.length - writeSize);
                const block = b.slice(writeSize, writeSize + len);
                await new Promise((resolve, reject) => {
                    if (!serialPort) return reject(new UploadMSCError("SERIAL_DISCONNECTED", "Serial port closed"));
                    serialPort.write(block, (err) => err ? reject(err) : resolve());
                });
                writeSize += len;
            }
        }
    } catch (e) {
        const err = wrapSerialWriteError(e);
        await abortCurrentUpload(err.message);
        throw err;
    }
}

// ------------------------------
// Serial connect (Web)
// ------------------------------
let serialConnectWeb = async () => {
    navigator.serial.ondisconnect = () => {
        NotifyW("Serial port disconnect");
        $("#port-name").text(`DISCONNECT`);
        statusLog("Serial port disconnect");
        $("#disconnect-device").hide();
        $("#connect-device").show();

        // NEW: unlock upload if running
        abortCurrentUpload("webserial disconnected");

        serialPort = null;
        if (dashboardIsReady) {
            dashboardWin.serialStatusUpdate("disconnect");
        }
        if (term) {
            term.dispose();
            term = null;
        }
    };

    try {
        serialPort = await navigator.serial.requestPort();
    } catch (e) {
        NotifyE("You haven't selected port");
        console.log(e);
        return false;
    }

    try {
        await serialPort.open({ baudrate: 115200 });
    } catch (e) {
        if (e.toString().indexOf("Failed to read the 'baudRate' property") >= 0) { // New version of Google Chrome ?
            try {
                await serialPort.open({ baudRate: 115200 });
            } catch (e2) {
                NotifyE("Can't open serial port, some program use this port ?");
                console.log(e2);
                serialPort = null;
                return false;
            }
        } else {
            NotifyE("Can't open serial port, some program use this port ?");
            console.log("Error in try 2", e);
            serialPort = null;
            return false;
        }
    }

    NotifyS("Serial port connected");
    statusLog("Serial port connected");
    $("#port-name").text(`CONNECTED`);
    if (dashboardIsReady) {
        dashboardWin.serialStatusUpdate("connected");
    }

    writer = serialPort.writable.getWriter();

    term = new Terminal();
    if (!fitAddon) fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open($("#terminal > section")[0]);
    try {
        fitAddon.fit();
    } catch (e) {
        // Ignore
    }

    serialPort.readable.pipeTo(new WritableStream({
        write(chunk) {
            serialLastRxAt = Date.now();

            if (!firmwareUpdateMode) {
                for (let key of chunk) {
                    const ch = String.fromCharCode(key);
                    term.write(ch);
                    serialLastData += ch;
                }
                if (serialLastData.length > 600) {
                    serialLastData = serialLastData.substring(serialLastData.length - 600);
                }
                if (dashboardIsReady) {
                    dashboardWin.streamDataIn(chunk);
                }
            } else {
                inputBuffer = inputBuffer.concat(Array.from(chunk));
                console.log(inputBuffer);
            }
        }
    })).catch(err => {
        console.warn("WebSerial pipeTo ended:", err);
        abortCurrentUpload("webserial pipe ended");
    });

    term.onData((data) => {
        writeSerial(data);
    });

    $("#disconnect-device").show();
    $("#connect-device").hide();

    return true;
};

// ------------------------------
// Port select dialog (Electron)
// ------------------------------
let showPortSelect = () => {
    return (new Promise(async (resolve, reject) => {
        $("#port-list").html("");
        for (let port of (await serialAPI.list())) {
            $("#port-list").append(`<li data-port="${port.path}"><i class="fab fa-usb"></i> ${port.path} - ${port.manufacturer}</li>`);
        }

        $("#port-list > li").click(function() {
            $("#github-repository-list > li").removeClass("active");
            $(this).addClass("active");
        });

        $("#port-select-button").click(function() {
            let select_port = $("#port-list > li.active").attr("data-port");
            if (select_port) {
                resolve(select_port);
            } else {
                reject("not_select");
            }
            $("#port-select-dialog").hide();
        });

        $("#port-select-dialog .close-btn").click(() => {
            reject("cancle");
            $("#port-select-dialog").hide();
        });

        $("#port-select-dialog").show();
    }));
};

// ------------------------------
// Serial connect (Electron)
// ------------------------------
let serialConnectElectron = async (portName = "", autoConnect = false, uploadMode = false) => {
    if (!portName) {
        try {
            portName = await showPortSelect();
        } catch (e) {
            NotifyE("You not select port");
            console.log(e);
            return false;
        }
    }

    try {
        await (new Promise((resolve, reject) => {
            serialPort = new serialAPI(portName, { baudRate: 115200 }, err => {
                if (err) reject(err);
                else resolve();
            });
        }));
    } catch (e) {
        if (!autoConnect) NotifyE("Can't open serial port, some program use this port ?");
        console.log(e);
        serialPort = null;
        return false;
    }

    NotifyS("Serial port connected");
    statusLog("Serial port connected");
    $("#port-name").text(`CONNECTED (${portName})`);
    if (sharedObj.dashboardWin) {
        sharedObj.dashboardWin.webContents.send("serial-status", "connected");
    }

    try {
        serialPort.set({
            dtr: true,
            rts: true
        });
    } catch (e) {
        console.warn("serialPort.set init warning:", e);
    }

    serialPort.on("close", () => {
        NotifyW("Serial port disconnect");
        $("#port-name").text(`DISCONNECT`);
        $("#disconnect-device").hide();
        $("#connect-device").show();

        // NEW: unlock upload flow if it was running
        abortCurrentUpload("serial port closed");

        if (sharedObj.dashboardWin) {
            sharedObj.dashboardWin.webContents.send("serial-status", "disconnect");
        }

        serialPort = null;

        if (term) {
            term.dispose();
            term = null;
        }
    });

    serialPort.on("error", (err) => {
        console.warn("Serial port error:", err);
        abortCurrentUpload("serial port error");
    });

    term = new Terminal();
    if (!fitAddon) fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open($("#terminal > section")[0]);
    try {
        fitAddon.fit();
    } catch (e) {
        // Ignore
    }

    serialPort.on("data", (chunk) => {
        serialLastRxAt = Date.now();

        if (!firmwareUpdateMode) {
            term.write(chunk);

            let textChunk = "";
            if (typeof chunk === "string") {
                textChunk = chunk;
            } else if (typeof Buffer !== "undefined" && Buffer.isBuffer(chunk)) {
                textChunk = chunk.toString("utf8");
            } else if (chunk instanceof Uint8Array) {
                textChunk = new TextDecoder("utf-8").decode(chunk);
            } else {
                textChunk = String(chunk);
            }

            serialLastData += textChunk;
            if (serialLastData.length > 600) {
                serialLastData = serialLastData.substring(serialLastData.length - 600);
            }

            if (sharedObj.dashboardWin) {
                sharedObj.dashboardWin.webContents.send("serial-data-in", chunk);
            }
        } else {
            inputBuffer = inputBuffer.concat(Array.from(chunk));
        }
    });

    term.onData((data) => {
        writeSerial(data);
    });

    $("#disconnect-device").show();
    $("#connect-device").hide();

    skipFirmwareUpgrade = false;

    return true;
};

let serialConnect = () => {
    uploadFileLog = {};
    return (!isElectron) ? serialConnectWeb() : serialConnectElectron();
};

// ------------------------------
// Hard reset board (safe Electron race handling)
// ------------------------------
let boardReset = (enterToBootMode) => { // Hard-reset
    if (typeof enterToBootMode === "undefined") {
        enterToBootMode = false;
    }

    return new Promise(async (resolve, reject) => {
        if (!serialPort) {
            return reject(new UploadMSCError("SERIAL_DISCONNECTED", "Serial port is not connected"));
        }

        if (!enterToBootMode) {
            if (!isElectron) { // Web
                try {
                    await serialPort.setSignals({
                        dataTerminalReady: true,
                        requestToSend: true
                    });
                    await serialPort.setSignals({
                        dataTerminalReady: false,
                        requestToSend: true
                    });
                    await serialPort.setSignals({
                        dataTerminalReady: true,
                        requestToSend: true
                    });
                    resolve();
                } catch (e) {
                    reject(e);
                }
            } else { // Electron
                const portRef = serialPort; // capture reference to avoid null race

                const safeSet = (signals) => new Promise((res, rej) => {
                    if (!portRef) return rej(new UploadMSCError("SERIAL_DISCONNECTED", "Serial port closed"));
                    portRef.set(signals, (err) => {
                        if (err) rej(err);
                        else res();
                    });
                });

                try {
                    await safeSet({ dtr: true,  rts: true  });  // EN=1, BOOT=1
                    await safeSet({ dtr: false, rts: true  });  // EN=0, BOOT=1
                    await sleep(50);
                    await safeSet({ dtr: true,  rts: true  });  // EN=1, BOOT=1
                    resolve();
                } catch (e) {
                    reject(e);
                }
            }
        } else {
            if (!isElectron) { // Web
                try {
                    await serialPort.setSignals({
                        dataTerminalReady: 0,
                        requestToSend: 1
                    });
                    await sleep(50);
                    await serialPort.setSignals({
                        dataTerminalReady: 1,
                        requestToSend: 0
                    });
                    await sleep(500);
                    await serialPort.setSignals({
                        dataTerminalReady: 0,
                        requestToSend: 0
                    });
                    await sleep(100);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            } else { // Electron
                const portRef = serialPort;

                const safeSet = (signals) => new Promise((res, rej) => {
                    if (!portRef) return rej(new UploadMSCError("SERIAL_DISCONNECTED", "Serial port closed"));
                    portRef.set(signals, (err) => {
                        if (err) rej(err);
                        else res();
                    });
                });

                try {
                    console.log("Try to BOOT mode");
                    await safeSet({ dtr: 0, rts: 1 }); // EN=1, BOOT=0
                    await sleep(300);
                    await safeSet({ dtr: 1, rts: 0 }); // EN=0, BOOT=1
                    await safeSet({ dtr: 0, rts: 0 }); // EN=1, BOOT=1
                    resolve();
                } catch (e) {
                    reject(e);
                }
            }
        }
    });
};

// ------------------------------
// Upload via special boot protocol
// ------------------------------
class UploadOnBoot {
    constructor() {}

    async start() {
        serialLastData = "";
        await boardReset();
        if (!await this.checkEndWith("wait upload\r\n", 50, 50)) {
            throw "wait upload keyword timeout, only can use old method ?";
        }

        serialLastData = "";
        await writeSerialBytes([0x1F, 0xF1, 0xFF]); // Sync bytes
        if (!await this.checkEndWith("upload mode\r\n", 100, 30)) {
            throw "Send sync bytes fail";
        }
    }

    async getFirmwareInfo() {
        serialLastData = "";
        await this.sendCmd(0x01);
        if (!await this.checkEndWith("\r\n", 50, 30)) {
            throw "Device not respond";
        }

        let checkVersion = /MicroPython\s+([^\s]+)\s+on\s+([0-9\-]+);\s?(.+)\s+with\s+([^\s]+)$/m.exec(serialLastData);
        if (!checkVersion) {
            throw "Check version fail";
        }

        return {
            version: checkVersion[1],
            date: checkVersion[2],
            board: checkVersion[3],
            cpu: checkVersion[4]
        };
    }

    async upload(fileName, content) {
        if (content.length == 0) {
            content = "#No Code";
        }

        serialLastData = "";
        await this.sendCmd(0x10, fileName);
        if (!await this.checkEndWith(`set path to ${fileName}\r\n`, 50, 20)) {
            throw "Set path fail !";
        }

        for (const chunkContent of content.match(/.{1,10000}/gs)) {
            serialLastData = "";
            await this.sendCmd(0x11, chunkContent);
            if (!await this.checkEndWith("write end\r\n", 50, 100)) {
                throw "Error, write file fail !";
            }
        }
    }

    async end() {
        serialLastData = "";
        await this.sendCmd(0xFF);
        if (!await this.checkIndexOf("exit upload mode\r\n", 50, 50)) {
            throw "exit upload mode fail";
        }
    }

    async sendCmd(cmd, data) {
        let encodeData = new TextEncoder("utf-8").encode(data);
        let content = [];
        content.push(cmd);
        if (typeof data !== "undefined") {
            content.push((encodeData.length >> 8) & 0xFF);
            content.push(encodeData.length & 0xFF);
            content = content.concat(Array.from(encodeData));
            let dataSum = 0;
            for (let index = 0; index < encodeData.length; index++) {
                dataSum += encodeData[index];
                dataSum = dataSum & 0xFF;
            }
            content.push(dataSum);
        }
        await writeSerialBytes(content);
    }

    async checkEndWith(str, delay = 100, max_try = 10) {
        let okFlag = false;
        for (let i = 0; i < max_try; i++) {
            await sleep(delay);
            if (serialLastData.endsWith(str)) {
                okFlag = true;
                break;
            }
        }
        return okFlag;
    }

    async checkIndexOf(str, stop = 100, max_try = 10) {
        let okFlag = false;
        for (let i = 0; i < max_try; i++) {
            await sleep(stop);
            if (serialLastData.indexOf(str) >= 0) {
                okFlag = true;
                break;
            }
        }
        return okFlag;
    }
}

// ------------------------------
// Upload via REPL / Raw REPL (kept for compatibility, but MSC branch won't fallback)
// ------------------------------
class UploadViaREPL {
    constructor() {
        RawREPLMode = false;
    }

    async start() {
        if (!serialLastData.endsWith(">>>") && serialLastData.endsWith(">")) { // Raw REPL mode ?
            serialLastData = "";
            RawREPLMode = true;
            await this.sendByteLoopWaitNextCommand(2, 100, 5); // Ctrl + B, Exit Raw REPL
        }
        RawREPLMode = false;

        serialLastData = "";
        if (!await this.sendByteLoopWaitNextCommand(3, 100, 100)) { // Ctrl + C
            throw "Access to MicroPython error";
        }

        serialLastData = "";
        await writeSerialByte(4); // Soft reset
        await sleep(300);

        if (!await this.sendByteLoopWaitNextCommand(3, 100, 100)) { // Ctrl + C
            throw "Exit main program error";
        }

        let checkVersion = /MicroPython\s+([^\s]+)\s+on\s+([0-9\-]+);\s?(.+)\s+with\s+([^\s]+)$/m.exec(serialLastData);
        if (checkVersion) {
            this.firmwareInfo = {
                version: checkVersion[1],
                date: checkVersion[2],
                board: checkVersion[3],
                cpu: checkVersion[4]
            };
        }

        RawREPLMode = true;
        if (!await this.sendByteLoopWaitNextCommand(1, 50, 100)) { // Ctrl + A, Enter to Raw REPL
            throw "Enter to Raw REPL fail";
        }
    }

    async getFirmwareInfo() {
        return this.firmwareInfo;
    }

    async upload(fileName, content) {
        if (content.length == 0) {
            content = "#No Code";
        }

        let board = boards.find(board => board.id === boardId);
        const chipId = board?.chip || "ESP32";

        let firstWriteFlag = true;
        serialLastData = "";
        let chunkContent1Array = [];
        if (chipId === "ESP32") {
            chunkContent1Array = content.match(/.{1,500}/gs);
        } else if (chipId.indexOf("RP2") >= 0) {
            chunkContent1Array = content.match(/.{1,2048}/gs);
        }

        for (const chunkContent1 of chunkContent1Array) {
            serialLastData = "";
            if (!await this.sendLineLoopWaitMatch(`f = open("${fileName}", "${firstWriteFlag ? 'w' : 'a'}");w=f.write;p=print`, /OK[^>]*>$/gm, isElectron ? 50 : 100, 20)) {
                throw `open file ${fileName} fail !`;
            }

            if (chipId === "ESP32") {
                for (const chunkContent2 of chunkContent1.match(/.{1,100}/gs)) {
                    serialLastData = "";
                    if (!await this.sendLineLoopWaitMatch(`p(w(${JSON.stringify(chunkContent2).replace(/[\u007F-\uFFFF]/g, chr => "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4))}))`, /OK[0-9]{1,3}[^>]*>/gm, isElectron ? 50 : 100, 20)) {
                        throw `write ${chunkContent2.length} fail !`;
                    }

                    let n = /OK([0-9]{1,3})[^>]*>/gm.exec(serialLastData);
                    if (!n) {
                        throw "Match fail";
                    }

                    let cUTF8 = chunkContent2.match(/[\u007F-\uFFFF]/g);
                    let sendN = chunkContent2.length + (cUTF8 ? cUTF8.length * 2 : 0);
                    if (+n[1] !== sendN) {
                        throw `Data lost ? Send: ${sendN}, Ros: ${+n[1]}`;
                    }
                }
            } else if (chipId.indexOf("RP2") >= 0) {
                serialLastData = "";
                if (!await this.sendLineLoopWaitMatch(`p(w(${JSON.stringify(chunkContent1).replace(/[\u007F-\uFFFF]/g, chr => "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4))}))`, /OK[0-9]{1,4}[^>]*>/gm, isElectron ? 50 : 100, 20)) {
                    throw `write ${chunkContent1.length} fail !`;
                }

                let n = /OK([0-9]{1,4})[^>]*>/gm.exec(serialLastData);
                if (!n) {
                    throw "Match fail";
                }

                let cUTF8 = chunkContent1.match(/[\u007F-\uFFFF]/g);
                let sendN = chunkContent1.length + (cUTF8 ? cUTF8.length * 2 : 0);
                if (+n[1] !== sendN) {
                    throw `Data lost ? Send: ${sendN}, Ros: ${+n[1]}`;
                }
            }

            serialLastData = "";
            if (!await this.sendLineLoopWaitMatch(`f.close()`, /OK[^>]*>$/gm, isElectron ? 300 : 500, 20)) {
                throw `close file ${fileName} fail !`;
            }

            firstWriteFlag = false;
        }
    }

    async end() {
        await writeSerialByte(2); // Ctrl + B, Exit from Raw REPL
        RawREPLMode = false;

        let board = boards.find(board => board.id === boardId);
        if (board?.chip.indexOf("RP2") >= 0) {
            await writeSerialByte(4); // Soft reset
            await sleep(300);
        } else {
            await this.writeSerialNewLine(`exec(open("main.py", "r").read(),globals())`);
        }
    }

    async sendByteLoopWaitNextCommand(data, delay = 100, max_try = 5) {
        let okFlag = false;
        for (let i = 0; i < max_try; i++) {
            await writeSerialByte(data);
            await sleep(delay);
            if (microPythonIsReadyNextCommand()) {
                okFlag = true;
                break;
            }
        }
        return okFlag;
    }

    async sendLineLoopWaitMatch(line, regex, delay = 100, max_try = 5) {
        await this.writeSerialNewLine(line);
        let okFlag = false;
        for (let i = 0; i < max_try; i++) {
            await sleep(delay);
            if (serialLastData.match(regex)) {
                okFlag = true;
                break;
            }
        }
        return okFlag;
    }

    writeSerialNewLine(text) {
        writeSerial(text + ((!RawREPLMode) ? "\r\n" : "\x04"));
    }
}

// ------------------------------
// Upload via MSC (v3.0.1 / MSC-only stabilized start flow)
// ------------------------------
class UploadViaMSC {
    constructor(options = {}) {
        RawREPLMode = false;
        this.mount = null;
        this.firmwareInfo = null;
        this.abortRequested = false;

        this.cfg = {
            // REPL control timings
            ctrlBDelayMs: 50,
            ctrlBMaxTry: 10,
            ctrlCDelayMs: 50,
            ctrlCMaxTry: 20,
            ctrlCStageTimeoutMs: 1800,

            rawExitTimeoutMs: 1000,

            softResetWaitMs: 220,

            driveScanTimeoutMs: 4500,
            driveScanPollMs: 200,
            diskInfoTimeoutMs: 2000,

            mscAccessTimeoutMs: 700,
            mscWriteTimeoutMs: 2500,

            serialDeadMs: 900,
            deadBreakAfterTry: 3,

            endResetWaitMs: 250
        };

        Object.assign(this.cfg, options || {});
    }

    async start() {
        this.abortRequested = false;

        try {
            if (typeof statusLog === "function") statusLog("[MSC] start");

            try {
                if (typeof boardReset === "function") {
                    if (typeof statusLog === "function") statusLog("[MSC] pre-reset boardReset()");
                    await boardReset(false);
                    await sleep(300);
                }
            } catch (e) {
                console.warn("boardReset before MSC start warning:", e);
            }

            if (!serialLastData.endsWith(">>>") && serialLastData.endsWith(">")) {
                if (typeof statusLog === "function") statusLog("[MSC] exit raw REPL");
                serialLastData = "";
                RawREPLMode = true;

                try {
                    await withTimeout(
                        this.sendByteLoopWaitNextCommand(2, this.cfg.ctrlBDelayMs, this.cfg.ctrlBMaxTry),
                        this.cfg.rawExitTimeoutMs,
                        new UploadMSCError("RAW_REPL_EXIT_TIMEOUT", "Exit Raw REPL timeout")
                    );
                } catch (e) {
                    console.warn("Exit Raw REPL failed (continue):", e);
                }
            }
            RawREPLMode = false;

            if (typeof statusLog === "function") statusLog("[MSC] stage A: access REPL");
            serialLastData = "";

            let readyNow = await waitPrompt(200, 20, false);
            if (!readyNow) {
                const ok = await withTimeout(
                    this.sendByteLoopWaitNextCommand(3, this.cfg.ctrlCDelayMs, this.cfg.ctrlCMaxTry),
                    this.cfg.ctrlCStageTimeoutMs,
                    new UploadMSCError("SERIAL_ACCESS_TIMEOUT", "Access to MicroPython timeout")
                );
                if (!ok) {
                    if (!await waitPrompt(300, 20, false)) {
                        throw new UploadMSCError("SERIAL_ACCESS_FAIL", "Access to MicroPython error");
                    }
                }
            }

            if (typeof statusLog === "function") statusLog("[MSC] stage B: soft reset");
            serialLastData = "";
            await writeSerialByte(4); // Ctrl+D soft reset
            await sleep(this.cfg.softResetWaitMs);

            if (typeof statusLog === "function") statusLog("[MSC] stage C: wait prompt after reset");
            let readyAfterReset = await waitPrompt(1500, 20, false);

            if (!readyAfterReset) {
                const ok = await withTimeout(
                    this.sendByteLoopWaitNextCommand(3, this.cfg.ctrlCDelayMs, this.cfg.ctrlCMaxTry),
                    this.cfg.ctrlCStageTimeoutMs,
                    new UploadMSCError("EXIT_MAIN_TIMEOUT", "Exit main program timeout")
                );

                if (!ok) {
                    if (!await waitPrompt(400, 20, false)) {
                        throw new UploadMSCError("EXIT_MAIN_FAIL", "Exit main program error");
                    }
                }
            }

            this._parseFirmwareInfo();

            const platform = os.platform();
            if (platform !== "win32") {
                throw new UploadMSCError("MSC_UNSUPPORTED_OS", "MSC not support in linux and darwin !");
            }

            const board = boards.find(board => board.id === boardId);
            if (!board) {
                throw new UploadMSCError("BOARD_NOT_FOUND", `Board config not found: ${boardId}`);
            }
            if (typeof board.mscSize === "undefined") {
                throw new UploadMSCError("BOARD_MSC_SIZE_MISSING", `board.mscSize missing for ${boardId}`);
            }

            if (typeof statusLog === "function") statusLog("[MSC] stage D: scan MSC drive");
            const RP2DriveInfo = await this._findMSCDriveBySize(board.mscSize);
            // if (!RP2DriveInfo) {
            //     throw new UploadMSCError("MSC_DRIVE_NOT_FOUND", "MSC drive not found !");
            // }

            this.mount = RP2DriveInfo.mounted;
            console.log("MSC mount:", this.mount);

            // await checkPathWritableFast(this.mount, this.cfg.mscAccessTimeoutMs);
            if (typeof statusLog === "function") statusLog(`[MSC] mount ready: ${this.mount}`);
            return true;
        } catch (e) {
            try { await this.forceAbort(); } catch (_) {}
            throw e;
        }
    }

    async getFirmwareInfo() {
        return this.firmwareInfo;
    }

    async upload(fileName, content) {
        this._checkAbort();

        if (!this.mount) {
            throw new UploadMSCError("MSC_NOT_READY", "MSC mount is not ready");
        }

        if (content.length == 0) {
            content = "#No Code";
        }

        const fullPath = path.join(this.mount, "/", fileName);

        // Quick pre-check before write
        // await checkPathWritableFast(this.mount, this.cfg.mscAccessTimeoutMs);

        // Killable write path (prevents long UI hang on Windows MSC)
        await writeMSCFileWithTimeout(fullPath, content, this.cfg.mscWriteTimeoutMs);
    }

    async end() {
        try {
            if (os.platform() === "linux") {
                await sleep(2000);
            }
            await writeSerialByte(4); // Soft reset
            await sleep(this.cfg.endResetWaitMs);
        } catch (e) {
            console.warn("UploadViaMSC.end() warning:", e);
        }
    }

    async forceAbort() {
        this.abortRequested = true;
        RawREPLMode = false;
    }

    async sendByteLoopWaitNextCommand(data, delay = 100, max_try = 5) {
        let okFlag = false;

        for (let i = 0; i < max_try; i++) {
            this._checkAbort();

            if (hasRecentPrompt(RawREPLMode)) {
                okFlag = true;
                break;
            }

            await writeSerialByte(data);
            await sleep(delay);

            if (hasRecentPrompt(RawREPLMode)) {
                okFlag = true;
                break;
            }

            if ((i + 1) >= this.cfg.deadBreakAfterTry && this._serialLooksDead(this.cfg.serialDeadMs)) {
                break;
            }
        }
        return okFlag;
    }

    async sendLineLoopWaitMatch(line, regex, delay = 100, max_try = 5) {
        this._checkAbort();

        await this.writeSerialNewLine(line);
        let okFlag = false;
        for (let i = 0; i < max_try; i++) {
            this._checkAbort();

            await sleep(delay);
            if (serialLastData.match(regex)) {
                okFlag = true;
                break;
            }

            if ((i + 1) >= this.cfg.deadBreakAfterTry && this._serialLooksDead(this.cfg.serialDeadMs)) {
                break;
            }
        }
        return okFlag;
    }

    writeSerialNewLine(text) {
        writeSerial(text + ((!RawREPLMode) ? "\r\n" : "\x04"));
    }

    _checkAbort() {
        if (this.abortRequested) {
            throw new UploadMSCError("ABORTED", "Upload aborted");
        }
    }

    _serialLooksDead(deadMs = 900) {
        if (typeof serialLastRxAt !== "number" || serialLastRxAt === 0) return false;
        return (Date.now() - serialLastRxAt) > deadMs;
    }

    _parseFirmwareInfo() {
        let checkVersion = /MicroPython\s+([^\s]+)\s+on\s+([0-9\-]+);\s?(.+)\s+with\s+([^\s]+)$/m.exec(serialLastData || "");
        if (checkVersion) {
            this.firmwareInfo = {
                version: checkVersion[1],
                date: checkVersion[2],
                board: checkVersion[3],
                cpu: checkVersion[4]
            };
        }
    }

    async _getWindowsDrives() {
        return await withTimeout(
            nodeDiskInfo.getDiskInfo(),
            this.cfg.diskInfoTimeoutMs,
            new UploadMSCError("DRIVE_SCAN_TIMEOUT", "Drive scan timeout")
        );
    }

    async _findMSCDriveBySize(mscSize) {
        const deadline = Date.now() + this.cfg.driveScanTimeoutMs;
        let lastDrives = [];

        while (Date.now() < deadline) {
            this._checkAbort();

            try {
                lastDrives = await this._getWindowsDrives();
                console.log("All drive:", lastDrives);

                const found = (lastDrives || []).find(a => Number(a.blocks) === Number(mscSize));
                if (found) return found;
            } catch (e) {
                console.warn("Drive scan warning:", e);
            }

            await sleep(this.cfg.driveScanPollMs);
        }

        return null;
    }
}

// ------------------------------
// XML -> Code
// ------------------------------
const xmlToCode = xml_text => {
    const work_div = document.createElement("div");
    document.querySelector("body").appendChild(work_div);
    const tmp_workspace = Blockly.inject(work_div, {});
    Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml_text), tmp_workspace);
    const { isArduinoPlatform } = boards.find(board => board.id === boardId);
    const code = (!isArduinoPlatform) ? Blockly.Python.workspaceToCode(tmp_workspace) : Blockly.JavaScript.workspaceToCode(tmp_workspace);
    work_div.remove();

    return code;
};

// ------------------------------
// Real device upload flow
// ------------------------------
let realDeviceUploadFlow = async (code) => {
    if (!serialPort) {
        if (!await serialConnect()) {
            $("#upload-program").removeClass("loading");
            return;
        }
        await sleep(300);
    }

    let filesUpload = [];
    let method = null;

    let uploadModuleList = findIncludeModuleNameInCode(code);

    if (uploadModuleList.length > 0) {
        for (const extensionId of fs.ls("/extension")) {
            for (const filePath of fs.walk(`/extension/${extensionId}/modules`)) {
                let fileName = filePath.replace(/^\//gm, "");
                if (fileName.endsWith(".py") || fileName.endsWith(".mpy")) {
                    if (uploadModuleList.indexOf(fileName.replace(/\..+$/, "")) >= 0) {
                        filesUpload.push({
                            file: filePath.replace(/^.*[\\\/]/, ''),
                            content: fs.read(`/extension/${extensionId}/modules/${fileName}`)
                        });
                    }
                }
            }
        }

        if (isElectron) {
            let extensionDir = sharedObj.extensionDir;
            for (const extensionId of nodeFS.ls(extensionDir)) {
                for (const filePath of (await nodeFS.walk(`${extensionDir}/${extensionId}/modules`))) {
                    let fileName = path.basename(filePath);
                    if (fileName.endsWith(".py") || fileName.endsWith(".mpy")) {
                        if (uploadModuleList.indexOf(fileName.replace(/\..+$/, "")) >= 0) {
                            filesUpload.push({
                                file: filePath.replace(/^.*[\\\/]/, ''),
                                content: (await readFileAsync(filePath)).toString()
                            });
                        }
                    }
                }
            }
        }

        for (const fileName of fs.ls("/")) {
            if ((fileName === "main.py") || (fileName === "main.xml")) {
                continue;
            }

            if (uploadModuleList.indexOf(fileName.replace(/\..+$/, "")) >= 0) {
                if (fileName.endsWith(".py") || fileName.endsWith(".mpy")) {
                    filesUpload.push({
                        file: fileName.replace(/^.*[\\\/]/, ''),
                        content: fs.read(`/${fileName}`)
                    });
                } else if (fileName.endsWith(".xml")) {
                    const code2 = xmlToCode(fs.read(`/${fileName}`));
                    filesUpload.push({
                        file: fileName.replace(/^.*[\\\/]/, '').replace(".xml", ".py"),
                        content: code2
                    });
                }
            }
        }
    }

    filesUpload = filesUpload.concat(extra_files);
    filesUpload.push({
        file: "main.py",
        content: code
    });

    console.log(filesUpload);

    try {
        const enterToREPL = async () => {
            method = new UploadViaREPL();
            activeUploadMethod = method;
            try {
                await method.start();
            } catch (e) {
                firewareUpgradeFlow();
                throw e;
            }
        };

        let board = boards.find(board => board.id === boardId);
        if (board.uploadMode && board.uploadMode === "REPL") {
            await enterToREPL();
        } else if (board.uploadMode && board.uploadMode === "MSC") {
            // MSC only: no fallback to REPL in this branch
            method = new UploadViaMSC({
                ctrlCStageTimeoutMs: 3500,
                mscWriteTimeoutMs: 3000,
                driveScanTimeoutMs: 6000,
                softResetWaitMs: 500,
                serialDeadMs: 1500,
                deadBreakAfterTry: 6,
                endResetWaitMs: 300
            });

            activeUploadMethod = method;
            await method.start();
        } else {
            method = new UploadOnBoot();
            activeUploadMethod = method;

            try {
                await method.start();
            } catch (e) {
                console.warn(e);
                NotifyW("Switch to upload via RawREPL [RECOMMENDED Upgrade fireware]");
                await enterToREPL();
            }
        }

        if (typeof skipFirmwareUpgrade === "undefined") skipFirmwareUpgrade = false;

        // Check MicroPython version
        if (boardId && !skipFirmwareUpgrade) {
            let info = await method.getFirmwareInfo();
            console.log("firmware info", info);

            let boardNow = boards.find(board => board.id === boardId);
            if (typeof boardNow.firmware[0].version !== "undefined") {
                if (boardNow.firmware[0].version !== info.version) {
                    if (typeof boardNow.firmware[0].date !== "undefined") {
                        let dbFwDate = new Date(boardNow.firmware[0].date).getTime();
                        let currentFwDate = new Date(info.date).getTime();
                        if (currentFwDate < dbFwDate) {
                            if (isElectron) {
                                firewareUpgradeFlow();
                            }
                            throw "Upload fail: MicroPython fireware is out of date";
                        }
                    }
                }
            }
        }

        for (let a of filesUpload) {
            statusLog(`Uploading ${a.file}`);
            await method.upload(a.file, a.content);
        }

        await method.end();
        delete method;
    } catch (e) {
        throw e;
    } finally {
        activeUploadMethod = null;
    }
};

// ------------------------------
// Upload button
// ------------------------------
$("#upload-program").click(async function() {
    if (uploadInProgress) {
        NotifyW("Upload is already running");
        return;
    }

    uploadInProgress = true;

    try {
        statusLog("Start Upload");
        t0 = (new Date()).getTime();

        $("#upload-program").addClass("loading");

        let code;
        extra_files = [];
        const file_list = fs.ls("/");
        if (file_list.indexOf("main.xml") >= 0) {
            code = xmlToCode(fs.read(`/main.xml`));
        } else if (file_list.indexOf("main.py") >= 0) {
            code = fs.read(`/main.py`);
        }

        console.log(code);
        const { isArduinoPlatform } = boards.find(board => board.id === boardId);

        if (isArduinoPlatform) {
            if (+localStorage.getItem("show-console-upload") !== -1) {
                $("#arduino-console-dialog .title").text("Uploading...");
                ShowDialog($("#arduino-console-dialog"));
            }
            arduinoConsoleTerm.clear();
        }

        if (!isArduinoPlatform) {
            if (deviceMode === MODE_REAL_DEVICE) {
                await realDeviceUploadFlow(code);
            } else if (deviceMode === MODE_SIMULATOR) {
                let simSystem = domSimulatorIframe.contentWindow.simSystem;
                if (simSystem) {
                    simSystem.runCode(code);
                } else {
                    console.warn("Connect to domSimulatorIframe error");
                }
            }
        } else {
            await arduino_upload(code);
        }

        timeDiff = (new Date()).getTime() - t0;
        console.log("Time:", timeDiff, "ms");
        NotifyS("Upload Successful");
        statusLog(`Upload successful with ${timeDiff} mS`);

        if (isArduinoPlatform) {
            $("#arduino-console-dialog .title").text("Upload Successful");
        }
    } catch (e) {
        $("#upload-log-dialog .title").text("Upload Fail");
        const mscMsg = getMSCUserErrorMessage(e);
        NotifyE(mscMsg || "Upload Fail !");
        statusLog(`Upload fail because ${e && e.message ? e.message : e}`);
        console.warn(e);

        const { isArduinoPlatform } = boards.find(board => board.id === boardId);
        if (isArduinoPlatform) {
            ShowDialog($("#arduino-console-dialog"));
            $("#arduino-console-dialog .title").text("Upload Fail");
        }
    } finally {
        resetUploadRunningState();
    }
});

// ------------------------------
// Misc helpers
// ------------------------------
let sleep = (time) => {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, time);
    });
};

let moduleBuiltIn = [
    "framebuf", "ucryptolib", "urandom",
    "_boot", "gc", "uctypes", "ure",
    "_onewire", "inisetup", "uerrno",
    "_thread", "machine", "uhashlib", "uselect",
    "_webrepl", "math", "uhashlib", "usocket",
    "apa106", "micropython", "uheapq", "ussl",
    "btree", "uio", "ustruct",
    "builtins", "network", "ujson", "utime",
    "cmath", "ntptime", "umqtt/robust", "utimeq",
    "dht", "onewire", "umqtt/simple", "uwebsocket",
    "ds18x20", "sys", "uos", "uzlib",
    "esp", "uarray", "upip", "webrepl",
    "esp32", "ubinascii", "upip_utarfile", "webrepl_setup",
    "flashbdev", "ucollections", "upysh", "websocket_helper",
    "time",
];

let findIncludeModuleNameInCode = (code) => {
    const regex = /^\s*?(?:import|from)\s+([^\s]+)/mg;

    let moduleList = [];
    let m;

    while ((m = regex.exec(code)) !== null) {
        if (m.index === regex.lastIndex) {
            regex.lastIndex++;
        }

        let moduleName = m[1];
        if (moduleList.indexOf(moduleName) < 0) {
            moduleList.push(moduleName);
        }
    }

    moduleList = moduleList.filter((moduleName) => moduleBuiltIn.indexOf(moduleName) < 0);

    return moduleList;
};

// ------------------------------
// Connect / Disconnect buttons
// ------------------------------
$("#connect-device").click(async () => {
    if (!serialPort) {
        if (await serialConnect()) {
            let okFlag = false;
            for (let i = 0; i < 100; i++) {
                try {
                    await writeSerialByte(3); // Ctrl + C
                } catch (e) {
                    console.warn("Connect warmup Ctrl+C error:", e);
                    break;
                }
                await sleep(50);
                if (microPythonIsReadyNextCommand()) {
                    okFlag = true;
                    break;
                }
            }

            if (!okFlag) {
                NotifyE("Access to MicroPython error");
                return;
            }
        }
    } else {
        // Already connected
    }
});

$("#disconnect-device").click(async () => {
    if (serialPort) {
        autoConnectFlag = false;
        await abortCurrentUpload("manual disconnect");

        if (!isElectron) {
            // WebSerial close flow is not implemented in original code
        } else {
            try {
                serialPort.close();
            } catch (e) {
                console.warn("serialPort.close warning:", e);
            }
        }
    }
});