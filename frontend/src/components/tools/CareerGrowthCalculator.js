// UC-128: Career Growth Calculator Component
import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { careerGrowthAPI } from '../../services/api';
import './CareerGrowthCalculator.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const CareerGrowthCalculator = () => {
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [compareSelection, setCompareSelection] = useState([]);
  const [comparisonData, setComparisonData] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    scenario_name: '',
    job_title: '',
    company_name: '',
    starting_salary: '',
    annual_raise_percent: '3.0',
    annual_bonus_percent: '0',
    equity_value: '0',
    equity_vesting_years: '4',
    scenario_type: 'expected',
    notes: '',
    milestones: []
  });

  // Milestone form state
  const [milestoneForm, setMilestoneForm] = useState({
    year: '',
    title: '',
    salary_increase_percent: '',
    bonus_change: '',
    description: ''
  });

  useEffect(() => {
    fetchScenarios();
  }, []);

  const fetchScenarios = async () => {
    try {
      setLoading(true);
      const response = await careerGrowthAPI.getScenarios();
      setScenarios(response.data.scenarios || []);
      setError('');
    } catch (err) {
      console.error('Error fetching scenarios:', err);
      setError('Failed to load scenarios');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleMilestoneChange = (e) => {
    const { name, value } = e.target;
    setMilestoneForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addMilestone = () => {
    if (!milestoneForm.year || !milestoneForm.title) {
      setError('Year and title are required for milestones');
      return;
    }

    const newMilestone = {
      year: parseInt(milestoneForm.year),
      title: milestoneForm.title,
      salary_increase_percent: parseFloat(milestoneForm.salary_increase_percent || 0),
      bonus_change: parseFloat(milestoneForm.bonus_change || 0),
      description: milestoneForm.description
    };

    setFormData(prev => ({
      ...prev,
      milestones: [...prev.milestones, newMilestone]
    }));

    // Reset milestone form
    setMilestoneForm({
      year: '',
      title: '',
      salary_increase_percent: '',
      bonus_change: '',
      description: ''
    });
    setError('');
  };

  const removeMilestone = (index) => {
    setFormData(prev => ({
      ...prev,
      milestones: prev.milestones.filter((_, i) => i !== index)
    }));
  };

  const handleCreateScenario = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Send raw strings to avoid client-side rounding; backend normalizes to Decimal.
      const payload = {
        ...formData,
        starting_salary: formData.starting_salary?.toString().trim(),
        annual_raise_percent: formData.annual_raise_percent?.toString().trim(),
        annual_bonus_percent: formData.annual_bonus_percent?.toString().trim(),
        equity_value: formData.equity_value?.toString().trim(),
        equity_vesting_years: formData.equity_vesting_years?.toString().trim()
      };

      if (selectedScenario) {
        await careerGrowthAPI.updateScenario(selectedScenario.id, payload);
        setSuccess('Scenario updated successfully!');
      } else {
        await careerGrowthAPI.createScenario(payload);
        setSuccess('Scenario created successfully!');
      }

      await fetchScenarios();
      closeModal();
    } catch (err) {
      console.error('Error saving scenario:', err);
      setError(err.response?.data?.error || 'Failed to save scenario');
    } finally {
      setLoading(false);
    }
  };

  const handleEditScenario = async (scenario) => {
    try {
      setLoading(true);
      const response = await careerGrowthAPI.getScenario(scenario.id);
      const fullScenario = response.data;

      setFormData({
        scenario_name: fullScenario.scenario_name,
        job_title: fullScenario.job_title,
        company_name: fullScenario.company_name || '',
        starting_salary: fullScenario.starting_salary,
        annual_raise_percent: fullScenario.annual_raise_percent,
        annual_bonus_percent: fullScenario.annual_bonus_percent,
        equity_value: fullScenario.equity_value,
        equity_vesting_years: fullScenario.equity_vesting_years.toString(),
        scenario_type: fullScenario.scenario_type,
        notes: fullScenario.notes || '',
        milestones: fullScenario.milestones || []
      });

      setSelectedScenario(fullScenario);
      setShowModal(true);
    } catch (err) {
      console.error('Error loading scenario:', err);
      setError('Failed to load scenario details');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteScenario = async (scenarioId) => {
    if (!window.confirm('Are you sure you want to delete this scenario?')) {
      return;
    }

    try {
      setLoading(true);
      await careerGrowthAPI.deleteScenario(scenarioId);
      setSuccess('Scenario deleted successfully');
      await fetchScenarios();
    } catch (err) {
      console.error('Error deleting scenario:', err);
      setError('Failed to delete scenario');
    } finally {
      setLoading(false);
    }
  };

  const handleViewProjections = async (scenario) => {
    try {
      setLoading(true);
      const response = await careerGrowthAPI.getScenario(scenario.id);
      setSelectedScenario(response.data);
      setShowModal(false); // Not editing, just viewing
    } catch (err) {
      console.error('Error loading projections:', err);
      setError('Failed to load projections');
    } finally {
      setLoading(false);
    }
  };

  const handleCompareScenarios = async () => {
    if (compareSelection.length < 2) {
      setError('Select at least 2 scenarios to compare');
      return;
    }

    try {
      setLoading(true);
      const response = await careerGrowthAPI.compareScenarios(compareSelection);
      setComparisonData(response.data);
      setShowCompareModal(true);
    } catch (err) {
      console.error('Error comparing scenarios:', err);
      setError('Failed to compare scenarios');
    } finally {
      setLoading(false);
    }
  };

  const toggleCompareSelection = (scenarioId) => {
    setCompareSelection(prev => {
      if (prev.includes(scenarioId)) {
        return prev.filter(id => id !== scenarioId);
      } else {
        return [...prev, scenarioId];
      }
    });
  };

  const openNewScenarioModal = () => {
    setFormData({
      scenario_name: '',
      job_title: '',
      company_name: '',
      starting_salary: '',
      annual_raise_percent: '3.0',
      annual_bonus_percent: '0',
      equity_value: '0',
      equity_vesting_years: '4',
      scenario_type: 'expected',
      notes: '',
      milestones: []
    });
    setSelectedScenario(null);
    setShowModal(true);
    setLoading(false);  // Ensure loading is false when opening modal
    setError('');
    setSuccess('');
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedScenario(null);
    setError('');
    setSuccess('');
  };

  const closeCompareModal = () => {
    setShowCompareModal(false);
    setComparisonData(null);
  };

  const formatCurrency = (value) => {
    if (!value) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Chart data for selected scenario
  const getChartData = () => {
    if (!selectedScenario || !selectedScenario.projections_10_year) {
      return null;
    }

    const labels = selectedScenario.projections_10_year.map(p => `Year ${p.year}`);
    const salaryData = selectedScenario.projections_10_year.map(p => parseFloat(p.base_salary));
    const totalCompData = selectedScenario.projections_10_year.map(p => parseFloat(p.total_comp));

    return {
      labels,
      datasets: [
        {
          label: 'Base Salary',
          data: salaryData,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Total Compensation',
          data: totalCompData,
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: '10-Year Compensation Projection'
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            label += formatCurrency(context.parsed.y);
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          callback: function(value) {
            return formatCurrency(value);
          }
        }
      }
    }
  };

  // Comparison chart data
  const getComparisonChartData = () => {
    if (!comparisonData || !comparisonData.projections) {
      return null;
    }

    const colors = [
      'rgb(59, 130, 246)',
      'rgb(16, 185, 129)',
      'rgb(245, 158, 11)',
      'rgb(239, 68, 68)',
      'rgb(139, 92, 246)'
    ];

    const datasets = comparisonData.projections.map((scenario, index) => {
      const projections = scenario.projections_10_year || [];
      return {
        label: scenario.scenario_name,
        data: projections.map(p => parseFloat(p?.total_comp || 0)),
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length].replace('rgb', 'rgba').replace(')', ', 0.1)'),
        tension: 0.4
      };
    });

    const labels = Array.from({ length: 10 }, (_, i) => `Year ${i + 1}`);

    return {
      labels,
      datasets
    };
  };

  return (
    <div className="career-growth-calculator">
      <div className="calculator-header">
        <h1>Career Growth Calculator</h1>
        <p>Model your career trajectory with salary projections, promotions, and compensation scenarios</p>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button onClick={() => setError('')} className="alert-close">&times;</button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
          <button onClick={() => setSuccess('')} className="alert-close">&times;</button>
        </div>
      )}

      <div className="calculator-actions">
        <button onClick={openNewScenarioModal} className="btn btn-primary">
          + New Scenario
        </button>
        {scenarios.length >= 2 && (
          <button
            onClick={handleCompareScenarios}
            className="btn btn-secondary"
            disabled={compareSelection.length < 2}
          >
            Compare Selected ({compareSelection.length})
          </button>
        )}
      </div>

      {loading && <div className="loading-spinner">Loading...</div>}

      {/* Scenarios Grid */}
      <div className="scenarios-grid">
        {scenarios.map(scenario => (
          <div key={scenario.id} className="scenario-card">
            <div className="scenario-header">
              <div className="scenario-title-section">
                <input
                  type="checkbox"
                  checked={compareSelection.includes(scenario.id)}
                  onChange={() => toggleCompareSelection(scenario.id)}
                  className="compare-checkbox"
                />
                <h3>{scenario.scenario_name}</h3>
              </div>
              <span className={`scenario-type-badge ${scenario.scenario_type}`}>
                {scenario.scenario_type}
              </span>
            </div>
            
            <div className="scenario-details">
              <p><strong>Role:</strong> {scenario.job_title}</p>
              {scenario.company_name && (
                <p><strong>Company:</strong> {scenario.company_name}</p>
              )}
              <p><strong>Starting Salary:</strong> {formatCurrency(scenario.starting_salary)}</p>
              <p><strong>Annual Raise:</strong> {scenario.annual_raise_percent}%</p>
            </div>

            <div className="scenario-projections">
              <div className="projection-item">
                <span className="projection-label">Total Comp in Year 5:</span>
                <span className="projection-value">
                  {formatCurrency(scenario.total_comp_year_5)}
                </span>
              </div>
              <div className="projection-item">
                <span className="projection-label">Total Comp in Year 10:</span>
                <span className="projection-value">
                  {formatCurrency(scenario.total_comp_year_10)}
                </span>
              </div>
            </div>

            <div className="scenario-actions">
              <button
                onClick={() => handleViewProjections(scenario)}
                className="btn btn-sm btn-outline"
              >
                View Details
              </button>
              <button
                onClick={() => handleEditScenario(scenario)}
                className="btn btn-sm btn-outline"
              >
                Edit
              </button>
              <button
                onClick={() => handleDeleteScenario(scenario.id)}
                className="btn btn-sm btn-danger"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {scenarios.length === 0 && !loading && (
        <div className="empty-state">
          <p>No scenarios yet. Create your first career growth scenario to get started!</p>
        </div>
      )}

      {/* Scenario Detail View */}
      {selectedScenario && !showModal && (
        <div className="scenario-detail-modal">
          <div className="modal-overlay" onClick={() => setSelectedScenario(null)} />
          <div className="modal-content large">
            <div className="modal-header">
              <h2>{selectedScenario.scenario_name}</h2>
              <button onClick={() => setSelectedScenario(null)} className="modal-close">
                &times;
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h3>Scenario Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>Job Title:</strong>
                    <span>{selectedScenario.job_title}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Company:</strong>
                    <span>{selectedScenario.company_name || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Starting Salary:</strong>
                    <span>{formatCurrency(selectedScenario.starting_salary)}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Annual Raise:</strong>
                    <span>{selectedScenario.annual_raise_percent}%</span>
                  </div>
                  <div className="detail-item">
                    <strong>Annual Bonus:</strong>
                    <span>{selectedScenario.annual_bonus_percent}%</span>
                  </div>
                  <div className="detail-item">
                    <strong>Equity Value:</strong>
                    <span>{formatCurrency(selectedScenario.equity_value)}</span>
                  </div>
                </div>
              </div>

              {selectedScenario.milestones && selectedScenario.milestones.length > 0 && (
                <div className="detail-section">
                  <h3>Career Milestones</h3>
                  <div className="milestones-list">
                    {selectedScenario.milestones.map((milestone, idx) => (
                      <div key={idx} className="milestone-item">
                        <strong>Year {milestone.year}:</strong> {milestone.title}
                        {milestone.salary_increase_percent > 0 && (
                          <span className="milestone-detail">
                            +{milestone.salary_increase_percent}% salary
                          </span>
                        )}
                        {milestone.description && (
                          <p className="milestone-description">{milestone.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="detail-section">
                <h3>10-Year Projection</h3>
                <div className="chart-container">
                  {getChartData() && (
                    <Line data={getChartData()} options={chartOptions} />
                  )}
                </div>
              </div>

              {selectedScenario.notes && (
                <div className="detail-section">
                  <h3>Notes</h3>
                  <p>{selectedScenario.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Scenario Modal */}
      {showModal && (
        <div className="scenario-form-modal">
          <div className="modal-overlay" onClick={closeModal} />
          <div className="modal-content large">
            <div className="modal-header">
              <h2>{selectedScenario ? 'Edit Scenario' : 'Create New Scenario'}</h2>
              <button onClick={closeModal} className="modal-close">&times;</button>
            </div>

            <form onSubmit={handleCreateScenario} className="modal-body">
              <div className="form-section">
                <h3>Basic Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Scenario Name *</label>
                    <input
                      type="text"
                      name="scenario_name"
                      value={formData.scenario_name}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., FAANG Senior Engineer"
                    />
                  </div>

                  <div className="form-group">
                    <label>Job Title *</label>
                    <input
                      type="text"
                      name="job_title"
                      value={formData.job_title}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., Senior Software Engineer"
                    />
                  </div>

                  <div className="form-group">
                    <label>Company Name</label>
                    <input
                      type="text"
                      name="company_name"
                      value={formData.company_name}
                      onChange={handleInputChange}
                      placeholder="e.g., Google"
                    />
                  </div>

                  <div className="form-group">
                    <label>Scenario Type</label>
                    <select
                      name="scenario_type"
                      value={formData.scenario_type}
                      onChange={handleInputChange}
                    >
                      <option value="conservative">Conservative</option>
                      <option value="expected">Expected</option>
                      <option value="optimistic">Optimistic</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Compensation Details</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Starting Salary ($) *</label>
                    <input
                      type="number"
                      name="starting_salary"
                      value={formData.starting_salary}
                      onChange={handleInputChange}
                      required
                      min="0"
                      step="1000"
                      placeholder="150000"
                    />
                  </div>

                  <div className="form-group">
                    <label>Annual Raise (%)</label>
                    <input
                      type="number"
                      name="annual_raise_percent"
                      value={formData.annual_raise_percent}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="3.0"
                    />
                  </div>

                  <div className="form-group">
                    <label>Annual Bonus (%)</label>
                    <input
                      type="number"
                      name="annual_bonus_percent"
                      value={formData.annual_bonus_percent}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="15"
                    />
                  </div>

                  <div className="form-group">
                    <label>Equity Value ($)</label>
                    <input
                      type="number"
                      name="equity_value"
                      value={formData.equity_value}
                      onChange={handleInputChange}
                      min="0"
                      step="1000"
                      placeholder="100000"
                    />
                  </div>

                  <div className="form-group">
                    <label>Equity Vesting (Years)</label>
                    <input
                      type="number"
                      name="equity_vesting_years"
                      value={formData.equity_vesting_years}
                      onChange={handleInputChange}
                      min="1"
                      max="10"
                      placeholder="4"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Career Milestones</h3>
                <p className="form-hint">Add promotions, raises, or other significant career events</p>
                
                <div className="milestone-form">
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Year</label>
                      <input
                        type="number"
                        name="year"
                        value={milestoneForm.year}
                        onChange={handleMilestoneChange}
                        min="1"
                        max="10"
                        placeholder="3"
                      />
                    </div>

                    <div className="form-group">
                      <label>Title/Event</label>
                      <input
                        type="text"
                        name="title"
                        value={milestoneForm.title}
                        onChange={handleMilestoneChange}
                        placeholder="Promotion to Staff Engineer"
                      />
                    </div>

                    <div className="form-group">
                      <label>Salary Increase (%)</label>
                      <input
                        type="number"
                        name="salary_increase_percent"
                        value={milestoneForm.salary_increase_percent}
                        onChange={handleMilestoneChange}
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="20"
                      />
                    </div>

                    <div className="form-group">
                      <label>Bonus Change (%)</label>
                      <input
                        type="number"
                        name="bonus_change"
                        value={milestoneForm.bonus_change}
                        onChange={handleMilestoneChange}
                        min="-100"
                        max="100"
                        step="0.1"
                        placeholder="5"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Description</label>
                    <input
                      type="text"
                      name="description"
                      value={milestoneForm.description}
                      onChange={handleMilestoneChange}
                      placeholder="Expected promotion after 3 years"
                    />
                  </div>

                  <button type="button" onClick={addMilestone} className="btn btn-sm btn-secondary">
                    + Add Milestone
                  </button>
                </div>

                {formData.milestones.length > 0 && (
                  <div className="milestones-preview">
                    <h4>Added Milestones:</h4>
                    {formData.milestones.map((milestone, idx) => (
                      <div key={idx} className="milestone-preview-item">
                        <span>
                          <strong>Year {milestone.year}:</strong> {milestone.title}
                          {milestone.salary_increase_percent > 0 && ` (+${milestone.salary_increase_percent}%)`}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeMilestone(idx)}
                          className="btn-remove"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-section">
                <h3>Notes</h3>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="4"
                  placeholder="Add any additional notes about this scenario..."
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={closeModal} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : (selectedScenario ? 'Update Scenario' : 'Create Scenario')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Comparison Modal */}
      {showCompareModal && comparisonData && (
        <div className="comparison-modal">
          <div className="modal-overlay" onClick={closeCompareModal} />
          <div className="modal-content large">
            <div className="modal-header">
              <h2>Scenario Comparison</h2>
              <button onClick={closeCompareModal} className="modal-close">&times;</button>
            </div>

            <div className="modal-body">
              <div className="comparison-chart-container">
                {getComparisonChartData() && (
                  <Line
                    data={getComparisonChartData()}
                    options={{
                      ...chartOptions,
                      plugins: {
                        ...chartOptions.plugins,
                        title: {
                          display: true,
                          text: 'Scenario Comparison - 10 Year Total Compensation'
                        }
                      }
                    }}
                  />
                )}
              </div>

              <div className="comparison-summary">
                <h3>Summary</h3>
                <div className="comparison-grid">
                  {comparisonData.scenarios.map((scenario, idx) => (
                    <div key={idx} className="comparison-card">
                      <h4>{scenario.name}</h4>
                      <div className="comparison-stats">
                        <div className="stat">
                          <span className="stat-label">5-Year Total:</span>
                          <span className="stat-value">{formatCurrency(scenario.total_comp_5_year)}</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">10-Year Total:</span>
                          <span className="stat-value">{formatCurrency(scenario.total_comp_10_year)}</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">Growth Rate:</span>
                          <span className="stat-value">{scenario['10_year_growth_rate']}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {comparisonData.recommendations && comparisonData.recommendations.length > 0 && (
                <div className="recommendations">
                  <h3>Insights</h3>
                  <ul>
                    {comparisonData.recommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CareerGrowthCalculator;
