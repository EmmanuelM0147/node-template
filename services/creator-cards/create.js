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
  links[]? {
    title string<minLength:1|maxLength:100>
    url string<maxLength:200>
  }
  service_rates? {
    currency string<enum:NGN,USD,GBP,GHS>
    rates[] {
      name string<minLength:3|maxLength:100>
      description? string<maxLength:250>
      amount number<min:1>
    }
  }
  status string<enum:draft,published>
  access_type? string<enum:public,private>
  access_code? string<length:6>
}`;

const parsedCreateSpec = validator.parse(createSpec);

const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SLUG_PATTERN = /^[a-z0-9\-_]+$/;
const ACCESS_CODE_PATTERN = /^[a-zA-Z0-9]{6}$/;
const URL_PATTERN = /^https?:\/\//;

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

function validateFieldRules(validatedData, slugProvided) {
  if (slugProvided && !SLUG_PATTERN.test(validatedData.slug)) {
    throwAppError(
      'slug must contain only letters, numbers, hyphens, and underscores',
      'SPCL_VALIDATION',
      { statusCode: 400 }
    );
  }

  if (validatedData.access_code && !ACCESS_CODE_PATTERN.test(validatedData.access_code)) {
    throwAppError('access_code must be exactly 6 alphanumeric characters', 'SPCL_VALIDATION', {
      statusCode: 400,
    });
  }

  if (validatedData.links) {
    validatedData.links.forEach((link, index) => {
      if (!URL_PATTERN.test(link.url)) {
        throwAppError(
          `links[${index}].url must start with http:// or https://`,
          'SPCL_VALIDATION',
          { statusCode: 400 }
        );
      }
    });
  }

  if (validatedData.service_rates) {
    if (!validatedData.service_rates.rates || validatedData.service_rates.rates.length === 0) {
      throwAppError(
        'service_rates.rates must be a non-empty array when service_rates is present',
        'SPCL_VALIDATION',
        { statusCode: 400 }
      );
    }

    validatedData.service_rates.rates.forEach((rate, index) => {
      if (!Number.isInteger(rate.amount)) {
        throwAppError(
          `service_rates.rates[${index}].amount must be a positive integer`,
          'SPCL_VALIDATION',
          { statusCode: 400 }
        );
      }
    });
  }
}

async function create(serviceData) {
  const validatedData = validator.validate(serviceData, parsedCreateSpec);

  const slugProvided = serviceData.slug != null && serviceData.slug !== '';
  validateFieldRules(validatedData, slugProvided);

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

  let slug;

  if (!slugProvided) {
    slug = slugifyTitle(validatedData.title);

    if (slug.length < 5 || (await isSlugTaken(slug))) {
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
