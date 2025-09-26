import React, { useState, memo } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Pressable,
  Dimensions,
  Platform 
} from 'react-native';
import { 
  Card, 
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
        {agent.is_online && (
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
          </View>
        )}
      </View>
    );
  };

  const renderQuickActions = () => {
    return (
      <View style={styles.actionsContainer}>
        {/* View Pricing Button */}
        <TouchableOpacity 
          style={[styles.actionButton, styles.pricingButton]}
          onPress={handleCardPress}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="currency-inr" size={16} color={colors.primary} />
          <Text style={styles.pricingButtonText}>Pricing</Text>
        </TouchableOpacity>

        {/* Book Now Button */}
        {showBookButton && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.bookButton]}
            onPress={handleBookPress}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="calendar-plus" size={16} color="white" />
            <Text style={styles.bookButtonText}>Book</Text>
          </TouchableOpacity>
        )}

        {/* Call Agent Button */}
        {showCallButton && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.callButton]}
            onPress={() => onCallAgent && onCallAgent(agent)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="phone" size={16} color="white" />
            <Text style={styles.callButtonText}>Call</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <TouchableOpacity onPress={onPress}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <View style={styles.agentInfo}>
              {renderAvatar()}
              <View style={styles.details}>
                <Text style={styles.name}>{agent.name || 'Agent'}</Text>
                {renderRating()}
                <Text style={styles.experience}>
                  {agent.experience_years ? `${agent.experience_years} years exp.` : 'New agent'}
                </Text>
              </View>
            </View>
            <View style={styles.statusContainer}>
              <View style={[
                styles.statusIndicator,
                agent.is_online ? styles.onlineIndicator : styles.offlineIndicator
              ]} />
              <Text style={[
                styles.statusText,
                agent.is_online ? styles.onlineText : styles.offlineText
              ]}>
                {agent.is_online ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>

          {agent.bio && (
            <Text style={styles.bio} numberOfLines={2}>
              {agent.bio}
            </Text>
          )}

          {/* Sub-categories/specializations */}
          {agent.sub_categories && agent.sub_categories.length > 0 && (
            <View style={styles.specializations}>
              <Text style={styles.specializationsTitle}>Specializations:</Text>
              <View style={styles.specializationChips}>
                {agent.sub_categories.slice(0, 3).map((subCat) => (
                  <Chip
                    key={subCat.id}
                    style={styles.specializationChip}
                    textStyle={styles.chipText}
                    compact
                  >
                    {subCat.name}
                  </Chip>
                ))}
                {agent.sub_categories.length > 3 && (
                  <Text style={styles.moreText}>
                    +{agent.sub_categories.length - 3} more
                  </Text>
                )}
              </View>
            </View>
          )}

          <View style={styles.footer}>
            <View style={styles.rateInfo}>
              <MaterialCommunityIcons name="map-marker" size={16} color="#666" />
              <Text style={styles.rateText}>₹{agent.rate_per_km}/km</Text>
            </View>
            <Button
              mode="contained"
              onPress={onBookPress}
              style={styles.bookButton}
              labelStyle={styles.bookButtonText}
            >
              Book Service
            </Button>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  agentInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  details: {
    marginLeft: 12,
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 4,
  },
  ratingCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  experience: {
    fontSize: 12,
    color: '#666',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  onlineIndicator: {
    backgroundColor: '#4CAF50',
  },
  offlineIndicator: {
    backgroundColor: '#f44336',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  onlineText: {
    color: '#4CAF50',
  },
  offlineText: {
    color: '#f44336',
  },
  bio: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  specializations: {
    marginBottom: 12,
  },
  specializationsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 6,
  },
  specializationChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  specializationChip: {
    marginRight: 6,
    marginBottom: 4,
    height: 24,
  },
  chipText: {
    fontSize: 11,
  },
  moreText: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rateText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
    marginLeft: 4,
  },
  bookButton: {
    paddingHorizontal: 16,
  },
  bookButtonText: {
    fontSize: 14,
  },
});

export default AgentCard;