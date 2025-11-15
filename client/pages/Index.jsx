import Header from "../components/layout/Header";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "../styles/main.css";


const defaultSnippets = {
  python: "print('Hello from Python!')",
  cpp: "#include <bits/stdc++.h>\nusing namespace std;\nint main(){ cout << \"Hello from C++!\\n\"; return 0;}\n",
  javascript: "console.log('Hello from JavaScript!')",
};

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [nb, setNb] = useState(null);
  const [cells, setCells] = useState([]);
  const [title, setTitle] = useState("Untitled Notebook");
  const saveTimer = useRef(null);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  // Load server notebook for signed-in users
  useEffect(() => {
    async function boot() {
      if (loading || !user) return;

      const nbParam = params.get("nb");

      async function tryLoad() {
        if (nbParam && nbParam !== 'undefined' && nbParam !== 'null') {
          const found = await api(`/api/notebooks/${nbParam}`);
          setNb(found);
          setTitle(found.title || "Untitled Notebook");
          setCells(
            Array.isArray(found.cells)
              ? found.cells
              : [{ id: crypto.randomUUID(), language: "python", code: defaultSnippets.python }]
          );
          return true;
        }

        const list = await api(`/api/notebooks`);
        if (list.length > 0) {
          const latest = list[0];
          setNb(latest);
          setTitle(latest.title || "Untitled Notebook");
          setCells(
            Array.isArray(latest.cells)
              ? latest.cells
              : [{ id: crypto.randomUUID(), language: "python", code: defaultSnippets.python }]
          );
          setParams((p) => {
            const np = new URLSearchParams(p);
            np.set("nb", latest.id);
            return np;
          }, { replace: true });
          return true;
        }

        const created = await api(`/api/notebooks`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        setNb(created);
        setTitle(created.title || "Untitled Notebook");
        setCells(
          Array.isArray(created.cells)
            ? created.cells
            : [{ id: crypto.randomUUID(), language: "python", code: defaultSnippets.python }]
        );
        setParams((p) => {
          const np = new URLSearchParams(p);
          np.set("nb", created.id);
          return np;
        }, { replace: true });
        return true;
      }

      try {
        await tryLoad();
      } catch (e) {
        const msg = String(e?.message || e || "");
        if (/not authenticated/i.test(msg) || /401/.test(msg)) {
          try {
            const me = await api("/api/auth/me");
            if (me?.id) {
              await tryLoad();
              return;
            }
          } catch {}
          navigate("/auth");
        } else {
          console.error(e);
        }
      }
    }
    boot();
  }, [loading, user]);

  // LocalStorage fallback for guests
  useEffect(() => {
    if (user) return; // guests only
    const raw = localStorage.getItem("notebook:default");
    if (raw) {
      try {
        setCells(JSON.parse(raw));
        return;
      } catch {}
    }
    setCells([{ id: crypto.randomUUID(), language: "python", code: defaultSnippets.python }]);
  }, [user]);

  // Persist for guests and autosave for users
  useEffect(() => {
    if (!cells) return;

    if (!user) {
      localStorage.setItem("notebook:default", JSON.stringify(cells));
      return;
    }

    if (!nb) return;

    window.clearTimeout(saveTimer.current || undefined);
    saveTimer.current = window.setTimeout(async () => {
      try {
        const updated = await api(`/api/notebooks/${nb.id}`, {
          method: "PUT",
          body: JSON.stringify({ title, cells }),
        });
        setNb(updated);
      } catch (e) {
        console.error(e);
      }
    }, 600);
  }, [cells, title, user, nb]);

  const addCell = (lang) =>
    setCells((c) => [...c, { id: crypto.randomUUID(), language: lang, code: defaultSnippets[lang] }]);

  const updateCell = (id, patch) =>
    setCells((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const removeCell = (id) => setCells((l) => l.filter((c) => c.id !== id));

  async function runCell(cell) {
    updateCell(cell.id, { running: true, stdout: "", stderr: "" });
    try {
      const res = await api("/api/run", {
        method: "POST",
        body: JSON.stringify({ language: cell.language, code: cell.code }),
      });
      updateCell(cell.id, { running: false, stdout: res.stdout, stderr: res.stderr });
    } catch (e) {
      updateCell(cell.id, { running: false, stderr: e?.message || String(e) });
    }
  }

  async function runAll() {
    for (const cell of cells) {
      await runCell(cell);
    }
  }

  // Show loading state
  if (loading) {
    return (
      <div>
        <Header />
        <main className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <div>Loading...</div>
        </main>
      </div>
    );
  }

  // Guest (unauthenticated) view
  if (!user) {
    return (
      <div>
        <Header />
        <main>
          <div className="welcome">
            <h1>
              Welcome to <span className="highlight">Colaboratory</span>
            </h1>
            <p>
              Colaboratory, or "Colab" for short, lets you write and execute code through your browser.
              Perfect for data analysis, machine learning and education.
            </p>
            <div className="actions">
              <button onClick={() => navigate("/auth?mode=signup")} className="button button-primary">
                Start coding now
              </button>
              <button onClick={() => navigate("/auth")} className="button button-secondary">
                Sign in to continue
              </button>
            </div>

            <div className="preview-card">
              <div className="preview-header">
                <span>Notebook preview</span>
                <span>Python • C++ • JavaScript</span>
              </div>
              <pre className="preview">{defaultSnippets.python}</pre>
            </div>

            <div className="welcome-features">
              <div className="welcome-feature">
                <div className="welcome-feature-icon">⟲</div>
                <div className="welcome-feature-title">No setup required</div>
                <div className="welcome-feature-desc">Open your browser and start coding. No installs.</div>
              </div>
              <div className="welcome-feature">
                <div className="welcome-feature-icon">👥</div>
                <div className="welcome-feature-title">Easy sharing</div>
                <div className="welcome-feature-desc">Share notebooks with a link for effortless collaboration.</div>
              </div>
              <div className="welcome-feature">
                <div className="welcome-feature-icon">⚡</div>
                <div className="welcome-feature-title">Powerful computing</div>
                <div className="welcome-feature-desc">
                  Run Python, C++ and JS with safe, sandboxed execution.
                </div>
              </div>
            </div>

            <div className="welcome-section">
              <div className="welcome-section-title">
                Perfect for data science and machine learning
              </div>
              <ul className="welcome-list">
                <li>
                  <div className="font-medium">Data Analysis</div>
                  <div>Import, clean and analyze datasets with popular libraries.</div>
                </li>
                <li>
                  <div className="font-medium">Machine Learning</div>
                  <div>Build and train models. Great for tutorials and demos.</div>
                </li>
                <li>
                  <div className="font-medium">Education</div>
                  <div>Create interactive tutorials and assignments in the browser.</div>
                </li>
                <li>
                  <div className="font-medium">Research</div>
                  <div>Reproducible research with embedded code and visualizations.</div>
                </li>
              </ul>
            </div>

            <div className="welcome-footer">
              <div>Ready to get started?</div>
              <button onClick={() => navigate("/auth?mode=signup")} className="button button-primary">
                Create your first notebook
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Authenticated user view (redirected to dashboard)
  return null;
}