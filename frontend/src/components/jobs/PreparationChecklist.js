import React, { useState, useEffect } from 'react';
import { interviewsAPI } from '../../services/api';
import Icon from '../common/Icon';
import './PreparationChecklist.css';

/**
 * UC-081: Pre-Interview Preparation Checklist Component
 * 
 * Displays a comprehensive, role-specific preparation checklist for interviews.
 * Includes categories like company research, questions, logistics, confidence building, etc.
 */
export default function PreparationChecklist({ interview, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checklistData, setChecklistData] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  useEffect(() => {
    if (interview?.id) {
      loadChecklist();
    }
  }, [interview]);

  const loadChecklist = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await interviewsAPI.getPreparationChecklist(interview.id);
      setChecklistData(data);
      // Expand all categories by default
      setExpandedCategories(new Set(Object.keys(data.categories || {})));
    } catch (err) {
      console.error('Failed to load checklist:', err);
      setError('Failed to load preparation checklist');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTask = async (task) => {
    try {
      const result = await interviewsAPI.toggleChecklistItem(interview.id, {
        task_id: task.task_id,
        category: task.category,
        task: task.task
      });

      // Update local state
      setChecklistData(prev => {
        const newCategories = { ...prev.categories };
        const categoryTasks = newCategories[task.category];
        const taskIndex = categoryTasks.findIndex(t => t.task_id === task.task_id);
        
        if (taskIndex !== -1) {
          categoryTasks[taskIndex] = {
            ...categoryTasks[taskIndex],
            completed: result.completed,
            completed_at: result.completed_at
          };
        }

        // Recalculate progress
        const allTasks = Object.values(newCategories).flat();
        const completedCount = allTasks.filter(t => t.completed).length;
        
        return {
          ...prev,
          categories: newCategories,
          progress: {
            total: allTasks.length,
            completed: completedCount,
            percentage: Math.round((completedCount / allTasks.length) * 100)
          }
        };
      });
    } catch (err) {
      console.error('Failed to toggle task:', err);
      // Show error briefly but don't block the UI
      setError('Failed to update task');
      setTimeout(() => setError(''), 3000);
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const getCategoryIcon = (category) => {
    const iconMap = {
      'Company Research': 'building',
      'Role Preparation': 'briefcase',
      'Questions to Ask': 'help-circle',
      'Attire & Presentation': 'user',
      'Logistics': 'map-pin',
      'Confidence Building': 'trending-up',
      'Materials & Portfolio': 'folder',
      'Post-Interview Follow-up': 'send'
    };
    return iconMap[category] || 'check-circle';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content preparation-checklist">
          <div className="loading-state">
            <Icon name="loader" size={32} />
            <p>Loading preparation checklist...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!checklistData) {
    return null;
  }

  const interviewType = checklistData.interview_type?.replace('_', ' ') || 'interview';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content preparation-checklist" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>
              <Icon name="check-square" size={24} />
              Interview Preparation Checklist
            </h3>
            <p className="checklist-subtitle">
              {checklistData.job_title} at {checklistData.company}
            </p>
            <p className="checklist-interview-info">
              <Icon name="calendar" size={14} />
              {formatDate(checklistData.scheduled_date)} • {interviewType}
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <Icon name="x" size={24} />
          </button>
        </div>

        {error && (
          <div className="error-banner">
            <Icon name="alert-circle" size={16} />
            {error}
          </div>
        )}

        <div className="checklist-progress-section">
          <div className="progress-header">
            <span className="progress-label">Overall Progress</span>
            <span className="progress-stats">
              {checklistData.progress.completed} of {checklistData.progress.total} completed
            </span>
          </div>
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${checklistData.progress.percentage}%` }}
            >
              {checklistData.progress.percentage > 10 && (
                <span className="progress-percentage">{checklistData.progress.percentage}%</span>
              )}
            </div>
          </div>
        </div>

        <div className="modal-body">
          <div className="checklist-categories">
            {Object.entries(checklistData.categories).map(([category, tasks]) => {
              const isExpanded = expandedCategories.has(category);
              const completedInCategory = tasks.filter(t => t.completed).length;
              const totalInCategory = tasks.length;
              
              return (
                <div key={category} className="checklist-category">
                  <div 
                    className="category-header"
                    onClick={() => toggleCategory(category)}
                  >
                    <div className="category-title">
                      <Icon name={getCategoryIcon(category)} size={18} />
                      <span>{category}</span>
                      <span className="category-count">
                        {completedInCategory}/{totalInCategory}
                      </span>
                    </div>
                    <Icon 
                      name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                      size={20} 
                    />
                  </div>

                  {isExpanded && (
                    <div className="category-tasks">
                      {tasks.map((task) => (
                        <div 
                          key={task.task_id} 
                          className={`checklist-item ${task.completed ? 'completed' : ''}`}
                        >
                          <label className="checklist-label">
                            <input
                              type="checkbox"
                              checked={task.completed}
                              onChange={() => handleToggleTask(task)}
                              className="checklist-checkbox"
                            />
                            <span className="checkbox-custom"></span>
                            <span className="task-text">{task.task}</span>
                          </label>
                          {task.completed && task.completed_at && (
                            <span className="task-completed-time">
                              <Icon name="check" size={12} />
                              Completed
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-actions">
          <button 
            className="btn-primary" 
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
