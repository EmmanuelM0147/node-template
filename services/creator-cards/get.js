const { throwAppError } = require('@app-core/errors');
const { CreatorCardMessages } = require('@app/messages');
const CreatorCard = require('@app/models/creator-card');

async function get(serviceData) {
  const card = await CreatorCard.findOne({ slug: serviceData.slug, deleted: null });

  if (!card) {
    throwAppError({
      code: 'NF01',
      message: CreatorCardMessages.CARD_NOT_FOUND,
      statusCode: 404,
    });
  }

  if (card.status === 'draft') {
    throwAppError({
      code: 'NF02',
      message: CreatorCardMessages.CARD_NOT_FOUND,
      statusCode: 404,
    });
  }

  const accessCode = serviceData.access_code ?? null;

  if (
    card.access_type === 'private' &&
    (accessCode === null || accessCode === undefined || accessCode === '')
  ) {
    throwAppError({
      code: 'AC03',
      message: CreatorCardMessages.CARD_PRIVATE,
      statusCode: 403,
    });
  }

  if (card.access_type === 'private' && accessCode !== card.access_code) {
    throwAppError({
      code: 'AC04',
      message: CreatorCardMessages.INVALID_ACCESS_CODE,
      statusCode: 403,
    });
  }

  const saved = card.toObject();
  const result = { ...saved, id: saved._id };
  delete result._id;
  delete result.access_code;

  return result;
}

module.exports = get;
