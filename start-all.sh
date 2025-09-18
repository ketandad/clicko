#!/bin/bash

# ClickO Production Startup Script
# Optimized for GitHub Codespaces - starts all services reliably

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}🚀 ClickO Production Startup${NC}"
echo -e "${BLUE}════════════════════════════${NC}"

# Comprehensive cleanup
echo -e "${YELLOW}🧹 Comprehensive cleanup...${NC}"
pkill -f "python.*main.py" 2>/dev/null || true
pkill -f "expo start" 2>/dev/null || true
pkill -f "npx expo" 2>/dev/null || true
pkill -f "uvicorn" 2>/dev/null || true

# Kill by port
for port in 8000 8081 8083 19000 19001 19002; do
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
done

sleep 3
echo -e "${GREEN}✅ Cleanup complete${NC}"

# Install dependencies if needed
echo -e "${YELLOW}📦 Checking dependencies...${NC}"
cd /workspaces/clicko/app
if [ ! -d "node_modules" ] || [ ! "$(ls -A node_modules 2>/dev/null)" ]; then
    echo "Installing mobile app dependencies..."
    npm install --legacy-peer-deps --silent
fi
echo -e "${GREEN}✅ Dependencies ready${NC}"

# Start backend
echo -e "${BLUE}🔧 Starting backend server...${NC}"
cd /workspaces/clicko/backend
nohup python main.py > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"

# Wait for backend
echo -e "${YELLOW}⏳ Waiting for backend API...${NC}"
for i in {1..15}; do
    if curl -s http://localhost:8000/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend API is ready${NC}"
        break
    fi
    sleep 1
    echo -n "."
done

# Configure mobile app
echo -e "${BLUE}📱 Configuring mobile app...${NC}"
cd /workspaces/clicko/app

# Auto-detect IP
IP=$(hostname -I | awk '{print $1}' | head -1)
if [ -z "$IP" ]; then
    IP="localhost"
fi
echo -e "${GREEN}✅ Using IP: $IP${NC}"

# Generate optimized config
cat > config.js << EOF
// config.js - Production Configuration for ClickO

const isBrowser = typeof window !== 'undefined';

// Get hostname safely
let hostname = 'localhost';
if (isBrowser && window.location) {
  hostname = window.location.hostname;
}

// Smart API URL detection
const getApiUrl = () => {
  // React Native / Expo Go environment
  if (typeof window === 'undefined') {
    return 'http://$IP:8000/api';
  }
  
  // GitHub Codespace web environment
  if (hostname.includes('github.dev') || hostname.includes('githubpreview.dev')) {
    return 'https://vigilant-trout-7q6q675j4vq2pg6w-8000.app.github.dev/api';
  }
  
  // Local development
  return 'http://localhost:8000/api';
};

export const config = {
  API_URL: getApiUrl(),
  API_TIMEOUT: 15000,
  
  // Theme colors - React Native Paper compatible
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
  
  // Development settings
  DEBUG: __DEV__ || false,
  LOG_LEVEL: 'info'
};

export default config;
EOF

echo -e "${GREEN}✅ Configuration updated${NC}"

# Start Expo with enhanced options
echo -e "${BLUE}📱 Starting Expo development server...${NC}"
cd /workspaces/clicko/app

# Start Expo interactively to show QR code
echo -e "${YELLOW}🎯 Starting Expo with QR code display...${NC}"
npx expo start --tunnel --clear &
EXPO_PID=$!

echo -e "${GREEN}✅ Expo started (PID: $EXPO_PID)${NC}"

# Wait for Expo to be ready
echo -e "${YELLOW}⏳ Waiting for Expo tunnel...${NC}"
for i in {1..30}; do
    if grep -q "Tunnel ready" /tmp/expo.log 2>/dev/null; then
        echo -e "${GREEN}✅ Expo tunnel is ready${NC}"
        break
    fi
    sleep 1
    echo -n "."
done

echo ""
echo -e "${GREEN}🎉 ClickO is ready!${NC}"
echo -e "${CYAN}══════════════════════════════════════${NC}"
echo -e "${CYAN}📱 Mobile App:${NC} Scan QR code with Expo Go app"
echo -e "${CYAN}🌐 Backend API:${NC} http://localhost:8000"
echo -e "${CYAN}🏥 Health Check:${NC} http://localhost:8000/health"
echo -e "${CYAN}📊 API Docs:${NC} http://localhost:8000/docs"
echo -e "${CYAN}══════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}� Service Status:${NC}"
echo -e "   Backend PID: $BACKEND_PID"
echo -e "   Expo PID: $EXPO_PID"
echo ""
echo -e "${YELLOW}📝 Logs:${NC}"
echo -e "   Backend: tail -f /tmp/backend.log"
echo -e "   Expo: tail -f /tmp/expo.log"
echo ""

# Show QR code from log
echo -e "${BLUE}📱 QR Code for Mobile:${NC}"
sleep 2
if [ -f /tmp/expo.log ]; then
    # Extract and show QR code if available
    tail -50 /tmp/expo.log | grep -A 15 "▄▄▄▄▄" 2>/dev/null || {
        echo -e "${YELLOW}⏳ QR code loading... check: tail -f /tmp/expo.log${NC}"
    }
fi

echo ""
echo -e "${GREEN}✅ Startup complete! Services are running in background.${NC}"
echo -e "${YELLOW}💡 Tip: Services will continue running. Use 'pkill -f expo; pkill -f main.py' to stop.${NC}"