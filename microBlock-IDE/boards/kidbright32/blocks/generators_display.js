Blockly.Python.forBlock['display_custom'] = function(block) {
    Blockly.Python.definitions_['import_display'] = 'import display';

    var value = String(block.getFieldValue('value') || '');
    if (!/^(?:\\x[0-9a-fA-F]{2})+$/.test(value)) {
        value = Array.from(value, character => {
            const codePoint = character.codePointAt(0);
            const byte = codePoint <= 0xFF ? codePoint : 0;
            return `\\x${byte.toString(16).padStart(2, '0')}`;
        }).join('');
    }
    var code = `display.raw(b"${value}")\n`;
    return code;
};

Blockly.Python.forBlock['display_show'] = function(block) {
    Blockly.Python.definitions_['import_display'] = 'import display';

    var value_value = Blockly.Python.valueToCode(block, 'value', Blockly.Python.ORDER_ATOMIC) || "''";
    var code = `display.show(${value_value})\n`;
    return code;
};

Blockly.Python.forBlock['display_scroll'] = function(block) {
    Blockly.Python.definitions_['import_display'] = 'import display';

    var value_value = Blockly.Python.valueToCode(block, 'value', Blockly.Python.ORDER_ATOMIC) || "''";
    var code = `display.scroll(${value_value})\n`;
    return code;
};

Blockly.Python.forBlock['display_show4x8'] = function(block) {
    Blockly.Python.definitions_['import_display'] = 'import display';

    var value_value = Blockly.Python.valueToCode(block, 'value', Blockly.Python.ORDER_ATOMIC) || "''";
    var code = `display.show4x8(${value_value})\n`;
    return code;
};

Blockly.Python.forBlock['display_left_show'] = function(block) {
    Blockly.Python.definitions_['import_display'] = 'import display';

    var value_value = Blockly.Python.valueToCode(block, 'value', Blockly.Python.ORDER_ATOMIC) || "0";
    var code = `display.left(${value_value})\n`;
    return code;
};

Blockly.Python.forBlock['display_right_show'] = function(block) {
    Blockly.Python.definitions_['import_display'] = 'import display';

    var value_value = Blockly.Python.valueToCode(block, 'value', Blockly.Python.ORDER_ATOMIC) || "0";
    var code = `display.right(${value_value})\n`;
    return code;
};

Blockly.Python.forBlock['display_plot'] = function(block) {
    Blockly.Python.definitions_['import_display'] = 'import display';

    var value_value = Blockly.Python.valueToCode(block, 'value', Blockly.Python.ORDER_ATOMIC) || "0";
    var code = `display.plot(${value_value})\n`;
    return code;
};

Blockly.Python.forBlock['display_clear'] = function(block) {
    Blockly.Python.definitions_['import_display'] = 'import display';

    var code = 'display.clear()\n';
    return code;
};

Blockly.Python.forBlock['display_dot_show'] = function(block) {
    Blockly.Python.definitions_['import_display'] = 'import display';
  
    var value_x = Blockly.Python.valueToCode(block, 'x', Blockly.Python.ORDER_ATOMIC) || "0";
    var value_y = Blockly.Python.valueToCode(block, 'y', Blockly.Python.ORDER_ATOMIC) || "0";
    
    var code = `display.dot(${value_x}, ${value_y}, True)\n`;
    return code;
};

Blockly.Python.forBlock['display_dot_hide'] = function(block) {
    Blockly.Python.definitions_['import_display'] = 'import display';
  
    var value_x = Blockly.Python.valueToCode(block, 'x', Blockly.Python.ORDER_ATOMIC) || "0";
    var value_y = Blockly.Python.valueToCode(block, 'y', Blockly.Python.ORDER_ATOMIC) || "0";
    
    var code = `display.dot(${value_x}, ${value_y}, False)\n`;
    return code;
};
