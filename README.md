# 0xMan96 AI — Multi-Agent Workspace

A static HTML/CSS/JavaScript AI workspace for GitHub Pages, powered by Puter.js.

## Included agents
- Research Agent
- Crypto Market Agent
- DeFi & RWA Agent
- Blockchain Agent
- Coding Agent
- Document Agent
- Image Agent
- Automation Agent

## Integrations
- Puter.js AI chat and function calling
- Puter.js networking (`puter.net.fetch`) to reach public APIs without browser CORS restrictions
- DuckDuckGo HTML search for web research
- DEX Screener search API
- DefiLlama public protocol API
- Blockscout public explorer APIs (Ethereum, Base, Optimism, Arbitrum, Polygon)
- GitHub public repository API
- Puter.js text-to-image
- TXT, MD, CSV, JSON and PDF text extraction
- Browser-local recurring schedules

## Deploy to GitHub Pages
1. Upload `index.html`, `style.css`, `app.js`, and `README.md` directly to the repository root.
2. Open repository Settings → Pages.
3. Choose **Deploy from a branch**, select `main` and `/(root)`, then Save.
4. Open the published Pages URL and sign in to Puter when prompted.

## Local preview
Run `python3 -m http.server 8000` in this folder and open `http://localhost:8000`.

## Important limitations
- GitHub Pages remains a static host. No server-side secret storage is included.
- Puter AI uses Puter's user-pays model. Users may incur charges or need credits depending on account and model; it is not guaranteed unlimited free AI.
- Public APIs have rate limits and can change. DEX Screener, DefiLlama, Blockscout and GitHub responses are best-effort live data, not guaranteed uptime.
- Web search uses DuckDuckGo HTML results via Puter networking. Search results can change and must be checked at their source.
- GitHub integration reads public repository metadata/files only; it does not push commits or edit repositories.
- Document extraction is local to the current browser session. PDF extraction is limited to the first 40 pages and text extraction quality depends on the PDF.
- Image generation uses Puter AI and may consume the user's Puter allowance.
- Automations are browser-local. They run only while the 0xMan96 AI page is open; they are not background server jobs or reliable alarm notifications.
- Blockchain explorer lookup is search-only. It does not sign transactions, connect a wallet, or execute transfers.
- No smart contract audit, investment advice, or guaranteed security assessment is provided.

## Privacy
Chat history and agent configuration are stored in this browser's LocalStorage. Uploaded document text is held in page memory for the current session and is not automatically uploaded to a server by this app. Requests to AI providers and public APIs send the prompt or query required to perform the requested task.


## Creator Studio
The Creator Studio supports content planning and production workflows for:
- YouTube, TikTok, Instagram, Threads and Facebook
- AI-generated content packs: hooks, scripts, shot lists, captions, titles, platform-specific adaptations, hashtags and editing checklists
- AI image generation for thumbnails, covers and social visuals
- AI text-to-video generation and image/video input workflows where supported by the selected Puter provider
- AI-assisted source-video editing where the selected provider supports video input
- AI voiceover generation (text-to-speech)
- Audio transcription for turning recordings into draft captions or scripts

### Creator workflow limitations
- Video generation and AI video editing are model/provider dependent and may be chargeable. The test-sample option is for API testing and is not a finished creative deliverable.
- This is not a frame-accurate NLE timeline editor. For precise trimming, keyframes, multi-track editing, subtitles and final export control, use a dedicated editor such as CapCut, DaVinci Resolve or Kdenlive.
- Social media publishing is not connected. The app creates assets and copy; users review and publish manually.
- Generated platform advice can become outdated. Check current platform specifications, copyright, music licensing and disclosure rules before posting.
- Puter usage may incur charges depending on model/provider and account allowance.


## Reliability upgrade (roadmap branch)
- Corrected generated image preview rendering so image outputs use an image element rather than an audio element.
- Added bounded local chat history writes and graceful LocalStorage quota handling.
- Added IndexedDB persistence for extracted knowledge documents on the current browser/device.
- Added keyword-ranked document chunk retrieval for relevant local context on each AI request. This is a lightweight local retrieval layer, not embedding-based semantic search.
- Added creator planning tools for thumbnail briefs, carousel storyboards and a 7-day platform-aware content calendar.
- Added a local privacy note and explicit boundaries around browser-local schedules and manual publishing.

## Still requires infrastructure or provider verification
- True token streaming is not enabled because the current app's Puter chat integration has not been verified against a documented streaming response contract.
- Cross-device cloud sync requires an authenticated cloud database/storage design and user consent.
- Server-side durable schedules require a backend/cron provider.
- Publishing integrations require platform OAuth apps, permissions, review and provider-specific API implementation.
- A frame-accurate multitrack video editor requires a dedicated media pipeline/editor; this static frontend only offers provider-dependent AI video generation/edit requests.
- Semantic embedding search, user account tenancy, audit logs, rate limiting and server-side secret management require backend infrastructure.
- No production security certification or end-to-end runtime test is claimed by this patch.
