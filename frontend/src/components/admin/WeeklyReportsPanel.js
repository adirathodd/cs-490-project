/**
 * UC-117: Weekly Reports Panel Component
 * Displays list of generated weekly reports
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import {
  Email as EmailIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { apiMonitoringAPI } from '../../services/apiMonitoringAPI';

const WeeklyReportsPanel = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await apiMonitoringAPI.getWeeklyReports(12); // Last 12 weeks
      setReports(data.reports || []);
    } catch (error) {
      console.error('Failed to load weekly reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = async (reportId) => {
    try {
      setDetailsLoading(true);
      setDetailsOpen(true);
      const report = await apiMonitoringAPI.getWeeklyReportDetail(reportId);
      setSelectedReport(report);
    } catch (error) {
      console.error('Failed to load report details:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setSelectedReport(null);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Weekly API Usage Reports
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Automated weekly summaries are generated every Monday and emailed to rocketresume@gmail.com
      </Typography>

      {reports.length === 0 ? (
        <Box textAlign="center" py={4}>
          <Typography color="text.secondary">No reports generated yet</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {reports.map((report) => (
            <Grid item xs={12} md={6} key={report.id}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box>
                      <Typography variant="h6">
                        {new Date(report.week_start).toLocaleDateString()} - {new Date(report.week_end).toLocaleDateString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Generated: {new Date(report.generated_at).toLocaleString()}
                      </Typography>
                    </Box>
                    {report.email_sent && (
                      <Chip
                        icon={<EmailIcon />}
                        label="Sent"
                        size="small"
                        color="success"
                      />
                    )}
                  </Box>

                  <Grid container spacing={2} mb={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Total Requests
                      </Typography>
                      <Typography variant="h6">
                        {report.total_requests?.toLocaleString() || 0}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Error Rate
                      </Typography>
                      <Typography variant="h6" color={report.error_rate > 5 ? 'error' : 'success.main'}>
                        {report.error_rate?.toFixed(1) || 0}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Avg Response Time
                      </Typography>
                      <Typography variant="h6">
                        {report.avg_response_time_ms?.toFixed(0) || 0}ms
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Alerts
                      </Typography>
                      <Typography variant="h6" color={report.critical_alerts > 0 ? 'error' : 'text.primary'}>
                        {report.total_alerts || 0}
                        {report.critical_alerts > 0 && ` (${report.critical_alerts} critical)`}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Button
                    variant="outlined"
                    startIcon={<VisibilityIcon />}
                    onClick={() => handleViewReport(report.id)}
                    fullWidth
                    size="small"
                  >
                    View Full Report
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Report Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={handleCloseDetails}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              {selectedReport && 
                `Weekly Report: ${new Date(selectedReport.week_start).toLocaleDateString()} - ${new Date(selectedReport.week_end).toLocaleDateString()}`
              }
            </Typography>
            <IconButton onClick={handleCloseDetails} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {detailsLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : selectedReport ? (
            <Box>
              {/* Summary Text */}
              {selectedReport.summary_text && (
                <Box mb={3}>
                  <Typography variant="subtitle2" gutterBottom>
                    Summary
                  </Typography>
                  <Typography
                    variant="body2"
                    component="pre"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      bgcolor: 'grey.100',
                      p: 2,
                      borderRadius: 1,
                    }}
                  >
                    {selectedReport.summary_text}
                  </Typography>
                </Box>
              )}

              {/* HTML Content (if available) */}
              {selectedReport.html_content && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Full Report
                  </Typography>
                  <Box
                    sx={{
                      border: 1,
                      borderColor: 'grey.300',
                      borderRadius: 1,
                      p: 2,
                      maxHeight: 500,
                      overflow: 'auto',
                    }}
                    dangerouslySetInnerHTML={{ __html: selectedReport.html_content }}
                  />
                </Box>
              )}
            </Box>
          ) : (
            <Typography>No report data available</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetails}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WeeklyReportsPanel;
