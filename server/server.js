import express from 'express';
import router from './router/router.js';
import dotenv from 'dotenv';
import cors from "cors";

dotenv.config({ path: '../.env' });

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '5mb' }));   // increased limit for large areas objects
app.use(express.urlencoded({ extended: true, limit: '5mb' })); // optional, good for form data
app.use(cors());

app.use('/', router);
app.use('/process', express.static('/results'));

// JSON parse error handler (prevents crashes on malformed JSON)
app.use((err, _req, res, next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  next(err);
});

app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
