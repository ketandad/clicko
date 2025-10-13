/**
 * Agent Reviews Screen
 * Displays all reviews for a specific agent with filtering and sorting options
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Image,
    Modal,
    Dimensions,
    TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import postServiceReviewService from '../services/postServiceReviewService';

const { width: screenWidth } = Dimensions.get('window');

const AgentReviewsScreen = ({ navigation, route }) => {
    const { agent } = route.params;
    
    // State management
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [reviews, setReviews] = useState([]);
    const [filteredReviews, setFilteredReviews] = useState([]);
    const [reputationMetrics, setReputationMetrics] = useState(null);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        hasMore: true,
        total: 0
    });
    
    // Filter and sort options
    const [filterOptions, setFilterOptions] = useState({
        rating: 'all', // all, 5, 4, 3, 2, 1
        sortBy: 'newest', // newest, oldest, highest_rated, lowest_rated, most_helpful
        searchText: ''
    });
    
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [selectedReview, setSelectedReview] = useState(null);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [votingReviews, setVotingReviews] = useState(new Set());

    useEffect(() => {
        loadAgentReviews();
        loadReputationMetrics();
    }, []);

    useEffect(() => {
        applyFiltersAndSort();
    }, [reviews, filterOptions]);

    const loadAgentReviews = async (page = 1, shouldAppend = false) => {
        try {
            if (page === 1) setLoading(true);
            
            const result = await postServiceReviewService.getAgentReviews(
                agent.id,
                page,
                pagination.limit
            );
            
            if (result.success) {
                const newReviews = shouldAppend 
                    ? [...reviews, ...result.reviews]
                    : result.reviews;
                
                setReviews(newReviews);
                setPagination(prev => ({
                    ...prev,
                    page: page,
                    hasMore: result.hasMore,
                    total: result.total
                }));
            } else {
                Alert.alert('Error', 'Failed to load reviews');
            }
        } catch (error) {
            console.error('Error loading agent reviews:', error);
            Alert.alert('Error', 'Failed to load reviews');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const loadReputationMetrics = async () => {
        try {
            const result = await postServiceReviewService.getAgentReputationMetrics(agent.id);
            if (result.success) {
                setReputationMetrics(result.metrics);
            }
        } catch (error) {
            console.error('Error loading reputation metrics:', error);
        }
    };

    const applyFiltersAndSort = () => {
        let filtered = [...reviews];
        
        // Apply rating filter
        if (filterOptions.rating !== 'all') {
            const targetRating = parseInt(filterOptions.rating);
            filtered = filtered.filter(review => 
                Math.floor(review.overall_rating) === targetRating
            );
        }
        
        // Apply search filter
        if (filterOptions.searchText.trim()) {
            const searchLower = filterOptions.searchText.toLowerCase();
            filtered = filtered.filter(review =>
                review.review_title?.toLowerCase().includes(searchLower) ||
                review.review_text?.toLowerCase().includes(searchLower) ||
                review.customer_name?.toLowerCase().includes(searchLower)
            );
        }
        
        // Apply sorting
        switch (filterOptions.sortBy) {
            case 'newest':
                filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                break;
            case 'oldest':
                filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                break;
            case 'highest_rated':
                filtered.sort((a, b) => b.overall_rating - a.overall_rating);
                break;
            case 'lowest_rated':
                filtered.sort((a, b) => a.overall_rating - b.overall_rating);
                break;
            case 'most_helpful':
                filtered.sort((a, b) => b.helpful_votes - a.helpful_votes);
                break;
        }
        
        setFilteredReviews(filtered);
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadAgentReviews(1, false);
        loadReputationMetrics();
    }, []);

    const loadMoreReviews = () => {
        if (pagination.hasMore && !loading) {
            loadAgentReviews(pagination.page + 1, true);
        }
    };

    const voteHelpful = async (reviewId, isHelpful) => {
        if (votingReviews.has(reviewId)) return;
        
        setVotingReviews(prev => new Set([...prev, reviewId]));
        
        try {
            const result = await postServiceReviewService.voteReviewHelpfulness(reviewId, isHelpful);
            
            if (result.success) {
                // Update the review in state
                setReviews(prevReviews =>
                    prevReviews.map(review =>
                        review.id === reviewId
                            ? {
                                ...review,
                                helpful_votes: result.helpfulVotes,
                                not_helpful_votes: result.notHelpfulVotes,
                                user_vote: isHelpful ? 'helpful' : 'not_helpful'
                            }
                            : review
                    )
                );
            } else {
                Alert.alert('Error', result.error || 'Failed to submit vote');
            }
        } catch (error) {
            console.error('Error voting on review:', error);
            Alert.alert('Error', 'Failed to submit vote');
        } finally {
            setVotingReviews(prev => {
                const newSet = new Set(prev);
                newSet.delete(reviewId);
                return newSet;
            });
        }
    };

    const reportReview = async (reviewId, reason) => {
        try {
            const result = await postServiceReviewService.reportReview(reviewId, reason);
            
            if (result.success) {
                Alert.alert('Report Submitted', 'Thank you for reporting this review. We will investigate it.');
            } else {
                Alert.alert('Error', result.error || 'Failed to report review');
            }
        } catch (error) {
            console.error('Error reporting review:', error);
            Alert.alert('Error', 'Failed to report review');
        }
    };

    const renderStarRating = (rating, size = 16) => {
        return (
            <View style={styles.starContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                        key={star}
                        name={star <= rating ? "star" : "star-outline"}
                        size={size}
                        color={star <= rating ? "#FFD700" : "#E0E0E0"}
                        style={styles.star}
                    />
                ))}
            </View>
        );
    };

    const renderAgentHeader = () => (
        <View style={styles.agentHeader}>
            <Image
                source={{ uri: agent.profile_photo_url || 'https://via.placeholder.com/80' }}
                style={styles.agentPhoto}
            />
            <View style={styles.agentInfo}>
                <Text style={styles.agentName}>{agent.name}</Text>
                <Text style={styles.agentCategory}>{agent.service_category}</Text>
                <View style={styles.agentRating}>
                    {renderStarRating(agent.avg_rating, 20)}
                    <Text style={styles.ratingText}>
                        {agent.avg_rating ? agent.avg_rating.toFixed(1) : 'No rating'}
                    </Text>
                    <Text style={styles.reviewCount}>
                        ({agent.total_ratings || 0} reviews)
                    </Text>
                </View>
            </View>
        </View>
    );

    const renderReputationMetrics = () => {
        if (!reputationMetrics) return null;
        
        return (
            <View style={styles.metricsContainer}>
                <Text style={styles.metricsTitle}>Performance Overview</Text>
                <View style={styles.metricsGrid}>
                    <View style={styles.metricItem}>
                        <Text style={styles.metricValue}>
                            {reputationMetrics.avg_service_quality_rating?.toFixed(1) || 'N/A'}
                        </Text>
                        <Text style={styles.metricLabel}>Service Quality</Text>
                    </View>
                    <View style={styles.metricItem}>
                        <Text style={styles.metricValue}>
                            {reputationMetrics.avg_punctuality_rating?.toFixed(1) || 'N/A'}
                        </Text>
                        <Text style={styles.metricLabel}>Punctuality</Text>
                    </View>
                    <View style={styles.metricItem}>
                        <Text style={styles.metricValue}>
                            {reputationMetrics.recommendation_percentage?.toFixed(0) || 0}%
                        </Text>
                        <Text style={styles.metricLabel}>Recommend</Text>
                    </View>
                    <View style={styles.metricItem}>
                        <Text style={styles.metricValue}>
                            {reputationMetrics.response_rate?.toFixed(0) || 0}%
                        </Text>
                        <Text style={styles.metricLabel}>Response Rate</Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderFilterBar = () => (
        <View style={styles.filterBar}>
            <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowFilterModal(true)}
            >
                <Ionicons name="filter" size={16} color={theme.colors.primary} />
                <Text style={styles.filterButtonText}>Filter & Sort</Text>
            </TouchableOpacity>
            
            <Text style={styles.resultCount}>
                {filteredReviews.length} of {reviews.length} reviews
            </Text>
        </View>
    );

    const renderReviewItem = ({ item: review }) => (
        <TouchableOpacity
            style={styles.reviewItem}
            onPress={() => {
                setSelectedReview(review);
                setShowReviewModal(true);
            }}
        >
            <View style={styles.reviewHeader}>
                <View style={styles.reviewerInfo}>
                    <Text style={styles.reviewerName}>
                        {review.customer_name || 'Anonymous Customer'}
                    </Text>
                    <Text style={styles.reviewDate}>
                        {new Date(review.created_at).toLocaleDateString()}
                    </Text>
                </View>
                {renderStarRating(review.overall_rating)}
            </View>
            
            {review.review_title && (
                <Text style={styles.reviewTitle}>{review.review_title}</Text>
            )}
            
            {review.review_text && (
                <Text style={styles.reviewText} numberOfLines={3}>
                    {review.review_text}
                </Text>
            )}
            
            <View style={styles.reviewFooter}>
                <View style={styles.reviewTags}>
                    {review.would_recommend && (
                        <View style={styles.recommendTag}>
                            <Ionicons name="checkmark-circle" size={12} color={theme.colors.success} />
                            <Text style={styles.recommendText}>Recommends</Text>
                        </View>
                    )}
                    {review.service_completed_on_time && (
                        <View style={styles.punctualTag}>
                            <Ionicons name="time" size={12} color={theme.colors.success} />
                            <Text style={styles.punctualText}>On Time</Text>
                        </View>
                    )}
                </View>
                
                <View style={styles.reviewActions}>
                    <TouchableOpacity
                        style={[styles.helpfulButton, review.user_vote === 'helpful' && styles.helpfulButtonActive]}
                        onPress={() => voteHelpful(review.id, true)}
                        disabled={votingReviews.has(review.id)}
                    >
                        <Ionicons 
                            name="thumbs-up" 
                            size={14} 
                            color={review.user_vote === 'helpful' ? theme.colors.surface : theme.colors.textSecondary} 
                        />
                        <Text style={[styles.helpfulText, review.user_vote === 'helpful' && styles.helpfulTextActive]}>
                            {review.helpful_votes || 0}
                        </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                        style={[styles.helpfulButton, review.user_vote === 'not_helpful' && styles.notHelpfulButtonActive]}
                        onPress={() => voteHelpful(review.id, false)}
                        disabled={votingReviews.has(review.id)}
                    >
                        <Ionicons 
                            name="thumbs-down" 
                            size={14} 
                            color={review.user_vote === 'not_helpful' ? theme.colors.surface : theme.colors.textSecondary} 
                        />
                        <Text style={[styles.helpfulText, review.user_vote === 'not_helpful' && styles.helpfulTextActive]}>
                            {review.not_helpful_votes || 0}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderFilterModal = () => (
        <Modal
            visible={showFilterModal}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowFilterModal(false)}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Filter & Sort Reviews</Text>
                    <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                        <Ionicons name="close" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                </View>
                
                <View style={styles.modalContent}>
                    {/* Search */}
                    <View style={styles.filterSection}>
                        <Text style={styles.filterSectionTitle}>Search Reviews</Text>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search in reviews..."
                            value={filterOptions.searchText}
                            onChangeText={(text) => setFilterOptions(prev => ({ ...prev, searchText: text }))}
                        />
                    </View>
                    
                    {/* Rating Filter */}
                    <View style={styles.filterSection}>
                        <Text style={styles.filterSectionTitle}>Filter by Rating</Text>
                        <View style={styles.ratingFilters}>
                            {['all', '5', '4', '3', '2', '1'].map((rating) => (
                                <TouchableOpacity
                                    key={rating}
                                    style={[styles.ratingFilter, 
                                        filterOptions.rating === rating && styles.ratingFilterActive]}
                                    onPress={() => setFilterOptions(prev => ({ ...prev, rating }))}
                                >
                                    <Text style={[styles.ratingFilterText,
                                        filterOptions.rating === rating && styles.ratingFilterTextActive]}>
                                        {rating === 'all' ? 'All Ratings' : `${rating} Stars`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                    
                    {/* Sort Options */}
                    <View style={styles.filterSection}>
                        <Text style={styles.filterSectionTitle}>Sort by</Text>
                        <View style={styles.sortOptions}>
                            {[
                                { key: 'newest', label: 'Newest First' },
                                { key: 'oldest', label: 'Oldest First' },
                                { key: 'highest_rated', label: 'Highest Rated' },
                                { key: 'lowest_rated', label: 'Lowest Rated' },
                                { key: 'most_helpful', label: 'Most Helpful' }
                            ].map((option) => (
                                <TouchableOpacity
                                    key={option.key}
                                    style={[styles.sortOption,
                                        filterOptions.sortBy === option.key && styles.sortOptionActive]}
                                    onPress={() => setFilterOptions(prev => ({ ...prev, sortBy: option.key }))}
                                >
                                    <Text style={[styles.sortOptionText,
                                        filterOptions.sortBy === option.key && styles.sortOptionTextActive]}>
                                        {option.label}
                                    </Text>
                                    {filterOptions.sortBy === option.key && (
                                        <Ionicons name="checkmark" size={16} color={theme.colors.primary} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                    
                    <TouchableOpacity
                        style={styles.applyFiltersButton}
                        onPress={() => setShowFilterModal(false)}
                    >
                        <Text style={styles.applyFiltersText}>Apply Filters</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );

    const renderReviewModal = () => {
        if (!selectedReview) return null;
        
        return (
            <Modal
                visible={showReviewModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowReviewModal(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Review Details</Text>
                        <View style={styles.modalHeaderActions}>
                            <TouchableOpacity
                                onPress={() => {
                                    Alert.alert(
                                        'Report Review',
                                        'Why are you reporting this review?',
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            { text: 'Inappropriate Content', onPress: () => reportReview(selectedReview.id, 'inappropriate') },
                                            { text: 'Fake Review', onPress: () => reportReview(selectedReview.id, 'fake') },
                                            { text: 'Spam', onPress: () => reportReview(selectedReview.id, 'spam') }
                                        ]
                                    );
                                }}
                            >
                                <Ionicons name="flag" size={20} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                                <Ionicons name="close" size={24} color={theme.colors.text} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    
                    <View style={styles.modalContent}>
                        {/* Review content here - detailed view */}
                        <Text>Detailed review view would go here</Text>
                    </View>
                </View>
            </Modal>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Ionicons name="star-outline" size={60} color={theme.colors.textSecondary} />
            <Text style={styles.emptyStateTitle}>No Reviews Yet</Text>
            <Text style={styles.emptyStateText}>
                This agent hasn't received any reviews yet. Be the first to book and review!
            </Text>
        </View>
    );

    const renderFooter = () => {
        if (!pagination.hasMore) return null;
        
        return (
            <View style={styles.footer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.footerText}>Loading more reviews...</Text>
            </View>
        );
    };

    if (loading && reviews.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading reviews...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Reviews</Text>
                <View style={styles.headerRight} />
            </View>
            
            <FlatList
                data={filteredReviews}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderReviewItem}
                ListHeaderComponent={() => (
                    <View>
                        {renderAgentHeader()}
                        {renderReputationMetrics()}
                        {renderFilterBar()}
                    </View>
                )}
                ListEmptyComponent={renderEmptyState}
                ListFooterComponent={renderFooter}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                onEndReached={loadMoreReviews}
                onEndReachedThreshold={0.1}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
            />
            
            {renderFilterModal()}
            {renderReviewModal()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        paddingTop: 50,
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    headerRight: {
        width: 24,
    },
    listContent: {
        flexGrow: 1,
    },
    agentHeader: {
        flexDirection: 'row',
        padding: 20,
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    agentPhoto: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },
    agentInfo: {
        marginLeft: 15,
        flex: 1,
        justifyContent: 'center',
    },
    agentName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    agentCategory: {
        fontSize: 14,
        color: theme.colors.primary,
        marginTop: 4,
    },
    agentRating: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    starContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    star: {
        marginRight: 2,
    },
    ratingText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginLeft: 8,
    },
    reviewCount: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginLeft: 4,
    },
    metricsContainer: {
        padding: 20,
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    metricsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 15,
    },
    metricsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    metricItem: {
        alignItems: 'center',
        flex: 1,
    },
    metricValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
    metricLabel: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginTop: 4,
        textAlign: 'center',
    },
    filterBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: theme.colors.background,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: theme.colors.primary,
        borderRadius: 20,
    },
    filterButtonText: {
        marginLeft: 6,
        fontSize: 14,
        color: theme.colors.primary,
    },
    resultCount: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    reviewItem: {
        backgroundColor: theme.colors.surface,
        marginHorizontal: 20,
        marginBottom: 15,
        padding: 20,
        borderRadius: 12,
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    reviewerInfo: {
        flex: 1,
    },
    reviewerName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
    reviewDate: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginTop: 2,
    },
    reviewTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 8,
    },
    reviewText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        lineHeight: 20,
        marginBottom: 12,
    },
    reviewFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    reviewTags: {
        flexDirection: 'row',
        flex: 1,
    },
    recommendTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.success + '20',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: 8,
    },
    recommendText: {
        fontSize: 10,
        color: theme.colors.success,
        marginLeft: 4,
    },
    punctualTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.success + '20',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    punctualText: {
        fontSize: 10,
        color: theme.colors.success,
        marginLeft: 4,
    },
    reviewActions: {
        flexDirection: 'row',
    },
    helpfulButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginLeft: 8,
        backgroundColor: theme.colors.background,
    },
    helpfulButtonActive: {
        backgroundColor: theme.colors.primary,
    },
    notHelpfulButtonActive: {
        backgroundColor: theme.colors.error,
    },
    helpfulText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginLeft: 4,
    },
    helpfulTextActive: {
        color: theme.colors.surface,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyStateTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginTop: 20,
        marginBottom: 10,
    },
    emptyStateText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    footer: {
        padding: 20,
        alignItems: 'center',
    },
    footerText: {
        marginTop: 10,
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: theme.colors.textSecondary,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 50,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    modalHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    modalContent: {
        flex: 1,
        padding: 20,
    },
    filterSection: {
        marginBottom: 25,
    },
    filterSectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 12,
    },
    searchInput: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: theme.colors.text,
        backgroundColor: theme.colors.surface,
    },
    ratingFilters: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    ratingFilter: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 20,
        backgroundColor: theme.colors.surface,
    },
    ratingFilterActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    ratingFilterText: {
        fontSize: 14,
        color: theme.colors.text,
    },
    ratingFilterTextActive: {
        color: theme.colors.surface,
    },
    sortOptions: {
        gap: 8,
    },
    sortOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: theme.colors.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    sortOptionActive: {
        borderColor: theme.colors.primary,
        backgroundColor: theme.colors.primary + '10',
    },
    sortOptionText: {
        fontSize: 16,
        color: theme.colors.text,
    },
    sortOptionTextActive: {
        color: theme.colors.primary,
        fontWeight: '600',
    },
    applyFiltersButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
    },
    applyFiltersText: {
        color: theme.colors.surface,
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default AgentReviewsScreen;