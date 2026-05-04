// background.js

const CONFIG = {
  logUrl: 'http://localhost:8000/api/v1/logs',
  logApiKey: 'secret-key-for-hh-browser',
  logProject: 'my-bot',
  minDelaySec: 2,
  maxDelaySec: 5,
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
Вихров Денис Валерьевич. for.vikhrov@mail.ru
`
};

let SESSION_ID = null;
let SESSION_START_TIME = null;

function generateSessionId() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `hh-${hours}:${minutes}-${randomPart}`;
}

function randomDelay() {
  const minMs = CONFIG.minDelaySec * 1000;
  const maxMs = CONFIG.maxDelaySec * 1000;
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function sendLog(level, message, metadata = {}) {
  const response = await fetch(CONFIG.logUrl, {
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
  if (response.status !== 201) {
    throw new Error('Logger returned status ' + response.status);
  }
}

async function startAutomation() {
  try {
    SESSION_ID = generateSessionId();
    SESSION_START_TIME = Date.now();

    const settingsMetadata = {
      logUrl: CONFIG.logUrl,
      logProject: CONFIG.logProject,
      logApiKey: CONFIG.logApiKey,
      coverLetter: CONFIG.coverLetter,
      minDelaySec: CONFIG.minDelaySec,
      maxDelaySec: CONFIG.maxDelaySec
    };
    await sendLog('info', 'начало', settingsMetadata);

    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const authResult = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: () => {
        const profileElement = document.querySelector('[data-qa="mainmenu_profileAndResumes"]');
        const isClickable = profileElement && !profileElement.disabled;
        const href = profileElement ? profileElement.href || profileElement.closest('a')?.href || null : null;
        return { success: isClickable, href: href };
      }
    });

    if (!authResult[0].result.success) {
      await sendLog('error', 'не залогинен', { url: currentTab.url });
      return;
    }

    await sendLog('info', 'залогинен', { url: currentTab.url });

    const resumeHref = authResult[0].result.href;
    if (resumeHref) {
      await randomDelay();
      await chrome.tabs.update(currentTab.id, { url: resumeHref });
      await new Promise(resolve => {
        const listener = (tabId, changeInfo) => {
          if (tabId === currentTab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
      const updatedTab = await chrome.tabs.get(currentTab.id);
      await sendLog('info', 'переход на резюме', { url: updatedTab.url });

      // --- Д5: Сбор резюме ---
      const resumeDataResult = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: () => {
          const cards = document.querySelectorAll('[data-qa="resume"]');
          const resumes = [];

          cards.forEach(card => {
            // title
            const titleEl = card.querySelector('[data-qa="resume-title"] [data-qa="cell-text-content"]');
            const title = titleEl ? titleEl.textContent.trim() : '';

            // salary
            const salaryEl = card.querySelector('[data-qa="title-description"] [data-qa="cell-text-content"]');
            let salary = 0;

            if (salaryEl) {
              const salaryRaw = salaryEl.textContent.trim();
              if (!salaryRaw.startsWith('Уровень дохода не указан')) {
                const match = salaryRaw.match(/([\d\s]+)\s*₽/);
                if (match) {
                  const numStr = match[1].replace(/\s/g, '');
                  salary = parseInt(numStr, 10);
                }
              }
            }

            // views
            let views1 = 0;
            let views2 = 0;

            const viewsLink = card.querySelector('a[data-qa="count-new-views"]');
            if (viewsLink) {
              const countContainer = viewsLink.querySelector('[class*="count--"]');
              if (countContainer) {
                const accentEl = countContainer.querySelector('[class*="magritte-text_style-accent"]');
                const positiveEl = countContainer.querySelector('[class*="magritte-text_style-positive"]');

                if (accentEl) {
                  const accentText = accentEl.textContent.trim();
                  if (accentText === '–') {
                    views1 = 0;
                    views2 = 0;
                  } else {
                    views1 = parseInt(accentText.replace(/\s/g, ''), 10) || 0;
                    if (positiveEl) {
                      const positiveText = positiveEl.textContent.trim();
                      views2 = parseInt(positiveText.replace(/[^\d]/g, ''), 10) || 0;
                    } else {
                      views2 = 0;
                    }
                  }
                }
              }
            }

            // resurl
            const resurlEl = card.querySelector('a[data-qa^="resume-card-link-"]');
            const resurl = resurlEl ? resurlEl.href : '';

            resumes.push({ title, resurl, salary, views1, views2 });
          });

          return resumes;
        }
      });

      const resumes = resumeDataResult[0].result;
      await sendLog('info', 'найдено ' + resumes.length + ' резюме', { resumes: resumes });

      // --- Д6: Цикл по всем резюме ---
      for (let i = 0; i < resumes.length; i++) {
        const resume = resumes[i];
        if (!resume.resurl) continue;

        await randomDelay();
        const resumeTab = await chrome.tabs.create({ url: resume.resurl, active: false });
        await new Promise(resolve => {
          const listener = (tabId, changeInfo) => {
            if (tabId === resumeTab.id && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });
        await sendLog('info', 'открыто резюме ' + (i + 1), { title: resume.title, url: resume.resurl });
      }
    }

    const totalTimeMs = Date.now() - SESSION_START_TIME;
    const totalSeconds = Math.floor(totalTimeMs / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    const totalTimeFormatted = `${hours}:${minutes}:${seconds}`;
    await sendLog('info', 'штатный конец работы', { totalTime: totalTimeFormatted });
  } catch (error) {
    console.error('[STOP] ' + error.message);
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  console.log('=НАЧАЛО=. был клик по иконке');
  await startAutomation();
  console.log('=КОНЕЦ=');
});
