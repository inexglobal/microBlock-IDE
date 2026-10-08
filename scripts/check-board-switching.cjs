// Exercise production loadBoard/runJavaScript in a fresh browser with saved XML.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.MICROBLOCK_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '../microBlock-IDE');
const baseScripts = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<script src="([^"]+)"/g)]
    .map(match => match[1]).filter(file => /^(blockly\/|plug-in\/block-plus-minus\/|blocks\/)/.test(file)
        || file === 'js/blockly-compatibility.js');

(async () => {
    const browser = await chromium.launch({ headless: true,
        ...(process.env.MICROBLOCK_BROWSER_CHANNEL ? { channel: process.env.MICROBLOCK_BROWSER_CHANNEL } : {}) });
    let result;
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('http://microblock.test/**', route => route.fulfill({ contentType: 'text/html',
            body: '<div id="arduino-console-dialog"><pre></pre><div class="title"></div></div>' }));
        await page.goto('http://microblock.test/');
        await page.evaluate(() => {
            window.rootPath = '';
            window.file_name_select = 'main.xml';
            window.fs = { ls: () => [], read: () => '' };
            window.MODE_REAL_DEVICE = 0;
            window.switchModeTo = () => {};
            window.updateBlockCategory = () => {};
            window.arduino_board_init = async () => {};
            window.ShowDialog = window.CloseDialog = () => {};
            localStorage.setItem('show-console-board-initial', '-1');
            window.__Function = function() {};
            window.__Number = 0;
            window.__Array = [];
        });
        const addSource = async file => page.addScriptTag({ content: fs.readFileSync(path.join(root, file), 'utf8')
            + '\n//# sourceURL=' + file });
        await addSource('js/jquery-3.5.1.min.js');
        await addSource('js/lodash.min.js');
        for (const file of baseScripts) await addSource(file);
        await addSource('js/utilities.js');
        await addSource('js/board.js');
        await addSource('boards/pico-x/index.js');
        await addSource('boards/arduino-uno/index.js');
        const boardFiles = await page.evaluate(() => boards.flatMap(board =>
            [...(board.script || []), ...(board.blocks || []), ...(board.simulator?.script || [])]
                .map(file => ({ id: board.id, file }))));
        const boardSources = {};
        for (const { id, file } of boardFiles) {
            const relative = path.posix.normalize('boards/' + id + '/' + file);
            boardSources['/' + relative] = fs.readFileSync(path.join(root, relative), 'utf8');
        }
        await page.evaluate(sources => {
            window.auditBoardSources = sources;
            window.fetch = async url => {
                const key = new URL(url, location.href).pathname;
                if (!(key in auditBoardSources)) throw Error('Unexpected board source ' + key);
                return { status: 200, text: async () => auditBoardSources[key] };
            };
        }, boardSources);
        result = await page.evaluate(async () => {
            let assertions = 0;
            const check = (condition, message) => { assertions++; if (!condition) throw Error(message); };
            Blockly.Events.disable();
            window.blocklyWorkspace = new Blockly.Workspace();
            const ws = blocklyWorkspace;
            const baselineSerial = Blockly.Blocks.serial_begin;
            const baselinePin = Blockly.Python.forBlock.pin_digital_read;
            const baselineMap = Blockly.JavaScript.forBlock.math_map;
            const load = async id => {
                ws.clear();
                boardId = id;
                levelName = boards.find(board => board.id === id).level[0].name;
                await loadBoard();
            };
            const restoredBlock = (xml, type) => {
                ws.clear();
                Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml), ws);
                return ws.getAllBlocks(false).find(block => block.type === type);
            };
            const generate = (block, generator) => {
                generator.init(ws);
                const code = generator.blockToCode(block);
                return generator.finish(Array.isArray(code) ? code[0] + '\n' : code);
            };
            await load('pico-x');
            check(Blockly.Blocks.serial_begin !== baselineSerial, 'Pico-X must install its serial definition');
            check(typeof Blockly.Python.forBlock.serial_begin === 'function', 'Pico-X must install its Python serial generator');
            let serial = ws.newBlock('serial_begin');
            serial.setFieldValue(57600, 'BAUD');
            const picoXml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws));
            check(generate(serial, Blockly.Python).includes('baudrate=57600'), 'Pico-X serial code must read the BAUD field');
            await load('arduino-uno');
            check(Blockly.Blocks.serial_begin === baselineSerial, 'Uno must restore the common serial definition');
            check(!Blockly.Python.forBlock.serial_begin, 'Pico-X serial generator must be removed when leaving the board');
            check(!Blockly.Blocks.serial_init && !Blockly.Python.forBlock.serial_init, 'Unrelated Pico-X-only serial registrations must be removed');
            const start = ws.newBlock('controls_on_start');
            serial = ws.newBlock('serial_begin');
            const baud = ws.newBlock('math_number');
            baud.setFieldValue(38400, 'NUM');
            serial.getInput('baud').connection.connect(baud.outputConnection);
            start.getInput('block').connection.connect(serial.previousConnection);
            const unoXml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws));
            check(generate(start, Blockly.JavaScript).includes('Serial.begin(38400);'), 'Uno serial code must read its baud input');
            await load('pico-x');
            serial = restoredBlock(picoXml, 'serial_begin');
            check(serial.getFieldValue('BAUD') === 57600 && !serial.getInput('baud'), 'Saved Pico-X serial shape must deserialize after Uno');
            check(generate(serial, Blockly.Python).includes('baudrate=57600'), 'Saved Pico-X serial code must survive a round trip');
            check(!Blockly.Blocks.pin_mode && !Blockly.JavaScript.forBlock.pin_mode, 'Uno-only pin registrations must be removed after returning to Pico-X');
            await load('arduino-uno');
            restoredBlock(unoXml, 'serial_begin');
            check(generate(ws.getTopBlocks(false)[0], Blockly.JavaScript).includes('Serial.begin(38400);'),
                'Saved Uno serial code must survive a second round trip');

            const base = { name: 'Registry audit', script: [], blocks: [], css: [], level: [{ name: 'Beginner' }] };
            addBoard({ ...base, id: 'audit-overrides', script: ['register.js'] });
            addBoard({ ...base, id: 'audit-empty' });
            auditBoardSources['/boards/audit-overrides/register.js'] = `
                Blockly.Blocks.audit_board_only = { init() { this.appendDummyInput().appendField('board only'); } };
                Blockly.Python.forBlock.audit_board_only = () => 'board_only()\\n';
                Blockly.Python.forBlock.print = () => 'board_print()\\n';
                Blockly.Blocks.logic_boolean.boardDecoration = true;
                Blockly.Blocks.logic_negate.boardDecoration = true;
                delete Blockly.JavaScript.forBlock.math_map;
            `;
            await load('audit-overrides');
            check(Blockly.Python.forBlock.pin_digital_read === baselinePin, 'Leaving Uno must restore a common overridden Python pin generator');
            check(!Blockly.JavaScript.forBlock.math_map, 'Synthetic board must be able to remove a registration');
            await load('audit-empty');
            check(!Blockly.Blocks.audit_board_only && !Blockly.Python.forBlock.audit_board_only, 'Unclaimed board-only registrations must be deleted');
            check(Blockly.JavaScript.forBlock.math_map === baselineMap, 'Deleted common generators must be restored');
            check(!Blockly.Blocks.logic_negate.boardDecoration && !Blockly.Blocks.logic_boolean.boardDecoration,
                'In-place board decorations must be removed from unchanged common definitions');
            await load('audit-overrides');
            const extensionDefinition = { init() { this.appendDummyInput().appendField('extension'); } };
            const extensionGenerator = () => 'extension_print()\n';
            Blockly.Blocks.audit_board_only = extensionDefinition;
            Blockly.Python.forBlock.print = extensionGenerator;
            Blockly.Blocks.logic_boolean.extensionDecoration = true;
            await load('audit-empty');
            check(Blockly.Blocks.audit_board_only === extensionDefinition, 'Later extension definition replacements must survive');
            check(Blockly.Python.forBlock.print === extensionGenerator, 'Later extension generator replacements must survive');
            check(Blockly.Blocks.logic_boolean.extensionDecoration, 'Later in-place extension decorations must survive');
            check(!Blockly.Blocks.logic_negate.boardDecoration, 'Unrelated board decorations must still be removed');
            ws.dispose();
            Blockly.Events.enable();
            return { assertions };
        });
        assert.deepEqual(errors, [], 'Unhandled browser errors');
    } finally {
        await browser.close();
    }
    console.log('PASS: ' + result.assertions + ' board switching and extension preservation assertions.');
})().catch(error => { console.error(error); process.exitCode = 1; });
