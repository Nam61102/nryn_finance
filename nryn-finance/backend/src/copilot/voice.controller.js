'use strict';
const multer = require('multer');
const { transcribeAudio } = require('../ai/whisper.client');

// Multer memory storage configuration (up to 10MB audio)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.originalname.match(/\.(m4a|wav|mp3|ogg|webm|aac)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are permitted for transcription.'));
    }
  },
});

exports.uploadMiddleware = upload.single('audio');

exports.transcribe = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        ok: false,
        error: 'audio_file_required',
        message: 'An audio file buffer is required in the "audio" form field.',
      });
    }

    const { buffer, originalname, mimetype } = req.file;
    const prompt = req.body?.prompt || 'Marathi, Hindi, Hinglish, Indian Personal Finance, UPI, Rupee amounts';

    const result = await transcribeAudio(
      buffer,
      originalname || 'recording.m4a',
      mimetype || 'audio/m4a',
      { prompt }
    );

    return res.json(result);
  } catch (err) {
    if (err.code === 'STT_UNAVAILABLE') {
      return res.status(503).json({
        ok: false,
        error: 'stt_unavailable',
        message: err.message,
      });
    }
    next(err);
  }
};
