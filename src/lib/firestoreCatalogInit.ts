import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  CORE_12_CATEGORY_SLUGS,
  parseServiceCatalogDefinitions,
  resolveDefaultPlaceholderImage,
  type ParsedCatalogResult,
} from '../../shared/catalogParser';
import { db, handleFirestoreError, OperationType, testFirestoreConnection } from './firebase';

export interface CatalogInitSummary {
  coreCategoriesVerified: number;
  categoriesCreated: number;
  categoriesUpdated: number;
  servicesCreated: number;
  servicesUpdated: number;
  totalActiveCategories: number;
  totalActiveServices: number;
}

export interface FirestoreCatalogStats {
  activeCategoriesCount: number;
  coreCategoriesPresentCount: number;
  activeServicesCount: number;
  categoriesWithImagesCount: number;
  servicesWithImagesCount: number;
}

export async function fetchFirestoreCatalogStats(): Promise<FirestoreCatalogStats> {
  await testFirestoreConnection();

  let catDocs: Record<string, unknown>[] = [];
  let srvDocs: Record<string, unknown>[] = [];

  try {
    const catQuery = query(collection(db, 'service_categories'), where('status', '==', 'active'));
    const catSnap = await getDocs(catQuery);
    catDocs = catSnap.docs.map((d) => d.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'service_categories');
  }

  try {
    const srvQuery = query(collection(db, 'services'), where('status', '==', 'active'));
    const srvSnap = await getDocs(srvQuery);
    srvDocs = srvSnap.docs.map((d) => d.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'services');
  }

  const presentSlugs = new Set(catDocs.map((c) => String(c.slug || '')));
  const coreCount = CORE_12_CATEGORY_SLUGS.filter((slug) => presentSlugs.has(slug)).length;

  return {
    activeCategoriesCount: catDocs.length,
    coreCategoriesPresentCount: coreCount,
    activeServicesCount: srvDocs.length,
    categoriesWithImagesCount: catDocs.filter((c) => Boolean(String(c.imageUrl || '').trim())).length,
    servicesWithImagesCount: srvDocs.filter((s) => Boolean(String(s.imageUrl || '').trim())).length,
  };
}

export async function initializeFirestoreCatalog(
  parsedInput?: ParsedCatalogResult
): Promise<CatalogInitSummary> {
  await testFirestoreConnection();
  const parsed = parsedInput ?? parseServiceCatalogDefinitions();
  if (parsed.missingCoreSlugs.length > 0) {
    throw new Error(
      `Catalog definitions are missing required core categories: ${parsed.missingCoreSlugs.join(', ')}`
    );
  }

  let categoriesCreated = 0;
  let categoriesUpdated = 0;
  let servicesCreated = 0;
  let servicesUpdated = 0;

  // Step 1: Ensure all categories (starting with the 12 core categories) exist, are active, and have image placeholders
  for (const cat of parsed.categories) {
    const ref = doc(db, 'service_categories', cat.id);
    const docPath = `service_categories/${cat.id}`;

    let existingSnap;
    try {
      existingSnap = await getDoc(ref);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, docPath);
    }

    const defaultPlaceholder =
      cat.imageUrl || resolveDefaultPlaceholderImage(cat.slug);

    if (!existingSnap.exists()) {
      try {
        await setDoc(ref, {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          sortOrder: cat.sortOrder,
          status: 'active',
          isActive: true,
          isCore: cat.isCore,
          imageUrl: defaultPlaceholder,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        categoriesCreated++;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, docPath);
      }
    } else {
      const data = existingSnap.data();
      const needsUpdate =
        data.status !== 'active' ||
        data.isActive !== true ||
        !String(data.imageUrl || '').trim() ||
        data.isCore !== cat.isCore;

      if (needsUpdate) {
        try {
          await updateDoc(ref, {
            name: String(data.name || cat.name).slice(0, 120),
            slug: String(data.slug || cat.slug).slice(0, 120),
            description: String(data.description || cat.description).slice(0, 500),
            sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : cat.sortOrder,
            status: 'active',
            isActive: true,
            isCore: cat.isCore,
            imageUrl: String(data.imageUrl || '').trim() || defaultPlaceholder,
            updatedAt: serverTimestamp(),
          });
          categoriesUpdated++;
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, docPath);
        }
      }
    }
  }

  // Step 2: Ensure all initial service catalog entries exist, are active, and have professional image placeholders
  for (const srv of parsed.services) {
    const ref = doc(db, 'services', srv.id);
    const docPath = `services/${srv.id}`;

    let existingSnap;
    try {
      existingSnap = await getDoc(ref);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, docPath);
    }

    const defaultPlaceholder =
      srv.imageUrl || resolveDefaultPlaceholderImage(srv.categorySlug, srv.id);

    if (!existingSnap.exists()) {
      try {
        await setDoc(ref, {
          id: srv.id,
          categoryId: srv.categoryId,
          categoryName: srv.categoryName,
          categorySlug: srv.categorySlug,
          title: srv.title,
          shortDescription: srv.shortDescription,
          description: srv.description,
          priceInr: srv.priceInr,
          packageName: srv.packageName,
          deliverables: srv.deliverables,
          estimatedDays: srv.estimatedDays,
          requirementsPrompt: srv.requirementsPrompt,
          revisionPolicy: srv.revisionPolicy,
          requiredSkills: srv.requiredSkills,
          imageUrl: defaultPlaceholder,
          categoryImageUrl: srv.categoryImageUrl,
          isStartingPrice: srv.isStartingPrice,
          status: 'active',
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        servicesCreated++;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, docPath);
      }
    } else {
      const data = existingSnap.data();
      const needsUpdate =
        data.status !== 'active' ||
        data.isActive !== true ||
        !String(data.imageUrl || '').trim() ||
        !String(data.categoryImageUrl || '').trim();

      if (needsUpdate) {
        try {
          await updateDoc(ref, {
            categoryId: String(data.categoryId || srv.categoryId),
            categoryName: String(data.categoryName || srv.categoryName).slice(0, 120),
            categorySlug: String(data.categorySlug || srv.categorySlug).slice(0, 120),
            title: String(data.title || srv.title).slice(0, 160),
            shortDescription: String(data.shortDescription || srv.shortDescription).slice(0, 280),
            description: String(data.description || srv.description).slice(0, 2000),
            priceInr: typeof data.priceInr === 'number' ? data.priceInr : srv.priceInr,
            packageName: String(data.packageName || srv.packageName).slice(0, 80),
            deliverables: String(data.deliverables || srv.deliverables).slice(0, 600),
            estimatedDays: typeof data.estimatedDays === 'number' ? data.estimatedDays : srv.estimatedDays,
            requirementsPrompt: String(data.requirementsPrompt ?? srv.requirementsPrompt).slice(0, 500),
            revisionPolicy: String(data.revisionPolicy ?? srv.revisionPolicy).slice(0, 200),
            requiredSkills: String(data.requiredSkills ?? srv.requiredSkills).slice(0, 250),
            imageUrl: String(data.imageUrl || '').trim() || defaultPlaceholder,
            categoryImageUrl: String(data.categoryImageUrl || '').trim() || srv.categoryImageUrl,
            isStartingPrice: typeof data.isStartingPrice === 'boolean' ? data.isStartingPrice : srv.isStartingPrice,
            status: 'active',
            isActive: true,
            updatedAt: serverTimestamp(),
          });
          servicesUpdated++;
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, docPath);
        }
      }
    }
  }

  return {
    coreCategoriesVerified: parsed.coreCategories.length,
    categoriesCreated,
    categoriesUpdated,
    servicesCreated,
    servicesUpdated,
    totalActiveCategories: parsed.categories.length,
    totalActiveServices: parsed.services.length,
  };
}
