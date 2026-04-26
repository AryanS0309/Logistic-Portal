const fs = require('fs');
const path = require('path');
const { createGzip } = require('zlib');
const { Transform } = require('stream');

// Custom logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logEntry = `[${timestamp}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms - ${req.ip}\n`;
    
    if (process.env.NODE_ENV === 'development') {
      const color = res.statusCode >= 400 ? '\x1b[31m' : res.statusCode >= 300 ? '\x1b[33m' : '\x1b[32m';
      console.log(`${color}${logEntry.trim()}\x1b[0m`);
    }
  });
  
  next();
};

// Compress log files using zlib stream
const compressLogFile = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    const readable = fs.createReadStream(inputPath);
    const writable = fs.createWriteStream(outputPath);
    const gzip = createGzip();
    
    readable.pipe(gzip).pipe(writable);
    writable.on('finish', resolve);
    writable.on('error', reject);
  });
};

// Rate limiting middleware
const createRateLimiter = (windowMs, max, message) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!requests.has(key)) {
      requests.set(key, []);
    }
    
    const userRequests = requests.get(key).filter(time => time > windowStart);
    userRequests.push(now);
    requests.set(key, userRequests);
    
    if (userRequests.length > max) {
      return res.status(429).json({ success: false, message });
    }
    
    next();
  };
};

module.exports = { requestLogger, compressLogFile, createRateLimiter };
