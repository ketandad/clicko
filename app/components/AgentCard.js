import React, { useState, memo } from 'react';
import { 
  View, 
  StyleSheet, 
  Pressable,
  Dimensions 
} from 'react-native';
import { 
  Text, 
  Button, 
  Chip, 
  Avatar,
  Surface,
  Badge
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withTiming,
  interpolate
} from 'react-native-reanimated';
import { colors } from '../theme';

const { width } = Dimensions.get('window');

const AgentCard = memo(({ 
  agent, 
  onViewPricing, 
  onBookNow,
  onCallAgent,
  onPress, // Legacy support
  onBookPress, // Legacy support
  style,
  showBookButton = true,
  showCallButton = false,
  compact = false
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const scaleValue = useSharedValue(1);
  const elevationValue = useSharedValue(2);

  // Animation for press feedback
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
    elevation: elevationValue.value,
    shadowOpacity: interpolate(elevationValue.value, [2, 8], [0.1, 0.25])
  }));

  const handlePressIn = () => {
    setIsPressed(true);
    scaleValue.value = withSpring(0.98);
    elevationValue.value = withTiming(8);
  };

  const handlePressOut = () => {
    setIsPressed(false);
    scaleValue.value = withSpring(1);
    elevationValue.value = withTiming(2);
  };

  const handleCardPress = () => {
    // Support both new and legacy callbacks
    if (onViewPricing) {
      onViewPricing(agent);
    } else if (onPress) {
      onPress(agent);
    }
  };

  const handleBookPress = () => {
    if (onBookNow) {
      onBookNow(agent);
    } else if (onBookPress) {
      onBookPress(agent);
    }
  };

  const renderRating = () => {
    if (!agent.total_ratings || agent.total_ratings === 0) {
      return (
        <View style={styles.ratingContainer}>
          <MaterialCommunityIcons name="star-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
            New Agent
          </Text>
        </View>
      );
    }

    const rating = agent.avg_rating || 0;
    const ratingColor = rating >= 4.5 ? colors.success : rating >= 4.0 ? colors.warning : colors.textSecondary;

    return (
      <View style={styles.ratingContainer}>
        <MaterialCommunityIcons name="star" size={14} color={ratingColor} />
        <Text style={[styles.ratingText, { color: ratingColor }]}>
          {rating.toFixed(1)} ({agent.total_ratings})
        </Text>
      </View>
    );
  };

  const renderDistance = () => {
    if (!agent.distance_km && !agent.distanceText) return null;
    
    const distance = agent.distanceText || `${agent.distance_km}km away`;
    const isNearby = agent.distance_km <= 2;
    
    return (
      <View style={styles.distanceContainer}>
        <MaterialCommunityIcons 
          name={isNearby ? "map-marker" : "map-marker-outline"} 
          size={12} 
          color={isNearby ? colors.primary : colors.textSecondary} 
        />
        <Text style={[styles.distanceText, isNearby && { color: colors.primary }]}>
          {distance}
        </Text>
      </View>
    );
  };

  const renderVisitCharge = () => {
    if (!agent.rate_per_km) return null;
    
    const charge = agent.visitChargeText || `₹${Math.ceil(agent.rate_per_km * (agent.distance_km || 1))} visit`;
    
    return (
      <View style={styles.chargeContainer}>
        <MaterialCommunityIcons name="currency-inr" size={12} color={colors.primary} />
        <Text style={[styles.chargeText, { color: colors.primary }]}>
          {charge}
        </Text>
      </View>
    );
  };

  const renderAvatar = () => {
    return (
      <View style={styles.avatarContainer}>
        <Avatar.Image
          size={compact ? 40 : 48}
          source={{
            uri: agent.profile_photo_url || 
                 `https://ui-avatars.com/api/?name=${encodeURIComponent(agent.name)}&background=6200ea&color=ffffff&size=96`
          }}
          style={styles.avatar}
        />
        
        {/* Online Status Badge */}
        <Badge
          style={[
            styles.statusBadge,
            agent.is_online ? styles.onlineBadge : styles.offlineBadge
          ]}
          size={10}
        />
        
        {/* Verified Badge */}
        {agent.is_verified && (
          <MaterialCommunityIcons
            name="check-decagram"
            size={16}
            color={colors.success}
            style={styles.verifiedIcon}
          />
        )}
      </View>
    );
  };

  const renderQuickActions = () => {
    return (
      <View style={styles.actionsContainer}>
        {showCallButton && onCallAgent && (
          <Button
            mode="outlined"
            onPress={() => onCallAgent(agent)}
            style={styles.actionButton}
            contentStyle={styles.actionButtonContent}
            labelStyle={styles.actionButtonLabel}
            icon="phone"
          >
            Call
          </Button>
        )}
        
        <Button
          mode="outlined"
          onPress={handleCardPress}
          style={[styles.actionButton, { marginHorizontal: 8 }]}
          contentStyle={styles.actionButtonContent}
          labelStyle={styles.actionButtonLabel}
          icon="eye"
        >
          View Details
        </Button>
        
        {showBookButton && (
          <Button
            mode="contained"
            onPress={handleBookPress}
            style={styles.actionButton}
            contentStyle={styles.actionButtonContent}
            labelStyle={styles.actionButtonLabel}
            buttonColor={colors.primary}
          >
            Book Now
          </Button>
        )}
      </View>
    );
  };

  return (
    <Animated.View style={[styles.cardWrapper, animatedStyle, style]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handleCardPress}
        style={styles.pressable}
      >
        <Surface style={[styles.card, compact && styles.compactCard]} elevation={2}>
          {/* Header Section */}
          <View style={styles.header}>
            {/* Avatar */}
            {renderAvatar()}

            {/* Agent Info */}
            <View style={styles.agentInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.agentName} numberOfLines={1}>
                  {agent.name}
                </Text>
                {agent.isNearby && (
                  <Chip
                    style={styles.nearbyChip}
                    textStyle={styles.nearbyChipText}
                    mode="outlined"
                    compact
                  >
                    Nearby
                  </Chip>
                )}
              </View>
              
              <View style={styles.metaRow}>
                {renderRating()}
                {renderDistance()}
              </View>

              <View style={styles.metaRow}>
                {renderVisitCharge()}
                {agent.responseTime && (
                  <Text style={styles.responseTime}>
                    {agent.responseTime}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Categories */}
          {agent.categories && agent.categories.length > 0 && (
            <View style={styles.categoriesContainer}>
              {agent.categories.slice(0, 3).map((category, index) => (
                <Chip
                  key={index}
                  style={styles.categoryChip}
                  textStyle={styles.categoryChipText}
                  mode="outlined"
                  compact
                >
                  {category}
                </Chip>
              ))}
              {agent.categories.length > 3 && (
                <Text style={styles.moreCategories}>
                  +{agent.categories.length - 3} more
                </Text>
              )}
            </View>
          )}

          {/* Quick Actions */}
          {!compact && renderQuickActions()}
        </Surface>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  cardWrapper: {
    marginVertical: 6,
    marginHorizontal: 16,
  },
  pressable: {
    borderRadius: 12,
  },
  card: {
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  compactCard: {
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    backgroundColor: colors.primary,
  },
  statusBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  onlineBadge: {
    backgroundColor: colors.success,
  },
  offlineBadge: {
    backgroundColor: colors.textSecondary,
  },
  verifiedIcon: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ffffff',
    borderRadius: 8,
  },
  agentInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  agentName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  nearbyChip: {
    height: 24,
    backgroundColor: colors.primaryLight,
  },
  nearbyChipText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  ratingText: {
    fontSize: 12,
    marginLeft: 2,
    fontWeight: '500',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  distanceText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 2,
  },
  chargeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chargeText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 2,
  },
  responseTime: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryChip: {
    height: 24,
    marginRight: 6,
    marginBottom: 4,
    backgroundColor: colors.surface,
  },
  categoryChipText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  moreCategories: {
    fontSize: 10,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginLeft: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
  },
  actionButtonContent: {
    height: 36,
  },
  actionButtonLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});

AgentCard.displayName = 'AgentCard';

export default AgentCard;