import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api', // Replace with your API base URL
});

export const fetchKycRequests = async () => {
  const { data } = await api.get('/admin/agents-kyc?status=pending');
  return data;
};

export const updateKycStatus = async ({ agentId, status }: { agentId: number; status: string }) => {
  const { data } = await api.post('/admin/agent/kyc/verify', { agent_id: agentId, status });
  return data;
};