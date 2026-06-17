require('dotenv').config();

const base = process.env.E2E_BASE_URL || 'http://localhost:3002';
const ref = 'cr_ref_e2e_test_0001';
const ref2 = 'cr_ref_e2e_test_0002';
const slug = `e2e-${Date.now()}`;

let passed = 0;
let failed = 0;

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${base}${path}`, opts);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function ok(name, cond, detail) {
  if (cond) {
    passed += 1;
    console.log(`PASS: ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL: ${name}`, JSON.stringify(detail ?? null));
  }
}

function expectBusinessError(res, code, httpStatus) {
  ok(
    `business error ${code} -> ${httpStatus}`,
    res.status === httpStatus &&
      res.json.status === 'error' &&
      res.json.code === code &&
      typeof res.json.message === 'string' &&
      res.json.message.length > 0 &&
      res.json.errors === undefined &&
      res.json.data === undefined,
    res
  );
}

(async () => {
  // --- CREATE: full payload with links + service_rates ---
  const create = await req('POST', '/creator-cards', {
    title: 'George Cooks',
    description: 'Weekly cooking podcast',
    slug,
    creator_reference: ref,
    links: [{ title: 'YouTube', url: 'https://youtube.com/@georgecooks' }],
    service_rates: {
      currency: 'NGN',
      rates: [{ name: 'IG Story Post', description: 'One story mention', amount: 5000000 }],
    },
    status: 'published',
  });
  ok('POST full create -> 200', create.status === 200, create);
  ok('create status success', create.json.status === 'success');
  ok('create message exact', create.json.message === 'Creator Card Created Successfully.');
  ok('create has id not _id', !!create.json.data?.id && !create.json.data?._id);
  ok('create includes access_code', 'access_code' in (create.json.data || {}));

  // --- GET public ---
  const get = await req('GET', `/creator-cards/${slug}`);
  ok('GET public -> 200', get.status === 200, get);
  ok('GET message exact', get.json.message === 'Creator Card Retrieved Successfully.');
  ok('GET omits access_code', !('access_code' in (get.json.data || {})));
  ok('GET has id not _id', !!get.json.data?.id && !get.json.data?._id);

  // --- SL02 duplicate slug ---
  const dup = await req('POST', '/creator-cards', {
    title: 'Another George',
    slug,
    creator_reference: ref2,
    status: 'published',
  });
  expectBusinessError(dup, 'SL02', 400);

  // --- AC01 private without access_code ---
  const ac01 = await req('POST', '/creator-cards', {
    title: 'Secret Card',
    creator_reference: ref2,
    status: 'published',
    access_type: 'private',
  });
  expectBusinessError(ac01, 'AC01', 400);

  // --- AC05 public with access_code ---
  const ac05 = await req('POST', '/creator-cards', {
    title: 'Public Card',
    creator_reference: ref2,
    status: 'published',
    access_type: 'public',
    access_code: 'A1B2C3',
  });
  expectBusinessError(ac05, 'AC05', 400);

  // --- Private card ---
  const privSlug = `${slug}-priv`;
  await req('POST', '/creator-cards', {
    title: 'VIP Rate Card',
    slug: privSlug,
    creator_reference: ref2,
    status: 'published',
    access_type: 'private',
    access_code: 'ABC123',
  });
  expectBusinessError(await req('GET', `/creator-cards/${privSlug}`), 'AC03', 403);
  expectBusinessError(
    await req('GET', `/creator-cards/${privSlug}?access_code=WRONG1`),
    'AC04',
    403
  );
  ok(
    'GET private correct code -> 200',
    (await req('GET', `/creator-cards/${privSlug}?access_code=ABC123`)).status === 200
  );

  // --- Draft NF02 ---
  const draftSlug = `${slug}-draft`;
  await req('POST', '/creator-cards', {
    title: 'Draft Card',
    slug: draftSlug,
    creator_reference: ref2,
    status: 'draft',
  });
  expectBusinessError(await req('GET', `/creator-cards/${draftSlug}`), 'NF02', 404);

  // --- NF01 not found ---
  expectBusinessError(await req('GET', '/creator-cards/does-not-exist-123'), 'NF01', 404);

  // --- DELETE ---
  const del = await req('DELETE', `/creator-cards/${slug}`, { creator_reference: ref });
  ok('DELETE -> 200', del.status === 200, del);
  ok('DELETE message exact', del.json.message === 'Creator Card Deleted Successfully.');
  ok('DELETE has access_code', 'access_code' in (del.json.data || {}));
  ok('DELETE has deleted timestamp', del.json.data?.deleted != null);

  // --- GET deleted NF01 ---
  expectBusinessError(await req('GET', `/creator-cards/${slug}`), 'NF01', 404);

  // --- Slug auto-generation ---
  const auto = await req('POST', '/creator-cards', {
    title: 'Ada Designs Things',
    creator_reference: ref2,
    status: 'published',
  });
  ok('slug auto-gen -> 200', auto.status === 200, auto);
  ok('slug auto-gen value', auto.json.data?.slug === 'ada-designs-things');

  console.log('');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
