import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { jobsAPI, salaryNegotiationAPI } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import Icon from '../common/Icon';
import './SalaryNegotiation.css';

const defaultOutcomeForm = {
	stage: 'offer',
	status: 'pending',
	company_offer: '',
	counter_amount: '',
	final_result: '',
	base_salary: '',
	bonus: '',
	equity: '',
	total_comp_value: '',
	leverage_used: '',
	confidence_score: '',
	notes: '',
};

const defaultProgression = { attempts: 0, avg_lift_percent: 0, timeline: [] };

const stageOptions = [
	{ value: 'offer', label: 'Initial Offer' },
	{ value: 'counter', label: 'Counter Offer' },
	{ value: 'final', label: 'Final Decision' },
	{ value: 'promotion', label: 'Promotion / Raise' },
];

const statusOptions = [
	{ value: 'pending', label: 'In Progress' },
	{ value: 'won', label: 'Accepted' },
	{ value: 'lost', label: 'Declined' },
];

const formatCurrency = (value) => {
	if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) {
		return 'N/A';
	}
	const num = Number(value);
	return `$${num.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

const formatPercent = (value) => {
	if (value === null || value === undefined || Number.isNaN(Number(value))) {
		return '0%';
	}
	const num = Number(value);
	const prefix = num > 0 ? '+' : '';
	return `${prefix}${num.toFixed(1)}%`;
};

const formatDate = (value) => {
	if (!value) return 'N/A';
	try {
		return new Date(value).toLocaleDateString();
	} catch (err) {
		return value;
	}
};

const toNumberOrNull = (value) => {
	if (value === null || value === undefined || value === '') return null;
	const parsed = Number(value);
	return Number.isNaN(parsed) ? null : parsed;
};

const getErrorMessage = (error, fallback = 'Something went wrong.') => {
	if (!error) return fallback;
	if (typeof error === 'string') return error;
	if (error?.message) return error.message;
	if (error?.error?.message) return error.error.message;
	return fallback;
};

const SalaryNegotiation = ({ jobId: propJobId, embedded = false }) => {
	const params = useParams();
	const navigate = useNavigate();
	const jobId = propJobId || params.jobId;
	const [job, setJob] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [planResponse, setPlanResponse] = useState(null);
	const [refreshing, setRefreshing] = useState(false);
	const [outcomes, setOutcomes] = useState([]);
	const [progression, setProgression] = useState(defaultProgression);
	const [outcomeForm, setOutcomeForm] = useState(defaultOutcomeForm);
	const [savingOutcome, setSavingOutcome] = useState(false);
	const [deletingOutcomeId, setDeletingOutcomeId] = useState(null);
	const sanitizeOutcome = (item) => {
		const toPositive = (val) => {
			const num = Number(val);
			if (!Number.isFinite(num) || num <= 0) return null;
			return num;
		};
		return {
			...item,
			company_offer: toPositive(item.company_offer),
			counter_amount: toPositive(item.counter_amount),
			final_result: toPositive(item.final_result),
			total_comp_value: toPositive(item.total_comp_value),
			base_salary: toPositive(item.base_salary),
			bonus: toPositive(item.bonus),
			equity: toPositive(item.equity),
		};
	};

	useEffect(() => {
		loadData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [jobId]);

	const plan = planResponse?.plan || {};
	const marketContext = plan.market_context || {};

	const loadData = async () => {
		setLoading(true);
		setError('');
		try {
			const [jobData, planData] = await Promise.all([
				jobsAPI.getJob(jobId),
				salaryNegotiationAPI.getPlan(jobId),
			]);
			setJob(jobData);
			hydratePlan(planData);
			if (planData?.outcomes) {
				setOutcomes(planData.outcomes.map(sanitizeOutcome));
			}
		} catch (err) {
			setError(getErrorMessage(err, 'Failed to load negotiation workspace.'));
		} finally {
			setLoading(false);
		}
	};

	const hydratePlan = (payload) => {
		if (!payload) return;
		setPlanResponse(payload);
		setOutcomes((payload.outcomes || []).map(sanitizeOutcome));
		setProgression(payload.progression || defaultProgression);
	};

	const handleRefreshPlan = async (payload = {}) => {
		setRefreshing(true);
		setError('');
		try {
			const data = await salaryNegotiationAPI.refreshPlan(jobId, payload);
			hydratePlan(data);
		} catch (err) {
			setError(getErrorMessage(err, 'Unable to refresh plan.'));
		} finally {
			setRefreshing(false);
		}
	};

	const handleOutcomeChange = (e) => {
		const { name, value } = e.target;
		setOutcomeForm((prev) => ({ ...prev, [name]: value }));
	};

	const refreshOutcomes = async () => {
		try {
			const data = await salaryNegotiationAPI.getOutcomes(jobId);
			setOutcomes((data.results || []).map(sanitizeOutcome));
			setProgression(data.stats || defaultProgression);
		} catch (err) {
			setError(getErrorMessage(err, 'Failed to refresh outcomes.'));
		}
	};

	const handleSubmitOutcome = async (e) => {
		e.preventDefault();
		setSavingOutcome(true);
		setError('');
		try {
			const payload = {
				stage: outcomeForm.stage,
				status: outcomeForm.status,
				company_offer: toNumberOrNull(outcomeForm.company_offer),
				base_salary: toNumberOrNull(outcomeForm.base_salary),
				bonus: toNumberOrNull(outcomeForm.bonus),
				equity: toNumberOrNull(outcomeForm.equity),
				leverage_used: outcomeForm.leverage_used?.trim() || '',
				confidence_score: outcomeForm.confidence_score ? Number(outcomeForm.confidence_score) : null,
				notes: outcomeForm.notes?.trim() || '',
			};
			await salaryNegotiationAPI.createOutcome(jobId, payload);
			setOutcomeForm(defaultOutcomeForm);
			await refreshOutcomes();
		} catch (err) {
			setError(getErrorMessage(err, 'Failed to log outcome.'));
		} finally {
			setSavingOutcome(false);
		}
	};

	const handleDeleteOutcome = async (id) => {
		setDeletingOutcomeId(id);
		setError('');
		try {
			await salaryNegotiationAPI.deleteOutcome(jobId, id);
			await refreshOutcomes();
		} catch (err) {
			setError(getErrorMessage(err, 'Failed to delete outcome.'));
		} finally {
			setDeletingOutcomeId(null);
		}
	};

	const readinessComplete = useMemo(() => {
		const checklist = plan.readiness_checklist || [];
		if (!checklist.length) return 0;
		const done = checklist.filter((item) => item.done).length;
		return Math.round((done / checklist.length) * 100);
	}, [plan.readiness_checklist]);

	if (loading) {
		return <LoadingSpinner />;
	}

	if (!job) {
		return (
			<div className="negotiation-container">
				<div className="negotiation-error">Job not found.</div>
			</div>
		);
	}

	return (
		<div className={`negotiation-container ${embedded ? 'embedded' : ''}`}>
			{!embedded && (
				<div className="negotiation-header">
					<div>
						<h1 className="negotiation-title">
							<Icon name="briefcase" size="lg" /> Salary Negotiation Prep
						</h1>
						<p className="negotiation-subtitle">
							{job.title} · {job.company_name}
						</p>
						{planResponse?.updated_at && (
							<p className="negotiation-updated">
								Last refreshed {formatDate(planResponse.updated_at)}
							</p>
						)}
					</div>
					<div className="negotiation-actions">
						<button className="btn-secondary" onClick={() => navigate('/jobs')}>
							<Icon name="arrow-left" size="sm" /> Back to Jobs
						</button>
						<button className="btn-secondary" onClick={() => handleRefreshPlan({ force_refresh: true })} disabled={refreshing}>
							<Icon name="refresh" size="sm" /> {refreshing ? 'Refreshing…' : 'Refresh Insights'}
						</button>
					</div>
				</div>
			)}

			{embedded && (
				<div className="negotiation-header" style={{ marginBottom: '24px', justifyContent: 'space-between', alignItems: 'center' }}>
					<div>
						<h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
							<Icon name="briefcase" size="md" /> Negotiation Prep
						</h2>
						{planResponse?.updated_at && (
							<p className="negotiation-updated" style={{ margin: '4px 0 0 0' }}>
								Last refreshed {formatDate(planResponse.updated_at)}
							</p>
						)}
					</div>
					<div className="negotiation-actions">
						<button className="btn-secondary" onClick={() => handleRefreshPlan({ force_refresh: true })} disabled={refreshing}>
							<Icon name="refresh" size="sm" /> {refreshing ? 'Refreshing…' : 'Refresh Insights'}
						</button>
					</div>
				</div>
			)}

			{error && (
				<div className="negotiation-error">
					<Icon name="alert-circle" size="sm" /> {error}
				</div>
			)}

			<div className="negotiation-grid">
				<section className="negotiation-card span-2">
					<h2>Progress Snapshot</h2>
					<div className="progress-metrics">
						<div className="metric">
							<div className="metric-label">Attempts Logged</div>
							<div className="metric-value">{progression.attempts}</div>
						</div>
						<div className="metric">
							<div className="metric-label">Avg Lift vs Offer</div>
							<div className="metric-value">{formatPercent(progression.avg_lift_percent)}</div>
						</div>
						<div className="metric">
							<div className="metric-label">Readiness Checklist</div>
							<div className="metric-value">{readinessComplete}%</div>
						</div>
					</div>
					<div className="timeline-list">
						{progression.timeline && progression.timeline.length ? (
							progression.timeline.map((entry) => (
								<div key={entry.id} className="timeline-item">
									<div className="timeline-date">{formatDate(entry.created_at)}</div>
									<div className="timeline-body">
										<div className="timeline-head">
											<div className="timeline-chip">{entry.stage}</div>
											<div className={`status-badge status-${entry.status}`}>
												{entry.status}
											</div>
										</div>
										<div className="timeline-details">
											{entry.company_offer && (
												<span>Offer: {formatCurrency(entry.company_offer)}</span>
											)}
											{entry.final_result && (
												<span>Result: {formatCurrency(entry.final_result)}</span>
											)}
											{entry.lift_percent ? (
												<span>Lift: {formatPercent(entry.lift_percent)}</span>
											) : null}
										</div>
										{entry.notes && <p className="timeline-note">{entry.notes}</p>}
									</div>
								</div>
							))
						) : (
							<p className="small-muted">No negotiation attempts logged yet.</p>
						)}
					</div>
				</section>

				<section className="negotiation-card">
					<h2>Offer Comparison</h2>
					<p className="small-muted">Use the Offer Comparison Lab to capture, compare, and analyze multiple job offers with full compensation details, benefits breakdown, and scenario analysis.</p>
					<div className="card-actions">
						<button className="btn-primary" onClick={() => navigate('/tools/salary-progression')}>
							<Icon name="layers" size="sm" /> Open Offer Comparison Lab
						</button>
					</div>
				</section>

				<section className="negotiation-card">
					<h2>Market Context</h2>
					<div className="market-context">
						<div>
							<div className="context-label">Location</div>
							<div className="context-value">{marketContext.location || job.location || 'Remote'}</div>
						</div>
						<div>
							<div className="context-label">Job Type</div>
							<div className="context-value">{marketContext.job_type || job.job_type}</div>
						</div>
						<div>
							<div className="context-label">Salary Range</div>
							<div className="context-value">{marketContext.salary_range?.display || 'N/A'}</div>
						</div>
						<div>
							<div className="context-label">Target Ask</div>
							<div className="context-value">{marketContext.salary_range?.recommended_target || 'N/A'}</div>
						</div>
						<div>
							<div className="context-label">Market Trend</div>
							<div className="context-value" style={{ textTransform: 'capitalize' }}>
								{marketContext.market_trend || 'stable'}
							</div>
						</div>
						<div>
							<div className="context-label">Data Points</div>
							<div className="context-value">{marketContext.sample_size || 0}</div>
						</div>
					</div>
				</section>

				<section className="negotiation-card">
					<h2>Talking Points</h2>
					<div className="talking-points">
						{(plan.talking_points || []).map((point, idx) => (
							<div key={`${point.title}-${idx}`} className="talking-point">
								<strong>{point.title}</strong>
								<p>{point.detail}</p>
							</div>
						))}
						{!plan.talking_points?.length && <p className="small-muted">Planner has not generated talking points yet.</p>}
					</div>
				</section>

				<section className="negotiation-card span-2">
					<h2>Scenario Scripts</h2>
					<div className="scripts">
						{(plan.scenario_scripts || []).map((script) => (
							<div key={script.scenario} className="script-block">
								<div className="script-heading">
									<span>{script.scenario}</span>
									<small>{script.objective}</small>
								</div>
								<ul>
									{(script.script || []).map((line, idx) => (
										<li key={`${script.scenario}-${idx}`}>{line}</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</section>

				<section className="negotiation-card">
					<h2>Total Compensation</h2>
					<div className="comp-grid">
						{(plan.total_comp_framework?.cash_components || []).map((component) => (
							<div key={component.label} className="comp-item">
								<div className="comp-label">{component.label}</div>
								<div className="comp-value">{component.display || formatCurrency(component.value)}</div>
							</div>
						))}
					</div>
					{plan.total_comp_framework?.benefits_checklist && (
						<ul className="checklist">
							{plan.total_comp_framework.benefits_checklist.map((item) => (
								<li key={item}><Icon name="check" size="sm" /> {item}</li>
							))}
						</ul>
					)}
				</section>

				<section className="negotiation-card">
					<h2>Counter Templates</h2>
					<div className="templates">
						{(plan.counter_offer_templates || []).map((template) => (
							<div key={template.name} className="template-block">
								<strong>{template.name}</strong>
								<p>{template.body}</p>
								{template.checklist && (
									<ul className="checklist inline">
										{template.checklist.map((item) => (
											<li key={item}><Icon name="check" size="sm" /> {item}</li>
										))}
									</ul>
								)}
							</div>
						))}
					</div>
				</section>

				<section className="negotiation-card">
					<h2>Timing Strategy</h2>
					<div className="timing-grid">
						{Object.entries(plan.timing_strategy || {}).map(([phase, steps]) => (
							<div key={phase}>
								<div className="context-label" style={{ textTransform: 'capitalize' }}>{phase.replace('_', ' ')}</div>
								<ul className="checklist">
									{(steps || []).map((step) => (
										<li key={step}>{step}</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</section>

				<section className="negotiation-card">
					<h2>Confidence Exercises</h2>
					<div className="confidence-list">
						{(plan.confidence_exercises || []).map((exercise) => (
							<div key={exercise.name} className="confidence-item">
								<div className="confidence-heading">
									<strong>{exercise.name}</strong>
									<span>{exercise.duration_minutes} min</span>
								</div>
								<p>{exercise.instructions}</p>
							</div>
						))}
					</div>
				</section>

				<section className="negotiation-card">
					<h2>Offer Guidance</h2>
					<div className="offer-guidance">
						<div>
							<div className="context-label">Current Offer</div>
							<div className="context-value">{formatCurrency(plan.offer_guidance?.offer_details?.base_salary)}</div>
						</div>
						<div>
							<div className="context-label">Bonus</div>
							<div className="context-value">{formatCurrency(plan.offer_guidance?.offer_details?.bonus)}</div>
						</div>
						<div>
							<div className="context-label">Equity</div>
							<div className="context-value">{formatCurrency(plan.offer_guidance?.offer_details?.equity)}</div>
						</div>
						<div>
							<div className="context-label">Respond By</div>
							<div className="context-value">{formatDate(plan.offer_guidance?.offer_details?.respond_by)}</div>
						</div>
					</div>
					{plan.offer_guidance?.gaps?.length ? (
						<>
							<div className="offer-gaps" aria-live="polite">
								{plan.offer_guidance.gaps.map((gap) => (
									<div key={gap.component} className="gap-pill">
										<span className="gap-label">{gap.component} gap</span>
										<div className="gap-value">
											<strong>{gap.display}</strong>
											<small>below target</small>
										</div>
									</div>
								))}
							</div>
							<p className="gap-note">Each chip shows how far the current offer sits below the market target for that component.</p>
						</>
					) : (
						<p className="small-muted">No gaps identified yet.</p>
					)}
					<ul className="checklist">
						{(plan.offer_guidance?.decision_filters || []).map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</section>

				<section className="negotiation-card">
					<h2>Readiness Checklist</h2>
					<ul className="checklist">
						{(plan.readiness_checklist || []).map((item) => (
							<li key={item.label} className={item.done ? 'done' : ''}>
								<Icon name={item.done ? 'check-circle' : 'alert-circle'} size="sm" /> {item.label}
							</li>
						))}
						{!plan.readiness_checklist?.length && <li className="small-muted">No checklist items yet.</li>}
					</ul>
				</section>

				<section className="negotiation-card span-2">
					<h2>Outcome Tracking</h2>
					<div className="outcome-layout">
						<div className="outcome-history">
							<h3>Logged Attempts</h3>
							{outcomes.length ? (
								outcomes.map((item) => (
									<div key={item.id} className="outcome-item">
										<div className="outcome-meta">
											<span className="timeline-chip">{item.stage}</span>
											<span className={`status-badge status-${item.status}`}>{item.status}</span>
											<span>{formatDate(item.created_at)}</span>
										</div>
										<div className="outcome-stats">
											{item.company_offer && <span>Offer {formatCurrency(item.company_offer)}</span>}
											{item.base_salary && <span>Base {formatCurrency(item.base_salary)}</span>}
											{item.bonus && <span>Bonus {formatCurrency(item.bonus)}</span>}
											{item.equity && <span>Equity {formatCurrency(item.equity)}</span>}
											{item.counter_amount && <span>Counter {formatCurrency(item.counter_amount)}</span>}
											{item.final_result && <span>Result {formatCurrency(item.final_result)}</span>}
											{item.total_comp_value && <span>Total {formatCurrency(item.total_comp_value)}</span>}
										</div>
										{item.notes && <p>{item.notes}</p>}
										<div className="card-actions" style={{ justifyContent: 'flex-start', gap: 8 }}>
											<button type="button" className="btn-secondary" onClick={() => handleDeleteOutcome(item.id)} disabled={deletingOutcomeId === item.id}>
												{deletingOutcomeId === item.id ? 'Deleting…' : 'Delete'}
											</button>
										</div>
									</div>
								))
							) : (
								<p className="small-muted">No outcomes captured yet. Log your first conversation below.</p>
							)}
						</div>
						<form className="outcome-form" onSubmit={handleSubmitOutcome}>
							<h3>Log New Outcome</h3>
							<div className="form-grid">
								<label>
									Stage
									<select name="stage" value={outcomeForm.stage} onChange={handleOutcomeChange}>
										{stageOptions.map((option) => (
											<option key={option.value} value={option.value}>{option.label}</option>
										))}
									</select>
								</label>
								<label>
									Status
									<select name="status" value={outcomeForm.status} onChange={handleOutcomeChange}>
										{statusOptions.map((option) => (
											<option key={option.value} value={option.value}>{option.label}</option>
										))}
									</select>
								</label>
								<label>
									Company Offer
									<input name="company_offer" type="number" value={outcomeForm.company_offer} onChange={handleOutcomeChange} placeholder="e.g. 120000" />
								</label>
								<label>
									Base Salary
									<input name="base_salary" type="number" value={outcomeForm.base_salary} onChange={handleOutcomeChange} placeholder="e.g. 130000" />
								</label>
								<label>
									Bonus
									<input name="bonus" type="number" value={outcomeForm.bonus} onChange={handleOutcomeChange} placeholder="e.g. 15000" />
								</label>
								<label>
									Equity
									<input name="equity" type="number" value={outcomeForm.equity} onChange={handleOutcomeChange} placeholder="e.g. 20000" />
								</label>
								<label>
									Confidence (1-5)
									<input name="confidence_score" type="number" min="1" max="5" value={outcomeForm.confidence_score} onChange={handleOutcomeChange} />
								</label>
								<label>
									Leverage Used
									<input name="leverage_used" value={outcomeForm.leverage_used} onChange={handleOutcomeChange} placeholder="e.g. competing offer, internal sponsor" />
								</label>
							</div>
							<label className="full-width">
								Notes
								<textarea name="notes" rows={3} value={outcomeForm.notes} onChange={handleOutcomeChange} placeholder="What happened, what was agreed on, next steps" />
							</label>
							<div className="card-actions">
								<button type="submit" className="btn-primary" disabled={savingOutcome}>
									{savingOutcome ? 'Logging…' : 'Log Outcome'}
								</button>
							</div>
						</form>
					</div>
				</section>
			</div>
		</div>
	);
};

export default SalaryNegotiation;
