from signal import pause

from gpiozero import LED


if __name__ == "__main__":
    # BCM GPIO17 = 40 针排针的物理第 11 针。
    with LED(17) as led:
        led.blink(on_time=0.5, off_time=0.5)
        try:
            pause()
        except KeyboardInterrupt:
            pass
