import os
import json

import cv2
import numpy as np
from PIL import Image

from detector import detect_faces_and_crops, face_to_embedding

DB_DIR = "criminal_db"
META_FILE = os.path.join(DB_DIR, "criminals.json")

# Ensure folder exists
os.makedirs(DB_DIR, exist_ok=True)

# Load metadata
if os.path.exists(META_FILE):
    with open(META_FILE, "r") as f:
        criminal_data = json.load(f)
else:
    criminal_data = {}


def save_metadata():
    """Save criminal metadata to JSON file."""
    with open(META_FILE, "w") as f:
        json.dump(criminal_data, f, indent=4)


def _normalize_details(name_or_details, age=None, gender=None, crime=None):
    if isinstance(name_or_details, dict):
        details = {
            "name": name_or_details.get("name"),
            "age": name_or_details.get("age"),
            "gender": name_or_details.get("gender"),
            "crime": name_or_details.get("crime"),
        }
    else:
        details = {
            "name": name_or_details,
            "age": age,
            "gender": gender,
            "crime": crime,
        }
    if not details.get("name"):
        raise ValueError("Name is required to add a criminal")
    return details


def add_criminal_from_pil(pil_image, name_or_details, age=None, gender=None, crime=None):
    """Add a criminal to the DB (image + embedding + metadata)."""
    details = _normalize_details(name_or_details, age=age, gender=gender, crime=crime)

    filename = f"{details['name'].replace(' ', '_')}.jpg"
    img_path = os.path.join(DB_DIR, filename)
    pil_image.save(img_path)

    # Get embedding
    _, face_crops, _ = detect_faces_and_crops(pil_image)
    if not face_crops:
        raise ValueError("No face detected in the image")
    emb = face_to_embedding(face_crops[0])

    # Save embedding
    emb_path = os.path.join(DB_DIR, f"{details['name'].replace(' ', '_')}.npy")
    np.save(emb_path, emb)

    # Save metadata
    criminal_data[details["name"]] = {
        "age": details.get("age"),
        "gender": details.get("gender"),
        "crime": details.get("crime"),
        "image": img_path,
        "embedding": emb_path,
    }
    save_metadata()


def load_all_criminals():
    """Load all criminals (metadata + embeddings)."""
    results = []
    for name, details in criminal_data.items():
        emb_path = details.get("embedding")
        if emb_path and os.path.exists(emb_path):
            emb = np.load(emb_path)
            results.append({
                "name": name,
                "age": details.get("age"),
                "gender": details.get("gender"),
                "crime": details.get("crime"),
                "image": details.get("image"),
                "embedding": emb,
            })
    return results


def delete_criminal(name):
    """Delete a criminal (image, embedding, metadata)."""
    key = name.strip()
    if key not in criminal_data:
        return False

    # Delete image
    img_path = criminal_data[key].get("image")
    if img_path and os.path.exists(img_path):
        os.remove(img_path)

    # Delete embedding
    emb_path = criminal_data[key].get("embedding")
    if emb_path and os.path.exists(emb_path):
        os.remove(emb_path)

    # Remove from metadata
    del criminal_data[key]
    save_metadata()
    return True


def preprocess_sketch(source):
    """
    Preprocess a sketch image so it matches the same enhancement pipeline
    used in the legacy Tk GUI.
    Accepts either a filesystem path or a PIL image and returns an RGB PIL image.
    """
    if isinstance(source, Image.Image):
        gray = np.array(source.convert("L"))
    else:
        gray = cv2.imread(str(source), cv2.IMREAD_GRAYSCALE)

    if gray is None:
        raise ValueError("Invalid sketch image")

    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    img_eq = clahe.apply(gray)
    blur = cv2.GaussianBlur(img_eq, (3, 3), 0)

    edges = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 11, 2
    )
    blended = cv2.addWeighted(img_eq, 0.7, edges, 0.3, 0)
    rgb = cv2.cvtColor(blended, cv2.COLOR_GRAY2RGB)
    return Image.fromarray(rgb)
