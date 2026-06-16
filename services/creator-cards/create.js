const { ulid } = require('ulid');
const validator = require('@app-core/validator');
const { throwAppError } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const { CreatorCardMessages } = require('@app/messages');
const CreatorCard = require('@app/models/creator-card');

const createSpec = `root {
  title string<minLength:3|maxLength:100>
  description? string<maxLength:500>
  slug? string<minLength:5|maxLength:50>
  creator_reference string<length:20>
  links? array
  service_rates? object
  status string<enum:draft,published>
  access_type? string<enum:public,private>
  access_code? string<length:6>
}`;

const parsedCreateSpec = validator.parse(createSpec);

const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomAlphanumeric(length) {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)];
  }
  return result;
}

function slugifyTitle(title) {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '');
}

async function isSlugTaken(slug) {
  const existing = await CreatorCard.findOne({ slug, deleted: null });
  return !!existing;
}

async function create(serviceData) {
  const validatedData = validator.validate(serviceData, parsedCreateSpec);

  const accessType = validatedData.access_type || 'public';
  const accessCode = validatedData.access_code ?? null;

  if (
    accessType === 'private' &&
    (accessCode === null || accessCode === undefined || accessCode === '')
  ) {
    throwAppError({
      code: 'AC01',
      message: CreatorCardMessages.ACCESS_CODE_REQUIRED,
      statusCode: 400,
    });
  }

  if (
    accessType === 'public' &&
    accessCode !== null &&
    accessCode !== undefined &&
    accessCode !== ''
  ) {
    throwAppError({
      code: 'AC05',
      message: CreatorCardMessages.ACCESS_CODE_FORBIDDEN,
      statusCode: 400,
    });
  }

  const slugProvided = serviceData.slug != null && serviceData.slug !== '';
  let slug;

  if (!slugProvided) {
    slug = slugifyTitle(validatedData.title);

    if (slug.length < 5) {
      slug = `${slug}-${randomAlphanumeric(6)}`;
    }

    if (await isSlugTaken(slug)) {
      slug = `${slug}-${randomAlphanumeric(6)}`;
    }
  } else {
    slug = validatedData.slug;

    if (await isSlugTaken(slug)) {
      throwAppError({
        code: 'SL02',
        message: CreatorCardMessages.SLUG_TAKEN,
        statusCode: 400,
      });
    }
  }

  const card = await CreatorCard.create({
    _id: ulid(),
    title: validatedData.title,
    description: validatedData.description,
    slug,
    creator_reference: validatedData.creator_reference,
    links: validatedData.links,
    service_rates: validatedData.service_rates,
    status: validatedData.status,
    access_type: accessType,
    access_code: accessCode,
    created: Date.now(),
    updated: Date.now(),
    deleted: null,
  });

  const saved = card.toObject();
  const result = { ...saved, id: saved._id };
  delete result._id;

  appLogger.info({ card: result }, 'creator-card-created');

  return result;
}

module.exports = create;
