let term = null, fitAddon = null;
let terminalShowFlag = false;
let beforeWidthTerminalSize = 300;
let terminalOutputPaused = false;
let terminalTimestampsEnabled = localStorage.getItem("terminalTimestampsEnabled") === "true";
let terminalLogEntries = [];
let terminalLogLength = 0;
let terminalPausedBuffer = "";
let terminalAtLineStart = true;

const maximumTerminalLogLength = 2 * 1024 * 1024;

const terminalClockText = date => date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
});

const addTerminalTimestamps = (text, date = new Date()) => {
    if (!terminalTimestampsEnabled) return text;

    let output = "";
    for (const character of text) {
        if (terminalAtLineStart && character !== "\r" && character !== "\n") {
            output += `[${terminalClockText(date)}] `;
            terminalAtLineStart = false;
        }
        output += character;
        if (character === "\n") terminalAtLineStart = true;
    }
    return output;
};

const trimTerminalLog = () => {
    while (terminalLogLength > maximumTerminalLogLength && terminalLogEntries.length > 1) {
        terminalLogLength -= terminalLogEntries.shift().text.length;
    }
};

globalThis.resetTerminalLog = () => {
    terminalLogEntries = [];
    terminalLogLength = 0;
    terminalPausedBuffer = "";
    terminalAtLineStart = true;
};

globalThis.appendTerminalOutput = value => {
    const text = String(value ?? "");
    if (!text) return;

    terminalLogEntries.push({ timestamp: new Date().toISOString(), text });
    terminalLogLength += text.length;
    trimTerminalLog();

    if (terminalOutputPaused) {
        terminalPausedBuffer += text;
        if (terminalPausedBuffer.length > maximumTerminalLogLength) {
            terminalPausedBuffer = terminalPausedBuffer.slice(-maximumTerminalLogLength);
        }
        return;
    }

    if (term) term.write(addTerminalTimestamps(text));
};

const updateTerminalToolButtons = () => {
    const timestampButton = $("#toggle-terminal-timestamps");
    const timestampLabel = terminalTimestampsEnabled ? "Hide Timestamps" : "Show Timestamps";
    timestampButton.toggleClass("is-active", terminalTimestampsEnabled);
    timestampButton.attr("aria-pressed", String(terminalTimestampsEnabled));
    timestampButton.attr("data-tippy-content", timestampLabel);
    if (timestampButton[0]?._tippy) timestampButton[0]._tippy.setContent(timestampLabel);

    const pauseButton = $("#pause-terminal");
    const pauseLabel = terminalOutputPaused ? "Resume Output" : "Pause Output";
    pauseButton.toggleClass("is-active", terminalOutputPaused);
    pauseButton.attr("aria-pressed", String(terminalOutputPaused));
    pauseButton.attr("data-tippy-content", pauseLabel);
    pauseButton.find("i").attr("class", terminalOutputPaused ? "fas fa-play" : "fas fa-pause");
    if (pauseButton[0]?._tippy) pauseButton[0]._tippy.setContent(pauseLabel);
};

const MINIMUM_TERMINAL_WIDTH = 300;

$("#close-terminal").click(() => {
    $("#terminal").css("display", "none");
    if (terminalFullSizeFlag) {
        $(".page > .main").css("display", "flex");
    }
    Blockly.triggleResize();
    if (editor) editor.layout();
    terminalShowFlag = false;
    $("#terminal-h-resize").css("display", "none");
    localStorage.removeItem("terminal_size");
});

let terminalFullSizeFlag = false;
$("#resize-terminal").click(() => {
    terminalFullSizeFlag = !terminalFullSizeFlag;
    if (terminalFullSizeFlag) beforeWidthTerminalSize = $("#terminal").width();
    $("#terminal").width(terminalFullSizeFlag ? "100%" : beforeWidthTerminalSize);
    if (terminalFullSizeFlag) {
        $(".page > .main").css("display", "none");
    } else {
        $(".page > .main").css("display", "flex");
    }
    fitAddon.fit();
    localStorage.setItem("terminal_size", $("#terminal").width());
});

$("#clear-terminal").click(() => {
    if (term) term.clear();
    globalThis.resetTerminalLog();
});

$("#toggle-terminal-timestamps").click(() => {
    terminalTimestampsEnabled = !terminalTimestampsEnabled;
    localStorage.setItem("terminalTimestampsEnabled", String(terminalTimestampsEnabled));
    terminalAtLineStart = true;
    updateTerminalToolButtons();
});

$("#pause-terminal").click(() => {
    terminalOutputPaused = !terminalOutputPaused;
    if (!terminalOutputPaused && terminalPausedBuffer) {
        if (term) term.write(addTerminalTimestamps(terminalPausedBuffer));
        terminalPausedBuffer = "";
    }
    updateTerminalToolButtons();
});

$("#export-terminal-log").click(async () => {
    if (terminalLogEntries.length === 0) {
        NotifyI("The terminal log is empty");
        return;
    }

    const logText = terminalLogEntries.map(entry => {
        const prefix = `[${entry.timestamp}] `;
        return prefix + entry.text.replace(/\n(?!$)/g, `\n${prefix}`);
    }).join("");
    const fileName = `${String($("#project-name").val() || "microBlock").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")}-serial.log`;

    try {
        if (isElectron) {
            const result = await dialog.showSaveDialog({
                filters: [{ name: "Serial Log", extensions: ["log", "txt"] }],
                defaultPath: fileName
            });
            if (result.canceled) return;
            await new Promise((resolve, reject) => {
                nodeFS.writeFile(result.filePath, logText, "utf8", error => error ? reject(error) : resolve());
            });
            NotifyS(`Terminal log exported to ${result.filePath}`);
            return;
        }

        const blob = new Blob([logText], { type: "text/plain;charset=utf-8" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = fileName;
        link.href = url;
        link.click();
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        NotifyS("Terminal log exported");
    } catch (error) {
        console.error("Export terminal log failed", error);
        NotifyE("Could not export the terminal log");
    }
});

updateTerminalToolButtons();

$("#open-terminal").click(() => {
    terminalShowFlag = true;
    $("#terminal").css("display", "flex");
    if (terminalFullSizeFlag) {
        $(".page > .main").css("display", "none");
    } else {
        $("#terminal").width(beforeWidthTerminalSize);
        Blockly.triggleResize();
    }
    if (editor) editor.layout();
    if (fitAddon) {
        setTimeout(() => {
            fitAddon.fit();
            fitAddon.fit();
        }, 10);
    }
    $("#terminal-h-resize").css("display", "block");
    $("#terminal-h-resize").css("right", $("#terminal").width());
    localStorage.setItem("terminal_size", $("#terminal").width());
});

$("#terminal-h-resize").bind('mousedown', function(event){
    offsetX = event.pageX - ($(document).width() - +$("#terminal-h-resize").css("right").replace("px", ""));
    offsetX = $(document).width() + offsetX;
    $("#terminal-h-resize").addClass("active");

    $(document).bind('mousemove', function(event){
        let rightPos = offsetX - event.pageX;
        rightPos = rightPos < MINIMUM_TERMINAL_WIDTH ? MINIMUM_TERMINAL_WIDTH : rightPos;
        $("#terminal-h-resize").css("right", rightPos - 14);
    }).bind('mouseup', function(event){
        $(this).unbind('mousemove');
        $(this).unbind('mouseup');

        if (deviceMode === MODE_REAL_DEVICE) {
            $("#terminal").width(+$("#terminal-h-resize").css("right").replace("px", ""));
            localStorage.setItem("terminal_size", $("#terminal").width());
        } else if (deviceMode === MODE_SIMULATOR) {
            $("#simulator").width(+$("#terminal-h-resize").css("right").replace("px", ""));
            localStorage.setItem("simulator_width_size", $("#simulator").width());
        }

        Blockly.triggleResize();
        if (editor) editor.layout();
        if (fitAddon) {
            setTimeout(() => {
                fitAddon.fit();
                fitAddon.fit();
            }, 10);
        }

        $("#terminal-h-resize").removeClass("active");
    });
});

if (!isEmbed && deviceMode === MODE_REAL_DEVICE) {
    terminal_size = localStorage.getItem("terminal_size");
    if (terminal_size) {
        terminal_size = +terminal_size;
        beforeWidthTerminalSize = terminal_size >= MINIMUM_TERMINAL_WIDTH ? terminal_size : MINIMUM_TERMINAL_WIDTH;
        $(() => $("#open-terminal").click());
    }
}
