import { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";

export function useAuth() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    
    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            const me = await api("/api/auth/me");
            // MongoDB returns user with _id, email, name
            // JSON file system returns user with id, email, name
            // Normalize the user object
            const normalizedUser = {
                id: me._id || me.id,
                email: me.email,
                name: me.name
            };
            setUser(normalizedUser);
        }
        catch (error) {
            setUser(null);
        }
        finally {
            setLoading(false);
        }
    }, []);
    
    useEffect(() => {
        // Only try to refresh if we have a token
        const token = localStorage.getItem("auth_token");
        if (token) {
            refresh();
        } else {
            // No token, set not loading immediately
            setLoading(false);
        }
    }, [refresh]);
    
    const logout = useCallback(async () => {
        // Clear stored token and local user state
        try { 
            localStorage.removeItem("auth_token"); 
        } catch { }
        setUser(null);
        setLoading(false);
    }, []);
    
    return { user, loading, refresh, logout, setUser };
}