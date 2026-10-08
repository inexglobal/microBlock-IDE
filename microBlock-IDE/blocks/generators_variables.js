// Infer declaration types for each generation without changing workspace connections.
const microBlockVariableInit = Blockly.JavaScript.init;
Blockly.JavaScript.init = function (workspace) {
    microBlockVariableInit.call(this, workspace);
    this.dbNameType_ = Object.create(null);
    for (const block of workspace.getBlocksByType('variables_set', false)) {
        const type = microBlockCppValueType(block.getInputTargetBlock('VALUE'), this);
        if (type) {
            const name = this.nameDB_.getName(block.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE);
            this.dbNameType_[name] = type;
        }
    }
};

Blockly.JavaScript.forBlock["variables_set"] = function (block) {
    const argument0 = Blockly.JavaScript.valueToCode(block, "VALUE", Blockly.JavaScript.ORDER_ASSIGNMENT) || "0";
    const varName = Blockly.JavaScript.nameDB_.getName(block.getFieldValue("VAR"), Blockly.Names.NameType.VARIABLE);
    return varName + " = " + argument0 + ";\n";
};


Blockly.JavaScript.forBlock["math_change"] = function (block) {
    // Add to a variable in place.
    const argument0 = Blockly.JavaScript.valueToCode(block, 'DELTA', Blockly.JavaScript.ORDER_ADDITION) || '0';
    const varName = Blockly.JavaScript.nameDB_.getName(block.getFieldValue("VAR"), Blockly.Names.NameType.VARIABLE);
    return `${varName} += ${argument0};\n`;
  }
