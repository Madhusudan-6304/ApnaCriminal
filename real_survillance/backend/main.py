# main.py
import cv2
import os

# Dummy user database
USERS = {
    "admin": "admin123",
    "user": "password"
}

# ---- Authentication ----
def authenticate(username, password):
    return USERS.get(username) == password

# ---- Start camera feed ----
def start_camera():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        return "Error: Cannot access camera"

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        cv2.imshow("Camera Feed - Press 'q' to Quit", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    return "Camera Closed"

# ---- Dummy function for criminal detection ----
def detect_criminal(frame):
    # Add your detection logic here
    return False
