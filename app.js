/* eslint-disable global-require */
/* eslint-disable import/no-dynamic-require */
if (!process.env.__ALREADY_BOOTSTRAPPED_ENVS) require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { createServer } = require('@app-core/server');
const connectDatabase = require('@app-core/database');
const { createQueue } = require('@app-core/queue');

const canLogEndpointInformation = process.env.CAN_LOG_ENDPOINT_INFORMATION;

createQueue();

const server = createServer({
  port: process.env.PORT,
  JSONLimit: '150mb',
  enableCors: true,
});

if (process.env.VERCEL) {
  connectDatabase().catch(() => {});
}

function requiresDatabase(requestPath) {
  return requestPath.startsWith('/creator-cards');
}

server.use(async (req, res, next) => {
  if (!requiresDatabase(req.path)) {
    next();
    return;
  }

  try {
    await connectDatabase();
    next();
  } catch (error) {
    const message = !process.env.MONGODB_URI
      ? 'Database is not configured (MONGODB_URI missing)'
      : 'Database connection failed';

    res.status(503).json({
      status: 'error',
      message,
      code: 'DB_UNAVAILABLE',
    });
  }
});

const ENDPOINT_CONFIGS = [
  {
    directory: path.join(__dirname, 'endpoints', 'onboarding'),
    files: ['login.js'],
  },
  {
    directory: path.join(__dirname, 'endpoints', 'creator-cards'),
    files: ['create.js', 'get.js', 'delete.js'],
  },
];

function logEndpointMetaData(endpointConfigs) {
  const endpointData = [];
  const storageDirName = path.join(__dirname, 'endpoint-data');
  const EXEMPTED_ENDPOINTS_REGEX = /onboarding/;

  endpointConfigs.forEach((endpointConfig) => {
    const { directory: basePath, files, options } = endpointConfig;

    files.forEach((file) => {
      const handler = require(path.join(basePath, file));

      if (!EXEMPTED_ENDPOINTS_REGEX.test(basePath) && handler.middlewares?.length) {
        const entry = { method: handler.method, endpoint: handler.path };
        entry.name = file.replaceAll('-', ' ').replace('.js', '');
        entry.display_name = `can ${entry.name}`;

        if (options?.pathPrefix) {
          entry.endpoint = `${options.pathPrefix}${entry.endpoint}`;
          entry.name = `${entry.name} (${options.pathPrefix.replace('/', '')})`;
        }

        endpointData.push(entry);
      }
    });
  });

  if (!fs.existsSync(storageDirName)) {
    fs.mkdirSync(storageDirName);
  }

  fs.writeFileSync(
    path.join(storageDirName, 'endpoints.json'),
    JSON.stringify(endpointData, null, 2),
    {
      encoding: 'utf-8',
    }
  );
}

if (canLogEndpointInformation) {
  logEndpointMetaData(ENDPOINT_CONFIGS);
}

function setupEndpointHandlers(endpointConfig) {
  const { directory: basePath, files, options = {} } = endpointConfig;

  files.forEach((file) => {
    const handler = require(path.join(basePath, file));

    if (options.pathPrefix) {
      handler.path = `${options.pathPrefix}${handler.path}`;
    }

    server.addHandler(handler);
  });
}

ENDPOINT_CONFIGS.forEach((config) => {
  setupEndpointHandlers(config);
});

const { app } = server;

if (process.env.VERCEL) {
  server.registerFallbackHandlers();
}

connectDatabase().then(() => {
  // Start server only when not in Vercel serverless environment
  if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    server.startServer();
  }
});

module.exports = app;
