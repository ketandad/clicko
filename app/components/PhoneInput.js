import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Text, HelperText } from 'react-native-paper';
import { phoneValidator } from '../utils/phoneValidator';

export const PhoneInput = ({ 
  value, 
  onChangeText, 
  onValidationChange,
  label = 'Phone Number',
  placeholder = '98765 43210',
  countryCode = 'IN',
  error = false,
  helperText = '',
  disabled = false,
  style,
  ...props 
}) => {
  const [phoneData, setPhoneData] = useState({
    formatted: '',
    isValid: false,
    e164: '',
    raw: ''
  });

  useEffect(() => {
    if (value) {
      const data = phoneValidator.formatAsYouType(value, countryCode);
      setPhoneData(data);
      onValidationChange && onValidationChange(data);
    }
  }, [value, countryCode]);

  const handleTextChange = (text) => {
    const data = phoneValidator.formatAsYouType(text, countryCode);
    setPhoneData(data);
    onChangeText && onChangeText(data.formatted, data);
    onValidationChange && onValidationChange(data);
  };

  const getValidationColor = () => {
    if (error) return '#F44336';
    if (!phoneData.raw) return '#666666';
    if (phoneData.raw.length < 10) return '#FFA726';
    return phoneData.isValid ? '#4CAF50' : '#F44336';
  };

  const getHelperMessage = () => {
    if (helperText) return helperText;
    if (!phoneData.raw) return `Format: ${placeholder}`;
    if (phoneData.raw.length < 10) return 'Enter complete phone number';
    if (!phoneData.isValid) return 'Please enter a valid phone number';
    return '✓ Valid phone number';
  };

  return (
    <View style={[styles.container, style]}>
      <TextInput
        {...props}
        label={label}
        value={phoneData.formatted}
        onChangeText={handleTextChange}
        keyboardType="phone-pad"
        placeholder={placeholder}
        maxLength={15}
        disabled={disabled}
        error={error || (phoneData.raw.length >= 10 && !phoneData.isValid)}
        style={[
          styles.input,
          {
            borderColor: getValidationColor()
          }
        ]}
        left={
          <TextInput.Affix text={countryCode === 'IN' ? '+91 ' : '+'} />
        }
      />
      <HelperText 
        type={error || (phoneData.raw.length >= 10 && !phoneData.isValid) ? 'error' : 'info'}
        visible={true}
        style={{ color: getValidationColor() }}
      >
        {getHelperMessage()}
      </HelperText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'transparent',
  }
});

export default PhoneInput;