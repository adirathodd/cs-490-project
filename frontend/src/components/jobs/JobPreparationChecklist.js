import React from 'react';

const JobPreparationChecklist = ({ checklist, onToggleChecklistItem, savingChecklistId }) => {
  if (!checklist || checklist.length === 0) {
    return null;
  }

  return (
    <div className="preparation-checklist-container">
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {checklist.map((category, catIndex) => (
            <div key={catIndex}>
              <h5 style={{ 
                fontSize: '15px', 
                fontWeight: '600', 
                color: '#374151', 
                marginBottom: '12px',
                textTransform: 'capitalize'
              }}>
                {category.category.replace('_', ' ')}
              </h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {category.items.map((item) => (
                  <div 
                    key={item.task_id}
                    onClick={(e) => {
                      if (e.target.type === 'checkbox') return;
                      if (savingChecklistId === item.task_id) return;
                      onToggleChecklistItem && onToggleChecklistItem({
                        taskId: item.task_id,
                        category: category.category,
                        task: item.task,
                        completed: !item.completed
                      });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: item.completed ? '#f0fdf4' : '#ffffff',
                      border: `1px solid ${item.completed ? '#bbf7d0' : '#e5e7eb'}`,
                      borderRadius: '8px',
                      transition: 'all 0.2s ease',
                      cursor: savingChecklistId === item.task_id ? 'wait' : 'pointer'
                    }}
                  >
                    <div style={{ paddingTop: '2px' }}>
                      <input
                        type="checkbox"
                        checked={item.completed}
                        disabled={savingChecklistId === item.task_id}
                        onChange={(e) => onToggleChecklistItem && onToggleChecklistItem({
                          taskId: item.task_id,
                          category: category.category,
                          task: item.task,
                          completed: e.target.checked
                        })}
                        style={{
                          width: '16px',
                          height: '16px',
                          cursor: savingChecklistId === item.task_id ? 'wait' : 'pointer',
                          accentColor: '#10b981'
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ 
                        fontSize: '14px', 
                        color: item.completed ? '#15803d' : '#374151',
                        textDecoration: item.completed ? 'line-through' : 'none'
                      }}>
                        {item.task}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default JobPreparationChecklist;
