'use strict';

const crypto = require('node:crypto');

const ROLE_ALIASES = new Map([
  ['platform admin', 'platform_admin'],
  ['platform_admin', 'platform_admin'],
  ['risk admin', 'risk_admin'],
  ['risk_admin', 'risk_admin'],
  ['compliance reviewer', 'compliance_reviewer'],
  ['compliance_reviewer', 'compliance_reviewer'],
  ['legal privacy reviewer', 'legal_privacy_reviewer'],
  ['legal_privacy_reviewer', 'legal_privacy_reviewer'],
  ['security reviewer', 'security_reviewer'],
  ['security_reviewer', 'security_reviewer'],
  ['finance project reviewer', 'finance_project_reviewer'],
  ['finance_project_reviewer', 'finance_project_reviewer'],
  ['hse bcm reviewer', 'hse_bcm_reviewer'],
  ['hse_bcm_reviewer', 'hse_bcm_reviewer'],
  ['business approver', 'business_approver'],
  ['business_approver', 'business_approver'],
  ['auditor', 'auditor'],
  ['read only', 'read_only'],
  ['read_only', 'read_only'],
  ['demo user', 'demo_user'],
  ['demo_user', 'demo_user']
]);

const ROUTE_POLICIES = {
  'agent:run': ['platform_admin', 'risk_admin', 'compliance_reviewer', 'legal_privacy_reviewer', 'security_reviewer', 'finance_project_reviewer', 'hse_bcm_reviewer'],
  'admin:features:update': ['platform_admin', 'risk_admin'],
  'readiness:read': ['platform_admin', 'risk_admin', 'auditor'],
  'benchmarks:read': ['platform_admin', 'risk_admin', 'auditor'],
  'audit:read': ['platform_admin', 'auditor'],
  'health:read': ['platform_admin', 'risk_admin', 'auditor', 'compliance_reviewer', 'demo_user', 'read_only'],
  'demo:read': ['platform_admin', 'risk_admin', 'auditor', 'compliance_reviewer', 'demo_user', 'read_only']
};

let jwksCache = {
  url: '',
  expiresAt: 0,
  keys: []
};

function authMode() {
  const configured = String(process.env.P42_AUTH_MODE || process.env.AUTH_MODE || 'audit').toLowerCase();
  return ['disabled', 'audit', 'enforced'].includes(configured) ? configured : 'audit';
}

function normalizeRole(value = '') {
  const key = String(value || '')
    .replace(/^appRole:/i, '')
    .replace(/^role:/i, '')
    .trim()
    .replace(/[-:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  return ROLE_ALIASES.get(key) || key.replace(/\s+/g, '_');
}

function uniqueRoles(values = []) {
  return Array.from(new Set(values.map(normalizeRole).filter(Boolean)));
}

function getHeader(req, name) {
  const lower = name.toLowerCase();
  return req?.headers?.[lower] || req?.headers?.[name] || '';
}

function base64UrlDecode(value = '') {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64');
}

function parseJwt(token = '') {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('JWT must contain header, payload, and signature.');
  return {
    header: JSON.parse(base64UrlDecode(parts[0]).toString('utf8')),
    payload: JSON.parse(base64UrlDecode(parts[1]).toString('utf8')),
    signingInput: `${parts[0]}.${parts[1]}`,
    signature: base64UrlDecode(parts[2])
  };
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyHs256(jwt, secret) {
  const expected = crypto.createHmac('sha256', secret).update(jwt.signingInput).digest();
  return safeEqual(jwt.signature, expected);
}

async function fetchJwks(url) {
  const now = Date.now();
  if (jwksCache.url === url && jwksCache.expiresAt > now && jwksCache.keys.length) {
    return jwksCache.keys;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`JWKS fetch failed: ${response.status}`);
  const body = await response.json();
  jwksCache = {
    url,
    expiresAt: now + 10 * 60 * 1000,
    keys: Array.isArray(body.keys) ? body.keys : []
  };
  return jwksCache.keys;
}

async function verifyRs256(jwt) {
  const jwksUrl = process.env.P42_ENTRA_JWKS_URL || process.env.ENTRA_JWKS_URL || process.env.OIDC_JWKS_URL;
  if (!jwksUrl) throw new Error('RS256 token received but no JWKS URL is configured.');
  const keys = await fetchJwks(jwksUrl);
  const jwk = keys.find((key) => key.kid === jwt.header.kid && key.kty === 'RSA');
  if (!jwk) throw new Error('JWT signing key was not found in JWKS.');
  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(jwt.signingInput);
  verifier.end();
  return verifier.verify(publicKey, jwt.signature);
}

function validateClaims(payload = {}) {
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error('JWT is expired.');
  if (payload.nbf && payload.nbf > now + 60) throw new Error('JWT is not active yet.');

  const expectedAudience = process.env.P42_AUTH_AUDIENCE || process.env.ENTRA_CLIENT_ID || process.env.AZURE_CLIENT_ID;
  if (expectedAudience) {
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(expectedAudience)) throw new Error('JWT audience is not accepted.');
  }

  const expectedIssuer = process.env.P42_AUTH_ISSUER || process.env.ENTRA_ISSUER;
  if (expectedIssuer && payload.iss !== expectedIssuer) throw new Error('JWT issuer is not accepted.');

  const expectedTenant = process.env.P42_ENTRA_TENANT_ID || process.env.ENTRA_TENANT_ID || process.env.AZURE_TENANT_ID;
  if (expectedTenant && payload.tid !== expectedTenant) throw new Error('JWT tenant is not accepted.');
}

async function verifyJwt(token = '') {
  const jwt = parseJwt(token);
  if (jwt.header.alg === 'HS256') {
    const secret = process.env.P42_JWT_HS256_SECRET;
    if (!secret) throw new Error('HS256 token received but P42_JWT_HS256_SECRET is not configured.');
    if (!verifyHs256(jwt, secret)) throw new Error('JWT signature verification failed.');
  } else if (jwt.header.alg === 'RS256') {
    if (!(await verifyRs256(jwt))) throw new Error('JWT signature verification failed.');
  } else {
    throw new Error(`Unsupported JWT algorithm: ${jwt.header.alg || 'unknown'}.`);
  }
  validateClaims(jwt.payload);
  return jwt.payload;
}

function rolesFromClaims(payload = {}) {
  return uniqueRoles([
    ...(Array.isArray(payload.roles) ? payload.roles : []),
    ...(Array.isArray(payload.groups) ? payload.groups : []),
    ...(typeof payload.role === 'string' ? [payload.role] : []),
    ...(typeof payload.scp === 'string' ? payload.scp.split(/\s+/) : [])
  ]);
}

async function authenticateRequest(req) {
  const mode = authMode();
  const authorization = String(getHeader(req, 'authorization') || '');
  const demoToken = process.env.P42_DEMO_BEARER_TOKEN;

  if (demoToken && authorization === `Bearer ${demoToken}`) {
    return {
      authenticated: true,
      authMode: mode,
      authSource: 'demo_bearer',
      id: process.env.P42_DEMO_ACTOR_ID || 'demo-operator',
      username: process.env.P42_DEMO_ACTOR || 'demo-operator',
      roles: uniqueRoles(String(process.env.P42_DEMO_ROLES || 'compliance_reviewer,auditor').split(','))
    };
  }

  if (authorization.toLowerCase().startsWith('bearer ')) {
    const payload = await verifyJwt(authorization.slice(7).trim());
    return {
      authenticated: true,
      authMode: mode,
      authSource: 'jwt',
      id: payload.oid || payload.sub || payload.email || 'token-subject',
      username: payload.preferred_username || payload.upn || payload.email || payload.name || payload.sub || 'token-subject',
      roles: rolesFromClaims(payload)
    };
  }

  if (mode === 'enforced') {
    return {
      authenticated: false,
      authMode: mode,
      authSource: 'none',
      error: 'missing_bearer_token',
      id: 'anonymous',
      username: 'anonymous',
      roles: []
    };
  }

  return {
    authenticated: false,
    authMode: mode,
    authSource: 'none',
    id: 'anonymous',
    username: 'browser_operator',
    roles: ['demo_user']
  };
}

async function authorizeAdminMutation(req) {
  const mode = authMode();
  const policyId = 'admin:features:update';
  const policyRoles = ROUTE_POLICIES[policyId] || [];
  if (mode === 'enforced') {
    return authorizeRequest(req, policyId);
  }
  try {
    const actor = await authenticateRequest(req);
    if (!actor.authenticated) {
      return {
        ok: false,
        statusCode: 401,
        actor,
        body: {
          error: 'admin_authorization_required',
          detail: 'Admin bearer token is required to change settings.',
          policy: policyId,
          requiredRoles: policyRoles
        }
      };
    }
    const allowed = actor.roles.some((role) => policyRoles.includes(role));
    if (!allowed) {
      return {
        ok: false,
        statusCode: 403,
        actor,
        body: {
          error: 'insufficient_role',
          detail: 'Admin settings require platform_admin or risk_admin role.',
          policy: policyId,
          requiredRoles: policyRoles
        }
      };
    }
    return { ok: true, actor, policy: { id: policyId, requiredRoles: policyRoles, mode } };
  } catch (error) {
    const actor = {
      authenticated: false,
      authMode: mode,
      authSource: 'invalid',
      id: 'invalid-token',
      username: 'invalid-token',
      roles: []
    };
    return {
      ok: false,
      statusCode: 401,
      actor,
      body: {
        error: 'invalid_token',
        detail: error instanceof Error ? error.message : 'Token validation failed.',
        policy: policyId
      }
    };
  }
}

async function authorizeRequest(req, policyId) {
  const mode = authMode();
  const policyRoles = ROUTE_POLICIES[policyId] || [];
  try {
    const actor = await authenticateRequest(req);
    const allowed = mode !== 'enforced'
      || policyRoles.length === 0
      || actor.roles.some((role) => policyRoles.includes(role));

    if (!actor.authenticated && mode === 'enforced') {
      return {
        ok: false,
        statusCode: 401,
        actor,
        body: {
          error: 'authentication_required',
          detail: 'Bearer JWT or configured demo bearer token is required for this route.',
          policy: policyId
        }
      };
    }

    if (!allowed) {
      return {
        ok: false,
        statusCode: 403,
        actor,
        body: {
          error: 'insufficient_role',
          detail: 'Authenticated actor does not have a role permitted for this route.',
          policy: policyId,
          requiredRoles: policyRoles
        }
      };
    }

    return { ok: true, actor, policy: { id: policyId, requiredRoles: policyRoles, mode } };
  } catch (error) {
    const actor = {
      authenticated: false,
      authMode: mode,
      id: 'invalid-token',
      username: 'invalid-token',
      roles: []
    };
    return {
      ok: false,
      statusCode: 401,
      actor,
      body: {
        error: 'invalid_token',
        detail: error instanceof Error ? error.message : 'Token validation failed.',
        policy: policyId
      }
    };
  }
}

function authHealth() {
  const mode = authMode();
  return {
    mode,
    enforced: mode === 'enforced',
    jwt: {
      hs256Configured: Boolean(process.env.P42_JWT_HS256_SECRET),
      jwksConfigured: Boolean(process.env.P42_ENTRA_JWKS_URL || process.env.ENTRA_JWKS_URL || process.env.OIDC_JWKS_URL),
      audienceConfigured: Boolean(process.env.P42_AUTH_AUDIENCE || process.env.ENTRA_CLIENT_ID || process.env.AZURE_CLIENT_ID),
      issuerConfigured: Boolean(process.env.P42_AUTH_ISSUER || process.env.ENTRA_ISSUER),
      tenantConfigured: Boolean(process.env.P42_ENTRA_TENANT_ID || process.env.ENTRA_TENANT_ID || process.env.AZURE_TENANT_ID)
    },
    policies: ROUTE_POLICIES
  };
}

module.exports = {
  ROUTE_POLICIES,
  authHealth,
  authMode,
  authenticateRequest,
  authorizeAdminMutation,
  authorizeRequest,
  normalizeRole,
  parseJwt,
  rolesFromClaims,
  uniqueRoles,
  verifyJwt
};
