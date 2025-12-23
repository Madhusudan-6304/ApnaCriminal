// CriminalList.jsx
import React from "react";
import { API_BASE } from "../api/client";

const FALLBACK_IMAGE = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 260'>
    <defs>
      <linearGradient id='grad' x1='0%' y1='0%' x2='100%' y2='0%'>
        <stop offset='0%' stop-color='#1d4ed8'/>
        <stop offset='100%' stop-color='#3b82f6'/>
      </linearGradient>
    </defs>
    <rect width='400' height='260' rx='24' fill='url(#grad)'/>
    <text x='50%' y='45%' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='32' font-family='Inter, sans-serif'>No Image</text>
    <text x='50%' y='65%' dominant-baseline='middle' text-anchor='middle' fill='rgba(255,255,255,0.8)' font-size='18' font-family='Inter, sans-serif'>Preview Unavailable</text>
  </svg>`
)}`;

function buildImageUrl(criminal) {
  if (!criminal) return null;
  const raw = criminal.image_path || criminal.image;
  if (!raw) return null;
  const parts = String(raw).split(/[/\\]/);
  const filename = parts[parts.length - 1];
  if (!filename) return null;
  return `${API_BASE}/api/images/${encodeURIComponent(filename)}`;
}

export default function CriminalList({ items }) {
  if (!items || items.length === 0) {
    return <div className="no-criminals-compact">No criminals registered yet.</div>;
  }

  return (
    <div className="criminal-list-compact" onClick={(e) => e.stopPropagation()}>
      {items.map((criminal, index) => {
        const imageUrl = buildImageUrl(criminal) || FALLBACK_IMAGE;
        return (
          <div key={index} className="criminal-row-compact" onClick={(e) => e.stopPropagation()}>
            <img
              src={imageUrl}
              alt={criminal.name}
              className="criminal-thumb-compact"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = FALLBACK_IMAGE;
              }}
            />
            <div className="criminal-info-compact">
              <div className="criminal-line-1">
                <span className="criminal-name-compact">{criminal.name}</span>
                {criminal.age && <span className="criminal-age-compact">Age: {criminal.age}</span>}
              </div>
              <div className="criminal-line-2">
                {criminal.gender && <span className="criminal-gender-compact">{criminal.gender}</span>}
                <span className="criminal-crime-compact">{criminal.crime || "N/A"}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
