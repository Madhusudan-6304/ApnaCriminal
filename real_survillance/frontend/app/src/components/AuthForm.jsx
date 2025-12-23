// src/components/AuthForm.jsx
import React, { useState } from "react";
import client, { setAuthToken } from "../api/client";

export default function AuthForm({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignIn(e) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Enter your username/phone and password");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("username", username.trim());
      form.append("password", password);
      if (email.trim()) {
        form.append("email", email.trim());
      }
      if (phone.trim()) {
        form.append("phone", phone.trim());
      }
      const res = await client.post("/api/auth/login", form);
      const token = res.data?.token;
      if (!token) throw new Error("No token returned");
      localStorage.setItem("token", token);
      localStorage.setItem("user_phone", res.data?.phone || phone || username || "");
      localStorage.setItem("user_email", res.data?.email || email || "");
      setAuthToken(token);
      if (typeof onLogin === "function") onLogin(token, res.data?.phone || phone || username || "");
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-root">
      <div className="auth-container">
        <div className="auth-logo">
          <img src="/logo.png" alt="Apna Criminal" className="auth-logo-img" />
        </div>
        
        <div className="auth-card">
          <h1 className="auth-title">Sign in</h1>
          <form onSubmit={handleSignIn} className="auth-form">
            {error && <div className="auth-error">{error}</div>}
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-username">Username / Phone number</label>
              <input
                id="auth-username"
                className="auth-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="Enter your username or phone"
                autoFocus
              />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-email">Email (optional - for alerts)</label>
              <input
                id="auth-email"
                className="auth-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="your.email@example.com"
              />
              <div className="auth-hint">We'll send email alerts to this address when criminals are detected</div>
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-phone">Phone number (optional - for SMS alerts)</label>
              <input
                id="auth-phone"
                className="auth-input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                placeholder="+1234567890"
              />
              <div className="auth-hint">We'll send SMS alerts to this number when criminals are detected</div>
            </div>
            <div className="auth-field">
              <div className="auth-label-row">
                <label className="auth-label" htmlFor="auth-password">Password</label>
                <a href="#" className="auth-link" onClick={(e) => { 
                  e.preventDefault(); 
                  alert("Please contact administrator for password reset."); 
                }}>
                  Forgot your password?
                </a>
              </div>
              <input
                id="auth-password"
                className="auth-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
              />
            </div>
            <button type="submit" disabled={loading} className="auth-submit btn-amazon">
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
          
          <div className="auth-footer">
            <div className="auth-footer-links">
              <a href="#" className="auth-link" onClick={(e) => e.preventDefault()}>Conditions of Use</a>
              <span className="auth-footer-separator">|</span>
              <a href="#" className="auth-link" onClick={(e) => e.preventDefault()}>Privacy Notice</a>
              <span className="auth-footer-separator">|</span>
              <a href="#" className="auth-link" onClick={(e) => e.preventDefault()}>Help</a>
            </div>
            <div className="auth-footer-copyright">
              © 2024, Apna Criminal, Inc. or its affiliates
            </div>
          </div>
        </div>
      </div>
      <style jsx="true">{`
        .auth-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f3f4f6;
          padding: 20px;
        }
        .auth-container {
          width: 100%;
          max-width: 400px;
        }
        .auth-logo {
          text-align: center;
          margin-bottom: 24px;
        }
        .auth-logo-img {
          max-width: 200px;
          height: auto;
        }
        .auth-card {
          background: white;
          padding: 24px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .auth-title {
          font-size: 24px;
          font-weight: 500;
          margin-bottom: 24px;
          text-align: center;
          color: #111;
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 24px;
        }
        .auth-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .auth-label {
          font-size: 13px;
          font-weight: 500;
          color: #111;
        }
        .auth-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .auth-input {
          padding: 10px 12px;
          border: 1px solid #a6a6a6;
          border-radius: 4px;
          font-size: 15px;
          transition: border-color 0.2s;
          width: 100%;
          box-sizing: border-box;
        }
        .auth-input:focus {
          outline: none;
          border-color: #e77600;
          box-shadow: 0 0 3px 2px rgba(228, 121, 17, 0.3);
        }
        .auth-submit {
          background: linear-gradient(to bottom, #f7dfa5, #f0c14b);
          border: 1px solid #a88734;
          border-radius: 4px;
          padding: 10px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          margin-top: 10px;
          width: 100%;
        }
        .auth-submit:hover {
          background: linear-gradient(to bottom, #f5d78e, #eeb933);
        }
        .auth-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .auth-link {
          color: #0066c0;
          text-decoration: none;
          font-size: 13px;
        }
        .auth-link:hover {
          text-decoration: underline;
          color: #c45500;
        }
        .auth-error {
          color: #b12704;
          font-size: 14px;
          margin-bottom: 8px;
          padding: 8px;
          background-color: #fff4f4;
          border: 1px solid #ffcdd2;
          border-radius: 4px;
        }
        .auth-hint {
          font-size: 12px;
          color: #666;
          margin-top: 4px;
        }
        .auth-footer {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e7e7e7;
          font-size: 12px;
          color: #555;
          text-align: center;
        }
        .auth-footer-links {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-bottom: 8px;
        }
        .auth-footer-separator {
          color: #ddd;
        }
        .auth-footer-copyright {
          color: #767676;
        }
      `}</style>
    </div>
  );
}
