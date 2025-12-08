import React, { useState } from 'react';
import { linkedInAPI } from '../../services/api';
import Icon from '../common/Icon';
import LoadingSpinner from '../common/LoadingSpinner';
import APIErrorBanner from '../common/APIErrorBanner'; // UC-117: User-facing API error handling
import './LinkedIn.css';

const NetworkingMessageGenerator = ({ onClose, onUseMessage }) => {
  const [formData, setFormData] = useState({
    recipient_name: '',
    recipient_title: '',
    company_name: '',
    context: '',
    purpose: 'connection_request',
    tone: 'professional'
  });

  const [generatedMessage, setGeneratedMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // UC-117: Changed to null for structured errors

  const purposes = [
    { value: 'connection_request', label: 'Connection Request' },
    { value: 'informational_interview', label: 'Informational Interview' },
    { value: 'job_inquiry', label: 'Job Inquiry' },
    { value: 'referral_request', label: 'Referral Request' },
    { value: 'follow_up', label: 'Follow-up' }
  ];

  const tones = [
    { value: 'professional', label: 'Professional' },
    { value: 'casual', label: 'Casual' },
    { value: 'warm', label: 'Warm' }
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null); // UC-117: Clear errors on user input
  };

  const handleGenerate = async () => {
    if (!formData.recipient_name) {
      setError({ message: 'Please enter recipient name' }); // UC-117: Structured error
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await linkedInAPI.generateNetworkingMessage(formData);
      setGeneratedMessage(result);
    } catch (err) {
      // UC-117: Set structured error for user-facing display
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyMessage = () => {
    if (generatedMessage) {
      navigator.clipboard.writeText(generatedMessage.message);
      alert('Message copied to clipboard!');
    }
  };

  return (
    <div className="linkedin-message-generator">
      <div className="generator-header">
        <h3>
          <Icon name="message-square" size="lg" />
          LinkedIn Networking Message Generator
        </h3>
        {onClose && (
          <button onClick={onClose} className="close-btn">
            <Icon name="x" size="sm" />
          </button>
        )}
      </div>

      <div className="generator-form">
        <div className="form-group">
          <label>Recipient Name *</label>
          <input
            type="text"
            name="recipient_name"
            value={formData.recipient_name}
            onChange={handleChange}
            placeholder="John Doe"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Their Title</label>
            <input
              type="text"
              name="recipient_title"
              value={formData.recipient_title}
              onChange={handleChange}
              placeholder="Software Engineer"
            />
          </div>

          <div className="form-group">
            <label>Company</label>
            <input
              type="text"
              name="company_name"
              value={formData.company_name}
              onChange={handleChange}
              placeholder="Tech Corp"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Context/Connection</label>
          <textarea
            name="context"
            value={formData.context}
            onChange={handleChange}
            placeholder="We met at the tech conference last week..."
            rows={3}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Purpose</label>
            <select name="purpose" value={formData.purpose} onChange={handleChange}>
              {purposes.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Tone</label>
            <select name="tone" value={formData.tone} onChange={handleChange}>
              {tones.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* UC-117: User-facing API error handling with graceful fallback */}
        {error && (
          <APIErrorBanner 
            serviceName="LinkedIn API"
            error={error}
            severity={error.message?.includes('recipient name') ? 'info' : 'warning'}
            onRetry={error.message?.includes('recipient name') ? null : handleGenerate}
          />
        )}

        <button
          onClick={handleGenerate}
          className="generate-btn"
          disabled={loading}
        >
          {loading ? <LoadingSpinner size="sm" /> : <Icon name="sparkles" size="sm" />}
          {loading ? 'Generating...' : 'Generate Message'}
        </button>
      </div>

      {generatedMessage && (
        <div className="generated-message">
          <div className="message-header">
            <h4>Generated Message</h4>
            <span className="character-count">
              {generatedMessage.character_count} characters
            </span>
          </div>

          <div className="message-content">
            <p>{generatedMessage.message}</p>
          </div>

          <div className="message-actions">
            <button onClick={handleCopyMessage} className="copy-btn">
              <Icon name="copy" size="sm" />
              Copy to Clipboard
            </button>
            {onUseMessage && (
              <button
                onClick={() => onUseMessage(generatedMessage.message)}
                className="use-btn"
              >
                <Icon name="check" size="sm" />
                Use This Message
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkingMessageGenerator;
