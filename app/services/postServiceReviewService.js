/**
 * Post-Service Review Service
 * Frontend service for comprehensive review and rating system
 */

import { API_BASE_URL } from '../config';

class PostServiceReviewService {
    constructor() {
        this.baseURL = `${API_BASE_URL}/reviews`;
    }

    /**
     * Create a comprehensive post-service review
     */
    async submitReview(reviewData) {
        try {
            const response = await fetch(`${this.baseURL}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify(reviewData)
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.detail || 'Failed to submit review');
            }

            return {
                success: true,
                reviewUuid: result.review_uuid,
                message: result.message
            };

        } catch (error) {
            console.error('Error submitting review:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get review invitation for a completed booking
     */
    async getReviewInvitation(bookingId) {
        try {
            const response = await fetch(`${this.baseURL}/invitation/${bookingId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.detail || 'Failed to get review invitation');
            }

            return {
                success: true,
                invitation: result.invitation,
                canReview: result.can_review,
                expiresAt: result.expires_at
            };

        } catch (error) {
            console.error('Error getting review invitation:', error);
            return {
                success: false,
                error: error.message,
                canReview: false
            };
        }
    }

    /**
     * Get agent's reviews with pagination and filters
     */
    async getAgentReviews(agentId, options = {}) {
        try {
            const params = new URLSearchParams({
                agent_id: agentId.toString(),
                limit: options.limit || 20,
                offset: options.offset || 0,
                verified_only: options.verifiedOnly || false,
                featured_only: options.featuredOnly || false,
                min_rating: options.minRating || 1,
                sort_by: options.sortBy || 'newest'
            });

            const response = await fetch(`${this.baseURL}/agent-reviews?${params}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.detail || 'Failed to get agent reviews');
            }

            return {
                success: true,
                reviews: result.reviews,
                totalCount: result.total_count,
                averageRating: result.average_rating,
                ratingDistribution: result.rating_distribution,
                pagination: result.pagination
            };

        } catch (error) {
            console.error('Error getting agent reviews:', error);
            return {
                success: false,
                error: error.message,
                reviews: []
            };
        }
    }

    /**
     * Get agent's reputation metrics and statistics
     */
    async getAgentReputationMetrics(agentId) {
        try {
            const response = await fetch(`${this.baseURL}/agent/${agentId}/reputation`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.detail || 'Failed to get reputation metrics');
            }

            return {
                success: true,
                metrics: result.metrics
            };

        } catch (error) {
            console.error('Error getting reputation metrics:', error);
            return {
                success: false,
                error: error.message,
                metrics: null
            };
        }
    }

    /**
     * Submit agent response to a review
     */
    async submitAgentResponse(reviewUuid, responseText) {
        try {
            const response = await fetch(`${this.baseURL}/${reviewUuid}/agent-response`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify({
                    response_text: responseText
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.detail || 'Failed to submit response');
            }

            return {
                success: true,
                message: result.message
            };

        } catch (error) {
            console.error('Error submitting agent response:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Vote on review helpfulness
     */
    async voteOnReview(reviewUuid, isHelpful, voteReason = null) {
        try {
            const response = await fetch(`${this.baseURL}/${reviewUuid}/vote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify({
                    is_helpful: isHelpful,
                    vote_reason: voteReason
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.detail || 'Failed to vote on review');
            }

            return {
                success: true,
                message: result.message,
                updatedVotes: result.updated_votes
            };

        } catch (error) {
            console.error('Error voting on review:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Report inappropriate review
     */
    async reportReview(reviewUuid, reportData) {
        try {
            const response = await fetch(`${this.baseURL}/${reviewUuid}/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify(reportData)
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.detail || 'Failed to report review');
            }

            return {
                success: true,
                reportUuid: result.report_uuid,
                message: result.message
            };

        } catch (error) {
            console.error('Error reporting review:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get customer's submitted reviews
     */
    async getCustomerReviews(customerId, options = {}) {
        try {
            const params = new URLSearchParams({
                customer_id: customerId.toString(),
                limit: options.limit || 20,
                offset: options.offset || 0,
                include_drafts: options.includeDrafts || false
            });

            const response = await fetch(`${this.baseURL}/customer-reviews?${params}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.detail || 'Failed to get customer reviews');
            }

            return {
                success: true,
                reviews: result.reviews,
                totalCount: result.total_count,
                pagination: result.pagination
            };

        } catch (error) {
            console.error('Error getting customer reviews:', error);
            return {
                success: false,
                error: error.message,
                reviews: []
            };
        }
    }

    /**
     * Check if customer can review a booking
     */
    async canReviewBooking(bookingId) {
        try {
            const response = await fetch(`${this.baseURL}/can-review/${bookingId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            const result = await response.json();
            
            return {
                success: true,
                canReview: result.can_review,
                reason: result.reason,
                reviewExists: result.review_exists,
                bookingStatus: result.booking_status
            };

        } catch (error) {
            console.error('Error checking review eligibility:', error);
            return {
                success: false,
                canReview: false,
                error: error.message
            };
        }
    }

    // Utility methods

    /**
     * Get auth token from storage
     */
    getAuthToken() {
        // Implement based on your auth system
        return localStorage.getItem('auth_token') || null;
    }

    /**
     * Format rating for display
     */
    formatRating(rating) {
        if (!rating) return 'No rating';
        return rating.toFixed(1);
    }

    /**
     * Get star rating display
     */
    getStarRating(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = (rating % 1) >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        
        return {
            full: fullStars,
            half: hasHalfStar ? 1 : 0,
            empty: emptyStars,
            rating: rating
        };
    }

    /**
     * Calculate overall rating from category ratings
     */
    calculateOverallRating(categoryRatings) {
        const validRatings = Object.values(categoryRatings).filter(rating => 
            rating !== null && rating !== undefined && rating > 0
        );
        
        if (validRatings.length === 0) return 0;
        
        const sum = validRatings.reduce((total, rating) => total + rating, 0);
        return Math.round((sum / validRatings.length) * 10) / 10; // Round to 1 decimal
    }

    /**
     * Get review summary text
     */
    getReviewSummary(reviewCount, averageRating) {
        if (reviewCount === 0) {
            return 'No reviews yet';
        }

        const ratingText = this.formatRating(averageRating);
        const reviewText = reviewCount === 1 ? 'review' : 'reviews';
        
        return `${ratingText} stars (${reviewCount} ${reviewText})`;
    }

    /**
     * Get time since review
     */
    getTimeSinceReview(reviewDate) {
        const now = new Date();
        const review = new Date(reviewDate);
        const diffTime = Math.abs(now - review);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            return '1 day ago';
        } else if (diffDays < 30) {
            return `${diffDays} days ago`;
        } else if (diffDays < 365) {
            const months = Math.floor(diffDays / 30);
            return months === 1 ? '1 month ago' : `${months} months ago`;
        } else {
            const years = Math.floor(diffDays / 365);
            return years === 1 ? '1 year ago' : `${years} years ago`;
        }
    }

    /**
     * Validate review data before submission
     */
    validateReviewData(reviewData) {
        const errors = [];
        
        if (!reviewData.overall_rating || reviewData.overall_rating < 1 || reviewData.overall_rating > 5) {
            errors.push('Overall rating is required and must be between 1-5');
        }
        
        if (reviewData.review_text && reviewData.review_text.length < 10) {
            errors.push('Review text must be at least 10 characters long');
        }
        
        if (reviewData.review_title && reviewData.review_title.length > 200) {
            errors.push('Review title must be less than 200 characters');
        }
        
        if (reviewData.review_text && reviewData.review_text.length > 2000) {
            errors.push('Review text must be less than 2000 characters');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Get review reminder notifications status
     */
    async getReviewReminders(customerId) {
        try {
            const response = await fetch(`${this.baseURL}/reminders/${customerId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.detail || 'Failed to get review reminders');
            }

            return {
                success: true,
                pendingReviews: result.pending_reviews,
                totalPending: result.total_pending
            };

        } catch (error) {
            console.error('Error getting review reminders:', error);
            return {
                success: false,
                error: error.message,
                pendingReviews: []
            };
        }
    }
}

export default new PostServiceReviewService();