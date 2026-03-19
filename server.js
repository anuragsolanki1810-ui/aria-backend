const express = require('express');
const cors = require('cors');

const app = express();
const port = 4000;

app.use(cors());
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Chat history stored per session
const sessions = {};

app.get('/health', function(req, res) {
  res.json({ status: 'ok', message: 'ARIA backend is running' });
});

app.post('/chat', async function(req, res) {
  const message = req.body.message;
  const system = req.body.system || `You are ARIA, a friendly and helpful voice assistant.
Your personality: warm, witty, and concise.
Keep ALL responses to 1-3 sentences — you are speaking aloud, not writing.
No markdown, no bullet points, no lists.`;
  const sessionId = req.body.sessionId || 'default';

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  // Initialize session history if new
  if (!sessions[sessionId]) {
    sessions[sessionId] = [];
  }

  // Add user message to history
  sessions[sessionId].push({ role: 'user', content: message });

  // Keep only last 10 messages to avoid token limits
  if (sessions[sessionId].length > 10) {
    sessions[sessionId] = sessions[sessionId].slice(-10);
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GROQ_API_KEY,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 300,
        messages: [
          { role: 'system', content: system },
          ...sessions[sessionId],
        ],
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Groq error:', data.error.message);
      return res.status(500).json({ error: data.error.message });
    }

    const reply = data.choices[0].message.content;

    // Add assistant reply to history
    sessions[sessionId].push({ role: 'assistant', content: reply });

    res.json({ reply: reply });

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Clear history for a session
app.post('/clear', function(req, res) {
  const sessionId = req.body.sessionId || 'default';
  sessions[sessionId] = [];
  res.json({ status: 'cleared' });
});

app.listen(port, function() {
  console.log('ARIA backend running on http://localhost:' + port);
});
