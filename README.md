# ClickO RN Mobile App

A full-featured React Native application for instantly connecting users to local service providers ("agents") across 25+ categories. Built with [Expo Go](https://expo.dev/) for rapid development and beautiful UI, [FastAPI](https://fastapi.tiangolo.com/) Python microservices (one per category) for scalable backend, and [PostgreSQL](https://www.postgresql.org/) (with PostGIS) for geospatial queries.

---

## 🚀 Features

### User Features
- **Email-based Registration & Login**
	- Secure signup and authentication, password reset, and email verification.
- **Browse 25+ Categories**
	- Electrician, Plumber, Puncture, House Painting, Carpenter, Cleaning, AC Repair, Appliance Repair, Pest Control, Mobile Repair, Computer Service, Tutoring, Beauty/Spa, Laundry, Home Shifting, Driver, Gardener, Cook/Catering, Event Photographer, Fitness Trainer, Tailor, Locksmith, Water Purifier Service, Car Wash, Babysitter, Pet Care, and more.
- **Instant & Scheduled Booking**
	- Book agents instantly or for a future time; calendar and time picker UI.
- **Agents Sorted by Proximity**
	- View agents in each category, sorted by nearest first using accurate geospatial queries.
- **Live Location Tracking**
	- Track agent's real-time location on map after booking is accepted, similar to taxi apps.
- **Transparent Visit Charges**
	- Charges depend on agent-set rate (₹10–₹50/km) and calculated travel distance; only visit charges shown.
- **Booking History & Status**
	- View upcoming, completed, and cancelled bookings.
- **Profile Management**
	- Edit user details, address, and preferences.
- **Feedback & Ratings**
	- Rate agents and leave feedback after service.

### Agent Features
- **Agent Onboarding via App**
	- Register, select service categories, set per-KM charges, upload documents, manage profile.
- **Wallet Management**
	- Agents start with ₹1000 wallet balance; ₹50 deducted per booking. Top-up options provided.
- **Availability & Status**
	- Switch between "Online" and "Offline" modes easily; automatically set offline for 2 hours after accepting a booking (manual override available).
- **Booking Management**
	- Accept/reject bookings, view schedule, track history.
- **Live Location Sharing**
	- Share real-time location with user after accepting booking.
- **Profile & Service Management**
	- Update service details, rates, documents.

### Additional Features
- **User/Agent Mode Switch**
	- Seamless toggle between user and agent role in-app.
- **Push Notifications**
	- Booking confirmations, reminders, agent arrival, wallet alerts.
- **Admin Dashboard (Web)**
	- Manage agents, users, bookings, wallets; block agents and resolve disputes.
- **Geospatial Backend**
	- PostgreSQL + PostGIS for location sorting and tracking.
- **Microservices Architecture**
	- Each category operates as an independent FastAPI microservice for scalability.
- **Security**
	- JWT authentication, encrypted passwords, secure API endpoints.
- **Manual Testing via Expo Go**
	- Instant device testing with QR code, perfect for rapid iteration.
- **Automated Testing & CI/CD**
	- GitHub Actions for build, test, and deploy; Jest and Pytest for testing.

---

## 🛠️ Tech Stack

- **Frontend:** React Native (Expo Go), React Native Paper/NativeBase, React Navigation, Expo Location/MapView
- **Backend:** Python FastAPI (microservices), PostgreSQL + PostGIS, JWT
- **Notifications:** Expo Notifications / Firebase Cloud Messaging
- **Email:** SendGrid / Mailgun
- **Admin Dashboard:** React/Next.js or simple HTML/JS (optional)
- **DevOps:** Docker, Kubernetes, GitHub Actions

---

## ⚙️ Architecture Overview

- **Expo RN App** for all mobile flows (user & agent).
- **FastAPI Microservices:** Each service category runs its own backend service, with shared user/auth/wallet/notification services.
- **PostgreSQL with PostGIS:** For storing agent/user location and enabling proximity queries.
- **Push Notification Service:** For real-time updates.
- **Admin Dashboard:** For operational monitoring.

---

## 📲 User Journey

1. **User registers with email and logs in.**
2. **Selects a service category → sees agents sorted by distance.**
3. **Views agent’s profile, charges, and rates.**
4. **Books an agent (instant or scheduled).**
5. **On booking acceptance, tracks agent’s live location on map.**
6. **Receives service, pays agent directly.**
7. **Rates agent and leaves feedback.**

---

## 👔 Agent Journey

1. **Agent registers and completes onboarding (category selection, charges, profile, documents).**
2. **Starts with ₹1000 wallet balance.**
3. **Lists as available; accepts bookings.**
4. **Goes offline automatically for 2 hours after booking acceptance (can manually go online).**
5. **Shares live location with user during service.**
6. **Wallet deducted ₹50 per booking; top-up as needed.**
7. **Manages profile, rates, booking history.**

---

## 💸 Monetization

- **No commission from user.**
- **Agent wallet deducted ₹50 per booking for platform usage.**
- **Agents top-up wallet online (UPI integration in future).**

---

## 🔒 Security & Compliance

- Passwords stored hashed (bcrypt).
- Secure JWT-based auth.
- All sensitive traffic secured via HTTPS.
- Option for agent KYC (future phase).

---

## 📝 Development & Testing

- **Manual Testing:**  
	- Use Expo Go to scan QR code and test all flows (login, booking, onboarding, wallet, location).
- **Automated Testing:**  
	- Frontend: Jest/Test Library for screens/components.
	- Backend: Pytest for microservices.
- **CI/CD:**  
	- GitHub Actions for auto-lint, test, build, and deploy (both Expo app and backend).

---

## 🗂️ Project Structure

```
/app
	/screens
	/components
	/services
	/assets
	/navigation
/backend
	/microservices
		/electrician
		/plumber
		... (other categories)
	/shared
		/auth
		/user
		/wallet
		/notifications
/admin-dashboard
/docs
README.md
```

---

## 🚦 Getting Started

1. **Clone the repo**
2. **Install Expo CLI:**  
	 `npm install -g expo-cli`
3. **Start the mobile app:**  
	 `cd app && npx expo start --tunnel`
4. **Scan QR code with Expo Go**
5. **Start backend microservices:**  
	 `cd backend/microservices/electrician && uvicorn main:app --reload`
	 (repeat for other categories)
6. **Configure PostgreSQL with PostGIS**
7. **Set up environment variables (see `/docs/env.sample`)**
8. **Run tests:**  
	 `npm test` (frontend), `pytest` (backend)
9. **Access Admin Dashboard:**  
	 `cd admin-dashboard && npm start`

---

## 📚 API Reference

See `/docs/api.md` for detailed API endpoints, payloads, and usage examples.

---

## 🙌 Contributing

1. Fork the repo and create your branch (`git checkout -b feature/fooBar`)
2. Commit your changes (`git commit -am 'Add new feature'`)
3. Push to the branch (`git push origin feature/fooBar`)
4. Open a Pull Request

See `/docs/contributing.md` for full guidelines.

---

## 📣 Contact

For questions, reach out via [GitHub Issues](https://github.com/ketandad/clicko/issues) or email [support@clickoapp.com](mailto:support@clickoapp.com).

---

## 📄 License

MIT License — see `LICENSE` file for details.

---

**Build. Book. Track. Rate. Repeat. — ClickO, your instant service partner!**
# clicko