# ReteaRn UK Design Bot – Fix v5

This package addresses the issues seen in the screenshot:

- Fresh run seed added on every Generate click so repeated runs produce fresh options
- New frontend shows caption and hashtags for each creative
- Logo is rendered without a white patch or gradient panel
- CTA is larger and hidden automatically when not useful
- Replaced the old React bundle with a lighter, clearer single-file UI
- Improved copy prompt to stop generic repeated text and placeholder metrics
- UI badges now show AI image status instead of misleading "Procedural visual"

Deploy by replacing `server.js`, `package.json` and `render.yaml` in Render/GitHub, then redeploy.
