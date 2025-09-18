/* eslint-disable */
import React, { useEffect, useState } from "react";
import { 
  Typography, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Button, Paper, Link, Box, CircularProgress 
} from "@mui/material";
import api from "./services/api";

// Define Agent interface for proper typing
interface Agent {
  id: number;
  name: string;
  kyc_document_type: string;
  kyc_document_path: string;
}

export default function AgentKYCReviewScreen() {
  // Properly type the state
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/admin/agents-kyc?status=pending")
      .then((res) => {
        setAgents(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching KYC requests:", err);
        setLoading(false);
      });
  }, []);

  // Add proper type annotations
  const updateKYC = async (agentId: number, status: string) => {
    try {
      await api.post("/admin/agent/kyc/verify", { 
        agent_id: agentId, 
        status 
      });
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
    } catch (err) {
      console.error("Error updating KYC status:", err);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div>
      <Typography variant="h5" gutterBottom>
        Pending KYC Requests
      </Typography>
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Agent Name</TableCell>
              <TableCell>Document Type</TableCell>
              <TableCell>Document</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {agents.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.kyc_document_type}</TableCell>
                <TableCell>
                  <Link href={item.kyc_document_path} target="_blank" rel="noopener">
                    View Document
                  </Link>
                </TableCell>
                <TableCell>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={() => updateKYC(item.id, "verified")}
                    sx={{ mr: 1 }}
                  >
                    Verify
                  </Button>
                  <Button 
                    variant="contained" 
                    color="error" 
                    onClick={() => updateKYC(item.id, "rejected")}
                  >
                    Reject
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {agents.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  No pending KYC requests found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
