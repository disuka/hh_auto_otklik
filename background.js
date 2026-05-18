// background.js
const DEFAULT_SETTINGS = {
  minDelaySec: 1,
  maxDelaySec: 5,
  maxPages: 2,                       // количество страниц поиска для обработки
  logUrl: 'http://localhost:8000/api/v1/logs',
  healthUrl: 'http://localhost:8000/health',
  apiKey: 'secret-key-for-hh-browser',
  project: 'my-bot',
  coverLetter: `Уважаемая команда!
Я ищу возможность применить свой 14-летний опыт в ИТ (включая 10 лет в Альфа-Банке) в новом проекте, где смогу совместить управленческие, архитектурные и технические задачи. Мне интересна смена предметной области, я открыт к новому и быстро учусь.

Что важно для меня в работе: видеть результат, влиять на продукт, избегать рутины через автоматизацию. Я проактивен и предлагаю решения на этапе оценки, а не жду проблем.

Мои сильные стороны, не отражённые в резюме:
Создаю личные проекты для прокачки навыков: ботов для Telegram на Python (библиотека Telethon), REST-сервисы на FastAPI (сервис логирования в PostgreSQL, всё в Docker). Это помогает понимать разработчиков и предлагать работающие архитектуры.
Администрирую серверы на FreeBSD (Nginx, VPN, почта), настраиваю домашние веб-приложения — благодаря этому легко нахожу общий язык с DevOps.
Активно использую AI-инструменты (KODA, DeepSeek, ChatGPT, GigaCode) для ускорения кодинга и изучения трендов. Регулярно читаю Хабр и LinkedIn, слежу за event-driven архитектурами и агентным ИИ.
Английский — чтение технической документации со словарём, в голосовых совещаниях не участвую.

Организационно: военный билет есть, Москва, к метро не привязан — готова любая станция в пределах МКАД. Желаемая зарплата — 300 000 рублей на руки. Рассматриваю гибрид, на испытательный срок — офис.

Буду рад обсудить, как мой опыт и подход помогут вашим бизнес-целям.
Спасибо за внимание!
Вихров Денис Валерьевич. for.vikhrov@mail.ru`
};

let currentSessionId = null;
let currentSettings = null;

// Функция отправки лога
async function sendLog(level, message, metadata = {}) {
  if (!currentSettings) {
    console.error('Settings not initialized');
    throw new Error('Settings not initialized');
  }
  const logEntry = {
    project: currentSettings.project,
    level,
    message,
    timestamp: new Date().toISOString(),
    metadata: {
      sessionId: currentSessionId,
      ...metadata
    }
  };
  try {
    const response = await fetch(currentSettings.logUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': currentSettings.apiKey
      },
      body: JSON.stringify(logEntry)
    });
    if (response.status !== 201) {
      throw new Error(`Log server returned ${response.status}`);
    }
  } catch (err) {
    console.error('Logging failed:', err);
    chrome.runtime.sendMessage({ type: 'LOG_ERROR', error: err.message });
    throw err;
  }
}

async function checkLogServerHealth() {
  try {
    const response = await fetch(currentSettings.healthUrl);
    return response.ok;
  } catch {
    return false;
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || !tab.url.includes('hh.ru')) {
    console.warn('Расширение работает только на hh.ru');
    return;
  }

  const { hhState, hhStateTimestamp } = await chrome.storage.local.get(['hhState', 'hhStateTimestamp']);
  const now = Date.now();
  const twoMinutes = 120000;

  // Если процесс висит дольше 2 минут – сбрасываем
  if (hhState && hhState !== 'finished' && hhState !== 'error' && hhStateTimestamp && (now - hhStateTimestamp) > twoMinutes) {
    console.log('Процесс завис, сбрасываем состояние');
    await chrome.storage.local.remove(['hhState', 'sessionId', 'hhStateTimestamp']);
  } else if (hhState && hhState !== 'finished' && hhState !== 'error') {
    console.log('Процесс уже запущен');
    return;
  }

  // генерация sessionId
  const nowDate = new Date();
  const hours = nowDate.getHours().toString().padStart(2, '0');
  const minutes = nowDate.getMinutes().toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8);
  currentSessionId = `session_${hours}:${minutes}_${random}`;
  currentSettings = DEFAULT_SETTINGS;

  const isHealthy = await checkLogServerHealth();
  if (!isHealthy) {
    console.error('Сервер логов недоступен');
    await chrome.storage.local.set({ hhState: 'error', errorMessage: 'Log server unavailable' });
    return;
  }

  await chrome.storage.local.set({
    sessionId: currentSessionId,
    settings: currentSettings,
    hhState: 'check_login',
    errorMessage: null,
    hhStateTimestamp: Date.now()
  });

  await chrome.tabs.reload(tab.id);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LOG') {
    sendLog(message.level, message.message, message.metadata)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.type === 'GET_STATE') {
    if (!currentSettings) {
      chrome.storage.local.get(['settings', 'sessionId']).then((stored) => {
        if (stored.settings && stored.sessionId) {
          currentSettings = stored.settings;
          currentSessionId = stored.sessionId;
        }
        sendResponse({
          settings: currentSettings,
          sessionId: currentSessionId,
          hhState: null
        });
      });
      return true;
    } else {
      sendResponse({
        settings: currentSettings,
        sessionId: currentSessionId,
        hhState: null
      });
      return false;
    }
  }
});