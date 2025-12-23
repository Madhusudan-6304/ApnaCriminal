import os
import json

DB_FILE = "criminals_db.json"
IMAGES_DIR = "criminal_images"

# Ensure directories exist
os.makedirs(IMAGES_DIR, exist_ok=True)

def load_all_criminals():
    """Load all criminals from the JSON database"""
    if not os.path.exists(DB_FILE):
        return []
    with open(DB_FILE, "r") as f:
        return json.load(f)

def save_all_criminals(criminals):
    """Save criminals back to JSON"""
    with open(DB_FILE, "w") as f:
        json.dump(criminals, f, indent=4)

def save_criminal(name, age, gender, crime, pil_image):
    """Save criminal details and image"""
    filename = f"{name}_{str(len(os.listdir(IMAGES_DIR)) + 1)}.jpg"
    path = os.path.join(IMAGES_DIR, filename)
    pil_image.save(path)

    criminals = load_all_criminals()
    criminals.append({
        "name": name,
        "age": age,
        "gender": gender,
        "crime": crime,
        "image_path": path
    })
    save_all_criminals(criminals)
    return path

def delete_criminal(name):
    """Delete criminal by name"""
    criminals = load_all_criminals()
    new_list = []
    for c in criminals:
        if c["name"].lower() == name.lower():
            if os.path.exists(c["image_path"]):
                os.remove(c["image_path"])
        else:
            new_list.append(c)
    save_all_criminals(new_list)
    return True
