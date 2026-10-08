// Run with Node 18+ and Playwright; never attaches to the user's browser tabs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { chromium } = require(process.env.MICROBLOCK_PLAYWRIGHT || 'playwright');

const root = path.resolve(__dirname, '../microBlock-IDE');
const sources = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<script src="([^"]+)"/g)]
    .map(match => match[1]).filter(file => /^(blockly\/|plug-in\/block-plus-minus\/|blocks\/)/.test(file)
        || file === 'js/blockly-compatibility.js');

(async () => {
    const browser = await chromium.launch({ headless: true,
        ...(process.env.MICROBLOCK_BROWSER_CHANNEL ? { channel: process.env.MICROBLOCK_BROWSER_CHANNEL } : {}) });
    let result;
    try {
        const page = await browser.newPage();
        await page.evaluate(() => {
            window.file_name_select = 'main.py';
            window.fs = { ls: () => [], read: () => '' };
            window.boards = [];
            window.boardId = null;
        });
        for (const file of sources) {
            await page.addScriptTag({ content: fs.readFileSync(path.join(root, file), 'utf8') + '\n//# sourceURL=' + file });
        }
        result = await page.evaluate(() => {
            const samples = [];
            let assertions = 0;
            const check = (condition, message) => {
                assertions++;
                if (!condition) throw Error(message);
            };
            Blockly.Events.disable();
            const ws = new Blockly.Workspace();
            const make = (type, fields = {}) => {
                const block = ws.newBlock(type);
                for (const [name, value] of Object.entries(fields)) block.setFieldValue(value, name);
                return block;
            };
            const connect = (parent, input, child) => parent.getInput(input).connection.connect(child.outputConnection);
            const generate = (block, generator) => {
                generator.init(ws);
                const output = generator.blockToCode(block);
                const body = Array.isArray(output) ? output[0] + '\n' : output;
                const code = generator.finish(body);
                if (generator === Blockly.Python && block.type !== 'text_code') samples.push(code || 'pass\n');
                return code;
            };
            const expression = (block, generator) => {
                generator.init(ws);
                const output = generator.blockToCode(block);
                generator.finish('');
                return Array.isArray(output) ? output[0] : output;
            };
            for (const type of ['controls_wait', 'controls_wait_ms', 'controls_wait_us', 'controls_wait_until',
                'while_loop', 'math_map', 'pin_digital_write', 'pin_pwm_write', 'pin_digital_read',
                'pin_analog_read', 'print', 'dht_read', 'ds18x20_read', 'rtc_set_time', 'light_sleep',
                'deep_sleep', 'send_into_source', 'run_in_background', 'import', 'call_import', 'random_seed']) {
                ws.clear();
                const block = make(type);
                const code = generate(block, Blockly.Python);
                check(!/(\(\s*,|,\s*,|\*\s*\))/.test(code), type + ': missing Python expression');
            }
            for (const type of ['controls_wait', 'controls_wait_ms', 'controls_wait_us', 'controls_wait_until',
                'while_loop', 'math_map', 'print', 'send_into_source', 'serial_begin', 'serial_print',
                'serial_println', 'serial_set_timeout']) {
                ws.clear();
                const code = generate(make(type), Blockly.JavaScript);
                check(!/(\(\s*,|,\s*,|\*\s*\)|\(\s*\))/.test(code), type + ': missing C++ expression');
            }
            ws.clear();
            let block = make('logic_compare');
            check(expression(block, Blockly.JavaScript) === '0 == 0', 'Empty comparison must use numbers');
            connect(block, 'A', make('text', { TEXT: 'hello' }));
            check(expression(block, Blockly.JavaScript) === 'String("hello") == ""', 'Missing text operand must be empty text');
            ws.clear();
            block = make('logic_compare');
            connect(block, 'B', make('math_number', { NUM: 7 }));
            check(expression(block, Blockly.JavaScript) === '0 == 7', 'Missing numeric operand must be zero');
            ws.clear();
            block = make('math_arithmetic', { OP: 'POWER' });
            connect(block, 'A', make('math_number', { NUM: 2 }));
            connect(block, 'B', make('math_number', { NUM: 3 }));
            check(expression(block, Blockly.JavaScript) === 'pow(2, 3)', 'C++ exponentiation must use pow');
            ws.clear();
            block = make('math_modulo');
            connect(block, 'DIVIDEND', make('math_number', { NUM: 5.5 }));
            connect(block, 'DIVISOR', make('math_number', { NUM: 2 }));
            check(expression(block, Blockly.JavaScript) === 'fmod(5.5, 2)', 'Modulo must accept decimal operands');
            for (const op of ['SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN']) {
                ws.clear();
                block = make('math_trig', { OP: op });
                connect(block, 'NUM', make('math_number', { NUM: 0.5 }));
                const cpp = expression(block, Blockly.JavaScript);
                const value = new Function('PI', op.toLowerCase(), 'return ' + cpp)(Math.PI, Math[op.toLowerCase()]);
                const expected = op.startsWith('A') ? Math[op.toLowerCase()](0.5) * 180 / Math.PI
                    : Math[op.toLowerCase()](0.5 * Math.PI / 180);
                check(Math.abs(value - expected) < 1e-10, op + ': incorrect degree conversion');
                if (op.startsWith('A')) {
                    const division = make('math_arithmetic', { OP: 'DIVIDE' });
                    connect(division, 'A', make('math_number', { NUM: 60 }));
                    connect(division, 'B', block);
                    const nested = expression(division, Blockly.JavaScript);
                    const nestedValue = new Function('PI', op.toLowerCase(), 'return ' + nested)(Math.PI, Math[op.toLowerCase()]);
                    check(Math.abs(nestedValue - 60 / expected) < 1e-10, op + ': nested division must preserve precedence');
                }
            }
            const text = 'line one\nline two\r\t"\\';
            check(JSON.parse(Blockly.JavaScript.quote_(text)) === text, 'Text literals must preserve escaped control characters');
            ws.clear();
            const variable = ws.createVariable('has value');
            const setter = make('variables_set', { VAR: variable.getId() });
            connect(setter, 'VALUE', make('logic_boolean'));
            const getter = make('variables_get', { VAR: variable.getId() });
            const arithmetic = make('math_arithmetic');
            connect(arithmetic, 'A', getter);
            const target = arithmetic.getInputTargetBlock('A');
            const varCode = generate(setter, Blockly.JavaScript);
            check(varCode.includes('bool has_value;'), 'Boolean variable must use the C++ bool type');
            check(getter.outputConnection.getCheck() === null && arithmetic.getInputTargetBlock('A') === target,
                'Code generation must not change variable types or detach connections');
            ws.clear();
            const sameName = ws.createVariable('has value');
            const emptySetter = make('variables_set', { VAR: sameName.getId() });
            check(generate(emptySetter, Blockly.JavaScript).includes('float has_value;'), 'Variable types must reset between workspaces');
            ws.clear();
            const sourceVariable = ws.createVariable('source text');
            const copiedVariable = ws.createVariable('copied text');
            const copiedSetter = make('variables_set', { VAR: copiedVariable.getId() });
            connect(copiedSetter, 'VALUE', make('variables_get', { VAR: sourceVariable.getId() }));
            const sourceSetter = make('variables_set', { VAR: sourceVariable.getId() });
            connect(sourceSetter, 'VALUE', make('text', { TEXT: 'hello' }));
            const copiedCode = generate(copiedSetter, Blockly.JavaScript);
            check(copiedCode.includes('String source_text;') && copiedCode.includes('String copied_text;'),
                'Variable copies must retain text type regardless of block creation order');
            ws.clear();
            const definition = make('procedures_defreturn', { NAME: 'boolean_result' });
            connect(definition, 'RETURN', make('logic_boolean'));
            const defCode = generate(definition, Blockly.JavaScript);
            check(defCode.includes('bool boolean_result(') && defCode.includes('return true;'), 'Boolean return must infer bool');
            const caller = make('procedures_callreturn', { NAME: 'boolean_result' });
            check(expression(caller, Blockly.JavaScript) === 'boolean_result()', 'Procedure calls must preserve their full name');
            ws.clear();
            check(generate(make('procedures_defnoreturn', { NAME: 'do_work' }), Blockly.JavaScript).includes('void do_work('),
                'Procedure without RETURN input must generate a void function');
            ws.clear();
            const emptyFunction = generate(make('procedures_defreturn', { NAME: 'empty_result' }), Blockly.JavaScript);
            check(emptyFunction.includes('float empty_result(') && emptyFunction.includes('return 0;'),
                'A return procedure with an empty value must remain callable');
            ws.clear();
            const textFunction = make('procedures_defreturn', { NAME: 'text_result' });
            connect(textFunction, 'RETURN', make('text', { TEXT: 'hello' }));
            const forwardingFunction = make('procedures_defreturn', { NAME: 'forward_text' });
            connect(forwardingFunction, 'RETURN', make('procedures_callreturn', { NAME: 'text_result' }));
            check(generate(forwardingFunction, Blockly.JavaScript).includes('String forward_text('),
                'A procedure returning a text procedure call must retain String type');
            ws.clear();
            const earlyFunction = make('procedures_defreturn', { NAME: 'early_text' });
            const earlyReturn = make('procedures_ifreturn');
            connect(earlyReturn, 'VALUE', make('text', { TEXT: 'hello' }));
            earlyFunction.getInput('STACK').connection.connect(earlyReturn.previousConnection);
            const earlyCode = generate(earlyFunction, Blockly.JavaScript);
            check(earlyCode.includes('String early_text(') && earlyCode.includes('return String("");'),
                'Conditional text returns must infer String and provide an empty fallback');
            ws.clear();
            const rtc = make('rtc_set_time');
            for (const [name, value] of Object.entries({ year: 2026, month: 10, day: 8, hour: 23, min: 41, sec: 59 })) {
                connect(rtc, name, make('math_number', { NUM: value }));
            }
            check(generate(rtc, Blockly.Python).includes('RTC().datetime((2026, 10, 8, 0, 23, 41, 59, 0))'),
                'RTC datetime tuple must include weekday before hour');
            ws.clear();
            check(expression(make('rtc_get_microsecond'), Blockly.Python) === 'RTC().datetime()[7]', 'RTC subsecond getter must use tuple index seven');
            ws.clear();
            const seed = generate(make('random_seed'), Blockly.Python);
            check(seed.includes('from time import ticks_us') && seed.includes('random.seed(ticks_us())')
                && !seed.includes('Pin(') && !seed.includes('ADC'), 'Random seed must support ESP32 and RP2 without a fixed ADC pin');
            ws.clear();
            const random = generate(make('math_random_int'), Blockly.JavaScript);
            check(random.includes('random(first, second + 1)') && random.includes('if (first > second)'),
                'Random integer must include its upper endpoint and accept reversed bounds');
            ws.clear();
            const callback = make('run_in_background');
            const background = generate(callback, Blockly.Python);
            check(background.includes('pass'), 'Empty background callback must have a pass body');
            check(background === generate(callback, Blockly.Python), 'Background generation must be deterministic');
            ws.clear();
            window.fs = { ls: () => ['helpers.py'], read: () => 'def ping():\n  pass\n\ndef add(a, b=2):\n  return a + b\n' };
            const imported = make('call_import');
            check(imported.previousConnection && imported.nextConnection && !imported.outputConnection,
                'Initial imported void function must have statement connections');
            check(imported.inputList.every(input => !input.name), 'Zero-argument imported function must have no empty parameter');
            check(generate(imported, Blockly.Python).includes('helpers.ping()'), 'Imported call must use its own inputs');
            const addOption = imported.getField('object').getOptions(false).find(option => option[0] === 'helpers.add');
            imported.setFieldValue(addOption[1], 'object');
            imported.onchange({ type: 'change', blockId: imported.id });
            check(imported.outputConnection && !imported.previousConnection && !imported.nextConnection,
                'Imported return function must switch to a value connection');
            connect(imported, 'a', make('math_number', { NUM: 1 }));
            connect(imported, 'b', make('math_number', { NUM: 2 }));
            check(generate(imported, Blockly.Python).includes('helpers.add(1, 2)'), 'Imported parameters must generate in order');
            imported._updateInputValue(JSON.parse(addOption[1]));
            check(imported.getInputTargetBlock('a'), 'Restoring unchanged imported metadata must preserve parameters');
            window.fs.read = () => 'def add(b, a):\n  return a + b\n';
            const reordered = imported.getField('object').getOptions(false)[0];
            imported.setFieldValue(reordered[1], 'object');
            imported.onchange({ type: 'change', blockId: imported.id });
            check(generate(imported, Blockly.Python).includes('helpers.add(2, 1)'),
                'Imported calls must follow updated parameter order while preserving connections');
            ws.clear();
            block = make('text_code', { code: 'hello()' });
            check(expression(block, Blockly.Python) === 'hello()\n' && expression(block, Blockly.JavaScript) === 'hello()\n',
                'Raw code must terminate before the next block in both backends');
            ws.dispose();
            Blockly.Events.enable();
            return { assertions, samples };
        });
    } finally {
        await browser.close();
    }
    const syntax = spawnSync(process.env.MICROBLOCK_PYTHON || 'python', ['-c',
        'import ast,json,sys\nfor code in json.load(sys.stdin): ast.parse(code)\n'],
    { input: JSON.stringify(result.samples), encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr || syntax.error?.message);
    console.log('PASS: ' + result.assertions + ' common-block assertions; ' + result.samples.length + ' Python syntax checks.');
})().catch(error => { console.error(error); process.exitCode = 1; });
