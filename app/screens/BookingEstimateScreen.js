import * as React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Card, Text, Button, Divider } from 'react-native-paper';
import { useRoute } from '@react-navigation/native';
import { api } from '../services/authService';

const agentRate = 20; // ₹20/km
const distance = 4.2; // km (dummy)
const visitCharge = agentRate * distance;

export default function BookingEstimateScreen({ navigation }) {
  const [loading, setLoading] = React.useState(false);
  const route = useRoute();
  
  // Get agent data from route params
  const { agent } = route.params || {};
  const agentId = agent?.id || agent?.agent_id;
  const agentName = agent?.name || agent?.full_name || 'Agent';
  const categoryId = agent?.categories?.[0] || 'Home Appliances';

  const handleConfirm = async () => {
    setLoading(true);
    try {
      console.log('🔍 DEBUG: Agent object received:', agent);
      console.log('🔍 DEBUG: Extracted agentId:', agentId, 'agentName:', agentName);
      
      const payload = {
        agent_id: agentId,
        service_category: categoryId || 'Home Appliances',
        service_latitude: 19.076, // Example: Mumbai
        service_longitude: 72.8777,
        service_address: '123 Main Street, Mumbai',
        service_city: 'Mumbai',
        service_state: 'Maharashtra',
        service_pincode: '400001',
        visit_charge: visitCharge,
        service_charge: 0,
        total_amount: visitCharge,
        requested_date: new Date().toISOString().slice(0, 10),
        requested_time_slot: null,
        service_description: `Booking for ${categoryId || 'Home Appliances'} with ${agentName}`,
      };
      console.log('🔍 Booking API Debug: URL:', api.defaults.baseURL + '/bookings/create');
      console.log('🔍 Booking API Debug: Headers:', api.defaults.headers.common);
      console.log('🔍 Booking API Debug: Payload:', payload);
      
      // Check if auth token is present
      const authHeader = api.defaults.headers.common['Authorization'];
      console.log('🔑 Auth Debug: Authorization header:', authHeader ? 'Present' : 'Missing');
      
      if (!authHeader) {
        // Try to get token and set it
        const { getToken } = await import('../services/authService');
        const token = await getToken();
        console.log('🔑 Auth Debug: Retrieved token:', token ? 'Found' : 'Not found');
        
        if (token) {
          const { setAuthToken } = await import('../services/authService');
          setAuthToken(token);
          console.log('🔑 Auth Debug: Token set in api instance');
        }
      }
      const response = await api.post('/bookings/create', payload);
      const result = response.data;
      if (result.success) {
        Alert.alert('Booking Confirmed!', 'Agent will be notified and can accept or reject your request.');
        if (navigation) navigation.goBack();
      } else {
        Alert.alert('Booking Failed', result.message || JSON.stringify(result));
      }
    } catch (err) {
      Alert.alert('Error', `Failed to create booking. ${err.message}`);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Title title="Booking Estimate" subtitle={agentName ? `Agent: ${agentName}` : undefined} />
        <Divider style={{ marginVertical: 8 }} />
        <Card.Content>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.label}>Service Category</Text>
              <Text style={styles.value}>{categoryId || 'Home Appliances'}</Text>
            </View>
            <View>
              <Text style={styles.label}>Distance</Text>
              <Text style={styles.value}>{distance} km</Text>
            </View>
          </View>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.label}>Rate</Text>
              <Text style={styles.value}>₹{agentRate}/km</Text>
            </View>
            <View>
              <Text style={styles.label}>Visit Charge</Text>
              <Text style={styles.charge}>₹{visitCharge}</Text>
            </View>
          </View>
          <Divider style={{ marginVertical: 12 }} />
          <Text style={styles.infoText}>
            This covers the agent's travel cost. Service charges will be discussed and agreed upon directly with the agent.
          </Text>
        </Card.Content>
        <Card.Actions style={styles.actionsRow}>
          <Button mode="contained" onPress={handleConfirm} loading={loading} style={styles.confirmButton} labelStyle={styles.confirmButtonText}>
            Confirm & Book
          </Button>
          <Button onPress={() => navigation.goBack()} style={styles.cancelButton}>
            Cancel
          </Button>
        </Card.Actions>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f6f8fa',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 350,
    borderRadius: 16,
    elevation: 4,
    backgroundColor: '#fff',
    padding: 16,
  },
  label: {
    fontSize: 14,
    color: '#555',
    marginTop: 8,
    marginBottom: 2,
    fontWeight: '600',
  },
  value: {
    fontSize: 16,
    color: '#222',
    marginBottom: 8,
  },
  charge: {
    fontSize: 18,
    color: '#1976d2',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#555',
    marginTop: 8,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  confirmButton: {
    marginTop: 8,
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 12,
    minWidth: 140,
    alignSelf: 'center',
    elevation: 2,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButton: {
    marginLeft: 8,
    borderRadius: 8,
    borderColor: '#ccc',
    borderWidth: 1,
    backgroundColor: '#fff',
    minWidth: 100,
  },
});
