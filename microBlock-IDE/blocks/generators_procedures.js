// Follow untyped variable and procedure value blocks without changing their connections.
const microBlockCppValueType = (block, generator, visited = new Set()) => {
  if (!block || visited.has(block)) return null;
  visited.add(block);
  const declared = { Number: 'float', String: 'String', Boolean: 'bool' }[block.outputConnection?.getCheck()?.[0]];
  if (declared) return declared;
  if (block.type === 'variables_get') {
    const name = generator.nameDB_.getName(block.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE);
    if (generator.dbNameType_?.[name]) return generator.dbNameType_[name];
    for (const setter of block.workspace.getBlocksByType('variables_set', false)) {
      if (setter.getFieldValue('VAR') === block.getFieldValue('VAR')) {
        const type = microBlockCppValueType(setter.getInputTargetBlock('VALUE'), generator, visited);
        if (type) return type;
      }
    }
  } else if (block.type === 'procedures_callreturn') {
    const definition = block.workspace.getBlocksByType('procedures_defreturn', false)
      .find(candidate => candidate.getFieldValue('NAME') === block.getFieldValue('NAME'));
    return microBlockCppValueType(definition, generator, visited);
  } else if (block.type === 'procedures_defreturn') {
    const returned = microBlockCppValueType(block.getInputTargetBlock('RETURN'), generator, visited);
    if (returned) return returned;
    for (const candidate of block.getDescendants(false)) {
      if (candidate.type === 'procedures_ifreturn' && candidate.hasReturnValue_) {
        const type = microBlockCppValueType(candidate.getInputTargetBlock('VALUE'), generator, visited);
        if (type) return type;
      }
    }
  }
  return null;
};

Blockly.Python.forBlock['math_change'] = function (block) {
  // Add to a variable in place.
  var argument0 = Blockly.Python.valueToCode(block, 'DELTA',
    Blockly.Python.ORDER_ADDITIVE) || '0';
  var varName = Blockly.Python.nameDB_.getName(block.getFieldValue('VAR'),
    Blockly.VARIABLE_CATEGORY_NAME);
  return `${varName} = (${varName} if type(${varName}) in [ int, float ] else 0) + ${argument0}\n`;
};

Blockly.Python.forBlock['random_seed'] = function(block) {
  Blockly.Python.definitions_['import_random'] = 'import random';
  Blockly.Python.definitions_['from_time_import_ticks_us'] = 'from time import ticks_us';

  var code = 'random.seed(ticks_us())\n';
  return code;
};

Blockly.JavaScript.forBlock['random_seed'] = function(block) {
  var code = 'randomSeed(analogRead(A0));\n';
  return code;
};

Blockly.JavaScript.forBlock['math_random_int'] = function(block) {
  const argument0 = Blockly.JavaScript.valueToCode(block, 'FROM', Blockly.JavaScript.ORDER_NONE) || '0';
  const argument1 = Blockly.JavaScript.valueToCode(block, 'TO', Blockly.JavaScript.ORDER_NONE) || '0';
  
  const functionName = Blockly.JavaScript.provideFunction_('mathRandomInt', [
    'long ' + Blockly.JavaScript.FUNCTION_NAME_PLACEHOLDER_ + '(long first, long second) {',
    '  if (first > second) {',
    '    long temporary = first;',
    '    first = second;',
    '    second = temporary;',
    '  }',
    '  return random(first, second + 1);',
    '}'
  ]);
  const code = functionName + '(' + argument0 + ', ' + argument1 + ')';
  return [code, Blockly.JavaScript.ORDER_FUNCTION_CALL];
};

Blockly.JavaScript.forBlock['procedures_defreturn'] = function (block) {
  // Define a procedure with a return value.
  const funcName = Blockly.JavaScript.nameDB_.getName(block.getFieldValue('NAME'), Blockly.Names.NameType.PROCEDURE);
  var branch = block.getInput('STACK') ? Blockly.JavaScript.statementToCode(block, 'STACK') : '';
  if (Blockly.JavaScript.STATEMENT_PREFIX) {
    var id = block.id.replace(/\$/g, '$$$$');  // Issue 251.
    branch = Blockly.JavaScript.prefixLines(Blockly.JavaScript.STATEMENT_PREFIX.replace(/%1/g, '\'' + id + '\''), Blockly.JavaScript.INDENT) + branch;
  }
  if (Blockly.JavaScript.INFINITE_LOOP_TRAP) {
    branch = Blockly.JavaScript.INFINITE_LOOP_TRAP.replace(/%1/g, '\'' + block.id + '\'') + branch;
  }
  const returnType = block.getInput('RETURN') ? microBlockCppValueType(block, Blockly.JavaScript) || 'float' : 'void';
  const defaultReturn = returnType === 'String' ? 'String("")' : '0';
  var returnValue = block.getInput('RETURN') ? Blockly.JavaScript.valueToCode(block, 'RETURN', Blockly.JavaScript.ORDER_NONE) || defaultReturn : '';
  var args = [];
  var argsIncType = [];
  const variables = block.getVars();
  for (var i = 0; i < variables.length; i++) {
    args[i] = Blockly.JavaScript.nameDB_.getName(variables[i], Blockly.Names.NameType.VARIABLE);
    // let vType = (args[i] in Blockly.JavaScript.dbNameType_) ? Blockly.JavaScript.dbNameType_[args[i]].type : "int";
    let vType = "float";
    argsIncType[i] = vType + ' ' + args[i];
  }
  if (returnValue) {
    returnValue = Blockly.JavaScript.INDENT + 'return ' + returnValue + ';\n';
  } else {
    // returnValue = Blockly.JavaScript.INDENT + 'return;\n';
  }

  var code = `${returnType} ${funcName}(${argsIncType.join(', ')}) {\n${branch}${returnValue}}\n`;
  //var code = returnType + ' function ' + funcName + '(' + args.join(', ') + ') {\n' + branch + returnValue + '}';
  code = Blockly.JavaScript.scrub_(block, code);
  // Add % so as not to collide with helper functions in definitions list.
  if (!Blockly.JavaScript.definitions_) {
    Blockly.JavaScript.definitions_ = {};
  }
  Blockly.JavaScript.definitions_['%' + funcName] = code;
  return null;
};

// Defining a procedure without a return value uses the same generator as
// a procedure with a return value.
Blockly.JavaScript.forBlock['procedures_defnoreturn'] =
  Blockly.JavaScript.forBlock['procedures_defreturn'];

Blockly.JavaScript.forBlock['procedures_callreturn'] = function (block) {
  // Call a procedure with a return value.
  var funcName = Blockly.JavaScript.nameDB_.getName(
    block.getFieldValue('NAME'), Blockly.Names.NameType.PROCEDURE);
  var args = [];
  for (var i = 0; i < block.arguments_.length; i++) {
    args[i] = Blockly.JavaScript.valueToCode(block, 'ARG' + i,
      Blockly.JavaScript.ORDER_COMMA) || '0';
  }
  var code = funcName + '(' + args.join(', ') + ')';
  return [code, Blockly.JavaScript.ORDER_FUNCTION_CALL];
};

Blockly.JavaScript.forBlock['procedures_callnoreturn'] = function (block) {
  // console.log(block.getFieldValue('NAME'));
  // Call a procedure with no return value.
  var funcName = Blockly.JavaScript.nameDB_.getName(
    block.getFieldValue('NAME'), Blockly.Names.NameType.PROCEDURE);
  // var funcName = block.getFieldValue('NAME');
  var args = [];
  for (var i = 0; i < block.arguments_.length; i++) {
    args[i] = Blockly.JavaScript.valueToCode(block, 'ARG' + i,
      Blockly.JavaScript.ORDER_COMMA) || '0';
  }
  var code = funcName + '(' + args.join(', ') + ');\n';
  return code;
};

Blockly.JavaScript.forBlock['procedures_ifreturn'] = function (block) {
  // Conditionally return value from a procedure.
  var condition = Blockly.JavaScript.valueToCode(block, 'CONDITION',
    Blockly.JavaScript.ORDER_NONE) || 'false';
  var code = 'if (' + condition + ') {\n';
  if (block.hasReturnValue_) {
    var value = Blockly.JavaScript.valueToCode(block, 'VALUE',
      Blockly.JavaScript.ORDER_NONE) || '0';
    code += Blockly.JavaScript.INDENT + 'return ' + value + ';\n';
  } else {
    code += Blockly.JavaScript.INDENT + 'return;\n';
  }
  code += '}\n';
  return code;
};
