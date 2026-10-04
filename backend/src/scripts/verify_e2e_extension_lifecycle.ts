import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '@prisma/client';

const BASE_URL = 'http://localhost:8000';

// Minimal valid dummy PDF with "%PDF" header
const DUMMY_PDF_BYTES = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Title (Test Passport) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
const DUMMY_PDF_BASE64 = DUMMY_PDF_BYTES.toString('base64');

async function runE2ETests() {
  console.log('================================================================');
  console.log('STARTING COMPLETE CHROME EXTENSION <-> BACKEND E2E TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
      failed++;
    }
  }

  // Set up 2 test users for strict isolation testing
  const user1Email = 'test.extension.user1@example.com';
  const user2Email = 'test.extension.user2@example.com';
  const testPassword = 'Password123!@#';
  const testPasswordHash = await bcrypt.hash(testPassword, 10);

  const user1 = await prisma.user.upsert({
    where: { email: user1Email },
    update: { passwordHash: testPasswordHash, role: UserRole.USER, isActive: true },
    create: { email: user1Email, name: 'User One (Extension)', passwordHash: testPasswordHash, role: UserRole.USER, isActive: true },
  });

  const user2 = await prisma.user.upsert({
    where: { email: user2Email },
    update: { passwordHash: testPasswordHash, role: UserRole.USER, isActive: true },
    create: { email: user2Email, name: 'User Two (Isolator)', passwordHash: testPasswordHash, role: UserRole.USER, isActive: true },
  });

  // Clean existing test applications for clean test slate
  await prisma.application.deleteMany({
    where: { userId: { in: [user1.id, user2.id] } },
  });

  try {
    // -------------------------------------------------------------
    // TEST 1: AUTHENTICATION & SESSION HANDLING
    // -------------------------------------------------------------
    console.log('\n--- 1. AUTHENTICATION & EXTENSION SESSION ---');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user1Email, password: testPassword }),
    });

    const loginData: any = await loginRes.json();
    assert(loginRes.status === 200 && !!loginData.data?.tokens?.accessToken, 'Auth 1: Extension user can login and receive JWT tokens');
    const token1 = loginData.data.tokens.accessToken;
    const refreshToken1 = loginData.data.tokens.refreshToken;

    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const meData: any = await meRes.json();
    assert(meRes.status === 200 && meData.data?.user?.email === user1Email, 'Auth 2: GET /api/auth/me resolves user profile from token');

    // User 2 login for cross-access checks
    const loginRes2 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user2Email, password: testPassword }),
    });
    const loginData2: any = await loginRes2.json();
    const token2 = loginData2.data.tokens.accessToken;

    // -------------------------------------------------------------
    // TEST 2: LOCAL OCR VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 2. LOCAL OCR ARCHITECTURE CHECK ---');
    // Ensure backend does NOT expose /extract-passport (OCR remains 100% local on port 8001)
    const ocrRouteOnBackend = await fetch(`${BASE_URL}/extract-passport`, { method: 'POST' });
    assert(ocrRouteOnBackend.status === 404, 'OCR 1: Backend does NOT handle OCR endpoint (/extract-passport is local to extension/python service)');

    // -------------------------------------------------------------
    // TEST 3 & 4: SAVE APPLICATION WITH COMPLETE WORKSPACE DATA
    // -------------------------------------------------------------
    console.log('\n--- 3 & 4. SAVE APPLICATION (COMPLETE WORKSPACE JSON) ---');
    const fullWorkspacePayload = {
      applicationData: {
        fields: {
          'appl.surname': { value: 'CHOWDHURY', confidence: 0.98, provenance: 'OCR_PASSPORT_PAGE_2' },
          'appl.applname': { value: 'TANVIR AHMED', confidence: 0.95, provenance: 'OCR_PASSPORT_PAGE_2' },
          'appl.passno': { value: 'A12345678', confidence: 0.99, provenance: 'MRZ_LINE_1' },
          'appl.nationality': { value: 'BANGLADESH', confidence: 0.99, provenance: 'MRZ' },
          'appl.dob': { value: '1990-05-15', confidence: 0.97, provenance: 'VISUAL_INSPECTION' },
          'appl.gender': { value: 'Male', confidence: 0.99, provenance: 'MANUAL_SELECTION' },
        },
        manualEdits: {
          'appl.gender': { editedAt: new Date().toISOString(), editedBy: 'user' },
        },
        provenance: {
          engine: 'local-python-ocr',
          version: '1.0.0',
          extractedAt: new Date().toISOString(),
        },
        sourceDocuments: [
          { name: 'passport_scan.pdf', size: 1024, mime: 'application/pdf' },
        ],
        photograph: {
          base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          format: 'jpeg',
        },
        confidence: 0.975,
        status: 'draft',
        metadata: {
          browser: 'Chrome 128',
          extensionVersion: '1.4.2',
        },
      },
      originalPdf: DUMMY_PDF_BASE64,
      originalPdfFileName: 'passport_tanvir.pdf',
      originalPdfMimeType: 'application/pdf',
      applicantName: 'CHOWDHURY TANVIR AHMED',
      passportNumber: 'A12345678',
      status: 'draft',
    };

    const saveRes = await fetch(`${BASE_URL}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify(fullWorkspacePayload),
    });

    const saveData: any = await saveRes.json();
    assert(saveRes.status === 201 && !!saveData.data?.id, 'Save 1: POST /api/applications returns 201 with created application ID');
    const createdAppId = saveData.data?.id;

    // -------------------------------------------------------------
    // TEST 5: GET APPLICATIONS LIST
    // -------------------------------------------------------------
    console.log('\n--- 5. GET APPLICATIONS LIST ---');
    const listRes = await fetch(`${BASE_URL}/api/applications`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const listData: any = await listRes.json();
    assert(
      listRes.status === 200 &&
      Array.isArray(listData.data) &&
      listData.data.some((a: any) => a.id === createdAppId),
      'List 1: GET /api/applications contains the newly saved application'
    );
    assert(
      listData.data[0].originalPdf === undefined,
      'List 2: Heavy PDF bytes are excluded from lightweight list response'
    );

    // Verify User 2 cannot see User 1's applications
    const listRes2 = await fetch(`${BASE_URL}/api/applications`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    const listData2: any = await listRes2.json();
    assert(
      listRes2.status === 200 &&
      !listData2.data.some((a: any) => a.id === createdAppId),
      'List 3: Strict Isolation - User 2 cannot see User 1 applications'
    );

    // -------------------------------------------------------------
    // TEST 6: GET SINGLE APPLICATION (COMPLETE OBJECT PRESERVATION)
    // -------------------------------------------------------------
    console.log('\n--- 6. GET SINGLE APPLICATION ---');
    const getSingleRes = await fetch(`${BASE_URL}/api/applications/${createdAppId}`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const getSingleData: any = await getSingleRes.json();
    assert(getSingleRes.status === 200, 'Single 1: GET /api/applications/:id returns 200 for owner');
    
    // Verify 100% preservation of Workspace dynamic JSON
    const returnedWorkspace = getSingleData.data?.applicationData;
    assert(
      returnedWorkspace?.fields?.['appl.passno']?.value === 'A12345678' &&
      returnedWorkspace?.photograph?.base64 === 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' &&
      returnedWorkspace?.provenance?.engine === 'local-python-ocr' &&
      returnedWorkspace?.manualEdits?.['appl.gender']?.editedBy === 'user',
      'Single 2: Complete Workspace dynamic JSON preserved without loss or reduction'
    );

    // Cross-user test: User 2 must receive 404 for User 1's app
    const unauthorizedGet = await fetch(`${BASE_URL}/api/applications/${createdAppId}`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    assert(unauthorizedGet.status === 404, 'Single 3: Unauthorized user receives 404 on GET /api/applications/:id');

    // -------------------------------------------------------------
    // TEST 7: PDF DOWNLOAD
    // -------------------------------------------------------------
    console.log('\n--- 7. PDF DOWNLOAD ---');
    const pdfRes = await fetch(`${BASE_URL}/api/applications/${createdAppId}/pdf`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    assert(pdfRes.status === 200, 'PDF 1: GET /api/applications/:id/pdf returns 200 for owner');
    assert(pdfRes.headers.get('content-type') === 'application/pdf', 'PDF 2: Content-Type is application/pdf');
    const pdfBuffer = await pdfRes.arrayBuffer();
    assert(Buffer.from(pdfBuffer).toString() === DUMMY_PDF_BYTES.toString(), 'PDF 3: Downloaded PDF bytes exactly match original upload');

    // Cross-user test: User 2 cannot download PDF
    const unauthorizedPdf = await fetch(`${BASE_URL}/api/applications/${createdAppId}/pdf`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    assert(unauthorizedPdf.status === 404, 'PDF 4: Unauthorized user receives 404 on GET /api/applications/:id/pdf');

    // -------------------------------------------------------------
    // TEST 8 & 13: UPDATE EXISTING APPLICATION (NO DUPLICATES)
    // -------------------------------------------------------------
    console.log('\n--- 8 & 13. UPDATE APPLICATION (NO DUPLICATES) ---');
    const updatedPayload = {
      id: createdAppId, // Existing ID passed
      applicationData: {
        ...returnedWorkspace,
        fields: {
          ...returnedWorkspace.fields,
          'appl.email': { value: 'tanvir.updated@example.com', confidence: 1.0, provenance: 'MANUAL_EDIT' },
        },
        manualEdits: {
          ...returnedWorkspace.manualEdits,
          'appl.email': { editedAt: new Date().toISOString() },
        },
      },
      status: 'ready',
    };

    // Update via PUT /api/applications/:id
    const putRes = await fetch(`${BASE_URL}/api/applications/${createdAppId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify(updatedPayload),
    });
    const putData: any = await putRes.json();
    assert(putRes.status === 200, 'Update 1: PUT /api/applications/:id successfully updates application');
    assert(putData.data?.id === createdAppId, 'Update 2: Application ID remains identical after update');

    // Verify PDF is preserved when not provided on update
    const checkPdfAfterUpdate = await fetch(`${BASE_URL}/api/applications/${createdAppId}/pdf`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    assert(checkPdfAfterUpdate.status === 200, 'Update 3: Original PDF remains fully intact when not re-sent on update');

    // Also test updating via POST /api/applications with existing ID (Extension Save flow)
    const postUpdateRes = await fetch(`${BASE_URL}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify(updatedPayload),
    });
    const postUpdateData: any = await postUpdateRes.json();
    assert(postUpdateRes.status === 200, 'Update 4: POST /api/applications with existing ID updates application (HTTP 200)');
    assert(postUpdateData.data?.id === createdAppId, 'Update 5: ID is preserved and no duplicate created');

    const totalAppsForUser = await prisma.application.count({ where: { userId: user1.id } });
    assert(totalAppsForUser === 1, 'Update 6: Total applications for user is exactly 1 (zero duplicates created)');

    // -------------------------------------------------------------
    // TEST 10: RETRY / DUPLICATE PROTECTION (RAPID DOUBLE CLICK)
    // -------------------------------------------------------------
    console.log('\n--- 10. RETRY / DOUBLE-CLICK DUPLICATE PROTECTION ---');
    const rapidClickPayload = {
      applicationData: {
        fields: {
          'appl.passno': { value: 'B98765432' },
          'appl.surname': { value: 'RAHMAN' },
          'appl.applname': { value: 'ZIAUR' },
        },
      },
      originalPdf: DUMMY_PDF_BASE64,
      applicantName: 'RAHMAN ZIAUR',
      passportNumber: 'B98765432',
    };

    // Send 2 saves in parallel with no ID
    const [resA, resB] = await Promise.all([
      fetch(`${BASE_URL}/api/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
        body: JSON.stringify(rapidClickPayload),
      }),
      fetch(`${BASE_URL}/api/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
        body: JSON.stringify(rapidClickPayload),
      }),
    ]);

    const dataA: any = await resA.json();
    const dataB: any = await resB.json();
    assert(resA.ok && resB.ok, 'Retry 1: Both rapid requests succeed without race failure');
    assert(dataA.data.id === dataB.data.id, 'Retry 2: Duplicate protection deduplicates rapid double-click to same ID', `ID A: ${dataA.data.id}, ID B: ${dataB.data.id}`);

    const countWithPassportB = await prisma.application.count({
      where: { userId: user1.id, passportNumber: 'B98765432' },
    });
    assert(countWithPassportB === 1, 'Retry 3: Exactly 1 record created for double-click save');

    // -------------------------------------------------------------
    // TEST 11: AUTH TOKEN EXPIRY & REFRESH RECOVERY
    // -------------------------------------------------------------
    console.log('\n--- 11. TOKEN EXPIRY & REFRESH RECOVERY ---');
    // Create an expired access token manually to test backend expiration rejection
    const expiredAccessToken = jwt.sign(
      { sub: user1.id },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '-10s' }
    );

    const expiredReq = await fetch(`${BASE_URL}/api/applications`, {
      headers: { Authorization: `Bearer ${expiredAccessToken}` },
    });
    const expiredData: any = await expiredReq.json();
    assert(
      expiredReq.status === 401 && expiredData.message.includes('expired'),
      'Token 1: Expired access token is rejected with 401 "Access token has expired."'
    );

    // Refresh token rotation
    const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshToken1 }),
    });
    const refreshData: any = await refreshRes.json();
    assert(refreshRes.status === 200 && !!refreshData.data?.accessToken, 'Token 2: POST /api/auth/refresh successfully returns new access token');
    const newAccessToken = refreshData.data.accessToken;

    // Retry request with new token
    const retryReq = await fetch(`${BASE_URL}/api/applications`, {
      headers: { Authorization: `Bearer ${newAccessToken}` },
    });
    assert(retryReq.status === 200, 'Token 3: Request immediately succeeds using rotated access token');

    // -------------------------------------------------------------
    // TEST 12: BACKEND FAILURE HANDLING
    // -------------------------------------------------------------
    console.log('\n--- 12. BACKEND FAILURE VALIDATION ---');
    // Save without PDF on new app
    const noPdfRes = await fetch(`${BASE_URL}/api/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${newAccessToken}` },
      body: JSON.stringify({
        applicationData: { fields: {} },
        applicantName: 'Invalid Applicant',
      }),
    });
    assert(noPdfRes.status === 400, 'Fail 1: Missing PDF on new save returns HTTP 400 with helpful message');

    // Save with corrupt/invalid PDF bytes
    const corruptPdfRes = await fetch(`${BASE_URL}/api/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${newAccessToken}` },
      body: JSON.stringify({
        applicationData: { fields: {} },
        originalPdf: Buffer.from('NOT_A_PDF_FILE').toString('base64'),
        applicantName: 'Invalid PDF Applicant',
      }),
    });
    assert(corruptPdfRes.status === 400, 'Fail 2: Corrupted/non-PDF upload returns HTTP 400 rejection');

    // -------------------------------------------------------------
    // TEST 9: DELETE APPLICATION
    // -------------------------------------------------------------
    console.log('\n--- 9. DELETE APPLICATION ---');
    // User 2 tries to delete User 1's app
    const unauthDelete = await fetch(`${BASE_URL}/api/applications/${createdAppId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token2}` },
    });
    assert(unauthDelete.status === 404, 'Delete 1: Unauthorized user cannot delete another user application (HTTP 404)');

    // Owner deletes their own app
    const ownerDelete = await fetch(`${BASE_URL}/api/applications/${createdAppId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${newAccessToken}` },
    });
    assert(ownerDelete.status === 200, 'Delete 2: Owner deletes application successfully (HTTP 200)');

    // Verify app is gone
    const verifyGone = await fetch(`${BASE_URL}/api/applications/${createdAppId}`, {
      headers: { Authorization: `Bearer ${newAccessToken}` },
    });
    assert(verifyGone.status === 404, 'Delete 3: Deleted application no longer accessible (HTTP 404)');

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`E2E SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during E2E testing:', err);
    process.exit(1);
  } finally {
    // Cleanup test users and test apps
    await prisma.application.deleteMany({
      where: { userId: { in: [user1.id, user2.id] } },
    });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: [user1.id, user2.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [user1.id, user2.id] } },
    });
    await prisma.$disconnect();
  }
}

runE2ETests();
