import React, { useState } from 'react';
import Icon from '../common/Icon';

const SkillGapAnalysis = ({ analysis, onRefresh, onLogProgress, onAddSkill, skillProgress = {} }) => {
  const [expandedSkills, setExpandedSkills] = useState(new Set());
  const [showTrends, setShowTrends] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [addSkillModalOpen, setAddSkillModalOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [skillToAdd, setSkillToAdd] = useState(null);
  const [logForm, setLogForm] = useState({
    hours_spent: '',
  });

  if (!analysis) {
    return null;
  }

  const { skills = [], summary = {}, trends } = analysis;
  const hasSkills = skills && skills.length > 0;

  const toggleSkillExpanded = (skillId) => {
    setExpandedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
  };

  const getGapSeverityColor = (severity) => {
    if (severity >= 70) return '#ef4444'; // High - red
    if (severity >= 40) return '#f59e0b'; // Medium - orange
    return '#10b981'; // Low - green
  };

  const getGapSeverityLabel = (severity) => {
    if (severity >= 70) return 'High';
    if (severity >= 40) return 'Medium';
    return 'Low';
  };

  const handleLogProgress = (skill) => {
    setSelectedSkill(skill);
    setLogModalOpen(true);
    setLogForm({ hours_spent: '' });
  };

  const handleSubmitLog = () => {
    if (!logForm.hours_spent || isNaN(logForm.hours_spent) || logForm.hours_spent <= 0) {
      alert('Please enter valid hours');
      return;
    }

    if (onLogProgress && selectedSkill) {
      onLogProgress(selectedSkill, {
        hours_spent: parseFloat(logForm.hours_spent),
      });
      setLogModalOpen(false);
      setSelectedSkill(null);
      setLogForm({ hours_spent: '' });
    }
  };

  const getTotalHoursNeeded = (skill) => {
    if (!skill.suggested_learning_path || skill.suggested_learning_path.length === 0) {
      return 0;
    }
    return skill.suggested_learning_path.reduce((sum, step) => {
      return sum + (step.estimated_hours || 0);
    }, 0);
  };

  const getHoursSpent = (skillId) => {
    return skillProgress[skillId]?.total_hours || 0;
  };

  const getRemainingHours = (skill) => {
    const totalNeeded = getTotalHoursNeeded(skill);
    const spent = getHoursSpent(skill.skill_id);
    return Math.max(0, totalNeeded - spent);
  };

  return (
    <div className="education-form-card" style={{ marginTop: '24px' }}>
      <div className="form-header">
        <h3>
          <Icon name="target" size="md" /> Skills Gap Analysis
        </h3>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {onRefresh && (
            <button
              className="add-education-button"
              onClick={onRefresh}
              style={{
                padding: '8px 20px',
                fontSize: '14px',
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              <Icon name="refresh" size="sm" /> Refresh
            </button>
          )}
        </div>
      </div>

      <div className="education-form" style={{ padding: '32px' }}>
        {!hasSkills ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Icon name="info" size="lg" color="#9ca3af" />
            <p style={{ color: '#9ca3af', marginTop: '16px', fontSize: '15px' }}>
              No skill requirements detected for this job.
              <br />
              Try adding a detailed job description or importing the job posting.
            </p>
          </div>
        ) : (
          <>
            {/* Summary Section */}
            {summary && (
              <div
                style={{
                  padding: '24px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '12px',
                  color: 'white',
                  marginBottom: '32px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>
                      Gap Summary
                    </h4>
                    {summary.top_gaps && summary.top_gaps.length > 0 && (
                      <p style={{ fontSize: '15px', marginBottom: '8px' }}>
                        <strong>Top gaps:</strong> {summary.top_gaps.join(', ')}
                      </p>
                    )}
                    <p style={{ fontSize: '14px', opacity: 0.9 }}>
                      {summary.total_skills_matched || 0} of {summary.total_skills_required || 0} skills matched
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Skills List */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '20px' }}>
                Required Skills ({skills.length})
              </h4>

              {skills.slice(0, 10).map((skill) => {
                const isExpanded = expandedSkills.has(skill.skill_id);
                const severityColor = getGapSeverityColor(skill.gap_severity);
                const severityLabel = getGapSeverityLabel(skill.gap_severity);

                return (
                  <div
                    key={skill.skill_id}
                    style={{
                      marginBottom: '16px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      transition: 'all 0.2s',
                    }}
                  >
                    {/* Skill Header */}
                    <div
                      style={{
                        padding: '20px',
                        background: '#f9fafb',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '16px',
                      }}
                      onClick={() => toggleSkillExpanded(skill.skill_id)}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                            {skill.importance_rank}. {skill.name}
                          </span>
                          {skill.category && (
                            <span
                              style={{
                                padding: '4px 12px',
                                background: '#e0e7ff',
                                color: '#4338ca',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '500',
                              }}
                            >
                              {skill.category}
                            </span>
                          )}
                          <span
                            style={{
                              padding: '4px 12px',
                              background: `${severityColor}20`,
                              color: severityColor,
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                            }}
                          >
                            {severityLabel} Gap
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '24px', fontSize: '14px', color: '#6b7280' }}>
                          <span>
                            <strong>Your level:</strong>{' '}
                            {skill.candidate_level ? (
                              <>
                                {skill.candidate_level.charAt(0).toUpperCase() + skill.candidate_level.slice(1)}
                                {skill.candidate_years ? ` (${skill.candidate_years}y)` : ''}
                              </>
                            ) : (
                              'Not acquired'
                            )}
                          </span>
                          {skill.target_level && (
                            <span>
                              <strong>Target:</strong>{' '}
                              {skill.target_level.charAt(0).toUpperCase() + skill.target_level.slice(1)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {!skill.candidate_level && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSkillToAdd(skill);
                              setAddSkillModalOpen(true);
                            }}
                            style={{
                              padding: '6px 10px',
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'background 0.2s',
                            }}
                            onMouseEnter={(e) => (e.target.style.background = '#059669')}
                            onMouseLeave={(e) => (e.target.style.background = '#10b981')}
                            title="Add this skill to your profile"
                          >
                            <Icon name="plus" size="xs" /> Add
                          </button>
                        )}
                        <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size="sm" color="#9ca3af" />
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div style={{ padding: '24px', background: 'white' }}>
                        {/* Learning Resources */}
                        {skill.recommended_resources && skill.recommended_resources.length > 0 && (
                          <div style={{ marginBottom: '24px' }}>
                            <h5 style={{ fontSize: '15px', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>
                              Recommended Resources
                            </h5>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {skill.recommended_resources.map((resource) => (
                                <div
                                  key={resource.id}
                                  style={{
                                    padding: '16px',
                                    background: '#f9fafb',
                                    borderRadius: '8px',
                                    border: '1px solid #e5e7eb',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '12px' }}>
                                    <div style={{ flex: 1 }}>
                                      <a
                                        href={resource.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          fontSize: '15px',
                                          fontWeight: '600',
                                          color: '#667eea',
                                          textDecoration: 'none',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                        }}
                                      >
                                        {resource.title} <Icon name="external-link" size="xs" />
                                      </a>
                                      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                                        {resource.provider}
                                        {resource.duration_hours && ` • ${resource.duration_hours}h`}
                                        {resource.cost && ` • ${resource.cost}`}
                                        {resource.difficulty && ` • ${resource.difficulty}`}
                                      </div>
                                    </div>
                                    {resource.rating && (
                                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#f59e0b' }}>
                                        ⭐ {resource.rating}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Learning Path */}
                        {skill.suggested_learning_path && skill.suggested_learning_path.length > 0 && (
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <h5 style={{ fontSize: '15px', fontWeight: '600', color: '#111827' }}>
                                Learning Path
                              </h5>
                              <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                <span style={{ fontWeight: '600', color: '#667eea' }}>
                                  {getRemainingHours(skill)}h
                                </span>{' '}
                                of {getTotalHoursNeeded(skill)}h remaining
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {skill.suggested_learning_path.map((step) => (
                                <div
                                  key={step.step}
                                  style={{
                                    display: 'flex',
                                    gap: '12px',
                                    padding: '12px',
                                    background: '#fefce8',
                                    borderRadius: '8px',
                                    border: '1px solid #fef3c7',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: '24px',
                                      height: '24px',
                                      borderRadius: '50%',
                                      background: '#fbbf24',
                                      color: 'white',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {step.step}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '14px', color: '#111827', marginBottom: '4px' }}>
                                      {step.description}
                                    </div>
                                    {step.estimated_hours && (
                                      <div style={{ fontSize: '12px', color: '#92400e' }}>
                                        ~{step.estimated_hours} hours
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLogProgress(skill);
                          }}
                          style={{
                            padding: '10px 20px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <Icon name="check" size="sm" /> Log Practice
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Trends Section */}
            {trends && trends.common_missing_skills && trends.common_missing_skills.length > 0 && (
              <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }}>
                <button
                  onClick={() => setShowTrends(!showTrends)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#111827',
                    cursor: 'pointer',
                    marginBottom: '16px',
                  }}
                >
                  <Icon name={showTrends ? 'chevron-down' : 'chevron-right'} size="sm" />
                  Trends Across Similar Jobs ({trends.similar_jobs_count} jobs analyzed)
                </button>

                {showTrends && (
                  <div style={{ paddingLeft: '24px' }}>
                    <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
                      Skills commonly required in similar positions that you haven't acquired yet:
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                      {trends.common_missing_skills.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '10px 16px',
                            background: '#fef3c7',
                            border: '1px solid #fde68a',
                            borderRadius: '8px',
                            fontSize: '14px',
                            color: '#92400e',
                          }}
                        >
                          <strong>{item.skill}</strong> • {item.prevalence_percent}% of similar jobs
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Skill Confirmation Modal */}
      {addSkillModalOpen && skillToAdd && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setAddSkillModalOpen(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '450px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <Icon name="plus" size="lg" color="white" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                Add Skill to Profile
              </h3>
              <p style={{ fontSize: '15px', color: '#6b7280' }}>
                Add <strong style={{ color: '#111827' }}>{skillToAdd.name}</strong> to your skills?
              </p>
            </div>

            <div
              style={{
                padding: '16px',
                background: '#f3f4f6',
                borderRadius: '8px',
                marginBottom: '24px',
              }}
            >
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
                This will be added as:
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '15px', color: '#374151' }}>Skill:</span>
                <span style={{ fontSize: '15px', fontWeight: '600', color: '#111827' }}>
                  {skillToAdd.name}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '15px', color: '#374151' }}>Level:</span>
                <span style={{ fontSize: '15px', fontWeight: '600', color: '#10b981' }}>Beginner</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '15px', color: '#374151' }}>Years of Experience:</span>
                <span style={{ fontSize: '15px', fontWeight: '600', color: '#111827' }}>0</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  if (typeof onAddSkill === 'function') {
                    onAddSkill(skillToAdd);
                  }
                  setAddSkillModalOpen(false);
                  setSkillToAdd(null);
                }}
                style={{
                  flex: 1,
                  padding: '14px 24px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <Icon name="check" size="sm" /> Add Skill
              </button>
              <button
                onClick={() => {
                  setAddSkillModalOpen(false);
                  setSkillToAdd(null);
                }}
                style={{
                  padding: '14px 24px',
                  background: '#f3f4f6',
                  color: '#6b7280',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Practice Modal */}
      {logModalOpen && selectedSkill && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setLogModalOpen(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>
                Log Practice: {selectedSkill.name}
              </h3>
              <button
                onClick={() => setLogModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '0 8px',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '24px', padding: '16px', background: '#f3f4f6', borderRadius: '8px' }}>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
                Progress Summary
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '15px', color: '#374151' }}>Total Hours Needed:</span>
                <span style={{ fontSize: '15px', fontWeight: '600', color: '#111827' }}>
                  {getTotalHoursNeeded(selectedSkill)}h
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '15px', color: '#374151' }}>Hours Completed:</span>
                <span style={{ fontSize: '15px', fontWeight: '600', color: '#10b981' }}>
                  {getHoursSpent(selectedSkill.skill_id)}h
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '15px', color: '#374151' }}>Remaining:</span>
                <span style={{ fontSize: '15px', fontWeight: '600', color: '#ef4444' }}>
                  {getRemainingHours(selectedSkill)}h
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                Hours Spent <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={logForm.hours_spent}
                onChange={(e) => setLogForm({ ...logForm, hours_spent: e.target.value })}
                placeholder="e.g., 2.5"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '15px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#667eea')}
                onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleSubmitLog}
                style={{
                  flex: 1,
                  padding: '14px 24px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <Icon name="check" size="sm" /> Log Practice
              </button>
              <button
                onClick={() => setLogModalOpen(false)}
                style={{
                  padding: '14px 24px',
                  background: '#f3f4f6',
                  color: '#6b7280',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillGapAnalysis;
