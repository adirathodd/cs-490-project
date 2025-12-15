import React, { useState, useEffect } from 'react';
import { jobsAPI } from '../../services/api';
import Icon from '../common/Icon';

const JobMatchAnalysis = ({ job, onError }) => {
  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [customWeights, setCustomWeights] = useState({
    skills: 0.5,
    experience: 0.3,
    education: 0.2
  });

  useEffect(() => {
    if (job?.id) {
      loadMatchAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  const loadMatchAnalysis = async (refresh = false) => {
    try {
      setLoading(true);
      // Load match data
      const response = await jobsAPI.getJobMatchScore(job.id, { refresh });
      setMatchData(response.data);
      
      // Note: Custom weights functionality has been disabled
      // Backend no longer returns weights_used in response
    } catch (error) {
      console.error('Error loading match analysis:', error);
      onError?.('Failed to load match analysis');
    } finally {
      setLoading(false);
    }
  };

  // handleWeightChange is currently unused but kept for future UI integration
  const handleWeightChange = (category, value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0 || numValue > 1) return;
    
    setCustomWeights(prev => ({
      ...prev,
      [category]: numValue
    }));
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#059669'; // Green
    if (score >= 60) return '#f59e0b'; // Yellow/Orange
    return '#dc2626'; // Red
  };

  const getGradeColor = (grade) => {
    if (['A+', 'A', 'B+'].includes(grade)) return '#059669';
    if (['B', 'C+', 'C'].includes(grade)) return '#f59e0b';
    return '#dc2626';
  };

  // normalizeWeights is currently unused but kept for future UI integration
  // eslint-disable-next-line no-unused-vars
  const normalizeWeights = () => {
    const total = Object.values(customWeights).reduce((sum, val) => sum + val, 0);
    if (total > 0) {
      setCustomWeights(prev => ({
        skills: prev.skills / total,
        experience: prev.experience / total,
        education: prev.education / total
      }));
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Icon name="spinner" size="lg" className="spin" />
        <p style={{ marginTop: '16px', color: '#6b7280' }}>Analyzing job match...</p>
      </div>
    );
  }

  if (!matchData) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Icon name="alert-triangle" size="lg" style={{ color: '#f59e0b' }} />
        <p style={{ marginTop: '16px', color: '#6b7280' }}>Unable to load match analysis</p>
        <button
          onClick={() => loadMatchAnalysis(true)}
          className="cta-button"
          style={{ marginTop: '16px' }}
        >
          Retry Analysis
        </button>
      </div>
    );
  }

  const totalWeights = Object.values(customWeights).reduce((sum, val) => sum + val, 0);
  // weightsValid is currently unused but kept for future UI validation
  // eslint-disable-next-line no-unused-vars
  const weightsValid = Math.abs(totalWeights - 1) < 0.001;

  return (
    <div style={{ padding: '24px' }}>
      {/* Overall Match Score Card */}
      <div className="education-form-card" style={{ marginBottom: '24px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          flexDirection: 'column',
          padding: '24px'
        }}>
          <div style={{
            fontSize: '48px',
            fontWeight: '700',
            color: getScoreColor(matchData.overall_score),
            marginBottom: '8px'
          }}>
            {Math.round(matchData.overall_score)}%
          </div>
          <div style={{
            fontSize: '24px',
            fontWeight: '600',
            color: getGradeColor(matchData.match_grade),
            marginBottom: '8px'
          }}>
          </div>
          <div style={{
            color: '#6b7280',
            fontSize: '16px',
            textAlign: 'center'
          }}>
            Overall Match Score
          </div>
          {matchData.cached && (
            <div style={{
              marginTop: '12px',
              padding: '4px 8px',
              background: '#f3f4f6',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#6b7280'
            }}>
              Cached result • <button 
                onClick={() => loadMatchAnalysis(true)}
                style={{ textDecoration: 'underline', border: 'none', background: 'none', color: '#6366f1', cursor: 'pointer' }}
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Component Scores */}
      <div className="education-form-card" style={{ marginBottom: '24px' }}>
        <div className="form-header">
          <h3><Icon name="bar-chart" size="sm" /> Component Scores</h3>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: '600', 
                color: getScoreColor(matchData.skills_score),
                marginBottom: '4px'
              }}>
                {Math.round(matchData.skills_score)}%
              </div>
              <div style={{ color: '#6b7280', fontSize: '14px' }}>Skills Match</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: '600', 
                color: getScoreColor(matchData.experience_score),
                marginBottom: '4px'
              }}>
                {Math.round(matchData.experience_score)}%
              </div>
              <div style={{ color: '#6b7280', fontSize: '14px' }}>Experience</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: '600', 
                color: getScoreColor(matchData.education_score),
                marginBottom: '4px'
              }}>
                {Math.round(matchData.education_score)}%
              </div>
              <div style={{ color: '#6b7280', fontSize: '14px' }}>Education</div>
            </div>
          </div>
        </div>
      </div>

      {/* Experience Level Match */}
      {matchData.breakdown?.level_match && (
        <div className="education-form-card" style={{ marginBottom: '24px' }}>
          <div className="form-header">
            <h3><Icon name="user-check" size="sm" /> Experience Level Match</h3>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>Candidate</div>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>
                  {(matchData.breakdown.level_match.candidate_level || '').replace(/\b\w/g, (c) => c.toUpperCase())}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>Role</div>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>
                  {(matchData.breakdown.level_match.job_level || '').replace(/\b\w/g, (c) => c.toUpperCase())}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  fontSize: '20px', 
                  fontWeight: '600', 
                  color: getScoreColor(matchData.breakdown.level_match.score)
                }}>
                  {matchData.breakdown.level_match.alignment}
                </div>
              </div>
            </div>

            {/* Matching past experience skills */}
            {Array.isArray(matchData.breakdown.experience_skill_matches) && matchData.breakdown.experience_skill_matches.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px' }}>
                  <Icon name="briefcase" size="sm" /> Relevant Past Experience
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', rowGap: '6px' }}>
                  {matchData.breakdown.experience_skill_matches.map((m, idx) => (
                    <div key={idx} style={{ color: '#374151', fontSize: '14px' }}>
                      <span style={{ fontWeight: 500 }}>{m.job_title}</span> at <span style={{ fontWeight: 500 }}>{m.company_name}</span> — <span style={{ color: '#2563eb' }}>{m.skill}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Weight Configuration - HIDDEN */}
      {/* Commented out to hide weight adjustment from users
      <div className="education-form-card" style={{ marginBottom: '24px' }}>
        <div className="form-header">
          <h3><Icon name="sliders" size="sm" /> Personalized Weights</h3>
        </div>
        <div style={{ padding: '20px' }}>
          <p style={{ color: '#6b7280', marginBottom: '16px', fontSize: '14px' }}>
            Customize the importance of each factor in your match score calculation:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                Skills ({Math.round(customWeights.skills * 100)}%)
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={customWeights.skills}
                onChange={(e) => handleWeightChange('skills', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                Experience ({Math.round(customWeights.experience * 100)}%)
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={customWeights.experience}
                onChange={(e) => handleWeightChange('experience', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                Education ({Math.round(customWeights.education * 100)}%)
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={customWeights.education}
                onChange={(e) => handleWeightChange('education', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              color: weightsValid ? '#059669' : '#f59e0b', 
              fontSize: '12px' 
            }}>
              Total: {Math.round(totalWeights * 100)}%
              {!weightsValid && ' (should equal 100%)'}
            </div>
            <button
              onClick={normalizeWeights}
              className="back-button"
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              Normalize
            </button>
            <button
              onClick={updateWeights}
              disabled={!weightsValid || updating}
              className="cta-button"
              style={{ 
                fontSize: '12px', 
                padding: '4px 12px',
                opacity: (!weightsValid || updating) ? 0.5 : 1 
              }}
            >
              {updating ? 'Updating...' : 'Apply Weights'}
            </button>
          </div>
        </div>
      </div>
      */}

      {/* Match Breakdown */}
      {matchData.breakdown && (
        <div className="education-form-card" style={{ marginBottom: '24px' }}>
          <div className="form-header">
            <h3><Icon name="list" size="sm" /> Match Analysis</h3>
          </div>
          <div style={{ padding: '20px' }}>
            
            {/* Strengths */}
            {matchData.breakdown.strengths && matchData.breakdown.strengths.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#059669', marginBottom: '8px', fontSize: '16px' }}>
                  <Icon name="check-circle" size="sm" /> Your Strengths
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {matchData.breakdown.strengths.map((strength, index) => (
                    <span
                      key={index}
                      style={{
                        background: '#d1fae5',
                        color: '#059669',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '13px',
                        fontWeight: '500'
                      }}
                    >
                      {strength}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Top Gaps */}
            {matchData.breakdown.top_gaps && matchData.breakdown.top_gaps.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#f59e0b', marginBottom: '8px', fontSize: '16px' }}>
                  <Icon name="alert-triangle" size="sm" /> Areas to Improve
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {matchData.breakdown.top_gaps.map((gap, index) => (
                    <div
                      key={index}
                      style={{
                        background: '#fef3c7',
                        border: '1px solid #f59e0b',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '13px'
                      }}
                    >
                      <div style={{ fontWeight: '500', color: '#92400e' }}>
                        {gap.skill}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '12px' }}>
                        Current: {gap.current_level || 'None'} • Target: {gap.required_level}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {matchData.breakdown.recommendations && matchData.breakdown.recommendations.length > 0 && (
              <div>
                <h4 style={{ color: '#6366f1', marginBottom: '8px', fontSize: '16px' }}>
                  <Icon name="lightbulb" size="sm" /> Recommendations
                </h4>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {matchData.breakdown.recommendations.map((rec, index) => (
                    <li
                      key={index}
                      style={{
                        color: '#4b5563',
                        fontSize: '14px',
                        marginBottom: '4px'
                      }}
                    >
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default JobMatchAnalysis;