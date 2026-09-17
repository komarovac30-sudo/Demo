# V14 UX research notes — Trust, profile details, private gallery and sharing

Research date: 2026-09-18

This build uses structural patterns only. It does **not** copy real provider identities, phone numbers, profile copy, photos or reviews.

## PrivateDelights
Current public provider pages emphasize:
- verified-provider status
- visible review count and star rating
- joining/history context
- favorites/contact/screening actions
- separate Reviews, Bio, Listings and Notes areas
- reviews as a primary trust mechanism

Reference examples used during research:
- https://privatedelights.ch/profile/taylor143
- https://privatedelights.ch/profile/Zoesen

V14 adaptation: stronger verified-review summary, rating distribution, moderation/verification labels and trust-first review cards.

## MegaPersonals
Current/publicly indexed material supports a lightweight classified model where listings can be viewed without registration, with age/location/category/ad presentation. A historic public exhibit also shows age as a prominent listing attribute.

References:
- https://swww.megapersonals.eu/home
- DOJ public exhibit containing a historic MegaPersonals ad screenshot: https://www.justice.gov/usao-mdfl/press-release/file/1178406/dl

The web evidence reviewed did **not** reliably establish a detailed measurement schema for MegaPersonals, so V14 does not claim that source for measurements.

## EscortMonkey / Erotic Monkey-style directories
A current third-party review of Erotic Monkey describes structured physical-profile information including age, ethnicity, height, body type, hair, implants/breast details, plus photos, videos, price, contact information and reviews.

Reference:
- https://eastbayexpress.com/erotic-monkey-review/

V14 adaptation: optional creator-controlled profile details such as Age, Height, Body Type, Ethnicity, Hair, Eyes, Measurements, Cup Size, Languages and Tattoos/Piercings. These are presentation fields only and can be left blank.

## QR profile sharing
QuickChart documents a public QR endpoint that accepts URL-encoded text/URLs and can return PNG/SVG QR codes. V14 uses only the already-public profile URL in the QR request; no account credentials or private data are included.

Reference:
- https://quickchart.io/documentation/qr-codes/

## Product principles used in V14
- Public side: premium, editorial and photography-first.
- Reviews: trust surface rather than a generic comment feed.
- Private Gallery: visually premium and clearly gated.
- Mobile: Call / Text / Chat / Share always easy to reach.
- Creator Studio: public profile QR and copy-link tools.
- About data: optional; creators control what is publicly displayed.
