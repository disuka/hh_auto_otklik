// background.js - фоновый скрипт расширения для управления автоматизацией

// =============================================================================
// КОНФИГУРАЦИЯ
// =============================================================================
const CONFIG = {
  // --- Настройки приложения ---
  minDelay: 2000,
  maxDelay: 4000,
  maxVacancies: 15,
  doneDelay: 12000,
  excludeKeywords: ['разработчик', 'реклам'],

  // --- Настройки логирования ---
  logUrl: 'http://localhost:8000/api/v1/logs',
  logApiKey: 'secret-key-for-hh-browser',
  logProject: 'my-bot',
  logTimeout: 5000,

  // --- Текст сопроводительного письма ---
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

// =============================================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ СЕССИИ
// =============================================================================
let SESSION_ID = null;
let SESSION_START_TIME = null;

// =============================================================================
// Д1 - ГЕНЕРАЦИЯ ИДЕНТИФИКАТОРА
// =============================================================================
function generateSessionId() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `hh-${hours}${minutes}-${randomPart}`;
}

// =============================================================================
// СЕРВИС ЛОГИРОВАНИЯ
// =============================================================================
async function sendLog(level, message, metadata = {}) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.logTimeout);

    const enrichedMetadata = {
      sessionId: SESSION_ID,
      ...metadata
    };

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
        metadata: enrichedMetadata
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
  } catch (error) {
    console.error('[LOGGER] Ошибка отправки лога: ' + error.message);
  }
}

// =============================================================================
// СЛУШАТЕЛЬ СООБЩЕНИЙ ОТ ИНЖЕКТИРОВАННЫХ СКРИПТОВ
// =============================================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'responseSent') {
    setTimeout(async () => {
      if (sender.tab && sender.tab.id) {
        try {
          await chrome.tabs.remove(sender.tab.id);
          await sendLog('info', 'Закрыта вкладка вакансии после отправки отклика', { tabId: sender.tab.id });
        } catch (error) {
          await sendLog('error', 'Ошибка при закрытии вкладки', { tabId: sender.tab.id, error: error.message });
        }
      }
    }, CONFIG.doneDelay);
  }

  if (message.action === 'closeTab') {
    setTimeout(async () => {
      if (sender.tab && sender.tab.id) {
        try {
          await chrome.tabs.remove(sender.tab.id);
          await sendLog('info', 'Закрыта вкладка вакансии', { tabId: sender.tab.id, reason: message.reason });
        } catch (error) {
          await sendLog('error', 'Ошибка при закрытии вкладки', { tabId: sender.tab.id, error: error.message });
        }
      }
    }, 2000);
  }
});

// =============================================================================
// УТИЛИТЫ
// =============================================================================
function randomDelay() {
  const delay = Math.floor(Math.random() * (CONFIG.maxDelay - CONFIG.minDelay + 1)) + CONFIG.minDelay;
  return new Promise(resolve => setTimeout(resolve, delay));
}

function waitForTabLoad(tabId) {
  return new Promise(resolve => {
    const listener = (tabId2, changeInfo, tab) => {
      if (tabId2 === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// =============================================================================
// ПРАВИЛО ВЫБОРА РЕЗЮМЕ (ПВР1)
// =============================================================================
function selectResumeByRule(vacancyTitle) {
  const title = vacancyTitle.toLowerCase();

  if (title.includes('отдела')) return 'Руководитель отдела';

  if (title.includes('руководитель направления') ||
      title.includes('деливери') ||
      title.includes('delivery') ||
      title.includes('релиз')) {
    return 'Руководитель направления';
  }

  if (title.includes('аналитик') ||
      title.includes('системн') ||
      title.includes('анализа')) {
    return 'Аналитик';
  }

  if (title.includes('проект') ||
      title.includes('менеджер') ||
      title.includes('руководитель проект') ||
      title.includes('project manager')) {
    return 'Руководитель проектов';
  }

  return 'Руководитель направления';
}

// =============================================================================
// ОСНОВНАЯ ФУНКЦИЯ АВТОМАТИЗАЦИИ
// =============================================================================
async function startAutomation() {
  // --- Д1: Инициализация ---
  SESSION_ID = generateSessionId();
  SESSION_START_TIME = Date.now();
  console.log('SESSION_ID: ' + SESSION_ID);

  // Вывод настроек в лог
  const settingsMetadata = {
    minDelay: CONFIG.minDelay,
    maxDelay: CONFIG.maxDelay,
    maxVacancies: CONFIG.maxVacancies,
    doneDelay: CONFIG.doneDelay,
    excludeKeywords: CONFIG.excludeKeywords,
    logUrl: CONFIG.logUrl,
    logProject: CONFIG.logProject,
    coverLetterLength: CONFIG.coverLetter.length
  };
  await sendLog('info', 'начало', settingsMetadata);

  try {
    // --- Д2: Проверка авторизации ---
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const authResult = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: () => {
        const profileElement = document.querySelector('[data-qa="mainmenu_profileAndResumes"]');
        if (!profileElement) return { success: false };
        return { success: true };
      }
    });

    if (!authResult[0].result.success) {
      // --- Д4: Не залогинен ---
      await sendLog('error', 'не залогинен', { url: currentTab.url });
      return;
    }

    // --- Д3: Залогинен ---
    await sendLog('info', 'залогинен', { url: currentTab.url });

    // --- Шаг 2: Переход на vidnoe.hh.ru ---
    await randomDelay();
    const vidnoeTab = await chrome.tabs.create({
      url: 'https://vidnoe.hh.ru/?hhtmFrom=main',
      active: true
    });
    await waitForTabLoad(vidnoeTab.id);
    await randomDelay();

    // --- Шаг 3: Переход к списку резюме ---
    await randomDelay();
    const resumeUrl = 'https://vidnoe.hh.ru/applicant/resumes';
    const resumeTab = await chrome.tabs.create({ url: resumeUrl, active: true });
    await waitForTabLoad(resumeTab.id);
    await randomDelay();

    // --- Шаг 4: Получение списка резюме ---
    const resumeListResult = await chrome.scripting.executeScript({
      target: { tabId: resumeTab.id },
      func: () => {
        const resumeData = [];
        const resumeCards = document.querySelectorAll('[data-qa^="resume-card-link-"]');

        resumeCards.forEach(card => {
          const href = card.href || '';
          if (!href.includes('/resume/')) return;

          const titleEl = card.querySelector('[data-qa="resume-title"]');
          const titleContentEl = titleEl ? titleEl.querySelector('[data-qa="cell-text-content"]') : null;
          const title = titleContentEl ? titleContentEl.textContent.trim() : '';

          if (title && !resumeData.includes(title)) {
            resumeData.push(title);
          }
        });

        if (resumeData.length === 0) {
          const allLinks = document.querySelectorAll('a[href*="/resume/"]');
          allLinks.forEach(link => {
            const title = link.textContent.trim().split('\n')[0].substring(0, 100);
            if (title && title.length > 2 && !resumeData.includes(title)) {
              resumeData.push(title);
            }
          });
        }

        return resumeData;
      }
    });

    const resumeList = resumeListResult[0].result;
    await sendLog('info', 'Получен список резюме', { count: resumeList.length, resumes: resumeList });

    if (resumeList.length === 0) {
      await sendLog('error', 'не нашел ни одного резюме', { url: resumeTab.url });
      return;
    }

    // --- Обрабатываем каждое резюме ---
    for (let r = 0; r < resumeList.length; r++) {
      const currentResumeName = resumeList[r];
      await sendLog('info', '=== Обработка резюме ===', { index: r + 1, total: resumeList.length, name: currentResumeName });

      const resumeLinkResult = await chrome.scripting.executeScript({
        target: { tabId: resumeTab.id },
        func: (resumeName) => {
          const resumeLinks = document.querySelectorAll('a');
          for (const link of resumeLinks) {
            if (link.textContent.toLowerCase().includes(resumeName.toLowerCase()) && link.href.includes('/resume/')) {
              return link.href;
            }
          }
          return null;
        },
        args: [currentResumeName]
      });

      const currentResumeUrl = resumeLinkResult[0].result;
      if (!currentResumeUrl) {
        await sendLog('warn', 'Не нашел ссылку на резюме', { resumeName: currentResumeName });
        continue;
      }

      const currentResumeTab = await chrome.tabs.create({
        url: currentResumeUrl,
        active: true
      });
      await waitForTabLoad(currentResumeTab.id);
      await randomDelay();

      const vacancyLinkResult = await chrome.scripting.executeScript({
        target: { tabId: currentResumeTab.id },
        func: () => {
          const allLinks = document.querySelectorAll('a');
          for (const link of allLinks) {
            const text = link.textContent.toLowerCase();
            const href = link.href || '';
            if (text.includes('подобрали для вас') && text.includes('подходящие вакансии')) {
              return href;
            }
            if (href.includes('/search/vacancy') && href.includes('resume=')) {
              return href;
            }
          }
          return null;
        }
      });

      const vacancyLink = vacancyLinkResult[0].result;
      if (!vacancyLink) {
        await sendLog('warn', 'Ссылка на вакансии не найдена', { resumeName: currentResumeName });
        await chrome.tabs.remove(currentResumeTab.id);
        continue;
      }

      const vacancyTab = await chrome.tabs.create({
        url: vacancyLink,
        active: true
      });
      await waitForTabLoad(vacancyTab.id);
      await randomDelay();

      // --- Шаг 7: Получаем список вакансий ---
      const vacanciesResult = await chrome.scripting.executeScript({
        target: { tabId: vacancyTab.id },
        func: (maxVacancies) => {
          const vacancies = [];
          const vacancyCards = document.querySelectorAll('div[data-qa="vacancy-serp__vacancy"]');

          for (const card of vacancyCards) {
            if (vacancies.length >= maxVacancies) break;

            const link = card.querySelector('a[data-qa="serp-item__title"], a[href*="/vacancy/"]');
            if (!link) continue;

            const href = link.href || '';
            if (!href.includes('/vacancy/') || href.includes('click') || href.includes('hot')) {
              continue;
            }

            let title = '';
            const titleElement = card.querySelector('[data-qa="serp-item__title"], .vacancy-title, .bloko-header-section-3');
            if (titleElement) {
              title = titleElement.textContent.trim();
            } else {
              title = link.textContent.trim();
            }

            if (title && title.length > 5) {
              vacancies.push({ href, title });
            }
          }
          return vacancies;
        },
        args: [CONFIG.maxVacancies]
      });

      const vacancies = vacanciesResult[0].result;

      const uniqueVacancies = [];
      const seenHrefs = new Set();
      for (const v of vacancies) {
        if (!seenHrefs.has(v.href)) {
          seenHrefs.add(v.href);
          uniqueVacancies.push(v);
        }
      }

      const vacanciesToProcess = uniqueVacancies.slice(0, CONFIG.maxVacancies);
      await sendLog('info', 'Найдено уникальных вакансий', { count: vacanciesToProcess.length, resumeName: currentResumeName });

      // --- Обрабатываем каждую вакансию ---
      for (let i = 0; i < vacanciesToProcess.length; i++) {
        const vacancy = vacanciesToProcess[i];

        const titleLower = vacancy.title.toLowerCase();
        const shouldExclude = CONFIG.excludeKeywords.some(keyword => titleLower.includes(keyword.toLowerCase()));

        if (shouldExclude) {
          await sendLog('info', vacancy.title + ' =пропущено= в соответствии с шаг7 ТЗ');
          continue;
        }

        await sendLog('info', 'Обрабатываю вакансию', { index: i + 1, total: vacanciesToProcess.length, title: vacancy.title, url: vacancy.href });

        const selectedResume = selectResumeByRule(vacancy.title);
        await sendLog('info', 'Выбрано резюме', { selectedResume, vacancyTitle: vacancy.title });

        const vacancyDetailTab = await chrome.tabs.create({
          url: vacancy.href,
          active: false
        });
        await sendLog('info', 'Создана вкладка для вакансии', { tabId: vacancyDetailTab.id });

        await waitForTabLoad(vacancyDetailTab.id);
        await new Promise(resolve => setTimeout(resolve, 3000));

        // --- Обрабатываем вакансию ---
        try {
          let clickResult;
          try {
            clickResult = await chrome.scripting.executeScript({
              target: { tabId: vacancyDetailTab.id },
              func: () => {
                const respondButtons = document.querySelectorAll('button, a');
                let respondButton = null;

                for (const btn of respondButtons) {
                  const text = btn.textContent.toLowerCase().trim();
                  if (text === 'откликнуться') {
                    respondButton = btn;
                    break;
                  }
                }

                if (!respondButton) {
                  console.log('КНОПКА_ОТКЛИКНУТЬСЯ_НЕ_НАЙДЕНА');
                  chrome.runtime.sendMessage({ action: 'closeTab', reason: 'кнопка откликнуться не найдена' });
                  return false;
                }

                console.log('кнопку =откликнуться= нашел, сейчас буду нажимать');
                respondButton.click();
                console.log('после нажатия на =откликнуться= все загружено успешно');
                return true;
              }
            });

            if (!clickResult || !clickResult[0]) {
              await sendLog('error', 'Ошибка: clickResult пустой', { tabId: vacancyDetailTab.id });
              await chrome.tabs.remove(vacancyDetailTab.id);
              continue;
            }

            if (!clickResult[0].result) {
              await sendLog('warn', 'Не удалось нажать кнопку откликнуться', { tabId: vacancyDetailTab.id });
              await chrome.tabs.remove(vacancyDetailTab.id);
              continue;
            }
          } catch (injectError) {
            await sendLog('error', 'Ошибка при инжекции скрипта', { tabId: vacancyDetailTab.id, error: injectError.message });
            await chrome.tabs.remove(vacancyDetailTab.id);
            continue;
          }

          await new Promise(resolve => setTimeout(resolve, 5000));

          let tabInfo;
          try {
            tabInfo = await chrome.tabs.get(vacancyDetailTab.id);
          } catch (error) {
            await sendLog('info', 'Вкладка уже закрыта', { tabId: vacancyDetailTab.id });
            continue;
          }

          if (tabInfo.url.includes('startedWithQuestion=false')) {
            await sendLog('info', 'вакансия содержит дополнительные вопросы', { tabId: vacancyDetailTab.id, url: tabInfo.url });
            await chrome.tabs.remove(vacancyDetailTab.id);
            continue;
          }

          try {
            await chrome.scripting.executeScript({
              target: { tabId: vacancyDetailTab.id },
              func: (params) => {
                const { resumeName, coverLetter } = params;

                console.log('=Это новая вакансия=. Начинаю выполнять МОР1');

                const allDialogs = document.querySelectorAll('[role="dialog"]');

                if (allDialogs.length !== 1) {
                  console.log('модальное не найдено. Останов');
                  chrome.runtime.sendMessage({ action: 'closeTab', reason: 'модальное окно не определено' });
                  return;
                }

                const modal = allDialogs[0];
                console.log('открылось модальное');

                const resumeElements = modal.querySelectorAll('[data-qa="resume-title"]');
                if (resumeElements.length !== 1) {
                  console.log('в модальном окне больше одного элемента выбора вакансии. останов.');
                  chrome.runtime.sendMessage({ action: 'closeTab', reason: 'больше одного элемента выбора резюме' });
                  return;
                }

                const respondButtonInModal = modal.querySelector('[data-qa="vacancy-response-submit-popup"]');
                if (!respondButtonInModal) {
                  console.log('условие на нахождение элемента =откликнуться= в диалоговом окне не выполнено');
                  chrome.runtime.sendMessage({ action: 'closeTab', reason: 'кнопка откликнуться не найдена в модальном окне' });
                  return;
                }

                const addLetterBtn = modal.querySelector('[data-qa="add-cover-letter"]');
                const existingTextArea = modal.querySelector('textarea[data-qa="vacancy-response-popup-form-letter-input"]');

                let modalType = null;

                if (addLetterBtn && !respondButtonInModal.disabled) {
                  modalType = 'simple1';
                  console.log('Тип модального окна: simple1');
                } else if (existingTextArea && !addLetterBtn && respondButtonInModal.disabled) {
                  const textAreaValue = existingTextArea.value || '';
                  const textAreaPlaceholder = existingTextArea.placeholder || '';
                  const textareaWrapper = existingTextArea.closest('[data-qa="textarea-wrapper"]');
                  const label = textareaWrapper ? textareaWrapper.querySelector('label') : null;
                  const labelText = label ? label.textContent : '';

                  if (textAreaValue.includes('Сопроводительное письмо') ||
                      textAreaPlaceholder.includes('Сопроводительное письмо') ||
                      labelText.includes('Сопроводительное письмо')) {
                    modalType = 'simple2';
                    console.log('Тип модального окна: simple2');
                  }
                }

                if (!modalType) {
                  console.log('=тип модального окна не определен=, останов');
                  chrome.runtime.sendMessage({ action: 'closeTab', reason: 'тип модального окна не определен' });
                  return;
                }

                if (modalType === 'simple1') {
                  const allInputsInModal = modal.querySelectorAll('input, textarea');
                  const visibleInputs = Array.from(allInputsInModal).filter(input => {
                    const type = input.type || '';
                    const name = input.name || '';
                    return type !== 'hidden' && !name.includes('_xsrf') && !name.includes('csrf');
                  });

                  if (visibleInputs.length > 0) {
                    console.log('есть непонятные поля ввода');
                    chrome.runtime.sendMessage({ action: 'closeTab', reason: 'есть дополнительные вопросы' });
                    return;
                  }
                }

                console.log('Ищу резюме: ' + resumeName);

                const resumeCard = modal.querySelector('[data-qa="resume-title"]');
                if (resumeCard) {
                  const cardElement = resumeCard.closest('[role="button"][tabindex="0"], button, [tabindex="0"]');
                  if (cardElement) {
                    cardElement.click();

                    setTimeout(() => {
                      let allResumeElements = document.querySelectorAll('[data-qa="resume-title"]');
                      const uniqueResumes = [];
                      const seenTitles = new Set();

                      for (let i = 0; i < allResumeElements.length; i++) {
                        const resumeEl = allResumeElements[i];
                        const titleElement = resumeEl.querySelector('[data-qa="cell-text-content"]');
                        if (titleElement) {
                          const title = titleElement.textContent.trim();
                          if (!seenTitles.has(title)) {
                            seenTitles.add(title);
                            uniqueResumes.push({ element: resumeEl, title: title });
                          }
                        }
                      }

                      if (uniqueResumes.length === 0) {
                        console.log('Список резюме не открылся');
                        chrome.runtime.sendMessage({ action: 'closeTab', reason: 'список резюме не открылся' });
                        return;
                      }

                      console.log('Найдено резюме в списке: ' + uniqueResumes.length);
                      console.log('Уникальных резюме: ' + uniqueResumes.length);

                      let targetResume = null;
                      const searchName = resumeName.toLowerCase();

                      for (let i = 0; i < uniqueResumes.length; i++) {
                        const resume = uniqueResumes[i];
                        const title = resume.title.toLowerCase();
                        console.log('Резюме ' + (i + 1) + ': ' + resume.title);

                        if (title.includes(searchName) || searchName.includes(title)) {
                          targetResume = resume.element;
                          console.log('Нашёл подходящее резюме: ' + resume.title);
                        }
                      }

                      if (targetResume) {
                        const targetCard = targetResume.closest('[role="button"][tabindex="0"], button, [tabindex="0"]');
                        if (targetCard) {
                          targetCard.click();
                          console.log('Выбрано резюме: ' + targetResume.querySelector('[data-qa="cell-text-content"]').textContent);
                        }
                      }
                    }, 1000);
                  }
                }

                setTimeout(() => {
                  if (modalType === 'simple2') {
                    const textArea = modal.querySelector('textarea[data-qa="vacancy-response-popup-form-letter-input"]');
                    if (textArea) {
                      console.log('Нашёл поле для сопроводительного письма');
                      textArea.value = coverLetter;
                      textArea.dispatchEvent(new Event('input', { bubbles: true }));
                      textArea.dispatchEvent(new Event('change', { bubbles: true }));
                      textArea.dispatchEvent(new Event('blur', { bubbles: true }));
                      textArea.focus();
                      setTimeout(() => {
                        textArea.blur();
                        console.log('Вставил сопроводительное письмо');

                        setTimeout(() => {
                          const submitButton = modal.querySelector('[data-qa="vacancy-response-submit-popup"]');
                          if (submitButton && !submitButton.disabled) {
                            submitButton.click();
                            console.log('Отправляю отклик');
                            chrome.runtime.sendMessage({ action: 'responseSent' });
                          } else {
                            console.log('Кнопка отправки не найдена или заблокирована');
                            chrome.runtime.sendMessage({ action: 'closeTab', reason: 'кнопка отправки не найдена' });
                          }
                        }, 1000);
                      }, 100);
                    } else {
                      console.log('Поле для сопроводительного письма не найдено после нажатия кнопки');
                      chrome.runtime.sendMessage({ action: 'closeTab', reason: 'поле не найдено' });
                    }
                    return;
                  }

                  if (!addLetterBtn) {
                    console.log('Кнопка \'Добавить сопроводительное\' не найдена');
                    chrome.runtime.sendMessage({ action: 'closeTab', reason: 'кнопка добавить не найдена' });
                    return;
                  }

                  console.log('Нажимаю кнопку \'Добавить сопроводительное\'');
                  addLetterBtn.click();

                  setTimeout(() => {
                    let textArea = modal.querySelector('textarea[data-qa="vacancy-response-popup-form-letter-input"]');

                    if (!textArea) {
                      textArea = document.querySelector('textarea[data-qa="vacancy-response-popup-form-letter-input"]');
                    }

                    if (textArea) {
                      console.log('Нашёл поле для сопроводительного письма');
                      textArea.value = coverLetter;
                      textArea.dispatchEvent(new Event('input', { bubbles: true }));
                      textArea.dispatchEvent(new Event('change', { bubbles: true }));
                      textArea.dispatchEvent(new Event('blur', { bubbles: true }));
                      textArea.focus();
                      setTimeout(() => {
                        textArea.blur();
                        console.log('Вставил сопроводительное письмо');

                        setTimeout(() => {
                          const submitButton = modal.querySelector('[data-qa="vacancy-response-submit-popup"]');
                          if (submitButton && !submitButton.disabled) {
                            submitButton.click();
                            console.log('Отправляю отклик');
                            chrome.runtime.sendMessage({ action: 'responseSent' });
                          } else {
                            console.log('Кнопка отправки не найдена или заблокирована');
                            chrome.runtime.sendMessage({ action: 'closeTab', reason: 'кнопка отправки не найдена' });
                          }
                        }, 1000);
                      }, 100);
                    } else {
                      console.log('Поле для сопроводительного письма не найдено после нажатия кнопки');
                      chrome.runtime.sendMessage({ action: 'closeTab', reason: 'поле не найдено' });
                    }
                  }, 1500);
                }, 2000);
              },
              args: [{ resumeName: selectedResume, coverLetter: CONFIG.coverLetter }]
            });
          } catch (error) {
            await sendLog('error', 'Ошибка при инжектировании скрипта модального окна', { tabId: vacancyDetailTab.id, error: error.message });
            await chrome.tabs.remove(vacancyDetailTab.id);
          }
        } catch (error) {
          await sendLog('error', 'Ошибка при обработке вакансии', { tabId: vacancyDetailTab.id, error: error.message });
          try {
            await chrome.tabs.remove(vacancyDetailTab.id);
          } catch (e) {
            // игнорируем
          }
        }
      }

      await chrome.tabs.remove(vacancyTab.id);
      await chrome.tabs.remove(currentResumeTab.id);
      await sendLog('info', 'Закрыты вкладки для резюме', { resumeName: currentResumeName });
    }

    // --- Д999: Штатный конец работы ---
    const totalTime = Date.now() - SESSION_START_TIME;
    await sendLog('info', 'штатный конец работы', { totalTimeMs: totalTime, totalTimeSec: Math.round(totalTime / 1000) });

  } catch (error) {
    await sendLog('error', 'Критическая ошибка', { error: error.message, stack: error.stack });
  }
}

// =============================================================================
// ЗАПУСК
// =============================================================================
chrome.action.onClicked.addListener(async (tab) => {
  console.log('=НАЧАЛО=. был клик по иконке');
  await startAutomation();
});
