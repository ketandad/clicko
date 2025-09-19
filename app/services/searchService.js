import config from '../config';

// Search agents and services with location-based prioritization
export async function searchAgents(query, userLat = null, userLng = null, maxDistance = 25, isOnline = true) {
  try {
    const params = new URLSearchParams();
    params.append('query', query);
    
    if (userLat && userLng) {
      params.append('latitude', userLat);
      params.append('longitude', userLng);
      params.append('max_distance', maxDistance);
    }
    
    if (isOnline !== null) {
      params.append('is_online', isOnline);
    }
    
    const url = `${config.API_URL}/agents/search?${params}`;
    console.log('Searching agents:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const results = await response.json();
    console.log('Search results:', results);
    
    return results;
  } catch (error) {
    console.error('Error searching agents:', error);
    
    // Fallback to dummy search results
    return getFallbackSearchResults(query, userLat, userLng);
  }
}

// Search with category filtering
export async function searchAgentsByCategory(query, categoryId, userLat = null, userLng = null) {
  try {
    // For category-specific search, we'll use the general agents API with search-like filtering
    const params = new URLSearchParams();
    params.append('category_id', categoryId);
    
    if (userLat && userLng) {
      params.append('latitude', userLat);
      params.append('longitude', userLng);
    }
    
    const url = `${config.API_URL}/agents/?${params}`;
    
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
    
    // Filter results by query text in name or categories
    const filteredAgents = agents.filter(agent => 
      agent.name.toLowerCase().includes(query.toLowerCase()) ||
      agent.categories.some(cat => cat.toLowerCase().includes(query.toLowerCase()))
    );
    
    return filteredAgents;
  } catch (error) {
    console.error('Error searching agents by category:', error);
    return getFallbackSearchResults(query, userLat, userLng);
  }
}

// Get search suggestions based on categories and popular searches
export async function getSearchSuggestions(query) {
  try {
    // For now, return static suggestions based on categories
    const suggestions = [
      'Electrician',
      'Plumber', 
      'Home Cleaning',
      'AC Service',
      'Carpentry',
      'Painting',
      'Gardening',
      'Pest Control'
    ];
    
    // Filter suggestions based on query
    if (query && query.length > 0) {
      return suggestions.filter(suggestion => 
        suggestion.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    return suggestions;
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    return [];
  }
}

// Fallback search results for offline/error scenarios
function getFallbackSearchResults(query, userLat, userLng) {
  const allAgents = [
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
    }
  ];

  // Filter agents based on search query
  const filteredAgents = allAgents.filter(agent => {
    const searchLower = query.toLowerCase();
    return agent.name.toLowerCase().includes(searchLower) ||
           agent.categories.some(cat => cat.toLowerCase().includes(searchLower));
  });

  // Add distance calculation if location provided
  if (userLat && userLng) {
    function getDistance(lat1, lng1, lat2, lng2) {
      const toRad = x => (x * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }

    return filteredAgents.map(agent => {
      const agentLat = 28.7041 + (agent.id % 100) * 0.001;
      const agentLng = 77.1025 + (agent.id % 100) * 0.001;
      
      return {
        ...agent,
        distance_km: Math.round(getDistance(userLat, userLng, agentLat, agentLng) * 100) / 100
      };
    }).sort((a, b) => a.distance_km - b.distance_km);
  }

  return filteredAgents.sort((a, b) => b.avg_rating - a.avg_rating);
}