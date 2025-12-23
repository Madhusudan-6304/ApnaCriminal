import React from "react";

export default function Sidebar({ onAction, dbSize, onLogout }) {
  const items = [
    ["register_image", "➕ Register Criminal"],
    ["register_webcam", "📷 Register from Webcam"],
    ["detect_image", "🖼️ Detect From Image"],
    ["detect_sketch", "✏️ Detect From Sketch"],
    ["detect_video", "🎞️ Detect From Video"],
    ["live_camera", "🔴 Live Camera"],
    ["stop_video", "⏹ Stop Video"],
    ["delete_criminal", "❌ Delete Criminal"],
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>👮 Criminal Detection</h3>
        <div className="db-size">DB size: {dbSize}</div>
      </div>
      <div className="sidebar-items">
        {items.map(([k, label]) => (
          <button key={k} onClick={() => onAction(k)} className="sidebar-btn">
            {label}
          </button>
        ))}
      </div>
      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={onLogout}>Logout</button>
      </div>
    </div>
  );
}
