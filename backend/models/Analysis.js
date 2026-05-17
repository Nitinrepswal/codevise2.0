const mongoose = require('mongoose');

const AnalysisSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  language: {
    type: String,
    default: 'Unknown'
  },
  code: {
    type: String,
    default: ''
  },
  sourceCode: {
    type: String,
    default: ''
  },
  score: {
    type: Number,
    default: 0
  },
  verdict: {
    type: String,
    default: ''
  },
  lineCount: {
    type: Number,
    default: 0
  },
  errorCount: {
    type: Number,
    default: 0
  },
  timeComplex: {
    type: String,
    default: ''
  },
  spaceComplex: {
    type: String,
    default: ''
  },
  snapshotVersion: {
    type: Number,
    default: 0
  },
  analysisData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.Analysis || mongoose.model('Analysis', AnalysisSchema);
