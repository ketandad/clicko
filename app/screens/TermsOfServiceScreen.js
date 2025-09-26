import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Card, Text, Appbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme';

export default function TermsOfServiceScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Terms of Service" />
      </Appbar.Header>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.lastUpdated}>Last updated: September 24, 2025</Text>
            
            <Text style={styles.sectionTitle}>1. Platform Overview</Text>
            <Text style={styles.paragraph}>
              ClickO is a digital platform that connects users with independent service providers (agents). 
              We do not provide services directly but facilitate connections between users and service providers.
            </Text>

            <Text style={styles.sectionTitle}>2. Service Provider Relationship</Text>
            <Text style={styles.paragraph}>
              • All agents are independent contractors, not employees of ClickO{'\n'}
              • ClickO does not control how agents perform their services{'\n'}
              • Service quality and pricing are the responsibility of individual agents{'\n'}
              • Users engage directly with agents for service delivery
            </Text>

            <Text style={styles.sectionTitle}>3. Visit Charges and Payments</Text>
            <Text style={styles.paragraph}>
              • Visit charges are fees for agents to travel to your location{'\n'}
              • Default rate is ₹20 per kilometer, but agents may adjust rates{'\n'}
              • Visit charges are separate from service charges{'\n'}
              • Service pricing is negotiated directly between users and agents{'\n'}
              • ClickO processes only visit charge payments
            </Text>

            <Text style={styles.sectionTitle}>4. User Responsibilities</Text>
            <Text style={styles.paragraph}>
              • Provide accurate location and contact information{'\n'}
              • Be present at scheduled appointment times{'\n'}
              • Communicate requirements clearly to agents{'\n'}
              • Pay agreed-upon service charges directly to agents{'\n'}
              • Treat agents with respect and professionalism
            </Text>

            <Text style={styles.sectionTitle}>5. Agent Responsibilities</Text>
            <Text style={styles.paragraph}>
              • Maintain professional standards and qualifications{'\n'}
              • Provide accurate service information and pricing{'\n'}
              • Arrive punctually for scheduled appointments{'\n'}
              • Complete KYC verification and maintain valid documents{'\n'}
              • Honor agreed-upon pricing and service commitments
            </Text>

            <Text style={styles.sectionTitle}>6. Platform Limitations</Text>
            <Text style={styles.paragraph}>
              • ClickO is not responsible for service quality or outcomes{'\n'}
              • We do not warranty or guarantee agent services{'\n'}
              • Disputes between users and agents must be resolved directly{'\n'}
              • ClickO's liability is limited to platform-related issues only
            </Text>

            <Text style={styles.sectionTitle}>7. Cancellation and Refunds</Text>
            <Text style={styles.paragraph}>
              • Visit charges may be refunded if cancelled 30+ minutes before scheduled time{'\n'}
              • Service charge refunds are subject to agent policies{'\n'}
              • ClickO does not control service-related refunds{'\n'}
              • Platform fees are non-refundable unless due to technical errors
            </Text>

            <Text style={styles.sectionTitle}>8. Privacy and Data</Text>
            <Text style={styles.paragraph}>
              • We collect only necessary information for platform operation{'\n'}
              • User data is shared with agents only for service delivery{'\n'}
              • We do not sell or misuse personal information{'\n'}
              • Users control their data sharing preferences
            </Text>

            <Text style={styles.sectionTitle}>9. Prohibited Activities</Text>
            <Text style={styles.paragraph}>
              • Using the platform for illegal or harmful purposes{'\n'}
              • Bypassing platform payments or fees{'\n'}
              • Providing false information during registration{'\n'}
              • Harassing or discriminating against other users{'\n'}
              • Attempting to hack or damage the platform
            </Text>

            <Text style={styles.sectionTitle}>10. Dispute Resolution</Text>
            <Text style={styles.paragraph}>
              • Platform-related disputes: Contact ClickO support{'\n'}
              • Service-related disputes: Resolve directly with agents{'\n'}
              • Legal disputes subject to Indian jurisdiction{'\n'}
              • Mediation preferred over litigation where possible
            </Text>

            <Text style={styles.sectionTitle}>11. Changes to Terms</Text>
            <Text style={styles.paragraph}>
              We may update these terms periodically. Users will be notified of significant changes 
              and continued use constitutes acceptance of updated terms.
            </Text>

            <Text style={styles.contact}>
              For questions about these terms, contact us at:{'\n'}
              Email: legal@clicko.com{'\n'}
              Phone: +91-8000-123-456
            </Text>
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
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 20,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
    marginBottom: 12,
  },
  contact: {
    fontSize: 14,
    color: colors.primary,
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    fontWeight: '500',
  },
});