const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
let playwright;
try { playwright = require(process.env.MICROBLOCK_PLAYWRIGHT || 'playwright'); }
catch {
    playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
}

(async () => {
    const browser = await playwright.chromium.launch({headless: true,
        ...(process.env.MICROBLOCK_BROWSER_CHANNEL ? {channel: process.env.MICROBLOCK_BROWSER_CHANNEL} : {})});
    try {
        const page = await browser.newPage();
        await page.setContent('<div id="workspace" style="width:1000px;height:800px"></div>');
        await page.addScriptTag({content: 'globalThis.fs = {ls: () => ["main.py", "test.py"], read: () => ""}; globalThis.file_name_select = "main.py";'});
        const root = path.resolve(__dirname, '..', 'microBlock-IDE');
        for (const file of [
            'blockly/blockly_compressed.js', 'blockly/blocks_compressed.js',
            'blockly/python_compressed.js', 'blockly/javascript_compressed.js',
            'blockly/msg/en.js', 'plug-in/block-plus-minus/index.js',
            'js/blockly-compatibility.js', 'blocks/blocks_controls.js', 'blocks/generators_controls.js',
            'blocks/blocks_advanced.js', 'blocks/generators_avanced.js',
            'boards/kidbright32/blocks/blocks_switch.js', 'boards/kidbright32/blocks/generators_switch.js',
            'boards/kidbright32/blocks/blocks_imu.js', 'boards/kidbright32/blocks/generators_imu.js',
            'boards/arduino-uno/blocks/blocks_pin.js', 'boards/arduino-uno/blocks/generators_pin.js'
        ]) {
            await page.addScriptTag({content: fs.readFileSync(path.join(root, file), 'utf8')});
        }
        const result = await page.evaluate(async () => {
            const checks = [];
            const check = (label, condition) => {
                if (!condition) throw new Error(label);
                checks.push(label);
            };
            const workspace = Blockly.inject('workspace', {sounds: false});
            workspace.microBlockIsArduinoPlatform = false;
            workspace.addChangeListener(Blockly.Events.disableOrphansCustom);
            workspace.addChangeListener(Blockly.Events.validateBlockSupport);
            // Blockly schedules event delivery after requestAnimationFrame.
            // Wait for queue markers instead of assuming a fixed frame duration
            // while several browser suites run in parallel.
            const settle = async (target = workspace) => {
                for (let turn = 0; turn < 20; turn++) {
                    const delivered = await new Promise((resolve, reject) => {
                        const marker = new Blockly.Events.Abstract();
                        marker.type = 'audit_event_drain';
                        marker.workspaceId = target.id;
                        marker.recordUndo = false;
                        let count = 0;
                        const timeout = setTimeout(() => {
                            target.removeChangeListener(listener);
                            reject(new Error('Blockly event queue did not deliver the drain marker'));
                        }, 10000);
                        const listener = event => {
                            if (event === marker) {
                                clearTimeout(timeout);
                                target.removeChangeListener(listener);
                                resolve(count);
                            } else count++;
                        };
                        target.addChangeListener(listener);
                        Blockly.Events.fire(marker);
                    });
                    if (turn > 0 && delivered === 0) return;
                }
                throw new Error('Blockly events did not settle after 20 delivery rounds');
            };
            let created = 0;
            const make = type => {
                const block = workspace.newBlock(type);
                block.initSvg();
                block.render();
                // Detached test blocks must not collide and schedule unrelated
                // bump-neighbour movements while checking warnings or undo.
                block.moveBy(500 * (created % 5), 1000 * Math.floor(created / 5));
                created++;
                return block;
            };
            const refresh = () => Blockly.Events.refreshBlockValidation(workspace);
            const connect = (parent, input, child) => parent.getInput(input).connection.connect(child.previousConnection);
            const warning = block => !!block.getIcon(Blockly.icons.WarningIcon.TYPE);

            const flow = make('controls_flow_statements');
            await settle();
            check('Fresh break is disabled and warned without a move', !flow.isEnabled() && warning(flow));
            for (const type of ['controls_forever', 'while_loop', 'controls_repeat_ext', 'controls_whileUntil', 'controls_for', 'controls_forEach']) {
                const loop = make(type);
                connect(loop, type === 'controls_forever' ? 'block' : 'DO', flow);
                await settle();
                check(`Break enables inside ${type}`, flow.isEnabled() && !warning(flow));
                flow.unplug();
                await settle();
                check(`Break disables after leaving ${type}`, !flow.isEnabled() && warning(flow));
                loop.dispose();
            }
            const forever = make('controls_forever_no_connect');
            connect(forever, 'block', flow);
            await settle();
            check('Python top-level forever accepts break', flow.isEnabled() && !warning(flow));
            workspace.microBlockIsArduinoPlatform = true;
            refresh();
            check('Arduino loop callback rejects break', !flow.isEnabled() && warning(flow));
            check('Invalid callback break is omitted from Arduino code', !Blockly.JavaScript.workspaceToCode(workspace).includes('break;'));
            const nestedLoop = make('controls_forever');
            flow.unplug();
            connect(forever, 'block', nestedLoop);
            connect(nestedLoop, 'block', flow);
            await settle();
            check('Nested Arduino loop accepts break', flow.isEnabled() && !warning(flow));

            const strayWait = make('controls_wait');
            await settle();
            check('Detached Arduino statement is disabled', !strayWait.isEnabled());
            strayWait.setEnabled(false);
            connect(nestedLoop, 'block', strayWait);
            await settle();
            check('Attaching preserves user-disabled statement', !strayWait.isEnabled());
            strayWait.setEnabled(true);
            check('User can enable statement after attachment', strayWait.isEnabled());
            strayWait.setEnabled(false);
            nestedLoop.unplug();
            await settle();
            check('Detached loop and child become orphans', !nestedLoop.isEnabled() && !strayWait.isEnabled());
            connect(forever, 'block', nestedLoop);
            await settle();
            check('Reattached loop restores automatic state', nestedLoop.isEnabled() && !strayWait.isEnabled());
            flow.unplug();
            connect(nestedLoop, 'block', flow);
            await settle();
            flow.setEnabled(false);
            strayWait.moveBy(10, 0);
            await settle();
            check('Unrelated move preserves manual Disable on valid break', !flow.isEnabled());
            flow.setEnabled(true);
            check('Valid break can be enabled manually', flow.isEnabled());
            flow.unplug();
            connect(forever, 'block', flow);
            await settle();
            strayWait.moveBy(10, 0);
            await settle();
            check('Arduino orphan listener cannot re-enable invalid break', !flow.isEnabled() && warning(flow));
            flow.setEnabled(true);
            check('Manual Enable cannot bypass invalid loop context', !flow.isEnabled());
            flow.setFieldValue('CONTINUE', 'FLOW');
            check('Continue uses the same invalid-context guard', !flow.isEnabled());

            const ret = make('procedures_ifreturn');
            await settle();
            check('Fresh conditional return is disabled and warned', !ret.isEnabled() && warning(ret));
            flow.unplug();
            connect(forever, 'block', ret);
            await settle();
            check('Arduino loop callback accepts a void return', ret.isEnabled() && !ret.hasReturnValue_ && !warning(ret));
            workspace.microBlockIsArduinoPlatform = false;
            refresh();
            check('Python top-level forever rejects return', !ret.isEnabled() && warning(ret));
            const noReturn = make('procedures_defnoreturn');
            ret.unplug();
            connect(noReturn, 'STACK', ret);
            await settle();
            check('Void procedure accepts return without a value', ret.isEnabled() && !ret.hasReturnValue_ && !warning(ret));
            const defReturn = make('procedures_defreturn');
            ret.unplug();
            connect(defReturn, 'STACK', ret);
            await settle();
            check('Value procedure restores conditional return input', ret.isEnabled() && ret.hasReturnValue_ && !warning(ret));
            ret.setEnabled(false);
            strayWait.moveBy(10, 0);
            await settle();
            check('Return validation preserves user Disable', !ret.isEnabled());
            ret.setEnabled(true);
            check('Return can be enabled in a valid procedure', ret.isEnabled());
            ret.unplug();
            await settle();
            check('Return disables when detached from procedure', !ret.isEnabled() && warning(ret));
            ret.setWarningText('An independent warning', 'independent');
            connect(defReturn, 'STACK', ret);
            await settle();
            check('Clearing context warning preserves another named warning',
                ret.getIcon(Blockly.icons.WarningIcon.TYPE)?.getText() === 'An independent warning');
            ret.setWarningText(null, 'independent');
            check('Clearing the last named warning removes the warning icon', !warning(ret));
            ret.unplug();
            await settle();

            const automaticXml = Blockly.Xml.blockToDom(ret);
            check('Automatically disabled block is serialized without manual Disable', !automaticXml.hasAttribute('disabled'));
            check('XML serialization preserves the effective disabled runtime state', !ret.isEnabled());
            const automaticJson = Blockly.serialization.blocks.save(ret);
            check('JSON serialization excludes automatic Disable', automaticJson.enabled !== false);
            ret.setEnabled(false);
            check('XML serialization retains user Disable', Blockly.Xml.blockToDom(ret).getAttribute('disabled') === 'true');
            check('JSON serialization retains user Disable', Blockly.serialization.blocks.save(ret).enabled === false);
            ret.setEnabled(true);
            const loadedWorkspace = new Blockly.Workspace();
            loadedWorkspace.microBlockIsArduinoPlatform = false;
            const loadedXml = Blockly.utils.xml.createElement('xml');
            loadedXml.appendChild(automaticXml);
            Blockly.Xml.domToWorkspace(loadedXml, loadedWorkspace);
            const loadedReturn = loadedWorkspace.getAllBlocks(false).find(block => block.type === 'procedures_ifreturn');
            const loadedDefinition = loadedWorkspace.newBlock('procedures_defreturn');
            loadedDefinition.getInput('STACK').connection.connect(loadedReturn.previousConnection);
            Blockly.Events.refreshBlockValidation(loadedWorkspace);
            check('Reopened automatically disabled return enables in a valid function', loadedReturn.isEnabled());
            loadedWorkspace.dispose();

            defReturn.setFieldValue('warning_test_proc', 'NAME');
            const call = make('procedures_callreturn');
            call.loadExtraState({name: 'warning_test_proc'});
            await settle();
            check('A call to an enabled definition is enabled', call.isEnabled());
            defReturn.setEnabled(false);
            await settle();
            check('A disabled definition disables its calls', !call.isEnabled());
            call.setEnabled(false);
            defReturn.setEnabled(true);
            await settle();
            check('Definition re-enable preserves manually disabled call', !call.isEnabled());
            call.setEnabled(true);
            check('Valid manually disabled call can be re-enabled', call.isEnabled());
            workspace.microBlockIsArduinoPlatform = true;
            refresh();
            defReturn.setEnabled(false);
            await settle();
            defReturn.setEnabled(true);
            await settle();
            check('Definition re-enable cannot bypass Arduino orphan guard', !call.isEnabled());
            const start = make('controls_on_start');
            const setVariable = make('variables_set');
            connect(start, 'block', setVariable);
            setVariable.getInput('VALUE').connection.connect(call.outputConnection);
            await settle();
            check('Call restores after both definition and orphan guards clear', call.isEnabled());
            workspace.microBlockIsArduinoPlatform = false;
            refresh();

            const outerLoop = make('controls_forever');
            noReturn.setPreviousStatement(true);
            connect(outerLoop, 'block', noReturn);
            connect(noReturn, 'STACK', flow);
            await settle();
            check('Break never crosses a procedure boundary to an outer loop', !flow.isEnabled() && warning(flow));
            noReturn.unplug();
            flow.unplug();
            ret.unplug();
            for (const type of ['run_in_background', 'switch_on_press', 'switch_on_release', 'switch_on_pressed', 'imu_on_gesture', 'pin_attach_interrupt']) {
                workspace.microBlockIsArduinoPlatform = type === 'pin_attach_interrupt';
                const callback = make(type);
                const input = type === 'pin_attach_interrupt' ? 'code' : 'callback';
                if (workspace.microBlockIsArduinoPlatform) connect(forever, 'block', outerLoop);
                connect(outerLoop, 'block', callback);
                connect(callback, input, flow);
                await settle();
                check(`${type}: flow statement cannot escape a callback into outer loop`, !flow.isEnabled() && warning(flow));
                flow.unplug();
                connect(callback, input, ret);
                await settle();
                check(`${type}: conditional return exits callback without a value`, ret.isEnabled() && !ret.hasReturnValue_ && !warning(ret));
                ret.unplug();
                const inner = make('controls_forever');
                connect(callback, input, inner);
                connect(inner, 'block', flow);
                await settle();
                check(`${type}: flow statement works inside callback's own loop`, flow.isEnabled() && !warning(flow));
                flow.unplug();
                callback.dispose();
            }

            workspace.microBlockIsArduinoPlatform = true;
            refresh();
            check('Board refresh applies Arduino orphan state', !strayWait.isEnabled());
            workspace.microBlockIsArduinoPlatform = false;
            refresh();
            strayWait.setEnabled(true);
            check('Board refresh clears Arduino orphan reason for Python', strayWait.isEnabled());
            const imported = make('import');
            await settle();
            check('Python import remains enabled with its generator', imported.isEnabled() && !warning(imported));
            workspace.microBlockIsArduinoPlatform = true;
            refresh();
            check('Arduino import is disabled with an explanatory warning', !imported.isEnabled()
                && imported.getIcon(Blockly.icons.WarningIcon.TYPE)?.getText().includes('not supported for Arduino'));
            check('Unsupported import is omitted from generated Arduino code', !Blockly.JavaScript.workspaceToCode(workspace).includes('import test'));
            workspace.microBlockIsArduinoPlatform = false;
            refresh();
            check('Switching to Python clears unsupported import state', imported.isEnabled() && !warning(imported));
            const helper = make('procedures_mutatorarg');
            await settle();
            check('Internal mutator helper is exempt from backend validation', helper.isEnabled() && !warning(helper));
            imported.setEnabled(false);
            workspace.microBlockIsArduinoPlatform = true;
            refresh();
            workspace.microBlockIsArduinoPlatform = false;
            refresh();
            check('Backend switches preserve manual Disable on import', !imported.isEnabled());
            const undoWorkspace = new Blockly.Workspace();
            undoWorkspace.microBlockIsArduinoPlatform = false;
            const undoLoop = undoWorkspace.newBlock('controls_forever');
            const undoFlow = undoWorkspace.newBlock('controls_flow_statements');
            await settle(undoWorkspace);
            undoWorkspace.clearUndo();
            connect(undoLoop, 'block', undoFlow);
            await settle(undoWorkspace);
            check('Flow enables before undoing its attachment', undoFlow.isEnabled());
            undoWorkspace.undo(false);
            await settle(undoWorkspace);
            check('Undo detaches flow and recomputes its invalid context', !undoFlow.getSurroundParent() && !undoFlow.isEnabled());
            undoWorkspace.undo(true);
            await settle(undoWorkspace);
            check('Redo restores loop attachment and automatic enable state', undoFlow.getSurroundParent() === undoLoop && undoFlow.isEnabled());
            undoWorkspace.clearUndo();
            undoFlow.setEnabled(false);
            await settle(undoWorkspace);
            undoWorkspace.undo(false);
            await settle(undoWorkspace);
            check('Undo of manual Disable restores valid flow block', undoFlow.isEnabled());
            undoWorkspace.dispose();
            workspace.dispose();
            return {passed: checks.length, checks};
        });
        assert.ok(result.passed > 25);
        console.log(JSON.stringify(result, null, 2));
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
