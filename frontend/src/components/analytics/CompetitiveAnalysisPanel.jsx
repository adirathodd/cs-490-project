import React, { useEffect, useState } from 'react';
import { jobsAPI } from '../../services/api';

const card = { padding: 16, borderRadius: 8, background: '#fff', border: '1px solid #e5e7eb', marginBottom: 16 };
const sectionTitle = { fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#1f2937' };

const jobTypeOptions = [
  { id: 'ft', label: 'Full-time' },
  { id: 'pt', label: 'Part-time' },
  { id: 'contract', label: 'Contract' },
  { id: 'temp', label: 'Temporary' },
  { id: 'intern', label: 'Internship' },
];

const createDefaultJobTypeState = () =>
  jobTypeOptions.reduce((acc, option) => {
    acc[option.id] = true;
    return acc;
  }, {});

export default function CompetitiveAnalysisPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(() => ({
    startDate: '',
    endDate: '',
    salaryMin: '',
    salaryMax: '',
    jobTypes: createDefaultJobTypeState(),
  }));

  const buildParams = (currentFilters) => {
    const params = {};
    if (currentFilters.startDate) params.start_date = currentFilters.startDate;
    if (currentFilters.endDate) params.end_date = currentFilters.endDate;
    const selectedJobTypes = Object.entries(currentFilters.jobTypes)
      .filter(([, checked]) => checked)
      .map(([key]) => key);
    if (selectedJobTypes.length) params.job_types = selectedJobTypes;
    if (currentFilters.salaryMin !== '') {
      const min = parseFloat(currentFilters.salaryMin);
      if (!Number.isNaN(min)) params.salary_min = min;
    }
    if (currentFilters.salaryMax !== '') {
      const max = parseFloat(currentFilters.salaryMax);
      if (!Number.isNaN(max)) params.salary_max = max;
    }
    return params;
  };

  const loadCompetitive = async (activeFilters = filters) => {
    setLoading(true);
    try {
      const params = buildParams(activeFilters);
      const res = await jobsAPI.getCompetitiveAnalysis(params);
      setData(res);
      setError('');
    } catch (e) {
      console.error('Competitive analysis error', e);
      setError('Failed to load competitive analysis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompetitive();
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleJobTypeToggle = (id) => {
    setFilters((prev) => ({
      ...prev,
      jobTypes: { ...prev.jobTypes, [id]: !prev.jobTypes[id] },
    }));
  };

  const handleResetFilters = () => {
    const resetState = {
      startDate: '',
      endDate: '',
      salaryMin: '',
      salaryMax: '',
      jobTypes: createDefaultJobTypeState(),
    };
    setFilters(resetState);
    loadCompetitive(resetState);
  };

  if (loading) return <div style={{ padding: 16 }}>Loading competitive analysis...</div>;
  if (error) return <div style={{ padding: 16, color: '#b91c1c' }}>{error}</div>;
  if (!data) return null;

  const {
    cohort,
    user_metrics = {},
    peer_benchmarks = {},
    skill_gaps = [],
    differentiators = [],
    recommendations = {},
    progression = {},
    employment = {},
  } = data;

  const metricCard = (title, userValue, peerValue, suffix = '') => {
    const delta = peerValue ? Math.round((userValue - peerValue) * 10) / 10 : 0;
    const deltaColor = delta >= 0 ? '#059669' : '#dc2626';
    const deltaLabel = `${delta >= 0 ? '+' : ''}${delta}${suffix}`;
    return (
      <div style={{ ...card, flex: '1 1 220px' }}>
        <div style={{ fontSize: 14, color: '#6b7280' }}>{title}</div>
        <div style={{ fontSize: 20, fontWeight: 600, marginTop: 2, color: '#6b7280' }}>You: {userValue}{suffix}</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>Peers: {peerValue}{suffix}</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6, color: deltaColor }}>Delta {deltaLabel}</div>
      </div>
    );
  };

  const renderEmployment = () => {
    const user = employment.user || {};
    const peers = employment.peers || {};
    return (
      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ ...sectionTitle, marginBottom: 8 }}>Employment snapshot (same level)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Average positions held</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>You: {user.avg_positions ?? 0}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Peers: {peers.avg_positions ?? 0}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Average years worked</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>You: {user.avg_years ?? 0}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Peers: {peers.avg_years ?? 0}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Competitive Analysis</h2>
        <p style={{ color: '#6b7280', margin: '6px 0 0' }}>
          Benchmark your funnel against peers in your industry and experience level. Identify skill gaps and differentiation opportunities.
        </p>
      </div>

      <div style={{ ...card }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label htmlFor="start-date">Start Date</label>
            <input id="start-date" type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} />
          </div>
          <div>
            <label htmlFor="end-date">End Date</label>
            <input id="end-date" type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} />
          </div>
          <div>
            <label htmlFor="salary-min">Salary Min</label>
            <input id="salary-min" type="number" value={filters.salaryMin} onChange={(e) => handleFilterChange('salaryMin', e.target.value)} />
          </div>
          <div>
            <label htmlFor="salary-max">Salary Max</label>
            <input id="salary-max" type="number" value={filters.salaryMax} onChange={(e) => handleFilterChange('salaryMax', e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {jobTypeOptions.map((opt) => (
            <label key={opt.id} htmlFor={`jobtype-${opt.id}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input id={`jobtype-${opt.id}`} type="checkbox" checked={filters.jobTypes[opt.id]} onChange={() => handleJobTypeToggle(opt.id)} />
              {opt.label}
            </label>
          ))}
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={() => loadCompetitive(filters)}>Apply Filters</button>
          <button type="button" className="btn-ghost" onClick={handleResetFilters}>Reset</button>
          <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: 13 }}>
          <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: 13 }}>
            Cohort: {cohort?.industry || 'N/A'} | {cohort?.experience_level || 'N/A'} | Peers: {cohort?.sample_size || 0}
          </span>
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {metricCard('Applications / week', user_metrics.apps_per_week || 0, peer_benchmarks.apps_per_week || 0)}
        {metricCard('Response rate %', user_metrics.response_rate || 0, peer_benchmarks.response_rate || 0, '%')}
        {metricCard('Interview rate %', user_metrics.interview_rate || 0, peer_benchmarks.interview_rate || 0, '%')}
        {metricCard('Offer rate %', user_metrics.offer_rate || 0, peer_benchmarks.offer_rate || 0, '%')}
      </div>

      {renderEmployment()}

      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ ...sectionTitle, marginBottom: 8 }}>Progression Benchmarks (next level)</div>
        <p style={{ color: '#6b7280', marginTop: 0 }}>
          Comparing to peers in higher experience levels within your industry.
        </p>
        {progression?.metrics ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {metricCard('Apps / week', user_metrics.apps_per_week || 0, progression.metrics.apps_per_week || 0)}
              {metricCard('Response %', user_metrics.response_rate || 0, progression.metrics.response_rate || 0, '%')}
              {metricCard('Interview %', user_metrics.interview_rate || 0, progression.metrics.interview_rate || 0, '%')}
              {metricCard('Offer %', user_metrics.offer_rate || 0, progression.metrics.offer_rate || 0, '%')}
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Next-step skills to add</div>
              {progression.skill_gaps && progression.skill_gaps.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {progression.skill_gaps.map((g) => (
                    <div key={g.name}>{g.name} - {g.prevalence}% of higher-level peers</div>
                  ))}
                </div>
              ) : (
                <p className="muted">No major gaps found versus higher-level peers.</p>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
              Higher-level peer sample: {progression.sample_size || 0}
            </div>
          </>
        ) : (
          <p className="muted" style={{ marginTop: 8 }}>
            Not enough higher-level peers yet. Make sure your profile includes industry and experience level, and higher-level peers have recent applications.
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 12 }}>
        <div style={card}>
          <div style={sectionTitle}>Skill gaps (vs peers)</div>
          {skill_gaps.length === 0 ? <p className="muted">No major gaps detected.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {skill_gaps.map((g) => (
                <div key={g.name}>{g.name} - {g.prevalence}% of peers have this skill</div>
              ))}
            </div>
          )}
        </div>
        <div style={card}>
          <div style={sectionTitle}>Differentiators to highlight</div>
          {differentiators.length === 0 ? <p className="muted">Add unique projects or cross-domain skills.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {differentiators.map((d) => (
                <div key={d.name}>{d.name} - {d.note}</div>
              ))}
            </div>
          )}
        </div>
        <div style={card}>
          <div style={sectionTitle}>Recommendations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(recommendations.deterministic || []).map((r, idx) => <div key={`det-${idx}`}>{r}</div>)}
            {(recommendations.ai || []).map((raw, idx) => {
              let cleaned = String(raw ?? '');
              try {
                cleaned = cleaned.replace(/^here are.*?:\s*/i, '').replace(/^[*-]\s*/g, '');
              } catch (e) {
                console.error('Failed to clean recommendation text', e, raw);
              }
              return <div key={`ai-${idx}`}>{cleaned}</div>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}





