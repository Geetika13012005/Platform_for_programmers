import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import Header from "../components/layout/Header";

export default function Notebook() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [notebook, setNotebook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Get notebook ID from URL (?nb=xyz)
  const notebookId = searchParams.get("nb");

  useEffect(() => {
    async function fetchNotebook() {
      if (!notebookId) {
        setError("No notebook ID provided.");
        setLoading(false);
        return;
      }

      try {
        const data = await api(`/api/notebooks/${notebookId}`);
        setNotebook(data);
      } catch (err) {
        console.error("Failed to load notebook:", err);
        setError("Failed to load notebook.");
      } finally {
        setLoading(false);
      }
    }

    fetchNotebook();
  }, [notebookId]);

  if (loading) {
    return (
      <div>
        <Header />
        <main className="container" style={{ padding: "3rem", textAlign: "center" }}>
          <h2>Loading notebook...</h2>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Header />
        <main className="container" style={{ padding: "3rem", textAlign: "center" }}>
          <h2 style={{ color: "red" }}>{error}</h2>
          <button
            className="button button-secondary"
            onClick={() => navigate("/dashboard")}
            style={{ marginTop: 20 }}
          >
            ← Back to Dashboard
          </button>
        </main>
      </div>
    );
  }

  if (!notebook) {
    return (
      <div>
        <Header />
        <main className="container" style={{ padding: "3rem", textAlign: "center" }}>
          <h2>Notebook not found.</h2>
          <button
            className="button button-secondary"
            onClick={() => navigate("/dashboard")}
            style={{ marginTop: 20 }}
          >
            ← Back to Dashboard
          </button>
        </main>
      </div>
    );
  }

  return (
    <div>
      <Header />
      <main className="container" style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>
          {notebook.title || "Untitled Notebook"}
        </h1>

        {notebook.cells && notebook.cells.length > 0 ? (
          notebook.cells.map((cell) => (
            <div
              key={cell.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                marginBottom: 24,
                padding: 16,
                background: "#fff",
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ marginBottom: 8, fontSize: 14, color: "#888" }}>
                Language: <strong>{cell.language}</strong>
              </div>
              <pre
                style={{
                  background: "#f8f9fa",
                  borderRadius: 8,
                  padding: 12,
                  fontFamily: "monospace",
                  fontSize: 14,
                  overflowX: "auto",
                }}
              >
                {cell.code}
              </pre>
            </div>
          ))
        ) : (
          <p style={{ color: "#666" }}>This notebook has no code cells yet.</p>
        )}

        <button
          className="button button-secondary"
          onClick={() => navigate("/dashboard")}
          style={{ marginTop: 30 }}
        >
          ← Back to Dashboard
        </button>
      </main>
    </div>
  );
}
