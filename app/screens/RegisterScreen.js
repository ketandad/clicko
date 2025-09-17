import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';

export default function RegisterScreen() {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium">Register</Text>
      <Button mode="contained" style={styles.button}>Sign Up</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  button: {
    marginTop: 24,
  },
});
