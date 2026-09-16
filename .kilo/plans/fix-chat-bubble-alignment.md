# Fix Chat Bubble Alignment on Landing Page

## Problem Confirmed
In `src/components/landing/FeatureSections.tsx:139`, Ayah's bubble still has `side: "right"`. This is visually incorrect because:
- **right** = current user (kamu) per `src/app/chat/page.tsx:537`
- **left** = other people

## Fix
```diff
- { side: "right", name: "Ayah",   text: "Siap Bu, sudah dalam perjalanan 🕌",   delay: "0.6s" },
+ { side: "left",  name: "Ayah",   text: "Siap Bu, sudah dalam perjalanan 🕌",   delay: "0.6s" },
```

## Result
Ayah's bubble moves to the left, matching the real chat UI where only "Kamu" appears on the right.

## Notes
- Only one line change in `FeatureSections.tsx:139`
- No CSS changes needed
