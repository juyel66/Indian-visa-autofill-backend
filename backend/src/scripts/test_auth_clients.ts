import { env } from '../config/env';
import { verifyGoogleToken, resolveClientCredentials } from '../services/google.service';
import { findOrCreateUser, generateAuthTokens } from '../services/auth.service';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function runTests() {
  console.log('====================================================');
  console.log('TESTING DUAL GOOGLE OAUTH CLIENT IDs & VERIFICATION');
  console.log('====================================================\n');

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

  try {
    await prisma.$connect();

    // 1. Verify Both Trusted Client IDs are configured
    const webId = '478244875026-vc9kkmtbl8geq0gl2jv3vc40hndqqb0u.apps.googleusercontent.com';
    const extId = '478244875026-tpnqtk9ke8e1tpldgrsu40gft4r65ifu.apps.googleusercontent.com';

    assert(
      env.GOOGLE_WEB_CLIENT_ID === webId,
      'Check 1: GOOGLE_WEB_CLIENT_ID matches Web Dashboard Client ID',
      `Got: ${env.GOOGLE_WEB_CLIENT_ID}`
    );

    assert(
      env.GOOGLE_EXTENSION_CLIENT_ID === extId,
      'Check 2: GOOGLE_EXTENSION_CLIENT_ID matches Chrome Extension Client ID',
      `Got: ${env.GOOGLE_EXTENSION_CLIENT_ID}`
    );

    assert(
      env.TRUSTED_GOOGLE_CLIENT_IDS.includes(webId) &&
      env.TRUSTED_GOOGLE_CLIENT_IDS.includes(extId),
      'Check 3: TRUSTED_GOOGLE_CLIENT_IDS array includes BOTH Web and Extension IDs',
      `Trusted: ${JSON.stringify(env.TRUSTED_GOOGLE_CLIENT_IDS)}`
    );

    // 2. Test Client Credentials Resolution for Extension and Dashboard
    const extCreds = resolveClientCredentials(
      undefined,
      'https://idjemajdjnoefigfbnnfmcpnnfgme.chromiumapp.org/'
    );
    assert(
      extCreds.clientId === extId && extCreds.isExtension === true,
      'Check 4: resolveClientCredentials routes chromiumapp redirectUri to Chrome Extension credentials',
      `Resolved: ${extCreds.clientId}`
    );

    const webCreds = resolveClientCredentials(undefined, 'http://localhost:3000/login');
    assert(
      webCreds.clientId === webId && webCreds.isExtension === false,
      'Check 5: resolveClientCredentials routes localhost redirectUri to Web Dashboard credentials',
      `Resolved: ${webCreds.clientId}`
    );

    const explicitExtCreds = resolveClientCredentials(extId);
    assert(
      explicitExtCreds.clientId === extId && explicitExtCreds.isExtension === true,
      'Check 6: resolveClientCredentials respects explicit Extension Client ID',
      `Resolved: ${explicitExtCreds.clientId}`
    );

    const explicitWebCreds = resolveClientCredentials(webId);
    assert(
      explicitWebCreds.clientId === webId && explicitWebCreds.isExtension === false,
      'Check 7: resolveClientCredentials respects explicit Web Dashboard Client ID',
      `Resolved: ${explicitWebCreds.clientId}`
    );

    // 3. Test rejection of invalid JWT format / forged JWT
    const dummyJwt = 'header.payload.signature';
    let rejectedAsExpected = false;
    let rejectedMessage = '';
    try {
      await verifyGoogleToken(dummyJwt);
    } catch (err: any) {
      rejectedAsExpected = true;
      rejectedMessage = err.message;
    }

    assert(
      rejectedAsExpected && rejectedMessage.includes('Google ID token verification failed'),
      'Check 8: Invalid/untrusted ID token (JWT) is rejected with clean ID-token error',
      `Message: ${rejectedMessage}`
    );

    assert(
      !rejectedMessage.includes('invalid_token'),
      'Check 9: verifyGoogleToken does NOT fall back to OAuth2 access token endpoint on ID token failure',
      `Message: ${rejectedMessage}`
    );

    // 4. Test rejection of empty / non-string token
    let emptyRejected = false;
    try {
      await verifyGoogleToken('');
    } catch {
      emptyRejected = true;
    }
    assert(emptyRejected, 'Check 10: Empty token is rejected immediately');

    // 5. Test User Provisioning: Super Admin Auto-Promotion
    const superAdminProfile = {
      googleId: 'google-sub-superadmin-test',
      email: 'mdjuyelrana.com.bd1@gmail.com',
      name: 'Super Admin Juyel',
      picture: 'https://example.com/avatar.jpg',
    };

    const provisionedSuperAdmin = await findOrCreateUser(superAdminProfile);
    assert(
      provisionedSuperAdmin.role === UserRole.SUPER_ADMIN,
      'Check 11: Configured email mdjuyelrana.com.bd1@gmail.com automatically receives SUPER_ADMIN role',
      `Role: ${provisionedSuperAdmin.role}`
    );

    // 6. Test User Provisioning: Regular User (Chrome Extension user)
    const regularUserProfile = {
      googleId: 'google-sub-regular-test-1234',
      email: 'chrome.extension.user@gmail.com',
      name: 'Regular Extension User',
      picture: null,
    };

    const provisionedUser = await findOrCreateUser(regularUserProfile);
    assert(
      provisionedUser.role === UserRole.USER,
      'Check 12: Non-superadmin Google user defaults to USER role',
      `Role: ${provisionedUser.role}`
    );

    // 7. Test App JWT Generation for Provisioned User
    const tokens = await generateAuthTokens(provisionedUser.id);
    assert(
      !!tokens.accessToken && !!tokens.refreshToken,
      'Check 13: Dual JWT (access & refresh tokens) successfully generated for user'
    );

    console.log('\n====================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal error during testing:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
