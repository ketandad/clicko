import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, ActivityIndicator } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../contexts/AuthContext';
import { loginUser } from '../services/authService';
import { colors } from '../theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigation = useNavigation();
  const { setUser } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const response = await loginUser(email, password);
      
      // Save the token to secure storage
      await SecureStore.setItemAsync('userToken', response.access_token);
      await SecureStore.setItemAsync('userId', response.user_id.toString());
      await SecureStore.setItemAsync('userName', response.name);
      await SecureStore.setItemAsync('isAgent', response.is_agent.toString());
      
      // Update auth context
      setUser({
        id: response.user_id,
        name: response.name,
        isAgent: response.is_agent,
        token: response.access_token
      });
      
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
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
            source={require('../assets/logo.png')} 
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
