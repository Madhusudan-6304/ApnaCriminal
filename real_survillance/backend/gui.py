import tkinter as tk
from tkinter import messagebox, filedialog, ttk
from PIL import Image, ImageTk
import threading, time
import numpy as np
import cv2
import os
import json
import requests  # ✅ pushover
from detector import detect_faces_and_crops, face_to_embedding, match_embedding
from audio_alert import play_alert

# ----------------- Config -----------------
DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "password"
VIDEO_DELAY = 30  # ms delay for video loop

DB_FILE = "criminals_db.json"
IMAGES_DIR = "criminal_images"
os.makedirs(IMAGES_DIR, exist_ok=True)

# ----------------- Pushover -----------------
PUSHOVER_USER_KEY = "ueye887hpc53m1bkqu58xfjah7sa6y"
PUSHOVER_APP_TOKEN = "aqifq5icentzw8yfn4djgyxf1bpiz1"
DUMMY_LOCATION = "Mysuru, Karnataka, India"

_last_alert_time = 0
ALERT_COOLDOWN = 30  # seconds


def send_pushover_with_image(title, msg, pil_image):
    """Send pushover notification with snapshot + location (anti-spam)"""
    global _last_alert_time
    now = time.time()
    if now - _last_alert_time < ALERT_COOLDOWN:
        return
    _last_alert_time = now

    try:
        img_path = "detected_alert.jpg"
        pil_image.save(img_path)
        with open(img_path, "rb") as f:
            requests.post(
                "https://api.pushover.net/1/messages.json",
                data={
                    "token": PUSHOVER_APP_TOKEN,
                    "user": PUSHOVER_USER_KEY,
                    "title": title,
                    "message": msg + f"\n📍 Location: {DUMMY_LOCATION}",
                },
                files={"attachment": ("image.jpg", f, "image/jpeg")},
            )
    except Exception as e:
        print("Pushover error:", e)


# ----------------- Database -----------------
def load_all_criminals():
    if not os.path.exists(DB_FILE):
        return []
    with open(DB_FILE, "r") as f:
        return json.load(f)


def save_all_criminals(criminals):
    with open(DB_FILE, "w") as f:
        json.dump(criminals, f, indent=4)


def add_criminal_from_pil(pil_image, details):
    name = details["name"]
    filename = f"{name}_{str(len(os.listdir(IMAGES_DIR)) + 1)}.jpg"
    path = os.path.join(IMAGES_DIR, filename)
    pil_image.save(path)

    _, faces, _ = detect_faces_and_crops(pil_image)
    if not faces:
        raise ValueError("No face detected in the image")
    emb = face_to_embedding(faces[0]).tolist()

    criminals = load_all_criminals()
    criminals.append({
        "name": name,
        "age": details.get("age", ""),
        "gender": details.get("gender", ""),
        "crime": details.get("crime", ""),
        "image_path": path,
        "embedding": emb
    })
    save_all_criminals(criminals)
    send_pushover_with_image("👮 Criminal Registered",
                             f"{name} added to database.", pil_image)


def delete_criminal(name):
    criminals = load_all_criminals()
    new_list, deleted = [], False
    for c in criminals:
        if c["name"].lower() == name.lower():
            if os.path.exists(c["image_path"]):
                os.remove(c["image_path"])
            deleted = True
        else:
            new_list.append(c)
    save_all_criminals(new_list)
    if deleted:
        dummy_img = Image.new("RGB", (200, 200), color="red")
        send_pushover_with_image("❌ Criminal Deleted",
                                 f"{name} removed from database.", dummy_img)
    return deleted


# ----------------- Sketch Preprocessing -----------------
def preprocess_sketch(path):
    img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError("Invalid sketch image")

    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    img_eq = clahe.apply(img)
    blur = cv2.GaussianBlur(img_eq, (3, 3), 0)

    edges = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 11, 2
    )
    blended = cv2.addWeighted(img_eq, 0.7, edges, 0.3, 0)
    return Image.fromarray(cv2.cvtColor(blended, cv2.COLOR_GRAY2RGB))


# ----------------- Main App -----------------
class App:
    def __init__(self, root):
        self.root = root
        self.root.title("Apna Criminal")

        screen_w = self.root.winfo_screenwidth()
        screen_h = self.root.winfo_screenheight()
        width, height = int(screen_w * 0.8), int(screen_h * 0.8)
        x, y = (screen_w - width) // 2, (screen_h - height) // 2
        self.root.geometry(f"{width}x{height}+{x}+{y}")
        self.root.configure(bg="#0d1117")  # ✅ Single dark background everywhere

        self.db_embeddings = []
        self.db_criminals = []
        self.reload_db_cache()

        self.current_video_cap = None
        self.video_running = False
        self.current_tkimg = None

        self.build_login()

    def reload_db_cache(self):
        items = load_all_criminals()
        self.db_criminals = items
        self.db_embeddings = [np.array(it["embedding"]) for it in items]

    # ----------------- LOGIN -----------------
    def build_login(self):
        for w in self.root.winfo_children():
            w.destroy()

        frame = tk.Frame(self.root, bg="#0d1117")
        frame.place(relx=0.5, rely=0.5, anchor="center")

        logo_path = "logo.png"
        if os.path.exists(logo_path):
            logo_img = Image.open(logo_path).resize((500, 500))  # ✅ Bigger logo
            self.logo_tk = ImageTk.PhotoImage(logo_img)
            tk.Label(frame, image=self.logo_tk, bg="#0d1117").pack(pady=20)

        tk.Label(frame, text="Apna Criminal",
                 font=("Helvetica", 48, "bold"),  # ✅ Bigger title
                 fg="white", bg="#0d1117").pack(pady=20)

        tk.Label(frame, text="Username", bg="#0d1117",
                 fg="#cbd5e1", font=("Arial", 14)).pack(anchor="w", padx=10, pady=(15, 0))
        self.username_entry = tk.Entry(frame, font=("Arial", 16), width=35)
        self.username_entry.pack(padx=10)

        tk.Label(frame, text="Password", bg="#0d1117",
                 fg="#cbd5e1", font=("Arial", 14)).pack(anchor="w", padx=10, pady=(10, 0))
        self.password_entry = tk.Entry(
            frame, show="*", font=("Arial", 16), width=35)
        self.password_entry.pack(padx=10)

        tk.Button(frame, text="Login", font=("Arial", 16, "bold"),
                  bg="#06b6d4", fg="black", command=self.check_login).pack(pady=25)

    def check_login(self):
        u, p = self.username_entry.get().strip(), self.password_entry.get().strip()
        if u == DEFAULT_USERNAME and p == DEFAULT_PASSWORD:
            self.build_dashboard()
        else:
            messagebox.showerror("Login Failed", "Invalid username or password")

    # ----------------- DASHBOARD -----------------
    def build_dashboard(self):
        for w in self.root.winfo_children():
            w.destroy()

        top = tk.Frame(self.root, bg="#0d1117", height=70)
        top.pack(fill="x")
        tk.Label(top, text="👮 Criminal Detection Dashboard", bg="#0d1117",
                 fg="white", font=("Helvetica", 22, "bold")).pack(side="left", padx=20)
        tk.Button(top, text="Logout", bg="#ef4444", fg="white",
                  command=self.logout, font=("Arial", 12, "bold")).pack(side="right", padx=20, pady=10)

        sidebar = tk.Frame(self.root, bg="#161b22", width=280)
        sidebar.pack(side="left", fill="y")

        buttons = [
            ("➕ Register Criminal", self.cmd_register_image, "#06b6d4"),
            ("📷 Register from Webcam", self.cmd_register_webcam, "#06b6d4"),
            ("🖼️ Detect From Image", self.cmd_detect_image, "#60a5fa"),
            ("✏️ Detect From Sketch", self.cmd_detect_sketch, "#facc15"),
            ("🎞️ Detect From Video", self.cmd_detect_video, "#60a5fa"),
            ("🔴 Live Camera", self.cmd_live_camera, "#34d399"),
            ("⏹ Stop Video", self.stop_video, "#ef4444"),
            ("❌ Delete Criminal", self.cmd_delete_criminal, "#f87171"),
        ]
        for text, cmd, color in buttons:
            tk.Button(sidebar, text=text, width=28, command=cmd,
                      bg=color, fg="black", font=("Arial", 12, "bold")).pack(pady=10, padx=15)

        self.db_status = tk.Label(sidebar, text=f"📂 DB size: {len(self.db_criminals)}",
                                  bg="#161b22", fg="white", font=("Arial", 12, "bold"))
        self.db_status.pack(pady=15)

        self.panel = tk.Frame(self.root, bg="#0d1117")
        self.panel.pack(side="left", expand=True, fill="both")

        self.canvas = tk.Canvas(self.panel, bg="black")
        self.canvas.pack(expand=True, fill="both", padx=10, pady=10)

        log_frame = tk.Frame(self.panel, bg="#161b22")
        log_frame.pack(fill="x", padx=10, pady=(0, 10))
        tk.Label(log_frame, text="📜 System Logs", bg="#161b22", fg="white",
                 font=("Arial", 13, "bold")).pack(anchor="w", padx=10, pady=5)
        self.log_text = tk.Text(log_frame, height=6, bg="#0d1117",
                                fg="#cbd5e1", font=("Consolas", 11))
        self.log_text.pack(fill="x", padx=10, pady=5)

        self.log("✅ Dashboard ready.")

    def logout(self):
        self.stop_video()
        self.build_login()

    def log(self, *msgs):
        s = " ".join(str(m) for m in msgs)
        ts = time.strftime("%Y-%m-%d %H:%M:%S")
        self.log_text.insert("end", f"[{ts}] {s}\n")
        self.log_text.see("end")

    # ----------------- Register -----------------
    def open_register_form(self, pil_image=None):
        win = tk.Toplevel(self.root)
        win.title("Register Criminal")
        win.geometry("400x400")
        win.configure(bg="#0d1117")

        tk.Label(win, text="Register Criminal", font=("Arial", 15, "bold"),
                 bg="#0d1117", fg="white").pack(pady=10)

        form_frame = tk.Frame(win, bg="#0d1117")
        form_frame.pack(pady=10)

        labels = ["Name", "Age", "Gender", "Crime"]
        entries = {}
        for lbl in labels:
            tk.Label(form_frame, text=lbl, bg="#0d1117", fg="white", anchor="w").pack(fill="x", padx=20, pady=(5, 0))
            ent = tk.Entry(form_frame, font=("Arial", 13))
            ent.pack(fill="x", padx=20, pady=(0, 5))
            entries[lbl.lower()] = ent

        def save_criminal_btn():
            details = {k: v.get().strip() for k, v in entries.items()}
            if not details["name"]:
                messagebox.showerror("Error", "Name is required")
                return
            try:
                add_criminal_from_pil(pil_image, details)
                self.reload_db_cache()
                self.db_status.config(text=f"📂 DB size: {len(self.db_criminals)}")
                self.log("Added criminal:", details)
                win.destroy()
            except Exception as e:
                messagebox.showerror("Error", str(e))

        tk.Button(win, text="Save", bg="#06b6d4", fg="black",
                  font=("Arial", 13, "bold"), command=save_criminal_btn).pack(pady=15)

    def cmd_register_image(self):
        path = filedialog.askopenfilename(title="Select image", filetypes=[("Images", "*.jpg *.jpeg *.png")])
        if not path:
            return
        pil = Image.open(path).convert("RGB")
        self.open_register_form(pil)

    def cmd_register_webcam(self):
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            messagebox.showerror("Error", "Cannot access webcam")
            return
        messagebox.showinfo("Capture", "Capturing one frame now. Please look at the camera.")
        ret, frame = cap.read()
        cap.release()
        if not ret:
            messagebox.showerror("Error", "Failed to capture")
            return
        pil = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        self.open_register_form(pil)

    # ----------------- Detection -----------------
    def cmd_detect_image(self):
        path = filedialog.askopenfilename(title="Select image", filetypes=[("Images", "*.jpg *.jpeg *.png")])
        if path:
            pil = Image.open(path).convert("RGB")
            self.process_and_show(pil)

    def cmd_detect_video(self):
        path = filedialog.askopenfilename(title="Select video", filetypes=[("Video", "*.mp4 *.avi *.mov *.mkv")])
        if path:
            self.start_video(path)

    def cmd_live_camera(self):
        self.start_video(0)

    def cmd_detect_sketch(self):
        path = filedialog.askopenfilename(title="Select sketch", filetypes=[("Sketch", "*.jpg *.jpeg *.png")])
        if path:
            try:
                pil = preprocess_sketch(path)
                self.process_and_show(pil)
                self.log("Processed sketch:", path)
            except Exception as e:
                messagebox.showerror("Error", str(e))

    # ----------------- Delete -----------------
    def cmd_delete_criminal(self):
        if not self.db_criminals:
            messagebox.showinfo("Empty", "No criminals in database.")
            return

        win = tk.Toplevel(self.root)
        win.title("Delete Criminal")
        win.geometry("300x150")
        win.configure(bg="#0d1117")

        tk.Label(win, text="Select name to delete:", bg="#0d1117", fg="white").pack(pady=10)
        names = [c["name"] for c in self.db_criminals]
        combo = ttk.Combobox(win, values=names, state="readonly")
        combo.pack(pady=10)
        combo.current(0)

        def do_delete():
            name = combo.get()
            if delete_criminal(name):
                self.reload_db_cache()
                self.db_status.config(text=f"📂 DB size: {len(self.db_criminals)}")
                messagebox.showinfo("Deleted", f"{name} removed from DB.")
                self.log("Deleted:", name)
                win.destroy()
            else:
                messagebox.showerror("Error", f"No record found for {name}")

        tk.Button(win, text="Delete", bg="#ef4444", fg="white", command=do_delete).pack(pady=10)

    # ----------------- Video + Processing -----------------
    def start_video(self, source):
        if self.video_running:
            messagebox.showinfo("Running", "Stop current video first")
            return

        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            messagebox.showerror("Error", "Cannot open video source")
            return

        self.current_video_cap = cap
        self.video_running = True
        threading.Thread(target=self.video_loop, daemon=True).start()
        self.log("Video started:", source)

    def stop_video(self):
        self.video_running = False
        if self.current_video_cap:
            self.current_video_cap.release()
            self.current_video_cap = None
        self.log("Video stopped.")

    def video_loop(self):
        cap = self.current_video_cap
        while self.video_running and cap and cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            pil = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            annotated = self.process_and_annotate(pil)

            canvas_w = max(400, self.canvas.winfo_width())
            canvas_h = max(300, self.canvas.winfo_height())
            annotated.thumbnail((canvas_w, canvas_h))
            tkimg = ImageTk.PhotoImage(annotated)

            self.current_tkimg = tkimg
            self.canvas.create_image(0, 0, anchor="nw", image=tkimg)

            time.sleep(VIDEO_DELAY / 1000.0)
        self.stop_video()

    def process_and_show(self, pil_image):
        annotated = self.process_and_annotate(pil_image)
        canvas_w = max(400, self.canvas.winfo_width())
        canvas_h = max(300, self.canvas.winfo_height())
        annotated.thumbnail((canvas_w, canvas_h))
        tkimg = ImageTk.PhotoImage(annotated)

        self.current_tkimg = tkimg
        self.canvas.create_image(0, 0, anchor="nw", image=tkimg)

    def process_and_annotate(self, pil_image):
        boxes, faces, mask_flags = detect_faces_and_crops(pil_image)
        labels, alarm = [], False
        cv2_img = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)

        for box, face, has_mask in zip(boxes, faces, mask_flags):
            emb = face_to_embedding(face)
            match_idx, score = match_embedding(emb, self.db_embeddings, threshold=0.55)
            if match_idx is not None:
                c = self.db_criminals[match_idx]
                label = (
                    f"{c['name']} | Age:{c.get('age','?')} | "
                    f"Gender:{c.get('gender','?')} | Crime:{c.get('crime','?')} | "
                    f"Match:{score:.2f}"
                )
                if has_mask:
                    label += " | Mask detected"
                labels.append(label)
                alarm = True

                x1, y1, x2, y2 = map(int, box)
                cv2.rectangle(cv2_img, (x1, y1), (x2, y2), (0, 255, 0), 3)
                cv2.putText(
                    cv2_img,
                    c["name"],
                    (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.9,
                    (255, 255, 0),
                    2,
                )

        annotated = Image.fromarray(cv2.cvtColor(cv2_img, cv2.COLOR_BGR2RGB))

        if alarm and labels:
            play_alert()
            ts = time.strftime("%Y-%m-%d %H:%M:%S")
            msg = "\n".join(labels) + f"\n\n📍 Location: {DUMMY_LOCATION}\n🕒 {ts}"
            send_pushover_with_image("🚨 Criminal Detected", msg, annotated)
            self.log("Detected criminals:", labels)

        return annotated


if __name__ == "__main__":
    root = tk.Tk()
    app = App(root)
    root.mainloop()
