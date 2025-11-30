import React, { useState } from 'react';

const ContactForm = ({ onSave, onCancel, initial = {} }) => {
  const [firstName, setFirstName] = useState(initial.first_name || '');
  const [lastName, setLastName] = useState(initial.last_name || '');
  const [displayName, setDisplayName] = useState(initial.display_name || '');
  const [title, setTitle] = useState(initial.title || '');
  const [company, setCompany] = useState(initial.company_name || '');
  const [email, setEmail] = useState(initial.email || '');
  const [phone, setPhone] = useState(initial.phone || '');
  const [linkedinUrl, setLinkedinUrl] = useState(initial.linkedin_url || '');
  const [industry, setIndustry] = useState(initial.industry || '');
  const [relationshipType, setRelationshipType] = useState(initial.relationship_type || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      first_name: firstName,
      last_name: lastName,
      display_name: displayName,
      title,
      company_name: company,
      email,
      phone,
      linkedin_url: linkedinUrl,
      industry,
      relationship_type: relationshipType,
    };
    onSave(payload);
  };

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div>
        <label>Display name</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>
      <div>
        <label>First name</label>
        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </div>
      <div>
        <label>Last name</label>
        <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      <div>
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label>Company</label>
        <input value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>
      <div>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label>Phone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div>
        <label>LinkedIn URL</label>
        <input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." />
      </div>
      <div>
        <label>Industry</label>
        <input value={industry} onChange={(e) => setIndustry(e.target.value)} />
      </div>
      <div>
        <label>Relationship type</label>
        <input value={relationshipType} onChange={(e) => setRelationshipType(e.target.value)} />
      </div>
      <div className="actions">
        <button type="submit">Save</button>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
};

export default ContactForm;
