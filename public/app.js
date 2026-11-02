const state = {
  connected: false,
  mode: "bot",
  session: { connected: false },
  chats: [],
  messages: [],
  people: []
};

const BASE_PATH = "";

const elements = {
  setupModal: document.querySelector("#setupModal"),
  openSetupButtons: [
    "#openSetupButton",
    "#openSetupButtonSmall",
    "#openSetupButtonInline",
    "#openSetupButtonTop",
    "#openSetupButtonEmpty",
    "#openSetupButtonComposer"
  ]
    .map((selector) => document.querySelector(selector))
    .filter(Boolean),
  closeSetupButton: document.querySelector("#closeSetupButton"),
  cancelSetupButton: document.querySelector("#cancelSetupButton"),
  connectForm: document.querySelector("#connectForm"),
  webhookMode: document.querySelector("#webhookMode"),
  botMode: document.querySelector("#botMode"),
  webhookFields: document.querySelector(".webhook-field"),
  botFields: document.querySelector(".bot-fields"),
  webhookUrl: document.querySelector("#webhookUrl"),
  token: document.querySelector("#token"),
  channelId: document.querySelector("#channelId"),
  chatBrowser: document.querySelector("#chatBrowser"),
  chatList: document.querySelector("#chatList"),
  chatSearch: document.querySelector("#chatSearch"),
  chatCount: document.querySelector("#chatCount"),
  reloadChatsButton: document.querySelector("#reloadChatsButton"),
  stepConnect: document.querySelector("#stepConnect"),
  stepTarget: document.querySelector("#stepTarget"),
  stepSend: document.querySelector("#stepSend"),
  stepConnectText: document.querySelector("#stepConnectText"),
  stepTargetText: document.querySelector("#stepTargetText"),
  stepSendText: document.querySelector("#stepSendText"),
  dmPanel: document.querySelector("#dmPanel"),
  scanPeopleButton: document.querySelector("#scanPeopleButton"),
  peopleList: document.querySelector("#peopleList"),
  dmForm: document.querySelector("#dmForm"),
  dmUserId: document.querySelector("#dmUserId"),
  openDmButton: document.querySelector("#openDmButton"),
  profileCard: document.querySelector("#profileCard"),
  profileAvatar: document.querySelector("#profileAvatar"),
  profileName: document.querySelector("#profileName"),
  profileHandle: document.querySelector("#profileHandle"),
  profileId: document.querySelector("#profileId"),
  profileType: document.querySelector("#profileType"),
  profileEmpty: document.querySelector("#profileEmpty"),
  connectButton: document.querySelector("#connectButton"),
  disconnectButton: document.querySelector("#disconnectButton"),
  refreshButton: document.querySelector("#refreshButton"),
  refreshButtonTop: document.querySelector("#refreshButtonTop"),
  connectionLabel: document.querySelector("#connectionLabel"),
  accountStatus: document.querySelector("#accountStatus"),
  memberSessionName: document.querySelector("#memberSessionName"),
  memberSessionStatus: document.querySelector("#memberSessionStatus"),
  chatKicker: document.querySelector("#chatKicker"),
  chatTitle: document.querySelector("#chatTitle"),
  chatSubtitle: document.querySelector("#chatSubtitle"),
  targetIcon: document.querySelector("#targetIcon"),
  statusDot: document.querySelector("#statusDot"),
  modePill: document.querySelector("#modePill"),
  notice: document.querySelector("#notice"),
  emptyState: document.querySelector("#emptyState"),
  emptyStateText: document.querySelector("#emptyStateText"),
  messages: document.querySelector("#messages"),
  messageForm: document.querySelector("#messageForm"),
  messageInput: document.querySelector("#messageInput"),
  sendButton: document.querySelector("#sendButton"),
  composerHint: document.querySelector("#composerHint"),
  charCount: document.querySelector("#charCount")
};

function setNotice(message, type = "") {
  elements.notice.textContent = message;
  elements.notice.className = `notice ${type}`.trim();
}

function setSetupOpen(isOpen) {
  elements.setupModal.classList.toggle("hidden", !isOpen);
  document.body.classList.toggle("modal-open", isOpen);
  if (isOpen) {
    window.setTimeout(() => {
      const input = state.mode === "bot" ? elements.token : elements.webhookUrl;
      input?.focus();
    }, 0);
  }
}

async function api(path, options = {}) {
  const url = path.startsWith("/api") ? `${BASE_PATH}${path}` : path;
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const body = await response.json();
  if (!response.ok || body.ok === false) {
    const error = new Error(body.error || "Request failed.");
    error.details = body.details;
    throw error;
  }
  return body;
}

function setMode(mode) {
  state.mode = mode;
  const webhook = mode === "webhook";
  elements.webhookMode.classList.toggle("active", webhook);
  elements.botMode.classList.toggle("active", !webhook);
  elements.webhookFields.classList.toggle("hidden", !webhook);
  elements.botFields.classList.toggle("hidden", webhook);
  elements.webhookUrl.required = webhook;
  elements.webhookUrl.disabled = !webhook;
  elements.token.required = !webhook;
  elements.token.disabled = webhook;
}

function setLoading(isLoading, label = "Start session") {
  elements.connectButton.disabled = isLoading;
  elements.connectButton.textContent = isLoading ? "Connecting..." : label;
}

function setStep(element, status) {
  element.classList.toggle("complete", status === "complete");
  element.classList.toggle("current", status === "current");
}

function updateOnboarding(session, canSend) {
  const connected = Boolean(session.connected);
  setStep(elements.stepConnect, connected ? "complete" : "current");
  setStep(elements.stepTarget, connected && !canSend ? "current" : connected ? "complete" : "");
  setStep(elements.stepSend, canSend ? "complete" : connected ? "current" : "");

  elements.stepConnectText.textContent = connected ? session.label : "Choose a relay method";
  elements.stepTargetText.textContent = canSend
    ? session.chatLabel || "Target selected"
    : connected
      ? "Channel or personal DM"
      : "Channel or personal DM";
  elements.stepSendText.textContent = canSend ? "Composer ready" : "Composer unlocks here";
}

function targetGlyph(session) {
  if (!session.connected) return "#";
  if (session.activeType === "dm") return "@";
  if (session.activeType === "webhook") return "W";
  if (session.activeType === "channel") return "#";
  return "B";
}

function updateConnection(session) {
  state.connected = Boolean(session.connected);
  state.session = session;
  const canSend = Boolean(session.connected && session.canSend !== false);
  const isBot = session.connected && session.mode === "bot";

  elements.connectionLabel.textContent = session.connected ? session.label : "Not connected";
  elements.accountStatus.textContent = session.connected
    ? canSend
      ? "online"
      : "select a target"
    : "offline";
  elements.memberSessionName.textContent = session.connected ? session.label : "Not connected";
  elements.memberSessionStatus.textContent = session.connected
    ? canSend
      ? session.chatLabel || "Ready"
      : "Pick a channel or DM"
    : "Start a secure session.";
  elements.chatKicker.textContent = session.connected ? "Active target" : "Target";
  elements.chatTitle.textContent = session.connected ? session.chatLabel || session.label : "relay-console";
  elements.chatSubtitle.textContent = session.connected
    ? canSend
      ? `Sending as ${session.label}`
      : "Session connected. Select a channel or personal DM."
    : "Connect a bot or webhook to start.";
  elements.targetIcon.textContent = targetGlyph(session);
  elements.modePill.textContent = session.connected ? session.activeType || session.mode : "Offline";
  elements.modePill.classList.toggle("online", session.connected);
  elements.statusDot.classList.toggle("online", session.connected);
  elements.disconnectButton.disabled = !session.connected;
  if (!elements.connectButton.disabled) {
    elements.connectButton.textContent = session.connected ? "Update session" : "Start session";
  }
  elements.messageInput.disabled = !canSend;
  elements.sendButton.disabled = !canSend;
  elements.messageInput.placeholder = canSend
    ? `Message ${session.chatLabel || "selected target"}`
    : "Message #relay-console";
  elements.composerHint.textContent = canSend
    ? `Sending as ${session.label}`
    : session.connected
      ? "Pick a channel or open a DM"
      : "No target selected";
  elements.emptyStateText.textContent = session.connected
    ? canSend
      ? "No messages loaded yet."
      : "Pick a channel from the chat list or open a personal DM."
    : "Connect a bot token or webhook, then pick a channel or DM.";
  elements.dmPanel.classList.toggle("hidden", !isBot);
  elements.chatBrowser.classList.toggle("hidden", !isBot);
  updateOnboarding(session, canSend);
  renderProfile(session.dmUser);
  renderChatList();
  updateEmptyState();
}

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function renderProfile(user) {
  elements.profileCard.classList.toggle("hidden", !user);
  elements.profileEmpty.classList.toggle("hidden", Boolean(user));
  if (!user) {
    elements.profileAvatar.replaceChildren();
    elements.profileName.textContent = "";
    elements.profileHandle.textContent = "";
    elements.profileId.textContent = "";
    elements.profileType.textContent = "";
    return;
  }

  elements.profileAvatar.replaceChildren();
  if (user.avatar) {
    const image = document.createElement("img");
    image.src = user.avatar;
    image.alt = "";
    elements.profileAvatar.append(image);
  } else {
    elements.profileAvatar.textContent = initials(user.globalName || user.username);
  }

  if (user.accentColor) {
    elements.profileCard.style.setProperty("--profile-accent", `#${user.accentColor.toString(16).padStart(6, "0")}`);
  } else {
    elements.profileCard.style.removeProperty("--profile-accent");
  }

  elements.profileName.textContent = user.globalName || user.username;
  elements.profileHandle.textContent = `@${user.username}`;
  elements.profileId.textContent = user.id;
  elements.profileType.textContent = user.bot ? "Bot" : "User";
}

function collectPeople(messages) {
  const people = new Map();
  for (const message of messages) {
    const author = message.author || {};
    if (!author.id || author.bot || people.has(author.id)) continue;
    people.set(author.id, {
      id: author.id,
      name: author.globalName || author.name || author.username || author.id,
      username: author.username || author.name || author.id,
      avatar: author.avatar || ""
    });
  }
  return [...people.values()].slice(0, 18);
}

function renderPeopleList() {
  const fragment = document.createDocumentFragment();
  for (const person of state.people) {
    const button = document.createElement("button");
    button.className = "person-row";
    button.type = "button";
    button.title = `Open DM with ${person.name}`;

    const avatar = document.createElement("span");
    avatar.className = "person-avatar";
    if (person.avatar) {
      const image = document.createElement("img");
      image.src = person.avatar;
      image.alt = "";
      avatar.append(image);
    } else {
      avatar.textContent = initials(person.name);
    }

    const label = document.createElement("strong");
    label.textContent = person.name;
    button.append(avatar, label);
    button.addEventListener("click", () => openDm(person.id));
    fragment.append(button);
  }

  if (!fragment.childNodes.length) {
    const empty = document.createElement("div");
    empty.className = "people-empty";
    empty.textContent = "Open a readable channel or press @ to scan recent users.";
    fragment.append(empty);
  }

  elements.peopleList.replaceChildren(fragment);
}

function mergePeople(people) {
  const merged = new Map(state.people.map((person) => [person.id, person]));
  for (const person of people || []) {
    if (person.id && !merged.has(person.id)) merged.set(person.id, person);
  }
  state.people = [...merged.values()].slice(0, 30);
  renderPeopleList();
}

function renderMessages() {
  mergePeople(collectPeople(state.messages));
  elements.messages.replaceChildren(
    ...state.messages.map((message) => {
      const item = document.createElement("li");
      item.className = "message";

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      if (message.author.avatar) {
        const image = document.createElement("img");
        image.src = message.author.avatar;
        image.alt = "";
        avatar.append(image);
      } else {
        avatar.textContent = initials(message.author.name);
      }

      const main = document.createElement("div");
      main.className = "message-main";

      const meta = document.createElement("div");
      meta.className = "message-meta";

      const author = document.createElement("span");
      author.className = "message-author";
      author.textContent = message.author.name;
      meta.append(author);

      if (state.session.mode === "bot" && message.author.id && !message.author.bot) {
        const dmButton = document.createElement("button");
        dmButton.className = "inline-dm-button";
        dmButton.type = "button";
        dmButton.textContent = "DM";
        dmButton.title = `Open DM with ${message.author.name}`;
        dmButton.addEventListener("click", () => openDm(message.author.id));
        meta.append(dmButton);
      }

      if (message.author.bot) {
        const badge = document.createElement("span");
        badge.className = "bot-badge";
        badge.textContent = "BOT";
        meta.append(badge);
      }

      const timestamp = document.createElement("time");
      timestamp.className = "timestamp";
      timestamp.dateTime = message.timestamp;
      timestamp.textContent = formatTime(message.timestamp);
      meta.append(timestamp);

      const content = document.createElement("div");
      content.className = "message-content";
      content.textContent = message.content || "[empty message]";

      main.append(meta, content);
      item.append(avatar, main);
      return item;
    })
  );

  elements.messages.scrollTop = elements.messages.scrollHeight;
  updateEmptyState();
}

function updateEmptyState() {
  elements.emptyState.classList.toggle("hidden", state.messages.length > 0);
}

function updateCharCount() {
  elements.charCount.textContent = `${elements.messageInput.value.length}/2000`;
}

function visibleChats() {
  const query = elements.chatSearch.value.trim().toLowerCase();
  if (!query) return state.chats;

  return state.chats
    .map((guild) => ({
      ...guild,
      channels: guild.channels.filter(
        (channel) =>
          channel.name.toLowerCase().includes(query) ||
          guild.guild.name.toLowerCase().includes(query)
      )
    }))
    .filter((guild) => guild.channels.length > 0);
}

function renderChatList() {
  const total = state.chats.reduce((sum, guild) => sum + guild.channels.length, 0);
  elements.chatCount.textContent =
    total === 0 ? "No channels loaded" : `${total} channel${total === 1 ? "" : "s"} available`;

  const fragment = document.createDocumentFragment();
  for (const guildEntry of visibleChats()) {
    const group = document.createElement("section");
    group.className = "chat-group";

    const header = document.createElement("div");
    header.className = "chat-group-header";

    const icon = document.createElement("div");
    icon.className = "guild-icon";
    if (guildEntry.guild.icon) {
      const image = document.createElement("img");
      image.src = guildEntry.guild.icon;
      image.alt = "";
      icon.append(image);
    } else {
      icon.textContent = initials(guildEntry.guild.name);
    }

    const name = document.createElement("strong");
    name.textContent = guildEntry.guild.name;
    header.append(icon, name);
    group.append(header);

    for (const channel of guildEntry.channels) {
      const button = document.createElement("button");
      button.className = "chat-row";
      button.type = "button";
      button.dataset.channelId = channel.id;
      button.classList.toggle("active", state.session.activeChannelId === channel.id);
      button.innerHTML = `<span aria-hidden="true">#</span><strong></strong>`;
      button.querySelector("strong").textContent = channel.name;
      button.addEventListener("click", () => openChannel(channel.id));
      group.append(button);
    }

    fragment.append(group);
  }

  if (!fragment.childNodes.length) {
    const empty = document.createElement("div");
    empty.className = "chat-list-empty";
    empty.textContent = state.chats.length ? "No matches" : "Connect a bot token to load channels";
    fragment.append(empty);
  }

  elements.chatList.replaceChildren(fragment);
}

async function loadChats(reload = false) {
  if (state.session.mode !== "bot") return;
  elements.reloadChatsButton.disabled = true;
  elements.reloadChatsButton.textContent = "...";
  try {
    const body = await api(`/api/chats${reload ? "?reload=1" : ""}`);
    state.chats = body.chats || [];
    renderChatList();
    if (reload) setNotice("Chats refreshed.", "success");
  } catch (error) {
    setNotice(error.message, "error");
  } finally {
    elements.reloadChatsButton.disabled = false;
    elements.reloadChatsButton.textContent = "R";
  }
}

function firstChannelId() {
  for (const guild of state.chats) {
    const channel = guild.channels?.[0];
    if (channel?.id) return channel.id;
  }
  return "";
}

async function openFirstChannelIfNeeded() {
  if (state.session.mode !== "bot" || state.session.canSend) return;
  const channelId = firstChannelId();
  if (channelId) await openChannel(channelId);
}

async function openChannel(channelId) {
  setNotice("Opening channel...");
  try {
    const body = await api("/api/channel", {
      method: "POST",
      body: JSON.stringify({ channelId })
    });
    updateConnection(body.session);
    state.messages = body.messages || [];
    renderMessages();
    setNotice("Channel opened.", "success");
    elements.messageInput.focus();
  } catch (error) {
    setNotice(error.message, "error");
  }
}

async function openDm(userId) {
  elements.dmUserId.value = userId;
  await submitDm(userId);
}

async function submitDm(userId) {
  if (!userId) return;

  elements.openDmButton.disabled = true;
  elements.openDmButton.textContent = "Opening...";

  try {
    const body = await api("/api/dm", {
      method: "POST",
      body: JSON.stringify({ userId })
    });
    updateConnection(body.session);
    state.messages = body.messages || [];
    renderMessages();
    setNotice("DM opened.", "success");
    elements.messageInput.focus();
  } catch (error) {
    setNotice(error.message, "error");
  } finally {
    elements.openDmButton.disabled = !state.connected;
    elements.openDmButton.textContent = "Open DM";
  }
}

async function loadPeople(quiet = false) {
  if (state.session.mode !== "bot") return;
  elements.scanPeopleButton.disabled = true;
  elements.scanPeopleButton.textContent = "...";
  try {
    const body = await api("/api/people");
    mergePeople(body.people || []);
    if (!quiet) {
      setNotice(
        body.people?.length
          ? `Found ${body.people.length} recent user${body.people.length === 1 ? "" : "s"}.`
          : "No recent users found in readable channels.",
        body.people?.length ? "success" : ""
      );
    }
  } catch (error) {
    setNotice(error.message, "error");
  } finally {
    elements.scanPeopleButton.disabled = false;
    elements.scanPeopleButton.textContent = "@";
  }
}

async function refreshMessages(quiet = false) {
  if (!state.connected) return;

  try {
    const body = await api("/api/messages");
    state.messages = body.messages || [];
    renderMessages();
    if (!quiet) setNotice("Messages refreshed.", "success");
  } catch (error) {
    setNotice(error.message, "error");
  }
}

elements.openSetupButtons.forEach((button) => {
  button.addEventListener("click", () => setSetupOpen(true));
});
elements.closeSetupButton.addEventListener("click", () => setSetupOpen(false));
elements.cancelSetupButton.addEventListener("click", () => setSetupOpen(false));
elements.setupModal.addEventListener("click", (event) => {
  if (event.target?.hasAttribute("data-close-setup")) setSetupOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setSetupOpen(false);
});

elements.webhookMode.addEventListener("click", () => setMode("webhook"));
elements.botMode.addEventListener("click", () => setMode("bot"));

elements.connectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoading(true);

  const payload =
    state.mode === "bot"
      ? {
          mode: "bot",
          token: elements.token.value,
          channelId: elements.channelId.value
        }
      : {
          mode: "webhook",
          webhookUrl: elements.webhookUrl.value
        };

  try {
    const body = await api("/api/connect", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    updateConnection(body.session);
    elements.token.value = "";
    elements.webhookUrl.value = "";
    state.chats = body.chats || [];
    state.messages = body.messages || [];
    renderChatList();
    renderMessages();
    if (body.session.mode === "bot") {
      if (!body.session.canSend) await openFirstChannelIfNeeded();
      loadPeople(true);
    }
    setSetupOpen(false);
    setNotice(
      body.session.mode === "bot" && !body.session.canSend
        ? state.chats.length
          ? "Bot connected. Pick a channel from the chat list."
          : body.chatLoadError || "Bot connected. No channels loaded."
        : body.session.mode === "bot"
          ? "Bot connected. Opened the first readable channel; DM buttons appear next to people."
          : "Webhook ready. It can send messages but cannot read chat history.",
      "success"
    );
  } catch (error) {
    updateConnection({ connected: false });
    setNotice(error.message, "error");
  } finally {
    setLoading(false, state.connected ? "Update session" : "Start session");
  }
});

elements.disconnectButton.addEventListener("click", async () => {
  try {
    const body = await api("/api/disconnect", { method: "POST", body: "{}" });
    updateConnection(body.session);
    state.chats = [];
    state.messages = [];
    state.people = [];
    renderChatList();
    renderMessages();
    elements.messageInput.value = "";
    elements.messageInput.style.height = "";
    updateCharCount();
    setNotice("Disconnected.");
  } catch (error) {
    setNotice(error.message, "error");
  }
});

elements.refreshButton.addEventListener("click", () => refreshMessages());
elements.refreshButtonTop.addEventListener("click", () => refreshMessages());
elements.reloadChatsButton.addEventListener("click", () => loadChats(true));
elements.scanPeopleButton.addEventListener("click", () => loadPeople(false));
elements.chatSearch.addEventListener("input", () => renderChatList());

for (const selector of [".sidebar-scroll", ".messages", ".empty-state", ".member-panel", ".server-rail"]) {
  const pane = document.querySelector(selector);
  pane?.addEventListener(
    "wheel",
    (event) => {
      if (pane.scrollHeight <= pane.clientHeight) return;
      event.preventDefault();
      pane.scrollTop += event.deltaY;
    },
    { passive: false }
  );
}

elements.dmForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const userId = elements.dmUserId.value.trim();
  await submitDm(userId);
});

elements.messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = elements.messageInput.value.trim();
  if (!content) return;

  elements.sendButton.disabled = true;
  try {
    const body = await api("/api/messages", {
      method: "POST",
      body: JSON.stringify({ content })
    });
    elements.messageInput.value = "";
    elements.messageInput.style.height = "";
    updateCharCount();
    state.messages = [...state.messages, body.message].slice(-50);
    renderMessages();
    setNotice("Sent.", "success");
    window.setTimeout(() => refreshMessages(true), 800);
  } catch (error) {
    setNotice(error.message, "error");
  } finally {
    elements.sendButton.disabled = !(state.connected && state.session.canSend !== false);
    elements.messageInput.focus();
  }
});

elements.messageInput.addEventListener("input", () => {
  elements.messageInput.style.height = "auto";
  elements.messageInput.style.height = `${elements.messageInput.scrollHeight}px`;
  updateCharCount();
});

elements.messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    elements.messageForm.requestSubmit();
  }
});

async function boot() {
  setMode("bot");
  try {
    const body = await api("/api/session");
    updateConnection(body.session);
    if (body.session.connected) {
      if (body.session.mode === "bot") {
        await loadChats(false);
        await openFirstChannelIfNeeded();
        loadPeople(true);
      }
      await refreshMessages(true);
      setNotice("Connected.", "success");
    } else {
      setSetupOpen(true);
    }
  } catch {
    updateConnection({ connected: false });
    setSetupOpen(true);
  }
}

boot();
