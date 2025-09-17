// Dummy booking creation service

export async function createBooking({ agentId, userId, scheduledTime }) {
  // Simulate booking creation
  return {
    success: true,
    booking: {
      id: Math.random().toString(36).substr(2, 9),
      agentId,
      userId,
      scheduledTime,
      status: scheduledTime ? 'scheduled' : 'confirmed',
    },
  };
}
