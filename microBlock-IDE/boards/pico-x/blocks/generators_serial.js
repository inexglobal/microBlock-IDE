// generators/serial_mpy_generator.js
// Fixed UART0: id=0, TX=GPIO0, RX=GPIO1

const UART0_CFG = { ID: 0, BAUDRATE: 115200, TX: 0, RX: 1 };

function ensureUART0(baud) {
  Blockly.Python.definitions_["import_machine"] = "import machine";

  const br = (baud && String(baud).length) ? baud : UART0_CFG.BAUDRATE;

  // define once
  if (!Blockly.Python.definitions_["serial_singleton"]) {
    Blockly.Python.definitions_["serial_singleton"] =
      `# UART0 (fixed pins)\n` +
      `# TX=GPIO${UART0_CFG.TX}, RX=GPIO${UART0_CFG.RX}\n` +
      `uart0 = machine.UART(${UART0_CFG.ID}, baudrate=${br}, tx=machine.Pin(${UART0_CFG.TX}), rx=machine.Pin(${UART0_CFG.RX}))`;
  }
}

Blockly.Python.forBlock["serial_begin"] = function (block) {
  const baud = block.getFieldValue("BAUD");
  ensureUART0(baud);
  return "";
};

Blockly.Python.forBlock["serial_init"] = function (block) {
  ensureUART0(); // make sure uart0 exists
  const baud = block.getFieldValue("BAUD");
  const bits = block.getFieldValue("BITS");
  const parityRaw = block.getFieldValue("PARITY");
  const parity = (parityRaw === "None") ? "None" : parityRaw;
  const stop = block.getFieldValue("STOP");
  const timeout = block.getFieldValue("TIMEOUT");
  const timeoutChar = block.getFieldValue("TIMEOUT_CHAR");

  // pins stay fixed; we only reconfigure timings/format
  const code =
    `uart0.init(${baud}, bits=${bits}, parity=${parity}, stop=${stop}` +
    `, tx=machine.Pin(${UART0_CFG.TX}), rx=machine.Pin(${UART0_CFG.RX})` +
    `, timeout=${timeout}, timeout_char=${timeoutChar})\n`;
  return code;
};

Blockly.Python.forBlock["serial_write_text"] = function (block) {
  ensureUART0();
  const text = Blockly.Python.valueToCode(block, "TEXT", Blockly.Python.ORDER_NONE) || "''";
  return `uart0.write(str(${text}).encode('utf-8'))\n`;
};

Blockly.Python.forBlock["serial_write_bytes"] = function (block) {
  ensureUART0();
  const b = Blockly.Python.valueToCode(block, "BYTES", Blockly.Python.ORDER_NONE) || "b''";
  return `uart0.write(${b})\n`;
};

Blockly.Python.forBlock["serial_any"] = function () {
  ensureUART0();
  return ["uart0.any()", Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python.forBlock["serial_read_n"] = function (block) {
  ensureUART0();
  const n = block.getFieldValue("N");
  return [`uart0.read(${n})`, Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python.forBlock["serial_read_all"] = function () {
  ensureUART0();
  return ["uart0.read()", Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python.forBlock["serial_readline"] = function () {
  ensureUART0();
  return ["uart0.readline()", Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python.forBlock["serial_readline_text"] = function () {
  ensureUART0();
  const code =
    `(lambda _b: '' if _b is None else _b.decode('utf-8','ignore').strip())(uart0.readline())`;
  return [code, Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python.forBlock["serial_readinto"] = function (block) {
  ensureUART0();
  const buf = Blockly.Python.valueToCode(block, "BUF", Blockly.Python.ORDER_NONE) || "bytearray(0)";
  return [`uart0.readinto(${buf})`, Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python.forBlock["serial_flush"] = function () {
  ensureUART0();
  return "uart0.flush()\n";
};

Blockly.Python.forBlock["serial_txdone"] = function () {
  ensureUART0();
  return ["uart0.txdone()", Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python.forBlock["serial_sendbreak"] = function () {
  ensureUART0();
  return "uart0.sendbreak()\n";
};

Blockly.Python.forBlock["serial_end"] = function () {
  ensureUART0();
  return "uart0.deinit()\n";
};
