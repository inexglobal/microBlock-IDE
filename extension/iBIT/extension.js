({
    name: "iBIT V2A-X",
    description: "iBIT package for microBlock, Robot board control by Mbits, OpenBit",
    author: "INEX",
    category: "Device Control",
    version: "1.1.38",
    icon: "./static/icon.png",
    color: "#3498DB",
    blocks: [
        {
            xml: `
                <label text="Basic" web-class="ibit-group-label"></label>
                    <label text="Movement" web-class="ibit-subgroup-label"></label>
                    <block type="ibit_move">
                        <value name="speed">
                            <shadow type="math_number">
                                <field name="NUM">100</field>
                            </shadow>
                        </value>
                    </block>
                    <block type="ibit_uturn">
                        <value name="speed">
                            <shadow type="math_number">
                                <field name="NUM">100</field>
                            </shadow>
                        </value>
                    </block>

                    <block type="ibit_stop_moving"></block>

                    <label text="Line Sensor Reference" web-class="ibit-subgroup-label"></label>
                    <block type="ibit_set_line_sensor_ports">
                        <field name="left_port">1</field>
                        <field name="right_port">2</field>
                    </block>
                    <block type="ibit_set_ref_l">
                        <value name="value">
                            <shadow type="math_number">
                                <field name="NUM">0</field>
                            </shadow>
                        </value>
                    </block>
                    <block type="ibit_set_ref_r">
                        <value name="value">
                            <shadow type="math_number">
                                <field name="NUM">0</field>
                            </shadow>
                        </value>
                    </block>

                    <label text="Ultrasonic Sensor" web-class="ibit-subgroup-label"></label>
                    <block type="ibit_set_zx_sonar1m_adc">
                        <field name="channel">0</field>
                    </block>
                    <block type="ibit_zx_sonar1m_distance"></block>

                    <label text="Gripper-X Setup" web-class="ibit-subgroup-label"></label>
                    <block type="ibit_gripper_enable"></block>
                    <block type="ibit_gripper_set_ports"></block>
                    <block type="ibit_gripper_set_degree">
                        <value name="degree">
                            <shadow type="math_number">
                                <field name="NUM">90</field>
                            </shadow>
                        </value>
                    </block>

                    <label text="Gripper-X Control" web-class="ibit-subgroup-label"></label>
                    <block type="ibit_gripper_control"></block>
                    <block type="ibit_gripper_smooth">
                        <value name="speed">
                            <shadow type="math_number">
                                <field name="NUM">50</field>
                            </shadow>
                        </value>
                    </block>
                    <block type="ibit_gripper_home"></block>
                    <block type="ibit_gripper_stop"></block>

                    <label text="Intersection" web-class="ibit-subgroup-label"></label>
                    <block type="ibit_intersection">
                        <value name="seconds">
                            <shadow type="math_number">
                                <field name="NUM">0.5</field>
                            </shadow>
                        </value>
                        <value name="speed">
                            <shadow type="math_number">
                                <field name="NUM">100</field>
                            </shadow>
                        </value>
                        <value name="speed_right">
                            <shadow type="math_number">
                                <field name="NUM">100</field>
                            </shadow>
                        </value>
                    </block>
                    <block type="ibit_intersection_stop">
                        <value name="speed">
                            <shadow type="math_number">
                                <field name="NUM">100</field>
                            </shadow>
                        </value>
                        <value name="speed_right">
                            <shadow type="math_number">
                                <field name="NUM">100</field>
                            </shadow>
                        </value>
                    </block>
            `
        },
        {
            xml: `
                <label text="Advanced" web-class="ibit-group-label"></label>
                    <label text="Motor Control" web-class="ibit-subgroup-label"></label>
                    <block type="ibit_motor1">
                        <value name="speed">
                            <shadow type="math_number">
                                <field name="NUM">50</field>
                            </shadow>
                        </value>
                    </block>
                    <block type="ibit_motor2">
                        <value name="speed1">
                            <shadow type="math_number">
                                <field name="NUM">50</field>
                            </shadow>
                        </value>
                        <value name="speed2">
                            <shadow type="math_number">
                                <field name="NUM">50</field>
                            </shadow>
                        </value>
                    </block>
                    <block type="ibit_turn">
                        <value name="speed">
                            <shadow type="math_number">
                                <field name="NUM">50</field>
                            </shadow>
                        </value>
                    </block>
                    <block type="ibit_spin">
                        <value name="speed">
                            <shadow type="math_number">
                                <field name="NUM">50</field>
                            </shadow>
                        </value>
                    </block>
                    <block type="ibit_motor_stop">
                        <field name="motor">ALL</field>
                    </block>

                    <label text="Servo" web-class="ibit-subgroup-label"></label>
                    <block type="ibit_v2ar_servo">
                        <value name="angle">
                            <shadow type="math_number">
                                <field name="NUM">90</field>
                            </shadow>
                        </value>
                    </block>
                    <block type="ibit_servo_move">
                        <value name="angle">
                            <shadow type="math_number">
                                <field name="NUM">90</field>
                            </shadow>
                        </value>
                        <value name="speed">
                            <shadow type="math_number">
                                <field name="NUM">50</field>
                            </shadow>
                        </value>
                    </block>
                    <block type="ibit_servo_motor">
                        <value name="speed">
                            <shadow type="math_number">
                                <field name="NUM">100</field>
                            </shadow>
                        </value>
                    </block>
                    <block type="ibit_servo_stop"></block>

                    <label text="Analog Input" web-class="ibit-subgroup-label"></label>
                    <block type="ibit_analog_read"></block>
            `
        }
    ],
    chip: [
        "ESP32"
    ]
});
