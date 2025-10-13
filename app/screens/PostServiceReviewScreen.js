/**
 * Post-Service Review Screen
 * Comprehensive review submission interface after service completion
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    TextInput,
    Image,
    ActivityIndicator,
    Modal,
    Dimensions,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import postServiceReviewService from '../services/postServiceReviewService';

const { width: screenWidth } = Dimensions.get('window');

const PostServiceReviewScreen = ({ navigation, route }) => {
    const { booking, agent } = route.params;
    
    // State management
    const [loading, setLoading] = useState(false);
    const [canReview, setCanReview] = useState(true);
    const [reviewData, setReviewData] = useState({
        booking_id: booking.id,
        customer_id: booking.user_id,
        agent_id: booking.agent_id,
        overall_rating: 0,
        service_quality_rating: 0,
        punctuality_rating: 0,
        professionalism_rating: 0,
        value_for_money_rating: 0,
        communication_rating: 0,
        cleanliness_rating: 0,
        review_title: '',
        review_text: '',
        would_recommend: true,
        service_completed_on_time: true,
        service_met_expectations: true,
        agent_was_prepared: true,
        customer_name: ''
    });
    
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [currentRatingCategory, setCurrentRatingCategory] = useState('');
    const [submissionStatus, setSubmissionStatus] = useState('draft'); // draft, submitting, submitted

    useEffect(() => {
        checkReviewEligibility();
    }, []);

    const checkReviewEligibility = async () => {
        setLoading(true);
        try {
            const result = await postServiceReviewService.canReviewBooking(booking.id);
            
            if (!result.canReview) {
                Alert.alert(
                    'Cannot Submit Review',
                    result.reason || 'You cannot review this booking at this time',
                    [
                        { text: 'OK', onPress: () => navigation.goBack() }
                    ]
                );
                setCanReview(false);
            }
        } catch (error) {
            console.error('Error checking review eligibility:', error);
        } finally {
            setLoading(false);
        }
    };

    const submitReview = async () => {
        try {
            // Validate review data
            const validation = postServiceReviewService.validateReviewData(reviewData);
            if (!validation.isValid) {
                Alert.alert('Review Incomplete', validation.errors.join('\n'));
                return;
            }

            setSubmissionStatus('submitting');
            
            const result = await postServiceReviewService.submitReview(reviewData);
            
            if (result.success) {
                setSubmissionStatus('submitted');
                Alert.alert(
                    'Review Submitted!',
                    'Thank you for your feedback. Your review helps other customers make informed decisions.',
                    [
                        { 
                            text: 'OK', 
                            onPress: () => navigation.navigate('MyBookings')
                        }
                    ]
                );
            } else {
                setSubmissionStatus('draft');
                Alert.alert('Submission Failed', result.error);
            }
        } catch (error) {
            setSubmissionStatus('draft');
            Alert.alert('Error', 'Failed to submit review. Please try again.');
            console.error('Review submission error:', error);
        }
    };

    const updateRating = (category, rating) => {
        setReviewData(prev => ({
            ...prev,
            [category]: rating
        }));
        
        // Auto-calculate overall rating based on category ratings
        if (category !== 'overall_rating') {
            const categoryRatings = {
                service_quality_rating: category === 'service_quality_rating' ? rating : prev.service_quality_rating,
                punctuality_rating: category === 'punctuality_rating' ? rating : prev.punctuality_rating,
                professionalism_rating: category === 'professionalism_rating' ? rating : prev.professionalism_rating,
                value_for_money_rating: category === 'value_for_money_rating' ? rating : prev.value_for_money_rating,
                communication_rating: category === 'communication_rating' ? rating : prev.communication_rating,
                cleanliness_rating: category === 'cleanliness_rating' ? rating : prev.cleanliness_rating
            };
            
            const overallRating = postServiceReviewService.calculateOverallRating(categoryRatings);
            setReviewData(prev => ({ ...prev, overall_rating: overallRating }));
        }
    };

    const openRatingModal = (category, categoryTitle) => {
        setCurrentRatingCategory({ key: category, title: categoryTitle });
        setShowRatingModal(true);
    };

    const renderStarRating = (rating, onRatingPress, size = 30, readonly = false) => {
        return (
            <View style={styles.starContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                        key={star}
                        onPress={() => !readonly && onRatingPress(star)}
                        disabled={readonly}
                    >
                        <Ionicons
                            name={star <= rating ? "star" : "star-outline"}
                            size={size}
                            color={star <= rating ? "#FFD700" : "#E0E0E0"}
                            style={styles.star}
                        />
                    </TouchableOpacity>
                ))}
                <Text style={styles.ratingText}>{rating > 0 ? rating.toFixed(1) : 'Rate'}</Text>
            </View>
        );
    };

    const renderServiceHeader = () => (
        <View style={styles.serviceHeader}>
            <Image
                source={{ uri: agent.profile_photo_url || 'https://via.placeholder.com/60' }}
                style={styles.agentPhoto}
            />
            <View style={styles.serviceInfo}>
                <Text style={styles.agentName}>{agent.name}</Text>
                <Text style={styles.serviceCategory}>{booking.service_category}</Text>
                <Text style={styles.serviceDate}>
                    {new Date(booking.completed_at).toLocaleDateString()}
                </Text>
                <View style={styles.existingRating}>
                    {renderStarRating(agent.avg_rating, () => {}, 20, true)}
                    <Text style={styles.existingRatingText}>({agent.total_ratings} reviews)</Text>
                </View>
            </View>
        </View>
    );

    const renderOverallRating = () => (
        <View style={styles.ratingSection}>
            <Text style={styles.sectionTitle}>Overall Experience</Text>
            <View style={styles.overallRatingContainer}>
                {renderStarRating(
                    reviewData.overall_rating,
                    (rating) => updateRating('overall_rating', rating),
                    40
                )}
            </View>
            <Text style={styles.ratingDescription}>
                {reviewData.overall_rating === 0 && "Tap to rate your overall experience"}
                {reviewData.overall_rating === 1 && "Poor - Very unsatisfied"}
                {reviewData.overall_rating === 2 && "Fair - Somewhat unsatisfied"}
                {reviewData.overall_rating === 3 && "Good - Satisfied"}
                {reviewData.overall_rating === 4 && "Very Good - Very satisfied"}
                {reviewData.overall_rating === 5 && "Excellent - Extremely satisfied"}
            </Text>
        </View>
    );

    const renderCategoryRatings = () => {
        const categories = [
            { key: 'service_quality_rating', title: 'Service Quality', icon: 'construct' },
            { key: 'punctuality_rating', title: 'Punctuality', icon: 'time' },
            { key: 'professionalism_rating', title: 'Professionalism', icon: 'person' },
            { key: 'value_for_money_rating', title: 'Value for Money', icon: 'cash' },
            { key: 'communication_rating', title: 'Communication', icon: 'chatbubbles' },
            { key: 'cleanliness_rating', title: 'Cleanliness', icon: 'sparkles' }
        ];

        return (
            <View style={styles.categoryRatings}>
                <Text style={styles.sectionTitle}>Rate Specific Areas</Text>
                {categories.map((category) => (
                    <TouchableOpacity
                        key={category.key}
                        style={styles.categoryRatingItem}
                        onPress={() => openRatingModal(category.key, category.title)}
                    >
                        <View style={styles.categoryInfo}>
                            <Ionicons name={category.icon} size={20} color={theme.colors.primary} />
                            <Text style={styles.categoryTitle}>{category.title}</Text>
                        </View>
                        <View style={styles.categoryRating}>
                            {renderStarRating(reviewData[category.key], () => {}, 16, true)}
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const renderServiceFeedback = () => (
        <View style={styles.serviceFeedback}>
            <Text style={styles.sectionTitle}>Service Details</Text>
            
            <View style={styles.feedbackItem}>
                <Text style={styles.feedbackQuestion}>Was the service completed on time?</Text>
                <View style={styles.toggleButtons}>
                    <TouchableOpacity
                        style={[styles.toggleButton, reviewData.service_completed_on_time && styles.toggleButtonActive]}
                        onPress={() => setReviewData(prev => ({ ...prev, service_completed_on_time: true }))}
                    >
                        <Text style={[styles.toggleButtonText, reviewData.service_completed_on_time && styles.toggleButtonTextActive]}>
                            Yes
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleButton, !reviewData.service_completed_on_time && styles.toggleButtonActive]}
                        onPress={() => setReviewData(prev => ({ ...prev, service_completed_on_time: false }))}
                    >
                        <Text style={[styles.toggleButtonText, !reviewData.service_completed_on_time && styles.toggleButtonTextActive]}>
                            No
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.feedbackItem}>
                <Text style={styles.feedbackQuestion}>Did the service meet your expectations?</Text>
                <View style={styles.toggleButtons}>
                    <TouchableOpacity
                        style={[styles.toggleButton, reviewData.service_met_expectations && styles.toggleButtonActive]}
                        onPress={() => setReviewData(prev => ({ ...prev, service_met_expectations: true }))}
                    >
                        <Text style={[styles.toggleButtonText, reviewData.service_met_expectations && styles.toggleButtonTextActive]}>
                            Yes
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleButton, !reviewData.service_met_expectations && styles.toggleButtonActive]}
                        onPress={() => setReviewData(prev => ({ ...prev, service_met_expectations: false }))}
                    >
                        <Text style={[styles.toggleButtonText, !reviewData.service_met_expectations && styles.toggleButtonTextActive]}>
                            No
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.feedbackItem}>
                <Text style={styles.feedbackQuestion}>Was the agent well-prepared?</Text>
                <View style={styles.toggleButtons}>
                    <TouchableOpacity
                        style={[styles.toggleButton, reviewData.agent_was_prepared && styles.toggleButtonActive]}
                        onPress={() => setReviewData(prev => ({ ...prev, agent_was_prepared: true }))}
                    >
                        <Text style={[styles.toggleButtonText, reviewData.agent_was_prepared && styles.toggleButtonTextActive]}>
                            Yes
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleButton, !reviewData.agent_was_prepared && styles.toggleButtonActive]}
                        onPress={() => setReviewData(prev => ({ ...prev, agent_was_prepared: false }))}
                    >
                        <Text style={[styles.toggleButtonText, !reviewData.agent_was_prepared && styles.toggleButtonTextActive]}>
                            No
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    const renderReviewText = () => (
        <View style={styles.reviewTextSection}>
            <Text style={styles.sectionTitle}>Written Review</Text>
            
            <TextInput
                style={styles.titleInput}
                placeholder="Review title (optional)"
                value={reviewData.review_title}
                onChangeText={(text) => setReviewData(prev => ({ ...prev, review_title: text }))}
                maxLength={200}
            />
            
            <TextInput
                style={styles.reviewTextInput}
                placeholder="Share details about your experience (optional)"
                value={reviewData.review_text}
                onChangeText={(text) => setReviewData(prev => ({ ...prev, review_text: text }))}
                multiline
                numberOfLines={6}
                maxLength={2000}
            />
            
            <Text style={styles.characterCount}>
                {reviewData.review_text.length}/2000 characters
            </Text>
        </View>
    );

    const renderRecommendation = () => (
        <View style={styles.recommendationSection}>
            <Text style={styles.sectionTitle}>Recommendation</Text>
            <TouchableOpacity
                style={styles.recommendationToggle}
                onPress={() => setReviewData(prev => ({ ...prev, would_recommend: !prev.would_recommend }))}
            >
                <Ionicons
                    name={reviewData.would_recommend ? "checkmark-circle" : "checkmark-circle-outline"}
                    size={24}
                    color={reviewData.would_recommend ? theme.colors.success : theme.colors.textSecondary}
                />
                <Text style={[styles.recommendationText, 
                    reviewData.would_recommend && styles.recommendationTextActive]}>
                    I would recommend this agent to others
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderRatingModal = () => (
        <Modal
            visible={showRatingModal}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowRatingModal(false)}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Rate {currentRatingCategory.title}</Text>
                    <TouchableOpacity onPress={() => setShowRatingModal(false)}>
                        <Ionicons name="close" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                </View>
                
                <View style={styles.modalContent}>
                    <View style={styles.modalRating}>
                        {renderStarRating(
                            reviewData[currentRatingCategory.key] || 0,
                            (rating) => {
                                updateRating(currentRatingCategory.key, rating);
                                setShowRatingModal(false);
                            },
                            50
                        )}
                    </View>
                    
                    <Text style={styles.modalRatingDescription}>
                        Tap a star to rate {currentRatingCategory.title}
                    </Text>
                </View>
            </View>
        </Modal>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Checking review eligibility...</Text>
            </View>
        );
    }

    if (!canReview) {
        return (
            <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={60} color={theme.colors.error} />
                <Text style={styles.errorText}>Cannot submit review for this booking</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView 
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Write Review</Text>
                <View style={styles.headerRight} />
            </View>
            
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {renderServiceHeader()}
                {renderOverallRating()}
                {renderCategoryRatings()}
                {renderServiceFeedback()}
                {renderReviewText()}
                {renderRecommendation()}
                
                <TouchableOpacity
                    style={[styles.submitButton, 
                        (submissionStatus === 'submitting' || reviewData.overall_rating === 0) && styles.submitButtonDisabled]}
                    onPress={submitReview}
                    disabled={submissionStatus === 'submitting' || reviewData.overall_rating === 0}
                >
                    {submissionStatus === 'submitting' ? (
                        <ActivityIndicator color={theme.colors.surface} />
                    ) : (
                        <Text style={styles.submitButtonText}>Submit Review</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
            
            {renderRatingModal()}
        </KeyboardAvoidingView>
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
    content: {
        flex: 1,
        padding: 20,
    },
    serviceHeader: {
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        padding: 20,
        borderRadius: 12,
        marginBottom: 20,
    },
    agentPhoto: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    serviceInfo: {
        marginLeft: 15,
        flex: 1,
    },
    agentName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    serviceCategory: {
        fontSize: 14,
        color: theme.colors.primary,
        marginTop: 2,
    },
    serviceDate: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginTop: 4,
    },
    existingRating: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    existingRatingText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginLeft: 8,
    },
    ratingSection: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 15,
    },
    overallRatingContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    starContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    star: {
        marginHorizontal: 2,
    },
    ratingText: {
        marginLeft: 10,
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
    ratingDescription: {
        textAlign: 'center',
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginTop: 10,
    },
    categoryRatings: {
        marginBottom: 30,
    },
    categoryRatingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 15,
        paddingHorizontal: 20,
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        marginBottom: 10,
    },
    categoryInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    categoryTitle: {
        fontSize: 16,
        color: theme.colors.text,
        marginLeft: 10,
    },
    categoryRating: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    serviceFeedback: {
        marginBottom: 30,
    },
    feedbackItem: {
        marginBottom: 20,
    },
    feedbackQuestion: {
        fontSize: 16,
        color: theme.colors.text,
        marginBottom: 10,
    },
    toggleButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        alignItems: 'center',
    },
    toggleButtonActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    toggleButtonText: {
        fontSize: 14,
        color: theme.colors.text,
    },
    toggleButtonTextActive: {
        color: theme.colors.surface,
        fontWeight: '600',
    },
    reviewTextSection: {
        marginBottom: 30,
    },
    titleInput: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: theme.colors.text,
        marginBottom: 10,
        backgroundColor: theme.colors.surface,
    },
    reviewTextInput: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        padding: 12,
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
        marginTop: 5,
    },
    recommendationSection: {
        marginBottom: 30,
    },
    recommendationToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 20,
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
    },
    recommendationText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        marginLeft: 12,
    },
    recommendationTextActive: {
        color: theme.colors.text,
        fontWeight: '600',
    },
    submitButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 40,
    },
    submitButtonDisabled: {
        backgroundColor: theme.colors.textSecondary,
    },
    submitButtonText: {
        color: theme.colors.surface,
        fontSize: 18,
        fontWeight: 'bold',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: theme.colors.textSecondary,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
    },
    errorText: {
        marginTop: 20,
        fontSize: 16,
        color: theme.colors.error,
        textAlign: 'center',
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
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    modalContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    modalRating: {
        marginBottom: 30,
    },
    modalRatingDescription: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        textAlign: 'center',
    },
});

export default PostServiceReviewScreen;