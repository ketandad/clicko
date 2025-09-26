import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text, Button, Chip, Avatar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';

export default function AgentCard({ agent, onPress, onBookPress }) {
  const renderRating = () => {
    const rating = agent.avg_rating || 0;
    const totalRatings = agent.total_ratings || 0;
    
    return (
      <View style={styles.ratingContainer}>
        <MaterialCommunityIcons name="star" size={16} color="#FFD700" />
        <Text style={styles.ratingText}>
          {rating > 0 ? rating.toFixed(1) : 'New'}
        </Text>
        {totalRatings > 0 && (
          <Text style={styles.ratingCount}>({totalRatings})</Text>
        )}
      </View>
    );
  };

  const renderAvatar = () => {
    if (agent.profile_photo_url) {
      return (
        <Avatar.Image 
          size={50} 
          source={{ uri: agent.profile_photo_url }} 
        />
      );
    }
    
    return (
      <Avatar.Text 
        size={50} 
        label={agent.name ? agent.name.charAt(0).toUpperCase() : 'A'}
        style={{ backgroundColor: colors.primary }}
      />
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