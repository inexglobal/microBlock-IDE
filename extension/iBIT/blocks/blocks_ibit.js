if (typeof document !== "undefined" && !document.getElementById("ibit-toolbox-styles")) {
    var ibitToolboxStyles = document.createElement("style");
    ibitToolboxStyles.id = "ibit-toolbox-styles";
    ibitToolboxStyles.textContent = `
        .ibit-group-label .blocklyFlyoutLabelText {
            fill: #1C2833 !important;
            font-size: 22px !important;
            font-weight: 700 !important;
        }

        .ibit-subgroup-label .blocklyFlyoutLabelText {
            fill: #566573 !important;
            font-size: 16px !important;
            font-weight: 600 !important;
        }
    `;
    document.head.appendChild(ibitToolboxStyles);
}

Blockly.defineBlocksWithJsonArray([
    {
        "type": "ibit_move",
        "message0": "Move %1 Speed %2",
        "args0": [
            {
                "type": "field_dropdown",
                "name": "direction",
                "options": [
                    ["Forward", "FORWARD"],
                    ["Backward", "BACKWARD"],
                    ["Turn Left", "TURN_LEFT"],
                    ["Turn Right", "TURN_RIGHT"],
                    ["Spin Left", "SPIN_LEFT"],
                    ["Spin Right", "SPIN_RIGHT"]
                ]
            },
            {
                "type": "input_value",
                "name": "speed",
                "check": "Number"
            }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "Move the robot in the selected direction at a speed from 0 to 100.",
        "helpUrl": ""
    },
    {
        "type": "ibit_uturn",
        "message0": "U-Turn (Line Sensor) %1 Speed %2",
        "args0": [
            {
                "type": "field_dropdown",
                "name": "direction",
                "options": [
                    ["Left", "LEFT"],
                    ["Right", "RIGHT"]
                ]
            },
            {
                "type": "input_value",
                "name": "speed",
                "check": "Number"
            }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "Turn around left or right until the matching ZX-03 leaves the current line and detects it again, then stop.",
        "helpUrl": ""
    },
    {
        "type": "ibit_set_line_sensor_ports",
        "message0": "Set Line Sensor Ports Left %1 Right %2",
        "args0": [
            {
                "type": "field_dropdown",
                "name": "left_port",
                "options": [
                    ["ADC0", "0"],
                    ["ADC1", "1"],
                    ["ADC2", "2"],
                    ["ADC3", "3"],
                    ["ADC4", "4"],
                    ["ADC5", "5"],
                    ["ADC6", "6"],
                    ["ADC7", "7"]
                ]
            },
            {
                "type": "field_dropdown",
                "name": "right_port",
                "options": [
                    ["ADC0", "0"],
                    ["ADC1", "1"],
                    ["ADC2", "2"],
                    ["ADC3", "3"],
                    ["ADC4", "4"],
                    ["ADC5", "5"],
                    ["ADC6", "6"],
                    ["ADC7", "7"]
                ]
            }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "Set the ADC ports used by every line-sensor command. The defaults are ADC1 for Left and ADC2 for Right.",
        "helpUrl": ""
    },
    {
        "type": "ibit_set_ref_l",
        "message0": "Set Threshold Left to %1",
        "args0": [
            {
                "type": "input_value",
                "name": "value",
                "check": "Number"
            }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "Set the black-line threshold for the left ZX-03 sensor.",
        "helpUrl": ""
    },
    {
        "type": "ibit_set_ref_r",
        "message0": "Set Threshold Right to %1",
        "args0": [
            {
                "type": "input_value",
                "name": "value",
                "check": "Number"
            }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "Set the black-line threshold for the right ZX-03 sensor.",
        "helpUrl": ""
    },
    {
        "type": "ibit_gripper_enable",
        "message0": "Enable Gripper-X %1",
        "args0": [
            {
                "type": "field_dropdown",
                "name": "enabled",
                "options": [
                    ["True", "TRUE"],
                    ["False", "FALSE"]
                ]
            }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "Enable or disable Gripper-X automatic control.",
        "helpUrl": ""
    },
    {
        "type": "ibit_gripper_set_ports",
        "message0": "Set Gripper-X Ports %1",
        "args0": [
            {
                "type": "field_dropdown",
                "name": "layout",
                "options": [
                    ["SV1 Grab/Release, SV2 Up/Down", "NORMAL"],
                    ["SV1 Up/Down, SV2 Grab/Release", "SWAPPED"]
                ]
            }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "Choose which servo port controls grab/release and which controls up/down.",
        "helpUrl": ""
    },
    {
        "type": "ibit_gripper_set_degree",
        "message0": "Set Gripper-X %1 Degree %2",
        "args0": [
            {
                "type": "field_dropdown",
                "name": "position",
                "options": [
                    ["Grab", "GRAB"],
                    ["Release", "RELEASE"],
                    ["Up", "UP"],
                    ["Down", "DOWN"]
                ]
            },
            {
                "type": "input_value",
                "name": "degree",
                "check": "Number"
            }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "Store the servo angle for a Gripper-X position.",
        "helpUrl": ""
    },
    {
        "type": "ibit_gripper_control",
        "message0": "Gripper-X %1",
        "args0": [
            {
                "type": "field_dropdown",
                "name": "action",
                "options": [
                    ["Pick Up", "PICK_UP"],
                    ["Place Down", "PLACE_DOWN"],
                    ["Grab", "GRAB"],
                    ["Release", "RELEASE"],
                    ["Up", "UP"],
                    ["Down", "DOWN"]
                ]
            }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "Run a Gripper-X action. Pick up is Grab then Up; place down is Down then Release.",
        "helpUrl": ""
    },
    {
        "type": "ibit_gripper_home",
        "message0": "Gripper-X Home",
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "Move Gripper-X to its home position: Release then Up.",
        "helpUrl": ""
    },
    {
        "type": "ibit_gripper_stop",
        "message0": "Gripper-X Stop",
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "Stop the PWM pulses on both Gripper-X servo ports.",
        "helpUrl": ""
    },
    {
        "type": "ibit_intersection",
        "message0": "Intersection %1 Forward %2 Seconds Speed L %3 Speed R %4",
        "args0": [
            {
                "type": "field_dropdown",
                "name": "action",
                "options": [
                    ["Cross", "CROSS"],
                    ["Turn Left", "TURN_LEFT"],
                    ["Turn Right", "TURN_RIGHT"]
                ]
            },
            {
                "type": "input_value",
                "name": "seconds",
                "check": "Number"
            },
            {
                "type": "input_value",
                "name": "speed",
                "check": "Number"
            },
            {
                "type": "input_value",
                "name": "speed_right",
                "check": "Number"
            }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "Follow the line with separate left and right speeds, then move forward for the selected time and cross or turn.",
        "helpUrl": ""
    },
    {
        "type": "ibit_intersection_stop",
        "message0": "Intersection Stop Speed L %1 Speed R %2",
        "args0": [
            {
                "type": "input_value",
                "name": "speed",
                "check": "Number"
            },
            {
                "type": "input_value",
                "name": "speed_right",
                "check": "Number"
            }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "Follow the line with separate left and right speeds until both ZX-03 sensors find an intersection, then stop immediately.",
        "helpUrl": ""
    },
    {
        "type": "ibit_set_intersection_forward_time",
        "message0": "Set Intersection Forward Time %1 Seconds",
        "args0": [
            {
                "type": "input_value",
                "name": "seconds",
                "check": "Number"
            }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "Set how long the robot moves into an intersection before it crosses, stops, or turns.",
        "helpUrl": ""
    },
    {
        "type": "ibit_motor1",
        "message0": "Set Motor %1 Direction %2 Speed %3",
        "args0": [
            {
                "type": "field_dropdown",
                "name": "n",
                "options": [
                    ["1", "M1"],
                    ["2", "M2"]
                ]
            },
            {
                "type": "field_dropdown",
                "name": "dir",
                "options": [
                    ["Forward", "FORWARD"],
                    ["Backward", "BACKWARD"]
                ]
            },
            {
                "type": "input_value",
                "name": "speed",
                "check": "Number"
            }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "",
        "helpUrl": ""
    },
    {
        "type": "ibit_motor2",
        "message0": "Motor 2 %1 Speed L %2 Speed R %3",
        "args0": [
            {
                "type": "field_dropdown",
                "name": "dir",
                "options": [
                    ["Forward", "FORWARD"],
                    ["Backward", "BACKWARD"]
                ]
            },
            {
                "type": "input_value",
                "name": "speed1",
                "check": "Number"
            },
            {
                "type": "input_value",
                "name": "speed2",
                "check": "Number"
            }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "",
        "helpUrl": ""
    },
    {
        "type": "ibit_turn",
        "message0": "Turn %1 Speed %2",
        "args0": [
            {
                "type": "field_dropdown",
                "name": "dir",
                "options": [
                    ["Left", "LEFT"],
                    ["Right", "RIGHT"]
                ]
            },
            {
                "type": "input_value",
                "name": "speed",
                "check": "Number"
            }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "",
        "helpUrl": ""
    },
    {
        "type": "ibit_spin",
        "message0": "Spin %1 Speed %2",
        "args0": [
            {
                "type": "field_dropdown",
                "name": "dir",
                "options": [
                    ["Left", "LEFT"],
                    ["Right", "RIGHT"]
                ]
            },
            {
                "type": "input_value",
                "name": "speed",
                "check": "Number"
            }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "",
        "helpUrl": ""
    },
    {
        "type": "ibit_motor_stop",
        "message0": "Motor Stop",
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "",
        "helpUrl": ""
    },
    {
        "type": "ibit_servo",
        "message0": "Servo %1 Degree %2",
        "args0": [
            {
                "type": "field_dropdown",
                "name": "ch",
                "options": [
                    ["1", "SV1"],
                    ["2", "SV2"]
                ]
            },
            {
                "type": "input_value",
                "name": "angle",
                "check": "Number"
            }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "",
        "helpUrl": ""
    },
    {
        "type": "ibit_servo_stop",
        "message0": "Servo Stop %1",
        "args0": [
            {
                "type": "field_dropdown",
                "name": "ch",
                "options": [
                    ["1", "SV1"],
                    ["2", "SV2"]
                ]
            }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": "#3498DB",
        "tooltip": "",
        "helpUrl": ""
    },
    {
        "type": "ibit_analog_read",
        "message0": "Analog Read Pin %1",
        "args0": [
            {
                "type": "field_dropdown",
                "name": "pin",
                "options": [
                    ["ADC0", "0"],
                    ["ADC1", "1"],
                    ["ADC2", "2"],
                    ["ADC3", "3"],
                    ["ADC4", "4"],
                    ["ADC5", "5"],
                    ["ADC6", "6"],
                    ["ADC7", "7"]
                ]
            }
        ],
        "inputsInline": true,
        "output": "Number",
        "colour": "#3498DB",
        "tooltip": "",
        "helpUrl": ""
    }
]);
