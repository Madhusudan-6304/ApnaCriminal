// src/QuizTest.jsx
import React, { useState, useEffect } from "react";
import "./mastermind.css";
import {
  Fingerprint,
  ShieldAlert,
  BrainCircuit,
  ChevronRight,
  Activity,
  RotateCcw,
  User,
  Terminal,
  Shield,
  Share2,
} from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

/* ---------- Constants (skill types and extended questions) ---------- */

const SkillType = {
  STRATEGY: "Strategy",
  STEALTH: "Stealth",
  SOCIAL: "Social Engineering",
  TECH: "Digital Forensics",
};

const QUESTIONS = [
  // 1
  {
    id: 1,
    scenario: "Live Camera",
    text: "You're starting a live-camera feed for 24/7 surveillance. Which practice is best?",
    options: [
      { id: "A", text: "Start without throttling frames — send every frame to server.", primarySkill: SkillType.TECH },
      { id: "B", text: "Throttle capture rate, resize frames client-side, and dedupe matches before alerts.", primarySkill: SkillType.TECH },
      { id: "C", text: "Stream raw high-resolution frames and rely on server to drop frames.", primarySkill: SkillType.STRATEGY },
      { id: "D", text: "Only turn on live camera when user manually clicks 'start' and keep it idle otherwise.", primarySkill: SkillType.SOCIAL },
    ],
  },
  // 2
  {
    id: 2,
    scenario: "Video Detection",
    text: "You upload a long video to `/api/detect/video` which streams frames back. What is a good client-side behavior?",
    options: [
      { id: "A", text: "Start reading the streamed SSE/NDJSON and visualise frames while deduping matches.", primarySkill: SkillType.TECH },
      { id: "B", text: "Upload and wait for the whole video to be processed server-side before any UI updates.", primarySkill: SkillType.STRATEGY },
      { id: "C", text: "Break the video into tiny clips and call the API for each with no dedup logic.", primarySkill: SkillType.TECH },
      { id: "D", text: "Convert video to images and do face-detection only on first and last frames.", primarySkill: SkillType.STEALTH },
    ],
  },
  // 3
  {
    id: 3,
    scenario: "Registration Quality",
    text: "When registering a new criminal, what's most important for image uploads?",
    options: [
      { id: "A", text: "High-resolution, multiple angles, good lighting, and at least 5-10 images per person.", primarySkill: SkillType.STRATEGY },
      { id: "B", text: "Just one picture is fine if it's frontal — saves storage.", primarySkill: SkillType.TECH },
      { id: "C", text: "Use artistic sketches only — they look cooler.", primarySkill: SkillType.SOCIAL },
      { id: "D", text: "Collect only passport-style photos to avoid bias.", primarySkill: SkillType.STEALTH },
    ],
  },
  // 4
  {
    id: 4,
    scenario: "Sketch Matching",
    text: "A sketch provided by a witness arrives. How should it be processed?",
    options: [
      { id: "A", text: "Send sketch directly to model without preprocessing.", primarySkill: SkillType.TECH },
      { id: "B", text: "Run sketch through alignment and enhancement; send both sketch and possible face composites.", primarySkill: SkillType.TECH },
      { id: "C", text: "Ignore sketches — they are too subjective.", primarySkill: SkillType.SOCIAL },
      { id: "D", text: "Use sketch only as a secondary hint after candidate filtering.", primarySkill: SkillType.STRATEGY },
    ],
  },
  // 5
  {
    id: 5,
    scenario: "Voice Analysis",
    text: "You have a reference voice and a modulated suspect voice. Which is correct?",
    options: [
      { id: "A", text: "Compare raw audio waveforms only; modulation will always break matching.", primarySkill: SkillType.TECH },
      { id: "B", text: "Extract biometric features (cadence, breath patterns) and use robust model to bypass simple modulators.", primarySkill: SkillType.TECH },
      { id: "C", text: "Trust human ear only — automated matching is unreliable.", primarySkill: SkillType.SOCIAL },
      { id: "D", text: "Ask suspect to speak the same phrase and do direct fingerprint-like matching.", primarySkill: SkillType.STEALTH },
    ],
  },
  // 6
  {
    id: 6,
    scenario: "API Keys & Security",
    text: "Where should GenAI API keys be stored for production usage?",
    options: [
      { id: "A", text: "Hardcode in client-side JS for convenience.", primarySkill: SkillType.TECH },
      { id: "B", text: "Store in server-side env vars and proxy requests through backend.", primarySkill: SkillType.TECH },
      { id: "C", text: "Put them in a public GitHub repo but obfuscate with base64.", primarySkill: SkillType.STRATEGY },
      { id: "D", text: "Ask users to paste their keys into the UI and store them locally.", primarySkill: SkillType.SOCIAL },
    ],
  },
  // 7
  {
    id: 7,
    scenario: "Alerts & Human-in-loop",
    text: "Your model generated a high-confidence match. What's the safe operational policy?",
    options: [
      { id: "A", text: "Auto-dispatch law enforcement immediately without human review.", primarySkill: SkillType.STRATEGY },
      { id: "B", text: "Queue alert for human verification and attach supporting evidence.", primarySkill: SkillType.SOCIAL },
      { id: "C", text: "Discard low evidence matches and only notify on very high-thresholds.", primarySkill: SkillType.TECH },
      { id: "D", text: "Publicly post suspected identity on social media to crowdsource verification.", primarySkill: SkillType.SOCIAL },
    ],
  },
  // 8
  {
    id: 8,
    scenario: "False Positives",
    text: "False positives are happening frequently. Which action helps most?",
    options: [
      { id: "A", text: "Lower the detection threshold to get fewer misses.", primarySkill: SkillType.TECH },
      { id: "B", text: "Introduce human review for mid-range scores and retrain model with labeled FP examples.", primarySkill: SkillType.TECH },
      { id: "C", text: "Ignore them — they will average out.", primarySkill: SkillType.STRATEGY },
      { id: "D", text: "Prohibit alerts at night to reduce reporting.", primarySkill: SkillType.STEALTH },
    ],
  },
  // 9
  {
    id: 9,
    scenario: "Privacy & Retention",
    text: "How long should raw surveillance images & audio be retained under best practice?",
    options: [
      { id: "A", text: "Indefinitely — keep everything for possible future use.", primarySkill: SkillType.STRATEGY },
      { id: "B", text: "Keep minimal retention (e.g., 30–90 days) and store hashed identifiers; require justification for longer retention.", primarySkill: SkillType.TECH },
      { id: "C", text: "Delete immediately after every detection regardless of investigation.", primarySkill: SkillType.SOCIAL },
      { id: "D", text: "Store locally without encryption to speed up access.", primarySkill: SkillType.TECH },
    ],
  },
  // 10
  {
    id: 10,
    scenario: "Registration UX",
    text: "An operator is registering many people at once. Best practice?",
    options: [
      { id: "A", text: "Batch-upload images with validation & automatic quality checks to block poor images.", primarySkill: SkillType.TECH },
      { id: "B", text: "Allow any image and rely on model to generalize.", primarySkill: SkillType.STRATEGY },
      { id: "C", text: "Require precise studio photos only — slows process.", primarySkill: SkillType.STEALTH },
      { id: "D", text: "Use only webcam captures to speed throughput.", primarySkill: SkillType.SOCIAL },
    ],
  },
  // 11
  {
    id: 11,
    scenario: "Email & Alerts",
    text: "You want rapid notification to the response team. Which client-side approach is recommended?",
    options: [
      { id: "A", text: "Use mailto links triggered from client — relies on user email client.", primarySkill: SkillType.SOCIAL },
      { id: "B", text: "Send server-side notifications (SMS / Pushover / Email) via authenticated backend with throttling.", primarySkill: SkillType.TECH },
      { id: "C", text: "Show in-app toasts only; avoid external notifications.", primarySkill: SkillType.STRATEGY },
      { id: "D", text: "Spam entire contact list for any alert to ensure someone sees it.", primarySkill: SkillType.SOCIAL },
    ],
  },
  // 12
  {
    id: 12,
    scenario: "Model Updates",
    text: "How often should you retrain embeddings and refresh the model when the database changes?",
    options: [
      { id: "A", text: "Never — embeddings are eternal once created.", primarySkill: SkillType.TECH },
      { id: "B", text: "Periodically: e.g., weekly/monthly depending on ingestion rate; re-index when many new identities added.", primarySkill: SkillType.TECH },
      { id: "C", text: "Retrain per-request to always have fresh embeddings (expensive).", primarySkill: SkillType.STRATEGY },
      { id: "D", text: "Only retrain when system fails a human audit.", primarySkill: SkillType.SOCIAL },
    ],
  },
];

/* Best answers mapping and recommended fixes (for offline grading) */
const BEST_ANSWERS = {
  1: ["B"],
  2: ["A"],
  3: ["A"],
  4: ["B", "D"], // B preferred, D acceptable
  5: ["B"],
  6: ["B"],
  7: ["B"],
  8: ["B"],
  9: ["B"],
  10: ["A"],
  11: ["B"],
  12: ["B"],
};

const RECOMMENDATION_MAP = {
  1: "Throttle frames client-side and dedupe matches (reduce bandwidth/cost and lower false positives).",
  2: "Stream and process frames incrementally to display results as they arrive and deduplicate repeated matches.",
  3: "Collect multiple images per person across angles/lighting — automated quality-checking helps model accuracy.",
  4: "Preprocess sketches with alignment/enhancement and use them as auxiliary inputs rather than raw input.",
  5: "Use biometric features (cadence, micro-pauses) and robust matching to bypass simple modulators.",
  6: "Keep API keys server-side; proxy GenAI calls through backend env-vars to avoid leaking secrets.",
  7: "Always include human review for actionable alerts and attach supporting evidence to the alert packet.",
  8: "Add human-in-loop verification for mid-scores and retrain using labeled false positive examples.",
  9: "Adopt limited retention (e.g., 30–90 days), anonymize/hash identifiers, and require justification to retain longer.",
  10: "Validate uploads in bulk with automatic quality checks and reject poor images before registration.",
  11: "Send authenticated server-side notifications with throttling rather than relying on client mailto links.",
  12: "Retrain or re-index periodically (weekly/monthly) or when a significant number of new identities are added.",
};

/* ---------- Gemini analysis function (lazy, fallback to deterministic) ---------- */

const analyzeProfile = async (answers) => {
  // Use Vite env var (create .env with VITE_GENAI_KEY=your_key if you want to use Gemini)
  const apiKey = import.meta.env.VITE_GENAI_KEY;

  // Build prompt data (array of chosen options)
  const promptData = QUESTIONS.map((q) => {
    const sel = q.options.find((o) => o.id === answers[q.id]);
    return {
      id: q.id,
      scenario: q.scenario,
      selectedOption: sel ? sel.text : "No answer",
      selectedId: sel ? sel.id : null,
      skill: sel ? sel.primarySkill : null,
    };
  });

  // If no API key, return a deterministic offline analysis so UI works in dev:
  if (!apiKey) {
    // Scoring against BEST_ANSWERS
    const total = QUESTIONS.length;
    let correct = 0;
    const counts = { Strategy: 0, Stealth: 0, "Social Engineering": 0, "Digital Forensics": 0 };
    const missed = [];

    QUESTIONS.forEach((q) => {
      const ans = answers[q.id];
      if (ans) {
        // skill tally
        const sel = q.options.find((o) => o.id === ans);
        if (sel) counts[sel.primarySkill] = (counts[sel.primarySkill] || 0) + 1;
      }
      const best = BEST_ANSWERS[q.id] || [];
      if (ans && best.includes(ans)) {
        correct++;
      } else {
        missed.push({
          id: q.id,
          scenario: q.scenario,
          chosen: ans || "None",
          recommended: RECOMMENDATION_MAP[q.id] || "Review best practices.",
        });
      }
    });

    const overallScore = Math.round((correct / total) * 100);
    // Turn counts into 0-100 per-skill score (normalize by total)
    const scores = {
      strategy: Math.round(((counts.Strategy || 0) / total) * 100),
      stealth: Math.round(((counts.Stealth || 0) / total) * 100),
      social: Math.round(((counts["Social Engineering"] || 0) / total) * 100),
      tech: Math.round(((counts["Digital Forensics"] || 0) / total) * 100),
    };

    // Build recommendations from missed
    const recommendations = missed.slice(0, 6).map((m) => `Q${m.id}: ${m.recommended}`);

    // Identify common weakness
    const weakestSkill = Object.entries(scores).sort((a, b) => a[1] - b[1])[0][0];

    return {
      archetype: overallScore > 80 ? "Operational Pro" : overallScore > 50 ? "Field Operative" : "Trainee",
      description:
        overallScore > 80
          ? "Strong grasp of surveillance best-practices, security and operational hygiene."
          : overallScore > 50
            ? "Decent understanding but needs improvements on select technical and process areas."
            : "You should review system best-practices and retrain on core procedures.",
      scores,
      overallScore,
      recommendations: recommendations.length ? recommendations : ["Good job — keep practicing."],
      mistakes: missed,
      weakestSkill,
      famousEquivalent: overallScore > 80 ? "James Bond (fictional)" : overallScore > 50 ? "Adept Operative" : "Rookie",
    };
  }

  // If there is an API key, call GenAI (lazy import to avoid bundling)
  try {
    const { GoogleGenAI, Type } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      You are a security analyst. Given the user's answers to the following surveillance-system quiz, return a JSON with:
      - archetype (string)
      - description (string)
      - scores {strategy, stealth, social, tech} (0-100)
      - overallScore (0-100)
      - recommendations (array of short strings)
      - mistakes (array of {id, scenario, chosen, recommendedFix})
    User Data: ${JSON.stringify(promptData)}
    Use concise, actionable recommendations.
    Return only JSON.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert security analyst producing a short JSON report.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            archetype: { type: Type.STRING },
            description: { type: Type.STRING },
            scores: {
              type: Type.OBJECT,
              properties: {
                strategy: { type: Type.NUMBER },
                stealth: { type: Type.NUMBER },
                social: { type: Type.NUMBER },
                tech: { type: Type.NUMBER },
              },
            },
            overallScore: { type: Type.NUMBER },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            mistakes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.NUMBER },
                  scenario: { type: Type.STRING },
                  chosen: { type: Type.STRING },
                  recommendedFix: { type: Type.STRING },
                },
              },
            },
            famousEquivalent: { type: Type.STRING },
          },
          required: ["archetype", "description", "scores", "overallScore", "recommendations", "mistakes"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text);
  } catch (err) {
    console.error("GenAI analyzeProfile failed:", err);
    // fallback if remote call fails
    return {
      archetype: "Unknown",
      description: "Remote analysis failed — show offline evaluation instead.",
      scores: { strategy: 50, stealth: 50, social: 50, tech: 50 },
      overallScore: 50,
      recommendations: ["Check API key or network; using local fallback results."],
      mistakes: [],
      famousEquivalent: "John Doe",
    };
  }
};

/* ---------- Subcomponents (Start, Quiz, Results) ---------- */

const StartView = ({ onStart }) => (
  <div className="start-container animate-fade-in">
    <div className="start-fingerprint-wrapper">
      <div className="start-fingerprint-glow" />
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Fingerprint size={96} className="neon-red" />
      </div>
    </div>

    <h1 className="start-title">Mastermind<br />Assessment</h1>

    <p className="start-desc">
      This assessment is tuned to the Apna Criminal surveillance stack — it tests
      technical choices, operational safety, and privacy practices used in the app.
    </p>

    <div className="features-grid" aria-hidden>
      <div className="feature-box">
        <div style={{ textAlign: "center" }}><BrainCircuit size={22} className="neon-cyan" /></div>
        <h3 className="feature-title">Operational Safety</h3>
        <p className="feature-desc">Understand human-in-loop and alert policies.</p>
      </div>

      <div className="feature-box">
        <div style={{ textAlign: "center" }}><ShieldAlert size={22} className="neon-red" /></div>
        <h3 className="feature-title">Technical Hygiene</h3>
        <p className="feature-desc">Learn where to keep secrets and how to avoid false positives.</p>
      </div>

      <div className="feature-box">
        <div style={{ textAlign: "center" }}><Fingerprint size={22} className="neon-cyan" /></div>
        <h3 className="feature-title">Forensic Procedures</h3>
        <p className="feature-desc">Capture quality data and keep evidence trails.</p>
      </div>
    </div>

    <button className="btn-big" onClick={onStart}>
      <span style={{ position: "relative", zIndex: 2 }}>Initialize Test</span>
      <div className="btn-glow-fill" />
    </button>

    <p style={{ marginTop: 20, fontSize: 12, color: "#888", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1 }}>
      System Status: Online // Simulation Mode OK
    </p>
  </div>
);

const QuizView = ({ onComplete }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selectedOption, setSelectedOption] = useState(null);

  const currentQuestion = QUESTIONS[currentIdx];
  const progress = ((currentIdx + 1) / QUESTIONS.length) * 100;

  const handleSelect = (optionId) => {
    setSelectedOption(optionId);
  };

  const handleNext = () => {
    if (!selectedOption) return;
    const newAnswers = { ...answers, [currentQuestion.id]: selectedOption };
    setAnswers(newAnswers);
    setSelectedOption(null);
    if (currentIdx < QUESTIONS.length - 1) {
      setCurrentIdx((p) => p + 1);
    } else {
      onComplete(newAnswers);
    }
  };

  return (
    <div className="quiz-container animate-fade-in">
      <div className="progress-bar" aria-hidden>
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ fontFamily: "monospace", color: "#00f3ff" }}>
          QUESTION {currentIdx + 1} / {QUESTIONS.length}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#888", fontFamily: "monospace" }}>
          <Activity size={14} className="pulse-slow" />
          RECORDING
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div className="question-scenario">Scenario: {currentQuestion.scenario}</div>
        <div className="question-title">{currentQuestion.text}</div>
      </div>

      <div>
        {currentQuestion.options.map((option) => {
          const active = selectedOption === option.id;
          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              className={`option-button ${active ? "active" : ""}`}
              type="button"
            >
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span className="option-label">{option.id}</span>
                <div style={{ fontSize: 16 }}>{option.text}</div>
              </div>
              {active && (
                <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 10, height: 10, borderRadius: 10, background: "#00f3ff", boxShadow: "0 0 10px #00f3ff" }} />
              )}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleNext}
          disabled={!selectedOption}
          className={`next-btn ${!selectedOption ? "disabled" : ""}`}
        >
          {currentIdx === QUESTIONS.length - 1 ? "Finalize" : "Next Protocol"} <ChevronRight size={16} style={{ marginLeft: 8 }} />
        </button>
      </div>
    </div>
  );
};

const ResultsView = ({ answers, onRestart }) => {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const result = await analyzeProfile(answers);
      setAnalysis(result);
      setLoading(false);
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", background: "#000", color: "#fff", fontFamily: "monospace" }}>
        <div style={{ width: 260, height: 6, background: "#222", marginBottom: 12 }}>
          <div style={{ width: "100%", height: "100%", background: "#ff0033", animation: "pulseSlow 2.8s infinite" }} />
        </div>
        <p style={{ color: "#ff0033", fontFamily: "monospace", marginBottom: 6 }}>ANALYZING BEHAVIORAL PATTERNS...</p>
        <p style={{ color: "#777", fontSize: 12 }}>ASSESSING SURVEILLANCE PRACTICES</p>
      </div>
    );
  }

  if (!analysis) return null;

  const radarData = [
    { subject: "Strategy", A: analysis.scores.strategy, fullMark: 100 },
    { subject: "Stealth", A: analysis.scores.stealth, fullMark: 100 },
    { subject: "Social", A: analysis.scores.social, fullMark: 100 },
    { subject: "Forensics", A: analysis.scores.tech, fullMark: 100 },
  ];

  const barData = [
    { name: "Overall", value: analysis.overallScore },
    { name: "Strategy", value: analysis.scores.strategy },
    { name: "Stealth", value: analysis.scores.stealth },
    { name: "Social", value: analysis.scores.social },
    { name: "Forensics", value: analysis.scores.tech },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#ddd", padding: 24, fontFamily: "sans-serif" }}>
      <header className="results-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 28, margin: 0 }}>EVALUATION COMPLETE</h1>
          <p style={{ color: "#888", fontFamily: "monospace", fontSize: 12, marginTop: 6 }}>SUBJECT ID: ANONYMOUS // DATE: {new Date().toLocaleDateString()}</p>
        </div>

        <button onClick={onRestart} style={{ background: "transparent", border: "none", cursor: "pointer" }}>
          <RotateCcw size={18} color="#aaa" />
        </button>
      </header>

      <main style={{ maxWidth: 1100, margin: "18px auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="archetype-card" style={{ position: "relative", padding: 18, borderRadius: 12, background: "rgba(20,20,20,0.6)" }}>
            <div style={{ position: "absolute", right: 18, top: 18, opacity: 0.06 }}>
              <User size={140} color="#fff" />
            </div>

            <h2 style={{ color: "#00f3ff", textTransform: "uppercase", fontSize: 12, marginBottom: 8 }}>Designated Archetype</h2>
            <h3 style={{ color: "#fff", fontSize: 34, margin: "6px 0 12px" }}>{analysis.archetype}</h3>
            <p style={{ color: "#999", fontStyle: "italic", fontSize: 16, lineHeight: "1.4" }}>{analysis.description}</p>

            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #222" }}>
              <div style={{ color: "#888", fontSize: 12 }}>Overall Score</div>
              <div style={{ color: "#fff", fontSize: 28, fontWeight: 700 }}>{analysis.overallScore}%</div>
            </div>
          </div>

          <div style={{ background: "rgba(20,20,20,0.6)", border: "1px solid #222", padding: 18, borderRadius: 12 }}>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="#333" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Skill Level" dataKey="A" stroke="#00f3ff" strokeWidth={3} fill="#00f3ff" fillOpacity={0.2} />
                <Tooltip contentStyle={{ backgroundColor: "#111", borderColor: "#333", color: "#fff" }} itemStyle={{ color: "#00f3ff" }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ background: "rgba(20,20,20,0.6)", border: "1px solid #222", padding: 18, borderRadius: 12 }}>
            <h3 style={{ margin: 0, color: "#fff" }}>Score Breakdown</h3>
            <p style={{ color: "#888", marginTop: 6 }}>Overall and per-skill accuracy (higher is better)</p>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#111" />
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fill: "#9ca3af" }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#ff0033" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="recommend-box" style={{ background: "rgba(10,10,10,0.5)", border: "1px solid #222", padding: 18, borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <Terminal size={16} color="#ff0033" />
              <h3 style={{ margin: 0, fontSize: 18, color: "#fff" }}>Recommendations</h3>
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {analysis.recommendations.map((rec, idx) => (
                <li key={idx} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "#111", color: "#ff0033", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontWeight: 800 }}>
                    {`0${idx + 1}`}
                  </div>
                  <div style={{ color: "#ccc" }}>{rec}</div>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ background: "rgba(10,10,10,0.45)", border: "1px solid #222", padding: 14, borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Shield size={16} color="#4ade80" />
              <h4 style={{ margin: 0, fontSize: 16, color: "#fff" }}>Mistakes & Fixes</h4>
            </div>

            <div style={{ color: "#ccc", maxHeight: 160, overflow: "auto" }}>
              {analysis.mistakes && analysis.mistakes.length ? (
                analysis.mistakes.slice(0, 6).map((m, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ color: "#fff", fontWeight: 700 }}>Q{m.id}: {m.scenario}</div>
                    <div style={{ color: "#bbb", fontSize: 13 }}>You chose: {m.chosen}</div>
                    <div style={{ color: "#ffcc99", fontSize: 13, marginTop: 4 }}>Fix: {m.recommended || (RECOMMENDATION_MAP[m.id] || "Follow best practice.")}</div>
                  </div>
                ))
              ) : (
                <div style={{ color: "#888" }}>No major mistakes detected. Keep following best practices.</div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

/* ---------- Main container component ---------- */

const SkillTest = () => {
  const [quizState, setQuizState] = useState("START"); // 'START' | 'QUIZ' | 'RESULTS'
  const [userAnswers, setUserAnswers] = useState({});

  const startQuiz = () => {
    setQuizState("QUIZ");
    setUserAnswers({});
  };

  const finishQuiz = (answers) => {
    setUserAnswers(answers);
    setQuizState("RESULTS");
  };

  const restartQuiz = () => {
    setQuizState("START");
    setUserAnswers({});
  };

  return (
    <div style={{ background: "#000", color: "#ddd", minHeight: "100vh" }}>
      {quizState === "START" && <StartView onStart={startQuiz} />}
      {quizState === "QUIZ" && <QuizView onComplete={finishQuiz} />}
      {quizState === "RESULTS" && <ResultsView answers={userAnswers} onRestart={restartQuiz} />}
      {/* Ambient background element (purely decorative) */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: -1, opacity: 0.08, background: "radial-gradient(circle at center, #222, #000 40%, #000 100%)" }} />
    </div>
  );
};

export default SkillTest;
