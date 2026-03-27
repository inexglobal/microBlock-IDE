let editor = null, editorReadonly = true;
let useMode = "block";
let onKeyUpTimer = null;

function ensureMainEditor(isArduinoPlatform) {
    const container = $("#code-editor > article")[0];
    if (!container) return null;

    if (!editor) {
        editor = monaco.editor.create(container, {
            value: "",
            language: !isArduinoPlatform ? "python" : "cpp",
            readOnly: file_name_select.endsWith(".py") ? false : true,
            automaticLayout: false,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "off"
        });

        editor.onKeyUp(async (evant) => {
            let allowKey = [
                8,  // CapsLock
                9,  // ESC
                6,  // AltLeft
                60, // F2
                61, // F3
                62, // F4
                63, // F5
                64, // F6
                65, // F7
                66, // F8
                67, // F9
                68, // F10
                69, // F11
                70, // F12
                15, // ArrowLeft
                16, // ArrowUp
                17, // ArrowRight
                18  // ArrowDown
            ];

            if (
                !evant.ctrlKey &&
                !evant.metaKey &&
                !evant.shiftKey &&
                allowKey.indexOf(evant.keyCode) === -1 &&
                !file_name_select.endsWith(".py")
            ) {
                evant.preventDefault();

                if (isEmbed) {
                    return;
                }

                file_select_without_ext = file_name_select.replace(/\.(py|xml)/, "");
                fs.remove("/" + file_select_without_ext + ".xml");

                if (await NotifyConfirm("If edit code, program in block will lost. Are you want to edit ?")) {
                    editor.updateOptions({ readOnly: false });
                    file_name_select = file_select_without_ext + ".py";
                }
            }

            if (file_name_select.endsWith(".py")) {
                if (onKeyUpTimer) clearTimeout(onKeyUpTimer);
                onKeyUpTimer = setTimeout(() => {
                    saveCodeToLocal();
                }, 1000);
            }
        });
    } else {
        const model = editor.getModel();
        if (model) {
            monaco.editor.setModelLanguage(model, !isArduinoPlatform ? "python" : "cpp");
        }
        editor.updateOptions({
            readOnly: file_name_select.endsWith(".py") ? false : true
        });
    }

    return editor;
}

$("#mode-select-switch > li").off("click").on("click", async function () {
    let value = $(this).attr("data-value");

    if (value == 1) { // Block mode
        if (file_name_select.endsWith(".py") && editor) {
            if (editor.getValue().length > 0) {
                if (!await NotifyConfirm("Code will convert to block (BETA). Are you confirm switch to block mode ?")) {
                    return;
                }
            }

            updataWorkspaceAndCategoryFromvFS();

            if (editor.getValue().length > 0) {
                codeFromMonacoToBlock();
            }

            fs.remove("/" + file_name_select);
            file_name_select = file_name_select.replace(/\.(py|xml)/, "") + ".xml";

            editor.updateOptions({ readOnly: true });
        }

        $("#blocks-editor").css("display", "flex");
        $("#code-editor").hide();

        requestAnimationFrame(() => {
            Blockly.triggleResize();
        });

        useMode = "block";

    } else if (value == 2) { // Code mode
        $("#blocks-editor").hide();
        $("#code-editor").css("display", "flex");

        const { isArduinoPlatform } = boards.find(board => board.id === boardId);
        let code = "";

        if (!isArduinoPlatform) { // MicroPython
            code = Blockly.Python.workspaceToCode(blocklyWorkspace);
        } else { // C++
            code = Blockly.JavaScript.workspaceToCode(blocklyWorkspace);
        }

        const mainEditor = ensureMainEditor(isArduinoPlatform);
        if (mainEditor) {
            requestAnimationFrame(() => {
                mainEditor.setValue(code);
                mainEditor.layout();
            });
        }

        useMode = "code";
    }

    $("#mode-select-switch > li").removeClass("active");
    $(this).addClass("active");
});

let __Function = () => "";
let __Number = 0;
let __Text = "";
let __Array = [];

// Helper function to return the monaco completion item type of a thing
function getType(thing, isMember) {
    isMember = (isMember == undefined) ? (typeof isMember == "boolean") ? isMember : false : false;

    switch ((typeof thing).toLowerCase()) {
        case "object":
            return monaco.languages.CompletionItemKind.Class;

        case "function":
            return (isMember) ? monaco.languages.CompletionItemKind.Method : monaco.languages.CompletionItemKind.Function;

        default:
            return (isMember) ? monaco.languages.CompletionItemKind.Property : monaco.languages.CompletionItemKind.Variable;
    }
}

let autoCompletionDictionary = {};

// Register object that will return autocomplete items
monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.', '('],

    provideCompletionItems: function (model, position, token) {
        var last_chars = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: 0,
            endLineNumber: position.lineNumber,
            endColumn: position.column
        });

        if (last_chars.lastIndexOf("(") >= 0) {
            last_chars = last_chars.substring(last_chars.lastIndexOf("(") + 1, last_chars.length);
        }

        var words = last_chars.replace("\t", "").split(" ");
        var active_typing = words[words.length - 1];
        var is_member = active_typing.charAt(active_typing.length - 1) == ".";
        var result = [];
        var last_token = autoCompletionDictionary;
        var prefix = '';

        if (is_member) {
            var parents = active_typing.substring(0, active_typing.length - 1).split(".");
            last_token = autoCompletionDictionary[parents[0]];
            prefix = parents[0];

            for (var i = 1; i < parents.length; i++) {
                if (last_token && last_token.hasOwnProperty(parents[i])) {
                    prefix += '.' + parents[i];
                    last_token = last_token[parents[i]];
                } else {
                    return { suggestions: result };
                }
            }

            prefix += '.';
        }

        for (var prop in last_token) {
            if (last_token.hasOwnProperty(prop) && !prop.startsWith("__")) {
                var details = '';

                try {
                    details = last_token[prop].__proto__.constructor.name;
                } catch (e) {
                    details = typeof last_token[prop];
                }

                var to_push = {
                    label: prefix + prop,
                    kind: getType(last_token[prop], is_member),
                    detail: details,
                    insertText: prop
                };

                if (to_push.detail.toLowerCase() == 'function') {
                    to_push.insertText += "(";
                } else if (Array.isArray(last_token[prop])) {
                    to_push.insertText += "[";
                }

                result.push(to_push);
            }
        }

        return {
            suggestions: result
        };
    }
});