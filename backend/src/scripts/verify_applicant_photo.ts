import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';

const BASE_URL = 'http://localhost:8000';

// Sample valid test images
const VALID_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x64, 0x00, 0x64, 0x03, 0x01, 0x22,
  0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9,
]);

const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG Signature
  0x00, 0x00, 0x00, 0x0d, // IHDR length (13)
  0x49, 0x48, 0x44, 0x52, // "IHDR"
  0x00, 0x00, 0x00, 0x64, // Width = 100
  0x00, 0x00, 0x00, 0x64, // Height = 100
  0x08, 0x06, 0x00, 0x00, 0x00, // Bit depth 8, ColorType 6 (RGBA), etc.
  0x70, 0xe1, 0xf5, 0x0b, // CRC
  0x00, 0x00, 0x00, 0x00, // IEND length (0)
  0x49, 0x45, 0x4e, 0x44, // "IEND"
  0xae, 0x42, 0x60, 0x82, // CRC
]);

const VALID_WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x26, 0x00, 0x00, 0x00]), // 38 bytes total
  Buffer.from('WEBP'),
  Buffer.from('VP8 '),
  Buffer.from([0x1a, 0x00, 0x00, 0x00]), // 26 bytes chunk
  Buffer.from([
    0x30, 0x01, 0x00, // Frame tag (keyframe)
    0x9d, 0x01, 0x2a, // Start code
    0x64, 0x00,       // Width = 100 (100 & 0x3fff)
    0x64, 0x00,       // Height = 100 (100 & 0x3fff)
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]),
]);

const DUMMY_PDF_BYTES = Buffer.from(
  '%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Title (Test Passport) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF'
);
const DUMMY_PDF_BASE64 = DUMMY_PDF_BYTES.toString('base64');

async function runPhotoTests() {
  console.log('================================================================');
  console.log('STARTING APPLICANT PHOTO BACKEND TEST SUITE (18 CHECKS + DIRECT API)');
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

  // 1. Setup Users (User A, User B, Manager, Admin)
  const userAEmail = 'photo.test.usera@example.com';
  const userBEmail = 'photo.test.userb@example.com';
  const managerEmail = 'photo.test.manager@example.com';
  const adminEmail = 'photo.test.admin@example.com';
  const password = 'Password123!@#';
  const passwordHash = await bcrypt.hash(password, 10);

  const userA = await prisma.user.upsert({
    where: { email: userAEmail },
    update: { passwordHash, role: UserRole.USER, isActive: true },
    create: { email: userAEmail, name: 'User A Photo', passwordHash, role: UserRole.USER, isActive: true },
  });

  const userB = await prisma.user.upsert({
    where: { email: userBEmail },
    update: { passwordHash, role: UserRole.USER, isActive: true },
    create: { email: userBEmail, name: 'User B Photo', passwordHash, role: UserRole.USER, isActive: true },
  });

  const manager = await prisma.user.upsert({
    where: { email: managerEmail },
    update: { passwordHash, role: UserRole.MANAGER, isActive: true },
    create: { email: managerEmail, name: 'Manager Photo', passwordHash, role: UserRole.MANAGER, isActive: true },
  });

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: UserRole.ADMIN, isActive: true },
    create: { email: adminEmail, name: 'Admin Photo', passwordHash, role: UserRole.ADMIN, isActive: true },
  });

  // Clean old test applications
  await prisma.application.deleteMany({
    where: { userId: { in: [userA.id, userB.id, manager.id, admin.id] } },
  });

  // Authenticate users
  const loginResA = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userAEmail, password }),
  });
  const loginDataA: any = await loginResA.json();
  const tokenA = loginDataA.data?.tokens?.accessToken;

  const loginResB = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userBEmail, password }),
  });
  const loginDataB: any = await loginResB.json();
  const tokenB = loginDataB.data?.tokens?.accessToken;

  const loginResManager = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: managerEmail, password }),
  });
  const loginDataManager: any = await loginResManager.json();
  const tokenManager = loginDataManager.data?.tokens?.accessToken;

  const loginResAdmin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password }),
  });
  const loginDataAdmin: any = await loginResAdmin.json();
  const tokenAdmin = loginDataAdmin.data?.tokens?.accessToken;

  assert(Boolean(tokenA && tokenB && tokenManager && tokenAdmin), 'Setup: User A, User B, Manager, and Admin authenticated');

  let appAId = '';
  let appBId = '';

  try {
    // -------------------------------------------------------------
    // TEST 1: UPLOAD VALID JPEG
    // -------------------------------------------------------------
    console.log('\n--- 1. UPLOAD VALID JPEG ---');
    const jpegPayload = {
      applicationData: {
        fields: {
          'appl.surname': { value: 'TEST' },
          'appl.applname': { value: 'USER A' },
          'appl.passno': { value: 'J12345678' },
        },
      },
      originalPdf: DUMMY_PDF_BASE64,
      originalPdfFileName: 'passport_a.pdf',
      originalPdfMimeType: 'application/pdf',
      applicantName: 'USER A TEST',
      passportNumber: 'J12345678',
      applicant_photo: `data:image/jpeg;base64,${VALID_JPEG.toString('base64')}`,
      applicant_photo_name: 'photo_a.jpg',
      applicant_photo_mime: 'image/jpeg',
    };

    const res1 = await fetch(`${BASE_URL}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify(jpegPayload),
    });
    const data1: any = await res1.json();
    assert(
      res1.status === 201 && data1.data?.applicantPhoto?.exists === true,
      'Test 1: Upload valid JPEG on application create returns 201 with applicantPhoto.exists = true',
      `Status: ${res1.status}, data: ${JSON.stringify(data1)}`
    );
    appAId = data1.data?.id;

    // Verify all 5 database fields persisted correctly
    const dbAppA = await prisma.application.findUnique({
      where: { id: appAId },
      select: {
        applicant_photo: true,
        applicant_photo_name: true,
        applicant_photo_mime: true,
        applicant_photo_size: true,
        applicant_photo_updated_at: true,
      },
    });
    assert(
      Boolean(
        dbAppA?.applicant_photo &&
        dbAppA.applicant_photo.length === VALID_JPEG.length &&
        dbAppA.applicant_photo_name === 'photo_a.jpg' &&
        dbAppA.applicant_photo_mime === 'image/jpeg' &&
        dbAppA.applicant_photo_size === VALID_JPEG.length &&
        dbAppA.applicant_photo_updated_at
      ),
      'Test 1b: Database columns applicant_photo, name, mime, size, and updated_at persisted accurately'
    );

    // -------------------------------------------------------------
    // TEST 2: UPLOAD VALID PNG
    // -------------------------------------------------------------
    console.log('\n--- 2. UPLOAD VALID PNG ---');
    const res2 = await fetch(`${BASE_URL}/api/applications/${appAId}/photo`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        applicant_photo: `data:image/png;base64,${VALID_PNG.toString('base64')}`,
        applicant_photo_name: 'photo_a.png',
        applicant_photo_mime: 'image/png',
      }),
    });
    const data2: any = await res2.json();
    assert(
      res2.status === 200 && data2.data?.applicantPhoto?.mimeType === 'image/png',
      'Test 2: Dedicated PUT /:id/photo accepts valid PNG with HTTP 200',
      `Status: ${res2.status}`
    );

    // -------------------------------------------------------------
    // TEST 3: UPLOAD VALID WEBP
    // -------------------------------------------------------------
    console.log('\n--- 3. UPLOAD VALID WEBP ---');
    const res3 = await fetch(`${BASE_URL}/api/applications/${appAId}/photo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        applicant_photo: `data:image/webp;base64,${VALID_WEBP.toString('base64')}`,
        applicant_photo_name: 'photo_a.webp',
        applicant_photo_mime: 'image/webp',
      }),
    });
    const data3: any = await res3.json();
    assert(
      res3.status === 200 && data3.data?.applicantPhoto?.mimeType === 'image/webp',
      'Test 3: Upload valid WebP returns HTTP 200 with detected image/webp',
      `Status: ${res3.status}`
    );

    // -------------------------------------------------------------
    // TEST 4: INVALID MIME TYPE
    // -------------------------------------------------------------
    console.log('\n--- 4. REJECT INVALID MIME TYPE ---');
    const res4 = await fetch(`${BASE_URL}/api/applications/${appAId}/photo`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        applicant_photo: `data:application/pdf;base64,${DUMMY_PDF_BASE64}`,
        applicant_photo_mime: 'application/pdf',
      }),
    });
    const data4: any = await res4.json();
    assert(
      res4.status === 400 && data4.success === false,
      'Test 4: Unsupported MIME type (application/pdf) is rejected with HTTP 400',
      `Status: ${res4.status}, message: ${data4.message}`
    );

    // -------------------------------------------------------------
    // TEST 5: INVALID / CORRUPT IMAGE
    // -------------------------------------------------------------
    console.log('\n--- 5. REJECT INVALID / CORRUPT IMAGE ---');
    const corruptBuffer = Buffer.from('NOT_AN_IMAGE_FILE_RANDOM_TEXT_DATA_CORRUPT');
    const res5 = await fetch(`${BASE_URL}/api/applications/${appAId}/photo`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        applicant_photo: `data:image/jpeg;base64,${corruptBuffer.toString('base64')}`,
        applicant_photo_mime: 'image/jpeg',
      }),
    });
    const data5: any = await res5.json();
    assert(
      res5.status === 400 && data5.success === false,
      'Test 5: Corrupt/invalid image bytes are rejected with HTTP 400',
      `Status: ${res5.status}, message: ${data5.message}`
    );

    // -------------------------------------------------------------
    // TEST 6: IMAGE EXCEEDING 5MB
    // -------------------------------------------------------------
    console.log('\n--- 6. REJECT IMAGE LARGER THAN 5MB ---');
    const hugeBuffer = Buffer.alloc(6 * 1024 * 1024);
    // Write valid JPEG header at start to isolate size check
    VALID_JPEG.copy(hugeBuffer, 0, 0, 10);
    const res6 = await fetch(`${BASE_URL}/api/applications/${appAId}/photo`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        applicant_photo: `data:image/jpeg;base64,${hugeBuffer.toString('base64')}`,
      }),
    });
    const data6: any = await res6.json();
    assert(
      (res6.status === 413 || res6.status === 400) && data6.success === false,
      'Test 6: Photo larger than 5 MB is rejected with HTTP 413 / 400',
      `Status: ${res6.status}, message: ${data6.message}`
    );

    // -------------------------------------------------------------
    // TEST 7: GET OWN PHOTO
    // -------------------------------------------------------------
    console.log('\n--- 7. GET OWN PHOTO ---');
    await fetch(`${BASE_URL}/api/applications/${appAId}/photo`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        applicant_photo: `data:image/jpeg;base64,${VALID_JPEG.toString('base64')}`,
        applicant_photo_name: 'tanvir_passport_photo.jpg',
      }),
    });

    const res7 = await fetch(`${BASE_URL}/api/applications/${appAId}/photo`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(res7.status === 200, 'Test 7: GET /api/applications/:id/photo returns HTTP 200 for owner');
    assert(res7.headers.get('content-type') === 'image/jpeg', 'Test 7b: Correct Content-Type: image/jpeg');
    assert(res7.headers.get('content-length') === String(VALID_JPEG.length), 'Test 7c: Correct Content-Length matches image size');
    assert(res7.headers.get('cache-control')?.includes('no-cache') === true, 'Test 7d: Safe Cache-Control header present');
    const photoBytes = await res7.arrayBuffer();
    assert(
      Buffer.from(photoBytes).equals(VALID_JPEG),
      'Test 7e: Downloaded image bytes match exactly what was persisted'
    );

    // -------------------------------------------------------------
    // TEST 8: REPLACE PHOTO
    // -------------------------------------------------------------
    console.log('\n--- 8. REPLACE PHOTO ---');
    const res8Replace = await fetch(`${BASE_URL}/api/applications/${appAId}/photo`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        applicant_photo: `data:image/png;base64,${VALID_PNG.toString('base64')}`,
        applicant_photo_name: 'new_replaced.png',
      }),
    });
    assert(res8Replace.status === 200, 'Test 8: Photo replacement request returns HTTP 200');

    const res8Verify = await fetch(`${BASE_URL}/api/applications/${appAId}/photo`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(
      res8Verify.status === 200 && res8Verify.headers.get('content-type') === 'image/png',
      'Test 8b: Replaced photo returns updated image/png type'
    );
    const newBytes = await res8Verify.arrayBuffer();
    assert(
      Buffer.from(newBytes).equals(VALID_PNG),
      'Test 8c: Downloaded bytes strictly match newly replaced PNG photo'
    );

    // -------------------------------------------------------------
    // TEST 9: DELETE PHOTO
    // -------------------------------------------------------------
    console.log('\n--- 9. DELETE PHOTO ---');
    const res9Delete = await fetch(`${BASE_URL}/api/applications/${appAId}/photo`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(res9Delete.status === 200, 'Test 9: DELETE /:id/photo returns HTTP 200');

    const dbAppADeleted = await prisma.application.findUnique({
      where: { id: appAId },
    });
    assert(
      dbAppADeleted?.applicant_photo === null &&
      dbAppADeleted?.applicant_photo_name === null &&
      dbAppADeleted?.applicant_photo_mime === null &&
      dbAppADeleted?.applicant_photo_size === null &&
      dbAppADeleted?.applicant_photo_updated_at === null,
      'Test 9b: All 5 photo database columns are safely set to null'
    );
    assert(
      Boolean(dbAppADeleted?.originalPdf && dbAppADeleted?.applicationData),
      'Test 9c: Application record, PDF, and applicationData remain completely intact'
    );

    // -------------------------------------------------------------
    // TEST 10: GET DELETED PHOTO => 404
    // -------------------------------------------------------------
    console.log('\n--- 10. GET DELETED PHOTO => 404 ---');
    const res10Get = await fetch(`${BASE_URL}/api/applications/${appAId}/photo`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(
      res10Get.status === 404,
      'Test 10: GET /:id/photo after deletion returns HTTP 404'
    );

    // -------------------------------------------------------------
    // TEST 11: USER A CANNOT ACCESS USER B PHOTO (IDOR PROTECTION)
    // -------------------------------------------------------------
    console.log("\n--- 11. USER A CANNOT ACCESS USER B'S PHOTO ---");
    const res11CreateB = await fetch(`${BASE_URL}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        applicationData: { fields: { 'appl.passno': { value: 'USERBPASS99' } } },
        originalPdf: DUMMY_PDF_BASE64,
        passportNumber: 'USERBPASS99',
        applicantName: 'USER B TARGET',
        applicant_photo: `data:image/jpeg;base64,${VALID_JPEG.toString('base64')}`,
      }),
    });
    const data11B: any = await res11CreateB.json();
    appBId = data11B.data?.id;

    const res11GetCross = await fetch(`${BASE_URL}/api/applications/${appBId}/photo`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(
      res11GetCross.status === 404,
      'Test 11: User A receives HTTP 404 attempting to GET User B photo (IDOR protected)'
    );

    // -------------------------------------------------------------
    // TEST 12: USER A CANNOT DELETE USER B PHOTO
    // -------------------------------------------------------------
    console.log("\n--- 12. USER A CANNOT DELETE USER B'S PHOTO ---");
    const res12DeleteCross = await fetch(`${BASE_URL}/api/applications/${appBId}/photo`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(
      res12DeleteCross.status === 404,
      'Test 12: User A receives HTTP 404 attempting to DELETE User B photo'
    );

    // -------------------------------------------------------------
    // TEST 13: ADMIN CAN VIEW PHOTO
    // -------------------------------------------------------------
    console.log('\n--- 13. ADMIN CAN VIEW PHOTO ---');
    const res13AdminDirect = await fetch(`${BASE_URL}/api/applications/${appBId}/photo`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert(
      res13AdminDirect.status === 200,
      'Test 13: Admin can access application photo via /api/applications/:id/photo'
    );

    const res13AdminDedicated = await fetch(`${BASE_URL}/api/admin/applications/${appBId}/photo`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert(
      res13AdminDedicated.status === 200,
      'Test 13b: Admin can access application photo via /api/admin/applications/:id/photo'
    );

    const res13UserOnAdmin = await fetch(`${BASE_URL}/api/admin/applications/${appBId}/photo`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(
      res13UserOnAdmin.status === 403,
      'Test 13c: Regular User receives HTTP 403 trying to access admin photo endpoint'
    );

    // -------------------------------------------------------------
    // TEST 14: MANAGER FOLLOWS EXISTING READ-ONLY RULE
    // -------------------------------------------------------------
    console.log('\n--- 14. MANAGER FOLLOWS READ-ONLY RULE ---');
    const res14ManagerView = await fetch(`${BASE_URL}/api/admin/applications/${appBId}/photo`, {
      headers: { Authorization: `Bearer ${tokenManager}` },
    });
    assert(
      res14ManagerView.status === 200,
      'Test 14a: Manager can view photo via /api/admin/applications/:id/photo'
    );

    // Manager cannot delete application
    const res14ManagerDelete = await fetch(`${BASE_URL}/api/admin/applications/${appBId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenManager}` },
    });
    assert(
      res14ManagerDelete.status === 403,
      'Test 14b: Manager receives HTTP 403 trying to delete application (read-only enforced)'
    );

    // -------------------------------------------------------------
    // TEST 15: APPLICATION SAVE PRESERVES PHOTO
    // -------------------------------------------------------------
    console.log('\n--- 15. APPLICATION SAVE PRESERVES PHOTO ---');
    const updateAppBRes = await fetch(`${BASE_URL}/api/applications/${appBId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        status: 'reviewed',
        applicantName: 'UPDATED NAME USER B',
      }),
    });
    assert(updateAppBRes.status === 200, 'Test 15a: Application metadata update succeeded');

    const checkBAfter = await prisma.application.findUnique({
      where: { id: appBId },
      select: { applicant_photo: true, status: true, applicantName: true },
    });
    assert(
      Boolean(checkBAfter?.applicant_photo) &&
      checkBAfter?.status === 'reviewed' &&
      checkBAfter?.applicantName === 'UPDATED NAME USER B',
      'Test 15b: Existing applicant_photo is 100% preserved when not included in update request'
    );

    // -------------------------------------------------------------
    // TEST 16: PDF DOWNLOAD STILL WORKS
    // -------------------------------------------------------------
    console.log('\n--- 16. PDF DOWNLOAD STILL WORKS ---');
    const pdfCheckRes = await fetch(`${BASE_URL}/api/applications/${appBId}/pdf`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(
      pdfCheckRes.status === 200 &&
      Boolean(pdfCheckRes.headers.get('content-type')?.includes('pdf')),
      'Test 16: Original PDF remains accessible after photo operations'
    );

    // -------------------------------------------------------------
    // TEST 17: EXISTING APPLICATION LIFECYCLE STILL WORKS
    // -------------------------------------------------------------
    console.log('\n--- 17. EXISTING APPLICATION LIFECYCLE STILL WORKS ---');
    const singleGetRes = await fetch(`${BASE_URL}/api/applications/${appBId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const singleGetData: any = await singleGetRes.json();
    assert(
      singleGetData.data?.applicantPhoto?.exists === true &&
      singleGetData.data?.applicantPhoto?.url === `/api/applications/${appBId}/photo` &&
      typeof singleGetData.data?.applicantPhoto?.size === 'number' &&
      typeof singleGetData.data?.applicantPhoto?.updatedAt === 'string' &&
      singleGetData.data?.applicant_photo === undefined,
      'Test 17: Application detail exposes structured applicantPhoto metadata without raw bytes'
    );

    // -------------------------------------------------------------
    // TEST 18: UNAUTHENTICATED PHOTO REQUEST => 401
    // -------------------------------------------------------------
    console.log('\n--- 18. UNAUTHENTICATED PHOTO REQUEST => 401 ---');
    const res18 = await fetch(`${BASE_URL}/api/applications/${appBId}/photo`);
    assert(
      res18.status === 401,
      'Test 18: Unauthenticated photo request returns HTTP 401'
    );

    // -------------------------------------------------------------
    // TEST 19: DIRECT CHROME EXTENSION ENDPOINT POST /api/applicant_photo
    // -------------------------------------------------------------
    console.log('\n--- 19. DIRECT EXTENSION ENDPOINT POST /api/applicant_photo ---');
    // First test unauthenticated => 401 (proves route exists and is authenticated)
    const res19Unauth = await fetch(`${BASE_URL}/api/applicant_photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(
      res19Unauth.status === 401,
      'Test 19a: POST /api/applicant_photo returns 401 when unauthenticated (NO LONGER 404)'
    );

    // Test authenticated upload to user's active application
    const res19Auth = await fetch(`${BASE_URL}/api/applicant_photo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        applicationId: appBId,
        applicant_photo: `data:image/jpeg;base64,${VALID_JPEG.toString('base64')}`,
        applicant_photo_name: 'extension_direct.jpg',
      }),
    });
    const data19Auth: any = await res19Auth.json();
    assert(
      res19Auth.status === 200 && data19Auth.success === true && data19Auth.data?.applicantPhoto?.exists === true,
      'Test 19b: POST /api/applicant_photo succeeds with HTTP 200 and returns applicantPhoto metadata'
    );

    // Test GET /api/applicant_photo direct stream
    const res19Get = await fetch(`${BASE_URL}/api/applicant_photo?applicationId=${appBId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(
      res19Get.status === 200 && res19Get.headers.get('content-type') === 'image/jpeg',
      'Test 19c: GET /api/applicant_photo streams photo directly'
    );

  } finally {
    // Clean up test records
    await prisma.application.deleteMany({
      where: { userId: { in: [userA.id, userB.id, manager.id, admin.id] } },
    });
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhotoTests()
  .catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
