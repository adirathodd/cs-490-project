import React, { useState } from 'react';
import Icon from '../common/Icon';
import './ApplicationPackages.css';
import { automationAPI } from '../../services/automationAPI';

const ApplicationPackages = ({ packages, onRefresh }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [packageDetails, setPackageDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleMenuOpen = (event, pkg) => {
    setAnchorEl(event.currentTarget);
    setSelectedPackage(pkg);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedPackage(null);
  };

  const handleViewDetails = async (pkg) => {
    setLoading(true);
    try {
      const details = await automationAPI.getApplicationPackageDetails(pkg.id);
      setPackageDetails(details);
      setDetailsDialogOpen(true);
    } catch (err) {
      console.error('Failed to fetch package details:', err);
      setError('Failed to load package details');
    } finally {
      setLoading(false);
    }
    handleMenuClose();
  };

  const handleRegeneratePackage = async (pkg) => {
    setLoading(true);
    try {
      await automationAPI.regenerateApplicationPackage(pkg.id);
      onRefresh();
    } catch (err) {
      console.error('Failed to regenerate package:', err);
      setError('Failed to regenerate package');
    } finally {
      setLoading(false);
    }
    handleMenuClose();
  };

  const handleDownloadPackage = async (pkg) => {
    try {
      const downloadUrl = await automationAPI.downloadApplicationPackage(pkg.id);
      window.open(downloadUrl, '_blank');
    } catch (err) {
      console.error('Failed to download package:', err);
      setError('Failed to download package');
    }
    handleMenuClose();
  };

  const getStatusColor = (status) => {
    const colors = {
      'generating': 'info',
      'ready': 'success',
      'failed': 'error',
      'updating': 'warning'
    };
    return colors[status] || 'default';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'generating':
      case 'updating':
        return <RefreshIcon />;
      case 'ready':
        return <FolderIcon />;
      case 'failed':
        return <DocumentIcon />;
      default:
        return <DocumentIcon />;
    }
  };

  const formatDateTime = (dateTimeString) => {
    const date = new Date(dateTimeString);
    return date.toLocaleString();
  };

  const getMatchScoreColor = (score) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  if (packages.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <FolderIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="textSecondary" gutterBottom>
          No Application Packages
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Generated application packages will appear here when automation rules create them.
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
              <TableCell>Match Score</TableCell>
              <TableCell>Package Contents</TableCell>
              <TableCell>Generated</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {packages.map((pkg) => (
              <TableRow key={pkg.id} hover>
                <TableCell>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {pkg.job?.title || 'Unknown Position'}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {pkg.job?.company_name || 'Unknown Company'}
                    </Typography>
                  </Box>
                </TableCell>
                
                <TableCell>
                  {pkg.match_score !== null ? (
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip
                        label={`${pkg.match_score}%`}
                        size="small"
                        color={getMatchScoreColor(pkg.match_score)}
                      />
                      <LinearProgress
                        variant="determinate"
                        value={pkg.match_score}
                        sx={{ width: 60, height: 4 }}
                        color={getMatchScoreColor(pkg.match_score)}
                      />
                    </Box>
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      N/A
                    </Typography>
                  )}
                </TableCell>
                
                <TableCell>
                  <Box>
                    <Box display="flex" gap={1} mb={1}>
                      {pkg.resume_document && (
                        <Chip label="Resume" size="small" variant="outlined" />
                      )}
                      {pkg.cover_letter_document && (
                        <Chip label="Cover Letter" size="small" variant="outlined" />
                      )}
                      {pkg.portfolio_url && (
                        <Chip label="Portfolio" size="small" variant="outlined" />
                      )}
                    </Box>
                    {(!pkg.resume_document && !pkg.cover_letter_document && !pkg.portfolio_url) && (
                      <Typography variant="caption" color="textSecondary">
                        No documents
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                
                <TableCell>
                  <Typography variant="body2">
                    {formatDateTime(pkg.created_at)}
                  </Typography>
                </TableCell>
                
                <TableCell>
                  <Chip
                    icon={getStatusIcon(pkg.status)}
                    label={pkg.status.charAt(0).toUpperCase() + pkg.status.slice(1)}
                    color={getStatusColor(pkg.status)}
                    size="small"
                  />
                  {pkg.status === 'generating' && (
                    <LinearProgress sx={{ mt: 1, width: 80 }} />
                  )}
                </TableCell>
                
                <TableCell>
                  <Box display="flex" alignItems="center">
                    {pkg.status === 'ready' && (
                      <Tooltip title="Download Package">
                        <IconButton
                          size="small"
                          onClick={() => handleDownloadPackage(pkg)}
                          sx={{ mr: 1 }}
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetails(pkg)}
                        sx={{ mr: 1 }}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title="More Actions">
                      <IconButton
                        size="small"
                        onClick={(event) => handleMenuOpen(event, pkg)}
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
        <MenuItem onClick={() => handleViewDetails(selectedPackage)}>
          <VisibilityIcon sx={{ mr: 1 }} />
          View Details
        </MenuItem>
        {selectedPackage?.status === 'ready' && (
          <MenuItem onClick={() => handleDownloadPackage(selectedPackage)}>
            <DownloadIcon sx={{ mr: 1 }} />
            Download Package
          </MenuItem>
        )}
        <MenuItem onClick={() => handleRegeneratePackage(selectedPackage)}>
          <RefreshIcon sx={{ mr: 1 }} />
          Regenerate Package
        </MenuItem>
      </Menu>

      {/* Package Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Application Package Details
        </DialogTitle>
        <DialogContent>
          {packageDetails && (
            <Grid container spacing={3}>
              {/* Job Information */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Job Information
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>Position:</strong> {packageDetails.job?.title}
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>Company:</strong> {packageDetails.job?.company_name}
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>Match Score:</strong>{' '}
                      {packageDetails.match_score ? `${packageDetails.match_score}%` : 'N/A'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Package Information */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Package Information
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>Status:</strong> {packageDetails.status}
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>Created:</strong> {formatDateTime(packageDetails.created_at)}
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>Last Updated:</strong> {formatDateTime(packageDetails.updated_at)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Documents */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Included Documents
                    </Typography>
                    <Box display="flex" gap={2} flexWrap="wrap">
                      {packageDetails.resume_document && (
                        <Chip
                          icon={<DocumentIcon />}
                          label="Resume"
                          color="primary"
                          clickable
                        />
                      )}
                      {packageDetails.cover_letter_document && (
                        <Chip
                          icon={<DocumentIcon />}
                          label="Cover Letter"
                          color="secondary"
                          clickable
                        />
                      )}
                      {packageDetails.portfolio_url && (
                        <Chip
                          icon={<DocumentIcon />}
                          label="Portfolio"
                          color="info"
                          clickable
                        />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Generation Parameters */}
              {packageDetails.generation_parameters && 
                Object.keys(packageDetails.generation_parameters).length > 0 && (
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Generation Parameters
                      </Typography>
                      <Box component="pre" sx={{ fontSize: '0.8rem', overflow: 'auto' }}>
                        {JSON.stringify(packageDetails.generation_parameters, null, 2)}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>
            Close
          </Button>
          {packageDetails?.status === 'ready' && (
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={() => handleDownloadPackage(packageDetails)}
            >
              Download
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ApplicationPackages;