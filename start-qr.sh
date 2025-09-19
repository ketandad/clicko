#!/bin/bash

# ClickO Quick Start - Shows QR Code in Terminal

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}🚀 ClickO Quick Start with QR Code${NC}"
echo -e "${BLUE}═══════════════════════════════════${NC}"

# Cleanup
echo -e "${YELLOW}🧹 Cleaning up...${NC}"
pkill -f "python.*main.py" 2>/dev/null || true
pkill -f "expo start" 2>/dev/null || true
pkill -f "uvicorn" 2>/dev/null || true
sleep 2

# Start backend
echo -e "${BLUE}🔧 Starting backend...${NC}"
cd /workspaces/clicko/backend
nohup python main.py > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"

# Wait for backend
echo -e "${YELLOW}⏳ Waiting for backend...${NC}"
for i in {1..10}; do
    if curl -s http://localhost:8000/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend ready${NC}"
        break
    fi
    sleep 1
done

# Configure app
echo -e "${BLUE}📱 Configuring app...${NC}"
cd /workspaces/clicko/app
IP=$(hostname -I | awk '{print $1}')

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

echo -e "${GREEN}✅ Config updated with IP: $IP${NC}"

# Start Expo with QR code visible
echo -e "${BLUE}📱 Starting Expo with QR code...${NC}"
echo -e "${CYAN}══════════════════════════════════════${NC}"
echo -e "${CYAN}📱 Mobile App:${NC} Scan QR code below with Expo Go"
echo -e "${CYAN}🌐 Backend:${NC} http://localhost:8000/health"
echo -e "${CYAN}══════════════════════════════════════${NC}"
echo ""

# Start Expo in foreground to show QR code
npx expo start --tunnel --clear

# Cleanup on exit
echo -e "\n${YELLOW}🛑 Cleaning up...${NC}"
kill $BACKEND_PID 2>/dev/null || true
pkill -f "python.*main.py" 2>/dev/null || true
echo -e "${GREEN}✅ Cleanup complete${NC}"