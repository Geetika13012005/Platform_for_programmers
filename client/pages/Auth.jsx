import Header from "../components/layout/Header";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
export default function AuthPage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const initialMode = params.get("mode") === "signup" ? "signup" : "login";
    const [mode, setMode] = useState(initialMode);
    const { refresh } = useAuth();
    const [error, setError] = useState("");
    useEffect(() => {
        setMode(initialMode);
    }, [initialMode]);
    async function onSubmit(e) {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const email = String(form.get("email") || "").trim();
        const password = String(form.get("password") || "").trim();
        const name = String(form.get("name") || "").trim();
        setError("");
        
        try {
            let res;
            if (mode === "signup") {
                res = await api(`/api/auth/signup`, {
                    method: "POST",
                    body: JSON.stringify({ email, password, name }),
                    showAuthErrors: true // Explicitly show auth errors during signup
                });
                // server returns { message, newUser, token }
                if (res?.token) {
                    localStorage.setItem("auth_token", res.token);
                }
            } else {
                res = await api(`/api/auth/login`, {
                    method: "POST",
                    body: JSON.stringify({ email, password }),
                    showAuthErrors: true // Explicitly show auth errors during login
                });
                // server returns { message, data, token }
                if (res?.token) {
                    localStorage.setItem("auth_token", res.token);
                }
            }
            
            await refresh();
            navigate("/dashboard");
        }
        catch (err) {
            console.error("Auth error:", err);
            const msg = String(err?.message || err || "");
            
            // Handle network errors
            if (/network error/i.test(msg)) {
                setError("Network error. Please check your connection and try again.");
                return;
            }
            
            // Handle user already exists
            if (/already exists/i.test(msg) || /409/.test(msg)) {
                setMode("login");
                setError("Email already registered. Please sign in.");
                return;
            }
            
            // Handle invalid credentials
            if (/invalid/i.test(msg) || /401/.test(msg)) {
                setError("Invalid email or password.");
                return;
            }
            
            // Handle missing fields
            if (/400/.test(msg)) {
                setError("Please fill in all required fields.");
                return;
            }
            
            // Generic error
            setError(msg || "An error occurred. Please try again.");
        }
    }
    return (
      <div className="auth-page">
        <Header />
        <main className="container">
          <div className="auth-container">
            <div className="auth-header">
              <h1 className="auth-title">
                {mode === "signup" ? "Create your account" : "Welcome back"}
              </h1>
              <p className="auth-subtitle">
                {mode === "signup" ? "Start your first notebook in seconds" : "Sign in to continue"}
              </p>
            </div>
            <form onSubmit={onSubmit} className="form">
              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}
              {mode === "signup" && (
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input
                    name="name"
                    required
                    placeholder="Ada Lovelace"
                    className="form-input"
                  />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="you@example.com"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••"
                  className="form-input"
                />
              </div>
              <button className="button button-primary button-full">
                {mode === "signup" ? "Create account" : "Sign in"}
              </button>
            </form>
            <div className="text-center text-sm mt-4">
              {mode === "signup" ? (
                <span>
                  Already have an account?{" "}
                  <button className="link" onClick={() => setMode("login")}>
                    Sign in
                  </button>
                </span>
              ) : (
                <span>
                  New here?{" "}
                  <button className="link" onClick={() => setMode("signup")}>
                    Create an account
                  </button>
                </span>
              )}
            </div>
          </div>
        </main>
      </div>
    );
}