const { ModelSchema, DatabaseModel } = require('@app-core/mongoose');

const modelName = 'creator-cards';

const schemaConfig = {
  _id: { type: String },
  title: String,
  description: String,
  slug: { type: String, unique: true },
  creator_reference: String,
  links: [{ title: String, url: String }],
  service_rates: {
    currency: String,
    rates: [{ name: String, description: String, amount: Number }],
  },
  status: { type: String, enum: ['draft', 'published'] },
  access_type: { type: String, enum: ['public', 'private'], default: 'public' },
  access_code: { type: String, default: null },
  created: Number,
  updated: Number,
  deleted: { type: Number, default: null },
};

const modelSchema = new ModelSchema(schemaConfig, {
  _id: false,
  versionKey: false,
  collection: modelName,
});

module.exports = DatabaseModel.model(modelName, modelSchema);
