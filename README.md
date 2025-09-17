# Clicko

A modern mobile application with React Native frontend, FastAPI backend, and PostgreSQL database featuring user authentication.

## Project Structure

```
clicko/
├── mobile/                 # React Native mobile app
│   ├── src/
│   │   ├── screens/       # App screens (Home, Login, Register)
│   │   ├── services/      # API services
│   │   ├── types/         # TypeScript type definitions
│   │   └── App.tsx        # Main app component
│   └── package.json
├── backend/               # FastAPI microservices
│   ├── auth_service/      # Authentication service
│   ├── user_service/      # User management service
│   ├── database/          # Database models and connection
│   ├── main.py           # FastAPI main application
│   └── requirements.txt
├── database/             # Database scripts
│   └── init.sql         # Database initialization
└── docker-compose.yml   # Docker configuration
```

## Features

- **Mobile App (React Native)**
  - Welcome screen with modern UI
  - User registration with validation
  - Email/password authentication
  - Navigation between screens
  - TypeScript support

- **Backend (FastAPI)**
  - Microservices architecture
  - JWT-based authentication
  - Password hashing with bcrypt
  - RESTful API endpoints
  - PostgreSQL integration

- **Database (PostgreSQL)**
  - User management
  - Secure password storage
  - Timestamp tracking
  - Proper indexing

## Quick Start

### Prerequisites

- Node.js 16+ (for React Native)
- Python 3.11+ (for FastAPI)
- Docker & Docker Compose (for database)
- React Native development environment

### 1. Setup Database

```bash
# Start PostgreSQL with Docker
docker-compose up postgres -d

# Wait for database to be ready, then create tables
cd backend
cp .env.example .env
python create_db.py
```

### 2. Setup Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Start the API server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

### 3. Setup Mobile App

```bash
cd mobile

# Install dependencies
npm install

# For iOS (requires Xcode)
npx react-native run-ios

# For Android (requires Android Studio)
npx react-native run-android
```

## API Documentation

Once the backend is running, visit:
- API Documentation: `http://localhost:8000/docs`
- Alternative docs: `http://localhost:8000/redoc`

### Authentication Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### User Endpoints

- `GET /api/users/profile` - Get user profile

## Environment Variables

### Backend (.env)

```env
DATABASE_URL=postgresql://clicko_user:clicko_password@localhost:5432/clicko_db
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
DEBUG=True
```

### Mobile App

Update the API URL in `mobile/src/services/authService.ts`:

```typescript
const API_BASE_URL = 'http://localhost:8000/api'; // Update for production
```

## Development

### Running with Docker

```bash
# Start all services
docker-compose up

# Start specific services
docker-compose up postgres backend
```

### Testing

```bash
# Backend tests
cd backend
pytest

# Mobile app tests (if configured)
cd mobile
npm test
```

## Production Deployment

1. **Database**: Use managed PostgreSQL service
2. **Backend**: Deploy to cloud platforms (AWS, GCP, Azure)
3. **Mobile**: Build and publish to app stores

### Security Notes

- Change the `SECRET_KEY` in production
- Use environment-specific CORS origins
- Enable HTTPS in production
- Use secure password policies

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.