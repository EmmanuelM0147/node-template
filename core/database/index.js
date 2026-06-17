const mongoose = require('mongoose');
const { appLogger } = require('@app-core/logger');

let connectionPromise;

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  const uri = process.env.MONGODB_URI;

  connectionPromise = (async () => {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });
    appLogger.info({}, 'mongodb-connection-success');

    try {
      await mongoose.connection.collection('creator-cards').dropIndex('slug_1');
      appLogger.info('Dropped old global slug index');
    } catch (e) {
      // Index may not exist — safe to ignore
    }

    return mongoose.connection;
  })();

  try {
    return await connectionPromise;
  } catch (error) {
    connectionPromise = null;
    appLogger.error({ error }, 'mongodb-connection-error');

    if (!process.env.VERCEL) {
      process.exit(1);
    }

    throw error;
  }
}

module.exports = connectDatabase;
