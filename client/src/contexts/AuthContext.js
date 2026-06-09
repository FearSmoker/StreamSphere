import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_API_SERVER || 'http://localhost:4000';

// Axios instance
export const api = axios.create({ baseURL: API_URL });

// Attach authentication token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Automatically refresh token on auth failure
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (
      (status === 401 || status === 403) &&
      !original._retry &&
      !original.url?.includes('/api/auth/login') &&
      !original.url?.includes('/api/auth/refresh') &&
      !original.url?.includes('/api/auth/google')
    ) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
          if (res.data?.token) {
            localStorage.setItem('token', res.data.token);
            original.headers.Authorization = `Bearer ${res.data.token}`;
            return api(original);
          }
        } catch {
          // Clear session on refresh failure and login
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth provider component
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Restore session
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await api.get('/api/users/profile');
          if (res.data?.user) setUser(res.data.user);
          else localStorage.removeItem('token');
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  // Local sign-in
  const login = async (email, password) => {
    setError(null);
    try {
      const res = await api.post('/api/auth/login', { email, password });
      if (res.data?.token) {
        localStorage.setItem('token', res.data.token);
        if (res.data.refreshToken) localStorage.setItem('refreshToken', res.data.refreshToken);
        setUser(res.data.user);
        return res.data.user;
      }
      throw new Error(res.data.message || 'Login failed');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login failed';
      setError(msg);
      throw new Error(msg);
    }
  };

  // Redirect to Google login
  const loginWithGoogle = useCallback(() => {
    // Redirect browser to backend OAuth route
    window.location.href = `${API_URL}/api/auth/google`;
  }, []);

  // Handle Google OAuth callback
  const handleOAuthCallback = useCallback(async (token, refreshToken) => {
    localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);

    // Get user profile
    const res = await api.get('/api/users/profile');
    if (res.data?.user) {
      setUser(res.data.user);
      return res.data.user;
    }
    throw new Error('Failed to load profile after Google sign-in');
  }, []);

  // User registration
  const register = async (username, email, password, avatar = '') => {
    setError(null);
    try {
      const res = await api.post('/api/auth/register', { username, email, password, avatar, role: 'user' });
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Registration failed';
      setError(msg);
      throw new Error(msg);
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  // Update user profile
  const updateProfile = async (profileData) => {
    setError(null);
    try {
      const res = await api.put('/api/users/profile', profileData);
      if (res.data?.user) {
        setUser(res.data.user);
        return res.data.user;
      }
      throw new Error(res.data.message || 'Update failed');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Profile update failed';
      setError(msg);
      throw new Error(msg);
    }
  };

  // Toggle watchlist item
  const toggleWatchlist = async (videoId, isWatchlisted) => {
    try {
      if (isWatchlisted) {
        await api.delete(`/api/users/watchlist/${videoId}`);
        setUser((prev) => ({ ...prev, watchlist: prev.watchlist.filter((id) => id !== videoId) }));
      } else {
        await api.post('/api/users/watchlist', { videoId });
        setUser((prev) => ({ ...prev, watchlist: [...(prev.watchlist || []), videoId] }));
      }
    } catch (err) {
      console.error('[auth] toggleWatchlist failed:', err);
      throw err;
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    loginWithGoogle,
    handleOAuthCallback,
    register,
    logout,
    updateProfile,
    toggleWatchlist,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
