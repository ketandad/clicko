#!/bin/bash

# ClickO Complete App Starter (Future-Proof Edition)
# Auto-detects environment and configures accordingly

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting ClickO App${NC}"
echo "================================"

# Clean up any existing processes
echo -e "${YELLOW}🧹 Cleaning up existing processes...${NC}"
pkill -f "python.*main.py" 2>/dev/null || true
pkill -f "expo start" 2>/dev/null || true
pkill -f "uvicorn" 2>/dev/null || true
sleep 2

# Install backend dependencies first
echo -e "${BLUE}🔧 Installing backend dependencies...${NC}"
cd /workspaces/clicko/backend

# Deactivate virtual environment if active and use system Python
if [ ! -z "$VIRTUAL_ENV" ]; then
    deactivate 2>/dev/null || true
fi

# Use system Python to install packages
/usr/bin/python3 -m pip install --break-system-packages fastapi uvicorn pydantic[email] pytz aiohttp || echo -e "${YELLOW}⚠️  Some packages may already be installed${NC}"

# Start backend server
echo -e "${BLUE}🔧 Starting backend server...${NC}"
/usr/bin/python3 main.py &
BACKEND_PID=$!
echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"

# Wait for backend to start
echo -e "${YELLOW}⏳ Waiting for backend to initialize...${NC}"
sleep 5
if curl -s http://localhost:8000/health > /dev/null; then
    echo -e "${GREEN}✅ Backend API ready at http://localhost:8000${NC}"
else
    echo -e "${YELLOW}⚠️  Backend still starting... (check logs if issues persist)${NC}"
fi

# Configure mobile app
echo -e "${BLUE}📱 Configuring mobile app...${NC}"
cd /workspaces/clicko/app

# Auto-detect environment and build correct URL (FUTURE-PROOF)
if [ ! -z "$CODESPACE_NAME" ]; then
    # GitHub Codespaces environment
    BACKEND_URL="https://$CODESPACE_NAME-8000.$GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN"
    ENV_TYPE="GitHub Codespaces"
elif [ ! -z "$GITPOD_WORKSPACE_URL" ]; then
    # GitPod environment
    BACKEND_URL="https://8000-${GITPOD_WORKSPACE_URL#https://}"
    ENV_TYPE="GitPod"
else
    # Local development
    BACKEND_URL="http://localhost:8000"
    ENV_TYPE="Local Development"
fi

echo -e "${GREEN}✅ Environment: $ENV_TYPE${NC}"
echo -e "${GREEN}✅ Backend URL: $BACKEND_URL${NC}"
echo -e "${YELLOW}📱 Mobile apps will auto-connect to: $BACKEND_URL/api${NC}"

# Generate future-proof config
cat > config.js << 'CONFIGEOF'
// config.js - Auto-generated configuration (Future-proof)
import { Platform } from 'react-native';

const isBrowser = typeof window !== 'undefined';

let hostname = 'localhost';
if (isBrowser && window.location) {
  hostname = window.location.hostname;
}

const getApiUrl = () => {
  // For React Native / Expo Go - use Platform.OS for reliable mobile detection
  // Expo Go creates window object even on mobile, so typeof window check fails
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return 'BACKEND_URL_PLACEHOLDER/api';
  }
  
  // For web browsers - use current hostname logic
  if (hostname.includes('github.dev') || hostname.includes('githubpreview.dev')) {
    return 'https://' + hostname.replace(/^[^-]+-/, '').replace(/\.github\.dev$/, '') + '-8000.app.github.dev/api';
  }
  
  if (hostname.includes('gitpod.io')) {
    return 'https://8000-' + hostname + '/api';
  }
  
  // Local development fallback
  return 'http://localhost:8000/api';
};

const config = {
  API_URL: getApiUrl(),
  API_TIMEOUT: 30000,
  colors: {
    primary: '#007AFF',
    secondary: '#5856D6', 
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    background: '#F2F2F7',
    surface: '#FFFFFF',
    text: '#000000',
    textSecondary: '#8E8E93',
    border: '#C6C6C8',
    accent: '#FF3B30',
    disabled: '#C6C6C8'
  },
  DEBUG: __DEV__ || false,
  LOG_LEVEL: 'info'
};

console.log('API Configuration:', config.API_URL);

export default config;
CONFIGEOF

# Replace placeholder with actual URL
sed -i "s|BACKEND_URL_PLACEHOLDER|$BACKEND_URL|g" config.js

echo -e "${GREEN}✅ Configuration generated${NC}"

# Make port 8000 public for external access (GitHub Codespaces)
if [ ! -z "$CODESPACE_NAME" ]; then
    echo -e "${BLUE}🔗 Making port 8000 public for mobile access...${NC}"
    gh codespace ports visibility 8000:public -c $CODESPACE_NAME 2>/dev/null || echo -e "${YELLOW}⚠️  GitHub CLI might need authentication${NC}"
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install --legacy-peer-deps --silent

echo -e "${YELLOW}📦 Installing additional packages...${NC}"
npm install expo-document-picker --legacy-peer-deps --silent
npm install @react-navigation/stack --legacy-peer-deps --silent  
npm install @react-native-community/datetimepicker --legacy-peer-deps --silent
npm install expo-notifications --legacy-peer-deps --silent
npm install @types/react@^18.2.0 --save-dev --legacy-peer-deps --silent

echo -e "${GREEN}✅ Dependencies ready${NC}"

# Clear Metro cache to resolve bundling issues
echo -e "${YELLOW}🧹 Clearing Metro cache...${NC}"
rm -rf .expo node_modules/.cache .metro 2>/dev/null || true

# Optional: Update Expo packages for better compatibility
echo -e "${YELLOW}🔧 Checking for package updates...${NC}"
echo -e "${BLUE}ℹ️  To fix version warnings, run: npx expo install --fix${NC}"

# Start Expo with QR code
echo ""
echo -e "${BLUE}📱 Starting Expo with QR Code Display${NC}"
echo -e "${YELLOW}📱 Scan the QR code below with Expo Go app:${NC}"
echo ""

# Start Expo in foreground to show QR code
npx expo start --tunnel
