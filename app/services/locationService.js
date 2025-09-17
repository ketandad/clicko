// Dummy location service for agent tracking

export async function updateAgentLocation(agentId, lat, lng) {
  // Simulate API call to update agent location
  return { success: true };
}

export async function getAgentLocation(bookingId) {
  // Simulate API call to fetch agent location for booking
  return { lat: 28.6139, lng: 77.2090 };
}
