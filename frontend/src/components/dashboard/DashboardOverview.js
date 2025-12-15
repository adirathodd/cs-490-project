import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI, skillsAPI, educationAPI, projectsAPI } from '../../services/api';
import api from '../../services/api';
import SummaryCard from './SummaryCard';
import ProfileProgress from './ProfileProgress';
import SkillDistribution from './SkillDistribution';
import ActivityTimeline from './ActivityTimeline';
import ExportProfile from './ExportProfile';
import LoadingSpinner from '../common/LoadingSpinner';

const section = { maxWidth: 1120, margin: '0 auto', width: '100%' };
const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  justifyContent: 'center',
  alignItems: 'stretch',
  gap: 12,
};
const twoCol = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  alignItems: 'start',
};

const DashboardOverview = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [skills, setSkills] = useState([]);
  const [education, setEducation] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employmentCount, setEmploymentCount] = useState(0);
  const [suggestedContacts, setSuggestedContacts] = useState([]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        // Fetch in parallel where possible
        const [me, skillsRes, eduRes, projRes, empList, contactSuggestions] = await Promise.all([
          authAPI.getCurrentUser().catch(() => null),
          (skillsAPI?.getSkills ? skillsAPI.getSkills() : Promise.resolve([])).catch(() => []),
          (educationAPI?.getEducations ? educationAPI.getEducations() : Promise.resolve({ results: [] })).catch(() => ({ results: [] })),
          (projectsAPI?.getProjects ? projectsAPI.getProjects() : Promise.resolve([])).catch(() => []),
          // Employment endpoint returns { employment_history: [...], total_entries: N }
          authAPI.getEmploymentHistory()
            .then((res) => res?.employment_history || [])
            .catch(() => []),
          // Fetch suggested contacts
          api.get('/contact-suggestions', { params: { status: 'suggested' } })
            .then(res => res.data || [])
            .catch(() => []),
        ]);

        if (!isMounted) return;
        setProfile(me?.profile || null);
        setSkills(Array.isArray(skillsRes) ? skillsRes : (skillsRes?.results || []));
        setEducation(Array.isArray(eduRes) ? eduRes : (eduRes?.results || []));
        setProjects(Array.isArray(projRes) ? projRes : (projRes?.results || []));
        setEmploymentCount(Array.isArray(empList) ? empList.length : 0);
        setSuggestedContacts((Array.isArray(contactSuggestions) ? contactSuggestions : []).slice(0, 3));
        setError(null);
      } catch (e) {
        if (!isMounted) return;
        setError('Failed to load overview');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const _profileProgress = useMemo(() => {
    // Simple heuristic: required buckets present
    let total = 5, done = 0;
    if (profile) done += 1;
    if (employmentCount > 0) done += 1;
    if ((skills || []).length > 0) done += 1;
    if ((education || []).length > 0) done += 1;
    if ((projects || []).length > 0) done += 1;
    const percent = Math.round((done / total) * 100);
    const suggestions = [];
    if (!profile) suggestions.push('Complete your basic profile information');
    if (employmentCount === 0) suggestions.push('Add an employment entry');
    if ((skills || []).length === 0) suggestions.push('Add at least 3 relevant skills');
    if ((education || []).length === 0) suggestions.push('Add an education entry');
    if ((projects || []).length === 0) suggestions.push('Showcase a project you worked on');
    return { percent, suggestions };
  }, [profile, skills, education, projects, employmentCount]);

  const skillChartData = useMemo(() => {
    const mapLevel = (lvl) => (lvl || '').toLowerCase();
    return (skills || []).slice(0, 5).map(s => {
      const level = mapLevel(s.level);
      return {
        name: s.skill_name || s.name || 'Skill',
        level,
        // If level is missing, provide a numeric value so the chart still shows a bar
        value: level ? undefined : 100,
      };
    });
  }, [skills]);

  // Section-specific completion and overall strength scoring
  const completeness = useMemo(() => {
    // Helpers
    const present = (v) => typeof v === 'string' ? v.trim().length > 0 : !!v;

    // Profile fields
    const profileReq = [
      present(profile?.first_name),
      present(profile?.last_name),
      present(profile?.headline),
      present(profile?.summary),
    ];
    const profileOpt = [
      present(profile?.phone),
      present(profile?.city) && present(profile?.state),
      present(profile?.industry),
      present(profile?.experience_level),
    ];
    const profileReqDone = profileReq.filter(Boolean).length;
    const profileOptDone = profileOpt.filter(Boolean).length;
    const profileReqPct = Math.round((profileReqDone / profileReq.length) * 100);
    const profileOptPct = Math.round((profileOptDone / profileOpt.length) * 100);
    const profilePct = Math.round((profileReqPct * 0.7) + (profileOptPct * 0.3));

    // Employment
    const employmentPct = Math.min(100, Math.round((employmentCount > 0 ? 100 : 0)));

    // Skills (target 5 for full credit)
    const skillTarget = 5;
    const skillsPct = Math.min(100, Math.round(((skills?.length || 0) / skillTarget) * 100));

    // Education (at least 1)
    const educationPct = Math.min(100, Math.round(((education?.length || 0) >= 1 ? 100 : 0)));

    // Projects (target 2)
    const projectTarget = 2;
    const projectsPct = Math.min(100, Math.round(((projects?.length || 0) / projectTarget) * 100));

    // Overall strength score (weights sum to 100)
    const weights = { profile: 25, employment: 25, skills: 20, education: 15, projects: 15 };
    const score = Math.round(
      (profilePct * weights.profile + employmentPct * weights.employment + skillsPct * weights.skills + educationPct * weights.education + projectsPct * weights.projects) / 100
    );

    // Band text
    const band = score >= 95 ? 'Star' : score >= 80 ? 'Strong' : score >= 60 ? 'Developing' : 'Getting Started';

    // Suggestions (augment existing ones)
    const sug = [];
    if (!present(profile?.headline)) sug.push('Add a concise headline that reflects your role.');
    if (employmentCount === 0) sug.push('Add at least one employment entry.');
    if ((skills?.length || 0) < 5) sug.push('Add at least 5 relevant skills.');
    if ((education?.length || 0) < 1) sug.push('Add an education entry.');
    if ((projects?.length || 0) < 2) sug.push('Add 1–2 projects to showcase impact.');

    // Achievements
    const badges = [];
    if (score >= 60) badges.push('Milestone: 60%+');
    if (score >= 80) badges.push('Profile Pro: 80%+');
    if (score >= 95) badges.push('Star: 95%+');

    // Section breakdown list
    const sections = [
      { name: 'Profile', pct: profilePct, required: profileReq.length - profileReqDone, optional: profileOpt.length - profileOptDone },
      { name: 'Employment', pct: employmentPct, required: employmentCount > 0 ? 0 : 1, optional: 0 },
      { name: 'Skills', pct: skillsPct, required: Math.max(0, 5 - (skills?.length || 0)), optional: 0 },
      { name: 'Education', pct: educationPct, required: (education?.length || 0) > 0 ? 0 : 1, optional: 0 },
      { name: 'Projects', pct: projectsPct, required: Math.max(0, 2 - (projects?.length || 0)), optional: 0 },
    ];

    return { score, band, sections, suggestions: sug, profilePct, employmentPct, skillsPct, educationPct, projectsPct };
  }, [profile, employmentCount, skills, education, projects]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', transform: 'translateY(5vh)' }}>
      <LoadingSpinner size={48} />
    </div>
  );
  if (error) return <div style={{ color: '#b91c1c' }}>{error}</div>;

  const exportPayload = { profile, employmentCount, skills, education, projects, generatedAt: new Date().toISOString() };

  return (
    <div style={{ display: 'grid', gap: 12, ...section }}>
      <div style={grid}>
        <SummaryCard title="Employment" value={employmentCount} hint="Total entries" action={null} />
        <SummaryCard title="Skills" value={skills.length} hint="Total skills" action={null} />
        <SummaryCard title="Education" value={education.length} hint="Total entries" action={null} />
        <SummaryCard title="Projects" value={projects.length} hint="Total entries" action={<ExportProfile payload={exportPayload} />} />
      </div>
      <div style={section}>
        {/* Overall completeness */}
        <ProfileProgress percent={completeness.score} suggestions={completeness.suggestions} />
        {/* Strength score & badges */}
        <div className="dashboard-card" style={{ padding: 14, marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Profile Strength</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{completeness.score}/100 <span style={{ fontSize: 14, color: '#6b7280' }}>({completeness.band})</span></div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {completeness.band === 'All‑Star' && <span className="badge">All‑Star</span>}
              {completeness.score >= 80 && <span className="badge">Profile Pro</span>}
              {completeness.score >= 60 && <span className="badge">Milestone 60%</span>}
            </div>
          </div>
        </div>
        {/* Sections breakdown */}
        <div className="dashboard-card" style={{ padding: 14, marginTop: 12 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Section Completion</div>
          {completeness.sections.map((s) => (
            <div key={s.name} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 140px', alignItems: 'center', gap: 8, margin: '8px 0' }}>
              <div style={{ fontSize: 13, color: '#374151' }}>{s.name}</div>
              <div style={{ height: 10, background: '#e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${s.pct}%`, height: '100%', background: '#10b981' }} />
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'right' }}>
                {s.pct}% {s.required > 0 && <span style={{ marginLeft: 6 }}>(Missing {s.required} required)</span>}
              </div>
            </div>
          ))}
        </div>
        {/* Tips & best practices */}
        {completeness.suggestions.length > 0 && (
          <div className="dashboard-card" style={{ padding: 14, marginTop: 12 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Suggestions & Best Practices</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#374151', fontSize: 13 }}>
              {completeness.suggestions.map((s, i) => (<li key={i}>{s}</li>))}
            </ul>
          </div>
        )}
      </div>
      {/* Suggested Contacts Widget */}
      {suggestedContacts.length > 0 && (
        <div className="dashboard-card" style={{ padding: 14, marginTop: 12, ...section }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Suggested Contacts</h3>
            <Link to="/contact-discovery" style={{ fontSize: 13, color: '#3b82f6', textDecoration: 'none' }}>
              View All →
            </Link>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {suggestedContacts.map((suggestion) => (
              <div 
                key={suggestion.id} 
                style={{ 
                  padding: 12, 
                  border: '1px solid #e5e7eb', 
                  borderRadius: 6,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                    {suggestion.suggested_name}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {suggestion.suggested_title} at {suggestion.suggested_company}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                    {suggestion.reason}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <span 
                    className="badge" 
                    style={{ 
                      fontSize: 10, 
                      padding: '3px 8px',
                      background: '#dbeafe',
                      color: '#1e40af'
                    }}
                  >
                    {suggestion.suggestion_type_display || suggestion.suggestion_type}
                  </span>
                  <Link 
                    to="/contact-discovery"
                    style={{
                      fontSize: 12,
                      padding: '4px 10px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      textDecoration: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ ...twoCol, ...section }}>
        <SkillDistribution data={skillChartData} />
        <ActivityTimeline events={[]} />
      </div>
    </div>
  );
};

export default DashboardOverview;
