import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, signInWithCredential } from 'firebase/auth';
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  parseServiceCatalogDefinitions,
  resolveDefaultPlaceholderImage,
  type ParsedCategoryDef,
  type ParsedServiceDef,
} from '../shared/catalogParser.ts';

interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
}

function getArgValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1];
  }
  return undefined;
}

function toFirestoreValue(val: unknown): Record<string, unknown> {
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  return { stringValue: String(val ?? '') };
}

async function upsertViaFirestoreRest(
  config: FirebaseAppletConfig,
  idToken: string,
  categories: ParsedCategoryDef[],
  services: ParsedServiceDef[]
) {
  const databaseId = config.firestoreDatabaseId || '(default)';
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${databaseId}/documents`;
  const commitUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${databaseId}/documents:commit`;

  const headers = {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };

  let categoriesCreated = 0;
  let categoriesUpdated = 0;
  let servicesCreated = 0;
  let servicesUpdated = 0;

  // Step 1: Commit categories first so security rule exists() checks for services succeed
  const catWrites: Record<string, unknown>[] = [];
  for (const cat of categories) {
    const docName = `projects/${config.projectId}/databases/${databaseId}/documents/service_categories/${cat.id}`;
    const getRes = await fetch(`${baseUrl}/service_categories/${cat.id}`, { headers });
    const exists = getRes.ok;
    const existingDoc = exists ? ((await getRes.json()) as { fields?: Record<string, { stringValue?: string }> }) : null;
    const existingImage = existingDoc?.fields?.imageUrl?.stringValue?.trim() || '';
    const imageUrl = existingImage || cat.imageUrl || resolveDefaultPlaceholderImage(cat.slug);

    if (exists) {
      categoriesUpdated++;
    } else {
      categoriesCreated++;
    }

    const transforms: Record<string, unknown>[] = [
      { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
    ];
    if (!exists) {
      transforms.unshift({ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' });
    }

    catWrites.push({
      update: {
        name: docName,
        fields: {
          id: toFirestoreValue(cat.id),
          name: toFirestoreValue(cat.name),
          slug: toFirestoreValue(cat.slug),
          description: toFirestoreValue(cat.description),
          sortOrder: toFirestoreValue(cat.sortOrder),
          status: toFirestoreValue('active'),
          isActive: toFirestoreValue(true),
          isCore: toFirestoreValue(cat.isCore),
          imageUrl: toFirestoreValue(imageUrl),
        },
      },
      updateTransforms: transforms,
      ...(exists
        ? {
            updateMask: {
              fieldPaths: ['name', 'slug', 'description', 'sortOrder', 'status', 'isActive', 'isCore', 'imageUrl'],
            },
          }
        : {}),
    });
  }

  const catCommitRes = await fetch(commitUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ writes: catWrites }),
  });
  if (!catCommitRes.ok) {
    throw new Error(`Firestore category commit failed (${catCommitRes.status}): ${await catCommitRes.text()}`);
  }

  // Step 2: Commit services referencing the active categories
  const srvWrites: Record<string, unknown>[] = [];
  for (const srv of services) {
    const docName = `projects/${config.projectId}/databases/${databaseId}/documents/services/${srv.id}`;
    const getRes = await fetch(`${baseUrl}/services/${srv.id}`, { headers });
    const exists = getRes.ok;
    const existingDoc = exists ? ((await getRes.json()) as { fields?: Record<string, { stringValue?: string }> }) : null;
    const existingImage = existingDoc?.fields?.imageUrl?.stringValue?.trim() || '';
    const imageUrl = existingImage || srv.imageUrl || resolveDefaultPlaceholderImage(srv.categorySlug, srv.id);

    if (exists) {
      servicesUpdated++;
    } else {
      servicesCreated++;
    }

    const transforms: Record<string, unknown>[] = [
      { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
    ];
    if (!exists) {
      transforms.unshift({ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' });
    }

    srvWrites.push({
      update: {
        name: docName,
        fields: {
          id: toFirestoreValue(srv.id),
          categoryId: toFirestoreValue(srv.categoryId),
          categoryName: toFirestoreValue(srv.categoryName),
          categorySlug: toFirestoreValue(srv.categorySlug),
          title: toFirestoreValue(srv.title),
          shortDescription: toFirestoreValue(srv.shortDescription),
          description: toFirestoreValue(srv.description),
          priceInr: toFirestoreValue(srv.priceInr),
          packageName: toFirestoreValue(srv.packageName),
          deliverables: toFirestoreValue(srv.deliverables),
          estimatedDays: toFirestoreValue(srv.estimatedDays),
          requirementsPrompt: toFirestoreValue(srv.requirementsPrompt),
          revisionPolicy: toFirestoreValue(srv.revisionPolicy),
          requiredSkills: toFirestoreValue(srv.requiredSkills),
          imageUrl: toFirestoreValue(imageUrl),
          categoryImageUrl: toFirestoreValue(srv.categoryImageUrl),
          isStartingPrice: toFirestoreValue(srv.isStartingPrice),
          status: toFirestoreValue('active'),
          isActive: toFirestoreValue(true),
        },
      },
      updateTransforms: transforms,
      ...(exists
        ? {
            updateMask: {
              fieldPaths: [
                'categoryId', 'categoryName', 'categorySlug', 'title',
                'shortDescription', 'description', 'priceInr', 'packageName',
                'deliverables', 'estimatedDays', 'requirementsPrompt', 'revisionPolicy',
                'requiredSkills', 'imageUrl', 'categoryImageUrl', 'isStartingPrice',
                'status', 'isActive',
              ],
            },
          }
        : {}),
    });
  }

  const srvCommitRes = await fetch(commitUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ writes: srvWrites }),
  });
  if (!srvCommitRes.ok) {
    throw new Error(`Firestore services commit failed (${srvCommitRes.status}): ${await srvCommitRes.text()}`);
  }

  return { categoriesCreated, categoriesUpdated, servicesCreated, servicesUpdated };
}

async function upsertViaFirebaseClientSdk(
  config: FirebaseAppletConfig,
  googleIdToken: string,
  categories: ParsedCategoryDef[],
  services: ParsedServiceDef[]
) {
  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app, config.firestoreDatabaseId || '(default)');

  await signInWithCredential(auth, GoogleAuthProvider.credential(googleIdToken));

  let categoriesCreated = 0;
  let categoriesUpdated = 0;
  let servicesCreated = 0;
  let servicesUpdated = 0;

  for (const cat of categories) {
    const ref = doc(db, 'service_categories', cat.id);
    const snap = await getDoc(ref);
    const placeholder = cat.imageUrl || resolveDefaultPlaceholderImage(cat.slug);

    if (!snap.exists()) {
      await setDoc(ref, {
        ...cat,
        status: 'active',
        isActive: true,
        imageUrl: placeholder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      categoriesCreated++;
    } else {
      const existing = snap.data();
      await updateDoc(ref, {
        name: String(existing.name || cat.name),
        slug: String(existing.slug || cat.slug),
        description: String(existing.description || cat.description),
        sortOrder: typeof existing.sortOrder === 'number' ? existing.sortOrder : cat.sortOrder,
        status: 'active',
        isActive: true,
        isCore: cat.isCore,
        imageUrl: String(existing.imageUrl || '').trim() || placeholder,
        updatedAt: serverTimestamp(),
      });
      categoriesUpdated++;
    }
  }

  for (const srv of services) {
    const ref = doc(db, 'services', srv.id);
    const snap = await getDoc(ref);
    const placeholder = srv.imageUrl || resolveDefaultPlaceholderImage(srv.categorySlug, srv.id);

    if (!snap.exists()) {
      await setDoc(ref, {
        ...srv,
        status: 'active',
        isActive: true,
        imageUrl: placeholder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      servicesCreated++;
    } else {
      const existing = snap.data();
      await updateDoc(ref, {
        categoryId: String(existing.categoryId || srv.categoryId),
        categoryName: String(existing.categoryName || srv.categoryName),
        categorySlug: String(existing.categorySlug || srv.categorySlug),
        title: String(existing.title || srv.title),
        shortDescription: String(existing.shortDescription || srv.shortDescription),
        description: String(existing.description || srv.description),
        priceInr: typeof existing.priceInr === 'number' ? existing.priceInr : srv.priceInr,
        packageName: String(existing.packageName || srv.packageName),
        deliverables: String(existing.deliverables || srv.deliverables),
        estimatedDays: typeof existing.estimatedDays === 'number' ? existing.estimatedDays : srv.estimatedDays,
        requirementsPrompt: String(existing.requirementsPrompt ?? srv.requirementsPrompt),
        revisionPolicy: String(existing.revisionPolicy ?? srv.revisionPolicy),
        requiredSkills: String(existing.requiredSkills ?? srv.requiredSkills),
        imageUrl: String(existing.imageUrl || '').trim() || placeholder,
        categoryImageUrl: String(existing.categoryImageUrl || '').trim() || srv.categoryImageUrl,
        isStartingPrice: typeof existing.isStartingPrice === 'boolean' ? existing.isStartingPrice : srv.isStartingPrice,
        status: 'active',
        isActive: true,
        updatedAt: serverTimestamp(),
      });
      servicesUpdated++;
    }
  }

  return { categoriesCreated, categoriesUpdated, servicesCreated, servicesUpdated };
}

async function main() {
  const rootDir = process.cwd();
  const dbSourcePath = path.join(rootDir, 'server', 'db.ts');
  const firebaseConfigPath = path.join(rootDir, 'firebase-applet-config.json');

  if (!fs.existsSync(dbSourcePath)) {
    throw new Error(`Cannot locate catalog definitions at ${dbSourcePath}`);
  }
  if (!fs.existsSync(firebaseConfigPath)) {
    throw new Error(`Missing ${firebaseConfigPath}. Provision Firebase before running catalog initialization.`);
  }

  const dbSourceText = fs.readFileSync(dbSourcePath, 'utf8');
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8')) as FirebaseAppletConfig;

  const parsed = parseServiceCatalogDefinitions(dbSourceText);
  if (parsed.missingCoreSlugs.length > 0) {
    throw new Error(
      `Catalog verification failed: missing core categories (${parsed.missingCoreSlugs.join(', ')})`
    );
  }

  const isDryRun = process.argv.includes('--dry-run');
  const outputJson = process.argv.includes('--json');

  if (isDryRun) {
    const summary = {
      mode: 'dry-run',
      projectId: firebaseConfig.projectId,
      firestoreDatabaseId: firebaseConfig.firestoreDatabaseId || '(default)',
      coreCategoriesCount: parsed.coreCategories.length,
      totalCategoriesCount: parsed.categories.length,
      totalServicesCount: parsed.services.length,
      allCategoriesActive: parsed.categories.every((c) => c.status === 'active' && c.isActive),
      allCategoriesHavePlaceholders: parsed.categories.every((c) => Boolean(c.imageUrl)),
      allServicesActive: parsed.services.every((s) => s.status === 'active' && s.isActive),
      allServicesHavePlaceholders: parsed.services.every((s) => Boolean(s.imageUrl)),
      coreCategories: parsed.coreCategories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        status: c.status,
        imageUrl: c.imageUrl,
      })),
    };
    console.log(outputJson ? JSON.stringify(summary, null, 2) : summary);
    return;
  }

  const firebaseIdToken = getArgValue('--id-token') || process.env.FIREBASE_ID_TOKEN || '';
  const googleIdToken = getArgValue('--google-id-token') || process.env.GOOGLE_ID_TOKEN || '';

  if (googleIdToken) {
    const res = await upsertViaFirebaseClientSdk(firebaseConfig, googleIdToken, parsed.categories, parsed.services);
    console.log(
      `Firestore catalog initialized via Firebase SDK (${parsed.coreCategories.length}/12 core categories verified):`,
      res
    );
    return;
  }

  if (firebaseIdToken) {
    const res = await upsertViaFirestoreRest(firebaseConfig, firebaseIdToken, parsed.categories, parsed.services);
    console.log(
      `Firestore catalog initialized via authenticated Firestore API (${parsed.coreCategories.length}/12 core categories verified):`,
      res
    );
    return;
  }

  console.error(
    [
      'Parsed service catalog cleanly:',
      `  • Core categories verified: ${parsed.coreCategories.length}/12`,
      `  • Total active categories:  ${parsed.categories.length}`,
      `  • Total active services:    ${parsed.services.length}`,
      '',
      'Firestore security rules require a verified Admin credential to write to /service_categories and /services.',
      'Run with one of:',
      '  1) Admin UI: Open Admin / Super Admin -> Service & Categories -> "Initialize Catalog in Firestore"',
      '  2) CLI Dry Run: npm run init:firestore-catalog -- --dry-run',
      '  3) Authenticated CLI: FIREBASE_ID_TOKEN="<admin_id_token>" npm run init:firestore-catalog',
    ].join('\n')
  );
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('Catalog initialization error:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
