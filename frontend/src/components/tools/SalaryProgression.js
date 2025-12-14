import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../common/Icon';
import { jobsAPI, salaryNegotiationAPI, offerAPI } from '../../services/api';
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

const emptyOfferForm = {
  job_id: '',
  role_title: '',
  company_name: '',
  location: '',
  remote_policy: 'onsite',
  base_salary: '',
  bonus: '',
  equity: '',
  benefits: {
    healthValue: '',
    retirementValue: '',
    wellnessValue: '',
    otherValue: '',
    ptoDays: '',
  },
  culture_fit_score: 8,
  growth_opportunity_score: 8,
  work_life_balance_score: 8,
  notes: '',
};

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
  const [offerComparison, setOfferComparison] = useState(null);
  const [rawOffers, setRawOffers] = useState([]);
  const [archivedOffers, setArchivedOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offerError, setOfferError] = useState('');
  const [offerForm, setOfferForm] = useState({ ...emptyOfferForm, benefits: { ...emptyOfferForm.benefits } });
  const [savingOffer, setSavingOffer] = useState(false);
  const [scenarioForm, setScenarioForm] = useState({ salary_increase_percent: 10, targetOffer: 'all' });
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [archiveReasons, setArchiveReasons] = useState({});

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

  const refreshOfferComparison = async () => {
    setOffersLoading(true);
    setOfferError('');
    try {
      const data = await offerAPI.getComparison({ includeArchived: true });
      setOfferComparison(data);
      setRawOffers(data.raw_offers ?? []);
      setArchivedOffers(data.archived_offers ?? []);
    } catch (err) {
      setOfferError(err?.message || 'Failed to load offer comparison');
    } finally {
      setOffersLoading(false);
    }
  };

  useEffect(() => {
    refreshOfferComparison();
  }, []);

  const resetOfferForm = () => setOfferForm({ ...emptyOfferForm, benefits: { ...emptyOfferForm.benefits } });

  const handleJobSelectionForOffer = (event) => {
    const jobId = event.target.value;
    if (!jobId) {
      resetOfferForm();
      return;
    }
    const selectedJob = jobs.find((j) => String(j.id) === jobId);
    if (selectedJob) {
      setOfferForm((prev) => ({
        ...prev,
        job_id: jobId,
        role_title: selectedJob.title || '',
        company_name: selectedJob.company_name || '',
        location: selectedJob.location || '',
        base_salary: selectedJob.salary_min ? String(selectedJob.salary_min) : '',
      }));
    }
  };

  const handleOfferFieldChange = (field) => (event) => {
    const value = event.target.value;
    setOfferForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBenefitFieldChange = (field) => (event) => {
    const value = event.target.value;
    setOfferForm((prev) => ({ ...prev, benefits: { ...prev.benefits, [field]: value } }));
  };

  const handleScenarioFieldChange = (field) => (event) => {
    const value = event.target.value;
    setScenarioForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleOfferSubmit = async (event) => {
    event.preventDefault();
    setSavingOffer(true);
    setOfferError('');
    try {
      const benefitsPayload = {};
      Object.entries(offerForm.benefits).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          benefitsPayload[key] = Number(value);
        }
      });
      const payload = {
        job_id: offerForm.job_id ? Number(offerForm.job_id) : null,
        role_title: offerForm.role_title,
        company_name: offerForm.company_name,
        location: offerForm.location,
        remote_policy: offerForm.remote_policy,
        base_salary: Number(offerForm.base_salary || 0),
        bonus: Number(offerForm.bonus || 0),
        equity: Number(offerForm.equity || 0),
        benefits: benefitsPayload,
        culture_fit_score: Number(offerForm.culture_fit_score || 0),
        growth_opportunity_score: Number(offerForm.growth_opportunity_score || 0),
        work_life_balance_score: Number(offerForm.work_life_balance_score || 0),
        notes: offerForm.notes,
      };
      await offerAPI.create(payload);
      resetOfferForm();
      await refreshOfferComparison();
    } catch (err) {
      setOfferError(err?.message || 'Failed to save job offer');
    } finally {
      setSavingOffer(false);
    }
  };

  const handleScenarioSubmit = async (event) => {
    event.preventDefault();
    if (!offerComparison?.offers?.length) return;
    setScenarioLoading(true);
    setOfferError('');
    try {
      const payload = {};
      const percent = Number(scenarioForm.salary_increase_percent || 0);
      if (percent) payload.salary_increase_percent = percent;
      if (scenarioForm.targetOffer && scenarioForm.targetOffer !== 'all') {
        payload.offer_ids = [Number(scenarioForm.targetOffer)];
      }
      const data = await offerAPI.runScenario(payload);
      setOfferComparison(data);
      setRawOffers(data.raw_offers ?? []);
      setArchivedOffers(data.archived_offers ?? []);
    } catch (err) {
      setOfferError(err?.message || 'Failed to run scenario analysis');
    } finally {
      setScenarioLoading(false);
    }
  };

  const handleScenarioReset = () => {
    setScenarioForm({ salary_increase_percent: 10, targetOffer: 'all' });
    refreshOfferComparison();
  };

  const handleArchiveReasonChange = (offerId, value) => {
    setArchiveReasons((prev) => ({ ...prev, [offerId]: value }));
  };

  const handleArchiveOffer = async (offerId, reason) => {
    setOfferError('');
    try {
      await offerAPI.archive(offerId, reason || 'declined');
      await refreshOfferComparison();
    } catch (err) {
      setOfferError(err?.message || 'Failed to archive offer');
    }
  };

  const renderComparisonMatrix = () => {
    if (!offerComparison?.matrix?.headers?.length) {
      return <p className="matrix-placeholder">Log at least one offer to unlock the comparison matrix.</p>;
    }
    const headers = offerComparison.matrix.headers;
    const rows = offerComparison.matrix.rows || [];
    const topOfferId = offerComparison?.summary?.top_overall?.offer_id;

    const formatValue = (row, value) => {
      if (value === null || value === undefined || value === '') return '—';
      const num = Number(value);
      if (Number.isNaN(num)) return value;
      if (row.format === 'currency') return formatCurrency(num);
      if (row.format === 'score') return num % 1 === 0 ? num : num.toFixed(1);
      if (row.format === 'number') return num.toFixed(1);
      return formatCurrency(num);
    };

    const getBestIndex = (row) => {
      if (!row.values || row.values.length < 2) return -1;
      const validValues = row.values.map((v, i) => ({ v: Number(v), i })).filter(({ v }) => Number.isFinite(v));
      if (validValues.length < 2) return -1;
      // For COL index, lower is better
      if (row.key === 'cost_of_living_index') {
        const min = Math.min(...validValues.map(({ v }) => v));
        const best = validValues.find(({ v }) => v === min);
        return best ? best.i : -1;
      }
      // For all other metrics, higher is better
      const max = Math.max(...validValues.map(({ v }) => v));
      const best = validValues.find(({ v }) => v === max);
      return best ? best.i : -1;
    };

    const getRowIcon = (key) => {
      const icons = {
        base_salary: 'dollar-sign',
        bonus: 'gift',
        equity: 'trending-up',
        benefits_value: 'heart',
        total_comp: 'briefcase',
        adjusted_total_comp: 'target',
        cost_of_living_index: 'map-pin',
        culture_fit_score: 'users',
        growth_opportunity_score: 'arrow-up',
        work_life_balance_score: 'sun',
        overall_score: 'award',
      };
      return icons[key] || null;
    };

    const remotePolicyBadge = (policy) => {
      const labels = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'Onsite' };
      const classes = { remote: 'badge-remote', hybrid: 'badge-hybrid', onsite: 'badge-onsite' };
      return (
        <span className={`matrix-badge ${classes[policy] || 'badge-onsite'}`}>
          {labels[policy] || policy}
        </span>
      );
    };

    return (
      <div className="offer-matrix">
        <div className="matrix-row matrix-header">
          <div className="matrix-cell metric">Metric</div>
          {headers.map((header) => {
            const isWinner = header.id === topOfferId;
            return (
              <div key={header.id} className={`matrix-cell highlight ${isWinner ? 'winner' : ''}`}>
                {isWinner && <span className="winner-badge"><Icon name="award" size="sm" /> Top Pick</span>}
                <div className="matrix-title">{header.company}</div>
                <div className="matrix-subtitle">{header.label}</div>
                <div className="matrix-location">
                  <Icon name="map-pin" size="sm" /> {header.location || 'Remote'}
                  {remotePolicyBadge(header.remote_policy)}
                </div>
              </div>
            );
          })}
        </div>
        {rows.map((row, rowIndex) => {
          const bestIdx = getBestIndex(row);
          const isHighlight = row.key === 'total_comp' || row.key === 'adjusted_total_comp' || row.key === 'overall_score';
          const icon = getRowIcon(row.key);
          return (
            <div key={row.key} className={`matrix-row ${isHighlight ? 'row-highlight' : ''} ${rowIndex % 2 === 1 ? 'row-stripe' : ''}`}>
              <div className="matrix-cell metric">
                {icon && <Icon name={icon} size="sm" />}
                {row.label}
              </div>
              {row.values.map((value, idx) => {
                const isBest = idx === bestIdx && headers.length > 1;
                return (
                  <div key={`${row.key}-${headers[idx]?.id || idx}`} className={`matrix-cell ${isBest ? 'best-value' : ''}`}>
                    {formatValue(row, value)}
                    {isBest && <span className="best-indicator">★</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

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
        <div className="hero-content">
          <p className="eyebrow">Career Intelligence</p>
          <h1>Salary Progression Cockpit</h1>
          <p className="lead">
            Track compensation growth, negotiation outcomes, and market positioning to plan your next move with confidence.
          </p>
          <div className="job-picker">
            <label htmlFor="job-select">Select Job</label>
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
              <span className="label">Total Comp Trajectory</span>
              <strong>{latest ? formatCurrency(latestTotalComp) : '—'}</strong>
              <span className="subtext">{latest ? `+${averageGrowth.toFixed(1)}% since first offer` : 'Waiting for data'}</span>
            </div>
            <div className="metric-pill">
              <span className="label">Market Position</span>
              <strong>{(marketPosition.delta >= 0 ? '+' : '') + marketPosition.delta.toFixed(1)}% vs median</strong>
              <span className="subtext">
                {marketPosition.industry} · {marketPosition.location}
              </span>
            </div>
            <div className="metric-pill">
              <span className="label">Negotiation Success</span>
              <strong>{negotiationSuccessRate}% win rate</strong>
              <span className="subtext">Avg uplift {averageNegotiationLift.toFixed(1)}%</span>
            </div>
          </div>
        </div>
        <div className="hero-badge">
          <Icon name="target" size="lg" />
          <div>
            <p className="label">Optimal Timing</p>
            <strong>{bestTimingWindow.label}</strong>
            <p className="subtext">{bestTimingWindow.summary}</p>
          </div>
        </div>
      </div>
      )}

      {!loading && (
        <div className="offer-comparison-section">
          <div className="salary-card full-width">
            <div className="card-header">
              <h3>
                <Icon name="layers" size="md" /> Offer Comparison Lab
              </h3>
              <p>Capture competing offers, compare total compensation, and score qualitative factors before making your decision.</p>
            </div>
            {offerError && (
              <div className="progression-error">
                <Icon name="alert-circle" size="sm" /> {offerError}
              </div>
            )}
            <div className="offer-form-grid">
              <form className="offer-form" onSubmit={handleOfferSubmit}>
                <div className="form-row">
                  <label htmlFor="offer-job-select">Link to existing job (optional)</label>
                  <select id="offer-job-select" value={offerForm.job_id} onChange={handleJobSelectionForOffer}>
                    <option value="">— Select a job to prefill —</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title} @ {j.company_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label htmlFor="offer-role-title">Role title *</label>
                  <input id="offer-role-title" value={offerForm.role_title} onChange={handleOfferFieldChange('role_title')} required />
                </div>
                <div className="form-row">
                  <label htmlFor="offer-company">Company *</label>
                  <input id="offer-company" value={offerForm.company_name} onChange={handleOfferFieldChange('company_name')} required />
                </div>
                <div className="form-row">
                  <label htmlFor="offer-location">Location *</label>
                  <input
                    id="offer-location"
                    value={offerForm.location}
                    onChange={handleOfferFieldChange('location')}
                    required
                    placeholder="City, ST or Remote"
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="offer-remote-policy">Remote policy</label>
                  <select id="offer-remote-policy" value={offerForm.remote_policy} onChange={handleOfferFieldChange('remote_policy')}>
                    <option value="onsite">Onsite</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="remote">Remote</option>
                  </select>
                </div>
                <div className="form-grid">
                  <div>
                    <label htmlFor="offer-base-salary">Base salary ($)</label>
                    <input
                      id="offer-base-salary"
                      type="number"
                      min="0"
                      value={offerForm.base_salary}
                      onChange={handleOfferFieldChange('base_salary')}
                    />
                  </div>
                  <div>
                    <label htmlFor="offer-bonus">Bonus ($)</label>
                    <input id="offer-bonus" type="number" min="0" value={offerForm.bonus} onChange={handleOfferFieldChange('bonus')} />
                  </div>
                  <div>
                    <label htmlFor="offer-equity">Equity ($)</label>
                    <input id="offer-equity" type="number" min="0" value={offerForm.equity} onChange={handleOfferFieldChange('equity')} />
                  </div>
                </div>
                <div className="form-grid">
                  <div>
                    <label htmlFor="offer-health">Health value ($)</label>
                    <input
                      id="offer-health"
                      type="number"
                      min="0"
                      value={offerForm.benefits.healthValue}
                      onChange={handleBenefitFieldChange('healthValue')}
                    />
                  </div>
                  <div>
                    <label htmlFor="offer-retirement">Retirement match ($)</label>
                    <input
                      id="offer-retirement"
                      type="number"
                      min="0"
                      value={offerForm.benefits.retirementValue}
                      onChange={handleBenefitFieldChange('retirementValue')}
                    />
                  </div>
                  <div>
                    <label htmlFor="offer-pto">PTO days</label>
                    <input id="offer-pto" type="number" min="0" value={offerForm.benefits.ptoDays} onChange={handleBenefitFieldChange('ptoDays')} />
                  </div>
                </div>
                <div className="form-grid">
                  <div>
                    <label htmlFor="offer-culture">Culture fit (1-10)</label>
                    <input
                      id="offer-culture"
                      type="number"
                      min="1"
                      max="10"
                      value={offerForm.culture_fit_score}
                      onChange={handleOfferFieldChange('culture_fit_score')}
                    />
                  </div>
                  <div>
                    <label htmlFor="offer-growth">Growth (1-10)</label>
                    <input
                      id="offer-growth"
                      type="number"
                      min="1"
                      max="10"
                      value={offerForm.growth_opportunity_score}
                      onChange={handleOfferFieldChange('growth_opportunity_score')}
                    />
                  </div>
                  <div>
                    <label htmlFor="offer-wlb">Work-life balance (1-10)</label>
                    <input
                      id="offer-wlb"
                      type="number"
                      min="1"
                      max="10"
                      value={offerForm.work_life_balance_score}
                      onChange={handleOfferFieldChange('work_life_balance_score')}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="offer-notes">Notes</label>
                  <textarea
                    id="offer-notes"
                    rows={2}
                    value={offerForm.notes}
                    onChange={handleOfferFieldChange('notes')}
                    placeholder="Team dynamics, red flags, etc."
                  />
                </div>
                <button type="submit" className="primary" disabled={savingOffer}>
                  {savingOffer ? 'Saving...' : 'Save offer'}
                </button>
              </form>
              <div className="offer-side-panel">
                <div className="scenario-card">
                  <h4><Icon name="activity" size="sm" /> Scenario Analysis</h4>
                  <form onSubmit={handleScenarioSubmit}>
                    <label htmlFor="scenario-salary">Salary Increase (%)</label>
                    <input
                      id="scenario-salary"
                      type="number"
                      min="0"
                      value={scenarioForm.salary_increase_percent}
                      onChange={handleScenarioFieldChange('salary_increase_percent')}
                    />
                    <label htmlFor="scenario-target">Apply To</label>
                    <select id="scenario-target" value={scenarioForm.targetOffer} onChange={handleScenarioFieldChange('targetOffer')}>
                      <option value="all">All offers</option>
                      {rawOffers.map((offer) => (
                        <option key={`target-${offer.id}`} value={offer.id}>
                          {offer.company_name} · {offer.role_title}
                        </option>
                      ))}
                    </select>
                    <div className="scenario-actions">
                      <button type="submit" disabled={scenarioLoading || !offerComparison?.offers?.length}>
                        {scenarioLoading ? 'Calculating...' : 'Run scenario'}
                      </button>
                      <button type="button" onClick={handleScenarioReset} disabled={scenarioLoading}>
                        Reset
                      </button>
                    </div>
                  </form>
                  {offerComparison?.summary && (
                    <div className="scenario-summary">
                      {offerComparison.summary.top_overall && (
                        <p>
                          <strong>Top offer:</strong> {offerComparison.summary.top_overall.company} (
                          {offerComparison.summary.top_overall.score} pts)
                        </p>
                      )}
                      {offerComparison.summary.notes?.[0] && <p>{offerComparison.summary.notes[0]}</p>}
                    </div>
                  )}
                </div>
                <div className="offer-list">
                  <h4><Icon name="briefcase" size="sm" /> Active Offers</h4>
                  {rawOffers.length === 0 && <p className="matrix-placeholder">No offers captured yet.</p>}
                  {rawOffers.map((offer) => (
                    <div key={`offer-${offer.id}`} className="offer-list-item">
                      <div>
                        <strong>{offer.company_name}</strong>
                        <p>{offer.role_title}</p>
                        <p>{offer.location || 'Remote'}</p>
                        <p>Total comp: {formatCurrency(offer.base_salary + offer.bonus + offer.equity + offer.benefits_total_value)}</p>
                      </div>
                      <div className="offer-list-actions">
                        <select value={archiveReasons[offer.id] || 'declined'} onChange={(e) => handleArchiveReasonChange(offer.id, e.target.value)}>
                          <option value="declined">Declined compensation</option>
                          <option value="role_misalignment">Role misalignment</option>
                          <option value="location_cost">Location / COL</option>
                        </select>
                        <button type="button" onClick={() => handleArchiveOffer(offer.id, archiveReasons[offer.id] || 'declined')}>
                          Archive
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="salary-card full-width">
            <div className="card-header">
              <h3>
                <Icon name="chart" size="md" /> Comparison Matrix
              </h3>
              <p>Side-by-side analysis with cost-of-living adjustments and weighted qualitative scores.</p>
            </div>
            {offersLoading ? (
              <div className="matrix-loading">
                <LoadingSpinner />
              </div>
            ) : (
              renderComparisonMatrix()
            )}
          </div>

          {offerComparison?.offers?.length > 0 && (
            <div className="salary-card full-width">
              <div className="card-header">
                <h3>
                  <Icon name="target" size="md" /> Negotiation recommendations
                </h3>
                <p>Actionable plays tailored to each offer's gaps.</p>
              </div>
              <div className="offer-recommendations-grid">
                {offerComparison.offers.map((offer) => (
                  <div key={`recommendation-${offer.id}`} className="offer-recommendation-card">
                    <div className="recommendation-header">
                      <div>
                        <strong>{offer.company_name}</strong>
                        <p>{offer.role_title}</p>
                      </div>
                      <span className="score-chip">{offer.overall_score} pts</span>
                    </div>
                    <ul>
                      {offer.negotiation_recommendations.map((rec) => (
                        <li key={rec}>
                          <Icon name="arrow-right" size="sm" /> {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {archivedOffers.length > 0 && (
                <div className="archived-offers">
                  <h4>Archived offers</h4>
                  <ul>
                    {archivedOffers.map((offer) => (
                      <li key={`archived-${offer.id}`}>
                        {offer.company_name} · {offer.role_title} — {offer.archived_reason || 'archived'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
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
              <Icon name="alert-circle" size="md" /> No Salary Data Yet
            </h3>
            <p>Get started by capturing an offer and logging negotiation outcomes in the Salary Negotiation tool to see your progression here.</p>
          </div>
        </div>
      )}

      {!loading && offerHistory.length > 0 && (
      <div className="salary-grid">
        <div className="salary-card full-width">
          <div className="card-header">
            <h3>
              <Icon name="chart" size="md" /> Offer History & Negotiation Outcomes
            </h3>
            <p>Track every offer, negotiation wins, and how your total compensation has evolved over time.</p>
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
              <Icon name="briefcase" size="md" /> Market Positioning by Location
            </h3>
            <p>Compare your compensation against regional tech industry benchmarks.</p>
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
              <Icon name="dollar" size="md" /> Total Compensation Evolution
            </h3>
            <p>Visualize how your base salary, bonus, equity, and benefits have grown.</p>
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
              <Icon name="activity" size="md" /> Negotiation Performance
            </h3>
            <p>Track your success rates, winning tactics, and improvement patterns.</p>
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
              <Icon name="layers" size="md" /> Benefits & Perks Trend
            </h3>
            <p>Monitor how your benefits package has improved across different roles.</p>
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
              <Icon name="target" size="md" /> Recommendations for Salary Growth
            </h3>
            <p>Data-driven strategies based on your progression, market position, and negotiation history.</p>
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
