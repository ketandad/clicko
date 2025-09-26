import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Card, Text, Appbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme';

export default function PrivacyPolicyScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Privacy Policy" />
      </Appbar.Header>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.lastUpdated}>Last updated: September 24, 2025</Text>
            
            <Text style={styles.paragraph}>
              ClickO ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy 
              explains how we collect, use, and safeguard your information when you use our platform.
            </Text>

            <Text style={styles.sectionTitle}>1. Information We Collect</Text>
            
            <Text style={styles.subTitle}>Personal Information:</Text>
            <Text style={styles.paragraph}>
              • Name, phone number, and email address{'\n'}
              • Location data (for finding nearby service providers){'\n'}
              • Profile photos (for agents){'\n'}
              • KYC documents (for agent verification)
            </Text>

            <Text style={styles.subTitle}>Usage Information:</Text>
            <Text style={styles.paragraph}>
              • App usage patterns and preferences{'\n'}
              • Booking history and service requests{'\n'}
              • Communication between users and agents{'\n'}
              • Device information and IP addresses
            </Text>

            <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
            <Text style={styles.paragraph}>
              • Connecting you with appropriate service providers{'\n'}
              • Processing payments for visit charges{'\n'}
              • Improving platform functionality and user experience{'\n'}
              • Sending important updates and notifications{'\n'}
              • Ensuring platform security and preventing fraud{'\n'}
              • Complying with legal obligations
            </Text>

            <Text style={styles.sectionTitle}>3. Information Sharing</Text>
            
            <Text style={styles.subTitle}>With Service Providers (Agents):</Text>
            <Text style={styles.paragraph}>
              • Your name, phone number, and location for service delivery{'\n'}
              • Specific service requirements you've shared{'\n'}
              • Booking details and scheduling information
            </Text>

            <Text style={styles.subTitle}>We Do Not Share:</Text>
            <Text style={styles.paragraph}>
              • Your information with third-party marketers{'\n'}
              • Personal data for advertising purposes{'\n'}
              • More information than necessary for service delivery
            </Text>

            <Text style={styles.sectionTitle}>4. Data Security</Text>
            <Text style={styles.paragraph}>
              • All sensitive data is encrypted in transit and at rest{'\n'}
              • We use industry-standard security measures{'\n'}
              • Regular security audits and updates{'\n'}
              • Limited access to personal information by staff{'\n'}
              • Secure payment processing through trusted providers
            </Text>

            <Text style={styles.sectionTitle}>5. Location Data</Text>
            <Text style={styles.paragraph}>
              • We collect location data to find nearby service providers{'\n'}
              • Location sharing can be disabled in app settings{'\n'}
              • Precise location is shared only when booking services{'\n'}
              • We don't track location when app is not in use{'\n'}
              • Location history is kept only for necessary business purposes
            </Text>

            <Text style={styles.sectionTitle}>6. Data Retention</Text>
            <Text style={styles.paragraph}>
              • Account information: Retained while account is active{'\n'}
              • Booking history: Kept for 3 years for support purposes{'\n'}
              • KYC documents: Retained as required by law{'\n'}
              • Usage data: Anonymized after 1 year{'\n'}
              • You can request account deletion at any time
            </Text>

            <Text style={styles.sectionTitle}>7. Your Rights</Text>
            <Text style={styles.paragraph}>
              • Access your personal information{'\n'}
              • Correct inaccurate information{'\n'}
              • Delete your account and associated data{'\n'}
              • Control location sharing settings{'\n'}
              • Opt out of non-essential communications{'\n'}
              • Export your data in portable format
            </Text>

            <Text style={styles.sectionTitle}>8. Cookies and Tracking</Text>
            <Text style={styles.paragraph}>
              • We use minimal tracking for essential app functionality{'\n'}
              • No advertising cookies or third-party trackers{'\n'}
              • Analytics data is anonymized and aggregated{'\n'}
              • You can disable analytics in app settings
            </Text>

            <Text style={styles.sectionTitle}>9. Children's Privacy</Text>
            <Text style={styles.paragraph}>
              Our platform is not intended for users under 18 years old. We do not knowingly collect 
              personal information from children. If you believe we have collected information from a 
              minor, please contact us immediately.
            </Text>

            <Text style={styles.sectionTitle}>10. Changes to Privacy Policy</Text>
            <Text style={styles.paragraph}>
              We may update this Privacy Policy periodically. Significant changes will be communicated 
              through app notifications or email. Continued use after changes constitutes acceptance.
            </Text>

            <Text style={styles.sectionTitle}>11. International Data Transfers</Text>
            <Text style={styles.paragraph}>
              Your data is primarily stored and processed in India. Any international transfers comply 
              with applicable data protection laws and include appropriate safeguards.
            </Text>

            <Text style={styles.contact}>
              For privacy-related questions or to exercise your rights:{'\n'}
              Email: privacy@clicko.com{'\n'}
              Phone: +91-8000-123-456{'\n'}
              Address: ClickO Privacy Team, [Address], India
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
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 12,
    marginBottom: 8,
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