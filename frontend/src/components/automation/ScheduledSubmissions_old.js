import React, { useState } from 'react';
import Icon from '../common/Icon';
import './ScheduledSubmissions.css';
import { automationAPI } from '../../services/automationAPI';

const ScheduledSubmissions = ({ submissions, onRefresh }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [submissionToCancel, setSubmissionToCancel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleMenuOpen = (event, submission) => {
    setAnchorEl(event.currentTarget);
    setSelectedSubmission(submission);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedSubmission(null);
  };

  const handleCancelClick = (submission) => {
    setSubmissionToCancel(submission);
    setCancelDialogOpen(true);
    handleMenuClose();
  };

  const handleCancelConfirm = async () => {
    if (submissionToCancel) {
      setLoading(true);
      try {
        await automationAPI.cancelScheduledSubmission(submissionToCancel.id);
        setCancelDialogOpen(false);
        setSubmissionToCancel(null);
        onRefresh();
      } catch (err) {
        console.error('Failed to cancel submission:', err);
        setError('Failed to cancel scheduled submission');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleExecuteNow = async (submission) => {
    setLoading(true);
    try {
      await automationAPI.executeScheduledSubmission(submission.id);
      onRefresh();
    } catch (err) {
      console.error('Failed to execute submission:', err);
      setError('Failed to execute submission now');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'warning',
      'executed': 'success',
      'failed': 'error',
      'cancelled': 'default'
    };
    return colors[status] || 'default';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <ScheduleIcon />;
      case 'executed':
        return <PlayIcon />;
      case 'failed':
        return <CancelIcon />;
      case 'cancelled':
        return <PauseIcon />;
      default:
        return <ScheduleIcon />;
    }
  };

  const formatDateTime = (dateTimeString) => {
    const date = new Date(dateTimeString);
    return date.toLocaleString();
  };

  const isOverdue = (scheduledDateTime, status) => {
    if (status !== 'pending') return false;
    const scheduled = new Date(scheduledDateTime);
    const now = new Date();
    return scheduled < now;
  };

  const formatSubmissionMethod = (method) => {
    const methods = {
      'email': 'Email',
      'portal': 'Company Portal',
      'linkedin': 'LinkedIn',
      'manual': 'Manual Review'
    };
    return methods[method] || method;
  };

  if (submissions.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <ScheduleIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="textSecondary" gutterBottom>
          No Scheduled Submissions
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Automated application submissions will appear here when scheduled.
        </Typography>
      </Paper>
    );
  }

  return (
    <>
      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Job Details</TableCell>
              <TableCell>Scheduled Time</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>Package</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {submissions.map((submission) => (
              <TableRow 
                key={submission.id} 
                hover
                sx={{
                  backgroundColor: isOverdue(submission.scheduled_datetime, submission.status) 
                    ? '#fff3e0' : 'inherit'
                }}
              >
                <TableCell>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {submission.job?.title || 'Unknown Position'}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {submission.job?.company_name || 'Unknown Company'}
                    </Typography>
                    {isOverdue(submission.scheduled_datetime, submission.status) && (
                      <Chip
                        label="Overdue"
                        size="small"
                        color="error"
                        sx={{ ml: 1, fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                </TableCell>
                
                <TableCell>
                  <Typography variant="body2">
                    {formatDateTime(submission.scheduled_datetime)}
                  </Typography>
                  {isOverdue(submission.scheduled_datetime, submission.status) && (
                    <Typography variant="caption" color="error">
                      Past due
                    </Typography>
                  )}
                </TableCell>
                
                <TableCell>
                  <Chip 
                    label={formatSubmissionMethod(submission.submission_method)}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                
                <TableCell>
                  {submission.application_package ? (
                    <Box>
                      <Typography variant="body2">
                        Package #{submission.application_package.id}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Status: {submission.application_package.status}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      No package
                    </Typography>
                  )}
                </TableCell>
                
                <TableCell>
                  <Chip
                    icon={getStatusIcon(submission.status)}
                    label={submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                    color={getStatusColor(submission.status)}
                    size="small"
                  />
                </TableCell>
                
                <TableCell>
                  <Box display="flex" alignItems="center">
                    {submission.status === 'pending' && (
                      <Tooltip title="Execute Now">
                        <IconButton
                          size="small"
                          onClick={() => handleExecuteNow(submission)}
                          disabled={loading}
                          sx={{ mr: 1 }}
                        >
                          <PlayIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    <Tooltip title="More Actions">
                      <IconButton
                        size="small"
                        onClick={(event) => handleMenuOpen(event, submission)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {selectedSubmission?.status === 'pending' && (
          <MenuItem onClick={() => handleExecuteNow(selectedSubmission)}>
            <PlayIcon sx={{ mr: 1 }} />
            Execute Now
          </MenuItem>
        )}
        {selectedSubmission?.status === 'pending' && (
          <MenuItem onClick={() => handleCancelClick(selectedSubmission)}>
            <CancelIcon sx={{ mr: 1 }} />
            Cancel Submission
          </MenuItem>
        )}
        {selectedSubmission?.application_package && (
          <MenuItem onClick={handleMenuClose}>
            <LaunchIcon sx={{ mr: 1 }} />
            View Package
          </MenuItem>
        )}
        <MenuItem onClick={handleMenuClose}>
          <EditIcon sx={{ mr: 1 }} />
          Edit Schedule
        </MenuItem>
      </Menu>

      {/* Cancel Confirmation Dialog */}
      <Dialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
      >
        <DialogTitle>Cancel Scheduled Submission</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to cancel the scheduled submission for{' '}
            "{submissionToCancel?.job?.title}" at "{submissionToCancel?.job?.company_name}"?
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>
            Keep Scheduled
          </Button>
          <Button 
            onClick={handleCancelConfirm} 
            color="error" 
            variant="contained"
            disabled={loading}
          >
            Cancel Submission
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ScheduledSubmissions;