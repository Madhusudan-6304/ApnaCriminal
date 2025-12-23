// src/components/RegistrationModal.jsx
import React, { useState, useEffect, useRef } from "react";

export default function RegistrationModal({ isOpen, onClose, onSubmit, imageBlob, imageFile, mode }) {
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    gender: "",
    crime: "",
  });
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setFormData({ name: "", age: "", gender: "", crime: "" });
      setErrors({});
      if (imageBlob) {
        setPreview(URL.createObjectURL(imageBlob));
      } else if (imageFile) {
        setPreview(URL.createObjectURL(imageFile));
      } else {
        setPreview(null);
      }
    } else {
      // Cleanup preview URL when modal closes
      if (preview) {
        URL.revokeObjectURL(preview);
        setPreview(null);
      }
    }
  }, [isOpen, imageBlob, imageFile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      // Store file for submission
      fileInputRef.current = file;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const finalImage = imageBlob || imageFile || fileInputRef.current;
    if (!finalImage) {
      alert("Please select an image");
      return;
    }

    onSubmit({
      ...formData,
      image: finalImage,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {mode === "webcam" ? "📷 Register from Webcam" : "🖼️ Register from Image"}
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="registration-form">
          <div className="form-preview-section">
            <div className="image-preview-container">
              {preview ? (
                <img src={preview} alt="Preview" className="image-preview" />
              ) : (
                <div className="image-preview-placeholder">
                  <span>📷</span>
                  <p>No image selected</p>
                </div>
              )}
            </div>
            {!imageBlob && !imageFile && (
              <div className="image-upload-section">
                <label className="upload-label">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="file-input"
                  />
                  <span className="upload-button">Choose Image</span>
                </label>
              </div>
            )}
          </div>

          <div className="form-fields">
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                Name <span className="required">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                className={`form-input ${errors.name ? "error" : ""}`}
                placeholder="Enter criminal name"
                required
              />
              {errors.name && <span className="error-message">{errors.name}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="age" className="form-label">Age</label>
                <input
                  id="age"
                  name="age"
                  type="number"
                  value={formData.age}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Age"
                  min="1"
                  max="120"
                />
              </div>

              <div className="form-group">
                <label htmlFor="gender" className="form-label">Gender</label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="form-input"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="crime" className="form-label">Crime</label>
              <input
                id="crime"
                name="crime"
                type="text"
                value={formData.crime}
                onChange={handleChange}
                className="form-input"
                placeholder="Enter crime details"
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-submit">
              Register Criminal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

