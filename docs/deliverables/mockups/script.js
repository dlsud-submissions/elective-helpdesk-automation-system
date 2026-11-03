'use strict';

// AI-HAS static UI mockup (S1-12). Plain browser JavaScript, no framework and
// no backend. All data below is fictional and every "API call" is simulated
// with a timer; nothing leaves the browser and nothing persists on reload.

const ACCOUNTS = {
  'dana.cruz@example.test': { name: 'Dana Cruz', role: 'employee' },
  'alex.tan@example.test': { name: 'Alex Tan', role: 'agent' },
  'mika.reyes@example.test': { name: 'Mika Reyes', role: 'admin' },
};

const HOME_BY_ROLE = {
  employee: '/chat',
  agent: '/queue',
  admin: '/metrics',
};

const ROLE_LABELS = { employee: 'Employee', agent: 'Agent', admin: 'Admin' };

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const CATEGORY_LABELS = {
  account_access: 'Account access',
  hardware: 'Hardware',
  network: 'Network',
  software: 'Software',
  other: 'Other',
};

const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High' };

const AGENTS = ['Alex Tan', 'Jo Ramos'];

const articles = [
  {
    id: 'KB-104',
    title: 'Connecting to office Wi-Fi',
    category: 'network',
    source: 'IT Network Guide',
    updated: 'Oct 12, 2026',
    published: true,
    body: 'Forget the "Corp-Office" network, reconnect, and sign in with your work account when prompted. Personal devices use the "Corp-Guest" network instead.',
  },
  {
    id: 'KB-117',
    title: 'Restarting a network adapter',
    category: 'network',
    source: 'IT Network Guide',
    updated: 'Oct 03, 2026',
    published: true,
    body: 'Open network settings, disable the Wi-Fi adapter, wait ten seconds, and enable it again. If the adapter is missing, create a ticket.',
  },
  {
    id: 'KB-121',
    title: 'VPN troubleshooting',
    category: 'network',
    source: 'Remote Work Handbook',
    updated: 'Oct 20, 2026',
    published: true,
    body: 'For error 809 on Windows laptops, switch the VPN client to the TCP profile and reconnect. Restart the home router if disconnects continue.',
  },
  {
    id: 'KB-130',
    title: 'Requesting new hardware',
    category: 'hardware',
    source: 'IT Policy v2',
    updated: 'Oct 25, 2026',
    published: false,
    body: 'Hardware requests need a short business reason and manager approval. Standard peripherals ship within five working days.',
  },
];

const tickets = [
  {
    id: 'TCK-2049',
    summary: 'VPN drops on home network',
    description:
      'VPN disconnects every 10-15 minutes when working from home. Reconnect steps from KB-121 did not help.',
    category: 'network',
    priority: 'high',
    status: 'open',
    requester: 'Dana Cruz',
    assignee: null,
    escalated: true,
    updated: 'Today 10:15',
    history: [
      { status: 'open', at: 'Today 10:15', note: 'Escalated from chat' },
    ],
    escalation: {
      reason: 'User requested agent',
      symptoms: 'VPN disconnects every 10-15 min on home Wi-Fi.',
      tried: 'KB-121 reconnect steps, router restart.',
      sources: ['KB-121'],
      missing: 'VPN client version.',
    },
  },
  {
    id: 'TCK-2048',
    summary: 'Wi-Fi disconnects',
    description:
      'Laptop disconnects from Wi-Fi every few minutes since the VPN client update on Monday.',
    category: 'network',
    priority: 'medium',
    status: 'open',
    requester: 'Dana Cruz',
    assignee: null,
    escalated: false,
    updated: 'Oct 28',
    history: [
      { status: 'open', at: 'Oct 28 10:05', note: 'Created from chat' },
    ],
    escalation: null,
  },
  {
    id: 'TCK-2045',
    summary: 'Request for second monitor',
    description: 'Need a second monitor for spreadsheet review work.',
    category: 'hardware',
    priority: 'low',
    status: 'in_progress',
    requester: 'Lee Santos',
    assignee: 'Alex Tan',
    escalated: false,
    updated: 'Oct 27',
    history: [
      { status: 'open', at: 'Oct 26 14:20', note: 'Created' },
      {
        status: 'in_progress',
        at: 'Oct 27 09:00',
        note: 'Assigned to Alex Tan',
      },
    ],
    escalation: null,
  },
  {
    id: 'TCK-2031',
    summary: 'Printer on 3F not found',
    description: 'The third-floor printer does not appear in the printer list.',
    category: 'hardware',
    priority: 'low',
    status: 'resolved',
    requester: 'Dana Cruz',
    assignee: 'Jo Ramos',
    escalated: false,
    updated: 'Oct 21',
    history: [
      { status: 'open', at: 'Oct 20 08:40', note: 'Created' },
      {
        status: 'in_progress',
        at: 'Oct 20 09:15',
        note: 'Assigned to Jo Ramos',
      },
      { status: 'resolved', at: 'Oct 21 11:02', note: 'Printer re-shared' },
    ],
    escalation: null,
  },
];

const state = {
  session: null,
  returnTo: null,
  nextTicket: 2050,
  ticketDraft: null,
  viewToken: 0,
  chat: newConversation(),
};

function newConversation() {
  return {
    messages: [],
    status: null,
    pendingClarification: false,
    escalatedTicketId: null,
  };
}

// ---------- helpers ----------

const main = document.getElementById('main');

function esc(value) {
  return String(value).replace(
    /[&<>"']/g,
    (ch) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[ch]
  );
}

function timeNow() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function findArticle(id) {
  return articles.find((article) => article.id === id);
}

function findTicket(id) {
  return tickets.find((ticket) => ticket.id === id);
}

function showEmptyData() {
  return document.getElementById('empty-data').checked;
}

const SIM_TAG = '<span class="sim-tag">Simulated</span>';

function alertBox(kind, message, actions = '') {
  const role = kind === 'error' ? 'alert' : 'status';
  return `<div class="alert alert-${kind}" role="${role}"><p>${message}</p>${actions}</div>`;
}

function failureMessage(outcome, action) {
  if (outcome === 'denied') {
    return `You don't have permission to ${action}.`;
  }
  return `We couldn't ${action} right now. Nothing was changed. Try again.`;
}

function statusBadges(ticket) {
  const status = `<span class="badge badge-${ticket.status}">${STATUS_LABELS[ticket.status]}</span>`;
  const escalated = ticket.escalated
    ? ' <span class="badge badge-escalated">Escalated</span>'
    : '';
  return status + escalated;
}

function setFieldError(id, message) {
  const input = document.getElementById(id);
  const error = document.getElementById(`${id}-error`);
  error.textContent = message || '';
  error.hidden = !message;
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

// Reads the "next simulated API call" control, then resets it to success.
function takeOutcome() {
  const selected = document.querySelector('input[name="outcome"]:checked');
  const outcome = selected ? selected.value : 'ok';
  document.querySelector('input[name="outcome"][value="ok"]').checked = true;
  return outcome;
}

function simulateRequest({ onSlow, onSuccess, onFailure }) {
  const outcome = takeOutcome();
  const delay = outcome === 'slow' ? 3000 : 800;
  if (outcome === 'slow' && onSlow) {
    setTimeout(onSlow, 600);
  }
  setTimeout(() => {
    if (outcome === 'error' || outcome === 'denied') {
      onFailure(outcome);
    } else {
      onSuccess();
    }
  }, delay);
}

// Runs a callback only if the user is still on the view that scheduled it.
function whileActive(callback) {
  const token = state.viewToken;
  return (...args) => {
    if (token === state.viewToken) {
      callback(...args);
    }
  };
}

function pageHead(title, actions = '') {
  return `<div class="page-head"><h1 id="page-title" tabindex="-1">${title}</h1>${actions}</div>`;
}

function skeletonRows(count) {
  return `<div class="skeleton-list" aria-busy="true" aria-label="Loading">${'<div class="skeleton"></div>'.repeat(count)}</div>`;
}

// ---------- routing ----------

const routes = [
  { pattern: /^\/sign-in$/, view: viewSignIn, roles: null },
  {
    pattern: /^\/chat$/,
    view: viewChat,
    roles: ['employee', 'agent', 'admin'],
  },
  {
    pattern: /^\/tickets$/,
    view: viewMyTickets,
    roles: ['employee', 'agent', 'admin'],
  },
  {
    pattern: /^\/tickets\/new$/,
    view: viewNewTicket,
    roles: ['employee', 'agent', 'admin'],
  },
  {
    pattern: /^\/tickets\/(TCK-\d+)$/,
    view: viewTicketDetail,
    roles: ['employee', 'agent', 'admin'],
  },
  {
    pattern: /^\/queue(?:\/(TCK-\d+))?$/,
    view: viewQueue,
    roles: ['agent', 'admin'],
  },
  {
    pattern: /^\/knowledge(?:\/(new|KB-\d+))?$/,
    view: viewKnowledge,
    roles: ['admin'],
  },
  { pattern: /^\/metrics$/, view: viewMetrics, roles: ['admin'] },
];

function navigate(path) {
  if (location.hash === `#${path}`) {
    render();
  } else {
    location.hash = path;
  }
}

function currentPath() {
  return location.hash.replace(/^#/, '') || '/';
}

function render() {
  state.viewToken += 1;
  const path = currentPath();
  const session = state.session;

  if (!session && path !== '/sign-in') {
    state.returnTo = path === '/' ? null : path;
    navigate('/sign-in');
    return;
  }
  if (session && (path === '/' || path === '/sign-in')) {
    navigate(HOME_BY_ROLE[session.role]);
    return;
  }

  updateChrome();
  closeNav();

  const route = routes.find((candidate) => candidate.pattern.test(path));
  if (!route) {
    viewMessage('Page not found', "We couldn't find that page or ticket.");
  } else if (route.roles && !route.roles.includes(session.role)) {
    viewMessage(
      'Access denied',
      'You do not have access to this page. This is enforced by the API, not only hidden in the menu.'
    );
  } else {
    route.view(...path.match(route.pattern).slice(1));
  }

  // Move focus to the new screen's heading; on narrow screens the queue list
  // is hidden while a ticket is open, so its detail heading is used instead.
  const heading = [
    document.getElementById('page-title'),
    document.getElementById('detail-title'),
  ].find((element) => element && element.offsetParent !== null);
  if (heading) {
    heading.focus();
  }
}

function updateChrome() {
  const session = state.session;
  document.body.classList.toggle('signed-out', !session);
  document.getElementById('account').hidden = !session;
  document.getElementById('view-as-field').hidden = !session;
  if (!session) {
    return;
  }
  document.getElementById('account-name').textContent = session.name;
  document.getElementById('account-role').textContent =
    ROLE_LABELS[session.role];
  document.getElementById('view-as').value = session.email;
  document
    .getElementById('brand')
    .setAttribute('href', `#${HOME_BY_ROLE[session.role]}`);

  const path = currentPath();
  document.querySelectorAll('#app-nav [data-roles]').forEach((item) => {
    const allowed = item.dataset.roles.split(' ').includes(session.role);
    const target = item.tagName === 'A' ? item.parentElement : item;
    target.hidden = !allowed;
    if (item.tagName === 'A') {
      const href = item.getAttribute('href').slice(1);
      const active =
        href === path ||
        (path.startsWith(`${href}/`) && path !== '/tickets/new');
      if (active) {
        item.setAttribute('aria-current', 'page');
      } else {
        item.removeAttribute('aria-current');
      }
    }
  });
}

function signIn(email) {
  const account = ACCOUNTS[email];
  state.session = { email, ...account };
  const target = state.returnTo || HOME_BY_ROLE[account.role];
  state.returnTo = null;
  navigate(target);
}

// ---------- views ----------

function viewMessage(title, message) {
  const home = state.session ? HOME_BY_ROLE[state.session.role] : '/sign-in';
  main.innerHTML = `
    <section class="panel message-panel">
      ${pageHead(esc(title))}
      <p>${esc(message)}</p>
      <p><a class="btn btn-primary" href="#${home}">Go to my home page</a></p>
    </section>`;
}

function viewSignIn() {
  const accountButtons = Object.entries(ACCOUNTS)
    .map(
      ([email, account]) =>
        `<li><button type="button" class="btn btn-link" data-email="${email}">${ROLE_LABELS[account.role]}: ${esc(account.name)}</button></li>`
    )
    .join('');

  main.innerHTML = `
    <section class="panel auth-card" aria-labelledby="page-title">
      <p class="eyebrow">AI-HAS IT Helpdesk</p>
      <h1 id="page-title" tabindex="-1">Sign in to get IT help</h1>
      <div id="signin-alert"></div>
      <form id="signin-form" novalidate>
        <div class="field">
          <label for="email">Work email</label>
          <input id="email" type="email" autocomplete="email" aria-describedby="email-error" />
          <p id="email-error" class="field-error" hidden></p>
        </div>
        <div class="field">
          <label for="password">Password</label>
          <div class="input-row">
            <input id="password" type="password" autocomplete="current-password" aria-describedby="password-error" />
            <button type="button" class="btn btn-secondary" id="toggle-password">Show password</button>
          </div>
          <p id="password-error" class="field-error" hidden></p>
        </div>
        <button type="submit" class="btn btn-primary btn-block" id="signin-submit">Sign in</button>
      </form>
      <div class="note">
        <p>Prototype only. Fill in a fictional test account (any password works):</p>
        <ul class="plain-list">${accountButtons}</ul>
      </div>
    </section>`;

  const form = document.getElementById('signin-form');
  const email = document.getElementById('email');
  const password = document.getElementById('password');
  const toggle = document.getElementById('toggle-password');

  toggle.addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    toggle.textContent = show ? 'Hide password' : 'Show password';
  });

  main.querySelectorAll('[data-email]').forEach((button) => {
    button.addEventListener('click', () => {
      email.value = button.dataset.email;
      password.value = 'fictional-demo';
      email.focus();
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const emailValue = email.value.trim().toLowerCase();
    setFieldError(
      'email',
      /^\S+@\S+\.\S+$/.test(emailValue) ? '' : 'Enter your work email.'
    );
    setFieldError('password', password.value ? '' : 'Enter your password.');
    const invalid = form.querySelector('[aria-invalid="true"]');
    if (invalid) {
      invalid.focus();
      return;
    }

    const submit = document.getElementById('signin-submit');
    const alertArea = document.getElementById('signin-alert');
    submit.disabled = true;
    submit.textContent = 'Signing in…';
    alertArea.innerHTML = '';

    simulateRequest({
      onSlow: whileActive(() => {
        alertArea.innerHTML = alertBox(
          'info',
          'The helpdesk service is starting. This can take up to a minute.'
        );
      }),
      onSuccess: whileActive(() => {
        if (ACCOUNTS[emailValue]) {
          signIn(emailValue);
          return;
        }
        submit.disabled = false;
        submit.textContent = 'Sign in';
        alertArea.innerHTML = alertBox(
          'error',
          'Email or password is incorrect.'
        );
      }),
      onFailure: whileActive(() => {
        submit.disabled = false;
        submit.textContent = 'Sign in';
        alertArea.innerHTML = alertBox(
          'error',
          "We couldn't sign you in right now. Try again."
        );
      }),
    });
  });
}

// ----- W-02 chat -----

const SUGGESTIONS = [
  'How do I connect to the office Wi-Fi?',
  'My VPN keeps disconnecting',
  'How do I reset my password?',
];

const SECRET_PATTERN =
  /\b(password|passcode|pin)\b\s*(is|:|=)\s*\S+|\b(AIza|sk-|sb_secret_)[\w-]{8,}/i;

function viewChat() {
  main.innerHTML = `
    <section class="chat" aria-labelledby="page-title">
      ${pageHead('Ask IT', '<button type="button" class="btn btn-secondary" id="new-chat">New chat</button>')}
      <div id="chat-log" class="chat-log" role="log" aria-live="polite" aria-label="Conversation"></div>
      <form id="chat-form" class="composer" novalidate>
        <div id="chat-warning"></div>
        <label for="chat-input" class="visually-hidden">Describe your IT issue</label>
        <div class="composer-row">
          <textarea id="chat-input" rows="2" placeholder="Describe your IT issue…" aria-describedby="chat-hint chat-input-error"></textarea>
          <button type="submit" class="btn btn-primary" id="chat-send">Send</button>
        </div>
        <p id="chat-input-error" class="field-error" hidden></p>
        <div class="composer-foot">
          <p id="chat-hint" class="hint">Don't share passwords or secret codes. Enter sends; Shift+Enter adds a line.</p>
          <button type="button" class="btn btn-link" id="talk-person">Talk to a person</button>
        </div>
      </form>
    </section>`;

  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (state.chat.status) {
      return;
    }
    const text = input.value.trim();
    document.getElementById('chat-warning').innerHTML = '';
    if (!text) {
      setFieldError('chat-input', 'Type a question first.');
      input.focus();
      return;
    }
    if (text.length > 2000) {
      setFieldError('chat-input', 'Keep messages under 2,000 characters.');
      input.focus();
      return;
    }
    setFieldError('chat-input', '');
    if (SECRET_PATTERN.test(text)) {
      document.getElementById('chat-warning').innerHTML = alertBox(
        'warning',
        'This looks like a password or secret key. Remove it before sending; the IT team will never ask for it.'
      );
      input.focus();
      return;
    }
    input.value = '';
    state.chat.messages.push({ sender: 'user', text, at: timeNow() });
    requestAnswer(text);
  });

  document.getElementById('new-chat').addEventListener('click', () => {
    state.chat = newConversation();
    document.getElementById('chat-warning').innerHTML = '';
    renderChat();
    input.focus();
  });

  document.getElementById('talk-person').addEventListener('click', escalate);
  document.getElementById('chat-log').addEventListener('click', onChatAction);
  renderChat();
}

function renderChat() {
  const log = document.getElementById('chat-log');
  if (!log) {
    return;
  }
  const busy = Boolean(state.chat.status);
  document.getElementById('chat-send').disabled = busy;
  document.getElementById('chat-input').disabled = busy;
  document.getElementById('talk-person').disabled = busy;

  if (state.chat.messages.length === 0 && !busy) {
    log.innerHTML = `
      <div class="chat-empty">
        <h2>How can we help?</h2>
        <p>Answers come from approved IT procedures and list their sources. You can ask for a person at any time.</p>
        <p class="hint">Try one of these:</p>
        <ul class="plain-list suggestions">
          ${SUGGESTIONS.map((text) => `<li><button type="button" class="btn btn-chip" data-action="suggest" data-text="${esc(text)}">${esc(text)}</button></li>`).join('')}
        </ul>
      </div>`;
    return;
  }

  const lastAnswer = state.chat.messages
    .map((message) => message.outcome)
    .lastIndexOf('answered');
  let html = state.chat.messages
    .map((message, index) => renderMessage(message, index === lastAnswer))
    .join('');
  if (state.chat.status === 'loading') {
    html += `<div class="msg msg-assistant msg-loading"><p class="msg-meta">Assistant</p><p><span class="dots" aria-hidden="true"></span> Checking approved IT procedures…</p></div>`;
  } else if (state.chat.status === 'slow') {
    html += `<div class="msg msg-assistant msg-loading"><p class="msg-meta">Assistant</p><p><span class="dots" aria-hidden="true"></span> The helpdesk service is starting. This can take up to a minute.</p></div>`;
  }
  log.innerHTML = html;
  log.scrollTop = log.scrollHeight;
}

function renderMessage(message, offerFeedback) {
  if (message.sender === 'user') {
    return `<div class="msg msg-user"><p class="msg-meta">You · ${message.at}</p><p>${esc(message.text)}</p></div>`;
  }
  if (message.sender === 'notice') {
    return `<div class="msg msg-notice">${message.html}</div>`;
  }
  if (message.sender === 'error') {
    return `<div class="msg msg-notice">${alertBox(
      'error',
      message.outcome === 'denied'
        ? "You don't have permission to use the assistant."
        : "We couldn't get an answer right now. Your message was not lost.",
      `<div class="actions"><button type="button" class="btn btn-secondary btn-small" data-action="retry">Retry</button><button type="button" class="btn btn-link" data-action="create-ticket">Create a ticket instead</button></div>`
    )}</div>`;
  }

  let body = `<p>${esc(message.text)}</p>`;
  if (message.steps) {
    body += `<ol>${message.steps
      .map(
        (step) =>
          `<li>${esc(step.text)}${step.cite ? ` <button type="button" class="cite" data-action="source" data-article="${message.sources[step.cite - 1]}" aria-label="Source ${step.cite}: ${esc(findArticle(message.sources[step.cite - 1]).title)}">[${step.cite}]</button>` : ''}</li>`
      )
      .join('')}</ol>`;
  }
  if (message.sources) {
    body += `<div class="sources"><p class="sources-title">Sources</p><ol>${message.sources
      .map((id) => {
        const article = findArticle(id);
        return `<li><button type="button" class="btn btn-link" data-action="source" data-article="${id}">${id} ${esc(article.title)}</button></li>`;
      })
      .join('')}</ol></div>`;
  }
  if (message.fields) {
    body += `<p class="hint">Needed: ${esc(message.fields.join(', '))}</p>`;
  }
  if (message.outcome === 'escalation_suggested') {
    body += `<div class="actions"><button type="button" class="btn btn-secondary btn-small" data-action="create-ticket">Create a ticket</button><button type="button" class="btn btn-secondary btn-small" data-action="talk-person">Talk to a person</button></div>`;
  }
  if (offerFeedback && !message.feedbackDone) {
    body += `<div class="actions"><span>Did this solve it?</span><button type="button" class="btn btn-secondary btn-small" data-action="solved">Yes</button><button type="button" class="btn btn-secondary btn-small" data-action="create-ticket">No, create a ticket</button><button type="button" class="btn btn-link" data-action="talk-person">Talk to a person</button></div>`;
  }
  return `<div class="msg msg-assistant"><p class="msg-meta">Assistant · ${message.at}</p>${body}</div>`;
}

function buildReply(text) {
  const question = text.toLowerCase();
  const at = timeNow();

  if (state.chat.pendingClarification) {
    state.chat.pendingClarification = false;
    return {
      sender: 'assistant',
      outcome: 'answered',
      at,
      text: 'Thanks. For that error on a Windows laptop, try these steps:',
      steps: [
        { text: 'Switch the VPN client to the TCP profile.', cite: 1 },
        { text: 'Reconnect and sign in with your work account.', cite: 1 },
        { text: 'If drops continue, restart your home router.', cite: 1 },
      ],
      sources: ['KB-121'],
    };
  }
  if (/wi-?fi|wireless/.test(question)) {
    return {
      sender: 'assistant',
      outcome: 'answered',
      at,
      text: 'Try these steps:',
      steps: [
        { text: 'Forget the "Corp-Office" network and reconnect.', cite: 0 },
        { text: 'Sign in with your work account when prompted.', cite: 1 },
        { text: 'If it still fails, restart the network adapter.', cite: 2 },
      ],
      sources: ['KB-104', 'KB-117'],
    };
  }
  if (/vpn/.test(question)) {
    state.chat.pendingClarification = true;
    return {
      sender: 'assistant',
      outcome: 'clarification',
      at,
      text: 'Which device is affected, and what is the exact error message?',
      fields: ['device type', 'error message'],
    };
  }
  return {
    sender: 'assistant',
    outcome: 'escalation_suggested',
    at,
    text: "I couldn't find an approved procedure for this, so I can't confirm an answer. The IT team can help.",
  };
}

// Chat callbacks are tied to the conversation, not the view, so a reply that
// arrives after navigating away is still shown when the user comes back.
function forChat(chat, callback) {
  return (...args) => {
    if (chat === state.chat) {
      callback(...args);
      renderChat();
    }
  };
}

function requestAnswer(text) {
  const chat = state.chat;
  chat.status = 'loading';
  renderChat();
  simulateRequest({
    onSlow: forChat(chat, () => {
      chat.status = 'slow';
    }),
    onSuccess: forChat(chat, () => {
      chat.status = null;
      chat.messages.push(buildReply(text));
    }),
    onFailure: forChat(chat, (outcome) => {
      chat.status = null;
      chat.messages.push({ sender: 'error', outcome, retryText: text });
    }),
  });
}

function firstQuestion() {
  const first = state.chat.messages.find((m) => m.sender === 'user');
  return first ? first.text : '';
}

function escalate() {
  const chat = state.chat;
  if (chat.status) {
    return;
  }
  if (!firstQuestion()) {
    setFieldError(
      'chat-input',
      'Describe your issue first so the IT team has context.'
    );
    document.getElementById('chat-input').focus();
    return;
  }
  if (chat.escalatedTicketId) {
    chat.messages.push({
      sender: 'notice',
      html: alertBox(
        'info',
        `This conversation was already sent to the IT team as <a href="#/tickets/${chat.escalatedTicketId}">${chat.escalatedTicketId}</a>. No duplicate was created.`
      ),
    });
    renderChat();
    return;
  }

  chat.status = 'loading';
  renderChat();
  simulateRequest({
    onSlow: forChat(chat, () => {
      chat.status = 'slow';
    }),
    onSuccess: forChat(chat, () => {
      chat.status = null;
      const ticket = createTicket({
        summary: truncate(firstQuestion(), 60),
        description: chat.messages
          .filter((m) => m.sender === 'user')
          .map((m) => m.text)
          .join('\n'),
        category: 'other',
        priority: 'medium',
        escalated: true,
        note: 'Escalated from chat',
      });
      ticket.escalation = {
        reason: 'User requested agent',
        symptoms: truncate(firstQuestion(), 120),
        tried: 'Assistant conversation; see full transcript.',
        sources: chat.messages.flatMap((m) => m.sources || []),
        missing: 'To be confirmed by the agent.',
      };
      chat.escalatedTicketId = ticket.id;
      chat.messages.push({
        sender: 'notice',
        html: alertBox(
          'success',
          `Sent to the IT team. Ticket <strong>${ticket.id}</strong> · Escalated · Queue: IT agents. An agent will continue from this conversation. ${SIM_TAG}`,
          `<div class="actions"><a class="btn btn-secondary btn-small" href="#/tickets/${ticket.id}">View ticket</a></div>`
        ),
      });
    }),
    onFailure: forChat(chat, (outcome) => {
      chat.status = null;
      chat.messages.push({
        sender: 'notice',
        html: alertBox(
          'error',
          `${failureMessage(outcome, 'reach the IT team')} You can also create a ticket.`
        ),
      });
    }),
  });
}

function onChatAction(event) {
  const target = event.target.closest('[data-action]');
  if (!target) {
    return;
  }
  const action = target.dataset.action;
  if (action === 'suggest') {
    const input = document.getElementById('chat-input');
    input.value = target.dataset.text;
    input.focus();
  } else if (action === 'source') {
    event.preventDefault();
    openSource(target.dataset.article);
  } else if (action === 'solved') {
    state.chat.messages.forEach((m) => {
      m.feedbackDone = true;
    });
    state.chat.messages.push({
      sender: 'notice',
      html: alertBox(
        'success',
        `Glad that helped. Feedback recorded. ${SIM_TAG}`
      ),
    });
    renderChat();
  } else if (action === 'create-ticket') {
    state.ticketDraft = {
      summary: truncate(firstQuestion(), 80),
      description: state.chat.messages
        .filter((m) => m.sender === 'user')
        .map((m) => m.text)
        .join('\n'),
    };
    navigate('/tickets/new');
  } else if (action === 'talk-person') {
    escalate();
  } else if (action === 'retry') {
    const failed = state.chat.messages.pop();
    requestAnswer(failed.retryText);
  }
}

function openSource(id) {
  const article = findArticle(id);
  const dialog = document.getElementById('source-dialog');
  document.getElementById('source-title').textContent =
    `${article.id} ${article.title}`;
  document.getElementById('source-meta').textContent =
    `${CATEGORY_LABELS[article.category]} · ${article.source} · Updated ${article.updated}`;
  document.getElementById('source-excerpt').textContent = article.body;
  dialog.showModal();
}

// ----- W-03 new ticket -----

function createTicket({
  summary,
  description,
  category,
  priority,
  escalated,
  note,
}) {
  const ticket = {
    id: `TCK-${state.nextTicket}`,
    summary,
    description,
    category,
    priority,
    status: 'open',
    requester: state.session.name,
    assignee: null,
    escalated,
    updated: `Today ${timeNow()}`,
    history: [{ status: 'open', at: `Today ${timeNow()}`, note }],
    escalation: null,
  };
  state.nextTicket += 1;
  tickets.unshift(ticket);
  return ticket;
}

function viewNewTicket() {
  const draft = state.ticketDraft;
  state.ticketDraft = null;
  const categoryOptions = Object.entries(CATEGORY_LABELS)
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join('');
  const priorityOptions = Object.entries(PRIORITY_LABELS)
    .map(
      ([value, label]) =>
        `<label class="radio"><input type="radio" name="priority" value="${value}" ${value === 'medium' ? 'checked' : ''} /> ${label}</label>`
    )
    .join('');

  main.innerHTML = `
    <section class="panel narrow" aria-labelledby="page-title">
      ${pageHead('New ticket')}
      <div id="ticket-result"></div>
      <form id="ticket-form" novalidate>
        <div id="error-summary"></div>
        <div class="field">
          <label for="summary">Short summary <span aria-hidden="true">*</span></label>
          <input id="summary" type="text" required aria-describedby="summary-error" value="${draft ? esc(draft.summary) : ''}" />
          <p id="summary-error" class="field-error" hidden></p>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="category">Category <span aria-hidden="true">*</span></label>
            <select id="category" required aria-describedby="category-error">
              <option value="">Select a category</option>${categoryOptions}
            </select>
            <p id="category-error" class="field-error" hidden></p>
          </div>
          <fieldset class="field">
            <legend>Priority <span aria-hidden="true">*</span></legend>
            <div class="radio-row">${priorityOptions}</div>
          </fieldset>
        </div>
        <div class="field">
          <label for="description">Description <span aria-hidden="true">*</span></label>
          <textarea id="description" rows="5" required aria-describedby="description-error">${draft ? esc(draft.description) : ''}</textarea>
          <p id="description-error" class="field-error" hidden></p>
        </div>
        ${draft ? alertBox('info', 'Created from your chat. The conversation is attached so the agent can see what you already tried.') : ''}
        <p class="hint">Fields marked * are required. Don't include passwords or secret codes.</p>
        <div class="actions end">
          <a class="btn btn-secondary" href="#/chat">Cancel</a>
          <button type="submit" class="btn btn-primary" id="ticket-submit">Submit ticket</button>
        </div>
      </form>
    </section>`;

  const form = document.getElementById('ticket-form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = {
      summary: document.getElementById('summary').value.trim(),
      category: document.getElementById('category').value,
      description: document.getElementById('description').value.trim(),
      priority: form.querySelector('input[name="priority"]:checked').value,
    };
    const errors = {
      summary: !values.summary
        ? 'Enter a short summary of the issue.'
        : values.summary.length > 120
          ? 'Keep the summary under 120 characters.'
          : '',
      category: values.category ? '' : 'Choose a category.',
      description:
        values.description.length < 10
          ? 'Describe the issue in at least 10 characters.'
          : '',
    };
    Object.entries(errors).forEach(([id, message]) =>
      setFieldError(id, message)
    );

    const failed = Object.keys(errors).filter((id) => errors[id]);
    const summary = document.getElementById('error-summary');
    if (failed.length) {
      summary.innerHTML = `
        <div class="alert alert-error" role="alert" tabindex="-1" id="error-summary-box">
          <p>Fix ${failed.length} field${failed.length > 1 ? 's' : ''} before submitting:</p>
          <ul>${failed.map((id) => `<li><a href="#${id}" data-focus="${id}">${esc(errors[id])}</a></li>`).join('')}</ul>
        </div>`;
      summary.querySelectorAll('[data-focus]').forEach((link) => {
        link.addEventListener('click', (clickEvent) => {
          clickEvent.preventDefault();
          document.getElementById(link.dataset.focus).focus();
        });
      });
      document.getElementById('error-summary-box').focus();
      return;
    }
    summary.innerHTML = '';

    const submit = document.getElementById('ticket-submit');
    const result = document.getElementById('ticket-result');
    submit.disabled = true;
    submit.textContent = 'Submitting…';
    simulateRequest({
      onSlow: whileActive(() => {
        result.innerHTML = alertBox(
          'info',
          'The helpdesk service is starting. This can take up to a minute.'
        );
      }),
      onSuccess: whileActive(() => {
        const ticket = createTicket({
          ...values,
          escalated: false,
          note: draft ? 'Created from chat' : 'Created',
        });
        form.remove();
        result.innerHTML = alertBox(
          'success',
          `<strong>Ticket ${ticket.id} created.</strong> Status: Open · Priority: ${PRIORITY_LABELS[ticket.priority]}. You'll see updates in My tickets. ${SIM_TAG}`,
          `<div class="actions"><a class="btn btn-primary btn-small" href="#/tickets/${ticket.id}">View ticket</a><a class="btn btn-secondary btn-small" href="#/chat">Back to chat</a></div>`
        );
        result.querySelector('a').focus();
      }),
      onFailure: whileActive((outcome) => {
        submit.disabled = false;
        submit.textContent = 'Submit ticket';
        result.innerHTML = alertBox(
          'error',
          `${failureMessage(outcome, 'create the ticket')} Your answers are kept.`
        );
      }),
    });
  });
}

// ----- W-04 my tickets -----

function ticketTable(list, linkBase, showRequester) {
  return `
    <table class="data-table">
      <thead><tr>
        <th scope="col">ID</th><th scope="col">Summary</th>
        ${showRequester ? '<th scope="col">Requester</th>' : ''}
        <th scope="col">Status</th><th scope="col">Priority</th><th scope="col">Updated</th>
      </tr></thead>
      <tbody>${list
        .map(
          (ticket) => `
        <tr>
          <td data-label="ID"><a href="#${linkBase}/${ticket.id}">${ticket.id}</a></td>
          <td data-label="Summary">${esc(ticket.summary)}</td>
          ${showRequester ? `<td data-label="Requester">${esc(ticket.requester)}</td>` : ''}
          <td data-label="Status">${statusBadges(ticket)}</td>
          <td data-label="Priority">${PRIORITY_LABELS[ticket.priority]}</td>
          <td data-label="Updated">${esc(ticket.updated)}</td>
        </tr>`
        )
        .join('')}</tbody>
    </table>`;
}

function statusFilter(id, value) {
  const options = Object.entries(STATUS_LABELS)
    .map(
      ([key, label]) =>
        `<option value="${key}" ${key === value ? 'selected' : ''}>${label}</option>`
    )
    .join('');
  return `<div class="field inline"><label for="${id}">Status</label><select id="${id}"><option value="">All</option>${options}</select></div>`;
}

function loadList(container, renderList) {
  container.innerHTML = skeletonRows(3);
  simulateRequest({
    onSlow: whileActive(() => {
      container.innerHTML =
        alertBox(
          'info',
          'The helpdesk service is starting. This can take up to a minute.'
        ) + skeletonRows(3);
    }),
    onSuccess: whileActive(renderList),
    onFailure: whileActive((outcome) => {
      container.innerHTML = alertBox(
        'error',
        failureMessage(outcome, 'load this list'),
        '<div class="actions"><button type="button" class="btn btn-secondary btn-small" id="list-retry">Retry</button></div>'
      );
      document
        .getElementById('list-retry')
        .addEventListener('click', () => loadList(container, renderList));
    }),
  });
}

function viewMyTickets() {
  main.innerHTML = `
    <section aria-labelledby="page-title">
      ${pageHead('My tickets', '<a class="btn btn-primary" href="#/tickets/new">New ticket</a>')}
      <div class="toolbar">${statusFilter('my-status', '')}</div>
      <p class="visually-hidden" id="result-count" aria-live="polite"></p>
      <div id="ticket-list"></div>
    </section>`;

  const container = document.getElementById('ticket-list');
  const filter = document.getElementById('my-status');

  function renderList() {
    const mine = showEmptyData()
      ? []
      : tickets.filter((t) => t.requester === state.session.name);
    const list = mine.filter((t) => !filter.value || t.status === filter.value);
    document.getElementById('result-count').textContent =
      `${list.length} tickets shown`;
    if (mine.length === 0) {
      container.innerHTML = `<div class="empty"><p>You have no tickets. Ask IT first; many issues are solved in chat.</p><a class="btn btn-secondary" href="#/chat">Ask IT</a></div>`;
    } else if (list.length === 0) {
      container.innerHTML = `<div class="empty"><p>No tickets with this status.</p></div>`;
    } else {
      container.innerHTML = ticketTable(list, '/tickets', false);
    }
  }

  filter.addEventListener('change', renderList);
  loadList(container, renderList);
}

function historyList(ticket) {
  const reached = ticket.history.map((entry) => entry.status);
  const steps = ['open', 'in_progress', 'resolved'];
  if (reached.includes('closed')) {
    steps.push('closed');
  }
  return `<ol class="timeline">${steps
    .map((status) => {
      const entry = [...ticket.history]
        .reverse()
        .find((item) => item.status === status);
      return entry
        ? `<li class="done"><strong>${STATUS_LABELS[status]}</strong> <span class="meta">${esc(entry.at)} · ${esc(entry.note)}</span></li>`
        : `<li><strong>${STATUS_LABELS[status]}</strong> <span class="meta">Not reached</span></li>`;
    })
    .join('')}</ol>`;
}

function viewTicketDetail(id) {
  const ticket = findTicket(id);
  const allowed =
    ticket &&
    (ticket.requester === state.session.name ||
      state.session.role !== 'employee');
  if (!allowed) {
    viewMessage('Ticket not found', "We couldn't find that page or ticket.");
    return;
  }
  main.innerHTML = `
    <section class="panel" aria-labelledby="page-title">
      <p><a href="#/tickets">&larr; My tickets</a></p>
      ${pageHead(`${ticket.id} ${esc(ticket.summary)}`)}
      <p>${statusBadges(ticket)} <span class="meta">Priority: ${PRIORITY_LABELS[ticket.priority]}</span></p>
      <dl class="details">
        <div><dt>Category</dt><dd>${CATEGORY_LABELS[ticket.category]}</dd></div>
        <div><dt>Assigned to</dt><dd>${ticket.assignee ? esc(ticket.assignee) : 'Not assigned yet'}</dd></div>
      </dl>
      <h2>Description</h2>
      <p class="pre">${esc(ticket.description)}</p>
      <h2>Status history</h2>
      ${historyList(ticket)}
      ${ticket.escalated ? '<p class="hint">This ticket was escalated from chat. The agent can see your conversation.</p>' : ''}
    </section>`;
}

// ----- W-05 / W-06 agent queue -----

const queueFilters = { q: '', status: '', escalated: false, unassigned: false };

function queueSort(a, b) {
  const rank = { high: 0, medium: 1, low: 2 };
  return (
    Number(b.escalated) - Number(a.escalated) ||
    rank[a.priority] - rank[b.priority]
  );
}

function viewQueue(selectedId) {
  const selected = selectedId ? findTicket(selectedId) : null;
  main.innerHTML = `
    <section class="queue ${selectedId ? 'has-selection' : ''}" aria-labelledby="page-title">
      <div class="queue-list">
        ${pageHead('Ticket queue')}
        <form class="toolbar" id="queue-filters">
          <div class="field inline"><label for="queue-q">Search</label><input id="queue-q" type="search" value="${esc(queueFilters.q)}" /></div>
          ${statusFilter('queue-status', queueFilters.status)}
          <label class="checkbox"><input type="checkbox" id="queue-escalated" ${queueFilters.escalated ? 'checked' : ''}/> Escalated only</label>
          <label class="checkbox"><input type="checkbox" id="queue-unassigned" ${queueFilters.unassigned ? 'checked' : ''}/> Unassigned</label>
        </form>
        <p class="visually-hidden" id="result-count" aria-live="polite"></p>
        <div id="queue-items"></div>
      </div>
      <div class="queue-detail" id="queue-detail"></div>
    </section>`;

  const container = document.getElementById('queue-items');

  function renderList() {
    const list = (showEmptyData() ? [] : tickets)
      .filter(
        (t) =>
          (!queueFilters.status || t.status === queueFilters.status) &&
          (!queueFilters.escalated || t.escalated) &&
          (!queueFilters.unassigned || !t.assignee) &&
          `${t.id} ${t.summary} ${t.requester}`
            .toLowerCase()
            .includes(queueFilters.q.toLowerCase())
      )
      .sort(queueSort);
    document.getElementById('result-count').textContent =
      `${list.length} tickets match`;
    if (list.length === 0) {
      container.innerHTML = `<div class="empty"><p>No tickets match these filters.</p><button type="button" class="btn btn-secondary" id="clear-filters">Clear filters</button></div>`;
      document.getElementById('clear-filters').addEventListener('click', () => {
        Object.assign(queueFilters, {
          q: '',
          status: '',
          escalated: false,
          unassigned: false,
        });
        viewQueue(selectedId);
      });
      return;
    }
    container.innerHTML = `<ul class="plain-list queue-items">${list
      .map(
        (t) => `
      <li><a class="queue-item" href="#/queue/${t.id}" ${t.id === selectedId ? 'aria-current="true"' : ''}>
        <span class="queue-item-top"><strong>${t.id}</strong> ${statusBadges(t)} <span class="meta">${PRIORITY_LABELS[t.priority]}</span></span>
        <span>${esc(t.summary)}</span>
        <span class="meta">${esc(t.requester)} · ${esc(t.updated)}${t.assignee === state.session.name ? ' · You' : ''}</span>
      </a></li>`
      )
      .join('')}</ul>`;
  }

  document.getElementById('queue-filters').addEventListener('input', () => {
    queueFilters.q = document.getElementById('queue-q').value;
    queueFilters.status = document.getElementById('queue-status').value;
    queueFilters.escalated = document.getElementById('queue-escalated').checked;
    queueFilters.unassigned =
      document.getElementById('queue-unassigned').checked;
    renderList();
  });
  document
    .getElementById('queue-filters')
    .addEventListener('submit', (event) => event.preventDefault());

  renderList();
  renderAgentDetail(selected, selectedId);
}

function renderAgentDetail(ticket, selectedId) {
  const panel = document.getElementById('queue-detail');
  if (!selectedId) {
    panel.innerHTML = `<div class="empty"><p>Select a ticket to see its details.</p></div>`;
    return;
  }
  if (!ticket) {
    panel.innerHTML = alertBox('error', "We couldn't find that ticket.");
    return;
  }

  const escalation = ticket.escalation
    ? `
      <section class="summary-box" aria-labelledby="esc-title">
        <h3 id="esc-title">Escalation summary <span class="meta">(AI-generated, check before acting)</span></h3>
        <dl class="details">
          <div><dt>Reason</dt><dd>${esc(ticket.escalation.reason)}</dd></div>
          <div><dt>Symptoms</dt><dd>${esc(ticket.escalation.symptoms)}</dd></div>
          <div><dt>Tried</dt><dd>${esc(ticket.escalation.tried)}</dd></div>
          <div><dt>Sources</dt><dd>${ticket.escalation.sources.length ? ticket.escalation.sources.map((id) => `<button type="button" class="btn btn-link" data-article="${id}">${id} ${esc(findArticle(id).title)}</button>`).join(', ') : 'None'}</dd></div>
          <div><dt>Missing</dt><dd>${esc(ticket.escalation.missing)}</dd></div>
        </dl>
      </section>`
    : `<h3>Description</h3><p class="pre">${esc(ticket.description)}</p>`;

  const statusOptions = Object.entries(STATUS_LABELS)
    .map(
      ([value, label]) =>
        `<option value="${value}" ${value === ticket.status ? 'selected' : ''}>${label}</option>`
    )
    .join('');
  const assignees = [...new Set([state.session.name, ...AGENTS])];
  const assigneeOptions = [
    `<option value="">Unassigned</option>`,
    ...assignees.map(
      (name) =>
        `<option value="${esc(name)}" ${name === ticket.assignee ? 'selected' : ''}>${esc(name)}${name === state.session.name ? ' (me)' : ''}</option>`
    ),
  ].join('');

  panel.innerHTML = `
    <article class="panel" aria-labelledby="detail-title">
      <p class="back-link"><a href="#/queue">&larr; Back to queue</a></p>
      <h2 id="detail-title">${ticket.id} ${esc(ticket.summary)}</h2>
      <p>${statusBadges(ticket)} <span class="meta">${PRIORITY_LABELS[ticket.priority]} · ${esc(ticket.requester)} · ${CATEGORY_LABELS[ticket.category]} · ${esc(ticket.updated)}</span></p>
      ${escalation}
      <form id="agent-form" class="toolbar" novalidate>
        <div class="field inline"><label for="agent-status">Status</label><select id="agent-status">${statusOptions}</select></div>
        <div class="field inline"><label for="agent-assignee">Assigned to</label><select id="agent-assignee">${assigneeOptions}</select></div>
        <button type="submit" class="btn btn-primary" id="agent-save">Save</button>
      </form>
      <div id="agent-result"></div>
      <h3>Status history</h3>
      ${historyList(ticket)}
    </article>`;

  panel.querySelectorAll('[data-article]').forEach((button) => {
    button.addEventListener('click', () => openSource(button.dataset.article));
  });

  document.getElementById('agent-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const status = document.getElementById('agent-status').value;
    const assignee = document.getElementById('agent-assignee').value || null;
    const result = document.getElementById('agent-result');
    const save = document.getElementById('agent-save');
    if (status === ticket.status && assignee === ticket.assignee) {
      result.innerHTML = alertBox('info', 'No changes to save.');
      return;
    }
    save.disabled = true;
    save.textContent = 'Saving…';
    result.innerHTML = '';
    simulateRequest({
      onSlow: whileActive(() => {
        result.innerHTML = alertBox(
          'info',
          'The helpdesk service is starting. This can take up to a minute.'
        );
      }),
      onSuccess: whileActive(() => {
        const changes = [];
        if (status !== ticket.status) {
          changes.push(`Status changed to ${STATUS_LABELS[status]}.`);
          ticket.history.push({
            status,
            at: `Today ${timeNow()}`,
            note: `Updated by ${state.session.name}`,
          });
        }
        if (assignee !== ticket.assignee) {
          changes.push(
            assignee ? `Assigned to ${assignee}.` : 'Assignment removed.'
          );
        }
        ticket.status = status;
        ticket.assignee = assignee;
        ticket.updated = `Today ${timeNow()}`;
        viewQueue(ticket.id);
        document.getElementById('agent-result').innerHTML = alertBox(
          'success',
          `Saved. ${changes.join(' ')} Audit event recorded. ${SIM_TAG}`
        );
        document.getElementById('detail-title').focus();
      }),
      onFailure: whileActive((outcome) => {
        save.disabled = false;
        save.textContent = 'Save';
        document.getElementById('agent-status').value = ticket.status;
        document.getElementById('agent-assignee').value = ticket.assignee || '';
        result.innerHTML = alertBox(
          'error',
          failureMessage(outcome, 'update this ticket')
        );
      }),
    });
  });

  const title = document.getElementById('detail-title');
  title.setAttribute('tabindex', '-1');
}

// ----- W-07 knowledge base -----

function viewKnowledge(selected) {
  if (selected) {
    viewArticleEditor(selected === 'new' ? null : findArticle(selected));
    return;
  }
  main.innerHTML = `
    <section aria-labelledby="page-title">
      ${pageHead('Knowledge base', '<a class="btn btn-primary" href="#/knowledge/new">New article</a>')}
      <div id="article-list"></div>
    </section>`;
  const container = document.getElementById('article-list');
  loadList(container, () => {
    const list = showEmptyData() ? [] : articles;
    if (list.length === 0) {
      container.innerHTML = `<div class="empty"><p>No articles yet. Add an approved procedure so the assistant can cite it.</p></div>`;
      return;
    }
    container.innerHTML = `
      <table class="data-table">
        <thead><tr><th scope="col">ID</th><th scope="col">Title</th><th scope="col">Category</th><th scope="col">State</th><th scope="col">Updated</th></tr></thead>
        <tbody>${list
          .map(
            (a) => `<tr>
            <td data-label="ID">${a.id}</td>
            <td data-label="Title"><a href="#/knowledge/${a.id}">${esc(a.title)}</a></td>
            <td data-label="Category">${CATEGORY_LABELS[a.category]}</td>
            <td data-label="State"><span class="badge ${a.published ? 'badge-resolved' : 'badge-draft'}">${a.published ? 'Published' : 'Draft'}</span></td>
            <td data-label="Updated">${esc(a.updated)}</td>
          </tr>`
          )
          .join('')}</tbody>
      </table>`;
  });
}

function viewArticleEditor(article) {
  if (article === undefined) {
    viewMessage('Article not found', "We couldn't find that article.");
    return;
  }
  const categoryOptions = Object.entries(CATEGORY_LABELS)
    .map(
      ([value, label]) =>
        `<option value="${value}" ${article && article.category === value ? 'selected' : ''}>${label}</option>`
    )
    .join('');
  main.innerHTML = `
    <section class="panel narrow" aria-labelledby="page-title">
      <p><a href="#/knowledge">&larr; Knowledge base</a></p>
      ${pageHead(article ? `Edit ${article.id}` : 'New article')}
      <form id="article-form" novalidate>
        <div class="field">
          <label for="article-title">Title *</label>
          <input id="article-title" type="text" value="${article ? esc(article.title) : ''}" aria-describedby="article-title-error" />
          <p id="article-title-error" class="field-error" hidden></p>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="article-category">Category *</label>
            <select id="article-category" aria-describedby="article-category-error"><option value="">Select a category</option>${categoryOptions}</select>
            <p id="article-category-error" class="field-error" hidden></p>
          </div>
          <div class="field">
            <label for="article-source">Source name</label>
            <input id="article-source" type="text" value="${article ? esc(article.source) : ''}" />
          </div>
        </div>
        <div class="field">
          <label for="article-body">Body *</label>
          <textarea id="article-body" rows="8" aria-describedby="article-body-error">${article ? esc(article.body) : ''}</textarea>
          <p id="article-body-error" class="field-error" hidden></p>
        </div>
        <label class="checkbox"><input type="checkbox" id="article-published" ${article && article.published ? 'checked' : ''} /> Published (available to the assistant after indexing)</label>
        <p class="hint">Saving re-indexes this article for search. Use fictional procedures only.</p>
        <div id="article-result"></div>
        <div class="actions end">
          <a class="btn btn-secondary" href="#/knowledge">Cancel</a>
          <button type="submit" class="btn btn-primary" id="article-save">Save</button>
        </div>
      </form>
    </section>`;

  document
    .getElementById('article-form')
    .addEventListener('submit', (event) => {
      event.preventDefault();
      const values = {
        title: document.getElementById('article-title').value.trim(),
        category: document.getElementById('article-category').value,
        source: document.getElementById('article-source').value.trim(),
        body: document.getElementById('article-body').value.trim(),
        published: document.getElementById('article-published').checked,
      };
      setFieldError('article-title', values.title ? '' : 'Enter a title.');
      setFieldError(
        'article-category',
        values.category ? '' : 'Choose a category.'
      );
      setFieldError(
        'article-body',
        values.body ? '' : 'Enter the procedure text.'
      );
      const invalid = document.querySelector(
        '#article-form [aria-invalid="true"]'
      );
      if (invalid) {
        invalid.focus();
        return;
      }

      const save = document.getElementById('article-save');
      const result = document.getElementById('article-result');
      save.disabled = true;
      save.textContent = 'Saving…';
      simulateRequest({
        onSlow: whileActive(() => {
          result.innerHTML = alertBox(
            'info',
            'The helpdesk service is starting. This can take up to a minute.'
          );
        }),
        onSuccess: whileActive(() => {
          let target = article;
          if (!target) {
            target = { id: `KB-${131 + articles.length - 4}` };
            articles.push(target);
          }
          Object.assign(target, values, { updated: 'Today' });
          result.innerHTML = alertBox('info', 'Saved. Indexing for search…');
          setTimeout(
            whileActive(() => {
              save.disabled = false;
              save.textContent = 'Save';
              result.innerHTML = alertBox(
                'success',
                `${target.id} saved and indexed. ${target.published ? 'The assistant can now cite it.' : 'It stays a draft until published.'} ${SIM_TAG}`
              );
            }),
            900
          );
        }),
        onFailure: whileActive((outcome) => {
          save.disabled = false;
          save.textContent = 'Save';
          result.innerHTML = alertBox(
            'error',
            failureMessage(outcome, 'save this article')
          );
        }),
      });
    });
}

// ----- W-08 metrics -----

function viewMetrics() {
  main.innerHTML = `
    <section aria-labelledby="page-title">
      ${pageHead('Support metrics', '<div class="field inline"><label for="metrics-range">Range</label><select id="metrics-range"><option>Last 7 days</option><option>Last 30 days</option></select></div>')}
      <div id="metrics"></div>
    </section>`;
  const container = document.getElementById('metrics');

  function renderMetrics() {
    if (showEmptyData()) {
      container.innerHTML = `<div class="empty"><p>No activity in this period.</p></div>`;
      return;
    }
    const counts = Object.keys(STATUS_LABELS).map((status) => ({
      status,
      count: tickets.filter((t) => t.status === status).length,
    }));
    const max = Math.max(1, ...counts.map((c) => c.count));
    const escalated = tickets.filter((t) => t.escalated).length;
    const sources = [
      ['KB-104', 31],
      ['KB-121', 22],
      ['KB-117', 15],
    ];
    container.innerHTML = `
      <p class="hint">Sample figures for layout review only. ${SIM_TAG}</p>
      <ul class="plain-list stat-grid">
        <li class="stat"><span class="stat-label">Questions asked</span><span class="stat-value">142</span></li>
        <li class="stat"><span class="stat-label">Answered in chat</span><span class="stat-value">61%</span></li>
        <li class="stat"><span class="stat-label">Tickets opened</span><span class="stat-value">${tickets.length}</span></li>
        <li class="stat"><span class="stat-label">Escalated</span><span class="stat-value">${escalated}</span></li>
      </ul>
      <div class="metric-columns">
        <div class="panel">
          <h2>Tickets by status</h2>
          <table class="bar-table">
            <thead><tr><th scope="col">Status</th><th scope="col">Tickets</th></tr></thead>
            <tbody>${counts
              .map(
                (c) =>
                  `<tr><th scope="row">${STATUS_LABELS[c.status]}</th><td><span class="bar" style="width:${(c.count / max) * 100}%"></span> ${c.count}</td></tr>`
              )
              .join('')}</tbody>
          </table>
        </div>
        <div class="panel">
          <h2>Top knowledge sources</h2>
          <table class="bar-table">
            <thead><tr><th scope="col">Article</th><th scope="col">Citations</th></tr></thead>
            <tbody>${sources
              .map(
                ([id, cites]) =>
                  `<tr><th scope="row">${id} ${esc(findArticle(id).title)}</th><td><span class="bar" style="width:${(cites / 31) * 100}%"></span> ${cites}</td></tr>`
              )
              .join('')}</tbody>
          </table>
        </div>
      </div>`;
  }

  document
    .getElementById('metrics-range')
    .addEventListener('change', () => loadList(container, renderMetrics));
  loadList(container, renderMetrics);
}

// ---------- chrome events ----------

function closeNav() {
  document.body.classList.remove('nav-open');
  document.getElementById('nav-toggle').setAttribute('aria-expanded', 'false');
}

// The skip link targets #main, which would otherwise be read as a route.
document.querySelector('.skip-link').addEventListener('click', (event) => {
  event.preventDefault();
  main.focus();
});

document.getElementById('nav-toggle').addEventListener('click', (event) => {
  const open = document.body.classList.toggle('nav-open');
  event.currentTarget.setAttribute('aria-expanded', String(open));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('nav-open')) {
    closeNav();
    document.getElementById('nav-toggle').focus();
  }
});

document.getElementById('sign-out').addEventListener('click', () => {
  state.session = null;
  state.chat = newConversation();
  navigate('/sign-in');
});

document.getElementById('view-as').addEventListener('change', (event) => {
  const email = event.target.value;
  state.session = { email, ...ACCOUNTS[email] };
  state.chat = newConversation();
  navigate(HOME_BY_ROLE[state.session.role]);
});

document.getElementById('empty-data').addEventListener('change', render);

window.addEventListener('hashchange', render);
render();
