const DEFAULT_TERMINAL_WIDTH = 300;

let term = null, fitAddon = null;
let terminalShowFlag = false;
let beforeWidthTerminalSize = DEFAULT_TERMINAL_WIDTH;
let terminalTimestampsEnabled = localStorage.getItem("terminalTimestampsEnabled") === "true";
let terminalLogEntries = [];
let terminalLogLength = 0;
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
    terminalAtLineStart = true;
};

globalThis.appendTerminalOutput = value => {
    const text = String(value ?? "");
    if (!text) return;

    terminalLogEntries.push({ timestamp: new Date().toISOString(), text });
    terminalLogLength += text.length;
    trimTerminalLog();

    if (term) term.write(addTerminalTimestamps(text));
};

const updateTerminalToolButtons = () => {
    const timestampButton = $("#toggle-terminal-timestamps");
    const timestampLabel = terminalTimestampsEnabled ? "Hide Timestamps" : "Show Timestamps";
    timestampButton.toggleClass("is-active", terminalTimestampsEnabled);
    timestampButton.attr("aria-pressed", String(terminalTimestampsEnabled));
    timestampButton.attr("aria-label", timestampLabel);
    timestampButton.attr("data-tippy-content", timestampLabel);
    if (timestampButton[0]?._tippy) timestampButton[0]._tippy.setContent(timestampLabel);
};

const MINIMUM_TERMINAL_WIDTH = 300;
const MINIMUM_TERMINAL_BUTTON_SIZE = 30;
const MAXIMUM_TERMINAL_BUTTON_SIZE = 36;
const TERMINAL_TOOLBAR_HORIZONTAL_SPACE = 56;
const TERMINAL_TOOLBAR_BUTTON_COUNT = 5;

const updateTerminalToolbarLayout = () => {
    const terminal = document.getElementById("terminal");
    if (!terminal) return;

    const terminalWidth = terminal.getBoundingClientRect().width || MINIMUM_TERMINAL_WIDTH;
    const availableButtonSize = Math.floor(
        (terminalWidth - TERMINAL_TOOLBAR_HORIZONTAL_SPACE) / TERMINAL_TOOLBAR_BUTTON_COUNT
    );
    const buttonSize = Math.max(
        MINIMUM_TERMINAL_BUTTON_SIZE,
        Math.min(MAXIMUM_TERMINAL_BUTTON_SIZE, availableButtonSize)
    );
    terminal.style.setProperty("--terminal-button-size", `${buttonSize}px`);
};

const updateTerminalToggleButton = () => {
    const isOpen = $("#terminal").css("display") !== "none";
    const button = $("#open-terminal");
    const label = isOpen ? "Close Terminal" : "Open Terminal";
    button.toggleClass("is-active", isOpen);
    button.attr("aria-pressed", String(isOpen));
    button.attr("aria-expanded", String(isOpen));
    button.attr("aria-label", label);
    button.attr("data-tippy-content", label);
    if (button[0]?._tippy) button[0]._tippy.setContent(label);
};

const closeTerminalPanel = (rememberOpen = false) => {
    $("#terminal").css("display", "none");
    Blockly.triggleResize();
    if (editor) editor.layout();
    terminalShowFlag = rememberOpen;
    updatePanelResizeHandles();
    if (!rememberOpen) localStorage.removeItem("terminal_size");
    updateTerminalToggleButton();
};

$("#close-terminal").click(() => closeTerminalPanel());

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
updateTerminalToggleButton();

const openTerminalPanel = () => {
    terminalShowFlag = true;
    $("#terminal").css("display", "flex");
    $("#terminal").width(beforeWidthTerminalSize);
    Blockly.triggleResize();
    updateTerminalToolbarLayout();
    if (editor) editor.layout();
    if (fitAddon) {
        setTimeout(() => {
            fitAddon.fit();
            fitAddon.fit();
        }, 10);
    }
    updatePanelResizeHandles();
    localStorage.setItem("terminal_size", $("#terminal").width());
    updateTerminalToggleButton();
};

$("#open-terminal").click(() => {
    if ($("#terminal").css("display") !== "none") {
        closeTerminalPanel();
    } else {
        openTerminalPanel();
    }
});

bindPanelResizeHandle("terminal-h-resize", getResizableDevicePanel, {
    minimumWidth: panel => panel.id === "simulator" ? MINIMUM_SIMULATOR_WIDTH : MINIMUM_TERMINAL_WIDTH,
    onResize: panel => {
        if (panel.id === "terminal") updateTerminalToolbarLayout();
    },
    onResizeEnd: panel => {
        if (panel.id === "terminal") {
            beforeWidthTerminalSize = $(panel).width();
            localStorage.setItem("terminal_size", beforeWidthTerminalSize);
        } else {
            localStorage.setItem("simulator_width_size", $(panel).width());
        }
    }
});

window.addEventListener("resize", updateTerminalToolbarLayout);

if (!isEmbed && deviceMode === MODE_REAL_DEVICE) {
    // Reopen a visible terminal at the compact default on each app launch.
    if (localStorage.getItem("terminal_size")) {
        $(() => openTerminalPanel());
    }
}
