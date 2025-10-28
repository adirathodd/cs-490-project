import React, { useEffect, useMemo, useState } from 'react';
import { authAPI, skillsAPI, educationAPI, projectsAPI } from '../services/api';
import SummaryCard from './dashboard/SummaryCard';
import ProfileProgress from './dashboard/ProfileProgress';
import SkillDistribution from './dashboard/SkillDistribution';
import ActivityTimeline from './dashboard/ActivityTimeline';
import ExportProfile from './dashboard/ExportProfile';

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

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        // Fetch in parallel where possible
        const [me, skillsRes, eduRes, projRes, empList] = await Promise.all([
          authAPI.getCurrentUser().catch(() => null),
          (skillsAPI?.getSkills ? skillsAPI.getSkills() : Promise.resolve([])).catch(() => []),
          (educationAPI?.getEducations ? educationAPI.getEducations() : Promise.resolve({ results: [] })).catch(() => ({ results: [] })),
          (projectsAPI?.getProjects ? projectsAPI.getProjects() : Promise.resolve([])).catch(() => []),
          // Employment endpoint exists under /profile/employment
          fetch((process.env.REACT_APP_API_URL || 'http://localhost:8000/api') + '/profile/employment', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('firebaseToken') || ''}` }
          }).then(r => r.ok ? r.json() : Promise.resolve({ results: [] })).catch(() => ({ results: [] })),
        ]);

        if (!isMounted) return;
        setProfile(me?.profile || null);
        setSkills(Array.isArray(skillsRes) ? skillsRes : skillsRes?.results || []);
        setEducation(eduRes?.results || []);
        setProjects(Array.isArray(projRes) ? projRes : projRes?.results || []);
        setEmploymentCount((empList?.results || []).length);
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

  const progress = useMemo(() => {
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

  if (loading) return <div>Loading overview…</div>;
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
        <ProfileProgress percent={progress.percent} suggestions={progress.suggestions} />
      </div>
      <div style={{ ...twoCol, ...section }}>
        <SkillDistribution data={skillChartData} />
        <ActivityTimeline events={[]} />
      </div>
    </div>
  );
};

export default DashboardOverview;
