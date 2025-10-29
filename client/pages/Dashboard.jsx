import Header from "../components/layout/Header";
import { useAuth } from "../hooks/useAuth";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

// ------------------- SAMPLE NOTEBOOKS -------------------
const samples = [
  {
    id: "s_python_ml",
    title: "Python Machine Learning Intro",
    tag: "PYTHON",
    color: "bg-blue-600",
    cells: [
      {
        id: crypto.randomUUID(),
        language: "python",
        code: "import numpy as np\nimport pandas as pd\nprint('Hello ML!')",
      },
    ],
  },
  {
    id: "s_pandas",
    title: "Data Analysis with Pandas",
    tag: "PYTHON",
    color: "bg-blue-600",
    cells: [
      {
        id: crypto.randomUUID(),
        language: "python",
        code: "import pandas as pd\ndf = pd.DataFrame({'a':[1,2,3]})\nprint(df.describe())",
      },
    ],
  },
  {
    id: "s_cpp_stats",
    title: "C++ Statistical Computing",
    tag: "CPP",
    color: "bg-purple-600",
    cells: [
      {
        id: crypto.randomUUID(),
        language: "cpp",
        code: `#include <bits/stdc++.h>
using namespace std;
int main(){
  vector<int> v{1,2,3};
  double avg = accumulate(v.begin(),v.end(),0.0)/v.size();
  cout << avg << "\\n";
  return 0;
}`,
      },
    ],
  },
  {
    id: "s_js_data",
    title: "JavaScript Data Processing",
    tag: "JAVASCRIPT",
    color: "bg-amber-600",
    cells: [
      {
        id: crypto.randomUUID(),
        language: "javascript",
        code: "const arr=[1,2,3]; console.log(arr.map(x=>x*2).join(', '))",
      },
    ],
  },
];

const defaultNotebook = [
  { id: crypto.randomUUID(), language: "python", code: "print('Hello from Python!')" },
];

// ------------------- DASHBOARD COMPONENT -------------------
export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [notebooks, setNotebooks] = useState([]);
  const [loadingNotebooks, setLoadingNotebooks] = useState(true);
  const inputRef = useRef(null);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  // Fetch user's notebooks
  useEffect(() => {
    async function fetchNotebooks() {
      if (!user || loading) return;

      try {
        setLoadingNotebooks(true);
        const data = await api("/api/notebooks");
        setNotebooks(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to fetch notebooks:", error);
        setNotebooks([]);
      } finally {
        setLoadingNotebooks(false);
      }
    }

    fetchNotebooks();
  }, [user, loading]);

  // Filtered samples for search
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return samples.filter((s) => s.title.toLowerCase().includes(q));
  }, [query]);

  // ------------------- CREATE NOTEBOOK -------------------
  async function openNotebook(cells) {
    try {
      const newNotebook = await api("/api/notebooks", {
        method: "POST",
        body: JSON.stringify({ cells }),
      });

      console.log("✅ Created notebook:", newNotebook);

      const id = newNotebook?.id || newNotebook?._id;
      if (!id) {
        console.error("Notebook creation returned unexpected response:", newNotebook);
        alert("Notebook created but server did not return an ID. Check backend logs.");
        return;
      }

      // ✅ Navigate to notebook page using query param
      navigate(`/notebook?nb=${id}`);
    } catch (error) {
      console.error("Failed to create notebook:", error);
      alert("Failed to create notebook. Please try again.");
    }
  }

  // ------------------- UPLOAD NOTEBOOK -------------------
  async function onUpload(file) {
    try {
      const txt = await file.text();
      const data = JSON.parse(txt);
      if (Array.isArray(data)) {
        await openNotebook(data);
      } else if (Array.isArray(data?.cells)) {
        await openNotebook(data.cells);
      } else {
        throw new Error("Unsupported file format");
      }
    } catch (e) {
      alert(e?.message || String(e));
    }
  }

  // ------------------- LOGOUT -------------------
  async function handleLogout() {
    try {
      await logout();
      navigate("/auth");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  // ------------------- LOADING STATE -------------------
  if (loading || !user)
    return (
      <div>
        <Header />
        <main
          className="container"
          style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}
        >
          <div>Loading...</div>
        </main>
      </div>
    );

  // ------------------- RENDER -------------------
  return (
    <div>
      <Header />
      <main className="container" style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem 0" }}>
        {/* HEADER SECTION */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
              Welcome, {user.name || "User"}
            </h1>
            <p style={{ fontSize: 17, color: "#444", marginBottom: 0, maxWidth: 700 }}>
              Colaboratory is a free notebook environment. Execute Python, C++, and JavaScript code with built-in
              libraries.
            </p>
          </div>
          <button onClick={handleLogout} className="button button-secondary">
            Logout
          </button>
        </div>

        {/* NOTEBOOK ACTIONS */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button onClick={() => openNotebook(defaultNotebook)} className="button button-primary">
            + New notebook
          </button>

          <label className="button button-secondary" style={{ cursor: "pointer" }}>
            Upload
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                if (f) onUpload(f);
              }}
            />
          </label>

          <button onClick={() => openNotebook(samples[0].cells)} className="button button-secondary">
            Open sample notebook
          </button>
        </div>

        {/* SEARCH */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notebooks"
            className="form-input"
            style={{ width: 260, fontSize: 15 }}
          />
          <button className="button button-secondary">Filter</button>
          <button className="button button-secondary">☰</button>
        </div>

        {/* USER NOTEBOOKS */}
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: "32px 0 16px 0" }}>Your Notebooks</h2>
        {loadingNotebooks ? (
          <div>Loading notebooks...</div>
        ) : notebooks.length > 0 ? (
          <div style={{ display: "grid", gap: 24, gridTemplateColumns: "1fr 1fr", marginBottom: 40 }}>
            {notebooks.map((notebook) => (
              <div
                key={notebook.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  background: "#fff",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  padding: 20,
                }}
              >
                <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>
                  {notebook.title || "Untitled Notebook"}
                </div>
                <div style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
                  {new Date(notebook.updatedAt || notebook.createdAt).toLocaleDateString()}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    onClick={() => navigate(`/notebook?nb=${notebook.id}`)}
                    className="button button-primary"
                    style={{ fontSize: 15, padding: "6px 18px" }}
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              border: "1px dashed #ddd",
              borderRadius: 14,
              marginBottom: 40,
            }}
          >
            <p>You don't have any notebooks yet.</p>
            <button onClick={() => openNotebook(defaultNotebook)} className="button button-primary">
              Create your first notebook
            </button>
          </div>
        )}

        {/* SAMPLE NOTEBOOKS */}
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: "32px 0 16px 0" }}>Machine Learning Examples</h2>
        <div style={{ display: "grid", gap: 24, gridTemplateColumns: "1fr 1fr", marginBottom: 40 }}>
          {filtered.map((s) => (
            <div
              key={s.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                background: "#fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                padding: 20,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "#888", marginBottom: 4 }}>{s.tag}</div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{s.title}</div>
              <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    display: "inline-block",
                    height: 10,
                    width: 10,
                    borderRadius: "50%",
                    background:
                      s.tag === "PYTHON" ? "#2563eb" : s.tag === "CPP" ? "#a78bfa" : "#f59e0b",
                  }}
                />
                <button
                  onClick={() => openNotebook(s.cells)}
                  className="button button-primary"
                  style={{ fontSize: 15, padding: "6px 18px" }}
                >
                  Open Notebook
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
