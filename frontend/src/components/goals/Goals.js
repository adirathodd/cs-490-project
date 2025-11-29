import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { goalsAPI } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import Icon from '../common/Icon';
import './Goals.css';

const defaultGoalForm = {
	title: '',
	description: '',
	goal_type: 'short_term',
	target_metric: '',
	current_value: 0,
	target_value: 100,
	target_date: '',
	motivation_notes: '',
	action_steps: [],
	status: 'not_started',
};

const defaultMilestoneForm = {
	title: '',
	description: '',
	target_date: '',
	order: 0,
};

const createDefaultMilestoneForm = () => ({ ...defaultMilestoneForm });

const statusOptions = [
	{ value: 'not_started', label: 'Not Started', color: '#94a3b8' },
	{ value: 'in_progress', label: 'In Progress', color: '#3b82f6' },
	{ value: 'completed', label: 'Completed', color: '#10b981' },
	{ value: 'paused', label: 'Paused', color: '#f59e0b' },
	{ value: 'abandoned', label: 'Abandoned', color: '#ef4444' },
];

const goalTypeOptions = [
	{ value: 'short_term', label: 'Short-term (< 6 months)' },
	{ value: 'long_term', label: 'Long-term (6+ months)' },
];

const formatDate = (value) => {
	if (!value) return 'N/A';
	try {
		return new Date(value).toLocaleDateString();
	} catch {
		return value;
	}
};

const getStatusColor = (status) => {
	return statusOptions.find((s) => s.value === status)?.color || '#94a3b8';
};

const Goals = () => {
	const navigate = useNavigate();
	const [goals, setGoals] = useState([]);
	const [analytics, setAnalytics] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [editingGoal, setEditingGoal] = useState(null);
	const [goalForm, setGoalForm] = useState(defaultGoalForm);
	const [showMilestones, setShowMilestones] = useState(null);
	const [milestonesByGoal, setMilestonesByGoal] = useState({});
	const [milestoneForms, setMilestoneForms] = useState({});
	const [filterStatus, setFilterStatus] = useState('');
	const [filterType, setFilterType] = useState('');
	const [saving, setSaving] = useState(false);
	const [deleteConfirm, setDeleteConfirm] = useState(null);
	const [progressInputs, setProgressInputs] = useState({});

	useEffect(() => {
		loadData();
	}, [filterStatus, filterType]);

	const loadData = async () => {
		setLoading(true);
		setError('');
		try {
			const filters = {};
			if (filterStatus) filters.status = filterStatus;
			if (filterType) filters.goal_type = filterType;

			const [goalsData, analyticsData] = await Promise.all([
				goalsAPI.getGoals(filters),
				goalsAPI.getAnalytics(),
			]);
			setGoals(goalsData);
			setAnalytics(analyticsData);
		} catch (err) {
			setError(err?.message || 'Failed to load goals');
		} finally {
			setLoading(false);
		}
	};

	const handleCreateGoal = () => {
		setGoalForm(defaultGoalForm);
		setEditingGoal(null);
		setShowCreateModal(true);
	};

	const handleEditGoal = (goal) => {
		setGoalForm({
			title: goal.title,
			description: goal.description,
			goal_type: goal.goal_type,
			target_metric: goal.target_metric,
			current_value: goal.current_value || 0,
			target_value: goal.target_value,
			target_date: goal.target_date,
			motivation_notes: goal.motivation_notes || '',
			action_steps: goal.action_steps || [],
			status: goal.status,
		});
		setEditingGoal(goal);
		setShowCreateModal(true);
	};

	const handleFormChange = (e) => {
		const { name, value } = e.target;
		setGoalForm((prev) => ({ ...prev, [name]: value }));
	};

	const handleSubmitGoal = async (e) => {
		e.preventDefault();
		setSaving(true);
		setError('');
		try {
			if (editingGoal) {
				await goalsAPI.updateGoal(editingGoal.id, goalForm);
			} else {
				await goalsAPI.createGoal(goalForm);
			}
			setShowCreateModal(false);
			await loadData();
		} catch (err) {
			setError(err?.message || 'Failed to save goal');
		} finally {
			setSaving(false);
		}
	};

	const handleDeleteGoal = async (goalId) => {
		setDeleteConfirm(goalId);
	};

	const confirmDelete = async () => {
		if (!deleteConfirm) return;
		try {
			await goalsAPI.deleteGoal(deleteConfirm);
			setDeleteConfirm(null);
			await loadData();
		} catch (err) {
			setError(err?.message || 'Failed to delete goal');
			setDeleteConfirm(null);
		}
	};

	const handleCompleteGoal = async (goalId) => {
		try {
			await goalsAPI.completeGoal(goalId);
			await loadData();
		} catch (err) {
			setError(err?.message || 'Failed to complete goal');
		}
	};

	const handleProgressInputChange = (goalId, value) => {
		setProgressInputs((prev) => ({ ...prev, [goalId]: value }));
	};

	const handleUpdateProgress = async (goalId) => {
		const valueToUse = progressInputs[goalId];
		
		if (valueToUse === undefined || valueToUse === '' || valueToUse === null) {
			return;
		}
		
		const numValue = parseFloat(valueToUse);
		if (isNaN(numValue)) {
			setError('Please enter a valid number');
			return;
		}
		try {
			const updatedGoal = await goalsAPI.updateProgress(goalId, numValue);
			
			// Update local state immediately to reflect changes
			setGoals((prevGoals) => 
				prevGoals.map((g) => (g.id === goalId ? updatedGoal : g))
			);

			setProgressInputs((prev) => ({ ...prev, [goalId]: '' }));
			await loadData();
		} catch (err) {
			setError(err?.message || 'Failed to update progress');
		}
	};

	const handleShowMilestones = async (goal) => {
		if (showMilestones === goal.id) {
			setShowMilestones(null);
		} else {
			try {
				const data = await goalsAPI.getMilestones(goal.id);
				setMilestonesByGoal((prev) => ({ ...prev, [goal.id]: data }));
				setMilestoneForms((prev) => ({
					...prev,
					[goal.id]: prev[goal.id] || createDefaultMilestoneForm(),
				}));
				setShowMilestones(goal.id);
			} catch (err) {
				setError(err?.message || 'Failed to load milestones');
			}
		}
	};

	const handleAddMilestone = async (goalId) => {
		const form = milestoneForms[goalId] || createDefaultMilestoneForm();
		const trimmedTitle = form.title.trim();
		if (!trimmedTitle) {
			setError('Milestone title is required');
			return;
		}
		try {
			const payload = {
				...form,
				title: trimmedTitle,
				target_date: form.target_date ? form.target_date : null,
				description: form.description?.trim() || '',
			};
			await goalsAPI.createMilestone(goalId, payload);
			setMilestoneForms((prev) => ({ ...prev, [goalId]: createDefaultMilestoneForm() }));
			const data = await goalsAPI.getMilestones(goalId);
			setMilestonesByGoal((prev) => ({ ...prev, [goalId]: data }));
			await loadData();
		} catch (err) {
			setError(err?.message || 'Failed to create milestone');
		}
	};

	const handleMilestoneInputChange = (goalId, field, value) => {
		setMilestoneForms((prev) => ({
			...prev,
			[goalId]: {
				...(prev[goalId] ? prev[goalId] : createDefaultMilestoneForm()),
				[field]: value,
			},
		}));
	};

	const handleCompleteMilestone = async (goalId, milestoneId) => {
		try {
			await goalsAPI.completeMilestone(goalId, milestoneId);
			const data = await goalsAPI.getMilestones(goalId);
			setMilestonesByGoal((prev) => ({ ...prev, [goalId]: data }));
			await loadData(); // Refresh goal progress
		} catch (err) {
			setError(err?.message || 'Failed to complete milestone');
		}
	};

	const handleDeleteMilestone = async (goalId, milestoneId) => {
		try {
			await goalsAPI.deleteMilestone(goalId, milestoneId);
			const data = await goalsAPI.getMilestones(goalId);
			setMilestonesByGoal((prev) => ({ ...prev, [goalId]: data }));
		} catch (err) {
			setError(err?.message || 'Failed to delete milestone');
		}
	};

	const filteredGoals = useMemo(() => {
		return goals.sort((a, b) => {
			// Sort by status priority, then by target date
			const statusPriority = { in_progress: 0, not_started: 1, paused: 2, completed: 3, abandoned: 4 };
			const aPriority = statusPriority[a.status] ?? 5;
			const bPriority = statusPriority[b.status] ?? 5;
			if (aPriority !== bPriority) return aPriority - bPriority;
			return new Date(a.target_date) - new Date(b.target_date);
		});
	}, [goals]);

	if (loading) {
		return <LoadingSpinner />;
	}

	return (
		<div className="goals-container">
			<div className="goals-header">
				<div>
					<h1 className="goals-title">
						<Icon name="target" size="lg" /> Career Goals
					</h1>
					<p className="goals-subtitle">Track your career objectives and measure progress</p>
				</div>
				<div className="goals-actions">
					<button className="btn-primary" onClick={handleCreateGoal}>
						<Icon name="plus" size="sm" /> Create Goal
					</button>
				</div>
			</div>

			{error && (
				<div className="goals-error">
					<Icon name="alert-circle" size="sm" /> {error}
				</div>
			)}

			{analytics && (
				<section className="goals-analytics">
					<h2>Overview</h2>
					<div className="analytics-metrics">
						<div className="metric">
							<div className="metric-label">Total Goals</div>
							<div className="metric-value">{analytics.overview.total_goals}</div>
						</div>
						<div className="metric">
							<div className="metric-label">Active</div>
							<div className="metric-value">{analytics.overview.active_goals}</div>
						</div>
						<div className="metric">
							<div className="metric-label">Completed</div>
							<div className="metric-value">{analytics.overview.completed_goals}</div>
						</div>
						<div className="metric">
							<div className="metric-label">Completion Rate</div>
							<div className="metric-value">{analytics.overview.completion_rate}%</div>
						</div>
						<div className="metric">
							<div className="metric-label">Avg Progress</div>
							<div className="metric-value">{analytics.overview.average_progress}%</div>
						</div>
						{analytics.overview.overdue_goals > 0 && (
							<div className="metric metric-warning">
								<div className="metric-label">Overdue</div>
								<div className="metric-value">{analytics.overview.overdue_goals}</div>
							</div>
						)}
					</div>
					{analytics.recommendations && analytics.recommendations.length > 0 && (
						<div className="recommendations">
							<h3>Recommendations</h3>
							{analytics.recommendations.map((rec, idx) => (
								<div key={idx} className={`recommendation priority-${rec.priority}`}>
									<Icon name="lightbulb" size="sm" />
									<span>{rec.message}</span>
								</div>
							))}
						</div>
					)}
				</section>
			)}

			<section className="goals-filters">
				<label>
					Status:
					<select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
						<option value="">All</option>
						{statusOptions.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
				</label>
				<label>
					Type:
					<select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
						<option value="">All</option>
						{goalTypeOptions.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
				</label>
			</section>

			<section className="goals-list">
				{filteredGoals.length === 0 ? (
					<div className="empty-state">
						<Icon name="target" size="lg" />
						<p>No goals yet. Create your first goal to get started!</p>
						<button className="btn-primary" onClick={handleCreateGoal}>
							<Icon name="plus" size="sm" /> Create Goal
						</button>
					</div>
				) : (
					filteredGoals.map((goal) => {
						const goalMilestones = milestonesByGoal[goal.id] || [];
						const milestoneForm = milestoneForms[goal.id] || defaultMilestoneForm;

						return (
							<div key={goal.id} className="goal-card">
								<div className="goal-header">
									<div className="goal-title-section">
										<h3>{goal.title}</h3>
										<span
											className="goal-status-badge"
											style={{ backgroundColor: getStatusColor(goal.status) }}
										>
											{statusOptions.find((s) => s.value === goal.status)?.label}
										</span>
										<span className="goal-type-badge">
											{goalTypeOptions.find((t) => t.value === goal.goal_type)?.label}
										</span>
									</div>
									<div className="goal-actions">
										<button className="btn-icon" onClick={() => handleEditGoal(goal)} title="Edit">
											<Icon name="edit" size="sm" />
										</button>
										<button
											className="btn-icon"
											onClick={() => handleDeleteGoal(goal.id)}
											title="Delete"
										>
											<Icon name="trash" size="sm" />
										</button>
									</div>
								</div>

								<p className="goal-description">{goal.description}</p>

								<div className="goal-metrics">
									<div className="goal-metric">
										<span className="goal-metric-label">Target:</span>
										<span>{goal.target_metric || 'N/A'}</span>
									</div>
									<div className="goal-metric">
										<span className="goal-metric-label">Deadline:</span>
										<span>{formatDate(goal.target_date)}</span>
									</div>
									<div className="goal-metric">
										<span className="goal-metric-label">Days Left:</span>
										<span className={goal.is_overdue ? 'overdue' : ''}>
											{goal.is_overdue ? 'Overdue' : `${goal.days_remaining} days`}
										</span>
									</div>
								</div>

								<div className="progress-section">
									<div className="progress-header">
										<span>Progress: {goal.progress_percentage}%</span>
										{goal.status !== 'completed' && (
											<button
												className="btn-secondary btn-sm"
												onClick={() => handleCompleteGoal(goal.id)}
											>
												<Icon name="check" size="sm" /> Mark Complete
											</button>
										)}
									</div>
									<div className="progress-bar">
										<div
											className="progress-fill"
											style={{
												width: `${goal.progress_percentage}%`,
												backgroundColor: getStatusColor(goal.status),
											}}
										/>
									</div>
									{(goal.status === 'in_progress' || goal.status === 'completed') && (
										<div className="progress-controls">
											<input
												type="number"
												value={progressInputs[goal.id] ?? ''}
												placeholder="Enter current value"
												onChange={(e) => handleProgressInputChange(goal.id, e.target.value)}
												onKeyDown={(e) => {
													if (e.key === 'Enter') {
														handleUpdateProgress(goal.id);
													}
												}}
											/>
											<button
												type="button"
												className="btn-primary btn-sm"
												onClick={() => handleUpdateProgress(goal.id)}
												disabled={(progressInputs[goal.id] ?? '') === ''}
											>
												Update
											</button>
											<span className="progress-hint">
												Current {goal.current_value ?? 0} of {goal.target_value ?? 0} target
											</span>
										</div>
									)}
								</div>

								<div className="milestone-section">
									<button
										className="btn-secondary btn-sm"
										onClick={() => handleShowMilestones(goal)}
									>
										<Icon name="list" size="sm" />
										{showMilestones === goal.id ? 'Hide' : 'Show'} Milestones
										{goal.milestone_count > 0 && ` (${goal.milestone_count})`}
									</button>

									{showMilestones === goal.id && (
										<div className="milestones-list">
											{goalMilestones.length === 0 ? (
												<p className="small-muted">No milestones yet</p>
											) : (
												goalMilestones.map((milestone) => (
													<div
														key={milestone.id}
														className={`milestone-item ${milestone.completed ? 'completed' : ''}`}
													>
														<div className="milestone-content">
															<input
																type="checkbox"
																checked={milestone.completed}
																onChange={() =>
																	handleCompleteMilestone(goal.id, milestone.id)
																}
															/>
															<div className="milestone-details">
																<strong>{milestone.title}</strong>
																{milestone.description && (
																	<p>{milestone.description}</p>
																)}
																{milestone.target_date && (
																	<span className="milestone-date">
																		Due: {formatDate(milestone.target_date)}
																	</span>
																)}
															</div>
														</div>
														<button
															className="btn-icon"
															onClick={() => handleDeleteMilestone(goal.id, milestone.id)}
														>
															<Icon name="trash" size="sm" />
														</button>
													</div>
												))
											)}

											<div className="add-milestone-form">
												<div className="add-milestone-field">
													<label className="milestone-field-label">
														New milestone title <span className="required-indicator">*</span>
													</label>
													<input
														type="text"
														placeholder="New milestone title"
														value={milestoneForm.title}
														onChange={(e) =>
															handleMilestoneInputChange(goal.id, 'title', e.target.value)
														}
													/>
												</div>
												<div className="add-milestone-field">
													<label className="milestone-field-label">
														Target date <span className="optional-hint">(optional)</span>
													</label>
													<input
														type="date"
														value={milestoneForm.target_date}
														onChange={(e) =>
															handleMilestoneInputChange(goal.id, 'target_date', e.target.value)
														}
													/>
												</div>
												<button
													type="button"
													className="btn-primary btn-sm"
													onClick={() => handleAddMilestone(goal.id)}
												>
													<Icon name="plus" size="sm" /> Add
												</button>
											</div>
										</div>
									)}
								</div>
							</div>
						);
					})
				)}
			</section>

			{showCreateModal && (
				<div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
					<div className="modal-content" onClick={(e) => e.stopPropagation()}>
						<div className="modal-header">
							<h2>{editingGoal ? 'Edit Goal' : 'Create New Goal'}</h2>
							<button className="btn-icon" onClick={() => setShowCreateModal(false)}>
								<Icon name="x" size="sm" />
							</button>
						</div>
						<form onSubmit={handleSubmitGoal}>
							<label>
								Title*
								<input
									type="text"
									name="title"
									value={goalForm.title}
									onChange={handleFormChange}
									required
								/>
							</label>
							<label>
								Description*
								<textarea
									name="description"
									value={goalForm.description}
									onChange={handleFormChange}
									rows={4}
									required
								/>
							</label>
							<div className="form-row">
								<label>
									Type
									<select name="goal_type" value={goalForm.goal_type} onChange={handleFormChange}>
										{goalTypeOptions.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{opt.label}
											</option>
										))}
									</select>
								</label>
								<label>
									Status
									<select name="status" value={goalForm.status} onChange={handleFormChange}>
										{statusOptions.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{opt.label}
											</option>
										))}
									</select>
								</label>
							</div>
							<div className="form-row">
								<label>
									Target Metric
									<input
										type="text"
										name="target_metric"
										value={goalForm.target_metric}
										onChange={handleFormChange}
										placeholder="e.g., 5 interviews, $120K salary"
									/>
								</label>
								<label>
									Target Value
									<input
										type="number"
										name="target_value"
										value={goalForm.target_value}
										onChange={handleFormChange}
									/>
								</label>
							</div>
							<label>
								Target Date*
								<input
									type="date"
									name="target_date"
									value={goalForm.target_date}
									onChange={handleFormChange}
									required
								/>
							</label>
							<label>
								Motivation Notes
								<textarea
									name="motivation_notes"
									value={goalForm.motivation_notes}
									onChange={handleFormChange}
									rows={3}
									placeholder="Why does this goal matter to you?"
								/>
							</label>
							<div className="modal-actions">
								<button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
									Cancel
								</button>
								<button type="submit" className="btn-primary" disabled={saving}>
									{saving ? 'Saving...' : editingGoal ? 'Update Goal' : 'Create Goal'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{deleteConfirm && (
				<div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
					<div className="modal-content delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
						<div className="modal-header">
							<h2>Delete Goal</h2>
							<button className="btn-icon" onClick={() => setDeleteConfirm(null)}>
								<Icon name="x" size="sm" />
							</button>
						</div>
						<p className="delete-confirm-text">
							Are you sure you want to delete this goal? This action cannot be undone, and all
							associated milestones will also be deleted.
						</p>
						<div className="modal-actions">
							<button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>
								Cancel
							</button>
							<button className="btn-danger" onClick={confirmDelete}>
								<Icon name="trash" size="sm" /> Delete Goal
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default Goals;
