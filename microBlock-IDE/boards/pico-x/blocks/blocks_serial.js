Blockly.defineBlocksWithJsonArray([
  {
    "type": "serial_begin",
    "message0": "Serial begin baud %1",
    "args0": [
      { "type": "field_number", "name": "BAUD", "value": 115200, "min": 300, "max": 4000000, "precision": 1 }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#2b2b2b",
    "tooltip": "Init UART(0) on TX=GPIO0, RX=GPIO1 (fixed).",
    "helpUrl": ""
  },

  {
    "type": "serial_init",
    "message0": "Serial init baud %1 bits %2 parity %3 stop %4 timeout %5 timeout_char %6",
    "args0": [
      { "type": "field_number", "name": "BAUD", "value": 115200, "min": 300, "max": 4000000, "precision": 1 },
      { "type": "field_dropdown", "name": "BITS", "options": [["7","7"],["8","8"],["9","9"]] },
      { "type": "field_dropdown", "name": "PARITY", "options": [["None","None"],["even(0)","0"],["odd(1)","1"]] },
      { "type": "field_dropdown", "name": "STOP", "options": [["1","1"],["2","2"]] },
      { "type": "field_number", "name": "TIMEOUT", "value": 0, "min": 0, "max": 60000, "precision": 1 },
      { "type": "field_number", "name": "TIMEOUT_CHAR", "value": 0, "min": 0, "max": 60000, "precision": 1 }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#2b2b2b",
    "tooltip": "Reconfigure Serial using init(). Pins remain TX0/RX1.",
    "helpUrl": ""
  },

  {
    "type": "serial_write_text",
    "message0": "Serial write text %1",
    "args0": [{ "type": "input_value", "name": "TEXT" }],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#2b2b2b",
    "tooltip": "Write text (utf-8).",
    "helpUrl": ""
  },

  {
    "type": "serial_write_bytes",
    "message0": "Serial write bytes %1",
    "args0": [{ "type": "input_value", "name": "BYTES" }],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#2b2b2b",
    "tooltip": "Write bytes/bytearray.",
    "helpUrl": ""
  },

  {
    "type": "serial_any",
    "message0": "Serial any",
    "args0": [],
    "output": "Number",
    "colour": "#2b2b2b",
    "tooltip": "Bytes available (uart.any()).",
    "helpUrl": ""
  },

  {
    "type": "serial_read_n",
    "message0": "Serial read %1 bytes",
    "args0": [
      { "type": "field_number", "name": "N", "value": 1, "min": 1, "max": 4096, "precision": 1 }
    ],
    "output": null,
    "colour": "#2b2b2b",
    "tooltip": "Read n bytes -> bytes or None.",
    "helpUrl": ""
  },

  {
    "type": "serial_read_all",
    "message0": "Serial read all",
    "args0": [],
    "output": null,
    "colour": "#2b2b2b",
    "tooltip": "Read all available -> bytes or None.",
    "helpUrl": ""
  },

  {
    "type": "serial_readline",
    "message0": "Serial readLine",
    "args0": [],
    "output": null,
    "colour": "#2b2b2b",
    "tooltip": "Read a line -> bytes or None.",
    "helpUrl": ""
  },

  {
    "type": "serial_readline_text",
    "message0": "Serial readLine as text",
    "args0": [],
    "output": null,
    "colour": "#2b2b2b",
    "tooltip": "Read a line and decode utf-8. Returns '' if None.",
    "helpUrl": ""
  },

  {
    "type": "serial_readinto",
    "message0": "Serial readinto buf %1",
    "args0": [{ "type": "input_value", "name": "BUF" }],
    "output": "Number",
    "colour": "#2b2b2b",
    "tooltip": "Read into buffer -> int or None.",
    "helpUrl": ""
  },

  {
    "type": "serial_flush",
    "message0": "Serial flush",
    "args0": [],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#2b2b2b",
    "tooltip": "uart.flush()",
    "helpUrl": ""
  },

  {
    "type": "serial_txdone",
    "message0": "Serial txdone",
    "args0": [],
    "output": "Boolean",
    "colour": "#2b2b2b",
    "tooltip": "uart.txdone()",
    "helpUrl": ""
  },

  {
    "type": "serial_sendbreak",
    "message0": "Serial sendbreak",
    "args0": [],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#2b2b2b",
    "tooltip": "uart.sendbreak()",
    "helpUrl": ""
  },

  {
    "type": "serial_end",
    "message0": "Serial end",
    "args0": [],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#2b2b2b",
    "tooltip": "uart.deinit() (after deinit you need new instance).",
    "helpUrl": ""
  }
]);
