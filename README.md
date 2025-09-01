# Call Insights: Live Call Analytics Platform 

## Impetus × AWS

**Call Insights** is a full-stack application that provides real-time and post-call analytics for call centers and customer support teams. It leverages AI-powered transcription, sentiment analysis, and data management to enhance call center operations.

## Screenshot 
<img width="1009" height="571" alt="image" src="https://github.com/user-attachments/assets/05ed6b0a-fff8-43c6-8f29-164becc47d4a" />


Features

- **AI Chatbot**: Interact with an AI assistant for instant support and insights.
- **Voice Transcriber**: Real-time speech-to-text transcription using your microphone.
- **Call Simulator**: Practice and analyze simulated customer interactions with live insights.
- **Data Manager**: Upload, manage, and analyze call recordings and documents (text, PDF, images, audio).
- **Live Analytics**: Real-time and historical insights into call data.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Radix UI, React Router
- **Backend**: FastAPI, Uvicorn, Boto3 (AWS S3/Transcribe), WebSockets, Python
- **Cloud**: AWS S3 (storage), AWS Transcribe (speech-to-text)

## Project Structure

```
.
├── backend/
│   ├── main.py              # FastAPI backend with REST & WebSocket endpoints
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # AWS credentials and config
└── frontend/
    ├── src/                 # React source code
    ├── package.json         # Frontend dependencies and scripts
    └── vite.config.js       # Vite config (with API proxy)
```

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- Python 3.8+
- AWS account with S3 and Transcribe permissions

### Backend Setup

1. **Install dependencies:**

   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
2. **Configure AWS credentials:**
   Create a `.env` file in `backend/` with:

   ```
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   S3_BUCKET_NAME=your-s3-bucket
   AWS_DEFAULT_REGION=us-east-1
   ```
3. **Run the backend:**

   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend Setup

1. **Install dependencies:**

   ```bash
   cd frontend
   npm install
   ```
2. **Run the frontend:**

   ```bash
   npm run dev
   ```

   The app will be available at [http://localhost:5173](http://localhost:5173) (or as shown in your terminal).
3. **API Proxy:**
   The frontend is configured (via `vite.config.js`) to proxy `/api` requests to the backend at `http://localhost:8000`.

### Usage

- **Dashboard**: Overview of features and quick navigation.
- **AI Chatbot**: Chat with the AI assistant (API integration required).
- **Voice Transcriber**: Click "Start Recording" to transcribe speech in real-time.
- **Call Simulator**: Select a scenario and simulate a customer call with live insights.
- **Data Manager**: Upload and manage files; supported formats: `.txt`, `.pdf`, `.jpg`, `.png`, `.wav`, `.mp3`.

### Environment Variables

- Backend requires AWS credentials and S3 bucket info in `.env`.
- Frontend does not require environment variables for local development.

- Deploy the backend (FastAPI) to a cloud server or service (e.g., AWS EC2, Heroku).
- Deploy the frontend (React) to a static host (e.g., Vercel, Netlify) and configure the API endpoint accordingly.

## License - MIT
