import * as React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Card, Text } from 'react-native-paper';

const bookings = [
  { id: '1', agent: 'Agent A', scheduledTime: new Date(Date.now() + 3600000), status: 'scheduled' },
  { id: '2', agent: 'Agent B', scheduledTime: new Date(), status: 'confirmed' },
];

export default function MyBookingsScreen() {
  return (
    <View style={styles.container}>
      <FlatList
        data={bookings}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Title title={item.agent} subtitle={item.status === 'scheduled' ? 'Scheduled' : 'Confirmed'} />
            <Card.Content>
              <Text>
                {item.status === 'scheduled'
                  ? `Scheduled for: ${item.scheduledTime.toLocaleString()}`
                  : `Booked at: ${item.scheduledTime.toLocaleString()}`}
              </Text>
            </Card.Content>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 8,
    backgroundColor: '#fff',
  },
  card: {
    marginBottom: 12,
  },
});
