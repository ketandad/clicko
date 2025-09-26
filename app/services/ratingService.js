import config from '../config';
import { getToken } from './authService';

const { API_URL: API_BASE_URL } = config;

/**
 * Agent Rating Service
 * Handles rating and review operations for agents
 */

/**
 * Create a new rating for an agent
 * @param {Object} ratingData - Rating data object
 * @param {number} ratingData.agent_id - Agent ID
 * @param {number} ratingData.rating - Overall rating (1-5)
 * @param {string} ratingData.review_text - Review text
 * @param {number} ratingData.service_quality_rating - Service quality (1-5)
 * @param {number} ratingData.punctuality_rating - Punctuality rating (1-5)
 * @param {number} ratingData.professionalism_rating - Professionalism rating (1-5)
 * @param {number} ratingData.value_for_money_rating - Value rating (1-5)
 * @param {boolean} ratingData.would_recommend - Would recommend
 * @param {Array} ratingData.photos - Array of photo URLs
 * @returns {Promise<Object>} Created rating response
 */
export const createAgentRating = async (ratingData) => {
  try {
    console.log('📝 RatingService: Creating agent rating:', ratingData);
    
    const token = await getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${API_BASE_URL}/ratings/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ratingData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to create rating (${response.status})`);
    }

    const data = await response.json();
    console.log('✅ RatingService: Rating created successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ RatingService: Error creating rating:', error);
    throw error;
  }
};

/**
 * Get ratings for a specific agent
 * @param {number} agentId - Agent ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Number of ratings to fetch
 * @param {number} options.offset - Offset for pagination
 * @param {boolean} options.verified_only - Only verified ratings
 * @returns {Promise<Array>} Array of ratings
 */
export const getAgentRatings = async (agentId, options = {}) => {
  try {
    const {
      limit = 20,
      offset = 0,
      verified_only = false
    } = options;

    console.log(`🔍 RatingService: Fetching ratings for agent ${agentId}`);

    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      verified_only: verified_only.toString()
    });

    const response = await fetch(`${API_BASE_URL}/ratings/agent/${agentId}?${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to fetch ratings (${response.status})`);
    }

    const data = await response.json();
    console.log('✅ RatingService: Ratings fetched successfully:', data.length);
    return data;
  } catch (error) {
    console.error('❌ RatingService: Error fetching ratings:', error);
    throw error;
  }
};

/**
 * Get rating summary/aggregates for an agent
 * @param {number} agentId - Agent ID
 * @returns {Promise<Object>} Rating summary
 */
export const getAgentRatingSummary = async (agentId) => {
  try {
    console.log(`📊 RatingService: Fetching rating summary for agent ${agentId}`);

    const response = await fetch(`${API_BASE_URL}/ratings/agent/${agentId}/summary`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to fetch rating summary (${response.status})`);
    }

    const data = await response.json();
    console.log('✅ RatingService: Rating summary fetched successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ RatingService: Error fetching rating summary:', error);
    throw error;
  }
};

/**
 * Vote if a rating is helpful
 * @param {number} ratingId - Rating ID
 * @param {boolean} isHelpful - Whether the rating is helpful
 * @returns {Promise<Object>} Vote response
 */
export const voteRatingHelpful = async (ratingId, isHelpful) => {
  try {
    console.log(`👍 RatingService: Voting on rating ${ratingId} (helpful: ${isHelpful})`);
    
    const token = await getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${API_BASE_URL}/ratings/${ratingId}/helpful`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ is_helpful: isHelpful }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to vote on rating (${response.status})`);
    }

    const data = await response.json();
    console.log('✅ RatingService: Vote recorded successfully');
    return data;
  } catch (error) {
    console.error('❌ RatingService: Error voting on rating:', error);
    throw error;
  }
};

/**
 * Report a rating for inappropriate content
 * @param {number} ratingId - Rating ID
 * @param {string} reason - Reason for reporting
 * @param {string} description - Additional description
 * @returns {Promise<Object>} Report response
 */
export const reportRating = async (ratingId, reason, description = '') => {
  try {
    console.log(`🚨 RatingService: Reporting rating ${ratingId} for: ${reason}`);
    
    const token = await getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${API_BASE_URL}/ratings/${ratingId}/report`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason, description }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to report rating (${response.status})`);
    }

    const data = await response.json();
    console.log('✅ RatingService: Rating reported successfully');
    return data;
  } catch (error) {
    console.error('❌ RatingService: Error reporting rating:', error);
    throw error;
  }
};

/**
 * Calculate rating statistics from ratings array
 * @param {Array} ratings - Array of rating objects
 * @returns {Object} Rating statistics
 */
export const calculateRatingStats = (ratings) => {
  if (!ratings || ratings.length === 0) {
    return {
      totalRatings: 0,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      recommendationPercentage: 0
    };
  }

  const totalRatings = ratings.length;
  const totalScore = ratings.reduce((sum, rating) => sum + rating.rating, 0);
  const averageRating = totalScore / totalRatings;

  const ratingDistribution = ratings.reduce((dist, rating) => {
    dist[rating.rating] = (dist[rating.rating] || 0) + 1;
    return dist;
  }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

  const recommendCount = ratings.filter(rating => rating.would_recommend).length;
  const recommendationPercentage = (recommendCount / totalRatings) * 100;

  return {
    totalRatings,
    averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
    ratingDistribution,
    recommendationPercentage: Math.round(recommendationPercentage)
  };
};

/**
 * Format rating for display
 * @param {number} rating - Numeric rating
 * @returns {string} Formatted rating string
 */
export const formatRating = (rating) => {
  if (!rating || rating === 0) return 'No ratings';
  return rating.toFixed(1);
};

/**
 * Get rating color based on score
 * @param {number} rating - Rating score
 * @returns {string} Color code
 */
export const getRatingColor = (rating) => {
  if (rating >= 4.5) return '#4CAF50'; // Green
  if (rating >= 4.0) return '#FF9800'; // Orange  
  if (rating >= 3.0) return '#FFC107'; // Yellow
  if (rating >= 2.0) return '#FF5722'; // Red-Orange
  return '#F44336'; // Red
};

/**
 * Generate star array for rating display
 * @param {number} rating - Rating score
 * @returns {Array} Array of star states ['full', 'half', 'empty']
 */
export const generateStarArray = (rating) => {
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.5;
  
  // Add full stars
  for (let i = 0; i < fullStars; i++) {
    stars.push('full');
  }
  
  // Add half star if needed
  if (hasHalfStar) {
    stars.push('half');
  }
  
  // Fill remaining with empty stars
  while (stars.length < 5) {
    stars.push('empty');
  }
  
  return stars;
};