import React, { useState, useEffect } from 'react';
import { 
  Grid, Paper, Typography, Box, CircularProgress,
  Card, CardContent, CardHeader, Divider
} from '@mui/material';
import {
  PeopleOutline as UserIcon,
  EngineeringOutlined as AgentIcon,
  BookmarkBorderOutlined as BookingIcon,
  PendingActionsOutlined as PendingIcon
} from '@mui/icons-material';
import api from '../services/api';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, BarChart, Bar
} from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [bookingStats, setBookingStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const statsResponse = await api.get('/admin/dashboard/stats');
        const bookingsResponse = await api.get('/admin/dashboard/bookings-by-date');
        setStats(statsResponse.data);
        setBookingStats(bookingsResponse.data);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  const statCards = [
    { title: 'Total Users', value: stats?.users || 0, icon: <UserIcon fontSize="large" color="primary" /> },
    { title: 'Total Agents', value: stats?.agents || 0, icon: <AgentIcon fontSize="large" color="secondary" /> },
    { title: 'Total Bookings', value: stats?.bookings || 0, icon: <BookingIcon fontSize="large" color="success" /> },
    { title: 'Pending KYC', value: stats?.pendingKyc || 0, icon: <PendingIcon fontSize="large" color="warning" /> },
  ];

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Paper elevation={3} sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                {card.icon}
                <Typography variant="h4" component="div">
                  {card.value}
                </Typography>
              </Box>
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                {card.title}
              </Typography>
            </Paper>
          </Grid>
        ))}

        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader title="Booking Statistics (Last 30 Days)" />
            <Divider />
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={bookingStats}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="bookings" stroke="#8884d8" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Services Distribution" />
            <Divider />
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={stats?.serviceDistribution || []}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="service" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
