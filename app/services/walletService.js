// Dummy wallet service for MVP

export async function onboardAgent(agentData) {
  // Simulate API call
  return { success: true, walletBalance: 1000 };
}

export async function getWallet(agentId) {
  // Simulate API call
  return {
    balance: 1000,
    transactions: [
      { id: '1', type: 'topup', amount: 500, timestamp: '2025-09-15', reason: 'Initial Top Up' },
      { id: '2', type: 'deduct', amount: 50, timestamp: '2025-09-16', reason: 'Booking Fee' },
      { id: '3', type: 'topup', amount: 200, timestamp: '2025-09-17', reason: 'Manual Top Up' },
    ],
  };
}

export async function topUpWallet(agentId, amount) {
  // Simulate API call
  return { success: true, newBalance: 1000 + amount };
}

export async function createBooking(agentId) {
  // Simulate API call
  return { success: true, newBalance: 950 };
}
