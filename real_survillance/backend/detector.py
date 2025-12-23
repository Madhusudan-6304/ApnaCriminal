# detector.py
import os
import warnings
from typing import List, Sequence, Tuple

import cv2
import numpy as np
from PIL import Image

# Suppress TensorFlow warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'  # Suppress TensorFlow info, warnings, and errors
warnings.filterwarnings('ignore', category=UserWarning)
warnings.filterwarnings('ignore', category=FutureWarning)

try:
    import tensorflow as tf
    tf.get_logger().setLevel('ERROR')  # Suppress TensorFlow logging
    from tensorflow.keras.models import load_model
    from tensorflow.keras.preprocessing import image
except ImportError:  # pragma: no cover - optional dependency
    load_model = None  # type: ignore
    image = None  # type: ignore
except Exception as e:
    # Handle any TensorFlow initialization errors gracefully
    print(f"TensorFlow initialization warning: {e}")
    load_model = None
    image = None

# Lazy loading for models - only load when needed
MASK_MODEL_PATH = os.path.join(os.path.dirname(__file__), 'mask_detection_model.h5')
_mask_model = None
_mask_model_loaded = False

# FaceNet lazy loading
_facenet_available = None
_torch = None
_mtcnn = None
_resnet = None
_device = None
USE_FACENET = False

def _load_mask_model():
    """Lazy load mask detection model"""
    global _mask_model, _mask_model_loaded
    if _mask_model_loaded:
        return _mask_model
    
    if load_model is None or not os.path.exists(MASK_MODEL_PATH):
        _mask_model_loaded = True
        return None
    
    try:
        print("[detector] Loading mask detection model...")
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            _mask_model = load_model(MASK_MODEL_PATH)
        print("[detector] Mask detection model loaded successfully")
        _mask_model_loaded = True
        return _mask_model
    except Exception as e:
        print(f"[detector] Could not load mask detection model: {e}")
        _mask_model_loaded = True
        return None

def _load_facenet():
    """Lazy load FaceNet models"""
    global _facenet_available, _torch, _mtcnn, _resnet, _device, USE_FACENET
    
    if _facenet_available is not None:
        return USE_FACENET
    
    try:
        print("[detector] Loading FaceNet models (this may take a moment)...")
        from facenet_pytorch import MTCNN, InceptionResnetV1
        import torch
        _torch = torch
        _device = 'cuda' if torch.cuda.is_available() else 'cpu'
        print(f"[detector] Using device: {_device}")
        _mtcnn = MTCNN(keep_all=True, device=_device)
        print("[detector] MTCNN loaded")
        _resnet = InceptionResnetV1(pretrained='vggface2').eval().to(_device)
        print("[detector] InceptionResnetV1 loaded")
        USE_FACENET = True
        _facenet_available = True
        return True
    except Exception as e:
        print(f"[detector] FaceNet not available: {e}")
        _facenet_available = False
        USE_FACENET = False
        _mtcnn = None
        _resnet = None
        return False

# Haar cascade for face detection
face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

def detect_mask(face_img):
    """Detect if a face is wearing a mask"""
    mask_model = _load_mask_model()
    if mask_model is None or image is None or face_img is None:
        return False

    try:
        if isinstance(face_img, Image.Image):
            face_img = cv2.cvtColor(np.array(face_img), cv2.COLOR_RGB2BGR)
        face_img = cv2.resize(face_img, (150, 150))
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            face_arr = image.img_to_array(face_img)
            face_arr = np.expand_dims(face_arr, axis=0)
            face_arr = face_arr / 255.0
            prediction = mask_model.predict(face_arr, verbose=0)  # verbose=0 suppresses output
        return bool(prediction[0][0] > 0.5)
    except Exception as e:
        # Silently handle errors to avoid cluttering logs
        return False


def detect_faces_and_crops(
    pil_image: Image.Image,
) -> Tuple[List[Tuple[int, int, int, int]], List[Image.Image], List[bool]]:
    """
    Detect faces in an image and return (boxes, face_crops, has_mask flags).
    """
    if pil_image is None:
        return [], [], []

    rgb_array = np.array(pil_image)
    bgr_array = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)
    mask_flags: List[bool] = []

    # Lazy load FaceNet if available
    if _load_facenet() and _mtcnn is not None:
        boxes, _ = _mtcnn.detect(pil_image)
        if boxes is None:
            return [], [], []
        boxes_list, crops = [], []
        for box in boxes:
            x1, y1, x2, y2 = [int(max(0, round(coord))) for coord in box]
            if x2 <= x1 or y2 <= y1:
                continue
            boxes_list.append((x1, y1, x2, y2))
            crops.append(pil_image.crop((x1, y1, x2, y2)))
            if 0 <= y1 < y2 <= bgr_array.shape[0] and 0 <= x1 < x2 <= bgr_array.shape[1]:
                crop_bgr = bgr_array[y1:y2, x1:x2]
            else:
                crop_bgr = None
            mask_flags.append(detect_mask(crop_bgr))
        return boxes_list, crops, mask_flags

    gray = cv2.cvtColor(bgr_array, cv2.COLOR_BGR2GRAY)
    detections = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(30, 30)
    )

    boxes, crops = [], []
    for (x, y, w, h) in detections:
        x1, y1 = int(x), int(y)
        x2, y2 = int(x + w), int(y + h)
        boxes.append((x1, y1, x2, y2))
        crops.append(pil_image.crop((x1, y1, x2, y2)))
        crop_bgr = bgr_array[y1:y2, x1:x2]
        mask_flags.append(detect_mask(crop_bgr))
    return boxes, crops, mask_flags

def get_face_embedding(face_img):
    """Get face embedding using FaceNet or fallback method"""
    # Lazy load FaceNet if available
    if _load_facenet() and _resnet is not None and _torch is not None:
        try:
            # Preprocess image for FaceNet
            face_img = face_img.resize((160, 160))
            img_tensor = _torch.tensor(np.array(face_img)).permute(2, 0, 1).float()
            img_tensor = (img_tensor / 255.0 - 0.5) / 0.5
            img_tensor = img_tensor.unsqueeze(0).to(_device)
            
            # Get embedding
            with _torch.no_grad():
                embedding = _resnet(img_tensor).cpu().numpy()[0]
                return embedding / np.linalg.norm(embedding)  # Normalize
        except Exception as e:
            print(f"Error in FaceNet embedding: {e}")
    
    # Fallback to simpler method if FaceNet fails or not available
    face_img = face_img.resize((100, 100)).convert('L')  # Grayscale
    embedding = np.array(face_img).flatten().astype(np.float32)
    return embedding / (np.linalg.norm(embedding) + 1e-10)  # Normalize

def face_to_embedding(face_img: Image.Image) -> np.ndarray:
    """
    Public helper used throughout the app.
    """
    return get_face_embedding(face_img)

def match_embedding(embedding, known_embeddings: Sequence[np.ndarray], threshold=0.6):
    """
    Match a face embedding against known embeddings
    Returns: (match_index, confidence) or (None, confidence)
    """
    if embedding is None or not known_embeddings:
        return None, 0.0
    
    emb = np.array(embedding, dtype=np.float32).ravel()
    emb_norm = np.linalg.norm(emb)
    if emb_norm == 0:
        return None, 0.0
    emb = emb / emb_norm

    normalized = []
    for ref in known_embeddings:
        arr = np.array(ref, dtype=np.float32).ravel()
        norm = np.linalg.norm(arr)
        if norm == 0:
            continue
        normalized.append(arr / norm)

    if not normalized:
        return None, 0.0

    stack = np.vstack(normalized)
    similarity = stack @ emb
    best_match_idx = int(np.argmax(similarity))
    best_score = similarity[best_match_idx]
    
    if best_score >= threshold:
        return best_match_idx, float(best_score)
    return None, float(best_score)