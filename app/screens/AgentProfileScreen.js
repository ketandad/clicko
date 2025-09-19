import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getAgentById } from '../services/agentListService';

const AgentProfileScreen = ({ route }) => {
  const { agentId, agent: passedAgent } = route.params;
  const [agent, setAgent] = useState(passedAgent || null);
  const [loading, setLoading] = useState(!passedAgent);

  useEffect(() => {
    if (!passedAgent && agentId) {
      loadAgentData();
    }
  }, [agentId, passedAgent]);

  const loadAgentData = async () => {
    try {
      setLoading(true);
      const agentData = await getAgentById(agentId);
      setAgent(agentData);
    } catch (error) {
      console.error('Error loading agent data:', error);
      Alert.alert('Error', 'Failed to load agent information');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading agent information...</Text>
      </View>
    );
  }

  if (!agent) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.errorText}>Agent information not available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{agent.name || 'Agent Name'}</Text>
      <Text style={styles.charges}>Charges: ₹{agent.rate_per_km || agent.charges || 0}/km</Text>
      <Text style={styles.category}>Category: {agent.categories?.join(', ') || agent.category || 'Service Provider'}</Text>
      <Text style={styles.rating}>Rating: {agent.avg_rating || agent.rating || 0} ({agent.total_ratings || 0} reviews)</Text>
      <Text style={styles.kycStatus}>
        KYC Status: {agent.kyc_status || 'Not submitted'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  charges: {
    fontSize: 18,
    marginVertical: 8,
  },
  category: {
    fontSize: 18,
    marginBottom: 8,
  },
  rating: {
    fontSize: 18,
    marginBottom: 16,
  },
  kycStatus: {
    fontSize: 16,
    color: 'gray',
  },
});

export default AgentProfileScreen;