import config from '../config';

// Get agents by category with location-based sorting
export async function getAgentsByCategorySorted(categoryId, userLat, userLng, maxDistance = 25) {
  try {
    const params = new URLSearchParams();
    
    if (categoryId) {
      params.append('category_id', categoryId);
    }
    
    if (userLat && userLng) {
      params.append('latitude', userLat);
      params.append('longitude', userLng);
      params.append('max_distance', maxDistance);
    }
    
    // Only show online agents
    params.append('is_online', 'true');
    
    const url = `${config.API_URL}/agents/?${params}`;
    console.log('Fetching agents from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const agents = await response.json();
    console.log('Agents fetched:', agents);
    
    return agents;
  } catch (error) {
    console.error('Error fetching agents:', error);
    
    // Fallback to dummy data if API fails
    return getFallbackAgents(categoryId, userLat, userLng);
  }
}

// Get nearby agents within specific radius
export async function getNearbyAgents(userLat, userLng, radius = 10, categoryId = null, limit = 20) {
  try {
    const params = new URLSearchParams({
      latitude: userLat,
      longitude: userLng,
      radius: radius,
      limit: limit
    });
    
    if (categoryId) {
      params.append('category_id', categoryId);
    }
    
    const url = `${config.API_URL}/agents/nearby?${params}`;
    console.log('Fetching nearby agents from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const agents = await response.json();
    return agents;
  } catch (error) {
    console.error('Error fetching nearby agents:', error);
    return getFallbackAgents(categoryId, userLat, userLng);
  }
}

// Get specific agent details
export async function getAgentById(agentId, userLat = null, userLng = null) {
  try {
    const params = new URLSearchParams();
    
    if (userLat && userLng) {
      params.append('latitude', userLat);
      params.append('longitude', userLng);
    }
    
    const url = `${config.API_URL}/agents/${agentId}?${params}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching agent details:', error);
    throw error;
  }
}

// Fallback dummy data for development/offline mode
function getFallbackAgents(categoryId, userLat, userLng) {
  const agents = [
    { 
      id: 1, 
      name: 'Rajesh Kumar', 
      avg_rating: 4.8, 
      total_ratings: 156,
      rate_per_km: 20, 
      is_online: true,
      categories: ['Electrician', 'AC Repair'],
      user_id: 101
    },
    { 
      id: 2, 
      name: 'Priya Sharma', 
      avg_rating: 4.6, 
      total_ratings: 89,
      rate_per_km: 18, 
      is_online: true,
      categories: ['Cleaning', 'Home Service'],
      user_id: 102
    },
    { 
      id: 3, 
      name: 'Amit Singh', 
      avg_rating: 4.9, 
      total_ratings: 234,
      rate_per_km: 22, 
      is_online: false,
      categories: ['Plumber', 'Carpenter'],
      user_id: 103
    },
    { 
      id: 4, 
      name: 'Sunita Patel', 
      avg_rating: 4.7, 
      total_ratings: 67,
      rate_per_km: 19, 
      is_online: true,
      categories: ['Beauty', 'Spa'],
      user_id: 104
    },
    { 
      id: 5, 
      name: 'Vikram Gupta', 
      avg_rating: 4.5, 
      total_ratings: 123,
      rate_per_km: 21, 
      is_online: true,
      categories: ['Driver', 'Delivery'],
      user_id: 105
    }
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

  let filteredAgents = agents;

  // Add distance calculation if user location provided
  if (userLat && userLng) {
    filteredAgents = agents.map(agent => {
      // Dummy agent locations around Delhi
      const agentLat = 28.7041 + (agent.id % 100) * 0.001;
      const agentLng = 77.1025 + (agent.id % 100) * 0.001;
      
      return {
        ...agent,
        distance_km: Math.round(getDistance(userLat, userLng, agentLat, agentLng) * 100) / 100
      };
    }).sort((a, b) => a.distance_km - b.distance_km);
  } else {
    // Sort by rating if no location
    filteredAgents = agents.sort((a, b) => b.avg_rating - a.avg_rating);
  }

  return filteredAgents;
}
