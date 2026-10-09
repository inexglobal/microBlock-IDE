// Blockly 10 still accepts the generator[type] registration used by older
// extensions. Toolbox filtering and validation must use the same precedence
// as CodeGenerator.blockToCode, rather than checking only the new dictionary.
Blockly.hasBlockGenerator = function(generator, type) {
    return typeof (generator?.forBlock?.[type] || generator?.[type]) === "function";
};

// One incompatible extension entry must not abort the entire category. Keep
// Blockly's own entry conversion, block construction, and gap handling; only
// isolate failures and dispose the blocks that failed construction added.
(() => {
    const prototype = Blockly.Flyout?.prototype;
    if (!prototype || typeof prototype.getWorkspace !== "function"
        || typeof prototype.createFlyoutInfo !== "function"
        || typeof prototype.addSeparatorGap !== "function"
        || typeof prototype.show !== "function") return;

    const originalCreateFlyoutInfo = prototype.createFlyoutInfo;
    const originalShow = prototype.show;
    const reportedItems = new Set();
    const itemName = entry => {
        if (entry?.type) return String(entry.type);
        if (entry?.blockxml) {
            if (typeof entry.blockxml.getAttribute === "function") {
                return entry.blockxml.getAttribute("type") || "unknown block";
            }
            const match = String(entry.blockxml).match(/\btype\s*=\s*["']([^"']+)["']/);
            if (match) return match[1];
        }
        return String(entry?.custom || entry?.text || entry?.kind || "unknown item");
    };
    const reportFailure = (entry, error) => {
        const name = itemName(entry);
        if (reportedItems.has(name)) return;
        reportedItems.add(name);
        console.error(`Unable to show toolbox item "${name}". Check its extension block definition.`, error);
        if (typeof NotifyE === "function") {
            const safeName = name.replace(/[&<>"']/g, character => ({
                "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
            })[character]);
            try {
                NotifyE(`Unable to show block ${safeName}. Update its extension or check the console.`);
            } catch (notificationError) {
                console.warn("Unable to display toolbox error notification", notificationError);
            }
        }
    };
    const registeredBlocks = workspace => workspace.blockDB instanceof Map
        ? Array.from(workspace.blockDB.values()) : workspace.getAllBlocks(false);
    const cleanFailedBlocks = (workspace, previousIds) => {
        for (const block of registeredBlocks(workspace)) {
            if (previousIds.has(block.id) || block.isDisposed?.()) continue;
            // An invalid type can throw before the constructor adds the block
            // to the top/typed lists. Remove that otherwise unreachable ID.
            if (!workspace.getTopBlocks(false).includes(block) && !block.getParent?.()) {
                workspace.removeBlockById(block.id);
                continue;
            }
            try {
                block.dispose(false, false);
            } catch (error) {
                console.warn("Unable to dispose failed toolbox block", block.type, error);
            }
        }
    };

    prototype.createFlyoutInfo = function(entries) {
        const workspace = this.getWorkspace();
        const contents = [];
        const gaps = [];
        const disabledBlocks = [];
        const defaultGap = this.horizontalLayout ? this.GAP_X : this.GAP_Y;
        this.permanentlyDisabled.length = 0;

        for (const entry of entries) {
            const previousIds = new Set(registeredBlocks(workspace).map(block => block.id));
            try {
                // Separators modify the preceding entry's gap, so they must
                // see accumulated gaps instead of a one-entry temporary array.
                if (typeof entry?.kind === "string" && entry.kind.toUpperCase() === "SEP"
                    && !("custom" in entry)) {
                    this.addSeparatorGap(entry, gaps, defaultGap);
                    continue;
                }
                const result = originalCreateFlyoutInfo.call(this, [entry]);
                contents.push(...result.contents);
                gaps.push(...result.gaps);
                disabledBlocks.push(...this.permanentlyDisabled);
            } catch (error) {
                cleanFailedBlocks(workspace, previousIds);
                reportFailure(entry, error);
            }
        }
        // The upstream method resets this list each call, including nested
        // custom categories. Retain all disabled blocks for capacity checks.
        this.permanentlyDisabled.length = 0;
        this.permanentlyDisabled.push(...disabledBlocks);
        return { contents, gaps };
    };

    prototype.show = function(...args) {
        try {
            return originalShow.apply(this, args);
        } finally {
            const workspace = this.getWorkspace();
            if (workspace?.resizesEnabled === false) workspace.setResizesEnabled(true);
        }
    };
})();

// The block-plus-minus plugin reuses Blockly's text_quotes extension to get
// the quote image helpers needed by an empty text_join block. That extension
// also tries to decorate a TEXT field, which text_join does not have, and
// logs a warning for every valid text_join block loaded from XML.
(() => {
    const originalApply = Blockly.Extensions.apply;

    Blockly.Extensions.apply = function(extensionName, block, isMutator) {
        const needsTextJoinQuoteHelpers = extensionName === "text_quotes"
            && block.type === "text_join"
            && !block.getField("TEXT");

        if (!needsTextJoinQuoteHelpers) {
            return originalApply.call(this, extensionName, block, isMutator);
        }

        const helperInputName = "__microblock_text_quotes_helper__";
        block.appendDummyInput(helperInputName).appendField("", "TEXT");

        try {
            return originalApply.call(this, extensionName, block, isMutator);
        } finally {
            block.removeInput(helperInputName);
        }
    };
})();

// Blockly 10 has a single disabled flag. Keep automatic validation separate
// from the user's Disable action so that one listener cannot undo another.
(() => {
    // Blockly 10.1.3 checks whether a named warning is empty without first
    // removing its message. Clear that message before delegating icon cleanup.
    const originalSetWarningText = Blockly.BlockSvg.prototype.setWarningText;
    Blockly.BlockSvg.prototype.setWarningText = function(text, id) {
        if (text === null && id && !this.workspace.isDragging()) {
            this.getIcon(Blockly.icons.WarningIcon.TYPE)?.addMessage("", id);
        }
        return originalSetWarningText.call(this, text, id);
    };

    const disabledStates = new WeakMap();
    const applyingState = new WeakSet();
    const stateFor = block => {
        if (!disabledStates.has(block)) {
            disabledStates.set(block, {
                manual: !block.isEnabled(),
                reasons: new Set()
            });
        }
        return disabledStates.get(block);
    };
    const applyState = block => {
        const state = stateFor(block);
        applyingState.add(block);
        try {
            block.setEnabled(!state.manual && state.reasons.size === 0);
        } finally {
            applyingState.delete(block);
        }
    };

    for (const prototype of [Blockly.Block.prototype, Blockly.BlockSvg.prototype]) {
        const originalSetEnabled = prototype.setEnabled;
        prototype.setEnabled = function(enabled) {
            if (applyingState.has(this)) {
                return originalSetEnabled.call(this, enabled);
            }
            stateFor(this).manual = !enabled;
            applyState(this);
        };
    }

    const setAutomaticDisabled = (block, reason, disabled) => {
        const reasons = stateFor(block).reasons;
        if (disabled) reasons.add(reason);
        else reasons.delete(reason);
        const previousRecordUndo = Blockly.Events.getRecordUndo();
        Blockly.Events.setRecordUndo(false);
        try {
            applyState(block);
        } finally {
            Blockly.Events.setRecordUndo(previousRecordUndo);
        }
    };
    // Saved/duplicated blocks retain the user's Disable choice. Context-based
    // disabling is recalculated after load, rather than becoming permanent.
    const serializeManualState = (blocks, callback) => {
        const previousStates = [];
        for (const block of blocks) {
            const state = disabledStates.get(block);
            if (state) {
                previousStates.push([block, block.disabled]);
                block.disabled = state.manual;
            }
        }
        try {
            return callback();
        } finally {
            for (const [block, disabled] of previousStates) block.disabled = disabled;
        }
    };
    for (const [owner, method, workspace] of [
        [Blockly.Xml, "workspaceToDom", true],
        [Blockly.Xml, "blockToDom", false],
        [Blockly.Xml, "blockToDomWithXY", false],
        [Blockly.serialization.workspaces, "save", true],
        [Blockly.serialization.blocks, "save", false]
    ]) {
        const original = owner[method];
        owner[method] = function(source, ...args) {
            const blocks = workspace ? source.getAllBlocks(false) : source.getDescendants(false);
            return serializeManualState(blocks, () => original.call(this, source, ...args));
        };
    }
    const isArduinoWorkspace = workspace => {
        if (typeof workspace.microBlockIsArduinoPlatform === "boolean") {
            return workspace.microBlockIsArduinoPlatform;
        }
        return typeof boards !== "undefined" && typeof boardId !== "undefined"
            && !!boards.find(board => board.id === boardId)?.isArduinoPlatform;
    };
    const isContextEvent = event => [
        Blockly.Events.CREATE, Blockly.Events.MOVE, Blockly.Events.FINISHED_LOADING
    ].includes(event.type);
    const canValidate = (block, event) => block.workspace
        && !block.workspace.isFlyout && !block.workspace.isMutator && !block.isInFlyout
        && !(block.workspace.isDragging && block.workspace.isDragging())
        && isContextEvent(event);
    const withEventGroup = (event, callback) => {
        const previousGroup = Blockly.Events.getGroup();
        Blockly.Events.setGroup(event.group || false);
        try {
            callback();
        } finally {
            Blockly.Events.setGroup(previousGroup);
        }
    };
    const isProcedure = block => block.type === "procedures_defnoreturn"
        || block.type === "procedures_defreturn"
        || typeof block.getProcedureDef === "function";
    const callbackFunctions = new Set([
        "run_in_background", "switch_on_press", "switch_on_release",
        "switch_on_pressed", "imu_on_gesture", "pin_attach_interrupt"
    ]);

    // The top-level forever is a Python loop, but an Arduino loop() function.
    // Stop at function boundaries: break cannot escape the current function.
    const findSurroundLoop = block => {
        const arduino = isArduinoWorkspace(block.workspace);
        for (let parent = block.getSurroundParent(); parent; parent = parent.getSurroundParent()) {
            if (isProcedure(parent) || callbackFunctions.has(parent.type)) return null;
            if (parent.type === "controls_forever_no_connect") return arduino ? null : parent;
            if (arduino && parent.type === "controls_on_start") return null;
            if (Blockly.libraryBlocks.loops.loopTypes.has(parent.type)) return parent;
        }
        return null;
    };
    const validateFlow = (block, event) => {
        if (!canValidate(block, event)) return;
        const valid = !!findSurroundLoop(block);
        block.setWarningText(valid ? null : Blockly.Msg.CONTROLS_FLOW_STATEMENTS_WARNING, "microblock_flow");
        withEventGroup(event, () => setAutomaticDisabled(block, "flow_context", !valid));
    };
    Blockly.Extensions.unregister("controls_flow_in_loop_check");
    Blockly.Extensions.registerMixin("controls_flow_in_loop_check", {
        getSurroundLoop: function() { return findSurroundLoop(this); },
        onchange: function(event) { validateFlow(this, event); }
    });

    const findSurroundFunction = block => {
        const arduino = isArduinoWorkspace(block.workspace);
        for (let parent = block.getSurroundParent(); parent; parent = parent.getSurroundParent()) {
            if (isProcedure(parent) || callbackFunctions.has(parent.type)) return parent;
            if (arduino && ["controls_on_start", "controls_forever_no_connect"].includes(parent.type)) {
                return parent;
            }
        }
        return null;
    };
    const validateReturn = (block, event) => {
        if (!canValidate(block, event)) return;
        const parent = findSurroundFunction(block);
        if (parent) {
            const hasReturnValue = parent.type === "procedures_defreturn";
            if (hasReturnValue !== block.hasReturnValue_) {
                block.removeInput("VALUE");
                const input = hasReturnValue ? block.appendValueInput("VALUE") : block.appendDummyInput("VALUE");
                input.appendField(Blockly.Msg.PROCEDURES_DEFRETURN_RETURN);
                block.hasReturnValue_ = hasReturnValue;
            }
        }
        block.setWarningText(parent ? null : Blockly.Msg.PROCEDURES_IFRETURN_WARNING, "microblock_return");
        withEventGroup(event, () => setAutomaticDisabled(block, "return_context", !parent));
    };
    Blockly.Blocks.procedures_ifreturn.onchange = function(event) { validateReturn(this, event); };

    // Procedure calls also inherit a disabled definition. Track that reason
    // independently of orphan validation and a manually disabled call.
    const validateCall = (block, event) => {
        const definition = Blockly.Procedures.getDefinition(block.getProcedureCall(), block.workspace);
        withEventGroup(event, () => setAutomaticDisabled(block, "procedure_definition",
            !!definition && !definition.isEnabled()));
    };
    for (const type of ["procedures_callnoreturn", "procedures_callreturn"]) {
        const originalOnchange = Blockly.Blocks[type].onchange;
        Blockly.Blocks[type].onchange = function(event) {
            if (!this.workspace || this.workspace.isFlyout) return;
            if (event.type === Blockly.Events.CHANGE && event.element === "disabled") {
                const definition = Blockly.Procedures.getDefinition(this.getProcedureCall(), this.workspace);
                if (definition?.id === event.blockId) {
                    validateCall(this, event);
                    return;
                }
            }
            originalOnchange.call(this, event);
            if (this.workspace && isContextEvent(event)) validateCall(this, event);
        };
    }

    const validArduinoRoots = new Set([
        "controls_on_start", "controls_forever_no_connect",
        "procedures_defnoreturn", "procedures_defreturn",
        "procedures_mutatorcontainer", "procedures_mutatorarg"
    ]);
    const internalBlocks = new Set([
        "controls_if_if", "controls_if_elseif", "controls_if_else",
        "lists_create_with_container", "lists_create_with_item",
        "text_create_join_container", "text_create_join_item",
        "procedures_mutatorcontainer", "procedures_mutatorarg"
    ]);
    const validateSupport = workspace => {
        const arduino = isArduinoWorkspace(workspace);
        const generator = arduino ? Blockly.JavaScript : Blockly.Python;
        for (const block of workspace.getAllBlocks(false)) {
            const unsupported = !internalBlocks.has(block.type)
                && !Blockly.hasBlockGenerator(generator, block.type);
            block.setWarningText(unsupported
                ? `This block is not supported for ${arduino ? "Arduino" : "MicroPython"} on the selected board.`
                : null, "microblock_support");
            setAutomaticDisabled(block, "unsupported_generator", unsupported);
        }
    };
    Blockly.Events.validateBlockSupport = function(event) {
        if (!event.workspaceId || !isContextEvent(event)) return;
        const workspace = Blockly.Workspace.getById(event.workspaceId);
        if (!workspace || workspace.isFlyout || workspace.isMutator || workspace.isDragging?.()) return;
        withEventGroup(event, () => validateSupport(workspace));
    };
    const validateOrphans = (workspace, event) => {
        const arduino = isArduinoWorkspace(workspace);
        withEventGroup(event, () => {
            for (const block of workspace.getAllBlocks(false)) {
                setAutomaticDisabled(block, "arduino_orphan",
                    arduino && !validArduinoRoots.has(block.getRootBlock().type));
            }
        });
    };
    Blockly.Events.disableOrphansCustom = function(event) {
        if (!event.workspaceId || !isContextEvent(event)) return;
        const workspace = Blockly.Workspace.getById(event.workspaceId);
        if (!workspace || workspace.isFlyout || workspace.isMutator || workspace.isDragging?.()) return;
        validateOrphans(workspace, event);
    };

    // Board changes do not necessarily move blocks. Refresh the same validators
    // explicitly when the current board has loaded.
    Blockly.Events.refreshBlockValidation = function(workspace) {
        if (!workspace || workspace.isFlyout || workspace.isMutator) return;
        const event = {type: Blockly.Events.FINISHED_LOADING, group: Blockly.Events.getGroup()};
        validateOrphans(workspace, event);
        withEventGroup(event, () => validateSupport(workspace));
        for (const block of workspace.getAllBlocks(false)) {
            if (block.type === "controls_flow_statements") validateFlow(block, event);
            if (block.type === "procedures_ifreturn") validateReturn(block, event);
            if (["procedures_callnoreturn", "procedures_callreturn"].includes(block.type)) validateCall(block, event);
        }
    };
})();
