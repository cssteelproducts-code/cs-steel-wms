import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

// Pre-warm server-side caches so first page navigation is instant.
// Fire-and-forget — errors are silently ignored.
const warmupCaches = () => {
  Promise.allSettled([
    api.get('/master/vehicle-types'),
    api.get('/master/warehouses'),
    api.get('/master/customers'),
    api.get('/master/loading-stations'),
    api.get('/trips/active'),
  ]);
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('wms_token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.get('/auth/me')
        .then(res => {
          if (res.data.success) {
            setUser(res.data.user);
            setPermissions(res.data.permissions);
            warmupCaches();
          } else {
            logout();
          }
        })
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    if (res.data.success) {
      const { token, user: userData, permissions: perms } = res.data;
      localStorage.setItem('wms_token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);
      setPermissions(perms);
      warmupCaches();
    }
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('wms_token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    setPermissions({});
  };

  const hasPermission = (menuCode, action = 'canView') => {
    if (user?.roleName === 'Admin') return true;
    return permissions[menuCode]?.[action] === 1 || permissions[menuCode]?.[action] === true;
  };

  return (
    <AuthContext.Provider value={{ user, permissions, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
