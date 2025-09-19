#!/bin/bash

# ClickO Status Checker

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔍 ClickO Service Status${NC}"
echo -e "${BLUE}════════════════════════${NC}"

# Check backend
echo -e "${YELLOW}🔧 Backend Status:${NC}"
if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Backend API responding${NC}"
    echo -e "   🌐 URL: http://localhost:8000"
    echo -e "   🏥 Health: http://localhost:8000/health" 
    echo -e "   📚 Docs: http://localhost:8000/docs"
else
    echo -e "   ${RED}❌ Backend not responding${NC}"
fi

# Check Expo
echo -e "\n${YELLOW}📱 Expo Status:${NC}"
if ps aux | grep -E "expo start" | grep -v grep >/dev/null; then
    echo -e "   ${GREEN}✅ Expo server running${NC}"
    echo -e "   🌐 Local: http://localhost:8081"
    
    # Try to find tunnel URL
    if [ -f /tmp/expo.log ]; then
        TUNNEL_URL=$(grep -o 'exp://[^[:space:]]*' /tmp/expo.log | tail -1)
        if [ ! -z "$TUNNEL_URL" ]; then
            echo -e "   🚇 Tunnel: $TUNNEL_URL"
        fi
    fi
    
    echo -e "   📱 Use Expo Go app to scan QR code"
else
    echo -e "   ${RED}❌ Expo not running${NC}"
fi

# Check running processes
echo -e "\n${YELLOW}⚙️  Active Processes:${NC}"
ps aux | grep -E "(python.*main.py|expo)" | grep -v grep | while read line; do
    echo -e "   🔄 ${line}"
done

# Show quick commands
echo -e "\n${BLUE}🛠️  Quick Commands:${NC}"
echo -e "   📊 Backend logs: tail -f /tmp/backend.log"
echo -e "   📱 Expo logs: tail -f /tmp/expo.log"
echo -e "   🔄 Restart all: ./start-simple.sh"
echo -e "   🛑 Stop all: pkill -f expo; pkill -f main.py"

echo -e "\n${GREEN}✅ Status check complete!${NC}"