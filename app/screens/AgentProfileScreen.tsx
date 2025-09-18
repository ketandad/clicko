import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const AgentProfileScreen = ({ route }) => {
  const { agent } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{agent.name}</Text>
      <Text style={styles.charges}>Charges: ₹{agent.charges}/km</Text>
      <Text style={styles.category}>Category: {agent.category}</Text>
      <Text style={styles.rating}>Rating: {agent.rating}</Text>
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