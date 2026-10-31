# Orbit AI — free starter

A browser-based AI chat and agent workspace built with vanilla HTML, CSS, JavaScript, and Puter.js.

## Run locally
Puter.js needs an HTTP origin; do not open `index.html` as a `file://` URL.

```bash
python3 -m http.server 8000
```

Open http://localhost:8000.

## Deploy free with GitHub Pages
1. Create a **public** GitHub repository, e.g. `orbit-ai`.
2. Upload `index.html`, `style.css`, and `app.js` (and this README).
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose branch `main`, folder `/ (root)`, then Save.
6. Wait for GitHub Pages to publish the site.

GitHub Pages is free for public repositories on GitHub Free. Your app is static; it does not require a paid server.

## Puter.js
The app loads the official SDK from `https://js.puter.com/v2/`. It uses:
- `puter.ai.chat()` for chat and agent runs
- `puter.ai.listModels()` to populate the model selector
- `puter.auth.signIn()`, `isSignedIn()`, and `getUser()` for Puter sign-in

Puter uses a user-pays model. The app developer does not need to provide an API key, but AI usage is associated with each end user's Puter account and may consume their allowance or incur charges depending on their plan and the selected model. Do not promise unlimited free usage.

## Current scope
- Streaming AI chat, local chat history, model selector, and copy/regenerate controls
- Create/edit/delete custom instruction-based agents and run tasks
- LocalStorage persistence and dark/light theme
- Responsive layout

Agents currently execute a single model call guided by their saved instructions. They are not autonomous multi-step agents and do not execute external tools. Conversation history is stored in this browser only. Use cloud sync, multi-user shared storage, and tool execution as future enhancements.
