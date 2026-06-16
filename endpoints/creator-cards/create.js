const { createHandler } = require('@app-core/server');
const { appLogger } = require('@app-core/logger');
const { CreatorCardMessages } = require('@app/messages');
const createCreatorCardService = require('@app/services/creator-cards/create');

module.exports = createHandler({
  path: '/creator-cards',
  method: 'post',
  middlewares: [],
  async onResponseEnd(rc, rs) {
    appLogger.info({ requestContext: rc, response: rs }, 'create-creator-card-request-completed');
  },
  async handler(rc, helpers) {
    const payload = rc.body;

    const response = await createCreatorCardService(payload);
    return {
      status: helpers.http_statuses.HTTP_200_OK,
      message: CreatorCardMessages.CARD_CREATED,
      data: response,
    };
  },
});
