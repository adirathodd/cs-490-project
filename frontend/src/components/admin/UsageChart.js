/**
 * UC-117: Usage Chart Component
 * Visualizes API usage trends over time
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { apiMonitoringAPI } from '../../services/apiMonitoringAPI';

const UsageChart = ({ services, daysFilter }) => {
  const [selectedService, setSelectedService] = useState('all');
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    prepareChartData();
  }, [selectedService, services]);

  const prepareChartData = () => {
    if (!services || services.length === 0) return;

    if (selectedService === 'all') {
      // Aggregate all services
      const dataMap = new Map();
      
      services.forEach(service => {
        if (service.daily_usage) {
          service.daily_usage.forEach(day => {
            const existing = dataMap.get(day.date) || {
              date: day.date,
              total_requests: 0,
              successful_requests: 0,
              failed_requests: 0,
            };
            
            existing.total_requests += day.total_requests || 0;
            existing.successful_requests += day.successful_requests || 0;
            existing.failed_requests += day.failed_requests || 0;
            
            dataMap.set(day.date, existing);
          });
        }
      });
      
      const aggregated = Array.from(dataMap.values()).sort((a, b) => 
        a.date.localeCompare(b.date)
      );
      
      setChartData(aggregated);
    } else {
      // Single service
      const service = services.find(s => s.service_name === selectedService);
      if (service && service.daily_usage) {
        setChartData(service.daily_usage);
      }
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">API Usage Trends</Typography>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Service</InputLabel>
            <Select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              label="Service"
            >
              <MenuItem value="all">All Services</MenuItem>
              {services && services.map(service => (
                <MenuItem key={service.service_name} value={service.service_name}>
                  {service.service_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : chartData.length === 0 ? (
          <Box textAlign="center" py={4}>
            <Typography color="text.secondary">No data available</Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={formatDate}
                formatter={(value) => value.toLocaleString()}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="total_requests"
                stroke="#1976d2"
                name="Total Requests"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="successful_requests"
                stroke="#2e7d32"
                name="Successful"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="failed_requests"
                stroke="#d32f2f"
                name="Failed"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default UsageChart;
