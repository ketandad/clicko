#!/bin/bash

echo "Starting ClickO app with Expo..."

# Navigate to app directory
cd /workspaces/clicko/app

# Install dependencies
echo "Installing dependencies..."
npm install --force
echo "Ensuring expo-document-picker is installed..."
npm install expo-document-picker --force

# Setup TypeScript dependencies
echo "Setting up TypeScript dependencies..."
npm install @types/react@~19.1.10 @types/react-dom@~19.0.0 --force

# Fix React module not found error
echo "Fixing 'cannot find module react' error..."
# Make sure TypeScript can find React
touch node_modules/react/index.d.ts

# Create a metro.config.js file if it doesn't exist to enhance module resolution
if [ ! -f metro.config.js ]; then
  cat > metro.config.js << 'EOL'
// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = config;
EOL
fi

# Start Expo with tunnel"Starting ClickO app with Expo..."

# Navigate to app directory
cd /workspaces/clicko/app

# Install dependencies
echo "Installing dependencies..."
npm install --force
echo "Ensuring expo-document-picker is installed..."
npm install expo-document-picker --force

# Setup TypeScript to avoid dependency issues
echo "Setting up TypeScript dependencies..."
npm install @types/react@~18.2.0 --force

# Start Expo with tunnel
echo "Starting Expo server with tunnel option..."
npx expo start --tunnel
