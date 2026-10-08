Blockly.JavaScript.forBlock['serial_begin'] = function (block) {
    var value_baud = Blockly.JavaScript.valueToCode(block, 'baud', Blockly.JavaScript.ORDER_ATOMIC) || '9600';

    var code = `Serial.begin(${value_baud});\n`;
    return code;
};

Blockly.JavaScript.forBlock['serial_print'] = function (block) {
    var value_text = Blockly.JavaScript.valueToCode(block, 'text', Blockly.JavaScript.ORDER_ATOMIC) || '""';

    var code = `Serial.print(${value_text});\n`;
    return code;
};

Blockly.JavaScript.forBlock['serial_println'] = function (block) {
    var value_text = Blockly.JavaScript.valueToCode(block, 'text', Blockly.JavaScript.ORDER_ATOMIC) || '""';

    var code = `Serial.println(${value_text});\n`;
    return code;
};

Blockly.JavaScript.forBlock['serial_set_timeout'] = function (block) {
    var value_timeout = Blockly.JavaScript.valueToCode(block, 'timeout', Blockly.JavaScript.ORDER_ATOMIC) || '1000';

    var code = `Serial.setTimeout(${value_timeout});\n`;
    return code;
};

Blockly.JavaScript.forBlock['serial_available'] = function (block) {
    var code = "Serial.available()";
    return [code, Blockly.JavaScript.ORDER_NONE];
};

Blockly.JavaScript.forBlock['serial_read_string'] = function (block) {
    var code = 'Serial.readString()';
    return [code, Blockly.JavaScript.ORDER_NONE];
};

Blockly.JavaScript.forBlock['serial_read_number_float'] = function (block) {
    var code = 'Serial.parseFloat()';
    return [code, Blockly.JavaScript.ORDER_NONE];
};

Blockly.JavaScript.forBlock['serial_read_number'] = function (block) {
    var code = 'Serial.parseInt()';
    return [code, Blockly.JavaScript.ORDER_NONE];
};
