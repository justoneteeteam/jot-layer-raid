"use client";

import React, { useState } from "react";
import { useAuth } from "../components/AuthProvider";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page" style={{
      background: "radial-gradient(circle at top right, rgba(13, 148, 136, 0.08) 0%, transparent 60%), radial-gradient(circle at bottom left, rgba(13, 148, 136, 0.04) 0%, transparent 50%), var(--bg-secondary)"
    }}>
      <div className="login-card" style={{
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(13, 148, 136, 0.15)",
        animation: "slideUp 0.4s ease-out"
      }}>
        {/* Style injection for quick keyframes animation */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2.5px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 0.8s linear infinite;
            margin-right: 8px;
          }
        `}} />

        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "60px",
            height: "60px",
            background: "var(--accent-light)",
            color: "var(--accent)",
            borderRadius: "16px",
            fontSize: "32px",
            marginBottom: "16px",
            boxShadow: "0 4px 12px rgba(13, 148, 136, 0.2)"
          }}>
            🎽
          </div>
          <h1 className="login-title" style={{ color: "var(--text-primary)" }}>JOTLayerRaid</h1>
          <p className="login-subtitle">Jersey Mockup Bulk Publishing System</p>
        </div>

        {error && (
          <div style={{
            background: "#FEE2E2",
            border: "1px solid rgba(220, 38, 38, 0.2)",
            color: "var(--error)",
            borderRadius: "8px",
            padding: "12px",
            fontSize: "13px",
            fontWeight: 500,
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <span>⚠️</span>
            <div style={{ flex: 1 }}>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="contact@wairaiders.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%" }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label className="form-label" htmlFor="password" style={{ margin: 0 }}>Password</label>
            </div>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: "100%" }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
            style={{
              width: "100%",
              height: "44px",
              fontSize: "14px",
              fontWeight: 600,
              letterSpacing: "0.02em",
              boxShadow: "0 4px 12px rgba(13, 148, 136, 0.25)"
            }}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div style={{ marginTop: "24px", textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
          Authorized personnel only. Logs monitored.
        </div>
      </div>
    </div>
  );
}
