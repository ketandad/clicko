import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
  Linking
} from 'react-native';
import {
  Text,
  Button,
  Chip,
  Avatar,
  Surface,
  Divider,
  Card,
  Badge,
  ActivityIndicator,
  Portal,
  Modal
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme';
import { getAgentRatingSummary, getAgentRatings } from '../services/ratingService';
import { getAgentServicePricing } from '../services/agentPricingService';
import { calculateDistance } from '../services/userLocationService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const AgentDetailScreen = ({ route, navigation }) => {
  const { agent: initialAgent } = route.params;
  
  const [agent, setAgent] = useState(initialAgent);
  const [loading, setLoading] = useState(true);
  const [ratingSummary, setRatingSummary] = useState(null);
  const [recentReviews, setRecentReviews] = useState([]);
  const [servicePricing, setServicePricing] = useState([]);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [selectedPricingCategory, setSelectedPricingCategory] = useState(null);

  useEffect(() => {
    loadAgentDetails();
  }, []);

  const loadAgentDetails = async () => {
    try {
      setLoading(true);
      
      // Load rating summary and recent reviews in parallel
      const [ratingSummaryData, reviewsData] = await Promise.allSettled([
        getAgentRatingSummary(agent.id),
        getAgentRatings(agent.id, { limit: 3, verified_only: false })
      ]);
      
      if (ratingSummaryData.status === 'fulfilled') {
        setRatingSummary(ratingSummaryData.value);
      }
      
      if (reviewsData.status === 'fulfilled') {
        setRecentReviews(reviewsData.value);
      }
      
      // Load service pricing if agent has categories (reference pricing)
      if (agent.categories && agent.categories.length > 0) {
        try {
          const pricingData = await getAgentServicePricing();
          setServicePricing(pricingData);
        } catch (pricingError) {
          console.log('No reference pricing available for this agent');
        }
      }
      
    } catch (error) {
      console.error('Error loading agent details:', error);
      Alert.alert('Error', 'Failed to load agent details');
    } finally {
      setLoading(false);
    }
  };

  const handleBookService = () => {
    navigation.navigate('BookingEstimate', { agent });
  };

  const handleCallAgent = () => {
    if (agent.phone) {
      Alert.alert(
        'Call Agent',
        `Call ${agent.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Call', 
            onPress: () => Linking.openURL(`tel:${agent.phone}`) 
          }
        ]
      );
    } else {
      Alert.alert('No Phone', 'Phone number not available');
    }
  };

  const handleViewAllReviews = () => {
    navigation.navigate('AgentReviews', { 
      agent, 
      ratingSummary 
    });
  };

  const renderHeader = () => (
    <LinearGradient
      colors={[colors.primary, colors.primaryDark || '#1976D2']}
      style={styles.headerGradient}
    >
      <View style={styles.headerContent}>
        {/* Agent Avatar and Basic Info */}
        <View style={styles.agentHeaderInfo}>
          <View style={styles.avatarContainer}>
            <Avatar.Image
              size={80}
              source={{
                uri: agent.profile_photo_url || 
                     `https://ui-avatars.com/api/?name=${encodeURIComponent(agent.name)}&background=ffffff&color=6200ea&size=160`
              }}
              style={styles.agentAvatar}
            />
            
            {/* Online Status */}
            <Badge
              style={[
                styles.statusBadge,
                agent.is_online ? styles.onlineBadge : styles.offlineBadge
              ]}
              size={16}
            />
            
            {/* Verified Badge */}
            {agent.is_verified && (
              <MaterialCommunityIcons
                name="check-decagram"
                size={24}
                color="#4CAF50"
                style={styles.verifiedBadge}
              />
            )}
          </View>

          <View style={styles.agentBasicInfo}>
            <Text style={styles.agentName}>{agent.name}</Text>
            
            {/* Rating */}
            {ratingSummary && ratingSummary.total_ratings > 0 ? (
              <View style={styles.ratingContainer}>
                <MaterialCommunityIcons name="star" size={16} color="#FFD700" />
                <Text style={styles.ratingText}>
                  {ratingSummary.avg_rating.toFixed(1)} ({ratingSummary.total_ratings} reviews)
                </Text>
              </View>
            ) : (
              <Text style={styles.newAgentText}>New Agent</Text>
            )}

            {/* Distance and Status */}
            <View style={styles.statusRow}>
              {agent.distance_km && (
                <Chip style={styles.distanceChip} textStyle={styles.chipText}>
                  <MaterialCommunityIcons name="map-marker" size={12} />
                  {` ${agent.distance_km.toFixed(1)} km away`}
                </Chip>
              )}
              
              <Chip 
                style={[styles.statusChip, agent.is_online ? styles.onlineChip : styles.offlineChip]}
                textStyle={[styles.chipText, { color: '#ffffff' }]}
              >
                {agent.is_online ? 'Online' : 'Offline'}
              </Chip>
            </View>
          </View>
        </View>
      </View>
    </LinearGradient>
  );

  const renderPricingSection = () => (
    <Card style={styles.section}>
      <Card.Content>
        <Text style={styles.sectionTitle}>Pricing Information</Text>
        
        {/* Visit Charges (Distance-based) */}
        {agent.rate_per_km && (
          <Surface style={styles.pricingCard} elevation={1}>
            <View style={styles.pricingHeader}>
              <MaterialCommunityIcons name="car" size={20} color={colors.primary} />
              <Text style={styles.pricingTitle}>Visit Charges</Text>
            </View>
            <Text style={styles.pricingDescription}>
              Travel cost based on distance to your location
            </Text>
            <View style={styles.pricingDetails}>
              <Text style={styles.pricingRate}>₹{agent.rate_per_km}/km</Text>
              {agent.distance_km && (
                <Text style={styles.estimatedCost}>
                  Estimated: ₹{Math.ceil(agent.rate_per_km * agent.distance_km)}
                </Text>
              )}
            </View>
          </Surface>
        )}

        {/* Service Reference Pricing */}
        {servicePricing.length > 0 ? (
          <Surface style={styles.pricingCard} elevation={1}>
            <View style={styles.pricingHeader}>
              <MaterialCommunityIcons name="currency-inr" size={20} color={colors.primary} />
              <Text style={styles.pricingTitle}>Service Pricing Reference</Text>
              <Button
                mode="outlined"
                onPress={() => setShowPricingModal(true)}
                style={styles.viewPricingButton}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
              >
                View Details
              </Button>
            </View>
            <Text style={styles.pricingDescription}>
              Reference pricing for services (actual cost may vary)
            </Text>
            
            {/* Show first few pricing items */}
            {servicePricing.slice(0, 2).map((pricing, index) => (
              <View key={index} style={styles.pricingItem}>
                <Text style={styles.serviceTypeName}>{pricing.service_name}</Text>
                <Text style={styles.servicePriceRange}>
                  ₹{pricing.min_price} - ₹{pricing.max_price}
                </Text>
              </View>
            ))}
            
            {servicePricing.length > 2 && (
              <Text style={styles.morePricingText}>
                +{servicePricing.length - 2} more services
              </Text>
            )}
          </Surface>
        ) : (
          agent.categories && agent.categories.length > 0 && (
            <Surface style={styles.pricingCard} elevation={1}>
              <View style={styles.pricingHeader}>
                <MaterialCommunityIcons name="information" size={20} color={colors.textSecondary} />
                <Text style={styles.pricingTitle}>Service Pricing</Text>
              </View>
              <Text style={styles.pricingDescription}>
                Pricing details will be discussed during booking
              </Text>
            </Surface>
          )
        )}
      </Card.Content>
    </Card>
  );

  const renderServicesSection = () => (
    <Card style={styles.section}>
      <Card.Content>
        <Text style={styles.sectionTitle}>Services & Specializations</Text>
        
        {agent.categories && agent.categories.length > 0 ? (
          <View style={styles.categoriesContainer}>
            {agent.categories.map((category, index) => (
              <Chip
                key={index}
                style={styles.categoryChip}
                textStyle={styles.categoryChipText}
                mode="outlined"
              >
                {category}
              </Chip>
            ))}
          </View>
        ) : (
          <Text style={styles.noServicesText}>No specific services listed</Text>
        )}

        {agent.bio && (
          <>
            <Divider style={styles.divider} />
            <Text style={styles.bioTitle}>About</Text>
            <Text style={styles.bioText}>{agent.bio}</Text>
          </>
        )}
      </Card.Content>
    </Card>
  );

  const renderRatingsSection = () => (
    <Card style={styles.section}>
      <Card.Content>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Reviews & Ratings</Text>
          {ratingSummary && ratingSummary.total_ratings > 3 && (
            <Button mode="text" onPress={handleViewAllReviews}>
              View All
            </Button>
          )}
        </View>

        {ratingSummary && ratingSummary.total_ratings > 0 ? (
          <>
            {/* Rating Overview */}
            <View style={styles.ratingOverview}>
              <View style={styles.ratingScoreContainer}>
                <Text style={styles.ratingScore}>
                  {ratingSummary.avg_rating.toFixed(1)}
                </Text>
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <MaterialCommunityIcons
                      key={star}
                      name={star <= ratingSummary.avg_rating ? "star" : "star-outline"}
                      size={16}
                      color="#FFD700"
                    />
                  ))}
                </View>
                <Text style={styles.ratingCount}>
                  Based on {ratingSummary.total_ratings} reviews
                </Text>
              </View>
              
              {/* Rating Distribution */}
              <View style={styles.ratingDistribution}>
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = ratingSummary[`rating_${stars}_count`] || 0;
                  const percentage = ratingSummary.total_ratings > 0 
                    ? (count / ratingSummary.total_ratings) * 100 
                    : 0;
                  
                  return (
                    <View key={stars} style={styles.ratingBar}>
                      <Text style={styles.ratingStars}>{stars}★</Text>
                      <View style={styles.ratingBarTrack}>
                        <View 
                          style={[
                            styles.ratingBarFill, 
                            { width: `${percentage}%` }
                          ]} 
                        />
                      </View>
                      <Text style={styles.ratingBarCount}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Recent Reviews */}
            {recentReviews.length > 0 && (
              <>
                <Divider style={styles.divider} />
                <Text style={styles.reviewsTitle}>Recent Reviews</Text>
                {recentReviews.map((review, index) => (
                  <View key={review.id || index} style={styles.reviewItem}>
                    <View style={styles.reviewHeader}>
                      <Avatar.Text 
                        size={32} 
                        label={review.user_name ? review.user_name.charAt(0) : 'U'} 
                        style={styles.reviewAvatar}
                      />
                      <View style={styles.reviewMeta}>
                        <Text style={styles.reviewerName}>
                          {review.user_name || 'Anonymous'}
                        </Text>
                        <View style={styles.reviewRating}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <MaterialCommunityIcons
                              key={star}
                              name={star <= review.rating ? "star" : "star-outline"}
                              size={12}
                              color="#FFD700"
                            />
                          ))}
                        </View>
                      </View>
                    </View>
                    {review.review_text && (
                      <Text style={styles.reviewText}>{review.review_text}</Text>
                    )}
                  </View>
                ))}
              </>
            )}
          </>
        ) : (
          <View style={styles.noReviewsContainer}>
            <MaterialCommunityIcons name="star-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.noReviewsText}>No reviews yet</Text>
            <Text style={styles.noReviewsSubtext}>Be the first to review this agent</Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );

  const renderActionButtons = () => (
    <View style={styles.actionButtonsContainer}>
      <Button
        mode="outlined"
        onPress={handleCallAgent}
        style={styles.actionButton}
        contentStyle={styles.actionButtonContent}
        icon="phone"
        disabled={!agent.phone}
      >
        Call
      </Button>
      
      <Button
        mode="contained"
        onPress={handleBookService}
        style={[styles.actionButton, styles.bookButton]}
        contentStyle={styles.actionButtonContent}
        buttonColor={colors.primary}
      >
        Book Service
      </Button>
    </View>
  );

  const renderPricingModal = () => (
    <Portal>
      <Modal
        visible={showPricingModal}
        onDismiss={() => setShowPricingModal(false)}
        contentContainerStyle={styles.modalContainer}
      >
        <Surface style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Service Pricing Details</Text>
            <Button onPress={() => setShowPricingModal(false)}>
              <MaterialCommunityIcons name="close" size={24} />
            </Button>
          </View>
          
          <ScrollView style={styles.modalScrollView}>
            {servicePricing.map((pricing, index) => (
              <View key={index} style={styles.modalPricingItem}>
                <Text style={styles.modalServiceName}>{pricing.service_name}</Text>
                <Text style={styles.modalServiceDescription}>{pricing.description}</Text>
                <Text style={styles.modalServicePrice}>
                  ₹{pricing.min_price} - ₹{pricing.max_price}
                </Text>
                {index < servicePricing.length - 1 && <Divider style={styles.modalDivider} />}
              </View>
            ))}
          </ScrollView>
        </Surface>
      </Modal>
    </Portal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading agent details...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}
        {renderPricingSection()}
        {renderServicesSection()}
        {renderRatingsSection()}
        <View style={styles.bottomSpacing} />
      </ScrollView>
      
      {renderActionButtons()}
      {renderPricingModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.textSecondary,
  },
  
  // Header Styles
  headerGradient: {
    paddingTop: 20,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  agentHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  agentAvatar: {
    backgroundColor: '#ffffff',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  onlineBadge: {
    backgroundColor: '#4CAF50',
  },
  offlineBadge: {
    backgroundColor: colors.textSecondary,
  },
  verifiedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 2,
  },
  agentBasicInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 14,
    color: '#ffffff',
    marginLeft: 4,
    fontWeight: '500',
  },
  newAgentText: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.8,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 8,
  },
  statusChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  onlineChip: {
    backgroundColor: '#4CAF50',
  },
  offlineChip: {
    backgroundColor: colors.textSecondary,
  },
  chipText: {
    fontSize: 12,
    color: '#ffffff',
  },

  // Section Styles
  section: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  // Pricing Styles
  pricingCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: colors.surface,
  },
  pricingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pricingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginLeft: 8,
  },
  pricingDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  pricingDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pricingRate: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  estimatedCost: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  viewPricingButton: {
    borderColor: colors.primary,
  },
  buttonContent: {
    height: 32,
  },
  buttonLabel: {
    fontSize: 12,
  },
  pricingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  serviceTypeName: {
    fontSize: 14,
    color: colors.text,
  },
  servicePriceRange: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  morePricingText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },

  // Services Styles
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  categoryChip: {
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: colors.primaryLight,
  },
  categoryChipText: {
    fontSize: 12,
    color: colors.primary,
  },
  noServicesText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
  divider: {
    marginVertical: 12,
  },
  bioTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  bioText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // Rating Styles
  ratingOverview: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  ratingScoreContainer: {
    alignItems: 'center',
    marginRight: 24,
  },
  ratingScore: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
  },
  starsContainer: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  ratingCount: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  ratingDistribution: {
    flex: 1,
  },
  ratingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  ratingStars: {
    fontSize: 12,
    width: 20,
    color: colors.textSecondary,
  },
  ratingBarTrack: {
    flex: 1,
    height: 4,
    backgroundColor: colors.surface,
    borderRadius: 2,
    marginHorizontal: 8,
  },
  ratingBarFill: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 2,
  },
  ratingBarCount: {
    fontSize: 12,
    width: 20,
    textAlign: 'right',
    color: colors.textSecondary,
  },

  // Review Styles
  reviewsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  reviewItem: {
    marginBottom: 16,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewAvatar: {
    backgroundColor: colors.primary,
  },
  reviewMeta: {
    marginLeft: 12,
    flex: 1,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  reviewRating: {
    flexDirection: 'row',
    marginTop: 2,
  },
  reviewText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 18,
    marginLeft: 44,
  },
  noReviewsContainer: {
    alignItems: 'center',
    padding: 32,
  },
  noReviewsText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 8,
  },
  noReviewsSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Action Buttons
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  actionButtonContent: {
    height: 48,
  },
  bookButton: {
    marginLeft: 8,
  },

  // Modal Styles
  modalContainer: {
    margin: 20,
    maxHeight: screenHeight * 0.8,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  modalScrollView: {
    maxHeight: screenHeight * 0.6,
  },
  modalPricingItem: {
    padding: 16,
  },
  modalServiceName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  modalServiceDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  modalServicePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  modalDivider: {
    marginTop: 16,
  },

  // Spacing
  bottomSpacing: {
    height: 80, // Space for action buttons
  },
});

export default AgentDetailScreen;