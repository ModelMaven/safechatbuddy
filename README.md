# DriveSync Chat ☁️💬

A decentralized, serverless, live-syncing Web Chat Application that requires **zero backend infrastructure costs**. 

The entire application runs purely on the client side (deployable as a static Single Page Application or PWA) and uses the user's personal Google Drive (via the Google Drive API and Google Identity Services OAuth2) as the single source of truth for the database layer.

---

## 🚀 Key Features

- **Private & Secure**: Messages are stored in a dedicated `DriveSync Chat` folder on your Google Drive. Only accessible to you and individuals you explicitly invite.
- **In-App Sharing / Invites**: Invite friends using their Google email directly from the chat interface. The app automatically configures read/write permissions on Google Drive behind the scenes!
- **Zero Backend Cost**: Complete serverless database hosting utilizing Google Drive API storage quotas.
- **High-Performance Delta Polling**: Utilizes a lightweight HTTP metadata check (`modifiedTime`) to monitor room changes every 2 seconds without hitting Google API rate limits.
- **Optimistic UI Updates**: Incoming and outgoing messages render instantly in the sender's UI before network operations complete.
- **Conflict Resolution**: Implements a Last-Write-Wins (LWW) structural merge algorithm that combines message arrays on concurrent writes to prevent loss of messages.
- **Link Formatting**: Plain URLs and standard Markdown-style links (`[title](url)`) are parsed and rendered securely.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla JavaScript (ES6+), CSS3 (Glassmorphic dark-theme, responsive flex/grid layout).
- **Icons**: FontAwesome v6.
- **APIs**: Google API Client Library (`gapi`), Google Identity Services OAuth2 (`gis`).
- **CI/CD**: GitHub Actions workflow.

---

## 📂 File Structure

```
├── index.html               # Main application HTML structure
├── style.css                # Custom glassmorphic dark-theme styling
├── app.js                   # Client side controller & GDrive sync engine
├── server.js                # Zero-dependency local Node.js server
└── README.md                # Project documentation
```

---

## ⚙️ Setup & Deployment

### 1. Configure Google Cloud Console Credentials
To use this application, you need to set up a project in the Google Cloud Console:

1. Create a project at [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Google Drive API** under **APIs & Services > Library**.
3. Go to **APIs & Services > OAuth consent screen**:
   - Choose **External** user type.
   - Set scopes to:
     - `https://www.googleapis.com/auth/drive`
     - `openid`
     - `https://www.googleapis.com/auth/userinfo.profile`
     - `https://www.googleapis.com/auth/userinfo.email`
   - Add your Google email under **Test Users**.
4. Go to **APIs & Services > Credentials**:
   - Create an **OAuth client ID** of type **Web application**.
   - Under **Authorized JavaScript origins**, add:
     - `http://localhost:8080` (for local dev)
     - `https://<your-github-username>.github.io` (for GitHub Pages)
   - Copy the generated **Client ID**.

### 2. Deploy to GitHub Pages
1. Create a new public repository on GitHub named `drivesync-chat`.
2. Drag and drop all project files (`index.html`, `style.css`, `app.js`, `.github/` folder) into the repository, or commit them using your terminal.
3. In the repository **Settings > Pages**:
   - Set build source to **Deploy from a branch**.
   - Select the `main` branch and `/ (root)` directory, then click **Save**.
4. Once deployed, launch the URL, open the App Settings (gear icon), paste your Google OAuth Client ID, and sign in!

### 3. Local Development
To run a local web server (to handle OAuth redirection/origins):
```bash
# Using Node.js
node server.js

# Using Python
python -m http.server 8080
```
Open `http://localhost:8080` in your web browser.
