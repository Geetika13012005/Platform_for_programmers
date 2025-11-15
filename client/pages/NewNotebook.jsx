import { useEffect, useRef, useState, useMemo, useCallback, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import Header from "../components/layout/Header";

const defaultSnippets = {
  python: "print('Hello from Python!')",
  cpp: "#include <bits/stdc++.h>\nusing namespace std;\nint main(){ cout << \"Hello from C++!\\n\"; return 0;}\n",
  javascript: "console.log('Hello from JavaScript!')",
};

const NewNotebook = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, logout } = useAuth();
  const [notebook, setNotebook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("Untitled Notebook");
  const [cells, setCells] = useState([]);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [showRuntimeMenu, setShowRuntimeMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastSaved, setLastSaved] = useState(new Date());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const saveTimer = useRef(null);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Close menus on Escape
      if (e.key === 'Escape') {
        setShowFileMenu(false);
        setShowEditMenu(false);
        setShowViewMenu(false);
        setShowInsertMenu(false);
        setShowRuntimeMenu(false);
        setShowToolsMenu(false);
        setShowHelpMenu(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notebook, user]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowFileMenu(false);
      setShowEditMenu(false);
      setShowViewMenu(false);
      setShowInsertMenu(false);
      setShowRuntimeMenu(false);
      setShowToolsMenu(false);
      setShowHelpMenu(false);
      setIsMobileMenuOpen(false);
    };

    if (showFileMenu || showEditMenu || showViewMenu || showInsertMenu || showRuntimeMenu || showToolsMenu || showHelpMenu || isMobileMenuOpen) {
      window.addEventListener('click', handleClickOutside);
      return () => window.removeEventListener('click', handleClickOutside);
    }
  }, [showFileMenu, showEditMenu, showViewMenu, showInsertMenu, showRuntimeMenu, showToolsMenu, showHelpMenu, isMobileMenuOpen]);

  // Load or create notebook
  useEffect(() => {
    if (authLoading || !user) return;

    async function loadNotebook() {
      try {
        setLoading(true);

        if (id && id !== 'new') {
          // Load existing notebook
          const data = await api(`/api/notebooks/${id}`);
          setNotebook(data);
          setTitle(data.title || "Untitled Notebook");
          setCells(Array.isArray(data.cells) && data.cells.length > 0 
            ? data.cells 
            : [{ id: crypto.randomUUID(), language: "python", code: defaultSnippets.python }]
          );
        } else {
          // Create new notebook
          const newNotebook = await api("/api/notebooks", {
            method: "POST",
            body: JSON.stringify({ 
              title: "Untitled Notebook",
              cells: [{ id: crypto.randomUUID(), language: "python", code: defaultSnippets.python }] 
            }),
          });
          const newId = newNotebook?.id || newNotebook?._id;
          if (!newId) throw new Error("No notebook ID returned from API");
          
          setNotebook(newNotebook);
          setTitle(newNotebook.title || "Untitled Notebook");
          setCells(Array.isArray(newNotebook.cells) && newNotebook.cells.length > 0
            ? newNotebook.cells
            : [{ id: crypto.randomUUID(), language: "python", code: defaultSnippets.python }]
          );
          
          // Update URL to the new notebook ID without reloading
          navigate(`/notebook/${newId}`, { replace: true });
        }
      } catch (err) {
        console.error("Failed to load/create notebook:", err);
        alert("Failed to load notebook. Redirecting to dashboard.");
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    }

    loadNotebook();
  }, [id, authLoading, user, navigate]);

  // Auto-save notebook with longer debounce for better performance
  useEffect(() => {
    if (!notebook || !user || loading) return;

    window.clearTimeout(saveTimer.current || undefined);
    saveTimer.current = window.setTimeout(async () => {
      try {
        const notebookId = notebook.id || notebook._id;
        if (!notebookId) return;
        
        await api(`/api/notebooks/${notebookId}`, {
          method: "PUT",
          body: JSON.stringify({ title, cells }),
        });
        setLastSaved(new Date());
      } catch (e) {
        console.error("Failed to save:", e);
      }
    }, 2000); // Increased to 2 seconds for better performance
  }, [cells, title, notebook, user, loading]);

  const addCell = useCallback((lang) => {
    setCells((c) => [...c, { id: crypto.randomUUID(), language: lang, code: defaultSnippets[lang] }]);
  }, []);

  const updateCell = useCallback((cellId, patch) => {
    setCells((list) => list.map((c) => (c.id === cellId ? { ...c, ...patch } : c)));
  }, []);

  const removeCell = useCallback((cellId) => {
    if (cells.length === 1) {
      alert("Cannot remove the last cell!");
      return;
    }
    setCells((l) => l.filter((c) => c.id !== cellId));
  }, [cells.length]);

  const runCell = useCallback(async (cell) => {
    updateCell(cell.id, { running: true, stdout: "", stderr: "" });
    try {
      const res = await api("/api/run", {
        method: "POST",
        body: JSON.stringify({ 
          language: cell.language, 
          code: cell.code,
          stdin: cell.stdin || "" 
        }),
      });
      updateCell(cell.id, { running: false, stdout: res.stdout, stderr: res.stderr });
    } catch (e) {
      updateCell(cell.id, { running: false, stderr: e?.message || String(e) });
    }
  }, [updateCell]);

  const runAll = useCallback(async () => {
    for (const cell of cells) {
      await runCell(cell);
    }
  }, [cells, runCell]);

  // Menu Functions
  const handleSave = async () => {
    if (!notebook || !user) return;
    try {
      const notebookId = notebook.id || notebook._id;
      await api(`/api/notebooks/${notebookId}`, {
        method: "PUT",
        body: JSON.stringify({ title, cells }),
      });
      setLastSaved(new Date());
      alert("Notebook saved successfully!");
    } catch (e) {
      alert("Failed to save notebook");
    }
  };

  const handleShare = () => {
    const notebookId = notebook?.id || notebook?._id;
    if (notebookId) {
      const shareUrl = `${window.location.origin}/notebook/${notebookId}`;
      navigator.clipboard.writeText(shareUrl);
      alert(`Share link copied to clipboard!\n${shareUrl}`);
    }
  };

  const handleDownload = () => {
    const data = JSON.stringify({ title, cells }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'notebook'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.title) setTitle(data.title);
        if (Array.isArray(data.cells)) setCells(data.cells);
        else if (Array.isArray(data)) setCells(data);
      } catch (err) {
        alert('Invalid file format');
      }
    };
    input.click();
  };

  const handleRenameNotebook = () => {
    const newTitle = prompt('Enter new notebook name:', title);
    if (newTitle && newTitle.trim()) {
      setTitle(newTitle.trim());
    }
  };

  const handleDeleteNotebook = async () => {
    if (!confirm('Are you sure you want to delete this notebook?')) return;
    try {
      const notebookId = notebook?.id || notebook?._id;
      await api(`/api/notebooks/${notebookId}`, { method: 'DELETE' });
      alert('Notebook deleted');
      navigate('/dashboard');
    } catch (e) {
      alert('Failed to delete notebook');
    }
  };

  const handleClearAllOutputs = () => {
    setCells(cells.map(cell => ({ ...cell, stdout: '', stderr: '' })));
  };

  const handleRestartRuntime = () => {
    handleClearAllOutputs();
    alert('Runtime restarted. All outputs cleared.');
  };

  const handleInterruptExecution = () => {
    setCells(cells.map(cell => ({ ...cell, running: false })));
    alert('Execution interrupted');
  };

  const handleSearch = () => {
    if (!searchQuery) return;
    let found = false;
    cells.forEach(cell => {
      if (cell.code.includes(searchQuery)) {
        found = true;
      }
    });
    if (found) {
      alert(`Found "${searchQuery}" in notebook`);
    } else {
      alert(`"${searchQuery}" not found`);
    }
  };

  const handleFindAndReplace = () => {
    const findText = prompt('Find:');
    if (!findText) return;
    const replaceText = prompt('Replace with:');
    if (replaceText === null) return;
    
    setCells(cells.map(cell => ({
      ...cell,
      code: cell.code.replaceAll(findText, replaceText)
    })));
    alert(`Replaced "${findText}" with "${replaceText}"`);
  };

  const handleClearAllCells = () => {
    if (!confirm('Clear all cell contents?')) return;
    setCells(cells.map(cell => ({ ...cell, code: '', stdout: '', stderr: '' })));
  };

  const handleDeleteAllCells = () => {
    if (!confirm('Delete all cells?')) return;
    setCells([{ id: crypto.randomUUID(), language: "python", code: defaultSnippets.python }]);
  };

  if (authLoading || loading) {
    return (
      <div>
        <Header />
        <main className="container" style={{ padding: "3rem", textAlign: "center" }}>
          <h2>Loading notebook...</h2>
        </main>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f5f5f5" }}>
      {/* Top Navigation Bar */}
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between", 
        padding: "0 16px",
        minHeight: 56,
        background: "#2d2d2d",
        color: "#fff",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        flexWrap: "wrap",
        gap: "8px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "clamp(8px, 2vw, 20px)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ 
              width: 32, 
              height: 32, 
              background: "#ff6f00", 
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 18
            }}>C</div>
            <span style={{ fontSize: "clamp(14px, 3vw, 18px)", fontWeight: 500 }}>Colaboratory</span>
          </div>
          
          {/* Hamburger Menu Button (Mobile Only) */}
          <button 
            onClick={(e) => { e.stopPropagation(); setIsMobileMenuOpen(!isMobileMenuOpen); }}
            className="mobile-menu-toggle"
            style={{ 
              display: "none",
              background: "none", 
              border: "none", 
              color: "#fff", 
              cursor: "pointer", 
              padding: "8px",
              fontSize: 24,
            }}
          >
            {isMobileMenuOpen ? '✕' : '☰'}
          </button>
          
          {/* Desktop Menu */}
          <div className="desktop-menu" style={{ display: "flex", gap: "clamp(8px, 1.5vw, 16px)", fontSize: "clamp(12px, 2vw, 14px)", flexWrap: "wrap" }}>
            {/* File Menu */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowFileMenu(!showFileMenu); }} 
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: "8px 12px" }}
              >
                File
              </button>
              {showFileMenu && (
                <div onClick={(e) => e.stopPropagation()} style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  background: '#fff', 
                  border: '1px solid #ddd', 
                  borderRadius: 4, 
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  minWidth: 200,
                  zIndex: 1000
                }}>
                  <button onClick={() => { navigate('/notebook/new'); setShowFileMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>New notebook</button>
                  <button onClick={() => { handleUpload(); setShowFileMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>Upload notebook</button>
                  <button onClick={() => { handleDownload(); setShowFileMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>Download</button>
                  <button onClick={() => { handleSave(); setShowFileMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>Save</button>
                  <button onClick={() => { handleRenameNotebook(); setShowFileMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>Rename</button>
                  <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #eee' }} />
                  <button onClick={() => { handleDeleteNotebook(); setShowFileMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#d32f2f' }}>Delete notebook</button>
                </div>
              )}
            </div>

            {/* Edit Menu */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowEditMenu(!showEditMenu); }} 
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: "8px 12px" }}
              >
                Edit
              </button>
              {showEditMenu && (
                <div onClick={(e) => e.stopPropagation()} style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  background: '#fff', 
                  border: '1px solid #ddd', 
                  borderRadius: 4, 
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  minWidth: 200,
                  zIndex: 1000
                }}>
                  <button onClick={() => { handleSearch(); setShowEditMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>Find</button>
                  <button onClick={() => { handleFindAndReplace(); setShowEditMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>Find and replace</button>
                  <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #eee' }} />
                  <button onClick={() => { handleClearAllCells(); setShowEditMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>Clear all cells</button>
                  <button onClick={() => { handleDeleteAllCells(); setShowEditMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#d32f2f' }}>Delete all cells</button>
                </div>
              )}
            </div>

            {/* View Menu */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowViewMenu(!showViewMenu); }} 
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: "8px 12px" }}
              >
                View
              </button>
              {showViewMenu && (
                <div onClick={(e) => e.stopPropagation()} style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  background: '#fff', 
                  border: '1px solid #ddd', 
                  borderRadius: 4, 
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  minWidth: 200,
                  zIndex: 1000
                }}>
                  <button onClick={() => { handleClearAllOutputs(); setShowViewMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>Clear all outputs</button>
                  <button onClick={() => { window.location.reload(); setShowViewMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>Refresh</button>
                </div>
              )}
            </div>

            {/* Insert Menu */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowInsertMenu(!showInsertMenu); }} 
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: "8px 12px" }}
              >
                Insert
              </button>
              {showInsertMenu && (
                <div onClick={(e) => e.stopPropagation()} style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  background: '#fff', 
                  border: '1px solid #ddd', 
                  borderRadius: 4, 
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  minWidth: 200,
                  zIndex: 1000
                }}>
                  <button onClick={() => { addCell('python'); setShowInsertMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>Python cell</button>
                  <button onClick={() => { addCell('cpp'); setShowInsertMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>C++ cell</button>
                  <button onClick={() => { addCell('javascript'); setShowInsertMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>JavaScript cell</button>
                </div>
              )}
            </div>

            {/* Runtime Menu */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowRuntimeMenu(!showRuntimeMenu); }} 
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: "8px 12px" }}
              >
                Runtime
              </button>
              {showRuntimeMenu && (
                <div onClick={(e) => e.stopPropagation()} style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  background: '#fff', 
                  border: '1px solid #ddd', 
                  borderRadius: 4, 
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  minWidth: 200,
                  zIndex: 1000
                }}>
                  <button onClick={() => { runAll(); setShowRuntimeMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>Run all</button>
                  <button onClick={() => { handleInterruptExecution(); setShowRuntimeMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>Interrupt execution</button>
                  <button onClick={() => { handleRestartRuntime(); setShowRuntimeMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>Restart runtime</button>
                  <button onClick={() => { handleClearAllOutputs(); setShowRuntimeMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>Clear all outputs</button>
                </div>
              )}
            </div>

            {/* Tools Menu */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowToolsMenu(!showToolsMenu); }} 
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: "8px 12px" }}
              >
                Tools
              </button>
              {showToolsMenu && (
                <div onClick={(e) => e.stopPropagation()} style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  background: '#fff', 
                  border: '1px solid #ddd', 
                  borderRadius: 4, 
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  minWidth: 200,
                  zIndex: 1000
                }}>
                  <button onClick={() => { alert('Settings coming soon'); setShowToolsMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>Settings</button>
                  <button onClick={() => { alert('Keyboard shortcuts: Ctrl+S (Save), Ctrl+Enter (Run Cell)'); setShowToolsMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>Keyboard shortcuts</button>
                </div>
              )}
            </div>

            {/* Help Menu */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowHelpMenu(!showHelpMenu); }} 
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: "8px 12px" }}
              >
                Help
              </button>
              {showHelpMenu && (
                <div onClick={(e) => e.stopPropagation()} style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  background: '#fff', 
                  border: '1px solid #ddd', 
                  borderRadius: 4, 
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  minWidth: 200,
                  zIndex: 1000
                }}>
                  <button onClick={() => { alert('Colaboratory Help\n\nThis is a collaborative coding environment.\n\nSupported languages:\n- Python\n- C++\n- JavaScript'); setShowHelpMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>Documentation</button>
                  <button onClick={() => { alert('Report an issue: contact@colaboratory.com'); setShowHelpMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>Report issue</button>
                  <button onClick={() => { alert('Colaboratory v1.0.0'); setShowHelpMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>About</button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="mobile-menu-dropdown" onClick={(e) => e.stopPropagation()} style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#2d2d2d',
            borderTop: '1px solid #444',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            zIndex: 1000,
            maxHeight: '70vh',
            overflowY: 'auto'
          }}>
            <div style={{ padding: '12px 16px' }}>
              {/* File Section */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>File</div>
                <button onClick={() => { navigate('/notebook/new'); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>New notebook</button>
                <button onClick={() => { handleUpload(); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>Upload notebook</button>
                <button onClick={() => { handleDownload(); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>Download</button>
                <button onClick={() => { handleSave(); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>Save</button>
                <button onClick={() => { handleRenameNotebook(); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>Rename</button>
                <button onClick={() => { handleDeleteNotebook(); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#d32f2f', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>Delete notebook</button>
              </div>
              
              {/* Edit Section */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>Edit</div>
                <button onClick={() => { handleSearch(); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>Find</button>
                <button onClick={() => { handleFindAndReplace(); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>Find and replace</button>
                <button onClick={() => { handleClearAllCells(); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>Clear all cells</button>
              </div>
              
              {/* View Section */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>View</div>
                <button onClick={() => { handleClearAllOutputs(); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>Clear all outputs</button>
                <button onClick={() => { window.location.reload(); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>Refresh</button>
              </div>
              
              {/* Insert Section */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>Insert</div>
                <button onClick={() => { addCell('python'); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>Python cell</button>
                <button onClick={() => { addCell('cpp'); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>C++ cell</button>
                <button onClick={() => { addCell('javascript'); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>JavaScript cell</button>
              </div>
              
              {/* Runtime Section */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>Runtime</div>
                <button onClick={() => { runAll(); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>Run all</button>
                <button onClick={() => { handleInterruptExecution(); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>Interrupt execution</button>
                <button onClick={() => { handleRestartRuntime(); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>Restart runtime</button>
              </div>
              
              {/* Tools Section */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>Tools</div>
                <button onClick={() => { alert('Settings coming soon'); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>Settings</button>
                <button onClick={() => { alert('Keyboard shortcuts: Ctrl+S (Save), Ctrl+Enter (Run Cell)'); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>Keyboard shortcuts</button>
              </div>
              
              {/* Help Section */}
              <div>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>Help</div>
                <button onClick={() => { alert('Colaboratory Help\n\nThis is a collaborative coding environment.\n\nSupported languages:\n- Python\n- C++\n- JavaScript'); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>Documentation</button>
                <button onClick={() => { alert('Report an issue: contact@colaboratory.com'); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>Report issue</button>
                <button onClick={() => { alert('Colaboratory v1.0.0'); setIsMobileMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, borderRadius: 4 }} onMouseEnter={(e) => e.target.style.background = '#3d3d3d'} onMouseLeave={(e) => e.target.style.background = 'none'}>About</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <input 
            type="text" 
            placeholder="Search" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            style={{ 
              background: "#3d3d3d", 
              border: "1px solid #555", 
              color: "#fff", 
              padding: "6px 12px",
              borderRadius: 4,
              fontSize: "clamp(12px, 2vw, 14px)",
              width: "clamp(150px, 30vw, 200px)",
              minWidth: 120
            }}
          />
          <button onClick={() => navigate("/")} className="button button-secondary" style={{ fontSize: "clamp(12px, 2vw, 14px)", whiteSpace: "nowrap" }}>Home</button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="notebook-main-content" style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left Sidebar */}
        <div className="notebook-sidebar" style={{ 
          width: 280, 
          background: "#fff", 
          borderRight: "1px solid #e0e0e0",
          display: "flex",
          flexDirection: "column",
          overflow: "auto"
        }}>
          <div style={{ padding: "16px", borderBottom: "1px solid #e0e0e0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Files</h3>
              <button style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>+</button>
            </div>
            <input 
              type="text" 
              placeholder="Search files" 
              className="form-input"
              style={{ fontSize: 13, padding: "6px 10px" }}
            />
          </div>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>📁 My Notebooks</div>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>📁 Recent</div>
            <div style={{ marginTop: 20 }}>
              <button onClick={() => navigate("/notebook/new")} style={{ 
                background: "none", 
                border: "none", 
                fontSize: 13, 
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 0"
              }}>
                + New notebook
              </button>
              <button onClick={handleUpload} style={{ 
                background: "none", 
                border: "none", 
                fontSize: 13, 
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 0",
                marginTop: 8
              }}>
                ⬆ Upload
              </button>
            </div>
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="notebook-editor-area" style={{ flex: 1, overflow: "auto", background: "#f5f5f5" }}>
          <div style={{ maxWidth: 980, margin: "0 auto", padding: "clamp(12px, 3vw, 24px)" }}>
            {/* Notebook Title Bar */}
            <div style={{ 
              background: "#fff", 
              padding: "16px 20px",
              borderRadius: "8px 8px 0 0",
              borderBottom: "1px solid #e0e0e0",
              marginBottom: 0
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{ 
                      fontSize: 16, 
                      fontWeight: 500, 
                      border: "none", 
                      outline: "none",
                      background: "transparent",
                      width: "100%",
                      maxWidth: 400
                    }}
                    placeholder="Untitled Notebook"
                  />
                  <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>• Last saved {lastSaved.toLocaleTimeString()}</div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={handleShare} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}>🔗 Share</button>
                  <button onClick={handleSave} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}>💾 Save</button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ 
              background: "#fff", 
              padding: "12px 20px",
              borderBottom: "1px solid #e0e0e0",
              display: "flex",
              gap: 12,
              marginBottom: 16
            }}>
              <button 
                onClick={() => addCell("python")} 
                style={{ 
                  background: "#ff6f00", 
                  color: "#fff", 
                  border: "none", 
                  padding: "8px 16px",
                  borderRadius: 4,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                + Code
              </button>
              <button 
                onClick={runAll} 
                style={{ 
                  background: "#fff", 
                  color: "#333", 
                  border: "1px solid #dadce0", 
                  padding: "8px 16px",
                  borderRadius: 4,
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                ▶ Run all
              </button>
            </div>

            {/* Code Cells */}
            {cells.map((cell, idx) => (
              <div
                key={cell.id}
                style={{
                  background: "#fff",
                  border: "2px solid #e0e0e0",
                  borderRadius: 8,
                  marginBottom: 16,
                  overflow: "hidden",
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "#ff6f00"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "#e0e0e0"}
              >
                <div style={{ display: "flex" }}>
                  {/* Cell Sidebar */}
                  <div style={{ 
                    width: 60, 
                    background: "#f8f9fa", 
                    display: "flex", 
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "12px 8px",
                    gap: 8,
                    borderRight: "1px solid #e0e0e0"
                  }}>
                    <div style={{ fontSize: 12, color: "#666" }}>[{idx + 1}]</div>
                    <div style={{ 
                      fontSize: 18, 
                      color: cell.language === 'python' ? '#4285f4' : cell.language === 'cpp' ? '#ff6f00' : '#f4b400'
                    }}>
                      {cell.language === 'python' ? '🐍' : cell.language === 'cpp' ? '⚡' : '🟨'}
                    </div>
                    <button
                      onClick={() => runCell(cell)}
                      disabled={cell.running}
                      style={{
                        background: cell.running ? "#ccc" : "#fff",
                        border: "1px solid #dadce0",
                        borderRadius: "50%",
                        width: 32,
                        height: 32,
                        cursor: cell.running ? "not-allowed" : "pointer",
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      {cell.running ? "⋯" : "▶"}
                    </button>
                  </div>

                  {/* Cell Content */}
                  <div style={{ flex: 1 }}>
                    {/* Cell Header */}
                    <div style={{ 
                      padding: "8px 16px", 
                      background: "#f8f9fa",
                      borderBottom: "1px solid #e0e0e0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <div style={{ fontSize: 12, color: "#666", display: "flex", gap: 8, alignItems: "center" }}>
                        <span>// ⚡ {cell.language === 'cpp' ? 'C++' : cell.language.charAt(0).toUpperCase() + cell.language.slice(1)} starter</span>
                        <select
                          value={cell.language}
                          onChange={(e) => updateCell(cell.id, { language: e.target.value })}
                          style={{ 
                            fontSize: 12, 
                            padding: "2px 6px",
                            border: "1px solid #dadce0",
                            borderRadius: 3,
                            background: "#fff"
                          }}
                        >
                          <option value="python">Python</option>
                          <option value="cpp">C++</option>
                          <option value="javascript">JavaScript</option>
                        </select>
                      </div>
                      <button
                        onClick={() => removeCell(cell.id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 16,
                          color: "#666"
                        }}
                      >
                        ×
                      </button>
                    </div>

                    {/* Code Editor */}
                    <textarea
                      value={cell.code}
                      onChange={(e) => updateCell(cell.id, { code: e.target.value })}
                      style={{
                        width: "100%",
                        minHeight: 150,
                        fontFamily: "'Roboto Mono', monospace",
                        fontSize: 13,
                        border: "none",
                        resize: "vertical",
                        padding: 16,
                        background: "#fff",
                        outline: "none",
                        lineHeight: 1.6
                      }}
                      placeholder="Write your code here..."
                    />

                    {/* Input Section */}
                    <div style={{ 
                      padding: "12px 16px", 
                      background: "#f8f9fa",
                      borderTop: "1px solid #e0e0e0"
                    }}>
                      <details>
                        <summary style={{ fontSize: 12, color: "#666", cursor: "pointer", marginBottom: 8 }}>
                          Input (stdin) - Click to expand
                        </summary>
                        <textarea
                          value={cell.stdin || ""}
                          onChange={(e) => updateCell(cell.id, { stdin: e.target.value })}
                          style={{
                            width: "100%",
                            minHeight: 60,
                            fontFamily: "'Roboto Mono', monospace",
                            fontSize: 12,
                            resize: "vertical",
                            background: "#fff",
                            border: "1px solid #dadce0",
                            borderRadius: 4,
                            padding: 8,
                            marginTop: 4
                          }}
                          placeholder="Enter input for your program..."
                        />
                      </details>
                    </div>

                    {/* Output Section */}
                    {(cell.stdout || cell.stderr) && (
                      <div style={{ 
                        padding: 16, 
                        background: "#fafafa",
                        borderTop: "1px solid #e0e0e0"
                      }}>
                        <div style={{ 
                          fontSize: 12, 
                          color: "#666", 
                          marginBottom: 8,
                          display: "flex",
                          alignItems: "center",
                          gap: 8
                        }}>
                          Output • 512ms • {cell.language === 'cpp' ? 'C++' : cell.language.charAt(0).toUpperCase() + cell.language.slice(1)}
                        </div>
                        {cell.stdout && (
                          <div>
                            <div style={{ 
                              fontSize: 13, 
                              fontWeight: 600, 
                              color: "#ff6f00",
                              marginBottom: 8,
                              display: "flex",
                              alignItems: "center",
                              gap: 6
                            }}>
                              ⚡ {cell.language === 'cpp' ? 'C++' : cell.language.charAt(0).toUpperCase() + cell.language.slice(1)} Execution Completed
                            </div>
                            <pre style={{ 
                              margin: 0, 
                              fontSize: 13, 
                              color: "#333", 
                              fontFamily: "'Roboto Mono', monospace",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              lineHeight: 1.6
                            }}>{cell.stdout}</pre>
                          </div>
                        )}
                        {cell.stderr && (
                          <pre style={{ 
                            margin: cell.stdout ? "12px 0 0 0" : 0, 
                            fontSize: 13, 
                            color: "#d32f2f", 
                            background: "#ffebee", 
                            padding: 12, 
                            borderRadius: 4,
                            border: "1px solid #ffcdd2",
                            fontFamily: "'Roboto Mono', monospace",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            lineHeight: 1.6
                          }}>{cell.stderr}</pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Add Cell Buttons */}
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button 
                onClick={() => addCell("python")} 
                style={{ 
                  background: "#fff", 
                  border: "1px solid #dadce0", 
                  padding: "10px 18px",
                  borderRadius: 4,
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                + Python
              </button>
              <button 
                onClick={() => addCell("cpp")} 
                style={{ 
                  background: "#fff", 
                  border: "1px solid #dadce0", 
                  padding: "10px 18px",
                  borderRadius: 4,
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                + C++
              </button>
              <button 
                onClick={() => addCell("javascript")} 
                style={{ 
                  background: "#fff", 
                  border: "1px solid #dadce0", 
                  padding: "10px 18px",
                  borderRadius: 4,
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                + JavaScript
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewNotebook;
