# Veloura V15 QA Checklist

## Typography
- [ ] Cormorant Garamond renders on profile name and large editorial headings.
- [ ] Manrope renders on body, forms, buttons, navigation and dashboards.
- [ ] Fonts do not cause major layout shift on mobile.
- [ ] Fallback fonts remain readable if font loading fails.

## Theme
- [ ] Public profile uses near-black + plum + muted rose + champagne palette.
- [ ] Rating stars use champagne/gold accent.
- [ ] Private Gallery retains strong contrast and readable CTA.
- [ ] Buttons remain readable in normal, hover and disabled states.
- [ ] Reviews and profile details remain readable at mobile widths.
- [ ] Admin/ES Studio remain cleaner and less decorative than the public profile.

## Mobile Quick Actions
- [ ] Sticky bar contains exactly Text, Chat and Share where a phone number exists.
- [ ] Call is not displayed in the mobile sticky bar.
- [ ] Text opens the native SMS composer.
- [ ] Chat opens Private & Secure Chat.
- [ ] Share opens the share/profile QR flow.
- [ ] Action bar does not cover important content or browser safe area.

## Regression
- [ ] Desktop Direct Call remains available in the profile hero if configured.
- [ ] Private Gallery unlock flow still works.
- [ ] Guest chat and ES chat still work.
- [ ] Reviews and rating filters still work.
- [ ] QR/profile sharing still works.
- [ ] No database migration is expected for this release.
