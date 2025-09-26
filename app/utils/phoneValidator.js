// Simple phone validation without external dependencies
// Supports Indian phone numbers primarily

export const phoneValidator = {
  /**
   * Format phone number as user types (Indian numbers primarily)
   * @param {string} input - Raw phone number input
   * @param {string} countryCode - Country code (default: 'IN' for India)
   * @returns {object} { formatted: string, isValid: boolean, e164: string }
   */
  formatAsYouType: (input, countryCode = 'IN') => {
    // Remove all non-digit characters
    const digitsOnly = input.replace(/\D/g, '');
    
    // Handle empty input
    if (!digitsOnly) {
      return { formatted: '', isValid: false, e164: '', raw: '' };
    }

    let formatted = '';
    let isValid = false;
    let e164 = '';

    if (countryCode === 'IN') {
      // Indian phone number formatting
      if (digitsOnly.length <= 10) {
        // Format as: 98765 43210
        if (digitsOnly.length > 5) {
          formatted = digitsOnly.replace(/(\d{5})(\d{0,5})/, '$1 $2').trim();
        } else {
          formatted = digitsOnly;
        }
        
        // Validate Indian mobile number (10 digits, starts with 6-9)
        isValid = digitsOnly.length === 10 && /^[6-9]\d{9}$/.test(digitsOnly);
        if (isValid) {
          e164 = `+91${digitsOnly}`;
        }
      } else if (digitsOnly.startsWith('91') && digitsOnly.length <= 12) {
        // Handle +91 prefix
        const number = digitsOnly.substring(2);
        formatted = `+91 ${number.replace(/(\d{5})(\d{0,5})/, '$1 $2').trim()}`;
        isValid = number.length === 10 && /^[6-9]\d{9}$/.test(number);
        if (isValid) {
          e164 = `+91${number}`;
        }
      } else {
        formatted = digitsOnly;
      }
    } else {
      // Basic formatting for other countries
      if (digitsOnly.length <= 10) {
        formatted = digitsOnly.replace(/(\d{3})(\d{3})(\d{0,4})/, '$1 $2 $3').trim();
      } else {
        formatted = digitsOnly.replace(/(\d{1,3})(\d{3})(\d{3})(\d{0,4})/, '+$1 $2 $3 $4').trim();
      }
      
      // Basic validation (10-15 digits)
      isValid = digitsOnly.length >= 10 && digitsOnly.length <= 15;
      if (isValid) {
        e164 = `+${digitsOnly}`;
      }
    }

    return {
      formatted: formatted,
      isValid: isValid,
      e164: e164,
      raw: digitsOnly
    };
  },

  /**
   * Validate a complete phone number
   * @param {string} phoneNumber - Phone number to validate
   * @param {string} countryCode - Country code
   * @returns {object} Validation result with details
   */
  validate: (phoneNumber, countryCode = 'IN') => {
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    
    if (countryCode === 'IN') {
      // Indian number validation
      let number = digitsOnly;
      
      // Remove country code if present
      if (number.startsWith('91') && number.length === 12) {
        number = number.substring(2);
      }
      
      const isValid = number.length === 10 && /^[6-9]\d{9}$/.test(number);
      
      return {
        isValid: isValid,
        isPossible: number.length >= 10,
        e164: isValid ? `+91${number}` : '',
        national: isValid ? number.replace(/(\d{5})(\d{5})/, '$1 $2') : '',
        international: isValid ? `+91 ${number.replace(/(\d{5})(\d{5})/, '$1 $2')}` : '',
        countryCode: '91',
        nationalNumber: number,
        error: !isValid && number.length > 0 ? 'Invalid Indian mobile number' : ''
      };
    } else {
      // Basic validation for other countries
      const isValid = digitsOnly.length >= 10 && digitsOnly.length <= 15;
      
      return {
        isValid: isValid,
        isPossible: digitsOnly.length >= 7,
        e164: isValid ? `+${digitsOnly}` : '',
        national: digitsOnly,
        international: `+${digitsOnly}`,
        countryCode: digitsOnly.substring(0, 3),
        nationalNumber: digitsOnly.substring(3),
        error: !isValid && digitsOnly.length > 0 ? 'Invalid phone number' : ''
      };
    }
  },

  /**
   * Get suggested country from phone number
   * @param {string} phoneNumber - Raw phone number
   * @returns {string} ISO country code
   */
  getCountryFromNumber: (phoneNumber) => {
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    
    // Common country code detection
    if (digitsOnly.startsWith('91') || (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly))) {
      return 'IN'; // India
    } else if (digitsOnly.startsWith('1')) {
      return 'US'; // US/Canada
    } else if (digitsOnly.startsWith('44')) {
      return 'GB'; // UK
    } else if (digitsOnly.startsWith('86')) {
      return 'CN'; // China
    } else if (digitsOnly.startsWith('81')) {
      return 'JP'; // Japan
    }
    
    return 'IN'; // Default to India
  },

  /**
   * Format phone number for display
   * @param {string} phoneNumber - Phone number in any format
   * @param {string} format - 'national' | 'international' | 'e164'
   * @returns {string} Formatted phone number
   */
  formatForDisplay: (phoneNumber, format = 'national') => {
    if (!phoneNumber) return '';
    
    const validation = phoneValidator.validate(phoneNumber);
    
    if (!validation.isValid) return phoneNumber;
    
    switch (format) {
      case 'international':
        return validation.international;
      case 'e164':
        return validation.e164;
      case 'national':
      default:
        return validation.national;
    }
  }
};

/**
 * React Native Phone Input Component Helper
 */
export const phoneInputHelper = {
  /**
   * Get props for React Native TextInput with phone formatting
   */
  getInputProps: (value, onChangeText, countryCode = 'IN') => {
    return {
      value: value,
      onChangeText: (text) => {
        const result = phoneValidator.formatAsYouType(text, countryCode);
        onChangeText(result.formatted, result);
      },
      keyboardType: 'phone-pad',
      placeholder: countryCode === 'IN' ? '98765 43210' : 'Phone number',
      maxLength: 15
    };
  },

  /**
   * Get validation styling based on phone validity
   */
  getValidationStyle: (phoneData) => {
    if (!phoneData || !phoneData.raw) {
      return { borderColor: '#E0E0E0' }; // Default
    }
    
    if (phoneData.raw.length < 10) {
      return { borderColor: '#FFA726' }; // Warning (incomplete)
    }
    
    return phoneData.isValid 
      ? { borderColor: '#4CAF50' } // Success
      : { borderColor: '#F44336' }; // Error
  },

  /**
   * Get validation message
   */
  getValidationMessage: (phoneData) => {
    if (!phoneData || !phoneData.raw) {
      return '';
    }
    
    if (phoneData.raw.length === 0) {
      return '';
    }
    
    if (phoneData.raw.length < 10) {
      return 'Enter a complete phone number';
    }
    
    if (!phoneData.isValid) {
      return 'Please enter a valid phone number';
    }
    
    return '✓ Valid phone number';
  }
};