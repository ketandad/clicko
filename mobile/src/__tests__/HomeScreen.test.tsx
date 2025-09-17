import React from 'react';
import {render} from '@testing-library/react-native';
import {NavigationContainer} from '@react-navigation/native';
import HomeScreen from '../screens/HomeScreen';

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
}));

describe('HomeScreen', () => {
  it('renders welcome message correctly', () => {
    const {getByText} = render(
      <NavigationContainer>
        <HomeScreen />
      </NavigationContainer>
    );

    expect(getByText('Clicko')).toBeTruthy();
    expect(getByText('Welcome to your new app experience')).toBeTruthy();
    expect(getByText('Get Started')).toBeTruthy();
    expect(getByText('Login')).toBeTruthy();
    expect(getByText('Create Account')).toBeTruthy();
  });

  it('navigates to login when login button is pressed', () => {
    const {getByText} = render(
      <NavigationContainer>
        <HomeScreen />
      </NavigationContainer>
    );

    const loginButton = getByText('Login');
    loginButton.props.onPress();

    expect(mockNavigation.navigate).toHaveBeenCalledWith('Login');
  });
});