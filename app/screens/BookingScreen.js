import * as React from 'react';
import { View, StyleSheet, Switch } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function BookingScreen() {
  const [schedule, setSchedule] = React.useState(false);
  const [showPicker, setShowPicker] = React.useState(false);
  const [date, setDate] = React.useState(new Date());

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Title title="Book Agent" />
        <Card.Content>
          <View style={styles.row}>
            <Text>Book Now</Text>
            <Switch value={schedule} onValueChange={setSchedule} />
            <Text>Schedule</Text>
          </View>
          {schedule && (
            <Button mode="outlined" onPress={() => setShowPicker(true)} style={{ marginTop: 8 }}>
              Pick Date & Time
            </Button>
          )}
          {showPicker && (
            <DateTimePicker
              value={date}
              mode="datetime"
              display="default"
              onChange={(event, selectedDate) => {
                setShowPicker(false);
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}
          {schedule && (
            <Text style={{ marginTop: 8 }}>Scheduled for: {date.toLocaleString()}</Text>
          )}
        </Card.Content>
        <Card.Actions>
          <Button mode="contained">Confirm</Button>
          <Button>Cancel</Button>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
});
