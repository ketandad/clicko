import * as React from 'react';
import { View, StyleSheet, FlatList, Modal } from 'react-native';
import { Card, Text, Button, IconButton, TextInput } from 'react-native-paper';

const dummyTransactions = [
  { id: '1', type: 'topup', amount: 500, timestamp: '2025-09-15', reason: 'Initial Top Up' },
  { id: '2', type: 'deduct', amount: 50, timestamp: '2025-09-16', reason: 'Booking Fee' },
  { id: '3', type: 'topup', amount: 200, timestamp: '2025-09-17', reason: 'Manual Top Up' },
];

export default function WalletScreen() {
  const [modalVisible, setModalVisible] = React.useState(false);
  const [topUpAmount, setTopUpAmount] = React.useState('');
  const balance = 1000;

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Title title="Wallet Balance" left={(props) => <IconButton {...props} icon="wallet" />} />
        <Card.Content>
          <Text variant="headlineLarge">₹{balance}</Text>
        </Card.Content>
        <Card.Actions>
          <Button mode="contained" onPress={() => setModalVisible(true)}>
            Top Up Wallet
          </Button>
        </Card.Actions>
      </Card>
      <Text style={styles.sectionTitle} variant="titleMedium">Transactions</Text>
      <FlatList
        data={dummyTransactions}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <Card style={styles.transactionCard}>
            <Card.Title
              title={item.reason}
              subtitle={item.timestamp}
              left={(props) => (
                <IconButton
                  {...props}
                  icon={item.type === 'topup' ? 'arrow-up-bold-circle' : 'arrow-down-bold-circle'}
                  color={item.type === 'topup' ? 'green' : 'red'}
                />
              )}
            />
            <Card.Content>
              <Text>₹{item.amount}</Text>
            </Card.Content>
          </Card>
        )}
      />
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <Card style={styles.modalCard}>
            <Card.Title title="Top Up Wallet" />
            <Card.Content>
              <TextInput
                label="Amount"
                value={topUpAmount}
                onChangeText={setTopUpAmount}
                keyboardType="numeric"
              />
            </Card.Content>
            <Card.Actions>
              <Button onPress={() => setModalVisible(false)}>Cancel</Button>
              <Button mode="contained" onPress={() => { setModalVisible(false); setTopUpAmount(''); }}>Top Up</Button>
            </Card.Actions>
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  card: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginVertical: 8,
  },
  transactionCard: {
    marginBottom: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalCard: {
    width: '90%',
    padding: 16,
  },
});
