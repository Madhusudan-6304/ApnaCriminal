# utils.py
from PIL import Image
import numpy as np
import cv2

def cv2_to_pil(frame_bgr):
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)

def pil_to_cv2(pil):
    arr = np.array(pil)
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    return bgr
