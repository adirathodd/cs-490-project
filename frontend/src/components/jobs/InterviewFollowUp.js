import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { interviewsAPI } from '../../services/api';
import Icon from '../common/Icon';
import './InterviewFollowUp.css';

export default function InterviewFollowUp({ job, interview, onClose }) {
  const { userProfile, currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedContent, setGeneratedContent] = useState(null);
  const [copySuccess, setCopySuccess] = useState('');
  
  const [formData, setFormData] = useState({
    type: 'thank_you',
    tone: 'professional',
    custom_instructions: '',
  });

  const typeOptions = [
    { value: 'thank_you', label: 'Thank You Note', description: 'Send immediately after the interview' },
    { value: 'status_check', label: 'Status Check', description: 'Follow up if you haven\'t heard back' },
    { value: 'post_interview_checkin', label: 'Post-Interview Check-in', description: 'Reiterate interest after a few days' },
    { value: 'connection_request', label: 'LinkedIn Connection', description: 'Request to connect on LinkedIn' },
  ];

  const toneOptions = [
    { value: 'professional', label: 'Professional' },
    { value: 'enthusiastic', label: 'Enthusiastic' },
    { value: 'concise', label: 'Concise' },
  ];

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Construct the payload expected by the backend
      const candidateName = userProfile?.full_name || 
                            (userProfile?.first_name ? `${userProfile.first_name} ${userProfile.last_name || ''}` : '') || 
                            currentUser?.displayName || 
                            'Candidate';

      const payload = {
        interview_details: {
          role: job.title,
          company: job.company_name,
          interviewer_name: interview.interviewer_name || 'Interviewer',
          interview_date: interview.scheduled_at ? new Date(interview.scheduled_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          conversation_points: [], // Optional: could be added to UI if needed
          candidate_name: candidateName
        },
        followup_type: formData.type,
        tone: formData.tone,
        custom_instructions: formData.custom_instructions
      };

      const response = await interviewsAPI.generateFollowUp(payload);
      
      // Handle response structure (templates array vs flat object)
      if (response.templates && Array.isArray(response.templates) && response.templates.length > 0) {
        setGeneratedContent(response.templates[0]);
      } else {
        setGeneratedContent(response);
      }
    } catch (err) {
      console.error('Failed to generate follow-up:', err);
      setError(err.message || 'Failed to generate follow-up draft. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess('Copied!');
      setTimeout(() => setCopySuccess(''), 2000);
    });
  };

  return (
    <div className="modal-overlay interview-followup-modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <Icon name="mail" size="md" />
            Generate Follow-up Email
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <Icon name="x" size="sm" />
          </button>
        </div>

        <div className="modal-body">
          <div className="job-info" style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #e5e7eb' }}>
            <h4 style={{ margin: '0 0 4px 0', color: '#111827' }}>{job.title} @ {job.company_name}</h4>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
              Interview with {interview.interviewer_name || 'Interviewer'} on {new Date(interview.scheduled_at).toLocaleDateString()}
            </p>
          </div>

          {error && (
            <div className="error-banner" style={{ marginBottom: '20px' }}>
              <Icon name="alert-circle" size="sm" />
              {error}
            </div>
          )}

          <div className="followup-grid">
            {/* Left Column: Options */}
            <div className="followup-options">
              <div className="form-group">
                <label>Email Type</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {typeOptions.map(option => (
                    <label 
                      key={option.value}
                      className={`radio-card ${formData.type === option.value ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="type"
                        value={option.value}
                        checked={formData.type === option.value}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      />
                      <div className="radio-card-content">
                        <div className="radio-card-title">{option.label}</div>
                        <div className="radio-card-desc">{option.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Tone</label>
                <div className="tone-selector">
                  {toneOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      className={`tone-option ${formData.tone === option.value ? 'active' : ''}`}
                      onClick={() => setFormData({ ...formData, tone: option.value })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="custom_instructions">Custom Instructions (Optional)</label>
                <textarea
                  id="custom_instructions"
                  value={formData.custom_instructions}
                  onChange={(e) => setFormData({ ...formData, custom_instructions: e.target.value })}
                  placeholder="e.g., Mention that I really enjoyed discussing the React architecture..."
                  rows={3}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="btn-primary"
                style={{ 
                  width: '100%', 
                  justifyContent: 'center', 
                  padding: '12px',
                  marginTop: '8px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                }}
              >
                {loading ? (
                  <>
                    <span className="spinner-small"></span> Generating...
                  </>
                ) : (
                  <>
                    <Icon name="zap" size="sm" /> Generate Draft
                  </>
                )}
              </button>
            </div>

            {/* Right Column: Preview */}
            <div className="followup-preview">
              <div className="preview-header">
                <h4>Draft Preview</h4>
                {generatedContent && (
                  <div style={{ position: 'relative' }}>
                    {copySuccess && <div className="copy-feedback">{copySuccess}</div>}
                    <button 
                      className="btn-secondary" 
                      onClick={() => handleCopy(`${generatedContent.subject}\n\n${generatedContent.body}`)}
                      style={{ fontSize: '13px', padding: '6px 12px' }}
                    >
                      <Icon name="copy" size="sm" /> Copy All
                    </button>
                  </div>
                )}
              </div>

              {generatedContent ? (
                <div className="preview-content">
                  <div className="email-field">
                    <span className="email-label">Subject</span>
                    <div className="email-value">{generatedContent.subject}</div>
                  </div>
                  <div className="email-field" style={{ flex: 1 }}>
                    <span className="email-label">Body</span>
                    <textarea 
                      className="email-body"
                      value={generatedContent.body}
                      readOnly
                    />
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <Icon name="mail" size="lg" />
                  <p>Select options and click "Generate Draft" to create a personalized follow-up email.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
