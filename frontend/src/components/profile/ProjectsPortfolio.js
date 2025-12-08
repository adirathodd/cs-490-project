import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { projectsAPI, githubAPI } from '../../services/api';
import './ProjectsPortfolio.css';
import Icon from '../common/Icon';

const useQuery = () => new URLSearchParams(useLocation().search);

const ProjectsPortfolio = () => {
  const navigate = useNavigate();
  const query = useQuery();

  // Controls from URL
  const [q, setQ] = useState(query.get('q') || '');
  const [industry, setIndustry] = useState(query.get('industry') || '');
  const [status, setStatus] = useState(query.get('status') || '');
  const [tech, setTech] = useState(() => (query.get('tech') ? query.get('tech').split(',') : []));
  const [dateFrom, setDateFrom] = useState(query.get('date_from') || '');
  const [dateTo, setDateTo] = useState(query.get('date_to') || '');
  const [sort, setSort] = useState(query.get('sort') || 'date_desc');

  const [items, setItems] = useState([]);
  const [featuredRepos, setFeaturedRepos] = useState([]);
  const [ghError, setGhError] = useState('');
  const [ghLoading, setGhLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch with current filters
  useEffect(() => {
    const params = {};
    if (q) params.q = q;
    if (industry) params.industry = industry;
    if (status) params.status = status;
    if (tech && tech.length) params.tech = tech;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (sort) params.sort = sort;

    // Sync URL
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (Array.isArray(v)) usp.set(k, v.join(',')); else usp.set(k, v);
    });
    navigate({ search: usp.toString() }, { replace: true });

    (async () => {
      setLoading(true);
      setError('');
      try {
        const fn = projectsAPI && projectsAPI.getProjects;
        const data = typeof fn === 'function' ? await fn(params) : [];
        setItems(data || []);
      } catch (e) {
        setError(e?.message || 'Failed to load projects');
      } finally {
        setLoading(false);
      }
    })();
  }, [q, industry, status, tech, dateFrom, dateTo, sort, navigate]);

  // Fetch featured GitHub repos for portfolio view
  useEffect(() => {
    (async () => {
      setGhLoading(true);
      setGhError('');
      try {
        const featured = await githubAPI.getFeatured();
        setFeaturedRepos(featured.featured || []);
      } catch (e) {
        // Non-blocking: portfolio should still work without GitHub
        setGhError('');
      } finally {
        setGhLoading(false);
      }
    })();
  }, []);

  const industries = useMemo(() => {
    const set = new Set();
    (items || []).forEach((p) => { if (p.industry) set.add(p.industry); });
    return Array.from(set).sort();
  }, [items]);

  const technologies = useMemo(() => {
    const set = new Set();
    (items || []).forEach((p) => (p.technologies || []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [items]);

  const toggleTech = (name) => {
    setTech((prev) => {
      const has = prev.includes(name);
      if (has) return prev.filter((t) => t !== name);
      return [...prev, name];
    });
  };

  const clearFilters = () => {
    setQ(''); setIndustry(''); setStatus(''); setTech([]); setDateFrom(''); setDateTo(''); setSort('date_desc');
  };

  return (
    <div className="portfolio-container">
      <div className="page-backbar">
        <a className="btn-back" href="/dashboard" aria-label="Back to dashboard" title="Back to dashboard">← Back to Dashboard</a>
      </div>
      <h2>Project Portfolio</h2>

      <div className="filters-bar">
        <input
          className="input"
          type="search"
          placeholder="Search projects..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search projects"
        />
        <select className="select" value={industry} onChange={(e) => setIndustry(e.target.value)} aria-label="Filter by industry">
          <option value="">All Industries</option>
          {industries.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="ongoing">Ongoing</option>
          <option value="planned">Planned</option>
        </select>
        <div className="date-range">
          <label>
            From
            <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label>
            To
            <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
        </div>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort projects">
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
          <option value="relevance">Relevance</option>
          <option value="custom">Custom order</option>
          <option value="updated_desc">Recently updated</option>
        </select>
        <button className="btn" onClick={clearFilters}>Reset</button>
      </div>

      <div className="tech-filter">
        <div className="tech-chips">
          {technologies.map((t) => (
            <button
              key={t}
              className={`chip ${tech.includes(t) ? 'active' : ''}`}
              onClick={() => toggleTech(t)}
              type="button"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="info">Loading...</div>
      ) : error ? (
        <div className="error-banner">{error}</div>
      ) : (items || []).length === 0 ? (
        <div className="info">No matching projects.</div>
      ) : (
        <div className="grid">
          {(items || []).map((p) => (
            <div key={p.id} className="card" onClick={() => navigate(`/projects/${p.id}`)} role="button">
              <div className="thumb">
                {p.thumbnail_url ? (
                  <img src={p.thumbnail_url} alt={`${p.name} thumbnail`} />
                ) : (
                  <div className="placeholder">No Image</div>
                )}
              </div>
              <div className="card-body">
                <div className="card-title">
                  <h3>{p.name}</h3>
                  {p.status && <span className={`badge ${p.status}`}>{p.status}</span>}
                </div>
                <div className="meta">
                  {p.role && <span><Icon name="user" size="sm" /> {p.role}</span>}
                  {(p.start_date || p.end_date) && <span><Icon name="calendar" size="sm" /> {p.start_date || '—'} → {p.end_date || '—'}</span>}
                  {p.industry && <span><Icon name="link" size="sm" /> {p.industry}</span>}
                </div>
                {(p.technologies && p.technologies.length > 0) && (
                  <div className="tags">
                    {p.technologies.slice(0, 4).map((t, i) => <span key={`${t}-${i}`} className="tag">{t}</span>)}
                    {p.technologies.length > 4 && <span className="tag more">+{p.technologies.length - 4}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Featured GitHub Repositories in Portfolio */}
      {ghLoading ? (
        <div className="info">Loading GitHub...</div>
      ) : (featuredRepos || []).length > 0 ? (
        <div className="github-featured-section">
          <h3 style={{ margin: '16px 0' }}><Icon name="github" size="sm" /> Featured GitHub Repositories</h3>
          <div className="github-featured-grid">
            {featuredRepos.map((fr) => (
              <div key={fr.id} className="github-card">
                <div className="title">
                  <a href={fr.html_url} target="_blank" rel="noreferrer">{fr.full_name}</a>
                </div>
                <div className="meta">
                  {(fr.primary_language || '—')} • ★ {fr.stars || 0}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="info">No featured GitHub repositories.</div>
      )}
    </div>
  );
};

export default ProjectsPortfolio;
