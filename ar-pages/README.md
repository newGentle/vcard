# NFC AR VisitCard — GitHub Pages demo

Static public demo, no backend, passwords or private contact data.

Files: `index.html` (digital card plus AR.js Hiro tracking) and `print.html` (marker to print).

Publish using **GitHub repository Settings → Pages → Deploy from a branch → main / root**, or upload into an already Pages-enabled repo.

Browser requirements: HTTPS, camera permission, access to A-Frame / AR.js CDNs, print the HIRO marker. GitHub Pages supports multiple project sites in different public repositories.

This demo deliberately does not connect to the private FastAPI instance or import its `.env`.
