import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { skillsAPI } from '../services/api';
import './SkillsOrganized.css';

// Droppable category container component
const DroppableCategory = ({ category, children, isOver }) => {
  const { setNodeRef } = useDroppable({
    id: `category-${category}`,
    data: { category }
  });

  return (
    <div ref={setNodeRef} className={`skills-drop-zone ${isOver ? 'dragging-over' : ''}`}>
      {children}
    </div>
  );
};

// Sortable skill card component
const SortableSkillCard = ({ skill, getProficiencyColor }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: skill.id,
    data: { skill }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`skill-card ${isDragging ? 'dragging' : ''}`}
      {...attributes}
    >
      <div className="skill-drag-handle" {...listeners}>⋮⋮</div>
      <div className="skill-info">
        <div className="skill-name">{skill.skill_name}</div>
        <div className="skill-details">
          <span 
            className="proficiency-badge"
            style={{ backgroundColor: getProficiencyColor(skill.level) }}
          >
            {skill.level.charAt(0).toUpperCase() + skill.level.slice(1)}
          </span>
          {skill.years > 0 && (
            <span className="years-badge">
              {skill.years} {skill.years === 1 ? 'year' : 'years'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// Skill card for overlay
const SkillCard = ({ skill, getProficiencyColor }) => {
  return (
    <div className="skill-card dragging">
      <div className="skill-drag-handle">⋮⋮</div>
      <div className="skill-info">
        <div className="skill-name">{skill.skill_name}</div>
        <div className="skill-details">
          <span 
            className="proficiency-badge"
            style={{ backgroundColor: getProficiencyColor(skill.level) }}
          >
            {skill.level.charAt(0).toUpperCase() + skill.level.slice(1)}
          </span>
          {skill.years > 0 && (
            <span className="years-badge">
              {skill.years} {skill.years === 1 ? 'year' : 'years'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const SkillsOrganized = () => {
  const navigate = useNavigate();
  const [skillsByCategory, setSkillsByCategory] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeId, setActiveId] = useState(null);
  const [activeSkill, setActiveSkill] = useState(null);
  const [overId, setOverId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  useEffect(() => {
    fetchSkillsByCategory();
  }, []);

  const fetchSkillsByCategory = async () => {
    try {
      setLoading(true);
      const data = await skillsAPI.getSkillsByCategory();
      setSkillsByCategory(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event) => {
    const { active } = event;
    setActiveId(active.id);
    
    // Find the active skill
    Object.values(skillsByCategory).forEach(categoryData => {
      const skill = categoryData.skills.find(s => s.id === active.id);
      if (skill) {
        setActiveSkill(skill);
      }
    });
  };

  const handleDragOver = (event) => {
    const { over } = event;
    setOverId(over?.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveSkill(null);
    setOverId(null);

    if (!over || active.id === over.id) {
      return;
    }

    // Find which category the active skill belongs to
    let sourceCategory = null;
    let sourceIndex = -1;

    Object.keys(skillsByCategory).forEach(category => {
      const skills = skillsByCategory[category].skills;
      const activeIdx = skills.findIndex(s => s.id === active.id);
      
      if (activeIdx !== -1) {
        sourceCategory = category;
        sourceIndex = activeIdx;
      }
    });

    if (!sourceCategory) return;

    // Determine destination category and index
    let destCategory = null;
    let destIndex = -1;

    // Check if dropped on a category container
    if (over.id.toString().startsWith('category-')) {
      destCategory = over.id.toString().replace('category-', '');
      destIndex = skillsByCategory[destCategory].skills.length; // Add to end
    } else {
      // Dropped on another skill
      Object.keys(skillsByCategory).forEach(category => {
        const skills = skillsByCategory[category].skills;
        const overIdx = skills.findIndex(s => s.id === over.id);
        
        if (overIdx !== -1) {
          destCategory = category;
          destIndex = overIdx;
        }
      });
    }

    if (!destCategory) return;

    // Create a copy of the state
    const newSkillsByCategory = { ...skillsByCategory };

    if (sourceCategory === destCategory) {
      // Same category reordering
      const skills = Array.from(newSkillsByCategory[sourceCategory].skills);
      const reorderedSkills = arrayMove(skills, sourceIndex, destIndex);
      newSkillsByCategory[sourceCategory].skills = reorderedSkills;

      // Update state optimistically
      setSkillsByCategory(newSkillsByCategory);

      // Prepare bulk update
      const updates = reorderedSkills.map((skill, index) => ({
        skill_id: skill.id,
        order: index
      }));

      try {
        await skillsAPI.bulkReorderSkills(updates);
        setSuccess('Skills reordered successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } catch (err) {
        setError('Failed to reorder skills');
        fetchSkillsByCategory(); // Revert on error
      }
    } else {
      // Cross-category move
      const sourceSkills = Array.from(newSkillsByCategory[sourceCategory].skills);
      const [movedSkill] = sourceSkills.splice(sourceIndex, 1);
      
      const destSkills = Array.from(newSkillsByCategory[destCategory].skills);
      destSkills.splice(destIndex, 0, movedSkill);

      newSkillsByCategory[sourceCategory].skills = sourceSkills;
      newSkillsByCategory[destCategory].skills = destSkills;
      newSkillsByCategory[sourceCategory].count = sourceSkills.length;
      newSkillsByCategory[destCategory].count = destSkills.length;

      // Update state optimistically
      setSkillsByCategory(newSkillsByCategory);

      try {
        // Update category first
        await skillsAPI.reorderSkill(active.id, destIndex, destCategory);
        
        // Then update all orders
        const updates = [];
        sourceSkills.forEach((skill, index) => {
          updates.push({ skill_id: skill.id, order: index });
        });
        destSkills.forEach((skill, index) => {
          updates.push({ skill_id: skill.id, order: index });
        });
        
        await skillsAPI.bulkReorderSkills(updates);
        setSuccess('Skill moved successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } catch (err) {
        setError('Failed to move skill between categories');
        fetchSkillsByCategory(); // Revert on error
      }
    }
  };

  const handleExport = async (format) => {
    try {
      const data = await skillsAPI.exportSkills(format);
      
      if (format === 'csv') {
        // Create blob and download
        const blob = new Blob([data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'skills_export.csv';
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        // JSON download
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'skills_export.json';
        a.click();
        window.URL.revokeObjectURL(url);
      }
      
      setSuccess(`Skills exported successfully as ${format.toUpperCase()}!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to export skills');
    }
  };

  const getProficiencyColor = (level) => {
    const colors = {
      beginner: '#fbbf24',
      intermediate: '#60a5fa',
      advanced: '#34d399',
      expert: '#a78bfa',
    };
    return colors[level?.toLowerCase()] || '#6b7280';
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Technical': '#3b82f6',
      'Soft Skills': '#10b981',
      'Languages': '#f59e0b',
      'Industry-Specific': '#8b5cf6',
      'Uncategorized': '#6b7280',
    };
    return colors[category] || '#6b7280';
  };

  // Filter skills based on search and category
  const getFilteredCategories = () => {
    const filtered = {};
    
    Object.keys(skillsByCategory).forEach(category => {
      if (selectedCategory !== 'all' && category !== selectedCategory) return;
      
      const filteredSkills = skillsByCategory[category].skills.filter(skill =>
        skill.skill_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      if (filteredSkills.length > 0 || searchQuery === '') {
        filtered[category] = {
          ...skillsByCategory[category],
          skills: searchQuery ? filteredSkills : skillsByCategory[category].skills
        };
      }
    });
    
    return filtered;
  };

  if (loading) {
    return <div className="skills-organized-container"><div className="loading">Loading skills...</div></div>;
  }

  const filteredCategories = getFilteredCategories();
  const categoryNames = Object.keys(skillsByCategory);

  // Get all skill IDs for the active category
  const getAllSkillIds = () => {
    const ids = [];
    Object.values(filteredCategories).forEach(category => {
      category.skills.forEach(skill => ids.push(skill.id));
    });
    return ids;
  };

  return (
    <div className="skills-organized-container">
      <div className="skills-organized-header">
        <div className="header-top">
          <div className="header-left">
            <button className="btn-back" onClick={() => navigate('/dashboard')}>
              ← Back to Dashboard
            </button>
            <h2>Skills - Organized by Category</h2>
          </div>
          <div className="header-actions">
            <button className="btn-manage" onClick={() => navigate('/skills')}>
              ✏️ Manage Skills
            </button>
            <button className="btn-export" onClick={() => handleExport('json')}>
              📥 JSON
            </button>
            <button className="btn-export" onClick={() => handleExport('csv')}>
              📥 CSV
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="info-banner">
        <div className="info-icon">ℹ️</div>
        <div className="info-content">
          <strong>Organize Your Skills:</strong> Search and filter skills, drag and drop to reorder or move between categories, and export your organized list.
        </div>
      </div>

      <div className="controls-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="category-filter">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="category-select"
          >
            <option value="all">All Categories</option>
            {categoryNames.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="category-summaries">
        {Object.keys(filteredCategories).map(category => {
          const data = filteredCategories[category];
          return (
            <div key={category} className="summary-card" style={{ borderTopColor: getCategoryColor(category) }}>
              <div className="summary-header">
                <h4>{category}</h4>
                <span className="summary-count">{data.count} skills</span>
              </div>
              <div className="summary-stats">
                <div className="stat-item">
                  <span className="stat-label">Avg Experience:</span>
                  <span className="stat-value">{data.avg_years.toFixed(1)} years</span>
                </div>
                <div className="proficiency-bars">
                  {Object.keys(data.proficiency_distribution).map(level => {
                    const count = data.proficiency_distribution[level];
                    if (count === 0) return null;
                    return (
                      <div key={level} className="proficiency-bar-item">
                        <span className="proficiency-label">{level}:</span>
                        <div className="proficiency-bar">
                          <div 
                            className="proficiency-fill" 
                            style={{ 
                              width: `${(count / data.count) * 100}%`,
                              backgroundColor: getProficiencyColor(level)
                            }}
                          />
                        </div>
                        <span className="proficiency-count">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="categories-grid">
          {Object.keys(filteredCategories).map(category => {
            const data = filteredCategories[category];
            const skillIds = data.skills.map(s => s.id);
            const isOver = overId && overId.toString().startsWith('category-') && overId === `category-${category}`;

            return (
              <div key={category} className="category-section">
                <div className="category-header" style={{ backgroundColor: getCategoryColor(category) }}>
                  <h3>{category}</h3>
                  <span className="category-count">{data.count}</span>
                </div>
                
                <SortableContext items={skillIds} strategy={verticalListSortingStrategy}>
                  <DroppableCategory category={category} isOver={isOver}>
                    {data.skills.length === 0 ? (
                      <div className="empty-category">
                        {isOver ? 'Drop here to add to this category' : 'No skills in this category'}
                      </div>
                    ) : (
                      data.skills.map((skill) => (
                        <SortableSkillCard
                          key={skill.id}
                          skill={skill}
                          getProficiencyColor={getProficiencyColor}
                        />
                      ))
                    )}
                  </DroppableCategory>
                </SortableContext>
              </div>
            );
          })}
        </div>
        
        <DragOverlay>
          {activeId && activeSkill ? (
            <SkillCard skill={activeSkill} getProficiencyColor={getProficiencyColor} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <div className="organized-footer">
        <p className="hint-text">💡 Drag and drop skills to reorder within categories or move between categories</p>
      </div>
    </div>
  );
};

export default SkillsOrganized;
