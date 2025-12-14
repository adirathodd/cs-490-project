import React, { useEffect, useMemo, useState } from 'react';
import { jobsAPI } from '../../services/api';
import Icon from '../common/Icon';

const pageGrid = {
  display: 'grid',
  gap: 16,
  padding: 16,
  maxWidth: 1400,
  margin: '0 auto',
};

const card = {
  padding: 16,
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  background: '#fff',
};

const sectionTitle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 18,
  fontWeight: 700,
  marginBottom: 12,
  color: '#111827',
};

const pill = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  background: '#f3f4f6',
  color: '#374151',
};

const formatPercent = (value, fallback = '—') => {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return `${Number(value).toFixed(1)}%`;
};

const formatMonth = (iso) => {
  if (!iso) return '—';
  try {
    const date = new Date(iso);
    return date.toLocaleString(undefined, { month: 'short', year: 'numeric' });
  } catch (err) {
    return iso;
  }
};

export default function OptimizationDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const resp = await jobsAPI.getOptimizationInsights();
        if (isMounted) {
          setData(resp);
          setError('');
        }
      } catch (err) {
        console.error('Optimization dashboard error', err);
        if (isMounted) setError('Unable to load optimization insights right now.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const trendSummary = useMemo(() => {
    const trend = data?.trend?.success_trend || [];
    if (!trend.length) return [];
    return trend.slice(-4);
  }, [data]);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#4b5563' }}>
        <Icon name="refresh" style={{ marginRight: 8 }} /> Loading optimization dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#b91c1c' }}>
        <Icon name="exclamationTriangle" style={{ marginRight: 8 }} /> {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>
        No optimization insights yet. Start logging applications to unlock strategy guidance.
      </div>
    );
  }

  const metrics = data.success_metrics || {};
  const materials = data.materials_performance || {};
  const approaches = data.approach_effectiveness || {};
  const timing = data.timing_insights || {};
  const recommendations = data.recommendations || [];
  const experiments = data.experiments || [];
  const roleFit = data.role_fit || {};

  return (
    <div style={pageGrid}>
      <header style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Optimization Dashboard</h1>
        <p style={{ margin: '6px 0 0', color: '#6b7280' }}>
          Pinpoint what&apos;s driving offers, double down on winning materials, and act on data-backed experiments.
        </p>
      </header>

      {/* Success metrics */}
      <section style={card}>
        <div style={sectionTitle}>
          <Icon name="sparkles" /> Success Metrics
          <span style={pill}>{metrics.total_applications || 0} total applications</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <MetricTile label="Response Rate" value={metrics.response_rate} />
          <MetricTile label="Interview Conversion" value={metrics.interview_rate} />
          <MetricTile label="Offer Rate" value={metrics.offer_rate} accent />
        </div>
      </section>

      {/* Materials performance */}
      <section style={card}>
        <div style={sectionTitle}>
          <Icon name="documentCheck" /> Materials Performance
        </div>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <MaterialList title="Resume Versions" items={materials.resume_versions || []} emptyText="No resume usage data yet." />
          <MaterialList title="Cover Letter Versions" items={materials.cover_letters || []} emptyText="No cover letter usage yet." />
        </div>
      </section>

      {/* Approaches & timing */}
      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div style={card}>
          <div style={sectionTitle}>
            <Icon name="arrowTrendingUp" /> Application Approaches
          </div>
          <ApproachTable approaches={approaches} />
        </div>
        <div style={card}>
          <div style={sectionTitle}>
            <Icon name="clock" /> Timing Insights
          </div>
          <TimingInsights timing={timing} />
        </div>
      </section>

      {/* Role fit + trend */}
      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div style={card}>
          <div style={sectionTitle}>
            <Icon name="briefcase" /> Role Fit Highlights
          </div>
          <RoleHighlights data={roleFit} />
        </div>
        <div style={card}>
          <div style={sectionTitle}>
            <Icon name="chartLineUp" /> Momentum
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <TrendStat label="Offer rate change" value={formatPercent(data?.trend?.offer_rate_change ?? 0)} />
            <TrendStat label="Response rate change" value={formatPercent(data?.trend?.response_rate_change ?? 0)} />
            <TrendStat label="Momentum" value={(data?.trend?.momentum || 'flat').toUpperCase()} muted />
          </div>
          {trendSummary.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
              {trendSummary.map((row) => (
                <li
                  key={row.month}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: '#f9fafb',
                    border: '1px solid #edf2f7',
                    fontSize: 14,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{formatMonth(row.month)}</span>
                  <span style={{ color: '#2563eb' }}>{formatPercent(row.offer_rate)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: '#6b7280', margin: 0 }}>Need at least two months of data to chart improvement.</p>
          )}
        </div>
      </section>

      {/* Experiments */}
      <section style={card}>
        <div style={sectionTitle}>
          <Icon name="beaker" /> Experiments &amp; A/B Tests
        </div>
        {experiments.length ? (
          <div style={{ display: 'grid', gap: 16 }}>
            {experiments.map((exp) => (
              <div key={exp.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong>{exp.title}</strong>
                  <span style={{ ...pill, background: '#dbeafe', color: '#1d4ed8' }}>Winner: {exp.winner}</span>
                </div>
                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                  {(exp.variants || []).filter(Boolean).map((variant, idx) => (
                    <div key={`${exp.id}-${idx}`} style={{ background: '#f9fafb', borderRadius: 8, padding: 10 }}>
                      <div style={{ fontWeight: 600 }}>{variant.label}</div>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>{variant.applications || 0} applications</div>
                      <div style={{ fontSize: 13, marginTop: 6 }}>Offer rate: {formatPercent(variant.offer_rate)}</div>
                      <div style={{ fontSize: 13 }}>Response rate: {formatPercent(variant.response_rate)}</div>
                    </div>
                  ))}
                </div>
                {exp.insight && <p style={{ fontSize: 13, color: '#4b5563', marginTop: 10 }}>{exp.insight}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#6b7280', margin: 0 }}>No experiments yet – keep applying to unlock comparisons.</p>
        )}
      </section>

      {/* Recommendations */}
      <section style={card}>
        <div style={sectionTitle}>
          <Icon name="lightbulb" /> Actionable Recommendations
        </div>
        {recommendations.length ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                style={{
                  border: '1px solid #ede9fe',
                  borderLeft: rec.type === 'high_impact' ? '4px solid #c026d3' : '4px solid #6366f1',
                  padding: 12,
                  borderRadius: 8,
                  background: rec.type === 'high_impact' ? '#fdf4ff' : '#eef2ff',
                }}
              >
                <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#7c3aed', fontWeight: 700 }}>
                  {rec.category || 'Recommendation'}
                </div>
                <div style={{ fontSize: 14, color: '#1f2937' }}>{rec.message}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#6b7280', margin: 0 }}>No personalized recommendations yet.</p>
        )}
      </section>
    </div>
  );
}

function MetricTile({ label, value, accent = false }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        border: `1px solid ${accent ? '#c7d2fe' : '#e5e7eb'}`,
        background: accent ? '#eef2ff' : '#f9fafb',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 13, textTransform: 'uppercase', color: '#6b7280', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: accent ? '#312e81' : '#1f2937' }}>{formatPercent(value)}</div>
    </div>
  );
}

function MaterialList({ title, items, emptyText }) {
  return (
    <div>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>{title}</h3>
      {items.length ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          {items.slice(0, 4).map((item) => (
            <li key={item.document_id} style={{ background: '#f9fafb', borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 600 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{item.applications} applications</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Offer rate: {formatPercent(item.offer_rate)}</div>
              <div style={{ fontSize: 13 }}>Response rate: {formatPercent(item.response_rate)}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: '#9ca3af', margin: 0 }}>{emptyText}</p>
      )}
    </div>
  );
}

function ApproachTable({ approaches }) {
  const rows = (approaches?.by_method || []).slice(0, 4);
  const sources = (approaches?.by_source || []).slice(0, 3);
  const topMethod = approaches?.top_method;
  const topSource = approaches?.top_source;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {topMethod ? (
        <div style={pill}>
          <Icon name="trophy" /> Best method: {topMethod.label} ({formatPercent(topMethod.offer_rate)})
        </div>
      ) : (
        <div style={pill}>Need more application method data</div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#6b7280' }}>
              <th style={{ paddingBottom: 6 }}>Method</th>
              <th style={{ paddingBottom: 6 }}>Offers</th>
              <th style={{ paddingBottom: 6 }}>Responses</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.code}>
                  <td style={{ padding: '4px 0', fontWeight: 600 }}>{row.label}</td>
                  <td style={{ padding: '4px 0' }}>{formatPercent(row.offer_rate)}</td>
                  <td style={{ padding: '4px 0' }}>{formatPercent(row.response_rate)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" style={{ padding: '8px 0', color: '#9ca3af' }}>
                  Not enough data to compare methods.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {topSource ? (
        <div style={{ fontSize: 13 }}>
          Strongest source: <strong>{topSource.label}</strong> ({formatPercent(topSource.offer_rate)} offer rate)
        </div>
      ) : (
        <div style={{ fontSize: 13, color: '#9ca3af' }}>Need more tracked sources.</div>
      )}
      {sources.length ? (
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          Other sources performing well:{' '}
          {sources.map((s) => `${s.label} (${formatPercent(s.response_rate)})`).join(', ')}
        </div>
      ) : null}
    </div>
  );
}

function TimingInsights({ timing }) {
  const bestDay = timing?.best_day;
  const bestTime = timing?.best_time;
  const dayList = timing?.by_day_of_week || [];
  const timeList = timing?.by_time_of_day || [];

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>Best day to apply</span>
        <strong style={{ fontSize: 18 }}>
          {bestDay ? `${bestDay.day} – ${formatPercent(bestDay.offer_rate)}` : 'TBD'}
        </strong>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>Best time window</span>
        <strong style={{ fontSize: 18 }}>
          {bestTime ? `${bestTime.time_slot || bestTime.hour} – ${formatPercent(bestTime.offer_rate)}` : 'TBD'}
        </strong>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Response rate by day</div>
        {dayList.length ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
            {dayList.slice(0, 4).map((day) => (
              <li key={day.day} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{day.day}</span>
                <span>{formatPercent(day.offer_rate)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>Need more application timestamps.</p>
        )}
      </div>
      {timeList.length ? (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Time of day highlights</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {timeList.slice(0, 3).map((slot) => (
              <span key={slot.time_slot} style={pill}>
                {slot.time_slot}: {formatPercent(slot.response_rate)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RoleHighlights({ data }) {
  const jobTypes = data?.job_types || [];
  const industries = data?.industries || [];

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>Top job types</div>
        {jobTypes.length ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', display: 'grid', gap: 6 }}>
            {jobTypes.slice(0, 3).map((jt) => (
              <li key={jt.code} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                <span>{jt.label}</span>
                <span>{formatPercent(jt.response_rate)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: '#9ca3af', margin: '6px 0 0', fontSize: 13 }}>Not enough role data yet.</p>
        )}
      </div>
      <div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>Best industries</div>
        {industries.length ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', display: 'grid', gap: 6 }}>
            {industries.slice(0, 3).map((ind) => (
              <li key={ind.industry} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                <span>{ind.industry}</span>
                <span>{formatPercent(ind.offer_rate)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: '#9ca3af', margin: '6px 0 0', fontSize: 13 }}>Industry data coming soon.</p>
        )}
      </div>
    </div>
  );
}

function TrendStat({ label, value, muted = false }) {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 999,
        background: muted ? '#f3f4f6' : '#e0f2fe',
        color: muted ? '#6b7280' : '#0c4a6e',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {label}: {value}
    </div>
  );
}
