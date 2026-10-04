import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '@prisma/client';
import {
  generateAuthTokens,
  refreshAccessToken,
  revokeRefreshToken,
  authenticateWithPassword,
} from '../services/auth.service';
import { parseDurationToMs, calculateRefreshTokenExpiresAt } from '../utils/duration';

const BASE_URL = `http://localhost:${env.PORT || 8000}`;

async function runPersistentSessionTests() {
  console.log('================================================================');
  console.log('TESTING 1-YEAR PERSISTENT REFRESH TOKEN & EXTENSION SESSIONS');
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

  const testEmail = 'persistent.session.test@example.com';
  const testPassword = 'TestSessionPassword123!';
  const passwordHash = await bcrypt.hash(testPassword, 10);

  try {
    await prisma.$connect();

    // Setup clean test user
    const testUser = await prisma.user.upsert({
      where: { email: testEmail },
      update: { passwordHash, isActive: true, role: UserRole.USER },
      create: {
        email: testEmail,
        name: 'Persistent Session User',
        passwordHash,
        isActive: true,
        role: UserRole.USER,
      },
    });

    // Clean prior refresh tokens for this user
    await prisma.refreshToken.deleteMany({
      where: { userId: testUser.id },
    });

    // -------------------------------------------------------------
    // TEST 1: NORMAL LOGIN & TOKEN GENERATION (SERVICE LEVEL)
    // -------------------------------------------------------------
    console.log('\n--- 1. NORMAL LOGIN & TOKEN GENERATION ---');
    const authUser = await authenticateWithPassword(testEmail, testPassword);
    assert(authUser.id === testUser.id, 'Test 1.1: Password authentication succeeds for user');

    const tokens = await generateAuthTokens(testUser.id);
    assert(!!tokens.accessToken, 'Test 1.2: Access Token is issued');
    assert(!!tokens.refreshToken, 'Test 1.3: Refresh Token is issued');

    // Decode Refresh Token
    const decodedRefresh = jwt.decode(tokens.refreshToken) as jwt.JwtPayload;
    assert(!!decodedRefresh && !!decodedRefresh.exp && !!decodedRefresh.iat, 'Test 1.4: Refresh token contains exp and iat claims');

    const refreshLifetimeSeconds = (decodedRefresh.exp! - decodedRefresh.iat!);
    const expected365DaysSeconds = 365 * 24 * 60 * 60; // 31,536,000s
    const refreshDiff = Math.abs(refreshLifetimeSeconds - expected365DaysSeconds);
    assert(
      refreshDiff <= 86400,
      `Test 1.5: Refresh token lifetime is ~365 days (${(refreshLifetimeSeconds / 86400).toFixed(1)} days)`,
      `Lifetime: ${refreshLifetimeSeconds}s, Expected: ${expected365DaysSeconds}s`
    );

    // -------------------------------------------------------------
    // TEST 2: DATABASE REFRESH TOKEN RECORD & EXPIRESAT
    // -------------------------------------------------------------
    console.log('\n--- 2. DATABASE REFRESH TOKEN EXPIRATION ---');
    const dbTokenRecord = await prisma.refreshToken.findUnique({
      where: { token: tokens.refreshToken },
    });
    assert(!!dbTokenRecord, 'Test 2.1: RefreshToken record exists in database');

    if (dbTokenRecord) {
      const dbLifetimeMs = dbTokenRecord.expiresAt.getTime() - dbTokenRecord.createdAt.getTime();
      const expected365DaysMs = 365 * 24 * 60 * 60 * 1000;
      const dbDiffDays = Math.abs(dbLifetimeMs - expected365DaysMs) / (24 * 60 * 60 * 1000);
      assert(
        dbDiffDays <= 1,
        `Test 2.2: RefreshToken.expiresAt ≈ createdAt + 365 days (difference: ${(dbLifetimeMs / (24 * 60 * 60 * 1000)).toFixed(1)} days)`,
        `DB lifetime: ${dbLifetimeMs}ms`
      );

      // Verify DB expiresAt matches JWT exp timestamp exactly
      const jwtExpMs = decodedRefresh.exp! * 1000;
      assert(
        Math.abs(dbTokenRecord.expiresAt.getTime() - jwtExpMs) < 1000,
        'Test 2.3: Database expiresAt exactly synchronizes with JWT exp claim',
        `DB expiresAt: ${dbTokenRecord.expiresAt.toISOString()}, JWT exp: ${new Date(jwtExpMs).toISOString()}`
      );
    }

    // -------------------------------------------------------------
    // TEST 3: ACCESS TOKEN LIFETIME REMAINS SHORT-LIVED
    // -------------------------------------------------------------
    console.log('\n--- 3. SHORT-LIVED ACCESS TOKEN VALIDATION ---');
    const decodedAccess = jwt.decode(tokens.accessToken) as jwt.JwtPayload;
    assert(!!decodedAccess && !!decodedAccess.exp && !!decodedAccess.iat, 'Test 3.1: Access token contains exp and iat claims');

    const accessLifetimeSeconds = (decodedAccess.exp! - decodedAccess.iat!);
    assert(
      accessLifetimeSeconds <= 15 * 60 && accessLifetimeSeconds >= 14 * 60,
      `Test 3.2: Access token remains strictly short-lived (${accessLifetimeSeconds / 60} minutes)`,
      `Got: ${accessLifetimeSeconds}s, Expected: ~900s (15m)`
    );

    // -------------------------------------------------------------
    // TEST 4: REFRESH ENDPOINT WITH VALID REFRESH TOKEN
    // -------------------------------------------------------------
    console.log('\n--- 4. REFRESH ACCESS TOKEN ENDPOINT ---');
    const refreshResult = await refreshAccessToken(tokens.refreshToken);
    assert(!!refreshResult.accessToken, 'Test 4.1: Valid refresh token issues a new Access Token');

    const decodedNewAccess = jwt.decode(refreshResult.accessToken) as jwt.JwtPayload;
    const newAccessLifetimeSeconds = (decodedNewAccess.exp! - decodedNewAccess.iat!);
    assert(
      newAccessLifetimeSeconds <= 15 * 60 && newAccessLifetimeSeconds >= 14 * 60,
      `Test 4.2: Newly refreshed Access Token is also short-lived (${newAccessLifetimeSeconds / 60} minutes)`
    );

    // -------------------------------------------------------------
    // TEST 5: INVALID REFRESH TOKEN REJECTION
    // -------------------------------------------------------------
    console.log('\n--- 5. INVALID REFRESH TOKEN REJECTION ---');
    let invalidCaught = false;
    let invalidMessage = '';
    try {
      await refreshAccessToken('invalid.token.signature');
    } catch (err: any) {
      invalidCaught = true;
      invalidMessage = err.message;
    }
    assert(
      invalidCaught && invalidMessage.includes('Invalid or expired refresh token'),
      'Test 5.1: Malformed or forged refresh token is rejected',
      `Message: ${invalidMessage}`
    );

    // -------------------------------------------------------------
    // TEST 6: EXPIRED REFRESH TOKEN REJECTION
    // -------------------------------------------------------------
    console.log('\n--- 6. EXPIRED REFRESH TOKEN REJECTION ---');
    const expiredJwt = jwt.sign(
      { sub: testUser.id },
      env.JWT_REFRESH_SECRET,
      { expiresIn: '-10s' }
    );
    await prisma.refreshToken.create({
      data: {
        token: expiredJwt,
        userId: testUser.id,
        expiresAt: new Date(Date.now() - 10000),
      },
    });

    let expiredCaught = false;
    let expiredMessage = '';
    try {
      await refreshAccessToken(expiredJwt);
    } catch (err: any) {
      expiredCaught = true;
      expiredMessage = err.message;
    }
    assert(
      expiredCaught && (expiredMessage.includes('Invalid or expired') || expiredMessage.includes('expired or has been revoked')),
      'Test 6.1: Expired refresh token is rejected',
      `Message: ${expiredMessage}`
    );

    const validJwtExpiredInDb = jwt.sign(
      { sub: testUser.id },
      env.JWT_REFRESH_SECRET,
      { expiresIn: '1h' }
    );
    await prisma.refreshToken.create({
      data: {
        token: validJwtExpiredInDb,
        userId: testUser.id,
        expiresAt: new Date(Date.now() - 5000),
      },
    });

    let dbExpiredCaught = false;
    try {
      await refreshAccessToken(validJwtExpiredInDb);
    } catch (err: any) {
      dbExpiredCaught = true;
    }
    assert(dbExpiredCaught, 'Test 6.2: Refresh token with expired DB record is rejected');

    // -------------------------------------------------------------
    // TEST 7: INACTIVE / DEACTIVATED USER REJECTION
    // -------------------------------------------------------------
    console.log('\n--- 7. INACTIVE USER REJECTION ---');
    await prisma.user.update({
      where: { id: testUser.id },
      data: { isActive: false },
    });

    let inactiveCaught = false;
    let inactiveMessage = '';
    try {
      await refreshAccessToken(tokens.refreshToken);
    } catch (err: any) {
      inactiveCaught = true;
      inactiveMessage = err.message;
    }
    assert(
      inactiveCaught && inactiveMessage.includes('deactivated'),
      'Test 7.1: Refresh attempt for deactivated user is strictly blocked',
      `Message: ${inactiveMessage}`
    );

    // Reactivate user
    await prisma.user.update({
      where: { id: testUser.id },
      data: { isActive: true },
    });

    // -------------------------------------------------------------
    // TEST 8: LOGOUT / REVOCATION BEHAVIOR
    // -------------------------------------------------------------
    console.log('\n--- 8. LOGOUT & REVOCATION BEHAVIOR ---');
    const workingAgain = await refreshAccessToken(tokens.refreshToken);
    assert(!!workingAgain.accessToken, 'Test 8.1: Token works normally after reactivation');

    await revokeRefreshToken(tokens.refreshToken);

    const revokedRecord = await prisma.refreshToken.findUnique({
      where: { token: tokens.refreshToken },
    });
    assert(!revokedRecord, 'Test 8.2: Revoked refresh token is purged from database on logout');

    let revokedCaught = false;
    let revokedMessage = '';
    try {
      await refreshAccessToken(tokens.refreshToken);
    } catch (err: any) {
      revokedCaught = true;
      revokedMessage = err.message;
    }
    assert(
      revokedCaught && revokedMessage.includes('expired or has been revoked'),
      'Test 8.3: Revoked refresh token is rejected upon subsequent refresh attempts',
      `Message: ${revokedMessage}`
    );

    // -------------------------------------------------------------
    // TEST 9: HTTP API REST ENDPOINT VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 9. HTTP REST ENDPOINTS (CHROME EXTENSION FLOW) ---');
    // Login via HTTP
    const httpLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    const httpLoginData: any = await httpLoginRes.json();
    assert(
      httpLoginRes.status === 200 && !!httpLoginData.data?.tokens?.refreshToken,
      'Test 9.1: HTTP POST /api/auth/login returns 200 with tokens'
    );
    const httpRefreshToken = httpLoginData.data.tokens.refreshToken;

    // Refresh via HTTP
    const httpRefreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: httpRefreshToken }),
    });
    const httpRefreshData: any = await httpRefreshRes.json();
    assert(
      httpRefreshRes.status === 200 && !!httpRefreshData.data?.accessToken,
      'Test 9.2: HTTP POST /api/auth/refresh returns 200 with new accessToken'
    );
    const httpNewAccessToken = httpRefreshData.data.accessToken;

    // Verify authenticated endpoint with refreshed access token
    const httpMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${httpNewAccessToken}` },
    });
    const httpMeData: any = await httpMeRes.json();
    assert(
      httpMeRes.status === 200 && httpMeData.data?.user?.email === testEmail,
      'Test 9.3: Refreshed accessToken succeeds on HTTP GET /api/auth/me'
    );

    // Logout via HTTP
    const httpLogoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: httpRefreshToken }),
    });
    assert(
      httpLogoutRes.status === 200,
      'Test 9.4: HTTP POST /api/auth/logout returns 200'
    );

    // Refresh with logged-out token via HTTP
    const httpPostLogoutRefresh = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: httpRefreshToken }),
    });
    assert(
      httpPostLogoutRefresh.status === 401,
      'Test 9.5: HTTP POST /api/auth/refresh returns 401 after logout'
    );

    // Refresh with invalid token via HTTP
    const httpInvalidRefresh = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'bogus-token-data' }),
    });
    assert(
      httpInvalidRefresh.status === 401,
      'Test 9.6: HTTP POST /api/auth/refresh returns 401 for invalid token'
    );

    // -------------------------------------------------------------
    // TEST 10: DURATION UTILITY UNIT TESTS
    // -------------------------------------------------------------
    console.log('\n--- 10. DURATION UTILITY UNIT TESTS ---');
    assert(parseDurationToMs('365d') === 365 * 24 * 60 * 60 * 1000, 'Test 10.1: parseDurationToMs parses "365d" correctly');
    assert(parseDurationToMs('7d') === 7 * 24 * 60 * 60 * 1000, 'Test 10.2: parseDurationToMs parses "7d" correctly');
    assert(parseDurationToMs('15m') === 15 * 60 * 1000, 'Test 10.3: parseDurationToMs parses "15m" correctly');
    assert(parseDurationToMs('24h') === 24 * 60 * 60 * 1000, 'Test 10.4: parseDurationToMs parses "24h" correctly');
    assert(parseDurationToMs(undefined) === 365 * 24 * 60 * 60 * 1000, 'Test 10.5: parseDurationToMs defaults to 365 days');

    const calculatedExpiresAt = calculateRefreshTokenExpiresAt();
    const diffDays = (calculatedExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    assert(
      Math.abs(diffDays - 365) < 0.1,
      `Test 10.6: calculateRefreshTokenExpiresAt produces Date ~365 days in future (${diffDays.toFixed(1)} days)`
    );

    // Clean up test user & tokens
    await prisma.refreshToken.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.user.delete({
      where: { id: testUser.id },
    });

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Unexpected test error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPersistentSessionTests();
