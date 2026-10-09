AA DIGITAL IDENTITY - WebAR V11
Target GitHub repo: newGentle/vcard
Target folder: ar-pages/ (upload the CONTENTS of the ar-pages folder, not another nested ar-pages)
Branch: main; GitHub Pages published from main /root.

PAGES TO TEST AFTER DEPLOY:
https://newgentle.github.io/vcard/ar-pages/
https://newgentle.github.io/vcard/ar-pages/design-preview.html?v=11
https://newgentle.github.io/vcard/ar-pages/ar.html?v=11
https://newgentle.github.io/vcard/ar-pages/print.html
https://newgentle.github.io/vcard/ar-pages/ar-hiro.html

TRACKING RULE: printable aa-marker.png MUST MATCH pattern-aa-v11.patt; AR.js patternRatio=0.7.
Do not substitute the pure brand image for the fiducial marker. The brand image and pattern core are related but the final print includes a black band and white quiet zone.
QR: https://newgentle.github.io/vcard/ar-pages/ar.html (permanent, NO /aa-v9/ or version query).
PHOTO: https://newgentle.github.io/photo.webp (the actual file used on the portfolio).
FALLBACK: ar-hiro.html uses original HIRO recognition, independent of experimental AA tracking.
GitHub Pages is static; no Python API/Docker/credentials are required.
Only upload public files. Contact phone/email are included with your approval.

For QR scan on one smartphone: first scan QR -> open WebAR, then aim its rear camera at the printed AA fiducial.

NOT LIVE until you upload: GitHub integration does not have write permission (403).
