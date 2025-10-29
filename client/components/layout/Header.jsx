import { useAuth } from "../../hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
export default function Header() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    return (
      <header className="header">
        <div className="container header-content">
          <div className="header-left">
            <Link to="/" className="logo-link">
              <div className="logo-icon"/>
              <span className="logo-text">CollabX Notebook</span>
            </Link>
          </div>
          <div className="header-right">
            {user ? (
              <>
                <button onClick={() => navigate("/dashboard")} className="button button-secondary">
                  Dashboard
                </button>
                <button
                  onClick={async () => {
                    try {
                      const resp = await fetch("/api/notebooks", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({}),
                      });
                      const nb = await resp.json();
                      navigate(`/?nb=${nb.id}`);
                    } catch {
                      navigate("/");
                    }
                  }}
                  className="button button-primary"
                >
                  + New notebook
                </button>
                <span className="user-name">{user.name}</span>
                <button
                  onClick={async () => {
                    await logout();
                    navigate("/auth");
                  }}
                  className="button button-secondary"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate("/auth")}
                  className="button button-secondary"
                >
                  Sign in
                </button>
                <button
                  onClick={() => navigate("/auth?mode=signup")}
                  className="button button-primary"
                >
                  Create account
                </button>
              </>
            )}
          </div>
        </div>
      </header>
    );
}
