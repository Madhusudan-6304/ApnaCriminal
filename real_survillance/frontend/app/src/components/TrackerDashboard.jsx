// src/components/TrackerDashboard.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Shield,
  RefreshCw,
  Target,
  Menu,
  Plus,
  UserPlus,
  AlertTriangle,
  ShieldAlert,
  Eye,
  MapPin,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from "react-leaflet";
import L from "leaflet";
import { GoogleGenAI, Type } from "@google/genai";

/* ======================= Inline CSS ======================= */
const css = `
:root{
  --bg-slate: #0f1724;
  --panel-slate: #0b1220;
  --muted: #94a3b8;
  --accent-blue: #2563eb;
  --border-slate: #1f2937;
  --text-white: #ffffff;
}

/* container */
.trp-container { position: relative; height: 100vh; width: 100vw; overflow: hidden; background: var(--bg-slate); color: var(--text-white); font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; }

/* map background */
.trp-map-bg { position: absolute; inset: 0; z-index: 0; }

/* ensure the leaflet container stretches */
.leaflet-container { width: 100% !important; height: 100% !important; }

/* mobile toggle */
.trp-mobile-toggle { position: absolute; top: 16px; left: 16px; z-index: 60; background: #ffffff; color: #0b1220; padding: 10px; border-radius: 999px; display:flex; }

/* sidebar */
.trp-sidebar { position: absolute; top: 0; bottom: 0; left: 0; z-index: 50; width: 100%; max-width: 420px; background: rgba(11,18,32,0.96); display: flex; flex-direction: column; transform: translateX(0); box-shadow: 0 6px 24px rgba(2,6,23,0.6); }

.trp-closed { transform: translateX(-100%); }
.trp-open { transform: translateX(0); }

.trp-sidebar-header { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.03); display:flex; justify-content:space-between; }
.trp-title { display:flex; gap:10px; align-items:center; }
.trp-title .icon { color: var(--accent-blue); width:20px; height:20px; }

.trp-close-btn { background:transparent; border:none; color:var(--text-dim); cursor:pointer; }

.trp-controls { padding:12px 16px; display:flex; flex-direction:column; gap:12px; }

.trp-add-row { display:flex; gap:8px; align-items:center; }
.trp-input-wrap { position:relative; flex:1; }
.trp-input { width:100%; padding:10px 12px 10px 36px; background:#0b1220; border:1px solid var(--border-slate); color:var(--text-white); border-radius:10px; }
.trp-input-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); }

.trp-add-btn { min-width:44px; display:flex; align-items:center; justify-content:center; background:var(--accent-blue); color:white; padding:8px; border-radius:8px; }

.trp-scan-btn { display:flex; align-items:center; justify-content:center; gap:10px; padding:10px 12px; border-radius:10px; background:#0b1220; color:#e6eef8; font-weight:700; text-transform:uppercase; }

.trp-list-wrap { padding:12px 16px; overflow-y:auto; flex: 1 1 auto; }
.trp-list-header { display:flex; justify-content:space-between; margin-bottom:10px; font-weight:700; color:var(--muted); }
.trp-live-badge { background: rgba(220,38,38,0.12); color:#dc2626; padding:4px 8px; border-radius:999px; font-weight:700; display:flex; gap:6px; align-items:center; }

.trp-footer { padding:12px 16px; border-top:1px solid rgba(255,255,255,0.02); color:var(--text-dim); text-align:center; }

.trp-card { position:relative; border-radius:8px; border:1px solid #1f2937; padding:12px; cursor:pointer; background: rgba(15,23,36,0.85); color: #fff; margin-bottom:10px; }
.trp-card:hover { transform: translateY(-2px); }

.trp-threat-strip { position:absolute; left:0; top:0; bottom:0; width:6px; background: #dc2626; }

.trp-name-row { display:flex; justify-content:space-between; margin-bottom:6px; align-items:center; }
.trp-name { font-weight:800; color:#fff; }

.trp-badge { font-size:12px; padding:6px 10px; border-radius:999px; font-weight:800; background:#dc2626; color:#fff; text-transform:uppercase; }

.trp-crime { color:#ffb8b8; display:flex; gap:8px; margin-bottom:8px; align-items:center; }

.trp-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:13px; color:#94a3b8; }

.trp-desc { font-size:13px; color:#f3f4f6; font-style:italic; border-left:2px solid rgba(148,163,184,0.08); padding-left:8px; }

.trp-cctv {
  position: absolute;
  inset: 0;
  z-index: 20;
  pointer-events: none;
  mix-blend-mode: overlay;
  background: linear-gradient(180deg, rgba(0,0,0,0.00) 0%, rgba(0,0,0,0.12) 100%);
}

.trp-radar {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 40;
  width: 110px;
  height: 110px;
  pointer-events: none;
}
.trp-radar .ring {
  position:absolute; inset:0; border-radius:999px; border:2px solid rgba(220,38,38,0.14); animation: radar-ping 2s infinite;
}
@keyframes radar-ping {
  0% { transform: scale(0.9); opacity: 0.9; }
  50% { transform: scale(1.15); opacity: 0.45; }
  100% { transform: scale(1.25); opacity: 0; }
}

/* responsive */
@media (max-width: 720px) {
  .trp-sidebar { max-width: 360px; width: 86%; }
}
`;

/* ======================= ThreatLevel constants ======================= */
const ThreatLevel = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  EXTREME: "Extreme",
};

/* ======================= Geo Helpers ======================= */
const generateRandomLocation = (center, radiusInMeters) => {
  const r = radiusInMeters / 111300;
  const u = Math.random();
  const v = Math.random();
  const w = r * Math.sqrt(u);
  const t = 2 * Math.PI * v;
  const x = w * Math.cos(t);
  const y = w * Math.sin(t);
  return {
    lat: center.lat + x,
    lng: center.lng + y / Math.cos((center.lat * Math.PI) / 180),
  };
};

const moveLocation = (current) => {
  const moveAmount = 0.00004;
  return {
    lat: current.lat + (Math.random() - 0.5) * moveAmount,
    lng: current.lng + (Math.random() - 0.5) * moveAmount,
  };
};

const calculateDistance = (loc1, loc2) => {
  const R = 6371e3;
  const φ1 = (loc1.lat * Math.PI) / 180;
  const φ2 = (loc2.lat * Math.PI) / 180;
  const Δφ = ((loc2.lat - loc1.lat) * Math.PI) / 180;
  const Δλ = ((loc2.lng - loc1.lng) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

/* ======================= Gemini (kept, unchanged) ======================= */
const aiClient = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GENAI_KEY,
});

const criminalSchema = {
  name: { type: Type.STRING },
  crime: { type: Type.STRING },
  description: { type: Type.STRING },
  threatLevel: { type: Type.STRING },
  lastSeen: { type: Type.STRING },
};

const generateCriminalProfiles = async (count) => {
  try {
    const res = await aiClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate ${count} fictional criminal profiles.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.OBJECT, properties: criminalSchema },
        },
      },
    });
    return JSON.parse(res.text);
  } catch {
    return [
      { name: "Ashwath", crime: "Bank Robbery", description: "Tall, black jacket", threatLevel: ThreatLevel.HIGH, lastSeen: "5m" },
      { name: "Manoj", crime: "Cyber Fraud", description: "Laptop bag", threatLevel: ThreatLevel.MEDIUM, lastSeen: "10m" },
      { name: "Jeevan", crime: "Heist", description: "Glasses, trench coat", threatLevel: ThreatLevel.EXTREME, lastSeen: "Now" },
      { name: "Binladen", crime: "Car Theft", description: "Hoodie", threatLevel: ThreatLevel.HIGH, lastSeen: "30m" },
      { name: "Charles", crime: "Tampering", description: "Lab coat", threatLevel: ThreatLevel.LOW, lastSeen: "1h" },
    ];
  }
};

/* ======================= Icons ======================= */
const createOfficerIcon = () =>
  new L.DivIcon({
    className: "bg-transparent",
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:34px">
        <div style="position:absolute;width:100%;height:100%;background:#16a34a;opacity:0.18;border-radius:999px;"></div>
        <div style="width:14px;height:14px;background:#15803d;border:2px solid #fff;border-radius:999px;"></div>
      </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

const createCriminalIcon = (level, isSelected) =>
  new L.DivIcon({
    className: "bg-transparent",
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;width:48px;height:48px">
        <div style="width:38px;height:38px;background:#ef4444;border:3px solid #fff;border-radius:999px;box-shadow:0 8px 20px rgba(0,0,0,0.45);transform: scale(${isSelected ? 1.12 : 1});"></div>
        <div style="position:absolute;bottom:-8px;background:#dc2626;color:#fff;padding:4px 8px;border-radius:8px;font-weight:800;font-size:11px;letter-spacing:0.6px">TARGET</div>
      </div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 36],
  });

/* Recenter helper */
const RecenterMap = ({ location }) => {
  const map = useMap();
  useEffect(() => {
    if (location && map) map.flyTo([location.lat, location.lng], 16);
  }, [location, map]);
  return null;
};

/* Map component (renders a polyline to selected target) */
const MapComponent = ({ userLocation, criminals, selectedId, onSelectCriminal }) => {
  const selected = criminals.find((c) => c.id === selectedId);
  const polylinePositions = selected ? [[userLocation.lat, userLocation.lng], [selected.location.lat, selected.location.lng]] : null;

  return (
    <MapContainer center={[userLocation.lat, userLocation.lng]} zoom={16} scrollWheelZoom style={{ height: "100%", width: "100%", zIndex: 0 }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      <RecenterMap location={userLocation} />

      <Marker position={[userLocation.lat, userLocation.lng]} icon={createOfficerIcon()}>
        <Popup><b>You (Officer)</b></Popup>
      </Marker>

      <Circle center={[userLocation.lat, userLocation.lng]} radius={500} pathOptions={{ color: "#22c55e", fillOpacity: 0.06 }} />

      {criminals.map((crim) => (
        <Marker
          key={crim.id}
          position={[crim.location.lat, crim.location.lng]}
          icon={createCriminalIcon(crim.threatLevel, selectedId === crim.id)}
          eventHandlers={{ click: () => onSelectCriminal(crim.id) }}
        >
          <Popup>
            <div style={{ fontWeight: 800 }}>{crim.name}</div>
            <div style={{ fontSize: 12, color: "#fecaca", fontWeight: 700 }}>{crim.crime}</div>
            <div style={{ marginTop: 6, color: "#9ca3af" }}>{crim.distance}m away</div>
          </Popup>
        </Marker>
      ))}

      {polylinePositions && <Polyline positions={polylinePositions} pathOptions={{ color: "#ff4d4d", weight: 3, dashArray: "6 8" }} />}
    </MapContainer>
  );
};

/* ======================= MAIN COMPONENT ======================= */
const TrackerDashboard = () => {
  // Use uploaded file path as requested by developer
  const AUDIO_SRC = "./src/assets/beep-125033.mp3";

  const [userState, setUserState] = useState({ location: null, error: null, loading: true });
  const [criminals, setCriminals] = useState([]);
  const [selectedCriminalId, setSelectedCriminalId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [newSuspectName, setNewSuspectName] = useState("");
  const alertAudioRef = useRef(null);
  const lastPlayRef = useRef(0);

  /* Inject CSS once */
  useEffect(() => {
    const el = document.createElement("style");
    el.innerHTML = css;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  /* Initialize audio object */
  useEffect(() => {
    try {
      alertAudioRef.current = new Audio(AUDIO_SRC);
      alertAudioRef.current.preload = "auto";
      alertAudioRef.current.volume = 0.55;
    } catch (e) {
      console.warn("Audio init failed:", e);
    }
  }, []);

  /* ⭐ FIXED LOCATION — MYCEM (Mysore College of Engineering & Management) */
  useEffect(() => {
    const mycem = { lat: 12.2798837, lng: 76.7186206 };
    setUserState({ location: mycem, error: null, loading: false });
  }, []);

  /* Auto-generate criminals when location is ready */
  useEffect(() => {
    if (!userState.location) return;
    let mounted = true;

    const generate = async () => {
      setGenerating(true);
      const profiles = (await generateCriminalProfiles(4)) || [];
      const baseProfiles = profiles.length ? profiles : [
        { name: "Ashwath", crime: "Bank Robbery", description: "Tall, black jacket", threatLevel: ThreatLevel.HIGH, lastSeen: "5m" },
        { name: "Manoj", crime: "Cyber Fraud", description: "Laptop bag", threatLevel: ThreatLevel.MEDIUM, lastSeen: "10m" },
        { name: "Jeevan", crime: "Heist", description: "Glasses, trench coat", threatLevel: ThreatLevel.EXTREME, lastSeen: "Now" },
        { name: "Binladen", crime: "Car Theft", description: "Hoodie", threatLevel: ThreatLevel.HIGH, lastSeen: "30m" },
      ];

      const mapped = baseProfiles.map((p, idx) => {
        const loc = generateRandomLocation(userState.location, 700 + Math.random() * 800);
        const distance = calculateDistance(userState.location, loc);
        return {
          ...p,
          id: `crim-${Date.now()}-${idx}`,
          location: loc,
          distance,
        };
      });

      if (mounted) {
        setCriminals(mapped);
        setGenerating(false);
      }
    };

    generate();

    return () => {
      mounted = false;
    };
  }, [userState.location]);

  /* Random movement & distance updates */
  useEffect(() => {
    if (!userState.location) return;
    const interval = setInterval(() => {
      setCriminals((prev) =>
        prev.map((c) => {
          const newLoc = moveLocation(c.location);
          const distance = calculateDistance(userState.location, newLoc);
          return { ...c, location: newLoc, distance };
        })
      );
    }, 2500);
    return () => clearInterval(interval);
  }, [userState.location]);

  /* Danger audio when any criminal < 200m */
  useEffect(() => {
    if (!alertAudioRef.current) return;
    const now = Date.now();
    const nearby = criminals.some((c) => c.distance && c.distance < 500);
    if (nearby) {
      if (now - lastPlayRef.current > 3500) {
        lastPlayRef.current = now;
        try {
          alertAudioRef.current.currentTime = 0;
          alertAudioRef.current.play().catch(() => {});
        } catch (e) {}
      }
    }
  }, [criminals]);

  /* Handler: add a suspect at a dummy nearby location */
  const handleAddSuspect = useCallback(() => {
    const name = newSuspectName.trim();
    if (!name || !userState.location) return;
    const loc = generateRandomLocation(userState.location, 350 + Math.random() * 300);
    const distance = calculateDistance(userState.location, loc);
    const threat = distance < 300 ? ThreatLevel.HIGH : ThreatLevel.MEDIUM;
    const newCrim = {
      id: `custom-${Date.now()}`,
      name,
      crime: "Suspicious Activity",
      description: "Manually added suspect",
      threatLevel: threat,
      lastSeen: "Now",
      location: loc,
      distance,
    };
    setCriminals((prev) => [newCrim, ...prev].sort((a, b) => (a.distance || 0) - (b.distance || 0)));
    setNewSuspectName("");
    setSelectedCriminalId(newCrim.id);

    // if within alert distance, trigger sound immediately
    if (distance < 500 && alertAudioRef.current) {
      try {
        alertAudioRef.current.currentTime = 0;
        alertAudioRef.current.play().catch(() => {});
        lastPlayRef.current = Date.now();
      } catch (e) {}
    }
  }, [newSuspectName, userState.location]);

  if (userState.loading)
    return (
      <div className="trp-page">
        <Shield className="trp-icon-pulse" />
        <h1 className="trp-loading-title">Acquiring Signal...</h1>
      </div>
    );

  return (
    <div className="trp-container">
      <div className="trp-cctv" aria-hidden />
      <div className="trp-radar" aria-hidden>
        <div className="ring" />
      </div>

      <div className="trp-map-bg">
        <MapComponent
          userLocation={userState.location}
          criminals={criminals}
          selectedId={selectedCriminalId}
          onSelectCriminal={(id) => setSelectedCriminalId(id)}
        />
      </div>

      <aside className="trp-sidebar trp-open" role="complementary">
        <div className="trp-sidebar-header">
          <div className="trp-title">
            <Shield className="icon" />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontWeight: 900 }}>GCPD TRACKER</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>MYCEM — Mysuru (12.2798837, 76.7186206)</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div className="trp-live-badge">
              <AlertTriangle size={12} /> Active
            </div>
          </div>
        </div>

        <div className="trp-controls">
          <div style={{ display: "flex", gap: 8 }}>
            <div className="trp-input-wrap">
              <input
                className="trp-input"
                placeholder="Add Suspect Name..."
                value={newSuspectName}
                onChange={(e) => setNewSuspectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSuspect()}
              />
              <UserPlus className="trp-input-icon" />
            </div>
            <button className="trp-add-btn" onClick={handleAddSuspect} disabled={!newSuspectName.trim()}>
              <Plus />
            </button>
          </div>

          <button className={`trp-scan-btn ${generating ? "trp-disabled" : ""}`} disabled={generating}>
            <RefreshCw className={generating ? "trp-spin" : ""} />
            <span style={{ marginLeft: 8 }}>{generating ? "Scanning..." : "Rescan Area"}</span>
          </button>
        </div>

        <div className="trp-list-wrap">
          <div className="trp-list-header">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Target size={16} />
              <div style={{ fontWeight: 800 }}>Targets ({criminals.length})</div>
            </div>
            <div className="trp-live-badge">
              <AlertTriangle size={12} /> Active
            </div>
          </div>

          {criminals.length === 0 ? (
            <div style={{ padding: 20, color: "#94a3b8", textAlign: "center" }}>
              <ShieldAlert style={{ width: 48, height: 48, opacity: 0.6 }} />
              <div style={{ marginTop: 8 }}>No targets detected</div>
            </div>
          ) : (
            criminals.map((criminal) => {
              const isSelected = selectedCriminalId === criminal.id;
              return (
                <div
                  key={criminal.id}
                  className="trp-card"
                  onClick={() => setSelectedCriminalId(criminal.id)}
                  style={{
                    border: isSelected ? "1px solid rgba(220,38,38,0.9)" : undefined,
                    boxShadow: isSelected ? "0 10px 30px rgba(220,38,38,0.12)" : undefined,
                  }}
                >
                  <div className="trp-threat-strip" />

                  <div style={{ paddingLeft: 12 }}>
                    <div className="trp-name-row">
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div className="trp-name">{criminal.name}</div>
                        <div className="trp-badge">TARGET</div>
                      </div>
                      <div style={{ color: "#fca5a5", fontWeight: 800 }}>{criminal.threatLevel}</div>
                    </div>

                    <div className="trp-crime">
                      <AlertTriangle size={14} /> <span style={{ fontWeight: 700 }}>{criminal.crime}</span>
                    </div>

                    <div className="trp-grid">
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <MapPin size={14} /> <span style={{ fontWeight: 800 }}>{criminal.distance}m</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <Eye size={14} /> <span style={{ color: "#9ca3af" }}>{criminal.lastSeen ?? "recent"}</span>
                      </div>
                    </div>

                    <p className="trp-desc">"{criminal.description}"</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="trp-footer">
          OFFICER LOC: {userState.location.lat.toFixed(6)}, {userState.location.lng.toFixed(6)}
        </div>
      </aside>
    </div>
  );
};

export default TrackerDashboard;
