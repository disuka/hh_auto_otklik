// background.js

const CONFIG = {
  logUrl: 'http://localhost:8000/api/v1/logs',
  logApiKey: 'secret-key-for-hh-browser',
  logProject: 'my-bot'
};

let SESSION_ID = null;
let SESSION_START_TIME = null;

function generateSessionId() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `hh-${hours}${minutes}-${randomPart}`;
}

async function sendLog(level, message, metadata = {}) {
  try {
    await fetch(CONFIG.logUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': CONFIG.logApiKey
      },
      body: JSON.stringify({
        project: CONFIG.logProject,
        level: level,
        message: message,
        timestamp: new Date().toISOString(),
        metadata: {
          sessionId: SESSION_ID,
          ...metadata
        }
      })
    });
  } catch (error) {
    console.error('[LOGGER] ' + error.message);
  }
}

async function startAutomation() {
  SESSION_ID = generateSessionId();
  SESSION_START_TIME = Date.now();

  const settingsMetadata = {
    logUrl: CONFIG.logUrl,
    logProject: CONFIG.logProject,
    logTimeout: CONFIG.logTimeout
  };
  await sendLog('info', 'начало', settingsMetadata);

  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const authResult = await chrome.scripting.executeScript({
    target: { tabId: currentTab.id },
    func: () => {
      const profileElement = document.querySelector('[data-qa="mainmenu_profileAndResumes"]');
      return { success: !!profileElement };
    }
  });

  if (!authResult[0].result.success) {
    await sendLog('error', 'не залогинен', { url: currentTab.url });
    return;
  }

  await sendLog('info', 'залогинен', { url: currentTab.url });

  const totalTime = Date.now() - SESSION_START_TIME;
  await sendLog('info', 'штатный конец работы', { totalTimeMs: totalTime });
}

chrome.action.onClicked.addListener(async (tab) => {
  console.log('=НАЧАЛО=. был клик по иконке');
  await startAutomation();
});
