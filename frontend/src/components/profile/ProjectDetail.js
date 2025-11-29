import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { projectsAPI } from '../../services/api';
import './ProjectDetail.css';
import Icon from '../common/Icon';

const ProjectDetail = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    projectsAPI
      .getProject(projectId)
      .then((data) => setItem(data))
      .catch((e) => setError(e?.message || 'Failed to load project'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const printPage = () => window.print();

  if (loading) return <div className="detail-container">Loading...</div>;
  if (error) return <div className="detail-container error-banner">{error}</div>;
  if (!item) return null;

  return (
    <div className="detail-container">
      <div className="page-backbar">
        <button className="btn-back" onClick={() => navigate(-1)}>← Back</button>
        <div className="actions">
          <button className="btn" onClick={copyLink}>{copied ? 'Link Copied' : 'Share Link'}</button>
          <button className="btn primary" onClick={printPage}>Print Summary</button>
        </div>
      </div>

      <div className="header">
        <h2>{item.name}</h2>
        {item.status && <span className={`badge ${item.status}`}>{item.status}</span>}
      </div>

      {(item.start_date || item.end_date || item.role || item.industry || item.category) && (
        <div className="meta">
          {item.role && <span><Icon name="user" size="sm" /> {item.role}</span>}
          {(item.start_date || item.end_date) && <span><Icon name="calendar" size="sm" /> {item.start_date || '—'} → {item.end_date || '—'}</span>}
          {item.team_size != null && <span><Icon name="users" size="sm" /> Team size: {item.team_size}</span>}
          {item.industry && <span><Icon name="link" size="sm" /> {item.industry}</span>}
          {item.category && <span><Icon name="folder" size="sm" /> {item.category}</span>}
          {item.project_url && <a href={item.project_url} target="_blank" rel="noreferrer"><Icon name="link" size="sm" /> Link</a>}
        </div>
      )}

      {(item.technologies && item.technologies.length > 0) && (
        <div className="tags">
          {item.technologies.map((t, i) => <span key={`${t}-${i}`} className="tag">{t}</span>)}
        </div>
      )}

      {(item.media && item.media.length > 0) && (
        <div className="media-grid">
          {item.media.map((m) => (
            <div key={m.id} className="media-item">
              <img src={m.image_url} alt={m.caption || 'screenshot'} />
            </div>
          ))}
        </div>
      )}

      {item.description && (
        <section className="section">
          <h3>Description</h3>
          <p>{item.description}</p>
        </section>
      )}

      {item.collaboration_details && (
        <section className="section">
          <h3>Collaboration</h3>
          <p>{item.collaboration_details}</p>
        </section>
      )}

      {item.outcomes && (
        <section className="section">
          <h3>Outcomes</h3>
          <p>{item.outcomes}</p>
        </section>
      )}
    </div>
  );
};

export default ProjectDetail;
