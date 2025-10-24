import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import './Profile.css';

const Profile = () => {
  const { currentUser, userProfile } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const navigate = useNavigate();
  const { userId } = useParams();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!currentUser) {
          navigate('/login');
          return;
        }

        // If no userId provided or if userId matches current user, show own profile
        if (!userId || userId === currentUser.uid) {
          setProfile(userProfile);
          setLoading(false);
          return;
        }

        // If trying to access another user's profile, verify permissions
        if (currentUser.uid !== userId && !userProfile?.isAdmin) {
          setError('Unauthorized: You can only view your own profile');
          navigate('/profile');
          return;
        }

        // For admin users, fetch the requested user's profile
        if (userProfile?.isAdmin) {
          // TODO: Implement admin profile fetch
          setLoading(false);
        }
      } catch (error) {
        setError('Error loading profile: ' + error.message);
        setLoading(false);
      }
    };

    fetchProfile();
  }, [currentUser, userId, navigate, userProfile]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="profile-container">
      <h2>Profile</h2>
      {profile && (
        <div className="profile-details">
          <div className="profile-section">
            <h3>Personal Information</h3>
            <p><strong>Name:</strong> {profile.first_name} {profile.last_name}</p>
            <p><strong>Email:</strong> {profile.email}</p>
          </div>
          {/* Add more profile sections as needed */}
        </div>
      )}
    </div>
  );
};

export default Profile;