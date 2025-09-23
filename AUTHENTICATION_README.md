# ClickO Authentication & Mode Switching System

## Overview
This document describes the authentication system and user/agent mode switching functionality implemented in the ClickO app.

## Key Concepts

### User Types & States
- **User**: Regular customer who books services
- **Agent**: Service provider who offers services
- **Dual Role**: A user can have agent capabilities while maintaining user functionality

### Authentication States
- **`isAgent`**: Boolean indicating if user has completed agent onboarding (capability)
- **`currentMode`**: String ('user' | 'agent') indicating active mode
- **`agentOnboardingCompleted`**: Boolean indicating if agent profile exists in database

## Architecture

### Database Schema
```
User Table:
- id (primary key)
- email, name, phone
- is_agent (boolean) - DEPRECATED: Use Agent table existence instead

Agent Table:
- id (primary key) 
- user_id (foreign key to User.id)
- business_name, services, location, etc.
```

### Authentication Flow

#### Login Process
1. User logs in with email/password
2. JWT token issued with 30-day expiration (mobile-friendly)
3. Frontend checks for Agent profile existence via `/api/agents/profile/{user_id}`
4. Sets `isAgent: true` if Agent profile exists
5. Sets `currentMode` based on:
   - Previous saved preference (SecureStore)
   - Default: 'agent' if has agent profile, 'user' otherwise

#### Mode Switching
- Users with agent profiles can toggle between 'user' and 'agent' modes
- Mode persists across app restarts via SecureStore
- Only affects UI/navigation, doesn't change underlying permissions

## Implementation Details

### AuthContext (`/app/contexts/AuthContext.js`)
Key functions:
- `loadUserFromStorage()`: Validates tokens, checks agent profile existence
- `login()`: Authenticates user, sets appropriate mode
- `toggleAgentMode()`: Switches between user/agent modes with validation
- `checkAgentProfile()`: Verifies agent profile exists in database

### Navigation (`/app/navigation/AppNavigator.js`)
- Routes based on `currentMode` for consistent experience
- Home screen: `currentMode === 'agent' ? AgentHomeScreen : HomeScreen`
- Profile screen: `currentMode === 'agent' ? AgentProfilePage : CustomerProfilePage`
- Tab labels/icons reflect current mode

### UI Components
- UserProfileScreen: Shows appropriate dashboard based on `currentMode`
- Mode switching toggle only visible to users with agent capabilities
- Wallet display only in agent mode
- Stats sections match current mode

## Error Handling

### Token Expiration
- 30-day JWT tokens for mobile UX
- Automatic token validation on app startup
- Graceful fallback to login screen if token invalid

### Network Issues
- HTML response detection (GitHub Codespaces port forwarding)
- Retry logic for API calls
- Fallback agent stats when backend unavailable

### Agent Profile Sync
- Always check actual Agent table, not User.is_agent column
- Handle cases where User.is_agent is out of sync with Agent table
- Graceful degradation if agent profile is missing

## Testing Scenarios

### User Without Agent Profile
- Login → User mode only
- Cannot switch to agent mode
- Sees customer dashboard and regular home screen

### User With Agent Profile
- Login → Agent mode by default (or last used mode)
- Can toggle between user/agent modes
- Sees appropriate screens based on current mode
- Mode persists across app restarts

### Agent Identity Recovery
- If User.is_agent becomes false but Agent profile exists
- System corrects on next login by checking actual Agent table
- User regains agent access

## Backend Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Agent Management
- `GET /api/agents/profile/{user_id}` - Check agent profile existence
- `POST /api/agents/create` - Create agent profile
- `GET /api/agents/stats` - Get agent statistics

### Health Check
- `GET /health` - Backend connectivity check

## Security Considerations
- JWT tokens signed and validated
- Agent operations require valid agent profile
- Mode switching only changes UI, not permissions
- Backend validates agent status for sensitive operations

## Recent Fixes (September 2025)

### JWT Token Duration
- Extended from 30 minutes to 30 days for mobile apps
- Prevents frequent re-authentication

### Agent Identity Loss
- Fixed issue where users lost agent identity after token renewal
- Now checks actual Agent table instead of User.is_agent column

### Mode Switching
- Implemented persistent user/agent mode switching
- Users can toggle modes anytime with state preservation
- Navigation and UI properly reflect chosen mode

### Error Handling
- Enhanced HTML response detection
- Better handling of backend connectivity issues
- Improved user feedback for authentication errors

## Configuration

### JWT Settings (`/backend/shared/auth/jwt.py`)
```python
ACCESS_TOKEN_EXPIRE_MINUTES = 43200  # 30 days
```

### API Base URL (`/app/services/agentService.js`)
```javascript
const API_BASE_URL = 'http://localhost:8000/api';
```

## Troubleshooting

### Common Issues
1. **401 Errors**: Check token expiration, re-login if needed
2. **Agent Profile Missing**: Verify Agent table has record for user_id
3. **Mode Not Persisting**: Check SecureStore permissions
4. **HTML Responses**: Ensure backend is running on correct port

### Debug Tools
- Backend health check endpoint
- Console logging for authentication flow
- Agent stats fallback for offline testing

## Future Enhancements
- Role-based permissions system
- Agent approval workflow
- Advanced agent analytics
- Multi-tenant support