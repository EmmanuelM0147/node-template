const { createHandler } = require('@app-core/server');
const { appLogger } = require('@app-core/logger');
const { CreatorCardMessages } = require('@app/messages');
const getCreatorCardService = require('@app/services/creator-cards/get');

module.exports = createHandler({
  path: '/creator-cards/:slug',
  method: 'get',
  middlewares: [],
  async onResponseEnd(rc, rs) {
    appLogger.info({ requestContext: rc, response: rs }, 'get-creator-card-request-completed');
  },
  async handler(rc, helpers) {
    const payload = {
      slug: rc.params.slug,
      access_code: rc.query.access_code,
    };

    const response = await getCreatorCardService(payload);
    return {
      status: helpers.http_statuses.HTTP_200_OK,
      message: CreatorCardMessages.CARD_RETRIEVED,
      data: response,
    };
  },
});
