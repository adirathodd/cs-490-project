import React from 'react';
import Icon from '../common/Icon';

/**
 * UC-068: Interview Insights and Preparation Component
 * 
 * Displays comprehensive interview insights including:
 * - Typical interview process and stages
 * - Common interview questions (technical and behavioral)
 * - Preparation recommendations
 * - Timeline expectations
 * - Success tips
 * - Interview preparation checklist
 */
const InterviewInsights = ({ insights }) => {
  if (!insights || !insights.has_data) {
    return null;
  }

  const {
    process_overview,
    common_questions,
    preparation_recommendations,
    timeline,
    success_tips,
    disclaimer
  } = insights;

  return (
    <>
      <div className="education-form-card">
        <div className="form-header">
          <h3>
            <Icon name="target" size="md" /> Interview Insights
          </h3>
        </div>
        <div style={{ padding: '32px' }}>
        {/* Disclaimer */}
        {disclaimer && (
          <div style={{
            padding: '16px',
            backgroundColor: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '8px',
            marginBottom: '24px',
            fontSize: '14px',
            color: '#92400e',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <Icon name="info" size="sm" />
            <span>{disclaimer}</span>
          </div>
        )}

        {/* Interview Process Overview */}
        {process_overview && (
          <div style={{ marginBottom: '32px' }}>
            <h4 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Icon name="list" size="sm" />
              Interview Process Overview
            </h4>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
              Typical process: {process_overview.total_stages} stages over {process_overview.estimated_duration}
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {process_overview.stages.map((stage, index) => (
                <div key={index} style={{
                  padding: '20px',
                  backgroundColor: '#f9fafb',
                  borderLeft: '4px solid #667eea',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                    <h5 style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                      Stage {stage.stage_number}: {stage.name}
                    </h5>
                    <span style={{
                      fontSize: '13px',
                      color: '#667eea',
                      fontWeight: '500',
                      padding: '4px 12px',
                      backgroundColor: '#eef2ff',
                      borderRadius: '12px'
                    }}>
                      {stage.duration}
                    </span>
                  </div>
                  <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '12px' }}>
                    {stage.description}
                  </p>
                  <ul style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    {stage.activities.map((activity, actIdx) => (
                      <li key={actIdx} style={{
                        fontSize: '14px',
                        color: '#6b7280',
                        paddingLeft: '20px',
                        position: 'relative'
                      }}>
                        <span style={{
                          position: 'absolute',
                          left: '0',
                          color: '#667eea'
                        }}>•</span>
                        {activity}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline Expectations */}
        {timeline && (
          <div style={{ marginBottom: '32px' }}>
            <h4 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Icon name="clock" size="sm" />
              Timeline Expectations
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px'
            }}>
              <div style={{
                padding: '16px',
                backgroundColor: '#f0f9ff',
                borderRadius: '8px',
                border: '1px solid #bae6fd'
              }}>
                <div style={{ fontSize: '13px', color: '#0369a1', fontWeight: '500', marginBottom: '4px' }}>
                  Total Duration
                </div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#0c4a6e' }}>
                  {timeline.total_duration}
                </div>
              </div>
              <div style={{
                padding: '16px',
                backgroundColor: '#f0f9ff',
                borderRadius: '8px',
                border: '1px solid #bae6fd'
              }}>
                <div style={{ fontSize: '13px', color: '#0369a1', fontWeight: '500', marginBottom: '4px' }}>
                  Initial Response Time
                </div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#0c4a6e' }}>
                  {timeline.response_time}
                </div>
              </div>
              <div style={{
                padding: '16px',
                backgroundColor: '#f0f9ff',
                borderRadius: '8px',
                border: '1px solid #bae6fd'
              }}>
                <div style={{ fontSize: '13px', color: '#0369a1', fontWeight: '500', marginBottom: '4px' }}>
                  Between Rounds
                </div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#0c4a6e' }}>
                  {timeline.between_rounds}
                </div>
              </div>
              <div style={{
                padding: '16px',
                backgroundColor: '#f0f9ff',
                borderRadius: '8px',
                border: '1px solid #bae6fd'
              }}>
                <div style={{ fontSize: '13px', color: '#0369a1', fontWeight: '500', marginBottom: '4px' }}>
                  Final Decision
                </div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#0c4a6e' }}>
                  {timeline.final_decision}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Common Questions */}
        {common_questions && (
          <div style={{ marginBottom: '32px' }}>
            <h4 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Icon name="help-circle" size="sm" />
              Common Interview Questions
            </h4>

            {common_questions.technical && common_questions.technical.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h5 style={{ fontSize: '15px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                  Technical Questions
                </h5>
                <ul style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  {common_questions.technical.slice(0, 8).map((question, index) => (
                    <li key={index} style={{
                      fontSize: '14px',
                      color: '#4b5563',
                      padding: '12px 16px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '6px',
                      paddingLeft: '36px',
                      position: 'relative'
                    }}>
                      <span style={{
                        position: 'absolute',
                        left: '16px',
                        fontWeight: '600',
                        color: '#667eea'
                      }}>Q:</span>
                      {question}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {common_questions.behavioral && common_questions.behavioral.length > 0 && (
              <div>
                <h5 style={{ fontSize: '15px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                  Behavioral Questions
                </h5>
                <ul style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  {common_questions.behavioral.slice(0, 8).map((question, index) => (
                    <li key={index} style={{
                      fontSize: '14px',
                      color: '#4b5563',
                      padding: '12px 16px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '6px',
                      paddingLeft: '36px',
                      position: 'relative'
                    }}>
                      <span style={{
                        position: 'absolute',
                        left: '16px',
                        fontWeight: '600',
                        color: '#667eea'
                      }}>Q:</span>
                      {question}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {common_questions.note && (
              <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '12px', fontStyle: 'italic' }}>
                {common_questions.note}
              </p>
            )}
          </div>
        )}

        {/* Preparation Recommendations */}
        {preparation_recommendations && preparation_recommendations.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <h4 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Icon name="book" size="sm" />
              Preparation Recommendations
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '12px'
            }}>
              {preparation_recommendations.map((tip, index) => (
                <div key={index} style={{
                  padding: '14px 16px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}>
                  <Icon name="check" size="sm" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Success Tips */}
        {success_tips && success_tips.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <h4 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Icon name="star" size="sm" />
              Success Tips
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '12px'
            }}>
              {success_tips.map((tip, index) => (
                <div key={index} style={{
                  padding: '14px 16px',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#92400e',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}>
                  <span style={{ color: '#f59e0b', fontSize: '16px', flexShrink: 0 }}>★</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
    </>
  );
};

export default InterviewInsights;
