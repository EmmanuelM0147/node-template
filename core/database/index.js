const mongoose = require('mongoose');
const { appLogger } = require('@app-core/logger');

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  try {
    await mongoose.connect(uri);
    appLogger.info({}, 'mongodb-connection-success');
  } catch (error) {
    appLogger.error({ error }, 'mongodb-connection-error');
    process.exit(1);
  }
}

module.exports = connectDatabase;
