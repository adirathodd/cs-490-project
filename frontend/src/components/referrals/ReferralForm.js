import React, { useState, useEffect } from 'react';
import { referralAPI, jobsAPI, contactsAPI } from '../../services/api';
import Icon from '../common/Icon';
import './ReferralForm.css';
import GuidanceRenderer from '../common/GuidanceRenderer';

const ReferralForm = ({ onClose, onSuccess, editingReferral = null }) => {
  const [formData, setFormData] = useState({
    job: '',
    contact: '',
    referral_source_name: '',
    referral_source_title: '',
    referral_source_company: '',
    referral_source_email: '',
    referral_source_phone: '',
    referral_source_linkedin: '',
    relationship_strength: 'moderate',
    status: 'draft',
    request_message: '',
    notes: ''
  });

  const [jobs, setJobs] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [tone, setTone] = useState('professional');

  const [useContactMode, setUseContactMode] = useState(true);
  const isContactSelected = !!formData.contact;
  const isManualFilled = !!(formData.referral_source_name && formData.referral_source_name.trim() !== '');

  useEffect(() => {
    fetchJobs();
    fetchContacts();
    if (editingReferral) {
      setFormData(editingReferral);
    }
  }, [editingReferral]);

  const fetchJobs = async () => {
    try {
      // Use the jobsAPI.getJobs method (jobsAPI.list was the old name)
      const data = await jobsAPI.getJobs();
      // Filter out archived jobs and map to expected shape if necessary
      setJobs((data || []).filter(job => !job.archived));
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    }
  };

  const fetchContacts = async () => {
    try {
      const data = await contactsAPI.list();
      setContacts(data);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Normalize empty contact selection to null so backend clears FK
    const normalizedValue = (name === 'contact' && value === '') ? null : value;
    setFormData(prev => ({ ...prev, [name]: normalizedValue }));

    // If the user starts typing manual referral_source fields, clear contact selection and switch to manual mode
    if (name.startsWith('referral_source_')) {
      setFormData(prev => ({ ...prev, contact: null, [name]: normalizedValue }));
      if (normalizedValue) setUseContactMode(false);
      return;
    }

    // If contact is selected, populate fields (and switch to contact mode)
    if (name === 'contact' && normalizedValue) {
      setUseContactMode(true);
      const contact = contacts.find(c => c.id === normalizedValue);
      if (contact) {
        setFormData(prev => ({
          ...prev,
          referral_source_name: contact.display_name || `${contact.first_name} ${contact.last_name}`,
          referral_source_title: contact.title || '',
          referral_source_company: contact.company_name || '',
          referral_source_email: contact.email || '',
          referral_source_phone: contact.phone || '',
          referral_source_linkedin: contact.linkedin_url || ''
        }));
      }
    }
  };

  const handleGenerateMessage = async () => {
    if (!formData.job) {
      setError('Please select a job first');
      return;
    }
    if (!formData.contact && !formData.referral_source_name) {
      setError('Please select a contact or enter referral source name');
      return;
    }

    try {
      setGeneratingMessage(true);
      setError('');
      
      const payload = {
        job_id: formData.job,
        contact_id: formData.contact || undefined,
        referral_source_name: formData.referral_source_name,
        relationship_strength: formData.relationship_strength,
        tone: tone
      };

      const result = await referralAPI.generateMessage(payload);
      setAiSuggestion(result || null);
      setShowAiPanel(!!result);

      setAiSuggestion(result);
      setShowAiPanel(true);    } catch (err) {
      setError('Failed to generate message: ' + err.message);
    } finally {
      setGeneratingMessage(false);
    }
  };

  const handleUseAiMessage = () => {
    if (!aiSuggestion) return;
    setFormData(prev => ({
      ...prev,
      request_message: aiSuggestion.message || prev.request_message,
      message_tone: aiSuggestion.tone || prev.message_tone,
      optimal_timing_suggestion: (aiSuggestion.timing_guidance && aiSuggestion.timing_guidance.guidance_text) || prev.optimal_timing_suggestion,
      etiquette_guidance: aiSuggestion.etiquette_guidance || prev.etiquette_guidance,
      suggested_send_date: (aiSuggestion.timing_guidance && aiSuggestion.timing_guidance.optimal_date) || prev.suggested_send_date
    }));
    setShowAiPanel(false);

    if (aiSuggestion) {
      setFormData(prev => ({
        ...prev,
        request_message: aiSuggestion.message,
        message_tone: aiSuggestion.tone,
        optimal_timing_suggestion: aiSuggestion.timing_guidance.guidance_text,
        etiquette_guidance: aiSuggestion.etiquette_guidance,
        suggested_send_date: aiSuggestion.timing_guidance.optimal_date
      }));
      setShowAiPanel(false);
    }  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.job) {
      setError('Please select a job');
      return;
    }
    if (!formData.contact && !formData.referral_source_name) {
      setError('Please select a contact or enter referral source name');
      return;
    }

    try {
      setLoading(true);
      setError('');

      if (editingReferral) {
        const updated = await referralAPI.update(editingReferral.id, formData);
        onSuccess && onSuccess(updated);
      } else {
        const created = await referralAPI.create(formData);
        onSuccess && onSuccess(created);
      }
    } catch (err) {
      setError('Failed to save referral request: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content referral-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editingReferral ? 'Edit' : 'Create'} Referral Request</h2>
          <button className="close-btn" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="referral-form">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-section">
            <h3>Job Information</h3>
            <div className="form-group">
              <label htmlFor="job">Job Opportunity *</label>
              <select
                id="job"
                name="job"
                value={formData.job}
                onChange={handleChange}
                required
                className="form-control"
              >
                <option value="">Select a job...</option>
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>
                    {job.title} - {job.company_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-section">
            <h3>Referral Source</h3>
            <div className="form-group">
              <div className="contact-mode-toggle">
                {useContactMode ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary manual-entry-btn"
                    onClick={() => { setUseContactMode(false); setFormData(prev => ({ ...prev, contact: null })); }}
                  >
                    <Icon name="pencil" size="14" />
                    <span className="btn-text">Enter details manually</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary manual-entry-btn"
                    onClick={() => { setUseContactMode(true); setFormData(prev => ({ ...prev, referral_source_name: '', referral_source_title: '', referral_source_company: '', referral_source_email: '', referral_source_phone: '', referral_source_linkedin: '' })); }}
                  >
                    <Icon name="users" size="14" />
                    <span className="btn-text">Select from contacts</span>
                  </button>
                )}
              </div>

              {useContactMode ? (
                <>
                  <label htmlFor="contact">Contact (Optional)</label>
                  <select
                    id="contact"
                    name="contact"
                    value={formData.contact || ''}
                    onChange={handleChange}
                    className="form-control"
                  >
                    <option value="">Select a contact...</option>
                    {contacts.map(contact => (
                      <option key={contact.id} value={contact.id}>
                        {contact.display_name || `${contact.first_name} ${contact.last_name}`}
                        {contact.company_name && ` - ${contact.company_name}`}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="referral_source_name">Name *</label>
                      <input
                        type="text"
                        id="referral_source_name"
                        name="referral_source_name"
                        value={formData.referral_source_name}
                        onChange={handleChange}
                        required
                        className="form-control"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="referral_source_title">Title</label>
                      <input
                        type="text"
                        id="referral_source_title"
                        name="referral_source_title"
                        value={formData.referral_source_title}
                        onChange={handleChange}
                        className="form-control"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="referral_source_company">Company</label>
                      <input
                        type="text"
                        id="referral_source_company"
                        name="referral_source_company"
                        value={formData.referral_source_company}
                        onChange={handleChange}
                        className="form-control"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="referral_source_email">Email</label>
                      <input
                        type="email"
                        id="referral_source_email"
                        name="referral_source_email"
                        value={formData.referral_source_email}
                        onChange={handleChange}
                        className="form-control"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="referral_source_phone">Phone</label>
                      <input
                        type="tel"
                        id="referral_source_phone"
                        name="referral_source_phone"
                        value={formData.referral_source_phone}
                        onChange={handleChange}
                        className="form-control"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="referral_source_linkedin">LinkedIn URL</label>
                      <input
                        type="url"
                        id="referral_source_linkedin"
                        name="referral_source_linkedin"
                        value={formData.referral_source_linkedin}
                        onChange={handleChange}
                        className="form-control"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="relationship_strength">Relationship Strength</label>
              <select
                id="relationship_strength"
                name="relationship_strength"
                value={formData.relationship_strength}
                onChange={handleChange}
                className="form-control"
              >
                <option value="strong">Strong - Close Connection</option>
                <option value="moderate">Moderate - Regular Contact</option>
                <option value="weak">Weak - Occasional Contact</option>
                <option value="minimal">Minimal - Limited Interaction</option>
              </select>
            </div>
          </div>

          <div className="form-section">
            <h3>Request Message</h3>
            
            <div className="ai-generator-section">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="tone">Message Tone</label>
                  <select
                    id="tone"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="form-control"
                  >
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="warm">Warm</option>
                  </select>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary generate-btn"
                  onClick={handleGenerateMessage}
                  disabled={generatingMessage}
                >
                  <Icon name={generatingMessage ? 'loader' : 'sparkles'} />
                  {generatingMessage ? 'Generating...' : 'Generate AI Message'}
                </button>
              </div>
            </div>

            {showAiPanel && aiSuggestion && (
              <div className="ai-suggestion-panel">
                <h4>AI-Generated Message</h4>
                <div className="suggestion-content">
                        <div className="suggestion-subject">
                          <strong>Subject:</strong> {aiSuggestion?.subject_line || ''}
                        </div>
                        <div className="suggestion-message">
                          <pre>{aiSuggestion?.message || ''}</pre>
                        </div>

                  <div className="suggestion-subject">
                    <strong>Subject:</strong> {aiSuggestion.subject_line}
                  </div>
                  <div className="suggestion-message">
                    <pre>{aiSuggestion.message}</pre>
                  </div>                  <div className="suggestion-guidance">
                    <details>
                      <summary>Timing Guidance</summary>
                      <div className="guidance-content">
                        <GuidanceRenderer text={aiSuggestion?.timing_guidance?.guidance_text || ''} />

                        <GuidanceRenderer text={aiSuggestion.timing_guidance.guidance_text} />                      </div>
                    </details>
                    <details>
                      <summary>Etiquette Tips</summary>
                      <div className="guidance-content">
                        <GuidanceRenderer text={aiSuggestion?.etiquette_guidance || ''} />

                        <GuidanceRenderer text={aiSuggestion.etiquette_guidance} />                      </div>
                    </details>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleUseAiMessage}
                >
                  Use This Message
                </button>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="request_message">Message</label>
              <textarea
                id="request_message"
                name="request_message"
                value={formData.request_message}
                onChange={handleChange}
                rows="8"
                className="form-control"
                placeholder="Enter your referral request message here, or generate one using AI..."
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Additional Information</h3>
            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="3"
                className="form-control"
                placeholder="Any additional notes about this referral request..."
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : (editingReferral ? 'Update' : 'Create') + ' Referral Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReferralForm;
