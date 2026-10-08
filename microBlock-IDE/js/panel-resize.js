const SIDE_PANEL_MINIMUM_WORKSPACE_WIDTH = 360;
const sidePanelIds = ["terminal", "simulator", "note"];
let sidePanelLayoutFrame = 0;

const isSidePanelVisible = panel => panel && getComputedStyle(panel).display !== "none";

const getResizableDevicePanel = () => {
    const terminal = document.getElementById("terminal");
    if (isSidePanelVisible(terminal)) return terminal;
    const simulator = document.getElementById("simulator");
    return isSidePanelVisible(simulator) ? simulator : null;
};

const updatePanelResizeHandles = () => {
    const positionHandle = (handleId, panel) => {
        const handle = document.getElementById(handleId);
        if (!handle) return;
        if (!isSidePanelVisible(panel)) {
            handle.style.display = "none";
            return;
        }

        const bounds = panel.getBoundingClientRect();
        handle.style.display = "block";
        handle.style.left = `${bounds.left - handle.offsetWidth / 2}px`;
        handle.style.right = "auto";
        handle.style.top = `${bounds.top}px`;
        handle.style.height = `${bounds.height}px`;
    };

    positionHandle("terminal-h-resize", getResizableDevicePanel());
    positionHandle("note-h-resize", document.getElementById("note"));
};

const requestSidePanelLayout = () => {
    if (sidePanelLayoutFrame) return;
    sidePanelLayoutFrame = requestAnimationFrame(() => {
        sidePanelLayoutFrame = 0;
        if (typeof Blockly.triggleResize === "function") Blockly.triggleResize();
        if (typeof editor !== "undefined" && editor) editor.layout();
        if (typeof fitAddon !== "undefined" && fitAddon &&
            isSidePanelVisible(document.getElementById("terminal"))) {
            fitAddon.fit();
        }
    });
};

const bindPanelResizeHandle = (handleId, getPanel, options) => {
    const handle = document.getElementById(handleId);
    if (!handle) return;

    $(handle).on("mousedown.panelResize", event => {
        if (event.button !== undefined && event.button !== 0) return;
        const panel = getPanel();
        if (!isSidePanelVisible(panel)) return;

        event.preventDefault();
        const startX = event.clientX;
        const startWidth = panel.getBoundingClientRect().width;
        const minimumWidth = options.minimumWidth(panel);
        $(handle).addClass("active");
        document.body.classList.add("is-resizing-panel");

        const finishDrag = () => {
            $(document).off(".panelResize");
            $(window).off("blur.panelResize");
            $(handle).removeClass("active");
            document.body.classList.remove("is-resizing-panel");
            if (options.onResizeEnd) options.onResizeEnd(panel);
            updatePanelResizeHandles();
            requestSidePanelLayout();
        };

        $(document).on("mousemove.panelResize", moveEvent => {
            moveEvent.preventDefault();
            const siblingWidth = sidePanelIds.reduce((total, id) => {
                const sibling = document.getElementById(id);
                return total + (sibling !== panel && isSidePanelVisible(sibling)
                    ? sibling.getBoundingClientRect().width : 0);
            }, 0);
            const maximumWidth = Math.max(minimumWidth,
                panel.parentElement.getBoundingClientRect().width - siblingWidth -
                SIDE_PANEL_MINIMUM_WORKSPACE_WIDTH);
            const width = Math.max(minimumWidth, Math.min(maximumWidth,
                startWidth + startX - moveEvent.clientX));

            panel.style.width = `${Math.round(width)}px`;
            if (options.onResize) options.onResize(panel);
            updatePanelResizeHandles();
            requestSidePanelLayout();
        }).on("mouseup.panelResize", finishDrag);
        $(window).on("blur.panelResize", finishDrag);
    });
};

$(() => {
    const updateLayout = () => {
        updatePanelResizeHandles();
        requestSidePanelLayout();
    };
    if (typeof ResizeObserver !== "undefined") {
        const panelResizeObserver = new ResizeObserver(updateLayout);
        for (const selector of [".page", "#terminal", "#simulator", "#note"]) {
            const element = document.querySelector(selector);
            if (element) panelResizeObserver.observe(element);
        }
    }
    window.addEventListener("resize", updateLayout);
    updateLayout();
});
