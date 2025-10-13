import * as React from 'react';
import { View, StyleSheet, Switch, ScrollView, Alert } from 'react-native';
import { Card, Text, Button, TextInput, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../theme';

export default function BookingScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { agentId, agentName, categoryId, visitCharge } = route.params || {};
  
  const [schedule, setSchedule] = React.useState(false);
  const [showPicker, setShowPicker] = React.useState(false);
  const [date, setDate] = React.useState(new Date());
  const [requirements, setRequirements] = React.useState('');

  const handleBooking = async () => {
    Alert.alert(
      'Confirm Visit Booking',
      `Pay ₹${visitCharge || 40} visit charge to connect with ${agentName}?\n\nThis covers their travel cost. Service charges will be discussed directly with the agent.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay & Book',
          onPress: async () => {
            try {
              // Call backend API to create booking
              const response = await fetch('http://localhost:8000/api/bookings/create', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  // Add auth token if needed
                },
                body: JSON.stringify({
                  agent_id: agentId,
                  service_category: categoryId || 'General',
                  service_latitude: 0, // TODO: Use actual location
                  service_longitude: 0,
                  service_address: 'User Address', // TODO: Use actual address
                  service_city: 'City',
                  service_state: 'State',
                  service_pincode: '000000',
                  visit_charge: visitCharge || 40,
                  service_charge: 0,
                  total_amount: visitCharge || 40,
                  requested_date: new Date().toISOString().slice(0, 10),
                  requested_time_slot: null,
                  service_description: requirements,
                })
              });
              const result = await response.json();
              if (result.success) {
                // Use the proper message from backend - should be "Booking request sent to agent. Bell will ring for 2 minutes..."
                Alert.alert('Request Sent!', result.message || 'Your booking request has been sent to the agent. Please wait for their response.');
                navigation.goBack();
              } else {
                Alert.alert('Booking Failed', result.message || 'Could not create booking.');
              }
            } catch (err) {
              Alert.alert('Error', 'Failed to create booking. Please try again.');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Agent Info */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Booking Details</Text>
            <View style={styles.agentInfo}>
              <MaterialCommunityIcons name="account-circle" size={24} color={colors.primary} />
              <Text style={styles.agentName}>{agentName || 'Agent'}</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Visit Charge Explanation */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Visit Charge</Text>
            <View style={styles.chargeContainer}>
              <MaterialCommunityIcons name="currency-inr" size={24} color={colors.primary} />
              <View style={styles.chargeDetails}>
                <Text style={styles.chargeAmount}>₹{visitCharge || 40}</Text>
                <Text style={styles.chargeDescription}>Travel/Visit charge only</Text>
              </View>
            </View>
            
            <View style={styles.infoBox}>
              <MaterialCommunityIcons name="information" size={16} color={colors.primary} />
              <Text style={styles.infoText}>
                This covers the agent's travel cost to reach your location. Service charges will be discussed and agreed upon directly with the agent based on your requirements.
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Scheduling */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Scheduling</Text>
            <View style={styles.row}>
              <Text style={styles.optionText}>Book Now</Text>
              <Switch 
                value={schedule} 
                onValueChange={setSchedule}
                thumbColor={schedule ? colors.primary : '#f4f3f4'}
                trackColor={{ false: '#767577', true: colors.primaryLight }}
              />
              <Text style={styles.optionText}>Schedule Later</Text>
            </View>
            
            {schedule && (
              <View style={styles.dateSection}>
                <Button 
                  mode="outlined" 
                  onPress={() => setShowPicker(true)} 
                  style={styles.dateButton}
                  icon="calendar"
                >
                  Pick Date & Time
                </Button>
                {showPicker && (
                  <DateTimePicker
                    value={date}
                    mode="datetime"
                    display="default"
                    minimumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      setShowPicker(false);
                      if (selectedDate) setDate(selectedDate);
                    }}
                  />
                )}
              </View>
            )}
            <Text style={styles.helperText}>
              Share details so the agent can come prepared with necessary tools/materials
            </Text>
          </Card.Content>
        </Card>

        {/* Booking Actions */}
        <View style={styles.actionsContainer}>
          <Button 
            mode="contained" 
            onPress={handleBooking}
            style={styles.bookButton}
            contentStyle={styles.bookButtonContent}
            labelStyle={styles.bookButtonText}
          >
            Pay ₹{visitCharge || 40} & Connect with Agent
          </Button>
          
          <Button 
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={styles.cancelButton}
          >
            Cancel
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
// ...existing code...

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 350,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
});
