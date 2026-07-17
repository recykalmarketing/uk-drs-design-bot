RETEARN UK RENDER MODULE HOTFIX

Upload these three JavaScript files to the ROOT of your GitHub repository and replace server.js:
- server.js
- qualityScoring.js
- originalityCompliance.js

The server now imports the scoring modules from the repository root, avoiding missing nested src files during deployment.

Render settings:
Build Command: echo "Prebuilt app ready"
Start Command: node server.js

Then use Manual Deploy -> Clear build cache & deploy.
