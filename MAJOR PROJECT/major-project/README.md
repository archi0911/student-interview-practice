# AI Interview Simulation Platform

An intelligent platform that simulates real interview environments using Google Gemini for question generation and evaluation, and the Web Speech API for voice-driven interaction.

---

## 🛠️ Setup Instructions

### 1. Prerequisites
- [Node.js](https://nodejs.org/) installed
- A [Supabase](https://supabase.com/) project
- A [Google Gemini API Key](https://aistudio.google.com/)

### 2. Database Setup (Supabase)
1. Go to your Supabase Dashboard → **SQL Editor**.
2. Create a **New Query**.
3. Copy the contents of `backend/supabase_schema.sql` and run it. This will create the required tables and RLS policies.

### 3. Backend Configuration
1. Navigate to the `backend/` folder.
2. Create a `.env` file based on `.env.example`:
   ```env
   PORT=3000
   GEMINI_API_KEY=your_gemini_api_key_here
   SUPABASE_URL=your_supabase_project_url_here
   SUPABASE_ANON_KEY=your_supabase_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
   ```
3. Install dependencies: `npm install`

### 4. Frontend Configuration
1. Navigate to the `frontend/` folder.
2. Create a `.env` file based on `.env.example`:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url_here
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```
3. Install dependencies: `npm install`

---

## 🚀 How to Run

You will need **two terminal windows** open.

### Terminal 1: Backend
```bash
cd backend
npm run start
```

### Terminal 2: Frontend
```bash
cd frontend
npm run dev
```

The app will be available at: **http://localhost:5173**

---

## 💡 Key Features
- **Voice Interaction**: Auto-speaks questions and records answers via microphone.
- **Resume Parsing**: Tailored questions based on your PDF/DOCX resume skills.
- **AI Evaluation**: Immediate scoring and coaching feedback from Gemini.
- **Performance Tracking**: Track your progress over time in the History dashboard.
