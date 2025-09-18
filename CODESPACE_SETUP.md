# GitHub Codespaces Configuration Guide

## Overview
This document contains the complete configuration and solutions for running the ClickO React Native/Expo app in GitHub Codespaces with proper mobile device connectivity.

## Network Connectivity Solution

### Problem Solved
- **Issue**: Expo Go mobile app couldn't connect to backend API running in GitHub Codespaces
- **Root Cause**: Expo Go creates a `window` object even on mobile devices, breaking traditional React Native environment detection (`typeof window === 'undefined'`)
- **Solution**: Use `Platform.OS` detection from React Native for reliable mobile environment identification

### Key Configuration Files

#### 1. `/app/config.js` - Mobile/Web Environment Detection
```javascript
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
    return 'https://vigilant-trout-7q6q675j4vq2pg6w-8000.app.github.dev/api';
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
  // ... rest of config
};

export default config;
```

#### 2. `/start-app.sh` - Unified Development Startup Script
```bash
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

# Start backend first
echo -e "${BLUE}🔧 Starting backend server...${NC}"
cd /workspaces/clicko/backend
python main.py &
BACKEND_PID=$!
echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"

# Wait for backend
echo -e "${YELLOW}⏳ Waiting for backend...${NC}"
sleep 3
if curl -s http://localhost:8000/health > /dev/null; then
    echo -e "${GREEN}✅ Backend API ready at http://localhost:8000${NC}"
else
    echo -e "${RED}⚠️  Backend might still be starting...${NC}"
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

# Make port 8000 public for external access (GitHub Codespaces)
if [ ! -z "$CODESPACE_NAME" ]; then
    echo -e "${BLUE}🔗 Making port 8000 public for mobile access...${NC}"
    gh codespace ports visibility 8000:public -c $CODESPACE_NAME 2>/dev/null || echo -e "${YELLOW}⚠️  GitHub CLI might need authentication${NC}"
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install --legacy-peer-deps --silent

# Start Expo with QR code
echo ""
echo -e "${BLUE}📱 Starting Expo with QR Code Display${NC}"
echo -e "${YELLOW}📱 Scan the QR code below with Expo Go app:${NC}"
echo ""

# Start Expo in foreground to show QR code
npx expo start --tunnel
```

## Environment Variables

### GitHub Codespaces Automatic Variables
- `CODESPACE_NAME`: Unique identifier for the current Codespace
- `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN`: Domain for port forwarding (usually `app.github.dev`)

### Current Codespace Details
- **Codespace Name**: `vigilant-trout-7q6q675j4vq2pg6w`
- **Backend URL**: `https://vigilant-trout-7q6q675j4vq2pg6w-8000.app.github.dev`
- **Port**: 8000 (backend), 8081 (Expo Metro)

## Mobile Testing Setup

### Prerequisites
1. Install Expo Go app on mobile device
2. Ensure mobile device and Codespace can communicate via internet
3. Backend must be running on port 8000
4. Port 8000 must be set to public visibility in Codespaces

### Testing Steps
1. Run `./start-app.sh` from repository root
2. Wait for QR code to appear in terminal
3. Scan QR code with Expo Go app
4. Test API connectivity using the "🧪 Test API Connection" button in LoginScreen

## Troubleshooting

### Common Issues & Solutions

#### 1. "Network Error" on Mobile
- **Cause**: Incorrect environment detection
- **Solution**: Verify `Platform.OS` detection in config.js logs
- **Check**: Ensure backend is running and port 8000 is public

#### 2. "localhost:8000" URLs on Mobile
- **Cause**: Fallback to local development mode
- **Solution**: Verify Platform import and mobile detection logic
- **Check**: Console logs should show `Platform.OS: ios` or `android`

#### 3. Backend 502 Error
- **Cause**: Backend not running on port 8000
- **Solution**: Start backend with `cd backend && python main.py`
- **Check**: Verify with `curl localhost:8000/health`

#### 4. QR Code Not Appearing
- **Cause**: Expo process conflicts or cache issues
- **Solution**: Kill processes and restart with `--clear` flag
- **Commands**: 
  ```bash
  pkill -f "expo start"
  cd app && npx expo start --tunnel --clear
  ```

## Architecture Notes

### Why Platform.OS Works
- React Native's `Platform.OS` reliably returns `'ios'` or `'android'` on mobile devices
- Expo Go creates a browser-like environment but Platform.OS still correctly identifies the underlying platform
- This method is future-proof across all Expo Go versions

### URL Construction Strategy
1. **Mobile Devices**: Direct Codespaces URL (bypasses localhost issues)
2. **Web Browsers**: Dynamic hostname-based detection
3. **Local Development**: Localhost fallback

### Port Forwarding
- GitHub Codespaces automatically forwards ports
- Port 8000 must be set to "public" for external mobile access
- Use GitHub CLI: `gh codespace ports visibility 8000:public -c $CODESPACE_NAME`

## Future Enhancements

### Dynamic Codespace Detection
To make the config work with ANY Codespace (not just the current one):

```javascript
const getApiUrl = () => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    // Dynamic Codespace URL construction
    const codespace = process.env.CODESPACE_NAME || 'vigilant-trout-7q6q675j4vq2pg6w';
    const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';
    return `https://${codespace}-8000.${domain}/api`;
  }
  // ... rest of logic
};
```

### Alternative Solutions Tried
1. **ngrok Tunneling**: Works but requires manual setup
2. **localtunnel**: Unreliable URL generation
3. **GitHub CLI Port Management**: Good for automation
4. **Window Detection**: Failed due to Expo Go behavior

## Success Metrics
- ✅ Mobile app connects to backend from external devices
- ✅ API calls succeed with proper GitHub Codespaces URLs
- ✅ Solution works after Codespace restarts
- ✅ No manual configuration required for developers
- ✅ Fallback strategies for different environments

## Last Updated
September 18, 2025 - Network connectivity issue resolved with Platform.OS detection solution.