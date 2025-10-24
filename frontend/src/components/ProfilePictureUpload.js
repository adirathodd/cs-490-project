import React, { useState, useEffect, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { authAPI } from '../services/api';
import './ProfilePictureUpload.css';

const ProfilePictureUpload = ({ onUploadSuccess }) => {
  const [profilePicture, setProfilePicture] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  // Cropper state
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [originalImageSrc, setOriginalImageSrc] = useState(null);

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

  useEffect(() => {
    fetchProfilePicture();
  }, []);

  const fetchProfilePicture = async () => {
    try {
      setLoading(true);
      const response = await authAPI.getProfilePicture();
      if (response.profile_picture_url) {
        setProfilePicture(response.profile_picture_url);
      }
    } catch (err) {
      console.error('Error fetching profile picture:', err);
      // Silently handle missing profile picture - it's normal for users to not have one yet
      // Only log errors that are actual system failures, not 404s
      if (err.response && err.response.status !== 404 && err.response.status !== 400) {
        console.error('System error loading profile picture:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError('');
    setSuccessMessage('');

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Invalid file type. Please upload a JPG, PNG, or GIF image.');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError('File size exceeds 5MB. Please choose a smaller image.');
      return;
    }

    // Store the original file
    setSelectedFile(file);

    // Create preview for cropper
    const reader = new FileReader();
    reader.onloadend = () => {
      setOriginalImageSrc(reader.result);
      setShowPreview(true);
      // Reset crop settings
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createCroppedImage = async () => {
    if (!originalImageSrc || !croppedAreaPixels) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.src = originalImageSrc;
      
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size to cropped area
        canvas.width = croppedAreaPixels.width;
        canvas.height = croppedAreaPixels.height;

        // Draw the cropped image
        ctx.drawImage(
          image,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          croppedAreaPixels.width,
          croppedAreaPixels.height
        );

        // Convert canvas to blob
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas is empty'));
            return;
          }
          
          // Create a new File object from the blob
          const croppedFile = new File([blob], selectedFile.name, {
            type: selectedFile.type,
            lastModified: Date.now(),
          });
          
          resolve(croppedFile);
        }, selectedFile.type);
      };

      image.onerror = () => {
        reject(new Error('Failed to load image'));
      };
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Create cropped image if crop area is set
      let fileToUpload = selectedFile;
      if (croppedAreaPixels) {
        try {
          fileToUpload = await createCroppedImage();
        } catch (cropError) {
          console.error('Cropping error:', cropError);
          setError('Failed to crop image. Uploading original instead...');
          // Continue with original file
        }
      }

      const response = await authAPI.uploadProfilePicture(fileToUpload);
      setProfilePicture(response.profile_picture_url);
      setSuccessMessage('Profile picture uploaded successfully!');
      setShowPreview(false);
      setSelectedFile(null);
      setPreview(null);
      setOriginalImageSrc(null);
      setCroppedAreaPixels(null);
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Call callback if provided
      if (onUploadSuccess) {
        onUploadSuccess(response.profile_picture_url);
      }

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Upload error:', err);
      
      // Provide detailed, user-friendly error messages
      let errorMessage = 'Failed to upload profile picture. Please try again.';
      
      if (err.response?.data?.error) {
        const errorData = err.response.data.error;
        
        // Check for specific error codes
        if (errorData.code === 'validation_error' && errorData.details) {
          // Handle validation errors
          const details = errorData.details;
          if (details.profile_picture) {
            errorMessage = Array.isArray(details.profile_picture) 
              ? details.profile_picture[0] 
              : details.profile_picture;
          } else {
            errorMessage = errorData.message || errorMessage;
          }
        } else if (errorData.code === 'processing_failed') {
          errorMessage = `Image processing failed: ${errorData.message}`;
        } else if (errorData.code === 'upload_failed') {
          errorMessage = `Upload failed: ${errorData.message}`;
        } else if (errorData.code === 'authentication_required') {
          errorMessage = 'Your session has expired. Please log in again.';
        } else {
          errorMessage = errorData.message || errorMessage;
        }
      } else if (err.message === 'Network Error') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (err.code === 'ECONNABORTED') {
        errorMessage = 'Upload timed out. The file might be too large or your connection is slow.';
      }
      
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleCancelPreview = () => {
    setShowPreview(false);
    setSelectedFile(null);
    setPreview(null);
    setOriginalImageSrc(null);
    setCroppedAreaPixels(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setError('');
    
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete your profile picture?')) {
      return;
    }

    setUploading(true);
    setError('');
    setSuccessMessage('');

    try {
      await authAPI.deleteProfilePicture();
      setProfilePicture(null);
      setSuccessMessage('Profile picture deleted successfully');
      
      // Call callback if provided
      if (onUploadSuccess) {
        onUploadSuccess(null);
      }

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Delete error:', err);
      if (err.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else {
        setError('Failed to delete profile picture. Please try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  const getInitials = () => {
    // You could pass user name as prop to generate initials
    return '?';
  };

  if (loading) {
    return (
      <div className="profile-picture-container">
        <div className="profile-picture-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="profile-picture-container">
      {/* Success Message */}
      {successMessage && (
        <div className="upload-success-message">
          <span className="success-icon">✓</span>
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="upload-error-message">
          <span className="error-icon">✕</span>
          {error}
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="preview-modal-overlay">
          <div className="preview-modal">
            <h3>Adjust Your Profile Picture</h3>
            
            {/* Cropper Container */}
            <div className="cropper-container">
              <Cropper
                image={originalImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Zoom Control */}
            <div className="zoom-control">
              <label htmlFor="zoom-slider">
                <span className="zoom-icon">🔍</span> Zoom
              </label>
              <input
                id="zoom-slider"
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="zoom-slider"
              />
            </div>

            <p className="preview-hint">
              Drag to reposition • Use slider to zoom • This is how your profile picture will appear
            </p>

            <div className="preview-actions">
              <button
                className="preview-cancel-btn"
                onClick={handleCancelPreview}
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                className="preview-upload-btn"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <span className="upload-spinner"></span>
                    Uploading...
                  </>
                ) : (
                  'Confirm Upload'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Current Profile Picture Display */}
      <div className="profile-picture-display">
        <div className="picture-frame">
          {profilePicture ? (
            <img
              src={profilePicture}
              alt="Profile"
              className="profile-picture-img"
            />
          ) : (
            <div className="profile-picture-placeholder">
              <span className="placeholder-initials">{getInitials()}</span>
            </div>
          )}
        </div>

        {/* Upload/Delete Controls */}
        <div className="picture-controls">
          <input
            ref={fileInputRef}
            type="file"
            id="profile-picture-input"
            accept="image/jpeg,image/jpg,image/png,image/gif"
            onChange={handleFileSelect}
            className="picture-input-hidden"
            disabled={uploading}
          />
          
          <label
            htmlFor="profile-picture-input"
            className={`picture-upload-btn ${uploading ? 'disabled' : ''}`}
          >
            <span className="upload-icon">📷</span>
            {profilePicture ? 'Change Picture' : 'Upload Picture'}
          </label>

          {profilePicture && (
            <button
              className="picture-delete-btn"
              onClick={handleDelete}
              disabled={uploading}
            >
              <span className="delete-icon">🗑️</span>
              Remove
            </button>
          )}
        </div>

        <p className="picture-help-text">
          JPG, PNG, or GIF • Max 5MB • Recommended: 400x400px
        </p>
      </div>
    </div>
  );
};

export default ProfilePictureUpload;
