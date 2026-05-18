// main.js
(async () => {
  const localState = await chrome.storage.local.get(['hhState', 'errorMessage']);
  let hhState = localState.hhState;

  if (!hhState || hhState === 'finished' || hhState === 'error') {
    return;
  }

  let settings, sessionId;
  try {
    const state = await new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'GET_STATE' }, resolve);
    });
    settings = state.settings;
    sessionId = state.sessionId;
  } catch (err) {
    console.error('Failed to get state from background:', err);
    await chrome.storage.local.set({ hhState: 'error', errorMessage: 'Background communication failed' });
    return;
  }

  if (!settings) {
    console.error('Settings not initialized. Please click extension icon again.');
    await chrome.storage.local.set({ hhState: 'error', errorMessage: 'Settings not initialized' });
    return;
  }

  async function sendLog(level, message, metadata = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'LOG',
        level,
        message,
        metadata
      }, (response) => {
        if (response && response.success) {
          resolve();
        } else {
          reject(new Error(response?.error || 'Log send failed'));
        }
      });
    });
  }

  const randomDelay = () => {
    const min = settings.minDelaySec * 1000;
    const max = settings.maxDelaySec * 1000;
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    return new Promise(resolve => setTimeout(resolve, delay));
  };

  const waitForElement = (selector, timeout = 10000) => {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found`));
      }, timeout);
    });
  };

  // Прокрутка до пагинации (только для загрузки всех карточек на странице)
  const scrollUntilPagination = async () => {
    let paginationBlock = document.querySelector('[data-qa="pager-block"]');
    let scrollAttempts = 0;
    const maxAttempts = 30;

    while (!paginationBlock && scrollAttempts < maxAttempts) {
      window.scrollBy(0, window.innerHeight);
      await randomDelay();
      paginationBlock = document.querySelector('[data-qa="pager-block"]');
      scrollAttempts++;
    }
    await randomDelay();
  };

  const parseSalary = (salaryText) => {
    if (!salaryText || salaryText.includes('Уровень дохода не указан')) return 0;
    const match = salaryText.match(/([\d\s]+)\s*₽/);
    if (!match) return 0;
    return parseInt(match[1].replace(/\s/g, ''), 10);
  };

  const parseViews = (card) => {
    const viewsLink = card.querySelector('a[data-qa="count-new-views"]');
    if (!viewsLink) return { views1: 0, views2: 0 };
    const countContainer = viewsLink.querySelector('[class*="count--"]');
    if (!countContainer) return { views1: 0, views2: 0 };
    const accentEl = countContainer.querySelector('[class*="magritte-text_style-accent"]');
    const positiveEl = countContainer.querySelector('[class*="magritte-text_style-positive"]');

    if (accentEl && accentEl.textContent.trim() === '–') {
      return { views1: 0, views2: 0 };
    }
    let views1 = 0;
    if (accentEl) {
      const text = accentEl.textContent.replace(/\s/g, '');
      views1 = parseInt(text, 10) || 0;
    }
    let views2 = 0;
    if (positiveEl) {
      const text = positiveEl.textContent.replace(/[^\d]/g, '');
      views2 = parseInt(text, 10) || 0;
    }
    return { views1, views2 };
  };

  const collectResumes = async () => {
    let cards = [];
    try {
      await waitForElement('[data-qa="resume"]', 10000);
      cards = document.querySelectorAll('[data-qa="resume"]');
    } catch (err) {
      cards = [];
    }
    const resumes = [];
    for (const card of cards) {
      const titleEl = card.querySelector('[data-qa="resume-title"] [data-qa="cell-text-content"]');
      const title = titleEl ? titleEl.textContent.trim() : '';
      const salaryEl = card.querySelector('[data-qa="title-description"] [data-qa="cell-text-content"]');
      const salaryText = salaryEl ? salaryEl.textContent.trim() : '';
      const salary = parseSalary(salaryText);
      const { views1, views2 } = parseViews(card);
      const linkEl = card.querySelector('a[data-qa^="resume-card-link-"]');
      const resurl = linkEl ? linkEl.href : '';
      resumes.push({ title, resurl, salary, views1, views2 });
    }
    await sendLog('info', `найдено ${resumes.length} резюме`, { resumes });
    return resumes;
  };

  const buildSearchUrl = async () => {
    const searchBtn = await waitForElement('[data-qa="searchVacancy-button"]');
    const form = searchBtn.closest('form');
    if (!form) throw new Error('Form not found for search');
    const action = form.getAttribute('action') || '';
    const hiddenInputs = form.querySelectorAll('input[type="hidden"]');
    const params = new URLSearchParams();
    hiddenInputs.forEach(input => {
      if (input.name && input.value) params.append(input.name, input.value);
    });
    let baseUrl = action;
    if (!baseUrl.startsWith('http')) {
      baseUrl = new URL(baseUrl, window.location.href).href;
    }
    const url = new URL(baseUrl);
    params.forEach((value, key) => url.searchParams.append(key, value));
    return url.toString();
  };

  // Сбор вакансий на текущей странице (с прокруткой до пагинации)
  const collectVacancies = async (pageNum) => {
    let vacancyCards = [];
    try {
      await waitForElement('[data-qa="vacancy-serp__vacancy"]', 10000);
      await scrollUntilPagination();
      vacancyCards = document.querySelectorAll('[data-qa="vacancy-serp__vacancy"]');
    } catch (err) {
      vacancyCards = [];
    }
    
    const vacancies = [];
    for (const card of vacancyCards) {
      const titleLink = card.querySelector('[data-qa="serp-item__title"]');
      const title = titleLink ? titleLink.textContent.trim() : '';
      const url = titleLink ? titleLink.href : '';

      const companyEl = card.querySelector('[data-qa="vacancy-serp__vacancy-employer-text"]');
      const company = companyEl ? companyEl.textContent.trim() : '';

      const experienceEl = card.querySelector('[data-qa*="vacancy-serp__vacancy-work-experience"]');
      const experience = experienceEl ? experienceEl.textContent.trim() : '';

      let salary = '';
      const salaryEl = card.querySelector('[data-qa="vacancy-serp__vacancy-compensation"]');
      if (salaryEl) {
        salary = salaryEl.textContent.trim();
      } else {
        const compensationLabels = card.querySelector('.compensation-labels');
        if (compensationLabels && compensationLabels.textContent.includes('₽')) {
          salary = compensationLabels.textContent.trim();
        }
      }

      const addressEl = card.querySelector('[data-qa="vacancy-serp__vacancy-address"]');
      let address = addressEl ? addressEl.textContent.trim() : '';
      const metroStations = card.querySelectorAll('.metro-station');
      if (metroStations.length) {
        const metros = Array.from(metroStations).map(m => m.textContent.trim()).join(', ');
        if (address) address += `, метро: ${metros}`;
        else address = `метро: ${metros}`;
      }

      let views = '';
      const allText = card.innerText;
      const matchViews = allText.match(/Сейчас смотрят\s+(\d+)\s+челове[кка]?/i);
      if (matchViews) views = matchViews[0];

      const ratingEl = card.querySelector('[data-qa="company-review-rating-value"]');
      const employer_rating = ratingEl ? ratingEl.textContent.trim() : '';

      const reviewsCountEl = card.querySelector('[data-qa="company-review-rating-reviews-count"]');
      const reviews_count = reviewsCountEl ? reviewsCountEl.textContent.trim() : '';

      vacancies.push({
        url,
        title,
        views,
        salary,
        address,
        company,
        experience,
        reviews_count,
        employer_rating
      });
    }
    await sendLog('info', `найдено на странице${pageNum} ${vacancies.length} вакансий`, { vacancies });
    return vacancies;
  };

  try {
    if (hhState === 'check_login') {
      const startTime = Date.now();
      await chrome.storage.local.set({ processStartTime: startTime });

      await sendLog('info', 'начало', { settings });
      
      const profileElement = await waitForElement('[data-qa="mainmenu_profileAndResumes"]', 10000);
      if (!profileElement) {
        await sendLog('error', 'не залогинен (элемент не найден)', { url: window.location.href });
        await chrome.storage.local.set({ hhState: 'error', errorMessage: 'User not logged in', hhStateTimestamp: Date.now() });
        return;
      }

      await sendLog('info', 'залогинен', { url: window.location.href });
      await randomDelay();

      let targetUrl = profileElement.getAttribute('href');
      if (!targetUrl) {
        const innerLink = profileElement.querySelector('a[href]');
        if (innerLink) {
          targetUrl = innerLink.getAttribute('href');
        } else {
          targetUrl = '/applicant/resumes';
        }
      }
      await sendLog('info', 'переход на резюме', { url: targetUrl });

      if (targetUrl) {
        await chrome.storage.local.set({ hhState: 'collect_resumes', hhStateTimestamp: Date.now() });
        window.location.href = targetUrl;
      } else {
        await sendLog('error', 'не удалось определить URL для перехода', { url: window.location.href });
        await chrome.storage.local.set({ hhState: 'error', errorMessage: 'No resume page URL', hhStateTimestamp: Date.now() });
      }
      return;
    }

    if (hhState === 'collect_resumes') {
      await collectResumes();
      await chrome.storage.local.set({ hhState: 'navigate_to_search', hhStateTimestamp: Date.now() });
      await randomDelay();
      const searchUrl = await buildSearchUrl();
      await sendLog('info', 'перейду на поиск', { url: searchUrl });
      window.location.href = searchUrl;
      return;
    }

    if (hhState === 'navigate_to_search') {
      // Инициализация цикла по страницам
      const maxPages = settings.maxPages;
      await chrome.storage.local.set({
        currentPage: 1,
        allVacancies: [],
        maxPages: maxPages,
        hhState: 'processing_pages',
        hhStateTimestamp: Date.now()
      });
      // Перезагружаем страницу, чтобы начать обработку
      window.location.reload();
      return;
    }

    if (hhState === 'processing_pages') {
      // Восстанавливаем состояние
      const { currentPage, allVacancies, maxPages } = await chrome.storage.local.get([
        'currentPage', 'allVacancies', 'maxPages'
      ]);
      if (!currentPage) return;
      
      await waitForElement('body');
      
      // Собираем вакансии на текущей странице
      const newVacancies = await collectVacancies(currentPage);
      const updatedVacancies = [...(allVacancies || []), ...newVacancies];
      
      // Проверяем, нужно ли переходить на следующую страницу
      const nextPage = currentPage + 1;
      const needMorePages = nextPage <= maxPages;
      let nextUrl = null;
      if (needMorePages) {
        const nextButton = document.querySelector('[data-qa="pager-next"]');
        if (nextButton && nextButton.href) {
          nextUrl = nextButton.href;
        }
      }
      
      if (nextUrl) {
        // Сохраняем прогресс и переходим на следующую страницу
        await chrome.storage.local.set({
          currentPage: nextPage,
          allVacancies: updatedVacancies
        });
        await randomDelay();
        await sendLog('info', `переход на страницу ${nextPage} поиска`, { url: nextUrl });
        window.location.href = nextUrl;
      } else {
        // Завершаем обработку: дедупликация и итоговый лог
        // Удаляем дубликаты по url
        const uniqueMap = new Map();
        for (const vac of updatedVacancies) {
          if (!uniqueMap.has(vac.url)) {
            uniqueMap.set(vac.url, vac);
          }
        }
        const uniqueVacancies = Array.from(uniqueMap.values());
        
        await sendLog('info', `собрано с ${maxPages} страниц ${updatedVacancies.length} вакансий`, {
          страниц: maxPages,
          всего_до_дедупликации: updatedVacancies.length,
          вакансии_до_дедупликации: updatedVacancies
        });
        
        await sendLog('info', `всего после удаления дублей ${uniqueVacancies.length} вакансий`, {
          всего_после_дедупликации: uniqueVacancies.length,
          уникальные_вакансии: uniqueVacancies
        });
        
        const { processStartTime } = await chrome.storage.local.get(['processStartTime']);
        if (processStartTime) {
          const endTime = Date.now();
          const durationMs = endTime - processStartTime;
          const durationSec = Math.floor(durationMs / 1000);
          const minutes = Math.floor(durationSec / 60);
          const seconds = durationSec % 60;
          let durationFormatted = '';
          if (minutes > 0) {
            durationFormatted = `${minutes} мин ${seconds} сек`;
          } else {
            durationFormatted = `${seconds} сек`;
          }
          await sendLog('info', 'штатный конец работы', {
            итоговое_время: durationFormatted,
            длительность_мс: durationMs
          });
        } else {
          await sendLog('info', 'штатный конец работы', { итоговое_время: 'неизвестно' });
        }
        
        await chrome.storage.local.remove([
          'hhState', 'sessionId', 'hhStateTimestamp', 'processStartTime',
          'currentPage', 'allVacancies', 'maxPages'
        ]);
      }
      return;
    }
  } catch (err) {
    console.error(err);
    if (err.message !== 'STOP_EXTENSION') {
      await sendLog('error', `Ошибка: ${err.message}`, { stack: err.stack });
    }
    await chrome.storage.local.set({ hhState: 'error', errorMessage: err.message, hhStateTimestamp: Date.now() });
  }
})();