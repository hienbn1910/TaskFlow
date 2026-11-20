# ADR-0030: Signed direct uploads; private attachments; strict limits

- **Status:** Accepted
- **Date:** 2026-11-21

## Context
- Uploading through the API would push file bytes through a 512 MB / 0.1-CPU instance and through the Vercel proxy.
- Cloudinary URLs are public by default: an attachment posted in a **private** channel would be readable by anyone holding the link, which breaks tenant isolation.
- SVG and HTML files can carry scripts (stored XSS).

## Decision
1. **Signed direct upload**
   - The client asks the API for a signature: `POST /workspaces/:workspaceId/uploads/signature` (attachments, workspace logo) or `POST /users/me/avatar/signature`, with a `purpose`.
   - The API returns a Cloudinary signature that fixes `folder` (`taskflow/{env}/ws/{workspaceId}/attachments`, …), delivery `type`, allowed formats and maximum size.
   - The browser uploads straight to Cloudinary, then sends the returned `public_id`, `version` and `signature` to the API with the message (or profile update).
   - The API **verifies the Cloudinary response signature** (proves the upload used our parameters) and the folder prefix (proves the tenant) before saving.
2. **Delivery**
   - Avatars and workspace logos: `type: upload` (public).
   - Message attachments: `type: authenticated`. Reachable only through signed delivery URLs, which the API generates when it returns messages to authorized members.
   - **Accepted risk:** on the free plan signed URLs do not expire, so a URL copied out of the app stays valid. Expiring URLs need a paid feature.
3. **Limits:** images ≤ 5 MB (jpg, png, webp, gif); files ≤ 10 MB (pdf, txt, csv, zip, docx, xlsx, pptx); **SVG and HTML rejected**; ≤ 5 attachments per message; displayed file names sanitized.
4. Orphans (uploaded, never attached): accepted in v1. A cleanup job is a stretch item (needs Admin API calls).

## Consequences
- The upload endpoints in WORKFLOW.md §5 become signature endpoints.
- Cloudinary is mocked in tests; the signature verification is unit-tested with known vectors.
