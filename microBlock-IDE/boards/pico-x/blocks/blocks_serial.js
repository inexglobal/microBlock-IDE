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
      { "type": "field_dropdown", "name": "BITS", "options": [["7", "7"], ["8", "8"], ["9", "9"]] },
      { "type": "field_dropdown", "name": "PARITY", "options": [["None", "None"], ["even(0)", "0"], ["odd(1)", "1"]] },
      { "type": "field_dropdown", "name": "STOP", "options": [["1", "1"], ["2", "2"]] },
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
    "type": "serial_write_text_newline",
    "message0": "Serial write text %1 with newline",
    "args0": [{ "type": "input_value", "name": "TEXT" }],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#2b2b2b",
    "tooltip": "Write text (utf-8) and append newline.",
    "helpUrl": ""
  },

  // {
  //   "type": "serial_write_bytes",
  //   "message0": "Serial write bytes %1",
  //   "args0": [{ "type": "input_value", "name": "BYTES" }],
  //   "previousStatement": null,
  //   "nextStatement": null,
  //   "colour": "#2b2b2b",
  //   "tooltip": "Write bytes/bytearray.",
  //   "helpUrl": ""
  // },

  {
    "type": "serial_write_byte",
    "message0": "Serial write byte %1",
    "args0": [{ "type": "input_value", "name": "BYTE" }],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#2b2b2b",
    "tooltip": "Write one byte (0-255).",
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
    "type": "serial_read_byte",
    "message0": "Serial read byte",
    "args0": [],
    "output": "Number",
    "colour": "#2b2b2b",
    "tooltip": "Read one byte. Returns -1 if no data.",
    "helpUrl": ""
  },
  {
    "type": "serial_read_text",
    "message0": "Serial read as text",
    "args0": [],
    "output": null,
    "colour": "#2b2b2b",
    "tooltip": "Read all available data and decode utf-8. Returns '' if None.",
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
    "type": "serial_byte_to_ascii_string",
    "message0": "byte %1 to ascii string",
    "args0": [
      { "type": "input_value", "name": "BYTE" }
    ],
    "output": null,
    "colour": "#2b2b2b",
    "tooltip": "Convert byte value (0-255) to a single character string.",
    "helpUrl": ""
  },

  {
    "type": "serial_ascii_to_byte_string",
    "message0": "ascii string %1 to byte",
    "args0": [
      { "type": "input_value", "name": "TEXT" }
    ],
    "output": "Number",
    "colour": "#2b2b2b",
    "tooltip": "Convert first character of text to byte value (0-255). Empty string returns 0.",
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

// ---- Dynamic inline serial writer (no Blockly.Mutator required) ----
const SERIAL_DYNAMIC_MAX_ITEMS = 8;
const SERIAL_DYNAMIC_TYPE_OPTIONS = [
  ["String", "STRING"],
  ["Dec", "DEC"],
  ["Hex", "HEX"],
  ["Oct", "OCT"],
  ["Bin", "BIN"]
];

function serialMakeButtonSvg(label, bg) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">` +
    `<rect x="1" y="1" width="22" height="22" rx="6" ry="6" fill="${bg}" stroke="#cfd8dc" stroke-width="1.2"/>` +
    `<text x="12" y="16" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#ffffff">${label}</text>` +
    `</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

class SerialActionButton extends Blockly.FieldLabelSerializable {
  constructor(kind) {
    super(kind === "PLUS" ? "+" : "−");
    this.kind_ = kind;
    this.CURSOR = "pointer";
  }

  initView() {
    if (super.initView) super.initView();
    this.applyStyle_();
  }

  render_() {
    if (super.render_) super.render_();
    this.applyStyle_();
  }

  applyStyle_() {
    setTimeout(() => {
      try {
        if (this.fieldGroup_) {
          this.fieldGroup_.style.cursor = "pointer";
        }
        if (this.textElement_) {
          this.textElement_.style.cursor = "pointer";
          this.textElement_.style.userSelect = "none";
          this.textElement_.style.fontWeight = "bold";
          this.textElement_.style.fontSize = "18px";   // เพิ่มขนาดปุ่ม
          this.textElement_.style.fill = "#ffffff";
        }
        if (this.borderRect_) {
          this.borderRect_.style.cursor = "pointer";
        }
      } catch (e) {}
    }, 0);
  }

  showEditor_() {
    const block = this.getSourceBlock();
    if (!block) return;

    setTimeout(() => {
      if (this.kind_ === "PLUS") {
        block.addItem_();
      } else {
        block.removeItem_();
      }
    }, 0);
  }
}
function serialSafeTypeValue(typeValue) {
  const allowed = ["STRING", "DEC", "HEX", "OCT", "BIN"];
  return allowed.indexOf(typeValue) >= 0 ? typeValue : "STRING";
}
function serialCreateDefaultShadow(workspace, typeValue) {
  let shadow = null;

  if (typeValue === "DEC") {
    shadow = workspace.newBlock("math_number");
    shadow.setFieldValue("65", "NUM");
  } else if (typeValue === "HEX") {
    shadow = workspace.newBlock("text");
    shadow.setFieldValue("41", "TEXT");
  } else if (typeValue === "OCT") {
    shadow = workspace.newBlock("text");
    shadow.setFieldValue("101", "TEXT");
  } else if (typeValue === "BIN") {
    shadow = workspace.newBlock("text");
    shadow.setFieldValue("01000001", "TEXT");
  } else {
    shadow = workspace.newBlock("text");
    shadow.setFieldValue("Hello!", "TEXT");
  }

  if (shadow) {
    if (typeof shadow.setShadow === "function") {
      shadow.setShadow(true);
    }
    if (typeof shadow.initSvg === "function") {
      shadow.initSvg();
    }
  }
  return shadow;
}

Blockly.Blocks["serial_write_data_dynamic"] = {
  init: function() {
    this.itemCount_ = 1;
    this.types_ = ["STRING"];
    this.values_ = ["Hello!"];
    this.lastTypeSnapshot_ = ["STRING"];

    this.appendDummyInput("HEADER")
      .appendField(new SerialActionButton("PLUS"), "ADD_BTN")
      .appendField(new SerialActionButton("MINUS"), "DEL_BTN")
      .appendField("Serial write data");

    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour("#2b2b2b");
    this.setTooltip("Write mixed serial data.");
    this.setHelpUrl("");

    this.updateShape_();
  },

  mutationToDom: function() {
    const container = Blockly.utils.xml.createElement("mutation");
    container.setAttribute("items", String(this.itemCount_));
    container.setAttribute("types", JSON.stringify(this.types_ || []));
    container.setAttribute("values", JSON.stringify(this.values_ || []));
    return container;
  },

  domToMutation: function(xmlElement) {
    const itemCount = parseInt(xmlElement.getAttribute("items"), 10);
    this.itemCount_ = isNaN(itemCount) ? 1 : Math.max(1, Math.min(SERIAL_DYNAMIC_MAX_ITEMS, itemCount));

    try {
      this.types_ = JSON.parse(xmlElement.getAttribute("types") || "[]");
    } catch (e) {
      this.types_ = [];
    }

    try {
      this.values_ = JSON.parse(xmlElement.getAttribute("values") || "[]");
    } catch (e) {
      this.values_ = [];
    }

    for (let i = 0; i < this.itemCount_; i++) {
      if (!this.types_[i]) this.types_[i] = "STRING";
      if (typeof this.values_[i] === "undefined") {
        this.values_[i] = this.getDefaultValueByType_(this.types_[i]);
      }
    }

    this.lastTypeSnapshot_ = this.types_.slice();
    this.updateShape_();
  },

  getDefaultValueByType_: function(typeValue) {
    switch (typeValue) {
      case "DEC": return "65";
      case "HEX": return "41";
      case "OCT": return "101";
      case "BIN": return "01000001";
      case "STRING":
      default: return "Hello!";
    }
  },

  storeCurrentFields_: function() {
    for (let i = 0; i < this.itemCount_; i++) {
      const t = this.getFieldValue("TYPE" + i);
      const v = this.getFieldValue("VALUE" + i);
      if (t != null) this.types_[i] = t;
      if (v != null) this.values_[i] = v;
    }
  },

  addItem_: function() {
    if (this.itemCount_ >= SERIAL_DYNAMIC_MAX_ITEMS) return;
    this.storeCurrentFields_();
    this.itemCount_ += 1;
    this.types_.push("STRING");
    this.values_.push("Hello!");
    this.lastTypeSnapshot_ = this.types_.slice();
    this.updateShape_();
    if (this.render) this.render();
  },

  removeItem_: function() {
    if (this.itemCount_ <= 1) return;
    this.storeCurrentFields_();
    this.itemCount_ -= 1;
    this.types_.pop();
    this.values_.pop();
    this.lastTypeSnapshot_ = this.types_.slice();
    this.updateShape_();
    if (this.render) this.render();
  },

  updateShape_: function() {
    let i = 0;
    while (this.getInput("ROW" + i)) {
      this.removeInput("ROW" + i);
      i++;
    }

    for (let idx = 0; idx < this.itemCount_; idx++) {
      const typeValue = this.types_[idx] || "STRING";
      const valueText = (typeof this.values_[idx] !== "undefined")
        ? this.values_[idx]
        : this.getDefaultValueByType_(typeValue);

      const dropdown = new Blockly.FieldDropdown([
        ["String", "STRING"],
        ["Dec", "DEC"],
        ["Hex", "HEX"],
        ["Oct", "OCT"],
        ["Bin", "BIN"]
      ]);

      dropdown.setValue(typeValue);

      const textField = new Blockly.FieldTextInput(String(valueText));

      this.appendDummyInput("ROW" + idx)
        .setAlign(Blockly.ALIGN_LEFT)
        .appendField(dropdown, "TYPE" + idx)
        .appendField(textField, "VALUE" + idx);
    }
  },

  onchange: function(event) {
    if (!event) return;
    if (!this.workspace || this.isInFlyout) return;

    if (event.type !== Blockly.Events.BLOCK_CHANGE) return;
    if (event.blockId !== this.id) return;
    if (!event.name || event.name.indexOf("TYPE") !== 0) return;

    const idx = parseInt(event.name.replace("TYPE", ""), 10);
    if (isNaN(idx)) return;

    const newType = this.getFieldValue("TYPE" + idx) || "STRING";
    const oldType = this.lastTypeSnapshot_[idx] || "STRING";
    if (newType === oldType) return;

    this.storeCurrentFields_();
    this.types_[idx] = newType;
    this.values_[idx] = this.getDefaultValueByType_(newType);
    this.lastTypeSnapshot_ = this.types_.slice();

    setTimeout(() => {
      try {
        this.updateShape_();
        if (this.render) this.render();
      } catch (e) {
        console.error("serial_write_data_dynamic onchange:", e);
      }
    }, 0);
  }
};

function serialSetPointerCursor(field) {
  setTimeout(() => {
    try {
      if (!field) return;

      if (field.fieldGroup_) {
        field.fieldGroup_.style.cursor = "pointer";
      }
      if (field.textElement_) {
        field.textElement_.style.cursor = "pointer";
      }
      if (field.borderRect_) {
        field.borderRect_.style.cursor = "pointer";
      }
      if (field.imageElement_) {
        field.imageElement_.style.cursor = "pointer";
      }

      const clickTarget = field.getClickTarget_ ? field.getClickTarget_() : null;
      if (clickTarget && clickTarget.style) {
        clickTarget.style.cursor = "pointer";
      }
    } catch (e) {
      // ignore
    }
  }, 0);
}
