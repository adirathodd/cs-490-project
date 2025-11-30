import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../common/Icon';
import { jobsAPI, salaryNegotiationAPI } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import './SalaryProgression.css';

const defaultProgressionStats = { attempts: 0, avg_lift_percent: 0, timeline: [] };

const marketBenchmarks = [
  { location: 'New York, NY', industry: 'Tech', median: 185000, percentile75: 210000, growth: 6.5 },
  { location: 'Boston, MA', industry: 'Tech', median: 170000, percentile75: 192000, growth: 5.4 },
  { location: 'Austin, TX', industry: 'Tech', median: 160000, percentile75: 182000, growth: 4.9 },
];

const recommendations = [
  'Lead with total comp: equity plus bonus lifted outcomes by 10-18% in the last two moves.',
  'Anchor offers to the 75th percentile for New York tech roles to stay +12% above market.',
  'Showcase people leadership and product impact — these unlocked the largest jumps when moving from Lead to Manager.',
  'Negotiate remote flexibility as a lever: hybrid schedules landed an extra 3-4% in the last cycle.',
  'Time the next move around the 10-14 month mark; that window produced the fastest comp velocity.',
];

const benefitsTrend = [
  { label: 'Healthcare coverage', value: 'Improved to premium PPO + HSA match' },
  { label: 'Retirement & equity', value: '401k match up to 5% and recurring RSUs' },
  { label: 'Time off', value: 'From 15 to 20 PTO days, rollover allowed' },
  { label: 'Flexibility', value: 'Hybrid/remote and learning stipends added' },
];

const formatCurrency = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return `$${Math.round(num).toLocaleString()}`;
};

const normalizeNumber = (value, fallback = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
};

const getQuarterLabel = (dateString) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `Q${q}`;
};

const SalaryProgression = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [job, setJob] = useState(null);
  const [plan, setPlan] = useState(null);
  const [outcomes, setOutcomes] = useState([]);
  const [progression, setProgression] = useState(defaultProgressionStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadJobs = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await jobsAPI.getJobs();
        const list = data?.results ?? data ?? [];
        setJobs(Array.isArray(list) ? list : []);
        if (list?.length) {
          const initial = list[0];
          setSelectedJobId(String(initial.id));
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError(err?.message || 'Failed to load jobs');
        setLoading(false);
      }
    };
    loadJobs();
  }, []);

  useEffect(() => {
    const loadJobData = async () => {
      if (!selectedJobId) return;
      setLoading(true);
      setError('');
      try {
        const [jobData, planData, outcomeData] = await Promise.all([
          jobsAPI.getJob(selectedJobId),
          salaryNegotiationAPI.getPlan(selectedJobId).catch(() => null),
          salaryNegotiationAPI.getOutcomes(selectedJobId).catch(() => null),
        ]);
        setJob(jobData);
        setPlan(planData);
        setOutcomes(outcomeData?.results ?? planData?.outcomes ?? []);
        setProgression(outcomeData?.stats ?? planData?.progression ?? defaultProgressionStats);
      } catch (err) {
        setError(err?.message || 'Failed to load salary progression data');
      } finally {
        setLoading(false);
      }
    };

    loadJobData();
  }, [selectedJobId]);

  const offerHistory = useMemo(() => {
    if (!job) return [];
    const baseOffer = plan?.offer_details || {};
    const list = [];

    if (baseOffer.base_salary || baseOffer.bonus || baseOffer.equity) {
      const date = baseOffer.respond_by || plan?.updated_at || plan?.created_at;
      list.push({
        id: 'base-offer',
        date,
        year: date ? new Date(date).getFullYear() : '—',
        quarter: getQuarterLabel(date),
        role: job.title,
        company: job.company_name,
        location: job.location || 'Remote',
        level: 'Offer',
        initialSalary: normalizeNumber(baseOffer.base_salary, 0),
        finalSalary: normalizeNumber(baseOffer.base_salary, 0),
        bonus: normalizeNumber(baseOffer.bonus, 0),
        equity: normalizeNumber(baseOffer.equity, 0),
        negotiationLift: 0,
        monthsSincePrior: 0,
        benefitsScore: normalizeNumber(baseOffer.benefits_score, 75),
        totalComp:
          normalizeNumber(baseOffer.base_salary, 0) +
          normalizeNumber(baseOffer.bonus, 0) +
          normalizeNumber(baseOffer.equity, 0),
      });
    }

    (outcomes || []).forEach((item, idx) => {
      const date = item.created_at || plan?.updated_at;
      const base = normalizeNumber(item.base_salary ?? item.company_offer, 0);
      const finalSalary = normalizeNumber(item.final_result ?? item.counter_amount ?? base, base);
      const bonus = normalizeNumber(item.bonus, 0);
      const equity = normalizeNumber(item.equity, 0);
      const totalComp = normalizeNumber(
        item.total_comp_value,
        finalSalary + bonus + equity
      );
      const liftRaw =
        Number.isFinite(item.lift_percent) && item.lift_percent !== null
          ? item.lift_percent
          : base > 0
          ? ((finalSalary - base) / base) * 100
          : 0;

      list.push({
        id: item.id || `outcome-${idx}`,
        date,
        year: date ? new Date(date).getFullYear() : '—',
        quarter: getQuarterLabel(date),
        role: job.title,
        company: job.company_name,
        location: job.location || 'Remote',
        level: item.stage || 'Negotiation',
        stage: item.stage,
        status: item.status,
        initialSalary: base,
        finalSalary,
        bonus,
        equity,
        negotiationLift: liftRaw,
        monthsSincePrior: 0,
        benefitsScore: normalizeNumber(item.benefits_score, normalizeNumber(baseOffer.benefits_score, 75)),
        totalComp,
        notes: item.notes,
      });
    });

    const sorted = list.sort((a, b) => {
      const aDate = new Date(a.date || 0).getTime();
      const bDate = new Date(b.date || 0).getTime();
      return aDate - bDate;
    });

    return sorted.map((entry, idx) => {
      if (idx === 0) return entry;
      const prev = sorted[idx - 1];
      const currentDate = new Date(entry.date || 0);
      const prevDate = new Date(prev.date || 0);
      const months =
        Number.isNaN(currentDate.getTime()) || Number.isNaN(prevDate.getTime())
          ? 0
          : Math.max(
              0,
              (currentDate.getFullYear() - prevDate.getFullYear()) * 12 + (currentDate.getMonth() - prevDate.getMonth())
            );
      return { ...entry, monthsSincePrior: months };
    });
  }, [job, outcomes, plan]);

  const latest = offerHistory[offerHistory.length - 1];
  const latestTotalComp = latest ? (latest.totalComp ?? latest.finalSalary + latest.bonus + latest.equity) : 0;

  const totals = useMemo(
    () =>
      offerHistory.map((offer) => ({
        ...offer,
        totalComp: offer.totalComp ?? offer.finalSalary + offer.bonus + offer.equity,
      })),
    [offerHistory]
  );

  const maxTotalComp = useMemo(() => (totals.length ? Math.max(...totals.map((o) => o.totalComp)) : 0), [totals]);

  const averageGrowth = useMemo(() => {
    if (totals.length < 2) return 0;
    const first = totals[0].totalComp;
    const last = totals[totals.length - 1].totalComp;
    if (!first) return 0;
    return ((last - first) / first) * 100;
  }, [totals]);

  const attemptsWithStatus = useMemo(() => offerHistory.filter((o) => o.status), [offerHistory]);

  const negotiationSuccessRate = useMemo(() => {
    if (!attemptsWithStatus.length) return 0;
    const successful = attemptsWithStatus.filter((o) => (o.status || '').toLowerCase() === 'won').length;
    return Math.round((successful / attemptsWithStatus.length) * 100);
  }, [attemptsWithStatus]);

  const averageNegotiationLift = useMemo(() => {
    const lifts = attemptsWithStatus
      .filter((o) => Number.isFinite(o.negotiationLift))
      .map((o) => normalizeNumber(o.negotiationLift, 0));
    if (lifts.length) {
      return lifts.reduce((acc, cur) => acc + cur, 0) / lifts.length;
    }
    return normalizeNumber(progression.avg_lift_percent, 0);
  }, [attemptsWithStatus, progression.avg_lift_percent]);

  const bestTimingWindow = useMemo(() => {
    const windows = totals.slice(1).map((entry, idx) => {
      const previous = totals[idx];
      const growthPct = previous.totalComp ? ((entry.totalComp - previous.totalComp) / previous.totalComp) * 100 : 0;
      const months = entry.monthsSincePrior || 12;
      return { months, growthPct, velocity: months ? growthPct / months : 0, entry };
    });

    if (!windows.length) {
      return { label: 'Add your latest offer', summary: 'Log new offers to see optimal move timing.' };
    }

    const best = windows.reduce((top, curr) => (curr.velocity > top.velocity ? curr : top), windows[0]);
    const roundedVelocity = Math.round(best.velocity * 100) / 100;
    return {
      label: `${best.months} month window`,
      summary: `Highest comp velocity (${roundedVelocity}% per month) landed when moving to ${best.entry.role} at ${best.entry.company}.`,
    };
  }, [totals]);

  const marketPosition = useMemo(() => {
    if (!latest) {
      const benchmark = marketBenchmarks[0];
      return { ...benchmark, delta: 0 };
    }
    const jobLocation = (latest.location || '').toLowerCase();
    const benchmark =
      marketBenchmarks.find((m) => jobLocation.includes(m.location.split(',')[0].toLowerCase())) || marketBenchmarks[0];
    const delta = benchmark.median ? ((latest.finalSalary - benchmark.median) / benchmark.median) * 100 : 0;
    return {
      location: benchmark.location,
      industry: benchmark.industry,
      median: benchmark.median,
      percentile75: benchmark.percentile75,
      growth: benchmark.growth,
      delta,
    };
  }, [latest]);

  const offersNegotiatedUp = useMemo(
    () => attemptsWithStatus.filter((o) => normalizeNumber(o.negotiationLift, 0) > 0).length,
    [attemptsWithStatus]
  );

  const bestTactic =
    plan?.plan?.offer_guidance?.decision_filters?.[0] ||
    plan?.plan?.talking_points?.[0] ||
    'Log more negotiation data to unlock insights.';

  const negotiationPerformanceStats = useMemo(
    () => [
      {
        label: 'Offers negotiated up',
        value: attemptsWithStatus.length ? `${offersNegotiatedUp}/${attemptsWithStatus.length}` : '—',
      },
      {
        label: 'Average uplift per negotiation',
        value: attemptsWithStatus.length ? averageNegotiationLift.toFixed(1) : '0.0',
        unit: '%',
      },
      { label: 'Best tactic', value: bestTactic },
      { label: 'Win rate last 2 years', value: `${negotiationSuccessRate}%` },
    ],
    [attemptsWithStatus.length, offersNegotiatedUp, averageNegotiationLift, bestTactic, negotiationSuccessRate]
  );

  return (
    <div className="salary-progression-container">
      {loading && <LoadingSpinner />}
      {!loading && (
      <div className="salary-progression-hero">
        <div>
          <h1>Salary progression cockpit</h1>
          <p className="lead">
            Track compensation growth, negotiation outcomes, and market positioning to plan the next move with confidence.
          </p>
          <div className="job-picker">
            <label htmlFor="job-select">Job</label>
            <select
              id="job-select"
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
            >
              {jobs.length === 0 && <option value="">No jobs available</option>}
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} · {j.company_name}
                </option>
              ))}
            </select>
            {!jobs.length && <span className="picker-hint">Add a job to view salary progression.</span>}
          </div>
          <div className="hero-metrics">
            <div className="metric-pill">
              <span className="label">Total comp trajectory</span>
              <strong>{latest ? formatCurrency(latestTotalComp) : '—'}</strong>
              <span className="subtext">{latest ? `+${averageGrowth.toFixed(1)}% since first offer` : 'Waiting for data'}</span>
            </div>
            <div className="metric-pill">
              <span className="label">Market position</span>
              <strong>{(marketPosition.delta >= 0 ? '+' : '') + marketPosition.delta.toFixed(1)}% vs median</strong>
              <span className="subtext">
                {marketPosition.industry} · {marketPosition.location}
              </span>
            </div>
            <div className="metric-pill">
              <span className="label">Negotiation success</span>
              <strong>{negotiationSuccessRate}% win rate</strong>
              <span className="subtext">Avg uplift {averageNegotiationLift.toFixed(1)}%</span>
            </div>
          </div>
        </div>
        <div className="hero-badge">
          <Icon name="target" size="lg" />
          <div>
            <p className="label">Optimal timing</p>
            <strong>{bestTimingWindow.label}</strong>
            <p className="subtext">{bestTimingWindow.summary}</p>
          </div>
        </div>
      </div>
      )}

      {error && (
        <div className="progression-error">
          <Icon name="alert-circle" size="sm" /> {error}
        </div>
      )}

      {!loading && !offerHistory.length && (
        <div className="salary-card full-width" style={{ marginTop: 16 }}>
          <div className="card-header">
            <h3>
              <Icon name="alert-circle" size="md" /> No salary data yet
            </h3>
            <p>Capture an offer and log negotiation outcomes in the Salary Negotiation tool to see progression here.</p>
          </div>
        </div>
      )}

      {!loading && offerHistory.length > 0 && (
      <div className="salary-grid">
        <div className="salary-card full-width">
          <div className="card-header">
            <h3>
              <Icon name="chart" size="md" /> Offer history & negotiation outcomes
            </h3>
            <p>Track each offer, the uplift won, and how total comp evolved over time.</p>
          </div>
          <div className="offer-timeline">
            {totals.map((offer) => {
              const width = maxTotalComp ? Math.min(Math.max((offer.totalComp / maxTotalComp) * 100, 6), 100) : 0;
              return (
                <div key={offer.id} className="timeline-row">
                  <div className="timeline-meta">
                    <div className="title">
                      {offer.year} {offer.quarter} · {offer.role}
                    </div>
                    <div className="subtitle">
                      {offer.company} · {offer.location} · {offer.level}
                    </div>
                  </div>
                  <div className="timeline-bar">
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${width}%` }}>
                        {formatCurrency(offer.totalComp)}
                      </div>
                    </div>
                    <div className="bar-meta">
                      <span>Initial: {formatCurrency(offer.initialSalary)}</span>
                      <span>Final: {formatCurrency(offer.finalSalary)}</span>
                      <span>Bonus: {formatCurrency(offer.bonus)}</span>
                      <span>Equity: {formatCurrency(offer.equity)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="salary-card">
          <div className="card-header">
            <h3>
              <Icon name="briefcase" size="md" /> Market positioning by location
            </h3>
            <p>Compare personal comp against regional tech benchmarks.</p>
          </div>
          <div className="benchmark-summary">
            <div>
              <p className="label">Current market</p>
              <strong>{marketPosition.location}</strong>
              <p className="subtext">{marketPosition.industry}</p>
            </div>
            <div>
              <p className="label">Market median</p>
              <strong>{formatCurrency(marketPosition.median)}</strong>
              <p className="subtext">75th pct: {formatCurrency(marketPosition.percentile75)}</p>
            </div>
            <div>
              <p className="label">Personal position</p>
              <strong>{(marketPosition.delta >= 0 ? '+' : '') + marketPosition.delta.toFixed(1)}%</strong>
              <p className="subtext">Trend: +{marketPosition.growth}% YoY</p>
            </div>
          </div>
          <div className="benchmark-table">
            {marketBenchmarks.map((market) => (
              <div key={market.location} className="benchmark-row">
                <div>
                  <div className="title">{market.location}</div>
                  <div className="subtitle">{market.industry} market</div>
                </div>
                <div className="stat">
                  <span className="label">Median</span>
                  <strong>{formatCurrency(market.median)}</strong>
                </div>
                <div className="stat">
                  <span className="label">75th pct</span>
                  <strong>{formatCurrency(market.percentile75)}</strong>
                </div>
                <div className="stat">
                  <span className="label">Growth</span>
                  <strong>+{market.growth}%</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="salary-card">
          <div className="card-header">
            <h3>
              <Icon name="dollar" size="md" /> Total compensation evolution
            </h3>
            <p>Base, bonus, equity, and benefits progression.</p>
          </div>
          <div className="comp-grid">
            {totals.map((offer) => (
              <div key={`${offer.id}-comp`} className="comp-block">
                <div className="comp-header">
                  <span className="title">
                    {offer.year} {offer.quarter}
                  </span>
                  <span className="chip">{offer.level}</span>
                </div>
                <div className="comp-bars">
                  {(() => {
                    const widthFor = (value) => {
                      if (!maxTotalComp || !value) return 0;
                      return Math.min((value / maxTotalComp) * 100, 100);
                    };
                    const baseWidth = widthFor(offer.finalSalary);
                    const bonusWidth = widthFor(offer.bonus);
                    const equityWidth = widthFor(offer.equity);
                    return (
                      <>
                        <div className="comp-bar">
                          <span>Base</span>
                          <div className="bar">
                            <div className={`bar-fill base ${baseWidth === 0 ? 'empty' : ''}`} style={{ width: `${baseWidth}%` }} />
                          </div>
                          <strong>{formatCurrency(offer.finalSalary)}</strong>
                        </div>
                        <div className="comp-bar">
                          <span>Bonus</span>
                          <div className="bar">
                            <div className={`bar-fill bonus ${bonusWidth === 0 ? 'empty' : ''}`} style={{ width: `${bonusWidth}%` }} />
                          </div>
                          <strong>{formatCurrency(offer.bonus)}</strong>
                        </div>
                        <div className="comp-bar">
                          <span>Equity</span>
                          <div className="bar">
                            <div className={`bar-fill equity ${equityWidth === 0 ? 'empty' : ''}`} style={{ width: `${equityWidth}%` }} />
                          </div>
                          <strong>{formatCurrency(offer.equity)}</strong>
                        </div>
                      </>
                    );
                  })()}
                  <div className="comp-footer">
                    <span>Benefits score</span>
                    <strong>{offer.benefitsScore}/100</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="salary-card">
          <div className="card-header">
            <h3>
              <Icon name="activity" size="md" /> Negotiation performance
            </h3>
            <p>Success rates, tactics, and improvement patterns.</p>
          </div>
          <div className="stat-grid">
            {negotiationPerformanceStats.map((item) => (
              <div key={item.label} className="stat-card">
                <p className="label">{item.label}</p>
                <strong>
                  {item.unit ? `${item.value}${item.unit}` : item.value}
                </strong>
              </div>
            ))}
          </div>
          <div className="negotiation-insight">
            <Icon name="idea" size="md" />
            <div>
              <p className="label">Improvement pattern</p>
              <p>
                Biggest lifts came when pairing market data with quantified impact (revenue lift, product adoption) and
                holding a counter window of 48-72 hours.
              </p>
            </div>
          </div>
        </div>

        <div className="salary-card">
          <div className="card-header">
            <h3>
              <Icon name="layers" size="md" /> Benefits & perks trend
            </h3>
            <p>Benefits quality and perks added across roles.</p>
          </div>
          <ul className="benefits-list">
            {benefitsTrend.map((item) => (
              <li key={item.label}>
                <Icon name="check" size="sm" color="#10b981" /> <strong>{item.label}:</strong> {item.value}
              </li>
            ))}
          </ul>
        </div>

        <div className="salary-card">
          <div className="card-header">
            <h3>
              <Icon name="target" size="md" /> Recommendations for salary growth
            </h3>
            <p>Actionable moves based on progression, market position, and negotiation wins.</p>
          </div>
          <ul className="recommendations">
            {recommendations.map((item) => (
              <li key={item}>
                <Icon name="arrow-right" size="sm" /> {item}
              </li>
            ))}
          </ul>
          <div className="timing-card">
            <div>
              <p className="label">Optimal career move timing</p>
              <strong>{bestTimingWindow.label}</strong>
              <p className="subtext">{bestTimingWindow.summary}</p>
            </div>
            <div className="pill success">Ready for the next negotiation</div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default SalaryProgression;
