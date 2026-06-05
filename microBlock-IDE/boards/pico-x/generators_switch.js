function switchBuildCallbackFunction(block, functionNameBase) {
    var statements_callback = Blockly.Python.statementToCode(block, 'callback');

    // Prevent invalid Python when callback body is empty.
    if (!statements_callback) {
        statements_callback = Blockly.Python.INDENT + 'pass\n';
    }

    var globals = [];
    var varName;
    var workspace = block.workspace;
    var variables = Blockly.Variables.allUsedVarModels(workspace) || [];

    for (var i = 0, variable; variable = variables[i]; i++) {
        varName = variable.name;
        if (block.getVars().indexOf(varName) == -1) {
            globals.push(Blockly.Python.nameDB_.getName(
                varName,
                Blockly.VARIABLE_CATEGORY_NAME
            ));
        }
    }

    var devVarList = Blockly.Variables.allDeveloperVariables(workspace);
    for (var j = 0; j < devVarList.length; j++) {
        globals.push(Blockly.Python.nameDB_.getName(
            devVarList[j],
            Blockly.Names.DEVELOPER_VARIABLE_TYPE
        ));
    }

    globals = globals.length ?
        Blockly.Python.INDENT + 'global ' + globals.join(', ') + '\n' : '';

    return Blockly.Python.provideFunction_(
        functionNameBase,
        [
            'def ' + Blockly.Python.FUNCTION_NAME_PLACEHOLDER_ + '(_=None):',
            globals,
            statements_callback
        ]
    );
}

Blockly.Python.forBlock['switch_is_press'] = function (block) {
    Blockly.Python.definitions_['import_switch'] = 'import switch';

    var dropdown_n = block.getFieldValue('n');

    var code = `switch.value(switch.${dropdown_n}) == 1`;
    return [code, Blockly.Python.ORDER_NONE];
};

Blockly.Python.forBlock['switch_is_release'] = function (block) {
    Blockly.Python.definitions_['import_switch'] = 'import switch';

    var dropdown_n = block.getFieldValue('n');

    var code = `switch.value(switch.${dropdown_n}) == 0`;
    return [code, Blockly.Python.ORDER_NONE];
};

Blockly.Python.forBlock['switch_get_value'] = function (block) {
    Blockly.Python.definitions_['import_switch'] = 'import switch';

    var dropdown_n = block.getFieldValue('n');

    var code = `switch.value(switch.${dropdown_n})`;
    return [code, Blockly.Python.ORDER_NONE];
};

Blockly.Python.forBlock['switch_on_press'] = function(block) {
    Blockly.Python.definitions_['import_switch'] = 'import switch';

    var dropdown_pin = block.getFieldValue('pin');
    var functionName = switchBuildCallbackFunction(
        block,
        dropdown_pin + 'OnPressCB'
    );

    var code = `switch.press(switch.${dropdown_pin}, ${functionName})\n`;
    return code;
};

Blockly.Python.forBlock['switch_on_release'] = function(block) {
    Blockly.Python.definitions_['import_switch'] = 'import switch';

    var dropdown_pin = block.getFieldValue('pin');
    var functionName = switchBuildCallbackFunction(
        block,
        dropdown_pin + 'OnReleaseCB'
    );

    var code = `switch.release(switch.${dropdown_pin}, ${functionName})\n`;
    return code;
};

Blockly.Python.forBlock['switch_on_pressed'] = function(block) {
    Blockly.Python.definitions_['import_switch'] = 'import switch';

    var dropdown_pin = block.getFieldValue('pin');
    var functionName = switchBuildCallbackFunction(
        block,
        dropdown_pin + 'OnPressedCB'
    );

    var code = `switch.pressed(switch.${dropdown_pin}, ${functionName})\n`;
    return code;
};
