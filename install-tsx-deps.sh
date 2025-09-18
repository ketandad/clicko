#!/bin/bash

echo "Installing TypeScript dependencies for TSX files in Clicko app..."

cd /workspaces/clicko/app

# Force install the correct version of @types/react compatible with React 19.1.0
echo "Installing compatible React type definitions..."
npm install --save-dev @types/react@~19.1.10 --force

# Install other necessary TypeScript types
echo "Installing additional TypeScript type definitions..."
npm install --save-dev @types/react-native@~0.73.0 --force

# Install TypeScript and related packages
npm install --save-dev typescript @tsconfig/react-native --force

# Install missing Expo dependencies for TSX files
echo "Installing necessary Expo dependencies for TSX files..."
npx expo install \
  expo-document-picker@~14.0.7 \
  expo-image-picker@~17.0.8 \
  expo-location@~19.0.7 \
  expo-secure-store@~15.0.7 \
  react-native-maps@1.20.1 \
  expo-router \
  expo-web-browser \
  expo-linking \
  expo-constants \
  @expo/vector-icons \
  expo-status-bar \
  --force

# Update TypeScript ESLint plugins
echo "Installing TypeScript ESLint plugins..."
npm install --save-dev \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  --force

# Make sure React Navigation types are installed
npm install --save-dev @types/react-navigation --force

# Create a paths.d.ts file to help with module resolution
echo "Creating paths.d.ts file for module resolution..."
cat > /workspaces/clicko/app/paths.d.ts << 'EOL'
// This file defines path aliases for TypeScript
declare module '@/*' {
  const value: any;
  export default value;
  export * from any;
}
EOL

echo "All TypeScript dependencies for TSX files have been installed successfully!"