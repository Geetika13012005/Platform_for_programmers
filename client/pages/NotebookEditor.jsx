import { useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function NotebookEditor() {
  const [searchParams] = useSearchParams();
  const notebookId = searchParams.get("nb"); // will read ?nb=123
  const [notebook, setNotebook] = useState(null);

  useEffect(() => {
    async function fetchNotebook() {
      try {
        if (!notebookId) return;
        const data = await api(`/api/notebooks/${notebookId}`);
        setNotebook(data);
      } catch (e) {
        console.error("Failed to load notebook:", e);
      }
    }
    fetchNotebook();
  }, [notebookId]);

  if (!notebookId) return <p>No notebook ID found.</p>;
  if (!notebook) return <p>Loading notebook...</p>;

  return (
    <div style={{ padding: "2rem" }}>
      <h1>{notebook.title || "Untitled Notebook"}</h1>
      <pre style={{ background: "#f4f4f4", padding: "1rem", borderRadius: 8 }}>
        {JSON.stringify(notebook.cells, null, 2)}
      </pre>
    </div>
  );
}
