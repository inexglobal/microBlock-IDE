// Run with Node 18+ and Playwright; uses a fresh headless browser, never the user's tabs.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { chromium } = require(process.env.MICROBLOCK_PLAYWRIGHT || 'playwright');

const root = path.resolve(__dirname, '../microBlock-IDE');
const reportPath = process.argv.includes('--report')
    ? path.resolve(process.argv[process.argv.indexOf('--report') + 1])
    : path.join(os.tmpdir(), 'microblock-block-audit.json');
const channel = process.env.MICROBLOCK_BROWSER_CHANNEL;
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const baseScripts = [...index.matchAll(/<script src="([^"]+)"/g)].map(match => match[1])
    .filter(file => /^(blockly\/|plug-in\/block-plus-minus\/|blocks\/)/.test(file)
        || file === 'js/blockly-compatibility.js');
const boardIds = [...fs.readFileSync(path.join(root, 'boards/index.js'), 'utf8')
    .matchAll(/^\s*"([^"]+)"/gm)].map(match => match[1]);
const boardIndexes = boardIds.map(id => fs.readFileSync(path.join(root, 'boards', id, 'index.js'), 'utf8'));
const sources = new Map(baseScripts.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const toolboxSource = appSource.slice(appSource.indexOf('let updateBlockCategory'), appSource.indexOf('Blockly.triggleResize'));
const failures = [];
const results = [];

async function addSource(page, file) {
    const source = sources.get(file) || fs.readFileSync(path.join(root, file), 'utf8');
    await page.addScriptTag({ content: source + '\n//# sourceURL=' + file });
}

async function checkBoard(browser, boardId) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (/unknown field type|field.*not registered|ignoring non.exist[ae]nt field/i.test(message.text())) {
            errors.push(message.text());
        }
    });
    try {
        await page.setContent('<div id="workspace" style="width:1000px;height:650px"></div>');
        await page.evaluate(() => {
            window.rootPath = '';
            window.boards = [];
            window.boardId = null;
            window.file_name_select = 'main.py';
            window.fs = { ls: () => [], read: () => '' };
            window.__Function = function() {};
            window.__Number = 0;
            window.__Array = [];
            window.addBoard = board => boards.push(board);
        });
        await addSource(page, 'js/lodash.min.js');
        await addSource(page, 'js/jquery-3.5.1.min.js');
        await addSource(page, 'js/utilities.js');
        await addSource(page, 'blocksTree.js');
        for (const file of baseScripts) await addSource(page, file);
        for (let i = 0; i < boardIndexes.length; i++) {
            await page.addScriptTag({ content: boardIndexes[i] + '\n//# sourceURL=boards/' + boardIds[i] + '/index.js' });
        }
        const boardAssets = await page.evaluate(id => {
            window.boardId = id;
            const board = boards.find(item => item.id === id);
            if (!board) throw Error('Unknown board ' + id);
            window.auditBoard = board;
            return { blocks: board.blocks || [], script: board.script || [] };
        }, boardId);
        const boardFiles = boardAssets.blocks;
        const customTypes = new Set();
        for (const file of [...baseScripts.filter(file => file.startsWith('blocks/')),
            ...boardFiles.map(file => path.posix.normalize('boards/' + boardId + '/' + file))]) {
            const source = sources.get(file) || fs.readFileSync(path.join(root, file), 'utf8');
            for (const match of source.matchAll(/Blockly\.Blocks\[['"]([^'"]+)['"]\]|["']type["']\s*:\s*["']([^"']+)["']/g)) {
                const type = match[1] || match[2];
                if (!/^(input_|field_)/.test(type)) customTypes.add(type);
            }
        }
        for (const file of [...boardAssets.script, ...boardFiles]) {
            const sourceFile = path.posix.normalize('boards/' + boardId + '/' + file);
            await page.evaluate(({ source, sourceFile }) => runJavaScript(source, sourceFile), {
                source: fs.readFileSync(path.join(root, sourceFile), 'utf8'), sourceFile
            });
        }
        await page.addScriptTag({ content: toolboxSource });
        const result = await page.evaluate(async ({ customTypes, boardId }) => {
            const failures = [];
            const samples = [];
            const generator = auditBoard.isArduinoPlatform ? Blockly.JavaScript : Blockly.Python;
            const language = auditBoard.isArduinoPlatform ? 'cpp' : 'python';
            Blockly.Events.disable();
            const workspace = Blockly.inject(document.getElementById('workspace'), {
                renderer: 'geras', toolbox: '<xml><category name="Test"></category></xml>'
            });
            workspace.microBlockIsArduinoPlatform = !!auditBoard.isArduinoPlatform;
            const types = new Set(customTypes.filter(type => Blockly.Blocks[type]));
            const entries = [];
            window.blocklyWorkspace = workspace;
            window.isEmbed = false;
            window.isElectron = false;
            window.$ = () => [];
            let menu;
            const updateToolbox = workspace.updateToolbox.bind(workspace);
            workspace.updateToolbox = xml => { menu = xml; updateToolbox(xml); };
            for (const level of auditBoard.level || []) {
                window.levelName = level.name;
                await updateBlockCategory();
                for (const element of menu.querySelectorAll('block,shadow')) {
                    const type = element.getAttribute('type');
                    if (!Blockly.Blocks[type] || !generator.forBlock[type]) {
                        failures.push({ boardId, type, variant: 'menu', error: 'Unsupported block visible in toolbox' });
                    }
                }
                for (const category of menu.querySelectorAll('category')) {
                    for (const element of category.children) {
                        if (element.tagName.toLowerCase() === 'block') {
                            entries.push({ type: element.getAttribute('type'), xml: element.outerHTML, source: category.getAttribute('name') });
                        }
                    }
                }
                for (const category of level.blocks || []) {
                    if (Array.isArray(category.blocks)) {
                        for (const entry of category.blocks) {
                            if (typeof entry === 'string') {
                                types.add(entry);
                            } else if (entry.xml) {
                                const doc = Blockly.utils.xml.textToDom('<xml>' + entry.xml + '</xml>');
                                for (const element of doc.querySelectorAll('block,shadow')) {
                                    types.add(element.getAttribute('type'));
                                }
                            }
                        }
                    } else if (category.blocks === 'VARIABLE') {
                        ['variables_get', 'variables_set', 'math_change'].forEach(type => types.add(type));
                    } else if (category.blocks === 'PROCEDURE') {
                        ['procedures_defnoreturn', 'procedures_defreturn', 'procedures_callnoreturn', 'procedures_callreturn', 'procedures_ifreturn'].forEach(type => types.add(type));
                    }
                }
            }
            ['controls_flow_statements', 'logic_boolean'].forEach(type => types.add(type));
            const unsupportedTypes = [];
            const internal = /^(procedures_mutator|controls_if_(if|elseif|else)|text_create_join_item)/;
            const run = (type, xml, variant, fieldName, fieldValue, filled) => {
                workspace.clear();
                try {
                    if (!Blockly.Blocks[type]) throw Error('Missing block definition');
                    const node = Blockly.utils.xml.textToDom('<xml>' + (xml || '<block type="' + type + '"></block>') + '</xml>');
                    Blockly.Xml.domToWorkspace(node, workspace);
                    const block = workspace.getTopBlocks(false).find(block => block.type === type);
                    if (!block) throw Error('Block did not deserialize');
                    if (fieldName) block.setFieldValue(fieldValue, fieldName);
                    if (filled) {
                        for (const input of block.inputList) {
                            if (input.type !== Blockly.INPUT_VALUE || input.connection.targetBlock()) continue;
                            const checks = input.connection.getCheck() || [];
                            const valueType = checks.includes('Boolean') ? 'logic_boolean'
                                : checks.includes('String') ? 'text'
                                : checks.includes('Array') ? 'lists_create_with' : 'math_number';
                            const value = workspace.newBlock(valueType);
                            if (valueType === 'math_number') value.setFieldValue(2, 'NUM');
                            if (valueType === 'text') value.setFieldValue('test', 'TEXT');
                            value.initSvg();
                            input.connection.connect(value.outputConnection);
                        }
                    }
                    block.render();
                    if (!generator.forBlock[type]) throw Error('Missing ' + language + ' generator');
                    generator.init(workspace);
                    const output = generator.blockToCode(block);
                    let body = Array.isArray(output) ? output[0] + '\n' : output;
                    if (typeof body !== 'string') throw Error('Generator did not return code');
                    if (language === 'python') {
                        body = 'def __block_audit__():\n  for __audit_loop in range(1):\n'
                            + generator.prefixLines(body.trim() ? body : 'pass\n', '    ');
                    }
                    const code = generator.finish(body);
                    if (language === 'cpp' && type !== 'text_code'
                        && /(,\s*(?:,|\))|\(\s*,|\b(?:undefined|NaN)\b|=\s*;)/.test(code)) {
                        throw Error('Empty or undefined C++ expression: ' + code);
                    }
                    samples.push({ boardId, type, variant, language, code });
                    return block.inputList.flatMap(input => input.fieldRow)
                        .filter(field => field instanceof Blockly.FieldDropdown && field.name)
                        .flatMap(field => field.getOptions(false).map(option => ({ name: field.name, value: option[1] })));
                } catch (error) {
                    failures.push({ boardId, type, variant, error: error.message });
                    return [];
                }
            };
            for (const type of types) {
                if (internal.test(type)) continue;
                if (Blockly.Blocks[type] && !generator.forBlock[type]) {
                    unsupportedTypes.push(type);
                    continue;
                }
                const variants = run(type, null, 'empty-inputs');
                run(type, null, 'filled-inputs', null, null, true);
                for (const field of variants) run(type, null, field.name + '=' + field.value, field.name, field.value);
            }
            for (const entry of entries) {
                if (Blockly.Blocks[entry.type] && !generator.forBlock[entry.type]) continue;
                run(entry.type, entry.xml, 'toolbox:' + entry.source);
            }
            workspace.dispose();
            Blockly.Events.enable();
            return { boardId, types: types.size, cases: samples.length, unsupportedTypes, failures, samples };
        }, { customTypes: [...customTypes], boardId });
        if (errors.length) result.failures.push(...errors.map(error => ({ boardId, type: '(runtime)', error })));
        return result;
    } finally {
        await page.close();
    }
}

(async () => {
    const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
    try {
        const page = await browser.newPage();
        await page.evaluate(() => {
            window.boards = [];
            window.addBoard = board => boards.push(board);
            window.rootPath = '';
            window.Blockly = { Events: {} };
            window.__Function = function() {};
            window.__Number = 0;
            window.__Array = [];
        });
        await addSource(page, 'js/lodash.min.js');
        for (const content of boardIndexes) await page.addScriptTag({ content });
        const ids = await page.evaluate(() => boards.map(board => board.id));
        await page.close();
        for (const id of ids) {
            try {
                const result = await checkBoard(browser, id);
                results.push(result);
                failures.push(...result.failures);
                console.log(id + ': ' + result.types + ' types, ' + result.cases + ' generated cases, ' + result.failures.length + ' runtime failures');
            } catch (error) {
                failures.push({ boardId: id, type: '(load)', error: error.message });
                console.log(id + ': load failed: ' + error.message);
            }
        }
    } finally {
        await browser.close();
    }
    const pythonSamples = results.flatMap(result => result.samples).filter(sample => sample.language === 'python' && sample.type !== 'text_code');
    const python = process.env.MICROBLOCK_PYTHON || 'python';
    const syntaxCheck = spawnSync(python, ['-c', 'import json,sys\nitems=json.load(sys.stdin)\nout=[]\nfor i,item in enumerate(items):\n try: compile(item["code"], "<block audit>", "exec")\n except SyntaxError as e: out.append({"boardId":item["boardId"],"type":item["type"],"variant":item["variant"],"error":str(e),"code":item["code"]})\nprint(json.dumps(out))'], {
        input: JSON.stringify(pythonSamples), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024
    });
    if (syntaxCheck.status === 0) failures.push(...JSON.parse(syntaxCheck.stdout));
    else failures.push({ type: '(python checker)', error: syntaxCheck.stderr || syntaxCheck.error?.message || 'Python unavailable' });
    const summary = {
        boards: results.length,
        uniqueTypes: new Set(results.flatMap(result => result.samples.map(sample => sample.type))).size,
        cases: results.reduce((sum, result) => sum + result.cases, 0),
        pythonSyntaxCases: pythonSamples.length,
        failures: failures.length
    };
    fs.writeFileSync(reportPath, JSON.stringify({ summary, failures, results }, null, 2));
    console.log(JSON.stringify(summary));
    console.log('Report: ' + reportPath);
    process.exitCode = failures.length ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
