/**
 * UC-051: Resume Export Button Component
 * Button that triggers the resume export dialog
 */
import React, { useState } from 'react';
import ResumeExportDialog from './ResumeExportDialog';

const ResumeExportButton = ({ className = '', variant = 'primary' }) => {
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  const buttonClass = `resume-export-trigger ${variant === 'primary' ? 'primary' : 'secondary'} ${className}`;

  return (
    <>
      <button
        className={buttonClass}
        onClick={() => setIsExportDialogOpen(true)}
        aria-label="Export Resume"
      >
        <span className="icon">📥</span>
        Export Resume
      </button>

      <ResumeExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
      />

      <style jsx>{`
        .resume-export-trigger {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .resume-export-trigger.primary {
          background-color: #6366f1;
          color: white;
          border: 1px solid #6366f1;
        }

        .resume-export-trigger.primary:hover {
          background-color: #4f46e5;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .resume-export-trigger.secondary {
          background-color: white;
          color: #475569;
          border: 1px solid #cbd5e1;
        }

        .resume-export-trigger.secondary:hover {
          background-color: #f8fafc;
          border-color: #94a3b8;
        }

        .icon {
          font-size: 18px;
        }
      `}</style>
    </>
  );
};

export default ResumeExportButton;
