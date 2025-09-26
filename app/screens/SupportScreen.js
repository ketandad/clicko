import React from 'react';
import { View, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { Text, Card, List, Divider, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';

export default function SupportScreen() {
  const handleCallSupport = () => {
    const phoneNumber = 'tel:+911800123456';
    Linking.openURL(phoneNumber).catch(() => {
      Alert.alert('Error', 'Unable to make phone call');
    });
  };

  const handleEmailSupport = () => {
    const email = 'mailto:support@clicko.com';
    Linking.openURL(email).catch(() => {
      Alert.alert('Error', 'Unable to open email app');
    });
  };

  const handleWhatsAppSupport = () => {
    const whatsappUrl = 'whatsapp://send?phone=911800123456&text=Hi, I need help with ClickO app';
    Linking.openURL(whatsappUrl).catch(() => {
      Alert.alert('Error', 'WhatsApp is not installed');
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Support & Help</Text>
        <Text style={styles.subtitle}>We're here to help you 24/7</Text>

        {/* Contact Options */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Contact Support</Text>
            
            <List.Item
              title="Call Support"
              description="Available 24/7"
              left={(props) => <List.Icon {...props} icon="phone" color={colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={handleCallSupport}
              style={styles.listItem}
            />
            
            <Divider />
            
            <List.Item
              title="Email Support"
              description="support@clicko.com"
              left={(props) => <List.Icon {...props} icon="email" color={colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={handleEmailSupport}
              style={styles.listItem}
            />
            
            <Divider />
            
            <List.Item
              title="WhatsApp Support"
              description="Quick response guaranteed"
              left={(props) => <List.Icon {...props} icon="whatsapp" color={colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={handleWhatsAppSupport}
              style={styles.listItem}
            />
          </Card.Content>
        </Card>

        {/* FAQ Section */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
            
            <List.Accordion
              title="What is ClickO?"
              left={(props) => <List.Icon {...props} icon="information" color={colors.primary} />}
            >
              <List.Item 
                title="ClickO is a platform that connects users with service providers (agents). We don't provide services directly - we help you find and connect with trusted agents in your area."
                titleNumberOfLines={5}
                style={styles.faqItem}
              />
            </List.Accordion>
            
            <Divider />
            
            <List.Accordion
              title="How do I book a service?"
              left={(props) => <List.Icon {...props} icon="help-circle" color={colors.primary} />}
            >
              <List.Item 
                title="1. Select a service category from the home screen"
                titleNumberOfLines={3}
                style={styles.faqItem}
              />
              <List.Item 
                title="2. Choose an agent from the list (showing visit charges)"
                titleNumberOfLines={3}
                style={styles.faqItem}
              />
              <List.Item 
                title="3. Pay the visit charge and connect with the agent"
                titleNumberOfLines={3}
                style={styles.faqItem}
              />
              <List.Item 
                title="4. Discuss your requirements and service charges directly with the agent"
                titleNumberOfLines={3}
                style={styles.faqItem}
              />
            </List.Accordion>
            
            <Divider />
            
            <List.Accordion
              title="What are visit charges?"
              left={(props) => <List.Icon {...props} icon="currency-inr" color={colors.primary} />}
            >
              <List.Item 
                title="Visit charges are the fees agents charge to come to your location. These are calculated based on distance (₹20/km by default) or per visit. This is separate from the actual service charges."
                titleNumberOfLines={5}
                style={styles.faqItem}
              />
            </List.Accordion>
            
            <Divider />
            
            <List.Accordion
              title="How are service prices determined?"
              left={(props) => <List.Icon {...props} icon="calculator" color={colors.primary} />}
            >
              <List.Item 
                title="Service prices are negotiated directly between you and the agent. ClickO only facilitates the connection. The agent will discuss and quote prices based on your specific requirements."
                titleNumberOfLines={5}
                style={styles.faqItem}
              />
            </List.Accordion>
            
            <Divider />
            
            <List.Accordion
              title="Can agents change their visit rates?"
              left={(props) => <List.Icon {...props} icon="tune" color={colors.primary} />}
            >
              <List.Item 
                title="Yes, agents can update their visit rates anytime from their profile settings. The default rate is ₹20 per kilometer, but agents can adjust this based on their preferences."
                titleNumberOfLines={4}
                style={styles.faqItem}
              />
            </List.Accordion>
            
            <Divider />
            
            <List.Accordion
              title="How do I track my booking?"
              left={(props) => <List.Icon {...props} icon="map-marker" color={colors.primary} />}
            >
              <List.Item 
                title="Go to 'Booking History' tab to see all your bookings and track real-time status"
                titleNumberOfLines={3}
                style={styles.faqItem}
              />
            </List.Accordion>
            
            <Divider />
            
            <List.Accordion
              title="How do I cancel a booking?"
              left={(props) => <List.Icon {...props} icon="cancel" color={colors.primary} />}
            >
              <List.Item 
                title="You can cancel bookings up to 30 minutes before the scheduled time from your booking history"
                titleNumberOfLines={3}
                style={styles.faqItem}
              />
            </List.Accordion>
            
            <Divider />
            
            <List.Accordion
              title="How do I become an agent?"
              left={(props) => <List.Icon {...props} icon="account-tie" color={colors.primary} />}
            >
              <List.Item 
                title="Go to Profile → Switch to Agent Mode and complete the onboarding process with KYC verification"
                titleNumberOfLines={3}
                style={styles.faqItem}
              />
            </List.Accordion>
          </Card.Content>
        </Card>

        {/* Legal Documents */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Legal & Policies</Text>
            
            <List.Item
              title="Terms of Service"
              description="Platform usage terms and conditions"
              left={(props) => <List.Icon {...props} icon="file-document" color={colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate('TermsOfService')}
              style={styles.listItem}
            />
            
            <Divider />
            
            <List.Item
              title="Privacy Policy" 
              description="How we handle your personal data"
              left={(props) => <List.Icon {...props} icon="shield-account" color={colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate('PrivacyPolicy')}
              style={styles.listItem}
            />
          </Card.Content>
        </Card>

        {/* App Info */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>App Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last Updated</Text>
              <Text style={styles.infoValue}>September 2025</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Emergency Contact */}
        <Card style={[styles.card, styles.emergencyCard]}>
          <Card.Content>
            <View style={styles.emergencyHeader}>
              <MaterialCommunityIcons name="alert-circle" size={24} color="#fff" />
              <Text style={styles.emergencyTitle}>Emergency Support</Text>
            </View>
            <Text style={styles.emergencyText}>
              For urgent issues, call our 24/7 emergency helpline
            </Text>
            <Button
              mode="contained"
              onPress={handleCallSupport}
              style={styles.emergencyButton}
              labelStyle={styles.emergencyButtonText}
            >
              Call Emergency Support
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginVertical: 20,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    margin: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  listItem: {
    paddingVertical: 4,
  },
  faqItem: {
    paddingLeft: 32,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  emergencyCard: {
    backgroundColor: '#e53e3e',
    marginBottom: 32,
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  emergencyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  emergencyText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 16,
    opacity: 0.9,
  },
  emergencyButton: {
    backgroundColor: '#fff',
  },
  emergencyButtonText: {
    color: '#e53e3e',
    fontWeight: 'bold',
  },
});