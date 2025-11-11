import React, { useState } from 'react';
import { automationAPI } from '../../services/automationAPI';
import Icon from '../common/Icon';
import './AutomationRulesList.css';

const AutomationRulesList = ({ rules, onEdit, onDelete, onRefresh }) => {
  const [selectedRule, setSelectedRule] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleToggleActive = async (rule) => {
    setLoading(true);
    try {
      await automationAPI.updateAutomationRule(rule.id, {
        ...rule,
        is_active: !rule.is_active
      });
      onRefresh();
    } catch (error) {
      console.error('Failed to toggle rule status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (rule) => {
    setSelectedRule(rule);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedRule) {
      setLoading(true);
      try {
        await onDelete(selectedRule.id);
        setShowDeleteConfirm(false);
        setSelectedRule(null);
      } catch (error) {
        console.error('Failed to delete rule:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const getTriggerTypeLabel = (triggerType) => {
    const labels = {
      'job_status_change': 'Job Status Change',
      'application_deadline': 'Application Deadline',
      'follow_up_due': 'Follow-up Due',
      'job_match_found': 'Job Match Found',
      // Keep old ones for backwards compatibility
      'new_job': 'New Job Added',
      'match_score': 'High Match Score',
      'deadline_approaching': 'Deadline Approaching',
      'manual': 'Manual Trigger'
    };
    return labels[triggerType] || triggerType;
  };

  const getActionTypeLabel = (actionType) => {
    const labels = {
      'generate_application_package': 'Generate Application Package',
      'schedule_follow_up': 'Schedule Follow-up',
      'send_template_response': 'Send Template Response',
      'create_checklist': 'Create Checklist',
      // Keep old ones for backwards compatibility
      'generate_package': 'Generate Package',
      'schedule_application': 'Schedule Application',
      'send_followup': 'Send Follow-up',
      'create_reminder': 'Create Reminder',
      'update_status': 'Update Status'
    };
    return labels[actionType] || actionType;
  };

  const formatConditions = (conditions) => {
    if (!conditions) return 'None';
    
    const parts = [];
    if (conditions.min_match_score) {
      parts.push(`Match ≥ ${conditions.min_match_score}%`);
    }
    if (conditions.job_types && conditions.job_types.length > 0) {
      parts.push(`Types: ${conditions.job_types.join(', ')}`);
    }
    if (conditions.industries && conditions.industries.length > 0) {
      parts.push(`Industries: ${conditions.industries.join(', ')}`);
    }
    
    return parts.length > 0 ? parts.join(', ') : 'None';
  };

  const getPriorityColor = (priority) => {
    if (priority <= 3) return 'high';
    if (priority <= 6) return 'medium';
    return 'low';
  };

  if (rules.length === 0) {
    return (
      <div className="card">
        <div className="card-content empty-state">
          <Icon name="auto_mode" />
          <h3>No Automation Rules</h3>
          <p>Create your first automation rule to start automating your job application workflow.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rules-list">
        {rules.map((rule) => (
          <div key={rule.id} className={`rule-card ${rule.is_active ? 'active' : 'inactive'}`}>
            <div className="rule-header">
              <div className="rule-title-section">
                <h4>{rule.name}</h4>
                {rule.description && <p>{rule.description}</p>}
              </div>
              <div className="rule-status">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={rule.is_active}
                    onChange={() => handleToggleActive(rule)}
                    disabled={loading}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span className="status-text">
                  {rule.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="rule-details">
              <div className="rule-detail-item">
                <label>Trigger:</label>
                <span className="badge trigger">{getTriggerTypeLabel(rule.trigger_type)}</span>
              </div>
              
              <div className="rule-detail-item">
                <label>Action:</label>
                <span className="badge action">{getActionTypeLabel(rule.action_type)}</span>
              </div>
              
              <div className="rule-detail-item">
                <label>Priority:</label>
                <span className={`badge priority ${getPriorityColor(rule.priority)}`}>
                  {rule.priority}
                </span>
              </div>
              
              <div className="rule-detail-item">
                <label>Executions:</label>
                <span>{rule.execution_count || 0}</span>
              </div>
            </div>

            <div className="rule-conditions">
              <label>Conditions:</label>
              <p>{formatConditions(rule.trigger_conditions)}</p>
            </div>

            <div className="rule-actions">
              <button className="btn-icon" onClick={() => onEdit(rule)} title="Edit Rule">
                <Icon name="edit" />
              </button>
              <button className="btn-icon delete" onClick={() => handleDeleteClick(rule)} title="Delete Rule">
                <Icon name="delete" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Automation Rule</h2>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(false)}>×</button>
            </div>
            <div className="modal-content">
              <p>
                Are you sure you want to delete the automation rule "{selectedRule?.name}"? 
                This action cannot be undone and will stop all automated activities for this rule.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                onClick={handleDeleteConfirm}
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AutomationRulesList;