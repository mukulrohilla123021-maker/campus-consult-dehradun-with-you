# Security Specification — Campus Consult Dehradun Firestore Catalog

## Data Invariants
1. **Default-Deny Baseline:** Every unmapped Firestore path is denied (`allow read, write: if false;`).
2. **Valid Document IDs:** All single-document operations (`get`, `create`, `update`, `delete`) validate document IDs against `^[a-zA-Z0-9_-]+$` (`<= 128` chars) to block path/resource poisoning.
3. **Public Catalog Visibility vs. Admin-Only Mutations:** Only catalog items with `status == 'active'` are readable publicly (`get`/`list` enforce `resource.data.status == 'active'`). Creating, updating, or deleting `service_categories`, `services`, or `admins` requires a verified Admin (`email_verified == true` AND either bootstrapped super admin or `/admins/{uid}` membership).
4. **Referential Integrity:** Every `/services/{serviceId}` creation and update verifies `exists(/databases/$(database)/documents/service_categories/$(incoming().categoryId))` so orphaned services cannot be written.
5. **Immutable Audit Timestamps & Strict Keys:** `createdAt` must equal `request.time` on `create` and remain unchanged on `update`; `updatedAt` must equal `request.time`. All entities enforce exact `hasAll` + `hasOnly` key allowlists and explicit string/number bounds.

## Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Category Create:** Anonymous client calls `setDoc(doc(db, 'service_categories', 'cat-01'), {...})` -> Denied (`isAdmin()` false).
2. **Non-Admin Verified User Write:** Regular signed-in user writes to `/services/srv-01` -> Denied (`isAdmin()` false).
3. **Unverified Admin Email Spoof:** Auth token matches admin email but `email_verified == false` -> Denied (`isVerifiedUser()` false).
4. **Self-Assigned Admin Escalation:** Signed-in non-admin writes `/admins/{uid}` with `{ role: 'super_admin' }` -> Denied.
5. **Shadow Field Injection on Create:** Admin writes `/service_categories/cat-01` with extra key `{ hackedFlag: true }` -> Denied (`hasOnly` check).
6. **Oversized ID Poisoning:** Request targets `/services/${'a'.repeat(500)}` -> Denied (`isValidId` <= 128 chars).
7. **Orphaned Service Reference:** Admin creates `/services/srv-99` with nonexistent `categoryId: 'cat-missing'` -> Denied (`exists()` check).
8. **Immutable Field Mutation:** Admin updates `/services/srv-01` while modifying `createdAt` or `id` -> Denied.
9. **Spoofed Client Timestamp:** Admin creates `/service_categories/cat-01` with backdated `createdAt` (`!= request.time`) -> Denied.
10. **Invalid Status Value:** Admin sets `status: 'published'` instead of `'active' | 'inactive'` -> Denied.
11. **Out-of-Range Price:** Admin writes `/services/srv-01` with `priceInr: -50` or `priceInr: 10` -> Denied (`priceInr >= 100`).
12. **Unauthorized List Scraping of Inactive Drafts:** Unauthenticated client runs `getDocs(collection(db, 'service_categories'))` without `where('status', '==', 'active')` -> Denied (`allow list` requires `resource.data.status == 'active'`).
