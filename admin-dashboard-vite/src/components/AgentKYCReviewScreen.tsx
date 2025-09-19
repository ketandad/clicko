import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchKycRequests, updateKycStatus } from '../services/api';

interface Agent {
  id: number;
  name: string;
  kyc_document_type: string;
  kyc_document_path: string;
}

const AgentKYCReviewScreen: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: agents, isLoading, isError } = useQuery<Agent[]>({
    queryKey: ['kycRequests'],
    queryFn: fetchKycRequests,
  });

  const mutation = useMutation({
    mutationFn: updateKycStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kycRequests'] });
    },
  });

  const handleUpdateStatus = (agentId: number, status: string) => {
    mutation.mutate({ agentId, status });
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (isError) {
    return <div>Error fetching data</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Pending KYC Requests</h2>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Agent Name
              </th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Document Type
              </th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Document
              </th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {agents?.map((agent) => (
              <tr key={agent.id}>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                  <p className="text-gray-900 whitespace-no-wrap">{agent.name}</p>
                </td>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                  <p className="text-gray-900 whitespace-no-wrap">{agent.kyc_document_type}</p>
                </td>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                  <a href={agent.kyc_document_path} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900">
                    View Document
                  </a>
                </td>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                  <button 
                    onClick={() => handleUpdateStatus(agent.id, 'verified')}
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mr-2"
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(agent.id, 'rejected')}
                    className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AgentKYCReviewScreen;