var iBITPythonGeneratorRegistry = Blockly.Python.forBlock || Blockly.Python;

iBITPythonGeneratorRegistry['ibit_move'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var direction = block.getFieldValue('direction');
    var speed = Blockly.Python.valueToCode(block, 'speed', Blockly.Python.ORDER_ATOMIC) || '100';

    return `iBIT.move("${direction}", ${speed})\n`;
};

iBITPythonGeneratorRegistry['ibit_uturn'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var direction = block.getFieldValue('direction') || 'LEFT';
    var speed = Blockly.Python.valueToCode(block, 'speed', Blockly.Python.ORDER_ATOMIC) || '100';

    return `iBIT.uturn("${direction}", ${speed})\n`;
};

iBITPythonGeneratorRegistry['ibit_set_line_sensor_ports'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var leftPort = block.getFieldValue('left_port') || '1';
    var rightPort = block.getFieldValue('right_port') || '2';

    return `iBIT.set_line_sensor_ports(${leftPort}, ${rightPort})\n`;
};

iBITPythonGeneratorRegistry['ibit_set_ref_l'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var value = Blockly.Python.valueToCode(block, 'value', Blockly.Python.ORDER_ATOMIC) || '0';

    return `iBIT.set_threshold_left(${value})\n`;
};

iBITPythonGeneratorRegistry['ibit_set_ref_r'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var value = Blockly.Python.valueToCode(block, 'value', Blockly.Python.ORDER_ATOMIC) || '0';

    return `iBIT.set_threshold_right(${value})\n`;
};

iBITPythonGeneratorRegistry['ibit_gripper_enable'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var enabled = block.getFieldValue('enabled') === 'TRUE' ? 'True' : 'False';

    return `iBIT.GripperX.enable(${enabled})\n`;
};

iBITPythonGeneratorRegistry['ibit_gripper_set_ports'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var layout = block.getFieldValue('layout') || 'NORMAL';

    return `iBIT.GripperX.set_ports("${layout}")\n`;
};

iBITPythonGeneratorRegistry['ibit_gripper_set_degree'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var position = block.getFieldValue('position');
    var degree = Blockly.Python.valueToCode(block, 'degree', Blockly.Python.ORDER_ATOMIC) || '90';

    return `iBIT.GripperX.set_degree("${position}", ${degree})\n`;
};

iBITPythonGeneratorRegistry['ibit_gripper_control'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var action = block.getFieldValue('action');

    return `iBIT.GripperX.control("${action}")\n`;
};

iBITPythonGeneratorRegistry['ibit_gripper_smooth'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var action = block.getFieldValue('action');
    var speed = Blockly.Python.valueToCode(block, 'speed', Blockly.Python.ORDER_ATOMIC) || '50';

    return `iBIT.GripperX.smooth("${action}", ${speed})\n`;
};

iBITPythonGeneratorRegistry['ibit_gripper_home'] = function () {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    return 'iBIT.GripperX.home()\n';
};

iBITPythonGeneratorRegistry['ibit_gripper_stop'] = function () {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    return 'iBIT.GripperX.stop()\n';
};

iBITPythonGeneratorRegistry['ibit_intersection'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var action = block.getFieldValue('action');
    var seconds = Blockly.Python.valueToCode(block, 'seconds', Blockly.Python.ORDER_ATOMIC) || '0.5';
    var speedLeft = Blockly.Python.valueToCode(block, 'speed', Blockly.Python.ORDER_ATOMIC) || '100';
    var speedRight = Blockly.Python.valueToCode(block, 'speed_right', Blockly.Python.ORDER_ATOMIC) || speedLeft;

    return `iBIT.intersection("${action}", ${seconds}, ${speedLeft}, ${speedRight})\n`;
};

iBITPythonGeneratorRegistry['ibit_intersection_stop'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var speedLeft = Blockly.Python.valueToCode(block, 'speed', Blockly.Python.ORDER_ATOMIC) || '100';
    var speedRight = Blockly.Python.valueToCode(block, 'speed_right', Blockly.Python.ORDER_ATOMIC) || speedLeft;

    return `iBIT.intersection_stop(${speedLeft}, ${speedRight})\n`;
};

iBITPythonGeneratorRegistry['ibit_set_intersection_forward_time'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var seconds = Blockly.Python.valueToCode(block, 'seconds', Blockly.Python.ORDER_ATOMIC) || '0.5';

    return `iBIT.set_intersection_forward_time(${seconds})\n`;
};

iBITPythonGeneratorRegistry['ibit_motor1'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var dropdown_n = block.getFieldValue('n');
    var dropdown_dir = block.getFieldValue('dir');
    var value_speed = Blockly.Python.valueToCode(block, 'speed', Blockly.Python.ORDER_ATOMIC) || '0';

    return `iBIT.${dropdown_n}.set(${(dropdown_dir === "FORWARD" ? "" : "-") + value_speed})\n`;
};

iBITPythonGeneratorRegistry['ibit_motor2'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var dropdown_dir = block.getFieldValue('dir');
    var value_speed1 = Blockly.Python.valueToCode(block, 'speed1', Blockly.Python.ORDER_ATOMIC) || '0';
    var value_speed2 = Blockly.Python.valueToCode(block, 'speed2', Blockly.Python.ORDER_ATOMIC) || '0';

    return `iBIT.M1.set(${(dropdown_dir === "FORWARD" ? "" : "-") + value_speed1}); iBIT.M2.set(${(dropdown_dir === "FORWARD" ? "" : "-") + value_speed2})\n`;
};

iBITPythonGeneratorRegistry['ibit_turn'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var dropdown_dir = block.getFieldValue('dir');
    var value_speed = Blockly.Python.valueToCode(block, 'speed', Blockly.Python.ORDER_ATOMIC) || '0';

    return `iBIT.M1.set(${dropdown_dir === "RIGHT" ? value_speed : 0}); iBIT.M2.set(${dropdown_dir === "LEFT" ? value_speed : 0})\n`;
};

iBITPythonGeneratorRegistry['ibit_spin'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var dropdown_dir = block.getFieldValue('dir');
    var value_speed = Blockly.Python.valueToCode(block, 'speed', Blockly.Python.ORDER_ATOMIC) || '0';

    return `iBIT.M1.set(${(dropdown_dir === "RIGHT" ? "" : "-") + value_speed}); iBIT.M2.set(${(dropdown_dir === "LEFT" ? "" : "-") + value_speed})\n`;
};

iBITPythonGeneratorRegistry['ibit_stop_moving'] = function () {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    return 'iBIT.M1.set(0); iBIT.M2.set(0)\n';
};

iBITPythonGeneratorRegistry['ibit_motor_stop'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var motor = block.getFieldValue('motor') || 'ALL';
    if (motor === 'M1' || motor === 'M2') {
        return `iBIT.${motor}.set(0)\n`;
    }

    return 'iBIT.M1.set(0); iBIT.M2.set(0)\n';
};

iBITPythonGeneratorRegistry['ibit_servo'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var dropdown_ch = block.getFieldValue('ch');
    var value_angle = Blockly.Python.valueToCode(block, 'angle', Blockly.Python.ORDER_ATOMIC) || '90';

    return `iBIT.${dropdown_ch}.angle(${value_angle})\n`;
};

iBITPythonGeneratorRegistry['ibit_v2ar_servo'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var dropdown_ch = block.getFieldValue('ch');
    var value_angle = Blockly.Python.valueToCode(block, 'angle', Blockly.Python.ORDER_ATOMIC) || '90';

    return `iBIT.${dropdown_ch}.angle(${value_angle})\n`;
};

iBITPythonGeneratorRegistry['ibit_servo_move'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var dropdown_ch = block.getFieldValue('ch');
    var value_angle = Blockly.Python.valueToCode(block, 'angle', Blockly.Python.ORDER_ATOMIC) || '90';
    var value_speed = Blockly.Python.valueToCode(block, 'speed', Blockly.Python.ORDER_ATOMIC) || '50';

    return `iBIT.${dropdown_ch}.move(${value_angle}, ${value_speed})\n`;
};

iBITPythonGeneratorRegistry['ibit_servo_motor'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var dropdown_ch = block.getFieldValue('ch');
    var value_speed = Blockly.Python.valueToCode(block, 'speed', Blockly.Python.ORDER_ATOMIC) || '0';

    return `iBIT.${dropdown_ch}.speed(${value_speed})\n`;
};

iBITPythonGeneratorRegistry['ibit_servo_stop'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var dropdown_ch = block.getFieldValue('ch');

    return `iBIT.${dropdown_ch}.stop()\n`;
};

iBITPythonGeneratorRegistry['ibit_set_zx_sonar1m_adc'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var channel = block.getFieldValue('channel') || '0';

    return `iBIT.set_zx_sonar1m_adc(${channel})\n`;
};

iBITPythonGeneratorRegistry['ibit_zx_sonar1m_distance'] = function () {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    return ['iBIT.zx_sonar1m_cm()', Blockly.Python.ORDER_FUNCTION_CALL];
};

iBITPythonGeneratorRegistry['ibit_analog_read'] = function (block) {
    Blockly.Python.definitions_['import_iBIT'] = 'import iBIT';

    var dropdown_pin = block.getFieldValue('pin');
    var code = `iBIT.ADC(${dropdown_pin})`;

    return [code, Blockly.Python.ORDER_NONE];
};
