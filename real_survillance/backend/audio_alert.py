import threading
import os
import platform
import time

def _beep():
    """Cross-platform alert beep."""
    try:
        if platform.system() == "Windows":
            import winsound
            winsound.Beep(1000, 700)  # freq, duration
        else:
            # For Linux/Mac, use system bell
            print("\a")
    except Exception:
        print("[!] Alert sound failed")

def play_alert(nonblocking=True):
    """Play an alert sound."""
    if nonblocking:
        threading.Thread(target=_beep, daemon=True).start()
    else:
        _beep()
