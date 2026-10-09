# ShrinkPix – setup
1. `cp .env.example .env`, fill SITE_URL + SMTP, then `npm install && npm start` (Node 18+).
2. Deploy: VPS/Render/Railway; put Nginx or the host's proxy in front with HTTPS (Let's Encrypt). Run with `pm2 start server.js`. Set `client_max_body_size 100m;` in Nginx.
3. Articles: add `content/<slug>.md` (front matter: title, description, category, author, date). Blog index, categories, sitemap and Article schema update automatically.
4. Replace `hello@yourdomain.com` (views.js) with your real address.
## AdSense checklist
- [ ] Own domain on HTTPS, live 2+ weeks, original content only
- [ ] 10+ articles of 800+ words, all pages live (About, Contact, Privacy, Terms, Disclaimer)
- [ ] No broken links; test the contact form actually delivers mail
- [ ] Submit sitemap.xml in Google Search Console
- [ ] Apply at adsense.google.com, add the site, paste the verification snippet in views.js `<head>`
- [ ] Add ads.txt to /public after approval; load the AdSense script in app.js only after consent
- [ ] Replace the "Ad slot" placeholders with ad units; keep them away from the upload buttons
