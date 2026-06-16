const mongoose = require('mongoose');
const { appLogger } = require('@app-core/logger');

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  try {
    await mongoose.connect(uri);
    appLogger.info({}, 'mongodb-connection-success');

    try {
      await mongoose.connection.collection('creator-cards').dropIndex('slug_1');
      appLogger.info('Dropped old global slug index');
    } catch (e) {
      // Index may not exist — safe to ignore
    }
  } catch (error) {
    appLogger.error({ error }, 'mongodb-connection-error');
    process.exit(1);
  }
}

module.exports = connectDatabase;
