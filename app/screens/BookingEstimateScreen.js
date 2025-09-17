import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';

const agentRate = 20; // ₹20/km
const distance = 4.2; // km (dummy)
const visitCharge = agentRate * distance;

export default function BookingEstimateScreen({ onConfirm, onCancel }) {
  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Title title="Booking Estimate" />
        <Card.Content>
          <Text>Distance: {distance} km</Text>
          <Text>Rate: ₹{agentRate}/km</Text>
          <Text variant="titleMedium" style={{ marginTop: 8 }}>
            Visit Charge: ₹{visitCharge}
          </Text>
        </Card.Content>
        <Card.Actions>
          <Button mode="contained" onPress={onConfirm}>Confirm</Button>
          <Button onPress={onCancel}>Cancel</Button>
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
    backgroundColor: '#fff',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 350,
    padding: 16,
  },
});
