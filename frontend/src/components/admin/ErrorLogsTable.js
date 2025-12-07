/**
 * UC-117: Error Logs Table Component
 * Displays paginated error logs with filtering
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  Typography,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Button,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { apiMonitoringAPI } from '../../services/apiMonitoringAPI';

const ErrorLogsTable = ({ initialErrors, daysFilter }) => {
  const [errors, setErrors] = useState(initialErrors || []);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedRow, setExpandedRow] = useState(null);
  const [filterService, setFilterService] = useState('all');
  const [filterResolved, setFilterResolved] = useState('false');

  useEffect(() => {
    loadErrors();
  }, [page, rowsPerPage, filterService, filterResolved, daysFilter]);

  const loadErrors = async () => {
    try {
      setLoading(true);
      const params = {
        days: daysFilter,
        page: page + 1,
        page_size: rowsPerPage,
      };
      if (filterService !== 'all') {
        params.service_id = filterService;
      }
      if (filterResolved !== 'all') {
        params.is_resolved = filterResolved;
      }
      
      const data = await apiMonitoringAPI.getErrorLogs(params);
      setErrors(data.errors || []);
      setTotalCount(data.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to load error logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleExpandRow = (errorId) => {
    setExpandedRow(expandedRow === errorId ? null : errorId);
  };

  if (loading && errors.length === 0) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Filters */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={filterResolved}
              onChange={(e) => setFilterResolved(e.target.value)}
              label="Status"
            >
              <MenuItem value="false">Unresolved</MenuItem>
              <MenuItem value="true">Resolved</MenuItem>
              <MenuItem value="all">All</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadErrors}
            disabled={loading}
            fullWidth
          >
            Refresh
          </Button>
        </Grid>
      </Grid>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={40} />
              <TableCell>Service</TableCell>
              <TableCell>Error Type</TableCell>
              <TableCell>Endpoint</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Occurred At</TableCell>
              <TableCell>Retries</TableCell>
              <TableCell>Affected Users</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {errors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography color="text.secondary">No errors found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              errors.map((error) => (
                <React.Fragment key={error.id}>
                  <TableRow hover>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleExpandRow(error.id)}
                      >
                        {expandedRow === error.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>{error.service_name}</TableCell>
                    <TableCell>
                      <Chip label={error.error_type} size="small" color="error" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {error.endpoint}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={error.is_resolved ? 'Resolved' : 'Active'}
                        size="small"
                        color={error.is_resolved ? 'success' : 'error'}
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(error.occurred_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{error.retry_count}</TableCell>
                    <TableCell>{error.affected_users_count}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={8} sx={{ py: 0, borderBottom: 'none' }}>
                      <Collapse in={expandedRow === error.id} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 2, bgcolor: 'grey.50' }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Error Message:
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {error.error_message}
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="caption" color="text.secondary">
                                <strong>Method:</strong> {error.request_method}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="caption" color="text.secondary">
                                <strong>Status Code:</strong> {error.status_code || 'N/A'}
                              </Typography>
                            </Grid>
                            {error.error_code && (
                              <Grid item xs={12} sm={6}>
                                <Typography variant="caption" color="text.secondary">
                                  <strong>Error Code:</strong> {error.error_code}
                                </Typography>
                              </Grid>
                            )}
                            {error.resolved_at && (
                              <Grid item xs={12} sm={6}>
                                <Typography variant="caption" color="text.secondary">
                                  <strong>Resolved At:</strong> {new Date(error.resolved_at).toLocaleString()}
                                </Typography>
                              </Grid>
                            )}
                          </Grid>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </TableContainer>
    </Box>
  );
};

export default ErrorLogsTable;
