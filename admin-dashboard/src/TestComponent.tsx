import * as React from 'react';
import api from '../services/api'; // Update the path if needed

interface Agent {
  id: number;
  name: string;
  kyc_document_type: string;
  kyc_document_path: string;
}

export function AgentKYCReviewScreen(): React.ReactElement {
  // Rest of your component logic here...
  return (
    <div>Agent KYC Review Screen</div>
  );
}

export default AgentKYCReviewScreen;