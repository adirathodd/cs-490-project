import React, { useEffect, useState } from 'react';
import { jobsAPI } from '../../services/api';
import Icon from '../common/Icon';

const shell = {
  maxWidth: 1200,
  margin: '0 auto',
  display: 'grid',
  gap: 16,
  padding: 16,
};

const card = {
  padding: 16,
  borderRadius: 12,
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  boxShadow: '0 10px 30px rgba(31, 41, 55, 0.06)',
};

export default function ProductivityAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await jobsAPI.getProductivityAnalytics();
        if (mounted) {
          setData(resp);
          setError('');
        }
      } catch (e) {
        setError('Unable to load productivity insights right now.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div style={{ padding: 20 }}>Loading productivity insights...</div>;
  if (error) return <div style={{ padding: 20, color: '#b91c1c' }}>{error}</div>;
  if (!data) return null;

  const {
    time_investment = {},
    patterns = {},
    completion = {},
    outcomes = {},
    balance = {},
    energy = {},
    recommendations = [],
  } = data;

  const activities = Object.entries(time_investment.activities || {});
  const bestBlock = patterns.best_time_block;

  return (
    <div style={shell}>
      <div
        style={{
          ...card,
          background: 'linear-gradient(120deg, #0ea5e9, #6366f1)',
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ opacity: 0.8, fontSize: 12, letterSpacing: 0.5 }}>TIME INVESTMENT</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{time_investment.total_hours || 0} hrs logged</div>
            <div style={{ opacity: 0.9, fontSize: 13 }}>
              Focus map across applications, networking, prep, and learning.
            </div>
          </div>
          {balance && (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.15)',
                minWidth: 220,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
                <Icon name="bolt" /> Balance
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                {balance.avg_daily_hours || 0} hrs/day
              </div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                {balance.burnout_risk ? 'Burnout risk: adjust workload' : 'Healthy pace'}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {activities.map(([key, value]) => (
          <div key={key} style={card}>
            <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
              {key.replace('_', ' ')}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{value.hours || 0} hrs</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {value.sessions || 0} sessions · {value.last_logged ? new Date(value.last_logged).toLocaleDateString() : 'n/a'}
            </div>
          </div>
        ))}
        {activities.length === 0 && (
          <div style={card}>
            <div style={{ fontSize: 14, color: '#6b7280' }}>No time entries yet. Log activities to see insights.</div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, alignItems: 'stretch' }}>
        <div style={card}>
          <SectionHeader title="Productivity Patterns" subtitle="Where your time and outcomes converge" />
          {bestBlock ? (
            <div style={{ padding: 12, borderRadius: 10, background: '#ecfdf3', border: '1px solid #86efac', marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: '#166534' }}>Peak window</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#14532d' }}>{bestBlock.block}</div>
              <div style={{ fontSize: 12, color: '#166534' }}>
                Response {bestBlock.response_rate}% · Offers {bestBlock.offer_rate}%
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>No pattern yet. Keep logging time.</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <PatternBars title="By day" items={patterns.by_day || []} />
            <PatternBars title="By time block" items={patterns.by_time_block || []} field="response_rate" />
          </div>
        </div>
        <div style={card}>
          <SectionHeader title="Outcome Yield" subtitle="What you get back for the hours you invest" />
          <div style={{ display: 'grid', gap: 10 }}>
            <StatPill label="Responses per hour" value={outcomes.responses_per_hour ?? 0} tone="blue" />
            <StatPill label="Interviews per hour" value={outcomes.interviews_per_hour ?? 0} tone="amber" />
            <StatPill
              label="Hours per offer"
              value={outcomes.hours_per_offer != null ? outcomes.hours_per_offer : '—'}
              tone="emerald"
            />
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Applications: {outcomes.applications || 0} · Responses: {outcomes.responses || 0} · Offers: {outcomes.offers || 0}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={card}>
          <SectionHeader title="Completion & Efficiency" subtitle="Progress across goals and prep" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <StatTile label="Goals completion" value={`${completion.goal_completion_rate || 0}%`} />
            <StatTile label="Prep tasks" value={`${completion.prep_task_completion_rate || 0}%`} />
            <StatTile label="Follow-ups" value={`${completion.follow_up_completion_rate || 0}%`} />
          </div>
        </div>
        <div style={card}>
          <SectionHeader title="Balance & Burnout" subtitle={balance.notes || ''} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: balance.burnout_risk ? '#b91c1c' : '#16a34a' }}>
              {balance.avg_daily_hours || 0} hrs/day
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Late sessions: {balance.late_sessions || 0}
              <br />
              {balance.burnout_risk ? 'Ease up to avoid burnout.' : 'Pace looks sustainable.'}
            </div>
          </div>
        </div>
      </div>

      <div style={card}>
        <SectionHeader title="Energy Signals" subtitle="Correlate effort with outcomes" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          {(energy.time_block_success || []).map((item) => (
            <div key={item.block} style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 700 }}>{item.block}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Resp {item.response_rate}% · Offer {item.offer_rate}%</div>
            </div>
          ))}
          {(energy.time_block_success || []).length === 0 && (
            <div style={{ fontSize: 13, color: '#6b7280' }}>No response patterns yet.</div>
          )}
        </div>
      </div>

      <div style={card}>
        <SectionHeader title="Recommendations" subtitle="Fast adjustments to improve yield and protect energy" />
        {recommendations.length ? (
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            {recommendations.map((rec, idx) => (
              <li key={idx} style={{ fontSize: 13, color: '#111827' }}>
                {rec}
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ fontSize: 13, color: '#6b7280' }}>Keep logging to unlock personalized coaching.</div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: '#6b7280' }}>{subtitle}</div>}
    </div>
  );
}

function PatternBars({ title, items, field = 'hours' }) {
  const maxValue = Math.max(...items.map((i) => i[field] || 0), 1);
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', minHeight: 90 }}>
        {items.map((item) => (
          <div key={item.label || item.block} style={{ flex: 1 }}>
            <div
              style={{
                height: `${((item[field] || 0) / maxValue) * 80}px`,
                minHeight: 6,
                borderRadius: 6,
                background: 'linear-gradient(180deg, #3b82f6, #1d4ed8)',
              }}
            />
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, textAlign: 'center' }}>
              {item.label || item.block}
            </div>
            <div style={{ fontSize: 11, color: '#111827', textAlign: 'center' }}>
              {field === 'hours' ? `${item[field] || 0}h` : `${item[field] || 0}%`}
            </div>
          </div>
        ))}
        {items.length === 0 && <div style={{ fontSize: 12, color: '#6b7280' }}>No data yet</div>}
      </div>
    </div>
  );
}

function StatPill({ label, value, tone = 'blue' }) {
  const palette = {
    blue: '#2563eb',
    amber: '#f59e0b',
    emerald: '#059669',
  };
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderRadius: 10,
        background: '#f8fafc',
        border: `1px solid ${palette[tone]}`,
      }}
    >
      <div style={{ fontSize: 13, color: '#4b5563' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: palette[tone] }}>{value}</div>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div style={{ padding: 12, borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{value}</div>
    </div>
  );
}
