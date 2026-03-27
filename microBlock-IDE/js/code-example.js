const blocklyDivExampleCode = document.querySelector("#blocklyDivExampleCode");
let editorCodeExample = null;

blocklyWorkspaceExampleCode = Blockly.inject(blocklyDivExampleCode, {
    media: 'blockly/media/',
    toolbox: "",
    grid: {
        spacing: 25,
        length: 1,
        colour: '#888',
        snap: true
    },
    trashcan: true,
    zoom: {
        controls: true,
        wheel: true,
        startScale: 1,
        maxScale: Infinity,
        minScale: 0.3,
        scaleSpeed: 1.2
    },
    scrollbars: true,
    comments: true,
    disable: true,
    maxBlocks: Infinity,
    rtl: false,
    oneBasedIndex: false,
    sounds: true,
    readOnly: true
});

const codeEditorExampleCode = document.querySelector("#codeEditorExampleCode");

function ensureExampleEditor() {
    if (!codeEditorExampleCode) return null;

    if (!editorCodeExample) {
        editorCodeExample = monaco.editor.create(codeEditorExampleCode, {
            value: "",
            language: "python",
            readOnly: true,
            automaticLayout: false,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "off"
        });
    }

    return editorCodeExample;
}

function renderExampleCode() {
    const editor = ensureExampleEditor();
    if (!editor) return;

    let code = "";
    try {
        code = Blockly.Python.workspaceToCode(blocklyWorkspaceExampleCode);
    } catch (e) {
        console.log(e);
        code = "";
    }

    requestAnimationFrame(() => {
        editor.setValue(code);
        editor.layout();
    });
}

$("#code-example-mode-select-switch > li").off("click").on("click", async function () {
    let value = $(this).attr("data-value");

    if (value == 1) { // Block mode
        $("#blocklyDivExampleCode").show();
        $("#codeEditorExampleCode").hide();

        requestAnimationFrame(() => {
            Blockly.svgResize(blocklyWorkspaceExampleCode);
            blocklyWorkspaceExampleCode.scrollCenter();
        });

    } else if (value == 2) { // Code mode
        $("#blocklyDivExampleCode").hide();
        $("#codeEditorExampleCode").show();

        renderExampleCode();
    }

    $("#code-example-mode-select-switch > li").removeClass("active");
    $(this).addClass("active");
});

const openExampleDialog = () => {
    if ($("#example-list-item > li").length <= 0) {
        $("#example-list-item").html("");

        // Get board example
        const board = boards.find(board => board.id === boardId);

        $("#example-list-item").append(`<li class="sub-header">Board Example</li>`);
        (board?.examples || []).forEach((item, index) => {
            if (typeof item === "string") {
                $("#example-list-item").append(`<li class="sub-header">${item}</li>`);
            } else {
                $("#example-list-item").append(`
                    <li>
                        <a
                            href="#"
                            data-index="${index}"
                            data-type="board"
                            data-files="${item?.files || ""}"
                        >${item.name}</a>
                    </li>
                `);
            }
        });
    }

    $("#example-list-item")
        .off("click", "a")
        .on("click", "a", async function (e) {
            e.preventDefault();

            try {
                const rawFileData = await (await fetch(`boards/${boardId}/${$(this).attr("data-files")}.mby`)).text();
                const local_vFSTree = JSON.parse(rawFileData);
                const xmlCode = local_vFSTree["main.xml"];

                blocklyWorkspaceExampleCode.clear();

                try {
                    Blockly.Xml.domToWorkspace(
                        Blockly.utils.xml.textToDom(xmlCode),
                        blocklyWorkspaceExampleCode
                    );
                } catch (e) {
                    console.log(e);
                }

                blocklyWorkspaceExampleCode.scrollCenter();

                $("#example-list-item > li").removeClass("active");
                $(this).parent().addClass("active");

                $("#noSelectExampleFile").hide();

                const activeMode = $("#code-example-mode-select-switch > li.active").attr("data-value");
                if (activeMode == 2) {
                    renderExampleCode();
                } else {
                    requestAnimationFrame(() => {
                        Blockly.svgResize(blocklyWorkspaceExampleCode);
                        blocklyWorkspaceExampleCode.scrollCenter();
                    });
                }
            } catch (e) {
                console.log(e);
            }
        });

    ShowDialog($("#code-example-dialog"));

    requestAnimationFrame(() => {
        const activeMode = $("#code-example-mode-select-switch > li.active").attr("data-value");

        if (activeMode == 2) {
            const editor = ensureExampleEditor();
            if (editor) {
                editor.layout();
            }
        } else {
            Blockly.svgResize(blocklyWorkspaceExampleCode);
            blocklyWorkspaceExampleCode.scrollCenter();
        }
    });
};

const addExampleCodeToMain = async () => {
    const fileMby = $("#example-list-item > li.active > a").attr("data-files");
    if (!fileMby) {
        return;
    }

    try {
        const rawFileData = await (await fetch(`boards/${boardId}/${fileMby}.mby`)).text();
        const local_vFSTree = JSON.parse(rawFileData);
        const xmlCode = local_vFSTree["main.xml"];

        Blockly.Xml.domToWorkspace(
            Blockly.utils.xml.textToDom(xmlCode),
            blocklyWorkspace
        );

        $("#code-example-dialog .close-dialog").click();
    } catch (e) {
        console.log(e);
    }
};

$("#add-example-code-to-workspace").off("click").on("click", addExampleCodeToMain);
$("#open-example-dialog").off("click").on("click", openExampleDialog);