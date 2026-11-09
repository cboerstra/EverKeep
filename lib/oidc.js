import * as oidc from "openid-client";

export function createIdentityProvider({ issuer, clientId, clientSecret, origin }) {
  let pending;
  const config = () => pending ??= oidc.discovery(new URL(issuer), clientId, clientSecret, undefined, {
    execute: [oidc.enableNonRepudiationChecks],
  }).catch(error => { pending = undefined; throw error; });

  return {
    issuer,
    async begin(flow) {
      return oidc.buildAuthorizationUrl(await config(), {
        redirect_uri: origin + "/auth/callback",
        scope: "openid email profile",
        code_challenge: await oidc.calculatePKCECodeChallenge(flow.verifier),
        code_challenge_method: "S256",
        state: flow.state,
        nonce: flow.nonce,
        response_mode: "query",
      });
    },
    async finish(url, flow) {
      const provider = await config();
      const tokens = await oidc.authorizationCodeGrant(provider, url, {
        pkceCodeVerifier: flow.verifier, expectedState: flow.state, expectedNonce: flow.nonce, idTokenExpected: true,
      });
      const claims = tokens.claims();
      if (claims && (!claims.email || claims.email_verified === undefined) && tokens.access_token) {
        const info = await oidc.fetchUserInfo(provider, tokens.access_token, claims.sub);
        return { ...claims, email: info.email, email_verified: info.email_verified, name: info.name || claims.name };
      }
      return claims;
    },
  };
}
