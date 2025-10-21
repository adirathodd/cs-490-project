import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  auth, 
  onAuthStateChanged,
  signOut as firebaseSignOut
} from '../services/firebase';
import { authAPI } from '../services/api';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          // Get Firebase ID token
          const token = await user.getIdToken();
          localStorage.setItem('firebaseToken', token);
          
          // Fetch user profile from backend
          const profileData = await authAPI.getCurrentUser();
          setUserProfile(profileData.profile);
        } catch (error) {
          console.error('Error fetching user profile:', error);
          setError(error.message);
        }
      } else {
        localStorage.removeItem('firebaseToken');
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      localStorage.removeItem('firebaseToken');
      setCurrentUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const refreshToken = async () => {
    if (currentUser) {
      const token = await currentUser.getIdToken(true);
      localStorage.setItem('firebaseToken', token);
      return token;
    }
    return null;
  };

  const value = {
    currentUser,
    userProfile,
    loading,
    error,
    signOut,
    refreshToken,
    setUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
