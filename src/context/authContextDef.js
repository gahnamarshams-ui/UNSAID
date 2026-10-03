import { createContext } from 'react';

export const AuthContext = createContext({
  currentUser: null,
  userProfile: null,
  loading: true,
  isAuthenticated: false,
  isAdmin: false,
  isConfigured: false,
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
  resetPassword: async () => {},
  refreshProfile: async () => {},
  updateProfileData: async () => {},
});
