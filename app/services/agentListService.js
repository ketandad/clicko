// Dummy agent list service for proximity sorting

export async function getAgentsByCategorySorted(categoryId, userLat, userLng) {
  // Simulate agent data
  const agents = [
    { id: '1', name: 'Agent A', rating: 4.8, rate: 20, lat: 28.7139, lng: 77.2090 },
    { id: '2', name: 'Agent B', rating: 4.5, rate: 18, lat: 28.7039, lng: 77.1190 },
    { id: '3', name: 'Agent C', rating: 4.9, rate: 22, lat: 28.7141, lng: 77.1020 },
  ];
  function getDistance(lat1, lng1, lat2, lng2) {
    const toRad = x => (x * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  return agents
    .map(agent => ({ ...agent, distance: getDistance(userLat, userLng, agent.lat, agent.lng) }))
    .sort((a, b) => a.distance - b.distance);
}
