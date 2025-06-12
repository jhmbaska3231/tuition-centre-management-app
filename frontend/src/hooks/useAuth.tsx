// frontend/src/hooks/useAuth.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import AuthService from '../services/auth';
import type { User, AuthContextType, RegisterRequest } from '../types';

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (AuthService.isAuthenticated()) {
          const response = await AuthService.getCurrentUser();
          setUser(response.user);
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        AuthService.logout();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const response = await AuthService.login({ email, password });
    setUser(response.user);
  };

  const register = async (registrationData: RegisterRequest): Promise<void> => {
    const response = await AuthService.register(registrationData);
    setUser(response.user);
  };

  const logout = (): void => {
    AuthService.logout();
    setUser(null);
  };

  const updateUserProfile = (updatedUser: User): void => {
    setUser(updatedUser);
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    updateUserProfile,
    loading,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};