# Ex.Seacrh — GitHub/Vercel Frontend

This folder is ready to upload directly to a GitHub repository and deploy with Vercel. It is also configured as a PWA so it can be installed on a phone home screen.

## Admin security

The production admin password is validated only in the Google Apps Script backend. It is intentionally **not stored in the GitHub frontend files**.

## 1) Upload this folder to GitHub

Create a new repository and upload the **contents of this folder** so `index.html` is at the repository root.

## 2) Deploy the backend once

Use the separate `ExSearch_Backend_Setup.zip` supplied with this project. Do **not** upload that backend ZIP/code to a public GitHub repository because it contains the one-time password setter.

In the Google Sheet:
1. Open **Extensions → Apps Script**.
2. Paste `Code.gs` from the backend package.
3. Run `setAdminPasswordOnce()` once and approve permissions. The supplied backend package already contains the password setter you requested.
4. Run `setupInitialData()` once if the Directory tab has not yet been seeded.
5. Deploy → **New deployment → Web app**.
6. Execute as **Me** and choose the access level you need.
7. Copy the deployment URL ending in `/exec`.

## 3) Connect the frontend

Edit `config.js` in GitHub and paste the `/exec` URL into `API_URL`, then commit.

Example:
```js
window.EXSEARCH_CONFIG = {
  API_URL: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
};
```

Once `API_URL` is present, add/edit/delete actions use the Google Sheet and the admin password is checked by the backend. Until the backend is connected, search works from the bundled preview data but Admin is disabled.

## 4) Deploy on Vercel

Import the GitHub repository in Vercel and deploy. No build command is required.

## 5) Put it on the phone home screen

- **Android / Chrome:** open the Vercel URL → menu → **Install app** / **Add to Home screen**. On supported browsers an **Install app** button also appears in the header.
- **iPhone / Safari:** open the Vercel URL → Share → **Add to Home Screen**.

The app includes `manifest.webmanifest`, service worker files, and 192/512 app icons.

## Sheet

Configured Google Sheet ID:
`1DTMmkO9V1lclbJazwDVqbvQOJm_v240k2lmtp27-Qjs`
