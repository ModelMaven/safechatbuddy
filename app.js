/**
 * -------------------------------------------------------------
 * DRIVESYNC CHAT - CLIENT LOGIC
 * A decentralized, serverless, live-syncing chat application
 * -------------------------------------------------------------
 */

// Application Constants & Sandbox defaults
const DEFAULT_CLIENT_ID = '829396024442-1g5km0cm2i935bqe7nsa5j811nck7fdu.apps.googleusercontent.com'; // Google OAuth Sandbox Client ID
const DEFAULT_POLL_INTERVAL = 2000; // 2 seconds
const ALLOWED_EMAILS = ['sameersingh04302000@gmail.com', 'samsingh1770@gmail.com']; // Add emails to restrict access, e.g. ['your-email@gmail.com']. Leave empty to allow any user.

// Global State
let state = {
  gapiInited: false,
  gisInited: false,
  tokenClient: null,
  accessToken: null,
  currentUser: null,
  rooms: [],
  activeRoom: null,
  messages: [],
  pollIntervalId: null,
  isSyncing: false,
  settings: {
    clientId: DEFAULT_CLIENT_ID,
    pollInterval: DEFAULT_POLL_INTERVAL
  }
};

// UI Elements
const els = {
  authScreen: document.getElementById('auth-screen'),
  chatScreen: document.getElementById('chat-screen'),
  btnLogin: document.getElementById('btn-login'),
  btnLogout: document.getElementById('btn-logout'),
  authLoadingText: document.getElementById('auth-loading-text'),
  oauthClientIdInput: document.getElementById('oauth-client-id'),
  btnSaveClient: document.getElementById('btn-save-client'),
  devClientConfig: document.getElementById('dev-client-config'),
  linkToggleDev: document.getElementById('link-toggle-dev'),
  
  // Sidebar
  sidebar: document.getElementById('app-sidebar'),
  btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
  btnPlaceholderSidebar: document.getElementById('btn-placeholder-sidebar'),
  btnMobileClose: document.getElementById('btn-mobile-close'),
  userName: document.getElementById('user-name'),
  userEmail: document.getElementById('user-email'),
  userAvatar: document.getElementById('user-avatar'),
  btnOpenCreateRoom: document.getElementById('btn-open-create-room'),
  btnRefreshRooms: document.getElementById('btn-refresh-rooms'),
  roomsListLoading: document.getElementById('rooms-list-loading'),
  roomsListEmpty: document.getElementById('rooms-list-empty'),
  roomsList: document.getElementById('rooms-list'),
  btnSettings: document.getElementById('btn-settings'),
  btnSidebarImportRoom: document.getElementById('btn-sidebar-import-room'),
  
  // Chat Panel
  chatPlaceholderState: document.getElementById('chat-placeholder-state'),
  chatActiveState: document.getElementById('chat-active-state'),
  chatRoomTitle: document.getElementById('chat-room-title'),
  mobileRoomTitle: document.getElementById('mobile-room-title'),
  chatRoomIdCode: document.getElementById('chat-room-id-code'),
  btnCopyRoomId: document.getElementById('btn-copy-room-id'),
  syncStatus: document.getElementById('sync-status'),
  mobileSyncBadge: document.getElementById('mobile-sync-badge'),
  syncStatusText: document.getElementById('sync-status-text'),
  btnJoinSharedRoom: document.getElementById('btn-join-shared-room'),
  btnDeleteRoom: document.getElementById('btn-delete-room'),
  chatMessagesContainer: document.getElementById('chat-messages-container'),
  chatInputForm: document.getElementById('chat-input-form'),
  chatMessageInput: document.getElementById('chat-message-input'),
  btnSendMessage: document.getElementById('btn-send-message'),
  
  // Modals
  modalCreateRoom: document.getElementById('modal-create-room'),
  formCreateRoom: document.getElementById('form-create-room'),
  newRoomNameInput: document.getElementById('new-room-name'),
  
  modalImportRoom: document.getElementById('modal-import-room'),
  formImportRoom: document.getElementById('form-import-room'),
  importFileIdInput: document.getElementById('import-file-id'),
  
  modalSettings: document.getElementById('modal-settings'),
  settingsClientId: document.getElementById('settings-client-id'),
  settingsPollInterval: document.getElementById('settings-poll-interval'),
  btnSaveSettings: document.getElementById('btn-save-settings'),
  btnClearCache: document.getElementById('btn-clear-cache'),
  
  // New Invite Elements
  modalInvite: document.getElementById('modal-invite'),
  formInvite: document.getElementById('form-invite'),
  inviteEmailInput: document.getElementById('invite-email'),
  btnOpenInvite: document.getElementById('btn-open-invite'),
  
  toastContainer: document.getElementById('toast-container')
};

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------

window.addEventListener('DOMContentLoaded', () => {
  loadLocalSettings();
  setupEventListeners();
  initGoogleAPIs();
});

// Load settings from localStorage
function loadLocalSettings() {
  const savedClientId = localStorage.getItem('drivesync_client_id');
  const savedPollInterval = localStorage.getItem('drivesync_poll_interval');
  
  if (savedClientId) {
    state.settings.clientId = savedClientId;
    els.oauthClientIdInput.value = savedClientId;
  } else {
    els.oauthClientIdInput.value = '';
    els.oauthClientIdInput.placeholder = `Default Sandbox: ${DEFAULT_CLIENT_ID.substring(0, 15)}...`;
  }
  
  if (savedPollInterval) {
    state.settings.pollInterval = parseInt(savedPollInterval, 10);
  }
  
  // Sync with settings modal fields
  els.settingsClientId.value = state.settings.clientId;
  els.settingsPollInterval.value = state.settings.pollInterval;
}

// Initialize GAPI and GIS
function initGoogleAPIs() {
  // Wait until GAPI and GIS script tags are loaded
  const checkInterval = setInterval(() => {
    if (typeof gapi !== 'undefined' && typeof google !== 'undefined') {
      clearInterval(checkInterval);
      initializeGapi();
      initializeGis();
    }
  }, 100);
}

// Initialize Google API Client (GAPI)
function initializeGapi() {
  gapi.load('client', async () => {
    try {
      await gapi.client.init({});
      // Load Drive v3 and OAuth2 v2 discovery documents
      await gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
      await gapi.client.load('https://www.googleapis.com/discovery/v1/apis/oauth2/v2/rest');
      
      state.gapiInited = true;
      checkAuthReady();
    } catch (err) {
      showToast('Failed to initialize Google GAPI Client', 'error');
      console.error(err);
    }
  });
}

// Initialize Google Identity Services (GIS)
function initializeGis() {
  try {
    state.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: state.settings.clientId,
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
      callback: async (response) => {
        if (response.error !== undefined) {
          showToast(`Authentication failed: ${response.error}`, 'error');
          els.authLoadingText.textContent = 'Auth failed. Please try again.';
          els.btnLogin.disabled = false;
          throw response;
        }
        
        state.accessToken = response.access_token;
        localStorage.setItem('drivesync_access_token', state.accessToken);
        
        // Success callback
        await handleSignInSuccess();
      }
    });
    
    state.gisInited = true;
    checkAuthReady();
  } catch (err) {
    showToast('Failed to initialize Google OAuth Client', 'error');
    console.error(err);
  }
}

// Enable Sign-In button once both libraries are ready
function checkAuthReady() {
  if (state.gapiInited && state.gisInited) {
    els.btnLogin.disabled = false;
    els.authLoadingText.textContent = 'Google API services initialized successfully.';
    
    // Check if we have an active session token in memory/storage
    const storedToken = localStorage.getItem('drivesync_access_token');
    if (storedToken) {
      state.accessToken = storedToken;
      gapi.client.setToken({ access_token: storedToken });
      
      // Attempt login implicitly
      els.authLoadingText.textContent = 'Restoring session...';
      handleSignInSuccess(true);
    }
  }
}

// -------------------------------------------------------------
// AUTHENTICATION FLOW
// -------------------------------------------------------------

// Sign In Trigger
function signIn() {
  if (!state.tokenClient) {
    showToast('OAuth client not initialized. Check your Client ID.', 'error');
    return;
  }
  
  // Requests access token using a popup consent flow
  state.tokenClient.requestAccessToken({ prompt: 'consent' });
}

// Sign Out Trigger
function signOut() {
  if (state.accessToken) {
    google.accounts.oauth2.revokeToken(state.accessToken, () => {
      // Clear credentials
      state.accessToken = null;
      state.currentUser = null;
      state.activeRoom = null;
      state.messages = [];
      state.rooms = [];
      
      localStorage.removeItem('drivesync_access_token');
      stopPolling();
      
      // Render clean UI
      renderRoomsList();
      showScreen('auth-screen');
      showToast('Logged out successfully');
    });
  } else {
    showScreen('auth-screen');
  }
}

// On Sign In success
async function handleSignInSuccess(isImplicit = false) {
  try {
    // 1. Configure the GAPI token client
    gapi.client.setToken({ access_token: state.accessToken });
    
    // 2. Fetch User Profile from Google OAuth2 API
    const userInfo = await gapi.client.oauth2.userinfo.get();
    state.currentUser = {
      id: userInfo.result.id,
      name: userInfo.result.name,
      avatar: userInfo.result.picture,
      email: userInfo.result.email
    };
    
    // 2.5. Check Whitelist
    if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(state.currentUser.email)) {
      showToast('Access Denied: Your email is not whitelisted.', 'error');
      signOut();
      return;
    }
    
    // 3. Update Profile UI
    els.userName.textContent = state.currentUser.name;
    els.userEmail.textContent = state.currentUser.email;
    els.userAvatar.src = state.currentUser.avatar;
    
    // 4. Load Chat Rooms from Google Drive
    showScreen('chat-screen');
    showToast(`Welcome, ${state.currentUser.name}!`);
    await loadRooms();
  } catch (err) {
    console.error('Sign-in success handler failed', err);
    if (isImplicit) {
      // Stored token was likely expired
      localStorage.removeItem('drivesync_access_token');
      signOut();
    } else {
      showToast('Could not fetch user profile from Google', 'error');
    }
  }
}

// Toggle layout screens
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// -------------------------------------------------------------
// GOOGLE DRIVE API INTERACTIONS
// -------------------------------------------------------------

// Get or create the DriveSync Chat folder in regular Drive
async function getOrCreateAppFolder() {
  let folderId = localStorage.getItem('drivesync_folder_id');
  if (folderId) {
    try {
      await gapi.client.drive.files.get({ fileId: folderId, fields: 'id, trashed' });
      return folderId;
    } catch (e) {
      localStorage.removeItem('drivesync_folder_id');
    }
  }
  
  // Search for the folder
  const response = await gapi.client.drive.files.list({
    q: "mimeType = 'application/vnd.google-apps.folder' and name = 'DriveSync Chat' and trashed = false",
    fields: 'files(id)'
  });
  
  const files = response.result.files || [];
  if (files.length > 0) {
    folderId = files[0].id;
  } else {
    // Create the folder
    const createResponse = await gapi.client.drive.files.create({
      resource: {
        name: 'DriveSync Chat',
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    });
    folderId = createResponse.result.id;
  }
  
  localStorage.setItem('drivesync_folder_id', folderId);
  return folderId;
}

// List Rooms from Drive
async function loadRooms() {
  els.roomsListLoading.classList.remove('hidden');
  els.roomsListEmpty.classList.add('hidden');
  els.roomsList.innerHTML = '';
  
  try {
    const folderId = await getOrCreateAppFolder();
    
    // Queries the folder for JSON files matching 'chat_room_' prefix
    const response = await gapi.client.drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/json' and name contains 'chat_room_' and trashed = false`,
      fields: 'files(id, name, modifiedTime, createdTime)',
      orderBy: 'modifiedTime desc'
    });
    
    const files = response.result.files || [];
    state.rooms = [];
    
    // Fetch room metadata contents to get human readable names
    // To do this concurrently and fast, load up to 10 rooms
    const roomFetches = files.map(async (file) => {
      try {
        const roomData = await fetchRoomData(file.id);
        return {
          fileId: file.id,
          roomId: roomData.room_id,
          name: roomData.room_name || 'Unnamed Room',
          modifiedTime: file.modifiedTime,
          createdTime: file.createdTime
        };
      } catch (err) {
        console.warn(`Could not read room content for file ${file.id}`, err);
        return null;
      }
    });
    
    const results = await Promise.all(roomFetches);
    state.rooms = results.filter(r => r !== null);
    
    // Load any shared rooms saved in localStorage
    loadImportedRooms();
    
    renderRoomsList();
  } catch (err) {
    showToast('Failed to load rooms list from Google Drive', 'error');
    console.error(err);
  } finally {
    els.roomsListLoading.classList.add('hidden');
  }
}

// Fetch Room JSON File Media Content
async function fetchRoomData(fileId) {
  const response = await gapi.client.drive.files.get({
    fileId: fileId,
    alt: 'media'
  });
  
  // GAPI client media download content is returned in response.body, or sometimes response.result
  let data = response.result || response.body;
  
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse room data JSON:', data, e);
    }
  }
  return data;
}

// Write / Update Room Content
async function updateRoomData(fileId, data) {
  // We use the upload endpoint path for updating file media content via PATCH
  await gapi.client.request({
    path: `/upload/drive/v3/files/${fileId}`,
    method: 'PATCH',
    params: { uploadType: 'media' },
    body: JSON.stringify(data)
  });
}

// Create Room File in Google Drive AppData
async function createRoom(roomName) {
  const roomId = uuidv4();
  const initialContent = {
    room_id: roomId,
    room_name: roomName,
    created_at: new Date().toISOString(),
    last_updated_timestamp: new Date().toISOString(),
    messages: []
  };
  
  try {
    const folderId = await getOrCreateAppFolder();
    // Step 1: Create metadata entry in GDrive
    const metaResponse = await gapi.client.drive.files.create({
      resource: {
        name: `chat_room_${roomId}.json`,
        parents: [folderId],
        mimeType: 'application/json'
      },
      fields: 'id'
    });
    
    const fileId = metaResponse.result.id;
    
    // Step 2: Upload media contents
    await updateRoomData(fileId, initialContent);
    
    showToast(`Room "${roomName}" created successfully!`);
    await loadRooms();
    
    // Select newly created room
    const newRoom = state.rooms.find(r => r.fileId === fileId);
    if (newRoom) selectRoom(newRoom);
  } catch (err) {
    showToast('Failed to create room file on Google Drive', 'error');
    console.error(err);
  }
}

// Delete Room File
async function deleteRoom(room) {
  if (!confirm(`Are you sure you want to delete "${room.name}"? This will permanently erase the room log from Google Drive.`)) {
    return;
  }
  
  try {
    stopPolling();
    
    // Delete GDrive file
    await gapi.client.drive.files.delete({
      fileId: room.fileId
    });
    
    showToast(`Deleted room "${room.name}"`);
    
    // Remove from local imported rooms if present
    removeImportedRoom(room.fileId);
    
    state.activeRoom = null;
    els.chatActiveState.classList.add('hidden');
    els.chatPlaceholderState.classList.remove('remove');
    
    await loadRooms();
  } catch (err) {
    showToast('Failed to delete room from Google Drive', 'error');
    console.error(err);
  }
}

// Import a Shared Room via File ID
async function importRoom(fileId) {
  try {
    // 1. Fetch room metadata to verify it exists and is readable
    const fileResponse = await gapi.client.drive.files.get({
      fileId: fileId,
      fields: 'id, name, modifiedTime, createdTime'
    });
    
    // 2. Fetch room content to check compatibility
    const roomData = await fetchRoomData(fileId);
    if (!roomData.room_id || !roomData.messages) {
      throw new Error('File is not a valid DriveSync Chat log');
    }
    
    // 3. Save to imported list in localStorage
    saveImportedRoom(fileId, roomData.room_name);
    
    showToast(`Imported shared room: ${roomData.room_name}`);
    await loadRooms();
    
    // Select the imported room
    const imported = state.rooms.find(r => r.fileId === fileId);
    if (imported) selectRoom(imported);
  } catch (err) {
    showToast('Could not import room. Make sure the file exists and you have shared permissions.', 'error');
    console.error(err);
  }
}

// Share Room File / Invite a Friend
async function inviteMember(email) {
  if (!state.activeRoom) {
    showToast('No active room selected', 'error');
    return;
  }
  
  updateSyncStatus('syncing');
  try {
    await gapi.client.drive.permissions.create({
      fileId: state.activeRoom.fileId,
      resource: {
        role: 'writer',
        type: 'user',
        emailAddress: email
      },
      sendNotificationEmail: true
    });
    
    showToast(`Successfully shared room and invited ${email}!`);
  } catch (err) {
    console.error('Failed to share room file', err);
    showToast('Failed to invite member. Make sure the email is valid.', 'error');
  } finally {
    updateSyncStatus('idle');
  }
}

// -------------------------------------------------------------
// LOCAL STORAGE IMPORTED ROOMS HELPER
// -------------------------------------------------------------
function saveImportedRoom(fileId, name) {
  const imports = JSON.parse(localStorage.getItem('drivesync_imported_rooms') || '[]');
  if (!imports.some(i => i.fileId === fileId)) {
    imports.push({ fileId, name, importedAt: new Date().toISOString() });
    localStorage.setItem('drivesync_imported_rooms', JSON.stringify(imports));
  }
}

function removeImportedRoom(fileId) {
  const imports = JSON.parse(localStorage.getItem('drivesync_imported_rooms') || '[]');
  const filtered = imports.filter(i => i.fileId !== fileId);
  localStorage.setItem('drivesync_imported_rooms', JSON.stringify(filtered));
}

function loadImportedRooms() {
  const imports = JSON.parse(localStorage.getItem('drivesync_imported_rooms') || '[]');
  imports.forEach(imp => {
    // Avoid duplicates
    if (!state.rooms.some(r => r.fileId === imp.fileId)) {
      state.rooms.push({
        fileId: imp.fileId,
        roomId: null, // Loaded dynamically on select
        name: `${imp.name} (Imported)`,
        modifiedTime: new Date().toISOString(),
        createdTime: new Date().toISOString(),
        isImported: true
      });
    }
  });
}

// -------------------------------------------------------------
// SELECTION & SYNC ENGINE
// -------------------------------------------------------------

// Active Room Selection
async function selectRoom(room) {
  stopPolling();
  state.activeRoom = room;
  state.messages = [];
  
  // Set UI Active room visual elements
  document.querySelectorAll('.room-item').forEach(el => {
    el.classList.remove('active');
    if (el.dataset.fileId === room.fileId) el.classList.add('active');
  });
  
  els.chatPlaceholderState.classList.add('hidden');
  els.chatActiveState.classList.remove('hidden');
  
  els.chatRoomTitle.textContent = room.name;
  if (els.mobileRoomTitle) {
    els.mobileRoomTitle.textContent = room.name;
  }
  els.chatRoomIdCode.textContent = room.fileId;
  
  // Hide delete button if it's imported (since we don't own it)
  if (room.isImported) {
    els.btnDeleteRoom.classList.add('hidden');
  } else {
    els.btnDeleteRoom.classList.remove('hidden');
  }
  
  // Show spinner inside chat message box while loading
  els.chatMessagesContainer.innerHTML = `
    <div class="rooms-status-state">
      <i class="fa-solid fa-spinner fa-spin"></i>
      <p>Downloading message history...</p>
    </div>
  `;
  
  // Close mobile sidebar menu
  els.sidebar.classList.remove('mobile-open');
  
  try {
    updateSyncStatus('syncing');
    const roomData = await fetchRoomData(room.fileId);
    
    // Save metadata
    state.messages = roomData.messages.map(m => ({ ...m, status: 'sent' }));
    
    // Sync current modified time
    const metaResponse = await gapi.client.drive.files.get({
      fileId: room.fileId,
      fields: 'modifiedTime'
    });
    state.activeRoom.modifiedTime = metaResponse.result.modifiedTime;
    
    renderMessages();
    updateSyncStatus('idle');
    
    // Start live-polling synchronization loop
    startPolling();
  } catch (err) {
    showToast('Failed to load room messages', 'error');
    console.error(err);
    els.chatMessagesContainer.innerHTML = `
      <div class="rooms-status-state">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <p>Error loading room messages. Please check permissions.</p>
      </div>
    `;
  }
}

// Start polling for active room updates
function startPolling() {
  if (state.pollIntervalId) clearInterval(state.pollIntervalId);
  
  state.pollIntervalId = setInterval(async () => {
    if (!state.activeRoom || state.isSyncing) return;
    
    state.isSyncing = true;
    updateSyncStatus('syncing');
    
    try {
      // 1. Fetch metadata modifiedTime
      const response = await gapi.client.drive.files.get({
        fileId: state.activeRoom.fileId,
        fields: 'modifiedTime'
      });
      
      const remoteModifiedTime = response.result.modifiedTime;
      
      // 2. If remote time is newer, trigger content sync
      if (remoteModifiedTime !== state.activeRoom.modifiedTime) {
        const roomData = await fetchRoomData(state.activeRoom.fileId);
        state.activeRoom.modifiedTime = remoteModifiedTime;
        
        // 3. Merge message streams
        mergeMessages(roomData.messages);
        renderMessages();
      }
      
      updateSyncStatus('idle');
    } catch (err) {
      console.warn('Delta sync polling error', err);
      updateSyncStatus('offline');
    } finally {
      state.isSyncing = false;
    }
  }, state.settings.pollInterval);
}

// Stop polling
function stopPolling() {
  if (state.pollIntervalId) {
    clearInterval(state.pollIntervalId);
    state.pollIntervalId = null;
  }
  updateSyncStatus('idle');
}

// Update Sync Badges
function updateSyncStatus(status) {
  const badges = [els.syncStatus, els.mobileSyncBadge];
  
  badges.forEach(badge => {
    if (!badge) return;
    badge.className = `sync-badge ${status}`;
  });
  
  if (els.syncStatusText) {
    if (status === 'syncing') els.syncStatusText.textContent = 'Syncing...';
    else if (status === 'offline') els.syncStatusText.textContent = 'Offline';
    else els.syncStatusText.textContent = 'Synced';
  }
}

// -------------------------------------------------------------
// CONFLICT RESOLUTION (MERGE LOGIC)
// -------------------------------------------------------------
function mergeMessages(remoteMessages) {
  const map = new Map();
  
  // 1. Feed remote messages as source of truth
  remoteMessages.forEach(m => {
    map.set(m.msg_id, { ...m, status: 'sent' });
  });
  
  // 2. Overlay local cached state (preserving sending or error states)
  state.messages.forEach(m => {
    if (!map.has(m.msg_id)) {
      map.set(m.msg_id, m);
    } else if (m.status === 'error') {
      map.set(m.msg_id, m);
    }
  });
  
  // 3. Sort chronologically
  state.messages = Array.from(map.values()).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// -------------------------------------------------------------
// UI RENDERING HELPERS
// -------------------------------------------------------------

// Render rooms side nav
function renderRoomsList() {
  els.roomsList.innerHTML = '';
  
  if (state.rooms.length === 0) {
    els.roomsListEmpty.classList.remove('hidden');
    return;
  }
  
  els.roomsListEmpty.classList.add('hidden');
  
  state.rooms.forEach(room => {
    const li = document.createElement('li');
    li.className = `room-item ${state.activeRoom && state.activeRoom.fileId === room.fileId ? 'active' : ''}`;
    li.dataset.fileId = room.fileId;
    
    // Get simple display timestamp
    const date = new Date(room.modifiedTime);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    li.innerHTML = `
      <div class="room-info">
        <i class="fa-regular ${room.isImported ? 'fa-folder-open' : 'fa-comment-dots'} room-icon"></i>
        <span class="room-name-text">${escapeHtml(room.name)}</span>
      </div>
      <span class="room-timestamp">${timeStr}</span>
    `;
    
    li.addEventListener('click', () => selectRoom(room));
    els.roomsList.appendChild(li);
  });
}

// Render Messages Container
function renderMessages() {
  const container = els.chatMessagesContainer;
  const isAtBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 50;
  
  container.innerHTML = '';
  
  if (state.messages.length === 0) {
    container.innerHTML = `
      <div class="rooms-status-state">
        <i class="fa-regular fa-message"></i>
        <p>No messages yet. Send a message below to start the conversation!</p>
      </div>
    `;
    return;
  }
  
  state.messages.forEach(msg => {
    const div = document.createElement('div');
    const isSelf = msg.sender_id === state.currentUser.id;
    div.className = `message-item ${isSelf ? 'self' : ''}`;
    
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formattedContent = parseMessageContent(msg.content);
    
    // Status text for self-messages
    let statusMarkup = '';
    if (isSelf) {
      if (msg.status === 'sending') {
        statusMarkup = `<span class="msg-status sending"><i class="fa-solid fa-spinner fa-spin"></i> sending</span>`;
      } else if (msg.status === 'error') {
        statusMarkup = `<span class="msg-status error"><i class="fa-solid fa-triangle-exclamation"></i> failed</span>`;
      }
    }
    
    div.innerHTML = `
      <img src="${msg.sender_avatar || 'https://lh3.googleusercontent.com/a/default-user=s88-c'}" alt="${escapeHtml(msg.sender_name)}" class="msg-avatar">
      <div class="msg-content-wrapper">
        <div class="msg-info">
          <span class="msg-sender">${escapeHtml(msg.sender_name)}</span>
          <span class="msg-time">${time}</span>
        </div>
        <div class="msg-bubble">
          ${formattedContent}
        </div>
        ${statusMarkup}
      </div>
    `;
    
    container.appendChild(div);
  });
  
  // Auto-scroll to bottom if user was already at the bottom or if it is our message
  if (isAtBottom || state.messages[state.messages.length - 1]?.sender_id === state.currentUser?.id) {
    container.scrollTop = container.scrollHeight;
  }
}

// Parse plaintext urls and markdown links
function parseMessageContent(text) {
  // Step 1: Escape HTML to avoid XSS injection
  let escaped = escapeHtml(text);
  
  // Step 2: Match markdown links [Title](http://...)
  escaped = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, title, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a>`;
  });
  
  // Step 3: Match raw HTTP/HTTPS URLs (that are not already wrapped in <a href="..."))
  const rawUrlRegex = /(?<!href=")(https?:\/\/[^\s<]+)/g;
  escaped = escaped.replace(rawUrlRegex, (match) => {
    return `<a href="${match}" target="_blank" rel="noopener noreferrer">${match}</a>`;
  });
  
  return escaped;
}

// HTML escape helper
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// -------------------------------------------------------------
// CHAT MESSAGE SUBMISSION
// -------------------------------------------------------------
async function sendMessage(event) {
  event.preventDefault();
  
  const content = els.chatMessageInput.value.trim();
  if (!content || !state.activeRoom) return;
  
  els.chatMessageInput.value = '';
  
  // 1. Generate local optimistic message
  const localMsgId = uuidv4();
  const newMsg = {
    msg_id: localMsgId,
    sender_id: state.currentUser.id,
    sender_name: state.currentUser.name,
    sender_avatar: state.currentUser.avatar,
    timestamp: new Date().toISOString(),
    type: 'text',
    content: content,
    status: 'sending'
  };
  
  // Push to local buffer
  state.messages.push(newMsg);
  renderMessages();
  
  // 2. Dispatch network PATCH request
  try {
    updateSyncStatus('syncing');
    
    // Fetch latest room contents to prevent race condition overrides
    const remoteData = await fetchRoomData(state.activeRoom.fileId);
    
    // Merge remote list with local list
    mergeMessages(remoteData.messages);
    
    // Update state.messages array item for this message to sent (client-side status)
    const targetMsg = state.messages.find(m => m.msg_id === localMsgId);
    if (targetMsg) targetMsg.status = 'sent';
    
    // Map list to clean storage format (removing local state helpers like 'status')
    const sanitizedMessages = state.messages.map(m => {
      const { status, ...clean } = m;
      return clean;
    });
    
    const updatedContent = {
      room_id: remoteData.room_id,
      room_name: remoteData.room_name,
      created_at: remoteData.created_at,
      last_updated_timestamp: new Date().toISOString(),
      messages: sanitizedMessages
    };
    
    // Write back to Drive
    await updateRoomData(state.activeRoom.fileId, updatedContent);
    
    // Update local modified time immediately to avoid redundant delta poll fetches
    const response = await gapi.client.drive.files.get({
      fileId: state.activeRoom.fileId,
      fields: 'modifiedTime'
    });
    state.activeRoom.modifiedTime = response.result.modifiedTime;
    
    renderMessages();
    updateSyncStatus('idle');
  } catch (err) {
    console.error('Failed to send message', err);
    // Mark as failed
    const targetMsg = state.messages.find(m => m.msg_id === localMsgId);
    if (targetMsg) targetMsg.status = 'error';
    renderMessages();
    showToast('Failed to deliver message', 'error');
    updateSyncStatus('offline');
  }
}

// -------------------------------------------------------------
// EVENT LISTENERS & MODALS
// -------------------------------------------------------------

function setupEventListeners() {
  // Auth Screen Buttons
  els.btnLogin.addEventListener('click', signIn);
  els.btnLogout.addEventListener('click', signOut);
  
  // Developer configuration toggle
  if (els.linkToggleDev) {
    els.linkToggleDev.addEventListener('click', (e) => {
      e.preventDefault();
      els.devClientConfig.classList.toggle('hidden');
    });
  }
  
  els.btnSaveClient.addEventListener('click', () => {
    const raw = els.oauthClientIdInput.value.trim();
    if (raw) {
      localStorage.setItem('drivesync_client_id', raw);
      state.settings.clientId = raw;
      showToast('OAuth Client ID saved. Reloading page...');
      setTimeout(() => window.location.reload(), 1000);
    } else {
      localStorage.removeItem('drivesync_client_id');
      state.settings.clientId = DEFAULT_CLIENT_ID;
      showToast('Client ID reset to default sandbox. Reloading...');
      setTimeout(() => window.location.reload(), 1000);
    }
  });

  // Modal open triggers
  els.btnOpenCreateRoom.addEventListener('click', () => els.modalCreateRoom.showModal());
  els.btnJoinSharedRoom.addEventListener('click', () => els.modalImportRoom.showModal());
  if (els.btnSidebarImportRoom) {
    els.btnSidebarImportRoom.addEventListener('click', () => els.modalImportRoom.showModal());
  }
  if (els.btnOpenInvite) {
    els.btnOpenInvite.addEventListener('click', () => els.modalInvite.showModal());
  }
  els.btnSettings.addEventListener('click', () => {
    els.settingsClientId.value = state.settings.clientId;
    els.settingsPollInterval.value = state.settings.pollInterval;
    els.modalSettings.showModal();
  });
  
  // Close modals buttons
  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Find parent dialog element and close it
      e.target.closest('dialog').close();
    });
  });
  
  // Create Room Form Submit
  els.formCreateRoom.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = els.newRoomNameInput.value.trim();
    if (name) {
      els.modalCreateRoom.close();
      els.newRoomNameInput.value = '';
      await createRoom(name);
    }
  });
  
  // Invite Member Form Submit
  if (els.formInvite) {
    els.formInvite.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = els.inviteEmailInput.value.trim();
      if (email) {
        els.modalInvite.close();
        els.inviteEmailInput.value = '';
        await inviteMember(email);
      }
    });
  }
  
  // Import Room Form Submit
  els.formImportRoom.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileId = els.importFileIdInput.value.trim();
    if (fileId) {
      els.modalImportRoom.close();
      els.importFileIdInput.value = '';
      await importRoom(fileId);
    }
  });
  
  // Settings Form Save
  els.btnSaveSettings.addEventListener('click', () => {
    const cid = els.settingsClientId.value.trim();
    const interval = parseInt(els.settingsPollInterval.value, 10);
    
    if (cid && interval >= 1000) {
      const cidChanged = cid !== state.settings.clientId;
      state.settings.clientId = cid;
      state.settings.pollInterval = interval;
      
      localStorage.setItem('drivesync_client_id', cid);
      localStorage.setItem('drivesync_poll_interval', interval.toString());
      
      els.modalSettings.close();
      showToast('Settings saved successfully');
      
      if (cidChanged) {
        showToast('Client ID changed. Signing out...');
        setTimeout(() => signOut(), 1500);
      } else {
        // Restart polling loop with new interval if active
        if (state.activeRoom) startPolling();
      }
    } else {
      showToast('Please verify Client ID and polling settings.', 'error');
    }
  });
  
  // Clear cache settings button
  els.btnClearCache.addEventListener('click', () => {
    if (confirm('This will wipe your locally stored oauth tokens, saved imported rooms references, and reset configuration. Do you wish to proceed?')) {
      localStorage.clear();
      showToast('Local storage cleared. Reloading page...');
      setTimeout(() => window.location.reload(), 1000);
    }
  });
  
  // Refresh rooms list manually
  els.btnRefreshRooms.addEventListener('click', async () => {
    showToast('Refreshing rooms...');
    await loadRooms();
  });
  
  // Room specific buttons
  els.btnDeleteRoom.addEventListener('click', () => {
    if (state.activeRoom) deleteRoom(state.activeRoom);
  });
  
  els.btnCopyRoomId.addEventListener('click', () => {
    if (state.activeRoom) {
      navigator.clipboard.writeText(state.activeRoom.fileId);
      showToast('Room File ID copied to clipboard');
    }
  });
  
  // Submit chat message
  els.chatInputForm.addEventListener('submit', sendMessage);
  
  // Sidebar UI drawer controls
  if (els.btnToggleSidebar) {
    els.btnToggleSidebar.addEventListener('click', () => els.sidebar.classList.add('mobile-open'));
  }
  if (els.btnPlaceholderSidebar) {
    els.btnPlaceholderSidebar.addEventListener('click', () => els.sidebar.classList.add('mobile-open'));
  }
  els.btnMobileClose.addEventListener('click', () => els.sidebar.classList.remove('mobile-open'));
}

// -------------------------------------------------------------
// TOAST NOTIFICATIONS
// -------------------------------------------------------------
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation';
  
  toast.innerHTML = `
    <i class="${icon}"></i>
    <span>${message}</span>
  `;
  
  els.toastContainer.appendChild(toast);
  
  // Fade out and remove after 3.5 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3500);
}

// -------------------------------------------------------------
// HELPER FUNCTIONS (UUID & FALLBACKS)
// -------------------------------------------------------------
function uuidv4() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Cryptographically secure fallback
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}
