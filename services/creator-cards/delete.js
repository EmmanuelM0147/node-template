const validator = require('@app-core/validator');
const { throwAppError } = require('@app-core/errors');
const { CreatorCardMessages } = require('@app/messages');
const CreatorCard = require('@app/models/creator-card');

const deleteSpec = `root {
  slug string
  creator_reference string<length:20>
}`;

const parsedDeleteSpec = validator.parse(deleteSpec);

async function deleteCard(serviceData) {
  const validatedData = validator.validate(serviceData, parsedDeleteSpec);

  const card = await CreatorCard.findOne({ slug: validatedData.slug, deleted: null });

  if (!card) {
    throwAppError({
      code: 'NF01',
      message: CreatorCardMessages.CARD_NOT_FOUND,
      statusCode: 404,
    });
  }

  card.deleted = Date.now();
  card.updated = Date.now();
  await card.save();

  const saved = card.toObject();
  const result = { ...saved, id: saved._id };
  delete result._id;

  return result;
}

module.exports = deleteCard;
