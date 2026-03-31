var firmwareUpdateMode = false;

(() => {
    console.log("[fireware.js] loaded");

    let uf2MountPath = "";
    let windowFirewareUpdate = null;
    let rp2DriveCheckTimer = null;
    let rp2DrivePollingActive = false;
    let rp2DrivePollingToken = 0;
    const DEBUG_RP2 = false;

    const setFirmwareProgress = (percent, text = "") => {
        const p = Math.max(0, Math.min(100, Number(percent) || 0));
        $("#firmware-upgrade-dialog .progress-box > .back-drop").width(`${p}%`);
        $("#firmware-upgrade-dialog .progress-box > .caption").text(
            text || `${p.toFixed(2)}%`
        );
    };

    const resetFirmwareProgress = () => {
        setFirmwareProgress(0, "");
    };

    const showFirmwareDone = (success, message) => {
        $("#firmware-upgrade-dialog article.done .icon").hide();

        if (success) {
            $("#firmware-upgrade-dialog article.done .icon.success").show();
            $("#firmware-upgrade-dialog .upload-btn").show();
        } else {
            $("#firmware-upgrade-dialog article.done .icon.fail").show();
            $("#firmware-upgrade-dialog .upload-btn").hide();
        }

        $("#firmware-upgrade-status").text(message);
        $("#firmware-upgrade-dialog article.doing").hide();
        $("#firmware-upgrade-dialog article.done").show();
        $("#firmware-upgrade-dialog .close-btn").show();
    };

    const firmwareDownloadFile = (uri, name) => {
        const link = document.createElement("a");
        link.setAttribute("download", name);
        link.href = uri;
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const fileExists = (targetPath) => {
        try {
            return nodeFS.existsSync(targetPath);
        } catch (e) {
            return false;
        }
    };

    const findRP2DriveWindows = async () => {
        try {
            const drives = await new Promise((resolve) => {
                let stdout = "";
                let stderr = "";

                const psCommand =
                    'Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,VolumeName | ConvertTo-Csv -NoTypeInformation';

                const ps = spawn(
                    "powershell.exe",
                    [
                        "-NoProfile",
                        "-ExecutionPolicy",
                        "Bypass",
                        "-Command",
                        psCommand
                    ],
                    { shell: false }
                );

                ps.stdout.on("data", (data) => {
                    stdout += data.toString();
                });

                ps.stderr.on("data", (data) => {
                    stderr += data.toString();
                });

                ps.on("error", (err) => {
                    console.error("powershell spawn error:", err);
                    resolve([]);
                });

                ps.on("exit", () => {
                    if (stderr.trim() && DEBUG_RP2) {
                        console.log("powershell stderr:", stderr);
                    }

                    try {
                        const lines = stdout
                            .split(/\r?\n/)
                            .map(line => line.trim())
                            .filter(Boolean);

                        const info = [];

                        for (let i = 1; i < lines.length; i++) {
                            const parts = lines[i]
                                .split('","')
                                .map(s => s.replace(/^"|"$/g, ""));

                            const deviceID = parts[0] || "";
                            const volumeName = parts[1] || "";

                            if (deviceID) {
                                info.push({
                                    mounted: deviceID + "\\",
                                    volumeName
                                });
                            }
                        }

                        resolve(info);
                    } catch (e) {
                        console.error("parse powershell error:", e);
                        resolve([]);
                    }
                });
            });

            if (DEBUG_RP2) console.log("Drive", drives);

            for (const drive of drives) {
                const mount = drive.mounted;
                if (!mount) continue;

                const label = (drive.volumeName || "").toUpperCase();
                if (label === "RPI-RP2" || label === "BOOTSEL") {
                    if (DEBUG_RP2) console.log("RP2 Drive info", drive);
                    return mount;
                }

                const infoFile = path.join(mount, "INFO_UF2.TXT");
                if (fileExists(infoFile)) {
                    if (DEBUG_RP2) console.log("RP2 Drive info", drive);
                    return mount;
                }
            }
        } catch (err) {
            console.error("findRP2DriveWindows error:", err);
        }

        return "";
    };

    const findRP2DriveUnix = async () => {
        try {
            const drives = await new Promise((resolve) => {
                let stdout = "";

                const df_h = spawn("df -a", [], { shell: true });

                df_h.stdout.on("data", (data) => {
                    stdout += data.toString();
                });

                df_h.stderr.on("data", (data) => {
                    if (DEBUG_RP2) console.log("df stderr:", data.toString());
                });

                df_h.on("exit", () => {
                    try {
                        const info = stdout
                            .split("\n")
                            .filter((a) => a.startsWith("/dev"))
                            .map((a) => a.split(" ").filter((b) => b.length !== 0))
                            .map((a) => ({
                                filesystem: a[0],
                                blocks: +a[1] * (os.platform() === "darwin" ? 512 : 1024),
                                mounted: os.platform() === "darwin" ? a[8] : a[5],
                            }));
                        resolve(info);
                    } catch (e) {
                        console.error("parse df error:", e);
                        resolve([]);
                    }
                });
            });

            if (DEBUG_RP2) console.log("Drive", drives);

            for (const drive of drives) {
                const mount = drive.mounted;
                if (!mount) continue;

                const infoFile = path.join(mount, "INFO_UF2.TXT");
                if (fileExists(infoFile)) {
                    if (DEBUG_RP2) console.log("RP2 Drive info", drive);
                    return mount;
                }
            }
        } catch (err) {
            console.error("findRP2DriveUnix error:", err);
        }

        return "";
    };

    const findRP2Drive = async () => {
        if (!isElectron) return "";

        const platform = os.platform();

        if (platform === "win32") {
            return await findRP2DriveWindows();
        }

        if (platform === "linux" || platform === "darwin") {
            return await findRP2DriveUnix();
        }

        return "";
    };

    const stopRP2DrivePolling = () => {
        rp2DrivePollingActive = false;
        rp2DrivePollingToken += 1;

        if (rp2DriveCheckTimer) {
            clearTimeout(rp2DriveCheckTimer);
            rp2DriveCheckTimer = null;
        }
    };

    const startRP2DrivePolling = () => {
        stopRP2DrivePolling();

        rp2DrivePollingActive = true;
        const myToken = ++rp2DrivePollingToken;

        const checkRP2DriveAvailable = async () => {
            if (!rp2DrivePollingActive || myToken !== rp2DrivePollingToken) return;

            try {
                const mount = await findRP2Drive();

                if (!rp2DrivePollingActive || myToken !== rp2DrivePollingToken) return;

                if (mount) {
                    uf2MountPath = mount;
                    $("#firmware-upgrade-dialog .note-for-rp2").hide();
                    $("#install-firmware-button").prop("disabled", false);
                    stopRP2DrivePolling();
                    return;
                }
            } catch (e) {
                if (rp2DrivePollingActive && myToken === rp2DrivePollingToken) {
                    console.error("checkRP2DriveAvailable error:", e);
                }
            }

            if (!rp2DrivePollingActive || myToken !== rp2DrivePollingToken) return;

            rp2DriveCheckTimer = setTimeout(checkRP2DriveAvailable, 1000);
        };

        checkRP2DriveAvailable();
    };

    const copyUF2WithProgress = (sourceFile, destFile) => {
        return new Promise((resolve, reject) => {
            nodeFS.stat(sourceFile, (err, stat) => {
                if (err) {
                    reject(err);
                    return;
                }

                const fileSize = stat.size;
                let bytesCopied = 0;
                let finished = false;

                const readStream = nodeFS.createReadStream(sourceFile);
                const writeStream = nodeFS.createWriteStream(destFile);

                const fail = (error) => {
                    if (finished) return;
                    finished = true;
                    try { readStream.destroy(); } catch (e) {}
                    try { writeStream.destroy(); } catch (e) {}
                    reject(error);
                };

                readStream.on("data", (chunk) => {
                    bytesCopied += chunk.length;
                    const percent = (bytesCopied / fileSize) * 100;
                    setFirmwareProgress(
                        percent,
                        `${percent.toFixed(2)}% (${bytesCopied} / ${fileSize} bytes)`
                    );
                });

                readStream.on("error", fail);
                writeStream.on("error", fail);

                writeStream.on("finish", () => {
                    if (finished) return;
                    finished = true;
                    setFirmwareProgress(
                        100,
                        `100.00% (${fileSize} / ${fileSize} bytes)`
                    );
                    resolve();
                });

                readStream.pipe(writeStream);
            });
        });
    };

    async function firewareUpgradeFlow() {
        console.log("[fireware.js] firewareUpgradeFlow called");

        let board = boards.find(board => board.id === boardId);
        if (!board) {
            console.error("[fireware.js] board not found:", boardId);
            return;
        }

        $("#firmware-version-select").html(
            board.firmware.map((a, index) => `<option value="${index}">${a.name}</option>`)
        );

        stopRP2DrivePolling();

        if ((!isElectron) && (board?.chip === "ESP32")) {
            const w = 600, h = 460;
            const y = (window.top.outerHeight / 2) + window.top.screenY - (h / 2);
            const x = (window.top.outerWidth / 2) + window.top.screenX - (w / 2);
            windowFirewareUpdate = window.open(
                "/firmware.html?board=" + encodeURI(boardId) + "&firmware=" + encodeURI(JSON.stringify(board.firmware)),
                "Firmware Update",
                `width=600,height=500,top=${y},left=${x}`
            );
            return;
        } else {
            if (board?.chip.indexOf("RP2") >= 0) {
                if (!isElectron) {
                    $("#install-firmware-button").prop("disabled", false);
                    $("#firmware-upgrade-dialog .note-for-rp2").hide();
                } else {
                    $("#install-firmware-button").prop("disabled", true);
                    $("#firmware-upgrade-dialog .note-for-rp2").show();
                    startRP2DrivePolling();
                }
            } else {
                $("#install-firmware-button").prop("disabled", false);
                $("#firmware-upgrade-dialog .note-for-rp2").hide();
            }
        }

        $("#firmware-upgrade-dialog article").hide();
        $("#firmware-upgrade-dialog article.todo").show();
        $("#firmware-upgrade-dialog").show();
    }

    window.firewareUpgradeFlow = firewareUpgradeFlow;
    globalThis.firewareUpgradeFlow = firewareUpgradeFlow;

    $("#install-firmware-button").off("click.fireware").on("click.fireware", async () => {
        $("#firmware-upgrade-dialog article.todo").hide();
        resetFirmwareProgress();
        $("#firmware-upgrade-dialog article.doing").show();
        $("#firmware-upgrade-dialog .close-btn").hide();

        let board = boards.find(board => board.id === boardId);
        if (!board) {
            showFirmwareDone(false, "Board not found");
            return;
        }

        const chipId = board?.chip || "ESP32";

        let fwIndex = +$("#firmware-version-select").val();
        let fwPath = board.firmware[fwIndex].path;

        if (!isElectron) {
            fwPath = fwPath.startsWith("/") ? fwPath : `/boards/${boardId}/${fwPath}`;
        } else {
            fwPath = fwPath.startsWith("/")
                ? sharedObj.rootPath + fwPath
                : `${sharedObj.rootPath}/boards/${boardId}/${fwPath}`;
            fwPath = path.normalize(fwPath);
        }

        if (chipId === "ESP32") {
            if (!isElectron) {
                try {
                    let data = await (await fetch(fwPath)).arrayBuffer();
                    console.log(typeof data, data);

                    if (!serialPort) {
                        if (!await serialConnect()) {
                            showFirmwareDone(false, "Serial connect cancelled");
                            return;
                        }
                        await sleep(300);
                    }

                    const debugMsg = (...args) => {
                        function getStackTrace() {
                            let stack = new Error().stack;
                            stack = stack.split("\n").map(v => v.trim());
                            for (let i = 0; i < 3; i++) {
                                stack.shift();
                            }

                            let trace = [];
                            for (let line of stack) {
                                line = line.replace("at ", "");
                                trace.push({
                                    "func": line.substr(0, line.indexOf("(") - 1),
                                    "pos": line.substring(line.indexOf(".js:") + 4, line.lastIndexOf(":"))
                                });
                            }

                            return trace;
                        }

                        let stack = getStackTrace();
                        stack.shift();
                        let top = stack.shift();
                        let prefix = "[" + top.func + ":" + top.pos + "] ";

                        for (let arg of args) {
                            if (typeof arg == "string") {
                                console.log(prefix + arg);
                            } else if (typeof arg == "number") {
                                console.log(prefix + arg);
                            } else if (typeof arg == "boolean") {
                                console.log(prefix + (arg ? "true" : "false"));
                            } else if (Array.isArray(arg)) {
                                console.log(prefix + "[" + arg.map(value => espTool.toHex(value)).join(", ") + "]");
                            } else if (typeof arg == "object" && (arg instanceof Uint8Array)) {
                                console.log(prefix + "[" + Array.from(arg).map(value => espTool.toHex(value)).join(", ") + "]");
                            } else {
                                console.log(prefix + "Unhandled type of argument:" + typeof arg);
                                console.log(arg);
                            }
                            prefix = "";
                        }
                    };

                    firmwareUpdateMode = true;

                    const logMsg = (a) => {
                        console.log(a);
                        $("#firmware-upgrade-dialog .progress-box > .caption").text(a);
                    };

                    const espTool = new EspLoader({
                        updateProgress: (part, percentage) => {
                            setFirmwareProgress(percentage, `${percentage}%`);
                        },
                        logMsg,
                        debugMsg,
                        debug: true
                    });

                    if (writer) {
                        writer.releaseLock();
                        writer = null;
                    }

                    let synced = false;
                    for (let i = 0; i < 20; i++) {
                        logMsg("Enter to Bootloader...");
                        if (!await espTool.connect()) {
                            continue;
                        }

                        await sleep(500);

                        try {
                            logMsg("Sync...");
                            await espTool.sync();
                        } catch (e) {
                            continue;
                        }

                        synced = true;
                        break;
                    }

                    if (!synced) {
                        throw new Error("Connect fail");
                    }

                    console.log("Connected to", await espTool.chipName());
                    console.log("MAC Address:", espTool.macAddr());

                    const espToolStub = await espTool.runStub();

                    logMsg("Erase Flash...");
                    await espToolStub.eraseFlash();

                    const file = board.firmware[fwIndex].path;
                    await espToolStub.flashData(data, 0x1000, file);

                    await espTool.disconnect();

                    espTool.setPortBaudRate(115200);

                    writer = serialPort.writable.getWriter();
                    firmwareUpdateMode = false;

                    showFirmwareDone(true, "Firmware Upgrade Successful");
                } catch (err) {
                    console.error(err);
                    firmwareUpdateMode = false;
                    showFirmwareDone(false, "Firmware Upgrade Fail : " + err.toString());
                }
            } else {
                let comPort;

                if (serialPort) {
                    comPort = serialPort.path;
                    beforeAutoConnectFlag = autoConnectFlag;
                    autoConnectFlag = false;
                    serialPort.close();
                } else {
                    try {
                        comPort = await showPortSelect();
                    } catch (e) {
                        showFirmwareDone(false, "Port selection cancelled");
                        return;
                    }
                }

                let esptoolName = {
                    darwin: "esptool",
                    linux: "esptool-ubuntu-x64",
                    win32: "esptool.exe"
                };

                let esptoolPath = path.normalize(
                    sharedObj.rootPath + "/../bin/esptool/" + esptoolName[os.platform()]
                );

                let arg = [
                    "--chip", "esp32",
                    "--port", comPort,
                    "--baud", "115200",
                    "write_flash",
                    "--compress",
                    "--erase-all",
                    "--flash_mode", "dio",
                    "--flash_freq", "40m",
                    "--flash_size", "detect",
                    "0x1000", fwPath
                ];

                let esptool = spawn(esptoolPath, arg);

                esptool.stdout.on("data", (data) => {
                    console.log("stdout:", data.toString());

                    let lines = data.toString().split(/\r?\n/).map(a => a.trim()).filter(Boolean);
                    let line = lines.length ? lines[lines.length - 1] : data.toString().trim();

                    $("#firmware-upgrade-dialog .progress-box > .caption").text(line);

                    let percent = /\((\d+)\s?%\)$/.exec(line);
                    if (percent) {
                        setFirmwareProgress(+percent[1], line);
                    }
                });

                esptool.stderr.on("data", (data) => {
                    console.log("stderr:", data.toString());
                });

                esptool.on("exit", (code) => {
                    console.warn("esptool exit code", code);

                    if (code === 0) {
                        showFirmwareDone(true, "Firmware Upgrade Successful");
                        serialConnectElectron(comPort);
                    } else {
                        showFirmwareDone(false, "Firmware Upgrade Fail with code " + code);
                    }
                });
            }
        } else if (chipId.indexOf("RP2") >= 0) {
            try {
                stopRP2DrivePolling();

                if (!isElectron) {
                    firmwareDownloadFile(fwPath, "firmware.uf2");
                    setFirmwareProgress(100, "Downloaded firmware.uf2");
                    showFirmwareDone(
                        true,
                        "Downloaded UF2 file. Please copy it to the RP2 drive manually."
                    );
                } else {
                    if (!uf2MountPath) {
                        uf2MountPath = await findRP2Drive();
                    }

                    if (!uf2MountPath) {
                        throw new Error("RP2 drive not found. Hold BOOT and press RESET first.");
                    }

                    const infoFile = path.join(uf2MountPath, "INFO_UF2.TXT");
                    if (!fileExists(infoFile)) {
                        throw new Error("INFO_UF2.TXT not found on RP2 drive.");
                    }

                    const sourceFile = fwPath;
                    const destFile = path.join(uf2MountPath, "firmware.uf2");

                    setFirmwareProgress(0, "Preparing copy...");
                    await copyUF2WithProgress(sourceFile, destFile);

                    showFirmwareDone(true, "Firmware Upgrade Successful");
                }
            } catch (err) {
                console.error(err);
                showFirmwareDone(false, "Firmware Upgrade Fail : " + err.toString());
            }
        } else {
            showFirmwareDone(false, "Unsupported chip: " + chipId);
        }
    });

    $("#firmware-upgrade-dialog .upload-btn").off("click.fireware").on("click.fireware", () => {
        $("#upload-program").click();
        $("#firmware-upgrade-dialog .close-btn").click();
    });

    $("#firmware-upgrade-dialog .close-btn").off("click.fireware").on("click.fireware", () => {
        stopRP2DrivePolling();
        $("#firmware-upgrade-dialog").hide();
    });

    let skipFirmwareUpgrade = false;
    $("#continue-upload").off("click.fireware").on("click.fireware", () => {
        skipFirmwareUpgrade = true;
        $("#firmware-upgrade-dialog .close-btn").click();
        $("#upload-program").click();
    });
})();