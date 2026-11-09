# Everkeep

Everkeep is a private studio for preserving life stories, personality traits, documents, and source material for a digital likeness. It includes guided interviews, a searchable Q&A library, a review queue, private uploads, per-record sharing, and portrait and recorded voice previews.

This repository is the Node.js edition for Hostinger. It uses MySQL for records and viewer permissions, OpenID Connect for verified sign-in, and a private S3-compatible bucket for files. The sample portrait depicts a fictional person.

## Deploy on Hostinger

1. Create a MySQL database and user in hPanel. Import [database/schema.sql](database/schema.sql) in phpMyAdmin. The schema can be imported again safely. On a machine with access to the database, setting the database environment variables and running `npm run db:setup` also initializes the tables.
2. Create a private S3-compatible bucket, such as Cloudflare R2. Disable public access and create credentials scoped to read, write, and delete files in this bucket. For R2 use its S3 endpoint and the region `auto`.
3. Register a web application with an OpenID Connect provider. Use the app's HTTPS address followed by `/auth/callback` as the exact authorized redirect URI. The provider must support Authorization Code with S256 PKCE, signed ID tokens, and the `email_verified` claim. Google uses the issuer `https://accounts.google.com`. Use the same hostname in `APP_ORIGIN` without a path. If testing on a temporary Hostinger hostname, register its callback too.
4. In hPanel, choose **Websites → Create site → Web App → Import Git Repository**, select **cboerstra/EverKeep**, then select **Node 24.x**. For manual settings use **Other**, build command `npm run build`, output directory `dist`, and entry file `server.js`. The server uses Hostinger's injected `PORT`. Hostinger offers this deployment flow on Business and Cloud plans.
5. Enter the values listed in [.env.example](.env.example) through hPanel's environment settings. Use `127.0.0.1` for Hostinger's local database. Generate `SESSION_SECRET` with the following command and copy the result directly to hPanel.

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

6. Test sign-in, answer and file saves, sharing, and revocation with two approved accounts. Once those checks pass, switch to the final domain and update the OIDC redirect URI and `APP_ORIGIN` to match.

See [Hostinger's deployment guide](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/) and [MySQL setup guide](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/).

## Access and sharing

`STUDIO_OWNER_EMAIL` admits one verified email by default. `STUDIO_ALLOWED_EMAILS` admits additional verified accounts. This is separate from sharing presets, which grant a listed address access to specific completed records. An admitted user gets their own archive. Drafts and records awaiting review stay with their owner. Revoke Site access by removing an email from the allowlist and applying the updated environment.

Private files are streamed through the same authenticated API that enforces those permissions. Back up the database and the bucket together. Keep environment credentials, database dumps, and user files out of the repository. Expired sessions can be pruned periodically with `DELETE FROM sessions WHERE expires <= UNIX_TIMESTAMP() * 1000`.

## Existing Site records

This deploy initializes a fresh archive. If the ChatGPT Site already holds records, export them and the corresponding private files through an authorized source before switching. New accounts receive new IDs. Map each old account to a verified account on the new deployment, then remap record owners, viewer grants, and object keys before importing. Check counts and permissions before cutover.

## Avatar provider

The optional provider is configured through `AVATAR_API_URL`, `AVATAR_API_TOKEN`, and `AVATAR_PREVIEW_ORIGIN`. The HTTPS endpoint receives a multipart POST with the selected portrait, optional voice recording, look, and voice. It returns JSON containing `previewUrl` on the configured HTTPS origin. Everkeep sends those files only when the owner saves consent and starts a live preview. The dashboard still works with the provider disconnected.

## Local build

Use Node 22.18 or later. Run `npm ci`, `npm test`, and `npm run build`. The build writes the runtime and web assets to `dist/`. With MySQL, bucket, and sign-in settings configured, run `npm start`. The HTTP server expects a front-end HTTPS proxy in production. The automated tests use fictional identities and verify session and access rules without reaching external accounts.
