// src/components/VoiceAnalyzer.jsx
import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  AlertTriangle,
  Fingerprint,
  Lock,
  RotateCcw,
  ShieldAlert,
  Copy,
  Check,
} from "lucide-react";
import "./voice-analyzer.css";

/**
 * VoiceAnalyzer.jsx
 * - Lazy-loads @google/genai only when VITE_GENAI_KEY is present
 * - Uses import.meta.env.VITE_GENAI_KEY (same as SkillTest)
 * - Falls back to deterministic mock analysis when key is missing
 * - No email / mailto functionality included
 */

/* App state */
const AppState = {
  IDLE: "IDLE",
  RECORDING_REFERENCE: "RECORDING_REFERENCE",
  REFERENCE_STORED: "REFERENCE_STORED",
  RECORDING_SUSPECT: "RECORDING_SUSPECT",
  ANALYZING: "ANALYZING",
  RESULT_MATCH: "RESULT_MATCH",
  RESULT_NO_MATCH: "RESULT_NO_MATCH",
  ERROR: "ERROR",
};

/* System instruction for the model (kept but will only be used when real API is present) */
const SYSTEM_INSTRUCTION = `
You are an advanced AI Forensic Audio Decryptor used by intelligence agencies.
Your specific task is to identify if a "Suspect Voice" is actually a known "Criminal" (Reference Voice) who is using a voice changer.

Task:
1. Analyze the Reference Audio (Original voice).
2. Analyze the Suspect Audio (Modulated/Disguised voice).
3. IGNORE simple pitch shifts and common vocoder artifacts.
4. FOCUS on speaker biometrics: cadence, breath patterns, micro-pauses, and idiosyncratic pronunciations.
Return ONLY valid JSON with keys:
matchProbability (0-100), reasoning (string), voiceCharacteristics (array of strings), detectedModulationType (string|null), originalIdentityDetected (boolean)
`;

/* Helper: blob -> base64 */
const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      const base64 = String(dataUrl).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

/* analyzeVoiceMatch: lazy-imports @google/genai and uses import.meta.env.VITE_GENAI_KEY */
const analyzeVoiceMatch = async (referenceBlob, suspectBlob) => {
  const VITE_KEY = import.meta.env.VITE_GENAI_KEY;
  console.log("[VoiceAnalyzer] VITE_GENAI_KEY present?", !!VITE_KEY);

  // Mock fallback when key not present — deterministic and useful in dev
  if (!VITE_KEY) {
    console.warn("[VoiceAnalyzer] MOCK analysis used (VITE_GENAI_KEY not set).");
    // Basic fake analysis: random-ish but deterministic based on blob sizes
    const refSize = referenceBlob ? referenceBlob.size || 0 : 0;
    const susSize = suspectBlob ? suspectBlob.size || 0 : 0;
    const diff = Math.abs(refSize - susSize);
    const matchProbability = Math.max(8, Math.min(92, 80 - Math.round(diff / 1000)));
    const originalIdentityDetected = matchProbability > 70;
    return {
      matchProbability,
      reasoning: "Local mock analysis: API key missing — returning simulated result.",
      voiceCharacteristics: ["mock-cadence", "mock-breath-pattern"],
      detectedModulationType: diff > 50000 ? "Heavy pitch-shift (simulated)" : "Light modulation (simulated)",
      originalIdentityDetected,
    };
  }

  // Real API path: lazy import to avoid bundling the SDK unnecessarily
  try {
    const { GoogleGenAI, Type } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: VITE_KEY });

    // Quick auth check (lightweight) — helpful to surface auth/cors errors early
    try {
      const ping = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Authentication ping: respond with {\"ok\":true}",
        config: { responseMimeType: "application/json" },
      });
      console.log("[VoiceAnalyzer] auth test:", (ping && ping.text && ping.text.slice ? ping.text.slice(0, 200) : ping));
    } catch (authErr) {
      console.error("[VoiceAnalyzer] GenAI auth test failed:", authErr);
      throw new Error("GenAI authentication test failed. Check VITE_GENAI_KEY and network.");
    }

    // Convert blobs to base64
    const refBase64 = await blobToBase64(referenceBlob);
    const susBase64 = await blobToBase64(suspectBlob);

    // Note: audio payloads may be large. If you hit payload or CORS errors, consider proxying via your backend.
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { text: "Reference Audio (original):" },
          {
            inlineData: {
              mimeType: referenceBlob.type || "audio/webm",
              data: refBase64,
            },
          },
          { text: "Suspect Audio (modulated):" },
          {
            inlineData: {
              mimeType: suspectBlob.type || "audio/webm",
              data: susBase64,
            },
          },
          { text: "Return only valid JSON with the keys described in the system instruction." },
        ],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchProbability: { type: Type.NUMBER },
            reasoning: { type: Type.STRING },
            voiceCharacteristics: { type: Type.ARRAY, items: { type: Type.STRING } },
            detectedModulationType: { type: Type.STRING },
            originalIdentityDetected: { type: Type.BOOLEAN },
          },
          required: ["matchProbability", "reasoning", "voiceCharacteristics", "originalIdentityDetected"],
        },
      },
    });

    let text = response && response.text;
    if (!text) throw new Error("No response text from GenAI");
    text = text.replace(/```json|```/g, "").trim();
    return JSON.parse(text);
  } catch (err) {
    console.error("[VoiceAnalyzer] analyzeVoiceMatch error:", err);
    // graceful fallback if the remote call fails
    return {
      matchProbability: 0,
      reasoning: `Analysis failed: ${err.message || "unknown error"}`,
      voiceCharacteristics: [],
      detectedModulationType: null,
      originalIdentityDetected: false,
    };
  }
};

/* --- Audio visualizer component --- */
const AudioVisualizer = ({ stream, isActive, color }) => {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyzerRef = useRef(null);
  const sourceRef = useRef(null);
  const animationRef = useRef(0);

  useEffect(() => {
    if (!stream || !isActive || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioContextRef.current = audioCtx;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyzerRef.current = analyser;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    sourceRef.current = source;

    const bufferLength = analyser.frequencyBinCount;
    const data = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);
      ctx.fillStyle = "rgba(10,10,12,0.2)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const h = data[i] / 2;
        ctx.fillStyle = color || "#3b82f6";
        ctx.fillRect(x, canvas.height - h * 2, barWidth, h * 2);
        x += barWidth + 1;
      }
    };

    draw();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (sourceRef.current) sourceRef.current.disconnect();
      if (analyzerRef.current) analyzerRef.current.disconnect();
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [stream, isActive, color]);

  return <canvas ref={canvasRef} width={600} height={150} className="va-visualizer" />;
};

/* --- Security terminal component (shows analysis logs and results) --- */
const SecurityTerminal = ({ result, isAnalyzing, onReset }) => {
  const [logs, setLogs] = useState([]);
  const [copied, setCopied] = useState(false);
  const [readyToSend, setReadyToSend] = useState(false);

  useEffect(() => {
    if (isAnalyzing) {
      setLogs([]);
      const steps = [
        "Initializing Audio Core...",
        "Unmasking modulation layers...",
        "Isolating vocal cords freq...",
        "Matching biometrics...",
        "VERIFYING IDENTITY...",
      ];
      let i = 0;
      const t = setInterval(() => {
        if (i < steps.length) {
          setLogs((p) => [...p, `> ${steps[i]} [OK]`]);
          i++;
        } else {
          clearInterval(t);
        }
      }, 140);
      return () => clearInterval(t);
    }
  }, [isAnalyzing]);

  useEffect(() => {
    if (result && result.originalIdentityDetected && result.matchProbability > 60) {
      setReadyToSend(false);
      const timer = setTimeout(() => setReadyToSend(true), 800);
      return () => clearTimeout(timer);
    } else {
      setReadyToSend(false);
    }
  }, [result]);

  const handleCopy = () => {
    if (!result) return;
    const rpt = `VOICE MATCH REPORT\nConfidence: ${result.matchProbability}%\nReasoning: ${result.reasoning}`;
    navigator.clipboard.writeText(rpt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isAnalyzing) {
    return (
      <div className="va-terminal va-analyzing">
        <div className="va-terminal-inner">
          <div className="va-terminal-header">
            <span>STATUS: DECRYPTING SIGNAL...</span>
            <span>SYSTEM: FAST_TRACK</span>
          </div>
          <div className="va-logs">
            {logs.map((l, idx) => (
              <div key={idx} className="va-log">{l}</div>
            ))}
            <div className="va-loader">_</div>
          </div>
        </div>
      </div>
    );
  }

  if (result) {
    const isMatch = result.originalIdentityDetected && result.matchProbability > 60;
    return (
      <div className={`va-terminal ${isMatch ? "va-match" : "va-mismatch"}`}>
        <div className="va-terminal-inner padded">
          <div className="va-terminal-title">
            <div className={`va-title-text ${isMatch ? "va-danger" : ""}`}>
              {isMatch ? "!!! IDENTITY CONFIRMED !!!" : "IDENTITY MISMATCH"}
            </div>
            <div className="va-confidence">CONFIDENCE: {result.matchProbability}%</div>
          </div>

          <div className="va-grid">
            <div className="va-column">
              <div className="va-card">
                <h3 className="va-card-title">Forensic Report</h3>
                <p className="va-card-body">{result.reasoning}</p>
              </div>

              <div className="va-card">
                <h3 className="va-card-title">Vocal Identifiers</h3>
                <div className="va-tags">
                  {result.voiceCharacteristics && result.voiceCharacteristics.length
                    ? result.voiceCharacteristics.map((c, i) => <span key={i} className="va-tag">{c}</span>)
                    : <div style={{ color: "#888" }}>— none listed —</div>
                  }
                </div>
              </div>
            </div>

            <div className="va-column">
              <div className="va-card">
                <h3 className="va-card-title">Modulation Bypass</h3>
                <p className="va-modtype">{result.detectedModulationType || "None detected"}</p>
              </div>

              {isMatch && (
                <div className="va-alert-card">
                  <h4 className="va-alert-title"><ShieldAlert className="va-icon" /> Security Protocol</h4>
                  {readyToSend ? (
                    <div className="va-ready">
                      <div className="va-ready-item">[✓] REPORT READY</div>
                      <div className="va-ready-item">Manual dispatch required</div>
                    </div>
                  ) : (
                    <div className="va-prep">Preparing Forensic Packet...</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="va-actions">
            <button onClick={onReset} className="va-btn va-btn-muted">RESET TERMINAL</button>

            {isMatch && (
              <div className="va-action-group">
                <button onClick={handleCopy} className="va-btn va-btn-icon" title="Copy Report">
                  {copied ? <Check /> : <Copy />} 
                </button>
                {/* Email option removed as requested */}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

/* --- Main component --- */
const VoiceAnalyzer = () => {
  const [appState, setAppState] = useState(AppState.IDLE);
  const [referenceAudio, setReferenceAudio] = useState(null);
  const [suspectAudio, setSuspectAudio] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [stream, setStream] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  const startRecording = async (targetState) => {
    setErrorMsg(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(audioStream);

      const mediaRecorder = new MediaRecorder(audioStream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mimeType });

        if (targetState === AppState.RECORDING_REFERENCE) {
          setReferenceAudio(blob);
          setAppState(AppState.REFERENCE_STORED);
        } else if (targetState === AppState.RECORDING_SUSPECT) {
          setSuspectAudio(blob);
          await handleAnalyze(blob);
        }

        // cleanup
        try {
          audioStream.getTracks().forEach((t) => t.stop());
        } catch (e) {}
        setStream(null);
      };

      mediaRecorder.start();
      setAppState(targetState);

      // auto-stop after 60s
      timeoutRef.current = setTimeout(() => {
        if (mediaRecorder.state === "recording") mediaRecorder.stop();
      }, 60000);
    } catch (err) {
      console.error("Mic Error:", err);
      setErrorMsg("Microphone access denied or not available.");
    }
  };

  const stopRecording = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleAnalyze = async (suspectBlob) => {
    if (!referenceAudio) {
      setErrorMsg("Reference audio missing — record the original voice first.");
      return;
    }
    setAppState(AppState.ANALYZING);
    setAnalysisResult(null);
    try {
      const result = await analyzeVoiceMatch(referenceAudio, suspectBlob);
      setAnalysisResult(result);
      if (result.originalIdentityDetected) setAppState(AppState.RESULT_MATCH);
      else setAppState(AppState.RESULT_NO_MATCH);
    } catch (err) {
      console.error("Analysis error:", err);
      setErrorMsg("Analysis failed. See console for details.");
      setAppState(AppState.REFERENCE_STORED);
    }
  };

  const resetAll = () => {
    setAppState(AppState.IDLE);
    setReferenceAudio(null);
    setSuspectAudio(null);
    setAnalysisResult(null);
    setErrorMsg(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  return (
    <div className="va-root">
      <header className="va-header">
        <div className="va-header-inner">
          <div className="va-brand">
            <Fingerprint className="va-brand-icon" />
            <h1 className="va-title">VOICE_HEIST_DECRYPTOR</h1>
          </div>
          <div className="va-secure-badge">SYS_SECURE_MODE</div>
        </div>
      </header>

      <main className="va-main">
        <div className="va-container">
          {errorMsg && (
            <div className="va-error">
              <AlertTriangle /> <span style={{ marginLeft: 8 }}>{errorMsg}</span>
            </div>
          )}

          {appState === AppState.IDLE && (
            <div className="va-centered-card">
              <div className="va-card-inner">
                <div className="va-lock-circle"><Lock /></div>
                <h2 className="va-h2">Step 1: Secure the Original Voice</h2>
                <p className="va-desc">Record the original voice to create a reference voiceprint.</p>
                <button onClick={() => startRecording(AppState.RECORDING_REFERENCE)} className="va-btn va-btn-record">
                  <Mic className="va-icon-small" /> Record Original Voice
                </button>
              </div>
            </div>
          )}

          {appState === AppState.RECORDING_REFERENCE && (
            <div className="va-centered-card">
              <h2 className="va-h2 va-pulse">RECORDING REFERENCE...</h2>
              <AudioVisualizer stream={stream} isActive={true} color="#3b82f6" />
              <div className="va-controls">
                <button onClick={stopRecording} className="va-btn va-btn-stop">Stop & Save</button>
                <span className="va-muted">Max duration: 60s</span>
              </div>
            </div>
          )}

          {appState === AppState.REFERENCE_STORED && (
            <div className="va-centered-card">
              <div className="va-card-inner locked">
                <Fingerprint className="va-big-fingerprint" />
                <div className="va-locked-line">
                  <div className="va-lock-dot" /> <span className="va-mono">REFERENCE VOICEPRINT LOCKED</span>
                </div>

                <h2 className="va-h2">Step 2: Capture Suspect Audio</h2>
                <p className="va-desc">Record the suspect's (possibly modulated) voice to analyze against the reference.</p>

                <div className="va-actions-row">
                  <button onClick={() => startRecording(AppState.RECORDING_SUSPECT)} className="va-btn va-btn-green">
                    <AlertTriangle className="va-icon-small" /> Record Modulated Voice
                  </button>

                  <button onClick={resetAll} className="va-link">
                    <RotateCcw className="va-icon-small" /> Reset
                  </button>
                </div>
              </div>
            </div>
          )}

          {appState === AppState.RECORDING_SUSPECT && (
            <div className="va-centered-card">
              <h2 className="va-h2 va-pulse danger">CAPTURING SUSPECT SIGNAL...</h2>
              <AudioVisualizer stream={stream} isActive={true} color="#ef4444" />
              <div className="va-controls">
                <button onClick={stopRecording} className="va-btn va-btn-analyze">Analyze Signal</button>
                <span className="va-muted">Max duration: 60s</span>
              </div>
            </div>
          )}

          {(appState === AppState.ANALYZING || appState === AppState.RESULT_MATCH || appState === AppState.RESULT_NO_MATCH) && (
            <div className="va-results">
              <SecurityTerminal isAnalyzing={appState === AppState.ANALYZING} result={analysisResult} onReset={resetAll} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default VoiceAnalyzer;
