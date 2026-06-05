# Dev by Krittamet Issaranarongphan
# Modified for Pico-X RP2350 / microBlock IDE
#
# Important design:
# - import switch must be safe.
# - No _thread.
# - No infinite loop at import time.
# - No IRQ at import time.
# - IRQ is enabled only when press(), release(), or pressed() is used.

from machine import Pin
import micropython
import utime

SW1 = Pin(8, Pin.IN, Pin.PULL_UP)
SW2 = Pin(9, Pin.IN, Pin.PULL_UP)
SW12 = 99

__sw1_press = None
__sw1_release = None
__sw2_press = None
__sw2_release = None

__sw1_pressed = None
__sw2_pressed = None
__sw12_pressed = None

__sw1_down_time = None
__sw2_down_time = None
__sw1_short_press = False
__sw2_short_press = False

__sw1_last_irq = 0
__sw2_last_irq = 0

__irq_enabled = False

_DEBOUNCE_MS = 40
_SHORT_PRESS_MAX_MS = 1000


def __is_sw1(pin):
    return pin is SW1 or pin == SW1


def __is_sw2(pin):
    return pin is SW2 or pin == SW2


def __safe_callback_runner(callback):
    try:
        callback()
    except Exception as e:
        print("switch callback error:", e)


def __schedule_callback(callback):
    if callback is None:
        return

    try:
        micropython.schedule(__safe_callback_runner, callback)
    except RuntimeError:
        # Scheduler queue is full. Ignore this edge to keep IRQ safe.
        pass


def value(pin):
    # Active-low switch:
    # pressed  = 1
    # released = 0
    if pin == SW12:
        return 1 if SW1.value() == 0 and SW2.value() == 0 else 0

    return 0 if pin.value() else 1


def is_press(pin):
    return value(pin) == 1


def is_release(pin):
    return value(pin) == 0


def init():
    global __irq_enabled

    if __irq_enabled:
        return

    SW1.irq(handler=__onSwitchChangesValue, trigger=Pin.IRQ_FALLING | Pin.IRQ_RISING)
    SW2.irq(handler=__onSwitchChangesValue, trigger=Pin.IRQ_FALLING | Pin.IRQ_RISING)

    __irq_enabled = True


def deinit():
    global __irq_enabled

    SW1.irq(handler=None)
    SW2.irq(handler=None)

    __irq_enabled = False


def press(pin, callback):
    global __sw1_press, __sw2_press

    if __is_sw1(pin):
        __sw1_press = callback
        init()
    elif __is_sw2(pin):
        __sw2_press = callback
        init()


def release(pin, callback):
    global __sw1_release, __sw2_release

    if __is_sw1(pin):
        __sw1_release = callback
        init()
    elif __is_sw2(pin):
        __sw2_release = callback
        init()


def pressed(pin, callback):
    global __sw1_pressed, __sw2_pressed, __sw12_pressed

    if pin == SW12:
        __sw12_pressed = callback
        init()
    elif __is_sw1(pin):
        __sw1_pressed = callback
        init()
    elif __is_sw2(pin):
        __sw2_pressed = callback
        init()


def __dispatch_short_press():
    global __sw1_short_press, __sw2_short_press

    # Dispatch only after both switches are released.
    if SW1.value() != 1 or SW2.value() != 1:
        return

    if __sw1_short_press and __sw2_short_press:
        __schedule_callback(__sw12_pressed)
        __sw1_short_press = False
        __sw2_short_press = False
    elif __sw1_short_press:
        __schedule_callback(__sw1_pressed)
        __sw1_short_press = False
    elif __sw2_short_press:
        __schedule_callback(__sw2_pressed)
        __sw2_short_press = False


def __onSwitchChangesValue(pin):
    global __sw1_down_time, __sw2_down_time
    global __sw1_short_press, __sw2_short_press
    global __sw1_last_irq, __sw2_last_irq

    now = utime.ticks_ms()

    if __is_sw1(pin):
        if utime.ticks_diff(now, __sw1_last_irq) < _DEBOUNCE_MS:
            return

        __sw1_last_irq = now

        if SW1.value():
            __schedule_callback(__sw1_release)

            if __sw1_down_time is not None:
                diff = utime.ticks_diff(now, __sw1_down_time)
                __sw1_short_press = diff >= _DEBOUNCE_MS and diff < _SHORT_PRESS_MAX_MS
                __sw1_down_time = None
                __dispatch_short_press()
        else:
            __sw1_down_time = now
            __schedule_callback(__sw1_press)

    elif __is_sw2(pin):
        if utime.ticks_diff(now, __sw2_last_irq) < _DEBOUNCE_MS:
            return

        __sw2_last_irq = now

        if SW2.value():
            __schedule_callback(__sw2_release)

            if __sw2_down_time is not None:
                diff = utime.ticks_diff(now, __sw2_down_time)
                __sw2_short_press = diff >= _DEBOUNCE_MS and diff < _SHORT_PRESS_MAX_MS
                __sw2_down_time = None
                __dispatch_short_press()
        else:
            __sw2_down_time = now
            __schedule_callback(__sw2_press)
