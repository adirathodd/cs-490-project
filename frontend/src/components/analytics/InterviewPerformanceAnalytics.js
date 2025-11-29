import React, { useEffect, useState } from 'react';
import { interviewsAPI } from '../../services/api';
import Icon from '../common/Icon';

const panelCard = {
  padding: 20,
  borderRadius: 12,
  background: '#fff',
  border: '1px solid #e5e7eb',
};

const subheading = { fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#111827' };

export default function InterviewPerformanceAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await interviewsAPI.getPerformanceAnalytics();
        setAnalytics(data);
        setError('');
      } catch (err) {
        console.error('Interview analytics error', err);
        setError('Unable to load interview analytics right now.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <div style={{ padding: 20 }}>Crunching interview performance metrics…</div>;
  }
  if (error) {
    return <div style={{ padding: 20, color: '#b91c1c' }}>{error}</div>;
  }
  if (!analytics) return null;

  const {
    summary,
    company_type_trends,
    format_performance,
    preparation_areas,
    practice_impact,
    timeline,
    benchmarks,
    insights,
    ai_recommendations,
  } = analytics;

  const heroStats = [
    {
      label: 'Interview → Offer',
      value: summary?.interview_to_offer_rate != null ? `${summary.interview_to_offer_rate.toFixed(1)}%` : '0%',
      helper: `${summary?.offers_won || 0} offers across ${summary?.unique_processes || 0} processes`,
    },
    {
      label: 'Avg Rounds per Offer',
      value: summary?.avg_interviews_per_offer != null ? summary.avg_interviews_per_offer.toFixed(2) : '—',
      helper: 'Interviews required to close an offer',
    },
    {
      label: 'Readiness Signal',
      value: summary?.readiness_signal != null ? `${summary.readiness_signal.toFixed(1)}%` : 'No forecasts yet',
      helper: 'Mean predicted success (latest Gemini forecasts)',
    },
    {
      label: 'Recent Velocity',
      value: summary?.recent_completed || 0,
      helper: 'Completed interviews in the last 30 days',
    },
  ];

  const strongestArea = preparation_areas?.strongest;
  const weakArea = preparation_areas?.weakest;

  const trendRows = (timeline?.monthly || []).slice(-6);

  const practiceSummary = practice_impact?.summary || {};
  const skillFocus = practice_impact?.skill_focus || {};

  const insightBullets = insights?.insights || [];
  const recommendationBullets = insights?.recommendations || [];

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="chartBar" />
          <h2 style={{ margin: 0, fontSize: 24 }}>Interview Performance Analytics</h2>
        </div>
        <p style={{ margin: '6px 0 0', color: '#6b7280' }}>
          Trace the full funnel from scheduled interviews through offers with AI-generated guidance.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
        {heroStats.map((stat) => (
          <div key={stat.label} style={{ ...panelCard, borderTop: '4px solid #2563eb' }}>
            <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase' }}>{stat.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 4px' }}>{stat.value}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>{stat.helper}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={panelCard}>
          <div style={subheading}>Companies Responding Best</div>
          {company_type_trends && company_type_trends.length > 0 ? (
            company_type_trends.slice(0, 4).map((trend) => (
              <CompanyTrendRow key={trend.company_type} trend={trend} />
            ))
          ) : (
            <EmptyState message="Add company industries to compare performance." />
          )}
        </div>
        <div style={panelCard}>
          <div style={subheading}>Format Performance</div>
          {format_performance && format_performance.length > 0 ? (
            format_performance.map((fmt) => (
              <FormatPerformanceRow key={fmt.interview_type} format={fmt} />
            ))
          ) : (
            <EmptyState message="Schedule interviews to uncover format win rates." />
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={panelCard}>
          <div style={subheading}>Preparation Strengths</div>
          {preparation_areas?.areas?.length ? (
            <>
              <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                {preparation_areas.areas.map((area) => (
                  <div key={area.category} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600 }}>{area.category}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
                      <span>Checklist completion</span>
                      <span>{area.completion_rate.toFixed(1)}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
                      <span>Success rate</span>
                      <span>{area.success_rate.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
              <HighlightPills strongest={strongestArea} weakest={weakArea} />
            </>
          ) : (
            <EmptyState message="Toggle checklist items during prep to track strengths." />
          )}
        </div>
        <div style={panelCard}>
          <div style={subheading}>Practice Impact & Focus</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 12 }}>
            <MiniStat label="Jobs with practice" value={practiceSummary.jobs_with_practice || 0} />
            <MiniStat label="Sessions / job" value={practiceSummary.avg_sessions_per_job || 0} suffix="sessions" />
            <MiniStat label="Avg score" value={practiceSummary.avg_score != null ? practiceSummary.avg_score : '—'} suffix={practiceSummary.avg_score != null ? '%' : ''} />
          </div>
          <PracticeComparison summary={practiceSummary} />
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Skill focus mix</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(skillFocus).length ? (
                Object.entries(skillFocus).map(([type, count]) => (
                  <span key={type} style={{ padding: '6px 12px', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', fontSize: 12 }}>
                    {type.replace('_', ' ')} · {count}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: 12, color: '#9ca3af' }}>Log mock interviews or drills to map focus areas.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={panelCard}>
        <div style={subheading}>Momentum Over Time</div>
        {trendRows.length ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {trendRows.map((row) => (
              <TimelineRow key={row.month} row={row} />
            ))}
            {timeline?.outcome_trend_delta != null && (
              <div style={{ padding: 12, borderRadius: 8, background: timeline.outcome_trend_delta >= 0 ? '#ecfdf5' : '#fef2f2', color: timeline.outcome_trend_delta >= 0 ? '#065f46' : '#b91c1c' }}>
                {timeline.outcome_trend_delta >= 0 ? 'Upward trajectory' : 'Trend warning'}: average outcome score moved {timeline.outcome_trend_delta >= 0 ? 'up' : 'down'} by{' '}
                {Math.abs(timeline.outcome_trend_delta).toFixed(2)} points vs the prior half.
              </div>
            )}
          </div>
        ) : (
          <EmptyState message="Record interview outcomes to visualize improvement." />
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div style={panelCard}>
          <div style={subheading}>Benchmarks</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <BenchmarkRow
              label="Interview → offer"
              candidate={benchmarks?.candidate_interview_to_offer_rate}
              industry={benchmarks?.industry_interview_to_offer_rate}
              suffix="%"
            />
            <BenchmarkRow
              label="Rounds per offer"
              candidate={benchmarks?.candidate_avg_rounds_per_offer}
              industry={benchmarks?.industry_avg_rounds_per_offer}
            />
            <BenchmarkRow
              label="Practice per offer"
              candidate={practiceSummary.sessions_leading_to_offers}
              industry={benchmarks?.practice_sessions_per_offer}
              helper="Sessions logged before wins"
            />
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 10 }}>
            Industry sample size: {benchmarks?.industry_sample_size || 0} peer interview cycles.
          </div>
        </div>
        <div style={panelCard}>
          <div style={subheading}>Strategy Insights</div>
          {insightBullets.length ? (
            <ul style={{ paddingLeft: 16, margin: '0 0 12px' }}>
              {insightBullets.map((tip, idx) => (
                <li key={idx} style={{ marginBottom: 6, color: '#111827' }}>
                  {tip.headline ? <strong>{tip.headline}: </strong> : null}
                  {tip.detail || tip}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="Insights will appear once you log more results." />
          )}
          {recommendationBullets.length > 0 && (
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Personalized moves</div>
              <ul style={{ paddingLeft: 16, margin: 0 }}>
                {recommendationBullets.map((tip, idx) => (
                  <li key={idx} style={{ marginBottom: 6, color: '#374151' }}>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ai_recommendations && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#eef2ff', color: '#312e81' }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Gemini Coaching Summary</div>
              <p style={{ margin: '0 0 8px' }}>{ai_recommendations.executive_summary}</p>
              {ai_recommendations.priority_actions?.length ? (
                <ul style={{ paddingLeft: 16, margin: 0 }}>
                  {ai_recommendations.priority_actions.map((action, idx) => (
                    <li key={idx}>{action}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CompanyTrendRow({ trend }) {
  const rate = trend.conversion_rate != null ? trend.conversion_rate.toFixed(1) : '0.0';
  return (
    <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8 }}>
      <div style={{ fontWeight: 600 }}>{trend.company_type}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
        <span>{trend.interviews} interviews</span>
        <span>{trend.offers} offers</span>
      </div>
      <div style={{ marginTop: 6 }}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Conversion</div>
        <div style={{ height: 6, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(Number(rate), 100)}%`, height: '100%', background: '#2563eb' }} />
        </div>
        <div style={{ fontSize: 12, color: '#111827', marginTop: 4 }}>{rate}%</div>
      </div>
    </div>
  );
}

function FormatPerformanceRow({ format }) {
  const avgDuration = format.avg_duration != null ? format.avg_duration : '—';
  return (
    <div style={{ padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
        <span>{format.label}</span>
        <span>{format.conversion_rate?.toFixed(1) || 0}%</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginTop: 4 }}>
        <span>{format.interviews} interviews · avg {avgDuration} mins</span>
        <span>Offers: {format.offers}</span>
      </div>
    </div>
  );
}

function HighlightPills({ strongest, weakest }) {
  if (!strongest && !weakest) return null;
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {strongest && (
        <span style={{ padding: '6px 12px', borderRadius: 999, background: '#ecfdf5', color: '#065f46', fontSize: 12 }}>
          🏆 Strongest: {strongest.category}
        </span>
      )}
      {weakest && (
        <span style={{ padding: '6px 12px', borderRadius: 999, background: '#fff7ed', color: '#b45309', fontSize: 12 }}>
          ⚠️ Focus: {weakest.category}
        </span>
      )}
    </div>
  );
}

function PracticeComparison({ summary }) {
  if (!summary.sessions_leading_to_offers && !summary.sessions_without_offers) {
    return (
      <div style={{ fontSize: 12, color: '#9ca3af' }}>
        Log technical prep or mock interviews to see how practice correlates with offer wins.
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <div style={{ padding: 10, borderRadius: 8, background: '#ecfdf5', color: '#065f46' }}>
        <div style={{ fontSize: 12 }}>Practice before offers</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          {summary.sessions_leading_to_offers?.toFixed(1) || 0}
        </div>
        <div style={{ fontSize: 12 }}>sessions on average</div>
      </div>
      <div style={{ padding: 10, borderRadius: 8, background: '#fef2f2', color: '#b91c1c' }}>
        <div style={{ fontSize: 12 }}>When offers fell through</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          {summary.sessions_without_offers?.toFixed(1) || 0}
        </div>
        <div style={{ fontSize: 12 }}>sessions logged</div>
      </div>
    </div>
  );
}

function TimelineRow({ row }) {
  const normalizedScore = typeof row.avg_outcome_score === 'number'
    ? row.avg_outcome_score
    : Number.parseFloat(row.avg_outcome_score);
  const hasScore = Number.isFinite(normalizedScore);
  const outcomeScore = hasScore ? normalizedScore.toFixed(2) : '—';
  const progress = hasScore ? Math.min(normalizedScore * 100, 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
      <div style={{ minWidth: 70, fontWeight: 600 }}>{row.month}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: '#6b7280' }}>Outcome score</div>
        <div style={{ height: 6, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, background: '#10b981', height: '100%' }} />
        </div>
      </div>
      <div style={{ width: 140, fontSize: 12, color: '#6b7280' }}>
        {row.interviews} interviews · {row.offers} offers
      </div>
      <div style={{ fontWeight: 600 }}>{outcomeScore}</div>
    </div>
  );
}

function BenchmarkRow({ label, candidate, industry, suffix = '', helper }) {
  const candidateValue = candidate != null ? `${candidate.toFixed(2)}${suffix}` : '—';
  const industryValue = industry != null ? `${industry.toFixed(2)}${suffix}` : '—';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: 6, marginBottom: 6, fontSize: 14 }}>
      <div>
        <div style={{ fontWeight: 600 }}>{label}</div>
        {helper && <div style={{ fontSize: 11, color: '#9ca3af' }}>{helper}</div>}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <span style={{ color: '#1d4ed8' }}>{candidateValue}</span>
        <span style={{ color: '#6b7280' }}>vs {industryValue}</span>
      </div>
    </div>
  );
}

function MiniStat({ label, value, suffix = '' }) {
  return (
    <div style={{ borderRadius: 10, border: '1px solid #e5e7eb', padding: 12 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#9ca3af' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>
        {value}
        {suffix && value !== '—' && <span style={{ fontSize: 12, marginLeft: 4 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{ padding: 12, borderRadius: 8, background: '#f9fafb', color: '#6b7280', fontSize: 13 }}>
      {message}
    </div>
  );
}
