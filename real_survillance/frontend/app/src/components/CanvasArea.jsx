// CanvasArea.jsx
import React, { useEffect, useRef, useState } from "react";

export default function CanvasArea({ frameSource }) {
  const canvasRef = useRef(null);
  const [maskAlert, setMaskAlert] = useState(false);
  const [unknownAlert, setUnknownAlert] = useState(false);
  const [criminalAlert, setCriminalAlert] = useState(null); // { name: string, score: number }
  const [faceDetectionAlert, setFaceDetectionAlert] = useState(null); // { name: string, isCriminal: boolean }
  const maskTimeoutRef = useRef(null);
  const unknownTimeoutRef = useRef(null);
  // Store recent detections with timestamps for persistence
  const recentDetectionsRef = useRef([]); // Criminal detections (green boxes)
  const recentUnknownRef = useRef([]); // Unknown face detections (red boxes)
  const lastImageRef = useRef(null); // Store last drawn image for redrawing
  const alertedCriminalsRef = useRef(new Set()); // Track which criminals have already shown alerts
  const DETECTION_PERSISTENCE_MS = 60000; // Keep detections visible for 1 minute
  const UNKNOWN_PERSISTENCE_MS = 5000; // Keep unknown detections visible for 5 seconds

  useEffect(() => {
    return () => {
      if (maskTimeoutRef.current) clearTimeout(maskTimeoutRef.current);
      if (unknownTimeoutRef.current) clearTimeout(unknownTimeoutRef.current);
    };
  }, []);

  // Helper function to draw detection boxes on canvas
  const drawDetections = (ctx, detections, canvasWidth, canvasHeight) => {
    const now = Date.now();
    
    // Filter out expired detections
    recentDetectionsRef.current = recentDetectionsRef.current.filter(
      (det) => now - det.timestamp < DETECTION_PERSISTENCE_MS
    );
    recentUnknownRef.current = recentUnknownRef.current.filter(
      (det) => now - det.timestamp < UNKNOWN_PERSISTENCE_MS
    );
    
    // Process detections from current frame
    if (detections && detections.length > 0) {
      // Show face detection alert for any face detected (only if no alert is currently showing)
      const hasAnyFace = detections.some(d => d.box && d.box.length === 4);
      if (hasAnyFace && !faceDetectionAlert) {
        const firstDet = detections.find(d => d.box && d.box.length === 4);
        if (firstDet) {
          const isUnknown = !firstDet.name || firstDet.name.toLowerCase() === "unknown";
          setFaceDetectionAlert({ 
            name: isUnknown ? "Unknown Face" : (firstDet.name || "Face detected"), 
            isCriminal: !isUnknown,
            score: firstDet.score || null
          });
        }
      }
      
      detections.forEach((det) => {
        if (!det.box || det.box.length !== 4) return;
        
        // Normalize name for comparison
        const detName = (det.name || "").trim();
        const isUnknown = !detName || detName.toLowerCase() === "unknown";
        
        if (isUnknown) {
          // Handle unknown faces (red boxes)
          const existing = recentUnknownRef.current.find(
            (d) => Math.abs(d.box[0] - det.box[0]) < 50 && 
            Math.abs(d.box[1] - det.box[1]) < 50
          );
          
          if (existing) {
            // Only update timestamp if detection is very new to prevent resetting persistence
            const age = now - existing.timestamp;
            if (age < 1000) {
              existing.timestamp = now;
            }
            existing.box = det.box;
          } else {
            recentUnknownRef.current.push({
              ...det,
              name: "Unknown",
              timestamp: now,
            });
          }
        } else {
          // Handle criminal detections (green boxes)
          // Check if this is a known criminal (has a name and not "Unknown" or "Masked")
          const isCriminal = detName && 
                            detName.toLowerCase() !== "unknown" && 
                            detName.toLowerCase() !== "masked";
          
          if (isCriminal) {
            const existing = recentDetectionsRef.current.find(
              (d) => d.name === detName && 
              Math.abs(d.box[0] - det.box[0]) < 50 && 
              Math.abs(d.box[1] - det.box[1]) < 50
            );
            
            if (existing) {
              // Update position and label, but preserve timestamp to ensure minimum 1 minute persistence
              // Only reset timestamp if this is a brand new detection (age > 1 minute means it expired)
              const age = now - existing.timestamp;
              if (age >= DETECTION_PERSISTENCE_MS) {
                // This is a new detection after the old one expired, reset timestamp
                existing.timestamp = now;
              }
              // Always update box position and label to track movement
              existing.box = det.box;
              existing.label = det.label;
              existing.score = det.score;
            } else {
              // New criminal detection - trigger alerts
              if (!alertedCriminalsRef.current.has(detName)) {
                setCriminalAlert({ name: detName, score: det.score || 0 });
                setFaceDetectionAlert({ name: detName, isCriminal: true, score: det.score || 0 });
                alertedCriminalsRef.current.add(detName);
                // Remove from alerted set after 10 seconds to allow re-alerting
                setTimeout(() => {
                  alertedCriminalsRef.current.delete(detName);
                }, 10000);
              }
              
              // Add new detection with current timestamp
              recentDetectionsRef.current.push({
                ...det,
                name: detName, // Use normalized name
                timestamp: now,
              });
              
              // Debug: Log when detection is added
              console.log("✅ Added criminal detection:", detName, "at", new Date(now).toLocaleTimeString());
            }
          }
        }
      });
    }
    
    // Draw all recent criminal detections (green boxes)
    recentDetectionsRef.current.forEach((det) => {
      if (!det.box || det.box.length !== 4) return;
      
      const [x1, y1, x2, y2] = det.box;
      const age = now - det.timestamp;
      const opacity = Math.max(0.5, 1 - (age / DETECTION_PERSISTENCE_MS)); // Fade out over time
      
      // Draw green box
      ctx.strokeStyle = `rgba(0, 255, 0, ${opacity})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      
      // Draw label with name and score
      const label = det.label || (det.score ? `${det.name} (${det.score.toFixed(2)})` : det.name);
      ctx.fillStyle = `rgba(255, 255, 0, ${opacity})`;
      ctx.font = "bold 16px Arial";
      ctx.fillText(label, x1, Math.max(20, y1 - 5));
    });
    
    // Draw all recent unknown detections (red boxes)
    recentUnknownRef.current.forEach((det) => {
      if (!det.box || det.box.length !== 4) return;
      
      const [x1, y1, x2, y2] = det.box;
      const age = now - det.timestamp;
      const opacity = Math.max(0.5, 1 - (age / UNKNOWN_PERSISTENCE_MS)); // Fade out over time
      
      // Draw red box
      ctx.strokeStyle = `rgba(255, 0, 0, ${opacity})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      
      // Draw "Unknown" label
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.font = "bold 16px Arial";
      ctx.fillText("Unknown", x1, Math.max(20, y1 - 5));
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    
    if (!frameSource || !frameSource.blob) {
      const fallbackWidth = canvas.clientWidth || canvas.offsetWidth || 640;
      const fallbackHeight = canvas.clientHeight || 360;
      canvas.width = fallbackWidth;
      canvas.height = fallbackHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#9ca3af";
      ctx.font = "18px monospace";
      ctx.fillText("No preview", 20, 40);
      return;
    }

    const blobUrl = URL.createObjectURL(frameSource.blob);
    const img = new Image();
    let isMounted = true;
    
    img.onload = () => {
      if (!isMounted || !canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Store the image for later redrawing
      lastImageRef.current = img;
      
      // Draw the base image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Draw persistent detection boxes on top
      // Always process detections to update persistent list, even if empty
      const detections = frameSource.meta?.detections || [];
      drawDetections(ctx, detections, canvas.width, canvas.height);
      
      // IMPORTANT: Always redraw persistent detections even if new frame has no detections
      // This ensures green boxes stay visible
      const now = Date.now();
      const activeDetections = recentDetectionsRef.current.filter(
        (det) => det.box && det.box.length === 4 && (now - det.timestamp) < DETECTION_PERSISTENCE_MS
      );
      
      if (activeDetections.length > 0) {
        activeDetections.forEach((det) => {
          const [x1, y1, x2, y2] = det.box;
          const age = now - det.timestamp;
          const opacity = Math.max(0.5, 1 - (age / DETECTION_PERSISTENCE_MS));
          
          // Draw green box
          ctx.strokeStyle = `rgba(0, 255, 0, ${opacity})`;
          ctx.lineWidth = 3;
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
          
          // Draw label with name and score
          const label = det.label || (det.score ? `${det.name} (${det.score.toFixed(2)})` : det.name);
          ctx.fillStyle = `rgba(255, 255, 0, ${opacity})`;
          ctx.font = "bold 16px Arial";
          ctx.fillText(label, x1, Math.max(20, y1 - 5));
        });
        
        // Debug: Log when drawing persistent detections
        if (activeDetections.length > 0) {
          console.log(`🟢 Drawing ${activeDetections.length} persistent detection(s)`, 
            activeDetections.map(d => d.name).join(", "));
        }
      }
      
      const hasMask = detections.some((d) => d.has_mask);
      const hasUnknown = detections.some((d) => !d.name || d.name.toLowerCase() === "unknown");

      if (hasMask) {
        if (maskTimeoutRef.current) clearTimeout(maskTimeoutRef.current);
        setMaskAlert(true);
        maskTimeoutRef.current = setTimeout(() => {
          if (isMounted) setMaskAlert(false);
        }, 3000);
      }

      if (hasUnknown) {
        if (unknownTimeoutRef.current) clearTimeout(unknownTimeoutRef.current);
        setUnknownAlert(true);
        unknownTimeoutRef.current = setTimeout(() => {
          if (isMounted) setUnknownAlert(false);
        }, 3000);
      }

      URL.revokeObjectURL(blobUrl);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
    };
    
    img.src = blobUrl;
    
    return () => {
      isMounted = false;
      URL.revokeObjectURL(blobUrl);
    };
  }, [frameSource]);
  
  // Periodically redraw detections to update fading
  useEffect(() => {
    const interval = setInterval(() => {
      const canvas = canvasRef.current;
      if (!canvas || canvas.width === 0 || canvas.height === 0 || !lastImageRef.current) return;
      
      const ctx = canvas.getContext("2d");
      const now = Date.now();
      
      // Filter out expired detections
      recentDetectionsRef.current = recentDetectionsRef.current.filter(
        (det) => now - det.timestamp < DETECTION_PERSISTENCE_MS
      );
      
      // Only redraw if we have persistent detections
      if (recentDetectionsRef.current.length > 0) {
        // Redraw base image first
        ctx.drawImage(lastImageRef.current, 0, 0, canvas.width, canvas.height);
        
        // Then redraw all recent detections with updated opacity
        // Draw criminal detections (green boxes)
        recentDetectionsRef.current.forEach((det) => {
          if (!det.box || det.box.length !== 4) return;
          
          const [x1, y1, x2, y2] = det.box;
          const age = now - det.timestamp;
          const opacity = Math.max(0.4, 1 - (age / DETECTION_PERSISTENCE_MS));
          
          // Draw green box
          ctx.strokeStyle = `rgba(0, 255, 0, ${opacity})`;
          ctx.lineWidth = 3;
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
          
          // Draw label with name and score
          const label = det.label || (det.score ? `${det.name} (${det.score.toFixed(2)})` : det.name);
          ctx.fillStyle = `rgba(255, 255, 0, ${opacity})`;
          ctx.font = "bold 16px Arial";
          ctx.fillText(label, x1, Math.max(20, y1 - 5));
        });
        
        // Draw unknown detections (red boxes)
        recentUnknownRef.current.forEach((det) => {
          if (!det.box || det.box.length !== 4) return;
          
          const [x1, y1, x2, y2] = det.box;
          const age = now - det.timestamp;
          const opacity = Math.max(0.4, 1 - (age / UNKNOWN_PERSISTENCE_MS));
          
          // Draw red box
          ctx.strokeStyle = `rgba(255, 0, 0, ${opacity})`;
          ctx.lineWidth = 3;
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
          
          // Draw "Unknown" label
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.font = "bold 16px Arial";
          ctx.fillText("Unknown", x1, Math.max(20, y1 - 5));
        });
      }
    }, 200); // Update every 200ms for smooth fading
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="canvas-area">
      <canvas ref={canvasRef} className="canvas-surface" />
      
      {/* Mask Alert */}
      {maskAlert && (
        <div className="alert-overlay mask-alert">
          <div className="alert-content">
            <span className="alert-icon">⚠️</span>
            <span>ALERT: Mask or scarf detected. Please remove it for proper identification.</span>
          </div>
        </div>
      )}
      
      {/* Face Detection Alert - Top Notification */}
      {faceDetectionAlert && (
        <div className="face-detection-notification">
          <div className="face-detection-content">
            <span className="face-detection-icon">
              {faceDetectionAlert.isCriminal ? "🚨" : "👤"}
            </span>
            <span className="face-detection-message">
              {faceDetectionAlert.isCriminal 
                ? `Criminal ${faceDetectionAlert.name} detected!`
                : `Face detected: ${faceDetectionAlert.name}`}
              {faceDetectionAlert.score !== undefined && faceDetectionAlert.score !== null && (
                <span className="face-detection-score">
                  {" "}({typeof faceDetectionAlert.score === 'number' && faceDetectionAlert.score <= 1 
                    ? (faceDetectionAlert.score * 100).toFixed(1) 
                    : faceDetectionAlert.score.toFixed(1)}%)
                </span>
              )}
            </span>
            <button 
              className="face-detection-close"
              onClick={() => setFaceDetectionAlert(null)}
            >
              OK
            </button>
          </div>
        </div>
      )}
      
      {/* Criminal Detection Alert Modal */}
      {criminalAlert && (
        <div className="modal-overlay" onClick={() => setCriminalAlert(null)}>
          <div className="modal-content criminal-alert-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">🚨 Criminal Detected</h2>
            </div>
            <div className="criminal-alert-body">
              <div className="criminal-alert-icon">⚠️</div>
              <div className="criminal-alert-message">
                Criminal <strong>{criminalAlert.name}</strong> detected!
                {criminalAlert.score !== undefined && criminalAlert.score !== null && (
                  <div className="criminal-alert-score">
                    Accuracy: {typeof criminalAlert.score === 'number' && criminalAlert.score <= 1 
                      ? (criminalAlert.score * 100).toFixed(1) 
                      : criminalAlert.score.toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="btn-submit" 
                onClick={() => setCriminalAlert(null)}
                style={{ width: "100%" }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="canvas-overlay">
        {frameSource?.meta?.label ? frameSource.meta.label : "Awaiting detection..."}
      </div>
      
      {/* Loading Spinner */}
      {frameSource?.meta?.label?.includes("Processing") && (
        <div className="detection-loading">
          <div className="spinner"></div>
          <div className="loading-text">Processing...</div>
        </div>
      )}
    </div>
  );
}