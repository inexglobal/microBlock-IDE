Blockly.JavaScript.forBlock['motor1'] = function (block) {
    Blockly.JavaScript.definitions_['include']['Hanuman.h'] = '#include <Hanuman.h>';

    var dropdown_n = block.getFieldValue('n');
    var value_speed = Blockly.JavaScript.valueToCode(block, 'speed', Blockly.JavaScript.ORDER_ATOMIC) || "0";

    var code = `motor(${dropdown_n}, ${value_speed});\n`;
    return code;
};

Blockly.JavaScript.forBlock['motor2'] = function (block) {
    Blockly.JavaScript.definitions_['include']['Hanuman.h'] = '#include <Hanuman.h>';

    var value_speed1 = Blockly.JavaScript.valueToCode(block, 'speed1', Blockly.JavaScript.ORDER_ATOMIC) || "0";
    var value_speed2 = Blockly.JavaScript.valueToCode(block, 'speed2', Blockly.JavaScript.ORDER_ATOMIC) || "0";
    var value_speed3 = Blockly.JavaScript.valueToCode(block, 'speed3', Blockly.JavaScript.ORDER_ATOMIC) || "0";
    var value_speed4 = Blockly.JavaScript.valueToCode(block, 'speed4', Blockly.JavaScript.ORDER_ATOMIC) || "0";

    var code = `motor(${value_speed1}, ${value_speed2}, ${value_speed3}, ${value_speed4});\n`;
    return code;
};

Blockly.JavaScript.forBlock['motor_move'] = function(block) {
    Blockly.JavaScript.definitions_['include']['Hanuman.h'] = '#include <Hanuman.h>';
  
    var dropdown_move = block.getFieldValue('move');
    var value_speed = Blockly.JavaScript.valueToCode(block, 'speed', Blockly.JavaScript.ORDER_ATOMIC) || "0";
  
    var code = `${dropdown_move}(${value_speed});\n`;
    return code;
};

Blockly.JavaScript.forBlock['motor_move2'] = function(block) {
    Blockly.JavaScript.definitions_['include']['Hanuman.h'] = '#include <Hanuman.h>';
  
    var dropdown_move = block.getFieldValue('move');
    var value_speed1 = Blockly.JavaScript.valueToCode(block, 'speed1', Blockly.JavaScript.ORDER_ATOMIC) || "0";
    var value_speed2 = Blockly.JavaScript.valueToCode(block, 'speed2', Blockly.JavaScript.ORDER_ATOMIC) || "0";
  
    var code = `${dropdown_move}(${value_speed1}, ${value_speed2});\n`;
    return code;
};

Blockly.JavaScript.forBlock['motor_move_4wd'] = function(block) {
    Blockly.JavaScript.definitions_['include']['Hanuman.h'] = '#include <Hanuman.h>';
  
    var dropdown_move = block.getFieldValue('move');
    var value_speed = Blockly.JavaScript.valueToCode(block, 'speed', Blockly.JavaScript.ORDER_ATOMIC) || "0";
  
    var code = `${dropdown_move}(${value_speed});\n`;
    return code;
};

Blockly.JavaScript.forBlock['motor_move2_4wd'] = function(block) {
    Blockly.JavaScript.definitions_['include']['Hanuman.h'] = '#include <Hanuman.h>';
  
    var dropdown_move = block.getFieldValue('move');
    var value_speed1 = Blockly.JavaScript.valueToCode(block, 'speed1', Blockly.JavaScript.ORDER_ATOMIC) || "0";
    var value_speed2 = Blockly.JavaScript.valueToCode(block, 'speed2', Blockly.JavaScript.ORDER_ATOMIC) || "0";
  
    var code = `${dropdown_move}(${value_speed1}, ${value_speed2});\n`;
    return code;
};

Blockly.JavaScript.forBlock['turn'] = function (block) {
    Blockly.JavaScript.definitions_['include']['Hanuman.h'] = '#include <Hanuman.h>';

    var dropdown_dir = block.getFieldValue('dir');
    var value_speed = Blockly.JavaScript.valueToCode(block, 'speed', Blockly.JavaScript.ORDER_ATOMIC) || "0";

    var code = `${dropdown_dir === "RIGHT" ? "tr" : "tl"}(${value_speed || "0"});\n`;
    return code;
};

Blockly.JavaScript.forBlock['spin'] = function (block) {
    Blockly.JavaScript.definitions_['include']['Hanuman.h'] = '#include <Hanuman.h>';

    var dropdown_dir = block.getFieldValue('dir');
    var value_speed = Blockly.JavaScript.valueToCode(block, 'speed', Blockly.JavaScript.ORDER_ATOMIC) || "0";

    var code = `${dropdown_dir === "RIGHT" ? "sr" : "sl"}(${value_speed || "0"});\n`;
    return code;
};

Blockly.JavaScript.forBlock['motor_stop'] = function (block) {
    Blockly.JavaScript.definitions_['include']['Hanuman.h'] = '#include <Hanuman.h>';

    var dropdown_n = block.getFieldValue('n');

    var code = `motor_stop(${dropdown_n});\n`;
    return code;
};
