# UThread - Social Media Platform

UThread is a modern social media platform that combines networking with threaded conversations, inspired by platforms like Twitter's threads feature.

## Features

- User authentication (signup/login)
- Create and view posts
- Threaded conversations
- User profiles
- Responsive design with Material UI

## Tech Stack

- **Frontend**: React + Material UI
- **Backend**: Node.js + Express
- **Database**: MongoDB

## Project Structure

```
UThread/
├── client/ (React Frontend)
├── server/ (Node.js Backend)
└── README.md
```

## Getting Started

### Prerequisites

- Node.js
- MongoDB running on localhost:27017

### Installation

1. Clone the repository
2. Install backend dependencies:
   ```
   cd server
   npm install
   ```

3. Install frontend dependencies:
   ```
   cd client
   npm install
   ```

4. Run the backend:
   ```
   cd server
   npm start
   ```

5. Run the frontend:
   ```
   cd client
   npm start
   ```

## API Endpoints

- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/login` - Login a user
- `GET /api/user/:id` - Get user profile
- `GET /api/posts` - Get all posts
- `POST /api/posts` - Create a new post
- `GET /api/posts/thread/:id` - Get a specific thread

## License

MIT 