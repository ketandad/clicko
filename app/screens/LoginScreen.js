import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Image, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { TextInput, Button, ActivityIndicator } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../contexts/AuthContext';
import { loginUser } from '../services/authService';
import { colors } from '../theme';
import config from '../config';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigation = useNavigation();
  const { login, clearAllData } = useAuth();

  // Simple API test function
  const testApiConnection = async () => {
    setLoading(true);
    setError('');

    try {
      console.log('🧪 Testing API connection...');
      console.log('API URL:', config.API_URL);
      
      // Test health endpoint
      const response = await fetch(config.API_URL.replace('/api', '/health'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.text();
      console.log('Health check response:', result);
      
      if (response.ok) {
        console.log('✅ API connection successful!');
        setError('✅ API connection successful! Backend is reachable.');
      } else {
        console.log('❌ API returned error:', response.status);
        setError(`❌ API error: ${response.status} - ${result}`);
      }
    } catch (error) {
      console.error('❌ API test failed:', error);
      setError(`❌ Connection failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Developer function to clear cached authentication
  const clearAppCache = async () => {
    Alert.alert(
      'Clear App Cache',
      'This will clear all cached authentication data. Use this when the database has been cleared but the app still shows old user data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              Alert.alert('Success', 'App cache cleared! The app is now in fresh state.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache: ' + error.message);
            }
          }
        }
      ]
    );
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      console.log('🔐 LoginScreen: Attempting login for:', email);
      const response = await loginUser(email, password);
      console.log('✅ LoginScreen: Login successful, response:', response);
      
      // Use AuthContext login function for proper state management
      const userData = {
        id: response.user_id,
        name: response.name,
        isAgent: response.is_agent,
        token: response.access_token
      };
      
      await login(userData);
      console.log('✅ LoginScreen: Login process complete');
      
      // No need for navigation.reset - AuthContext will handle the navigation automatically
    } catch (err) {
      console.error(err);
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/images/icon.png')} 
            style={styles.logo} 
            resizeMode="contain"
          />
          <Text style={styles.title}>ClickO</Text>
          <Text style={styles.subtitle}>Your instant service partner!</Text>
        </View>
        
        <View style={styles.formContainer}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            mode="outlined"
            style={styles.input}
          />
          
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            mode="outlined"
            style={styles.input}
          />
          
          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotPassword}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
          
          <Button
            mode="contained"
            onPress={handleLogin}
            style={styles.button}
            loading={loading}
            disabled={loading}
          >
            Login
          </Button>
          
          <Button
            mode="outlined"
            onPress={testApiConnection}
            style={[styles.button, styles.testButton]}
            loading={loading}
            disabled={loading}
            icon="wifi"
          >
            🧪 Test API Connection
          </Button>

          <Button
            mode="outlined"
            onPress={clearAppCache}
            style={[styles.button, styles.clearCacheButton]}
            icon="delete"
          >
            🗑️ Clear App Cache (Dev)
          </Button>
          
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.registerLink}>Register</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 5,
  },
  formContainer: {
    width: '100%',
  },
  input: {
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: colors.primary,
  },
  button: {
    padding: 5,
    marginTop: 10,
  },
  testButton: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  clearCacheButton: {
    borderColor: '#DC2626',
    borderWidth: 2,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  registerText: {
    color: colors.textSecondary,
  },
  registerLink: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
});
