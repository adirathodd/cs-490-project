import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  auth, 
  onAuthStateChanged,
  signOut as firebaseSignOut
} from '../services/firebase';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export { AuthContext }; // Export AuthContext

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children, value: injectedValue }) => {
  // Hooks must always be called unconditionally; compute injected vs real value later
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If a test has injected a value, skip initializing real auth and mark loading false
    if (injectedValue) {
      setLoading(false);
      return;
    }
    // Be defensive in test environments where onAuthStateChanged might be mocked or missing
    const subscribe = typeof onAuthStateChanged === 'function'
      ? onAuthStateChanged
      : (_auth, callback) => {
          if (typeof callback === 'function') callback(null);
          return () => {};
        };

    const unsubscribe = subscribe(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          // Get Firebase ID token
          const token = await user.getIdToken();
          localStorage.setItem('firebaseToken', token);
          
          // Fetch user profile from backend
          const profileData = await authAPI.getCurrentUser();

          // If backend doesn't yet have a stored Google photo, prefer the Firebase user's photoURL
          // This helps show the Google profile picture immediately while the backend sync completes.
          if (user.photoURL) {
            // Merge backend profile with photoURL fallback
            const backendProfile = profileData?.profile || {};
            if (!backendProfile.portfolio_url) {
              backendProfile.portfolio_url = user.photoURL;
            }
            setUserProfile(backendProfile);
          } else {
            setUserProfile(profileData.profile);
          }
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

  const refreshUserProfile = async () => {
    if (currentUser) {
      try {
        const profileData = await authAPI.getCurrentUser();

        // Preserve photoURL from Firebase if available
        if (currentUser.photoURL) {
          const backendProfile = profileData?.profile || {};
          if (!backendProfile.portfolio_url) {
            backendProfile.portfolio_url = currentUser.photoURL;
          }
          setUserProfile(backendProfile);
        } else {
          setUserProfile(profileData.profile);
        }
      } catch (error) {
        console.error('Error refreshing user profile:', error);
        throw error;
      }
    }
  };

  const value = injectedValue || {
    currentUser,
    userProfile,
    loading,
    error,
    signOut,
    refreshToken,
    refreshUserProfile,
    setUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {(process.env.NODE_ENV === 'test' || injectedValue || !loading) && children}
    </AuthContext.Provider>
  );
};
