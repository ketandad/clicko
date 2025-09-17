// Dummy agent service for status logic

export async function acceptBooking(agentId) {
  // Simulate API call: set agent offline for 2 hours
  return { success: true, status: 'offline', offlineUntil: Date.now() + 2 * 60 * 60 * 1000 };
}

export async function updateAgentStatus(agentId, status) {
  // Simulate API call: update agent status
  return { success: true, status };
}
