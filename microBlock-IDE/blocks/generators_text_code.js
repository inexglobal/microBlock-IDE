Blockly.Python.forBlock['text_code'] = function(block) {
  const code = block.getFieldValue('code');
  return code && !code.endsWith('\n') ? code + '\n' : code;
};

Blockly.JavaScript.forBlock['text_code'] = Blockly.Python.forBlock['text_code'];
