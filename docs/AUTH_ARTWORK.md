# Authentication illustrations

Generated with the built-in image generation tool, then resized to 640px WebP with alpha.

- Login asset: `flutter_frontend/assets/auth-login-art.webp` (75,868 bytes).
- Registration asset: `flutter_frontend/assets/auth-register-art.webp` (53,578 bytes).
- Both are bundled for offline use and precached by LoginScreen.
- The logo, title and form are rendered as real text/widgets, not baked into the images.

## Prompt set

Login: Production illustration asset only, transparent background, no text, logo, form, people or faces. Premium 3D blue-cyan-lavender still life: luminous open blue doorway, white conversation bubble with three blue dots, translucent message tile, a small key and a thin cyan orbit. Matte ceramic and subtle glass, soft contact shadow, all objects fully visible.

Registration: Production illustration asset only, transparent background, no text, logo, form, people or faces. Premium 3D blue-cyan-lavender new-account card on a low pedestal, abstract interlocking ring emblem, two blank lines, blue plus badge, three spheres on a delicate orbit and a small blue chat bubble. No door or key. Same material and lighting style as login.

## Motion

The title and illustration crossfade over 300ms with ease-out/ease-in cubic curves. Artwork translates slightly and scales from 0.97 to 1. Header dimensions accommodate both headlines and stay fixed between modes. Unique transition revisions support repeated rapid taps. Reduced-motion mode uses zero-duration transitions. Roboto is bundled identically on every platform; emoji use their own fallback.
