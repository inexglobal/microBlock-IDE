#!/usr/bin/env node
'use strict';

// Run from any directory with Node.js 18 or newer:
//   node scripts/check-board-blocks.cjs
// No npm dependencies, browser, or attached board are required. These regressions
// check generated code and board registrations; hardware behavior is not exercised.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const boardsRoot = path.resolve(__dirname, '../microBlock-IDE/boards');
let checks = 0;

function check(name, callback) {
    try {
        callback();
        checks++;
    } catch (error) {
        error.message = `${name}: ${error.message}`;
        throw error;
    }
}

function read(board, filename) {
    return fs.readFileSync(path.join(boardsRoot, board, filename), 'utf8');
}

function loadGenerator(board, filename, backend) {
    const generator = {
        forBlock: {},
        definitions_: { include: {}, define: {} },
        ORDER_ATOMIC: 0,
        ORDER_NONE: 99,
        INDENT: '  ',
        PASS: '  pass\n',
        quote_: text => JSON.stringify(text),
        valueToCode: (block, name) => block.values?.[name] || '',
        statementToCode: (block, name) => block.statements?.[name] || '',
        nameDB_: { getName: name => name },
        provideFunction_(name, lines) {
            this.definitions_[name] = lines.join('\n').replaceAll(this.FUNCTION_NAME_PLACEHOLDER_, name);
            return name;
        },
        FUNCTION_NAME_PLACEHOLDER_: '__FUNCTION__',
    };
    const Blockly = {
        Python: { forBlock: {} },
        JavaScript: { forBlock: {} },
        Variables: { allUsedVarModels: () => [], allDeveloperVariables: () => [] },
        Names: { DEVELOPER_VARIABLE_TYPE: 'developer' },
    };
    Blockly[backend] = generator;
    vm.runInNewContext(read(board, filename), { Blockly }, { filename: `${board}/${filename}` });
    return generator;
}

function loadDefinitions(board, filename) {
    const definitions = [];
    vm.runInNewContext(read(board, filename), {
        Blockly: { defineBlocksWithJsonArray: entries => definitions.push(...entries) },
    }, { filename: `${board}/${filename}` });
    return definitions;
}

function loadBoard(board) {
    let definition;
    vm.runInNewContext(read(board, 'index.js'), {
        addBoard: entry => { definition = entry; },
        rootPath: '',
        Blockly: { Events: {} },
    }, { filename: `${board}/index.js` });
    assert.ok(definition, `Missing board registration: ${board}`);
    return definition;
}

for (const board of ['pop-32', 'hanuman']) {
    const generator = loadGenerator(board, 'blocks/generators_motor.js', 'JavaScript');
    for (const [type, direction, expected] of [
        ['turn', 'LEFT', 'tl(42);\n'],
        ['turn', 'RIGHT', 'tr(42);\n'],
        ['spin', 'LEFT', 'sl(42);\n'],
        ['spin', 'RIGHT', 'sr(42);\n'],
    ]) {
        check(`${board} ${type} ${direction} uses its board movement API`, () => {
            const code = generator.forBlock[type]({
                getFieldValue: () => direction,
                values: { speed: '42' },
            });
            assert.equal(code, expected);
        });
    }
}

check('Puppy 4WD preserves independent values for all four wheels', () => {
    const generator = loadGenerator('puppy-bot-4wd', 'blocks/generators_motor.js', 'Python');
    assert.equal(generator.forBlock.motor_mecanum_wheel({
        values: { speed_m1: '11', speed_m2: '22', speed_m3: '33', speed_m4: '44' },
    }), 'motor.wheel(11, 22, 33, 44)\n');
});

for (const board of [
    'arduino-mega', 'arduino-nano', 'arduino-pro-mini', 'arduino-uno',
    'arduino-uno-r4-wifi', 'hanuman', 'pop-32',
]) {
    check(`${board} detach interrupt has a definition and a C++ generator`, () => {
        const definitions = loadDefinitions(board, 'blocks/blocks_pin.js');
        assert.ok(definitions.some(entry => entry.type === 'pin_detach_interrupt'));
        const generator = loadGenerator(board, 'blocks/generators_pin.js', 'JavaScript');
        assert.equal(generator.forBlock.pin_detach_interrupt({ getFieldValue: () => '3' }),
            'detachInterrupt(digitalPinToInterrupt(3));\n');
    });
}

check('Uno R4 custom matrix generates a blank frame for an empty field', () => {
    const generator = loadGenerator('arduino-uno-r4-wifi', 'blocks/generators_display.js', 'JavaScript');
    const code = generator.forBlock.display_custom({ getFieldValue: () => null });
    assert.match(code, /0x00000000, 0x00000000, 0x00000000/);
    assert.match(code, /matrix\.loadFrame\(buff\)/);
});

check('POP-32 empty bitmap generates a valid blank image', () => {
    const generator = loadGenerator('pop-32', 'blocks/generators_display.js', 'JavaScript');
    const code = generator.forBlock.display_draw_bitmap({ getFieldValue: () => null });
    assert.match(code, /oled\.drawBitmap\(0, 0, .*"\\x00", 1, 1, WHITE\);/);
});

for (const [label, expression] of [
    ['text', 'String("C4 C5 SIL")'],
    ['variable', 'melody'],
    ['joined text', '(String("C4 ") + String("C5"))'],
]) {
    check(`POP-32 buzzer preserves a ${label} melody for runtime parsing`, () => {
        const generator = loadGenerator('pop-32', 'blocks/generators_buzzer.js', 'JavaScript');
        const code = generator.forBlock.buzzer_notes({
            values: { notes: expression },
            getFieldValue: () => '1.0f',
        });
        assert.ok(code.includes(`String noteData = String(${expression});`));
        assert.match(code, /noteData\.substring\(start, end\)/);
        assert.match(code, /note == noteNames\[i\]/);
        assert.match(code, /freq = noteFrequencies\[i\]/);
        assert.match(code, /sound\(freq, duration\);/);
        const names = JSON.parse(`[${code.match(/noteNames\[\] = \{ (.+) \}/)[1]}]`);
        const frequencies = JSON.parse(`[${code.match(/noteFrequencies\[\] = \{ (.+) \}/)[1]}]`);
        assert.equal(names.length, frequencies.length);
        assert.deepEqual(['C4', 'C5', 'SIL'].map(name => frequencies[names.indexOf(name)]), [261, 523, 0]);
    });
}

check('POP-32 note literals remain valid String expressions inside and outside buzzer blocks', () => {
    const generator = loadGenerator('pop-32', 'blocks/generators_buzzer.js', 'JavaScript');
    const [expression, order] = generator.forBlock.make_note({ getFieldValue: () => 'C5 G5' });
    assert.equal(expression, 'String("C5 G5")');
    assert.equal(order, generator.ORDER_ATOMIC);
    const code = generator.forBlock.buzzer_notes({
        values: { notes: expression },
        getFieldValue: () => '1.0f',
    });
    assert.ok(code.includes(`String noteData = String(${expression});`));
});

for (const board of ['pop-32', 'hanuman']) {
    check(`${board} menu excludes unsupported native touch input`, () => {
        const definition = loadBoard(board);
        assert.ok(!JSON.stringify(definition.level).includes('pin_touch_read'));
    });
}

check('Uno R4 excludes obsolete display registrations without changing other displays', () => {
    const board = 'arduino-uno-r4-wifi';
    const definitions = loadDefinitions(board, 'blocks/blocks_display.js');
    const generator = loadGenerator(board, 'blocks/generators_display.js', 'JavaScript');
    const menu = JSON.stringify(loadBoard(board).level);
    for (const type of ['display_left_show', 'display_right_show', 'display_plot']) {
        assert.ok(!definitions.some(entry => entry.type === type));
        assert.equal(generator.forBlock[type], undefined);
        assert.ok(!menu.includes(type));
    }
    for (const type of ['display_show', 'display_scroll', 'display_show_number', 'display_dot_show']) {
        assert.ok(definitions.some(entry => entry.type === type));
        assert.equal(typeof generator.forBlock[type], 'function');
        assert.ok(menu.includes(type));
    }
});

for (const board of ['easy-kids-robot-kit', 'ipst-wifi', 'kidbright32', 'mbits', 'ttgo-t-display']) {
    const generator = loadGenerator(board, 'blocks/generators_switch.js', 'Python');
    for (const type of ['switch_on_press', 'switch_on_release', 'switch_on_pressed']) {
        if (!generator.forBlock[type]) continue;
        check(`${board} ${type} creates a valid empty callback body`, () => {
            generator.definitions_ = { include: {}, define: {} };
            generator.forBlock[type]({ getFieldValue: () => 'SW1', workspace: {}, getVars: () => [] });
            const callback = Object.values(generator.definitions_).find(value =>
                typeof value === 'string' && value.startsWith('def ') && value.includes('  pass\n'));
            assert.ok(callback, 'Empty callbacks must contain an indented pass statement');
        });
    }
}

for (const board of ['kidbright32', 'mbits']) {
    check(`${board} gesture callback permits an empty body`, () => {
        const generator = loadGenerator(board, 'blocks/generators_imu.js', 'Python');
        generator.forBlock.imu_on_gesture({ getFieldValue: () => 'SHAKE', workspace: {}, getVars: () => [] });
        assert.ok(Object.values(generator.definitions_).some(value =>
            typeof value === 'string' && value.startsWith('def ') && value.includes('  pass\n')));
    });
}

console.log(`${checks} board block regression checks passed.`);
