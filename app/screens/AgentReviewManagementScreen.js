/**
 * Agent Review Management Screen
 * Allows agents to view and respond to their reviews
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
    TextInput,
    Modal,
    ScrollView,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import postServiceReviewService from '../services/postServiceReviewService';
import { useAuth } from '../contexts/AuthContext';

const AgentReviewManagementScreen = ({ navigation }) => {
    const { user } = useAuth();
    
    // State management
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [reviews, setReviews] = useState([]);
    const [reputationMetrics, setReputationMetrics] = useState(null);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        hasMore: true,
        total: 0
    });
    
    // Filter options
    const [filter, setFilter] = useState('all'); // all, responded, not_responded, recent
    
    // Response modal
    const [showResponseModal, setShowResponseModal] = useState(false);
    const [selectedReview, setSelectedReview] = useState(null);
    const [responseText, setResponseText] = useState('');
    const [submittingResponse, setSubmittingResponse] = useState(false);

    useEffect(() => {
        if (user && user.id) {
            loadAgentReviews();
            loadReputationMetrics();
        }
    }, [user]);

    const loadAgentReviews = async (page = 1, shouldAppend = false) => {
        try {
            if (page === 1) setLoading(true);
            
            const result = await postServiceReviewService.getAgentReviews(
                user.id,
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
            const result = await postServiceReviewService.getAgentReputationMetrics(user.id);
            if (result.success) {
                setReputationMetrics(result.metrics);
            }
        } catch (error) {
            console.error('Error loading reputation metrics:', error);
        }
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

    const filterReviews = () => {
        switch (filter) {
            case 'responded':
                return reviews.filter(review => review.agent_response);
            case 'not_responded':
                return reviews.filter(review => !review.agent_response);
            case 'recent':
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return reviews.filter(review => new Date(review.created_at) > weekAgo);
            default:
                return reviews;
        }
    };

    const openResponseModal = (review) => {
        setSelectedReview(review);
        setResponseText(review.agent_response || '');
        setShowResponseModal(true);
    };

    const submitResponse = async () => {
        if (!responseText.trim()) {
            Alert.alert('Error', 'Please enter a response');
            return;
        }

        setSubmittingResponse(true);
        
        try {
            const result = await postServiceReviewService.respondToReview(
                selectedReview.id,
                responseText.trim()
            );
            
            if (result.success) {
                // Update the review in state
                setReviews(prevReviews =>
                    prevReviews.map(review =>
                        review.id === selectedReview.id
                            ? { ...review, agent_response: responseText.trim(), response_date: new Date().toISOString() }
                            : review
                    )
                );
                
                setShowResponseModal(false);
                setResponseText('');
                setSelectedReview(null);
                
                Alert.alert('Success', 'Your response has been posted successfully');
            } else {
                Alert.alert('Error', result.error || 'Failed to submit response');
            }
        } catch (error) {
            console.error('Error submitting response:', error);
            Alert.alert('Error', 'Failed to submit response');
        } finally {
            setSubmittingResponse(false);
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
                <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
            </View>
        );
    };

    const renderMetricsOverview = () => {
        if (!reputationMetrics) return null;
        
        return (
            <View style={styles.metricsContainer}>
                <Text style={styles.metricsTitle}>Your Performance Overview</Text>
                
                <View style={styles.mainMetrics}>
                    <View style={styles.mainMetricItem}>
                        <Text style={styles.mainMetricValue}>
                            {reputationMetrics.avg_overall_rating?.toFixed(1) || 'N/A'}
                        </Text>
                        <Text style={styles.mainMetricLabel}>Overall Rating</Text>
                        {renderStarRating(reputationMetrics.avg_overall_rating || 0, 14)}
                    </View>
                    
                    <View style={styles.mainMetricItem}>
                        <Text style={styles.mainMetricValue}>
                            {reputationMetrics.total_reviews || 0}
                        </Text>
                        <Text style={styles.mainMetricLabel}>Total Reviews</Text>
                    </View>
                    
                    <View style={styles.mainMetricItem}>
                        <Text style={styles.mainMetricValue}>
                            {reputationMetrics.recommendation_percentage?.toFixed(0) || 0}%
                        </Text>
                        <Text style={styles.mainMetricLabel}>Recommend Rate</Text>
                    </View>
                </View>
                
                <View style={styles.detailedMetrics}>
                    <View style={styles.metricRow}>
                        <Text style={styles.metricLabel}>Service Quality</Text>
                        <View style={styles.metricValue}>
                            {renderStarRating(reputationMetrics.avg_service_quality_rating || 0, 12)}
                        </View>
                    </View>
                    
                    <View style={styles.metricRow}>
                        <Text style={styles.metricLabel}>Punctuality</Text>
                        <View style={styles.metricValue}>
                            {renderStarRating(reputationMetrics.avg_punctuality_rating || 0, 12)}
                        </View>
                    </View>
                    
                    <View style={styles.metricRow}>
                        <Text style={styles.metricLabel}>Professionalism</Text>
                        <View style={styles.metricValue}>
                            {renderStarRating(reputationMetrics.avg_professionalism_rating || 0, 12)}
                        </View>
                    </View>
                    
                    <View style={styles.metricRow}>
                        <Text style={styles.metricLabel}>Communication</Text>
                        <View style={styles.metricValue}>
                            {renderStarRating(reputationMetrics.avg_communication_rating || 0, 12)}
                        </View>
                    </View>
                </View>
                
                <View style={styles.responseStats}>
                    <Text style={styles.responseStatsTitle}>Response Statistics</Text>
                    <View style={styles.responseStatsRow}>
                        <Text style={styles.responseStatsText}>
                            Response Rate: {reputationMetrics.response_rate?.toFixed(0) || 0}%
                        </Text>
                        <Text style={styles.responseStatsText}>
                            Avg Response Time: {reputationMetrics.avg_response_time_hours ? 
                                `${reputationMetrics.avg_response_time_hours.toFixed(1)}h` : 'N/A'}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderFilterTabs = () => (
        <View style={styles.filterTabs}>
            {[
                { key: 'all', label: 'All', count: reviews.length },
                { key: 'not_responded', label: 'Need Response', count: reviews.filter(r => !r.agent_response).length },
                { key: 'responded', label: 'Responded', count: reviews.filter(r => r.agent_response).length },
                { key: 'recent', label: 'Recent', count: reviews.filter(r => {
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return new Date(r.created_at) > weekAgo;
                }).length }
            ].map((tab) => (
                <TouchableOpacity
                    key={tab.key}
                    style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
                    onPress={() => setFilter(tab.key)}
                >
                    <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
                        {tab.label}
                    </Text>
                    <View style={[styles.filterTabBadge, filter === tab.key && styles.filterTabBadgeActive]}>
                        <Text style={[styles.filterTabBadgeText, filter === tab.key && styles.filterTabBadgeTextActive]}>
                            {tab.count}
                        </Text>
                    </View>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderReviewItem = ({ item: review }) => (
        <View style={styles.reviewItem}>
            <View style={styles.reviewHeader}>
                <View style={styles.reviewInfo}>
                    <Text style={styles.customerName}>
                        {review.customer_name || 'Anonymous Customer'}
                    </Text>
                    <Text style={styles.reviewDate}>
                        {new Date(review.created_at).toLocaleDateString()}
                    </Text>
                </View>
                
                <View style={styles.reviewRating}>
                    {renderStarRating(review.overall_rating)}
                </View>
                
                {!review.agent_response && (
                    <View style={styles.responseNeededBadge}>
                        <Text style={styles.responseNeededText}>Response Needed</Text>
                    </View>
                )}
            </View>
            
            {review.review_title && (
                <Text style={styles.reviewTitle}>{review.review_title}</Text>
            )}
            
            {review.review_text && (
                <Text style={styles.reviewText}>{review.review_text}</Text>
            )}
            
            <View style={styles.reviewDetails}>
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
                
                <View style={styles.helpfulnessStats}>
                    <Text style={styles.helpfulnessText}>
                        {review.helpful_votes || 0} found helpful
                    </Text>
                </View>
            </View>
            
            {review.agent_response && (
                <View style={styles.agentResponse}>
                    <View style={styles.responseHeader}>
                        <Ionicons name="person-circle" size={16} color={theme.colors.primary} />
                        <Text style={styles.responseLabel}>Your Response</Text>
                        <Text style={styles.responseDate}>
                            {new Date(review.response_date).toLocaleDateString()}
                        </Text>
                    </View>
                    <Text style={styles.responseText}>{review.agent_response}</Text>
                </View>
            )}
            
            <View style={styles.reviewActions}>
                <TouchableOpacity
                    style={styles.responseButton}
                    onPress={() => openResponseModal(review)}
                >
                    <Ionicons 
                        name={review.agent_response ? "create" : "chatbubble"} 
                        size={16} 
                        color={theme.colors.primary} 
                    />
                    <Text style={styles.responseButtonText}>
                        {review.agent_response ? 'Edit Response' : 'Respond'}
                    </Text>
                </TouchableOpacity>
                
                <View style={styles.reviewStats}>
                    <View style={styles.statItem}>
                        <Ionicons name="eye" size={14} color={theme.colors.textSecondary} />
                        <Text style={styles.statText}>{review.view_count || 0}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Ionicons name="thumbs-up" size={14} color={theme.colors.textSecondary} />
                        <Text style={styles.statText}>{review.helpful_votes || 0}</Text>
                    </View>
                </View>
            </View>
        </View>
    );

    const renderResponseModal = () => (
        <Modal
            visible={showResponseModal}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowResponseModal(false)}
        >
            <KeyboardAvoidingView 
                style={styles.modalContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                        {selectedReview?.agent_response ? 'Edit Response' : 'Respond to Review'}
                    </Text>
                    <TouchableOpacity onPress={() => setShowResponseModal(false)}>
                        <Ionicons name="close" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.modalContent}>
                    {selectedReview && (
                        <>
                            <View style={styles.originalReview}>
                                <Text style={styles.originalReviewLabel}>Customer Review</Text>
                                <View style={styles.originalReviewContent}>
                                    <View style={styles.originalReviewHeader}>
                                        <Text style={styles.originalCustomerName}>
                                            {selectedReview.customer_name || 'Anonymous Customer'}
                                        </Text>
                                        {renderStarRating(selectedReview.overall_rating)}
                                    </View>
                                    
                                    {selectedReview.review_title && (
                                        <Text style={styles.originalReviewTitle}>
                                            {selectedReview.review_title}
                                        </Text>
                                    )}
                                    
                                    {selectedReview.review_text && (
                                        <Text style={styles.originalReviewText}>
                                            {selectedReview.review_text}
                                        </Text>
                                    )}
                                </View>
                            </View>
                            
                            <View style={styles.responseSection}>
                                <Text style={styles.responseSectionLabel}>Your Response</Text>
                                <TextInput
                                    style={styles.responseInput}
                                    placeholder="Write your response to this review..."
                                    value={responseText}
                                    onChangeText={setResponseText}
                                    multiline
                                    numberOfLines={6}
                                    maxLength={1000}
                                    textAlignVertical="top"
                                />
                                
                                <Text style={styles.characterCount}>
                                    {responseText.length}/1000 characters
                                </Text>
                                
                                <View style={styles.responseGuidelines}>
                                    <Text style={styles.guidelinesTitle}>Response Guidelines:</Text>
                                    <Text style={styles.guidelineItem}>• Thank the customer for their feedback</Text>
                                    <Text style={styles.guidelineItem}>• Address specific concerns mentioned</Text>
                                    <Text style={styles.guidelineItem}>• Keep your response professional and courteous</Text>
                                    <Text style={styles.guidelineItem}>• Avoid sharing private information</Text>
                                </View>
                            </View>
                            
                            <TouchableOpacity
                                style={[styles.submitResponseButton, 
                                    (!responseText.trim() || submittingResponse) && styles.submitResponseButtonDisabled]}
                                onPress={submitResponse}
                                disabled={!responseText.trim() || submittingResponse}
                            >
                                {submittingResponse ? (
                                    <ActivityIndicator color={theme.colors.surface} />
                                ) : (
                                    <Text style={styles.submitResponseText}>
                                        {selectedReview?.agent_response ? 'Update Response' : 'Post Response'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </Modal>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Ionicons name="star-outline" size={60} color={theme.colors.textSecondary} />
            <Text style={styles.emptyStateTitle}>No Reviews Yet</Text>
            <Text style={styles.emptyStateText}>
                Complete more bookings to start receiving customer reviews and build your reputation.
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

    const filteredReviews = filterReviews();

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
                <Text style={styles.headerTitle}>My Reviews</Text>
                <TouchableOpacity onPress={onRefresh}>
                    <Ionicons name="refresh" size={24} color={theme.colors.text} />
                </TouchableOpacity>
            </View>
            
            <FlatList
                data={filteredReviews}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderReviewItem}
                ListHeaderComponent={() => (
                    <View>
                        {renderMetricsOverview()}
                        {renderFilterTabs()}
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
            
            {renderResponseModal()}
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
    listContent: {
        flexGrow: 1,
    },
    metricsContainer: {
        padding: 20,
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    metricsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 15,
    },
    mainMetrics: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    mainMetricItem: {
        alignItems: 'center',
        flex: 1,
    },
    mainMetricValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
    mainMetricLabel: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginTop: 4,
        textAlign: 'center',
    },
    detailedMetrics: {
        marginBottom: 15,
    },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    metricLabel: {
        fontSize: 14,
        color: theme.colors.text,
    },
    metricValue: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    starContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    star: {
        marginRight: 1,
    },
    ratingText: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.text,
        marginLeft: 6,
    },
    responseStats: {
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    responseStatsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 8,
    },
    responseStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    responseStatsText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    filterTabs: {
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    filterTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 20,
        marginHorizontal: 2,
    },
    filterTabActive: {
        backgroundColor: theme.colors.primary + '20',
    },
    filterTabText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginRight: 4,
    },
    filterTabTextActive: {
        color: theme.colors.primary,
        fontWeight: '600',
    },
    filterTabBadge: {
        backgroundColor: theme.colors.textSecondary + '20',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 20,
        alignItems: 'center',
    },
    filterTabBadgeActive: {
        backgroundColor: theme.colors.primary,
    },
    filterTabBadgeText: {
        fontSize: 10,
        color: theme.colors.textSecondary,
        fontWeight: 'bold',
    },
    filterTabBadgeTextActive: {
        color: theme.colors.surface,
    },
    reviewItem: {
        backgroundColor: theme.colors.surface,
        marginHorizontal: 20,
        marginVertical: 10,
        padding: 20,
        borderRadius: 12,
    },
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    reviewInfo: {
        flex: 1,
    },
    customerName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
    reviewDate: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginTop: 2,
    },
    reviewRating: {
        marginLeft: 10,
    },
    responseNeededBadge: {
        backgroundColor: theme.colors.warning + '20',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 10,
    },
    responseNeededText: {
        fontSize: 10,
        color: theme.colors.warning,
        fontWeight: '600',
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
    reviewDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
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
    helpfulnessStats: {
        alignItems: 'flex-end',
    },
    helpfulnessText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    agentResponse: {
        backgroundColor: theme.colors.primary + '10',
        padding: 15,
        borderRadius: 8,
        marginBottom: 12,
    },
    responseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    responseLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.primary,
        marginLeft: 6,
        flex: 1,
    },
    responseDate: {
        fontSize: 10,
        color: theme.colors.textSecondary,
    },
    responseText: {
        fontSize: 14,
        color: theme.colors.text,
        lineHeight: 18,
    },
    reviewActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    responseButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: theme.colors.primary + '20',
        borderRadius: 20,
    },
    responseButtonText: {
        fontSize: 14,
        color: theme.colors.primary,
        marginLeft: 6,
        fontWeight: '600',
    },
    reviewStats: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 15,
    },
    statText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginLeft: 4,
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
        backgroundColor: theme.colors.surface,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
        flex: 1,
        marginRight: 20,
    },
    modalContent: {
        flex: 1,
        padding: 20,
    },
    originalReview: {
        marginBottom: 25,
    },
    originalReviewLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 10,
    },
    originalReviewContent: {
        backgroundColor: theme.colors.surface,
        padding: 15,
        borderRadius: 12,
    },
    originalReviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    originalCustomerName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        flex: 1,
    },
    originalReviewTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 8,
    },
    originalReviewText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        lineHeight: 20,
    },
    responseSection: {
        marginBottom: 25,
    },
    responseSectionLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 10,
    },
    responseInput: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 12,
        padding: 15,
        fontSize: 16,
        color: theme.colors.text,
        backgroundColor: theme.colors.surface,
        textAlignVertical: 'top',
        minHeight: 120,
    },
    characterCount: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        textAlign: 'right',
        marginTop: 8,
        marginBottom: 20,
    },
    responseGuidelines: {
        backgroundColor: theme.colors.background,
        padding: 15,
        borderRadius: 8,
        marginBottom: 20,
    },
    guidelinesTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 8,
    },
    guidelineItem: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginBottom: 4,
        lineHeight: 16,
    },
    submitResponseButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 40,
    },
    submitResponseButtonDisabled: {
        backgroundColor: theme.colors.textSecondary,
    },
    submitResponseText: {
        color: theme.colors.surface,
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default AgentReviewManagementScreen;