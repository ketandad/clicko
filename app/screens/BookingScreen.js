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

  const handleBooking = () => {
    Alert.alert(
      'Confirm Visit Booking',
      `Pay ₹${visitCharge || 40} visit charge to connect with ${agentName}?\n\nThis covers their travel cost. Service charges will be discussed directly with the agent.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Pay & Book', 
          onPress: () => {
            // TODO: Implement booking logic
            Alert.alert('Booking Confirmed!', 'You will receive agent contact details shortly.');
            navigation.goBack();
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
                
                {schedule && (
                  <Text style={styles.scheduledTime}>
                    Scheduled: {date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Requirements */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Your Requirements</Text>
            <TextInput
              label="Describe your service needs"
              value={requirements}
              onChangeText={setRequirements}
              mode="outlined"
              multiline
              numberOfLines={4}
              placeholder="E.g., Need to fix electrical wiring in bedroom, install 2 new switches..."
              style={styles.textInput}
            />
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
