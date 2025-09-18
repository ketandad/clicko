import React, { useState, useEffect } from 'react';
import {
  Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button,
  Box, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Grid, CardMedia, CircularProgress,
  Snackbar, Alert, TablePagination
} from '@mui/material';
import api from '../services/api';

export default function AgentKYC() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [open, setOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    fetchAgentsWithPendingKYC();
  }, []);

  const fetchAgentsWithPendingKYC = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/agents-kyc?status=pending');
      setAgents(response.data);
    } catch (error) {
      console.error('Error fetching agents:', error);
      showSnackbar('Failed to load agents', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewKYC = (agent) => {
    setSelectedAgent(agent);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedAgent(null);
  };

  const handleVerify = async (status) => {
    try {
      await api.post(`/admin/agent/kyc/verify`, {
        agent_id: selectedAgent.id,
        status: status
      });
      setAgents(agents.filter(agent => agent.id !== selectedAgent.id));
      showSnackbar(`KYC ${status === 'verified' ? 'approved' : 'rejected'} successfully`, 'success');
      handleClose();
    } catch (error) {
      console.error('Error updating KYC status:', error);
      showSnackbar('Failed to update KYC status', 'error');
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Agent KYC Verification
      </Typography>
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 440 }}>
          <Table stickyHeader aria-label="sticky table">
            <TableHead>
              <TableRow>
                <TableCell>Agent ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Document Type</TableCell>
                <TableCell>Submission Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {agents.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((agent) => (
                <TableRow hover role="checkbox" tabIndex={-1} key={agent.id}>
                  <TableCell>{agent.id}</TableCell>
                  <TableCell>{agent.name}</TableCell>
                  <TableCell>{agent.kyc_document_type}</TableCell>
                  <TableCell>{new Date(agent.updated_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Chip
                      label={agent.kyc_status}
                      color={agent.kyc_status === 'pending' ? 'warning' : agent.kyc_status === 'verified' ? 'success' : 'error'}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleViewKYC(agent)}
                    >
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {agents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">No pending KYC requests</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={agents.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {selectedAgent && (
        <Dialog
          open={open}
          onClose={handleClose}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Review KYC Document
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  Agent Details
                </Typography>
                <Typography><strong>Name:</strong> {selectedAgent.name}</Typography>
                <Typography><strong>Email:</strong> {selectedAgent.email}</Typography>
                <Typography><strong>Phone:</strong> {selectedAgent.phone}</Typography>
                <Typography><strong>Document Type:</strong> {selectedAgent.kyc_document_type}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <CardMedia
                  component="img"
                  image={`/api/kyc-document/${selectedAgent.id}`}
                  alt="KYC Document"
                  sx={{ 
                    maxHeight: 300, 
                    objectFit: 'contain',
                    border: '1px solid #ddd',
                    borderRadius: 1
                  }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} color="primary">
              Close
            </Button>
            <Button onClick={() => handleVerify('rejected')} color="error" variant="contained">
              Reject
            </Button>
            <Button onClick={() => handleVerify('verified')} color="success" variant="contained">
              Approve
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
