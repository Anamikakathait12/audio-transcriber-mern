import { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, registerUser, getMe } from '../api/transcriptApi.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  /**
   * On application load, restore session from localStorage if token exists
   */
  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = localStorage.getItem('token');
      if (!savedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await getMe();
        if (response && response.user) {
          setUser(response.user);
          setToken(savedToken);
        } else {
          throw new Error('User data not found');
        }
      } catch (error) {
        console.warn('Session restoration failed, clearing token:', error.message);
        localStorage.removeItem('token');
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();

    // Listen for global 401 unauthorized events from Axios response interceptor
    const handleUnauthorizedEvent = () => {
      setUser(null);
      setToken(null);
      localStorage.removeItem('token');
    };

    window.addEventListener('auth:unauthorized', handleUnauthorizedEvent);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorizedEvent);
  }, []);

  /**
   * Log in user with credentials and persist token
   */
  const login = async (email, password) => {
    const data = await loginUser(email, password);
    if (data?.token && data?.user) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  /**
   * Register new user account and persist token
   */
  const register = async (name, email, password) => {
    const data = await registerUser(name, email, password);
    if (data?.token && data?.user) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  /**
   * Log out user and wipe local auth state
   */
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setToken(null);
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(user && token),
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to access authentication context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

