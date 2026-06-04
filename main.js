// main.js (исправлен блок process_multiple_vacancies)
(async () => {
  console.log('main.js started, hhState:', (await chrome.storage.local.get('hhState')).hhState);

  const localState = await chrome.storage.local.get(['hhState', 'errorMessage']);
  let hhState = localState.hhState;

  if (!hhState || hhState === 'finished' || hhState === 'error') return;

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
        if (response && response.success) resolve();
        else reject(new Error(response?.error || 'Log send failed'));
      });
    });
  }

  const randomDelay = () => {
    const min = settings.minDelaySec * 1000;
    const max = settings.maxDelaySec * 1000;
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    return new Promise(resolve => setTimeout(resolve, delay));
  };

  async function openInNewTab(url) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'OPEN_NEW_TAB', url: url }, (response) => {
        resolve(response);
      });
    });
  }

  async function closeVacancyTab(tabId) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CLOSE_VACANCY_TAB', tabId: tabId }, (response) => {
        resolve(response);
      });
    });
  }

  async function saveSearchTabId(tabId) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'SAVE_SEARCH_TAB_ID', tabId: tabId }, () => resolve());
    });
  }

  async function getCurrentTabId() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB_ID' }, (response) => {
        resolve(response.tabId);
      });
    });
  }

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

  const scrollUntilPagination = async () => {
    let paginationBlock = document.querySelector('[data-qa="pager-block"]');
    let attempts = 0;
    const maxAttempts = 30;
    while (attempts < maxAttempts) {
      if (paginationBlock) {
        const rect = paginationBlock.getBoundingClientRect();
        if (rect.bottom <= window.innerHeight) {
          break;
        }
      }
      window.scrollBy(0, window.innerHeight);
      await new Promise(resolve => setTimeout(resolve, 1500));
      await randomDelay();
      paginationBlock = document.querySelector('[data-qa="pager-block"]');
      attempts++;
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
    if (accentEl && accentEl.textContent.trim() === '–') return { views1: 0, views2: 0 };
    let views1 = 0, views2 = 0;
    if (accentEl) {
      const text = accentEl.textContent.replace(/\s/g, '');
      views1 = parseInt(text, 10) || 0;
    }
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
    } catch (err) { cards = []; }
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
    await sendLog('info', `д5 найдено ${resumes.length} резюме`, { resumes });
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
    if (!baseUrl.startsWith('http')) baseUrl = new URL(baseUrl, window.location.href).href;
    const url = new URL(baseUrl);
    params.forEach((value, key) => url.searchParams.append(key, value));
    return url.toString();
  };

  const collectVacancies = async (pageNum, startPorNum = 0) => {
    await scrollUntilPagination();
    let vacancyCards = [];
    try {
      await waitForElement('[data-qa="vacancy-serp__vacancy"]', 10000);
      vacancyCards = document.querySelectorAll('[data-qa="vacancy-serp__vacancy"]');
    } catch (err) { vacancyCards = []; }
    const vacancies = [];
    for (let i = 0; i < vacancyCards.length; i++) {
      const card = vacancyCards[i];
      const porNum = startPorNum + i + 1;
      const titleLink = card.querySelector('[data-qa="serp-item__title"]');
      const title = titleLink ? titleLink.textContent.trim() : '';
      const url = titleLink ? titleLink.href : '';
      const companyEl = card.querySelector('[data-qa="vacancy-serp__vacancy-employer-text"]');
      const company = companyEl ? companyEl.textContent.trim() : '';
      const experienceEl = card.querySelector('[data-qa*="vacancy-serp__vacancy-work-experience"]');
      const experience = experienceEl ? experienceEl.textContent.trim() : '';
      let salary = '';
      const salaryEl = card.querySelector('[data-qa="vacancy-serp__vacancy-compensation"]');
      if (salaryEl) salary = salaryEl.textContent.trim();
      else {
        const compensationLabels = card.querySelector('.compensation-labels');
        if (compensationLabels && compensationLabels.textContent.includes('₽')) salary = compensationLabels.textContent.trim();
      }
      const addressEl = card.querySelector('[data-qa="vacancy-serp__vacancy-address"]');
      let address = addressEl ? addressEl.textContent.trim() : '';
      const metroStations = card.querySelectorAll('.metro-station');
      if (metroStations.length) {
        const metros = Array.from(metroStations).map(m => m.textContent.trim()).join(', ');
        address = address ? `${address}, метро: ${metros}` : `метро: ${metros}`;
      }
      let views = '';
      const allText = card.innerText;
      const matchViews = allText.match(/Сейчас смотрят\s+(\d+)\s+челове[кка]?/i);
      if (matchViews) views = matchViews[0];
      const ratingEl = card.querySelector('[data-qa="company-review-rating-value"]');
      const employer_rating = ratingEl ? ratingEl.textContent.trim() : '';
      const reviewsCountEl = card.querySelector('[data-qa="company-review-rating-reviews-count"]');
      const reviews_count = reviewsCountEl ? reviewsCountEl.textContent.trim() : '';
      vacancies.push({ porNum, url, title, views, salary, address, company, experience, reviews_count, employer_rating });
    }
    await sendLog('info', `д8 найдено на странице ${pageNum} ${vacancies.length} вакансий`, { vacancies });
    return vacancies;
  };

  const collectDetailedInfo = async () => {
    const title = document.querySelector('[data-qa="vacancy-title"]')?.textContent.trim() || '';
    const company = document.querySelector('[data-qa="vacancy-company-name"]')?.textContent.trim() || '';
    let salary = '';
    const salaryEl = document.querySelector('[data-qa="vacancy-salary"]');
    if (salaryEl) salary = salaryEl.textContent.trim();
    if (!salary && document.body.innerText.includes('Уровень дохода')) {
      const match = document.body.innerText.match(/Уровень дохода[:\s]*([^\n]+)/);
      if (match) salary = match[1];
    }
    const location = document.querySelector('[data-qa="vacancy-address-with-map"]')?.textContent.trim() || '';
    const experience = document.querySelector('[data-qa="vacancy-experience"]')?.textContent.trim() || '';
    const employment = document.querySelector('[data-qa="common-employment-text"]')?.textContent.trim() || '';
    const schedule = document.querySelector('[data-qa="work-schedule-by-days-text"]')?.textContent.trim() || '';
    const workingHours = document.querySelector('[data-qa="working-hours-text"]')?.textContent.trim() || '';
    const workFormat = document.querySelector('[data-qa="work-formats-text"]')?.textContent.trim() || '';
    const hiringFormats = document.querySelector('[data-qa="vacancy-hiring-formats"]')?.textContent.trim() || '';
    let fullDescription = '';
    const descEl = document.querySelector('[data-qa="vacancy-description"]');
    if (descEl) fullDescription = descEl.innerText.trim();
    if (!fullDescription) {
      const brandDesc = document.querySelector('.vacancy-branded-description-content');
      if (brandDesc) fullDescription = brandDesc.innerText.trim();
    }
    if (!fullDescription) {
      const tmpl = document.querySelector('.tmpl-hh-wrapper');
      if (tmpl) fullDescription = tmpl.innerText.trim();
    }
    const skills = [];
    const skillElements = document.querySelectorAll('[data-qa="skills-element"]');
    for (const el of skillElements) {
      const tag = el.querySelector('[class*="magritte-tag__label"]');
      if (tag) skills.push(tag.textContent.trim());
    }
    let publicationDate = '';
    const bodyText = document.body.innerText;
    const pubMatch = bodyText.match(/Вакансия опубликована\s+(\d{1,2}\s+\w+\s+\d{4})/);
    if (pubMatch) publicationDate = pubMatch[1];
    let currentViewers = '';
    const viewersMatch = bodyText.match(/Сейчас эту вакансию смотрят\s+(\d+)\s+челове[кка]?/);
    if (viewersMatch) currentViewers = viewersMatch[1];
    const brandedContent = document.querySelector('.tmpl-hh-wrapper')?.innerText.trim() || '';
    const address = location;
    const extraInfo = [];
    const infoItems = document.querySelectorAll('[data-qa="vacancy-key-info-item"]');
    for (const item of infoItems) extraInfo.push(item.textContent.trim());
    return {
      title_detail: title,
      company_detail: company,
      salary_detail: salary,
      location_detail: location,
      experience_detail: experience,
      employment_detail: employment,
      schedule_detail: schedule,
      workingHours_detail: workingHours,
      workFormat_detail: workFormat,
      hiringFormats_detail: hiringFormats,
      fullDescription_detail: fullDescription,
      skills_detail: skills,
      publicationDate_detail: publicationDate,
      currentViewers_detail: currentViewers,
      brandedContent_detail: brandedContent,
      address_detail: address,
      extraInfo_detail: extraInfo
    };
  };

  async function findResponseButton() {
    const btn = document.querySelector('a[data-qa="vacancy-response-link-top"]');
    if (!btn) throw new Error('Кнопка отклика не найдена');
    return btn;
  }

  async function checkQuestionInUrl() {
    return window.location.href.includes('startedWithQuestion');
  }

  async function detectModalType() {
    await sendLog('debug', 'дусл9 зашел', { dom: document.documentElement.outerHTML });
    const modals = document.querySelectorAll('[aria-modal="true"][role="dialog"]');
    if (modals.length !== 1) {
      await sendLog('error', 'дусл9 модальное-ошибка', { count: modals.length });
      throw new Error(`Найдено модальных окон: ${modals.length}, ожидается ровно 1`);
    }
    const modal = modals[0];
    const titleModal = modal.querySelector('[data-qa="title"]');
    const vacancyTitle = modal.querySelector('[data-qa="title-description"]');
    const resumeSelect = modal.querySelector('[data-qa="resume-title"]');
    const addLetterBtn = modal.querySelector('[data-qa="add-cover-letter"]');
    const submitBtn = modal.querySelector('[data-qa="vacancy-response-submit-popup"]');
    const elements = {
      modalExists: true,
      titleModal: !!titleModal,
      vacancyTitle: !!vacancyTitle,
      resumeSelect: !!resumeSelect,
      addLetterBtn: !!addLetterBtn,
      submitBtn: !!submitBtn
    };
    const foundCount = Object.values(elements).filter(v => v === true).length;
    await sendLog('debug', `дусл9 нашел ${foundCount} элементов`, elements);
    if (elements.titleModal && elements.vacancyTitle && elements.resumeSelect && elements.addLetterBtn && elements.submitBtn) {
      return 'simple1';
    } else {
      return 'simple2';
    }
  }

  async function insertCoverLetter(coverLetterText) {
    const modal = document.querySelector('[aria-modal="true"][role="dialog"]');
    if (!modal) {
      await sendLog('error', 'insertCoverLetter: модальное окно не найдено', {});
      throw new Error('Модальное окно не найдено');
    }
    const addButton = modal.querySelector('[data-qa="add-cover-letter"]');
    if (!addButton) {
      await sendLog('error', 'insertCoverLetter: кнопка добавления сопроводительного не найдена', {});
      throw new Error('Кнопка добавления сопроводительного не найдена');
    }
    addButton.click();
    await sendLog('debug', 'д161 нажал кнопку добавления сопровод', {});
    await new Promise(r => setTimeout(r, 500));
    let textField = modal.querySelector('textarea, [contenteditable="true"]');
    if (!textField) {
      await sendLog('error', 'д161 поле ввода текста сопроводительного не найдено', {});
      throw new Error('Поле ввода сопроводительного письма не найдено');
    }
    await sendLog('debug', 'д161 нашел поле ввода сопроводительного', {});
    if (textField.tagName === 'TEXTAREA') {
      textField.value = coverLetterText;
      textField.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (textField.isContentEditable) {
      textField.innerText = coverLetterText;
      textField.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      await sendLog('error', 'insertCoverLetter: неподдерживаемый тип поля', { tag: textField.tagName });
      throw new Error('Неподдерживаемый тип поля для ввода текста');
    }
    await sendLog('info', 'д161, вставил текст сопроводительного', {});
  }

  async function processResumeSelection() {
    await sendLog('info', 'д17 начинаю выбор резюме', { url: window.location.href });
    const modal = document.querySelector('[aria-modal="true"][role="dialog"]');
    if (!modal) {
      await sendLog('error', 'д17 модальное окно не найдено', {});
      return;
    }
    const vacancyTitleElement = modal.querySelector('[data-qa="title-description"]');
    const vacancyTitle = vacancyTitleElement ? vacancyTitleElement.textContent.trim() : '';
    if (!vacancyTitle) {
      await sendLog('warn', 'д17 не удалось получить название вакансии', {});
      return;
    }
    const resumeElement = modal.querySelector('[data-qa="resume-title"]');
    if (!resumeElement) {
      await sendLog('error', 'д17 не найден элемент с текущим выбранным резюме', {});
      return;
    }
    const currentResumeText = resumeElement.textContent.trim();
    await sendLog('info', 'по умолчанию резюме выбрано', { defaultResume: currentResumeText });
    resumeElement.click();
    let dropdownItems = null;
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 100));
      dropdownItems = document.querySelectorAll('[role="option"]');
      if (dropdownItems.length > 0) break;
    }
    if (!dropdownItems || dropdownItems.length === 0) {
      await sendLog('error', 'д17 не удалось найти пункты списка резюме', {});
      throw new Error('д17 не удалось найти пункты списка резюме');
    }
    let scrollContainer = null;
    for (const item of dropdownItems) {
      let parent = item.parentElement;
      while (parent && parent !== document.body) {
        const style = window.getComputedStyle(parent);
        const overflowY = style.overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') {
          scrollContainer = parent;
          break;
        }
        parent = parent.parentElement;
      }
      if (scrollContainer) break;
    }
    if (scrollContainer) {
      let lastScrollTop = -1;
      while (true) {
        scrollContainer.scrollBy(0, scrollContainer.clientHeight);
        await new Promise(r => setTimeout(r, 300));
        if (scrollContainer.scrollTop === lastScrollTop) break;
        lastScrollTop = scrollContainer.scrollTop;
      }
      dropdownItems = document.querySelectorAll('[role="option"]');
    }
    const resumeList = Array.from(dropdownItems)
      .map(el => {
        const titleDiv = el.querySelector('[data-qa="cell-text-content"]');
        return titleDiv ? titleDiv.textContent.trim() : '';
      })
      .filter(text => text.length > 0)
      .filter((value, index, self) => self.indexOf(value) === index);
    await sendLog('info', 'Д17 резюме из списка:', { resumes: resumeList });
    let selectedResume = null;
    const vacancyLower = vacancyTitle.toLowerCase();
    if (vacancyLower.includes('системной аналитики') ||
        vacancyLower.includes('системного анализа') ||
        vacancyLower.includes('аналитиков') ||
        vacancyLower.includes('аналитическ')) {
      selectedResume = 'Руководитель аналитического отдела';
    } else if (vacancyLower.includes('аналитик')) {
      selectedResume = 'Аналитик';
    } else if (vacancyLower.includes('проект') ||
               vacancyLower.includes('менеджер') ||
               vacancyLower.includes('руководитель проект') ||
               vacancyLower.includes('project manager')) {
      selectedResume = 'Руководитель проектов';
    } else {
      selectedResume = 'Руководитель направления';
    }
    await sendLog('info', 'выбрал резюме', { vacancy: vacancyTitle, selected: selectedResume });
    let targetItem = null;
    for (const item of dropdownItems) {
      const titleDiv = item.querySelector('[data-qa="cell-text-content"]');
      const itemText = titleDiv ? titleDiv.textContent.trim() : '';
      if (itemText === selectedResume) {
        targetItem = item;
        break;
      }
    }
    if (!targetItem) {
      await sendLog('error', 'д17 не найдено выбранное резюме в списке', { selected: selectedResume });
      return;
    }
    targetItem.click();
    await new Promise(r => setTimeout(r, 300));
    await sendLog('info', 'д17 закончил выбор резюме', {});
  }

  async function sendResponse() {
    const modal = document.querySelector('[aria-modal="true"][role="dialog"]');
    if (!modal) {
      await sendLog('error', 'sendResponse: модальное окно не найдено', {});
      return;
    }
    const submitBtn = modal.querySelector('[data-qa="vacancy-response-submit-popup"]');
    if (!submitBtn) {
      await sendLog('error', 'sendResponse: кнопка отклика не найдена', {});
      return;
    }
    submitBtn.click();
    await sendLog('info', 'д18 отправил отклик', { url: window.location.href });
    await new Promise(r => setTimeout(r, 4000));
  }

  // ========== Основная логика ==========
  try {
    if (hhState === 'check_login') {
      const startTime = Date.now();
      await chrome.storage.local.set({ processStartTime: startTime });
      const profileElement = await waitForElement('[data-qa="mainmenu_profileAndResumes"]', 10000);
      if (!profileElement) {
        await sendLog('error', 'д4 не залогинен', { url: window.location.href });
        await chrome.storage.local.set({ hhState: 'error', errorMessage: 'User not logged in', hhStateTimestamp: Date.now() });
        return;
      }
      await sendLog('info', 'д3 залогинен', { url: window.location.href });
      await randomDelay();
      let targetUrl = profileElement.getAttribute('href');
      if (!targetUrl) {
        const innerLink = profileElement.querySelector('a[href]');
        targetUrl = innerLink ? innerLink.getAttribute('href') : '/applicant/resumes';
      }
      await sendLog('info', 'д3 переход на резюме', { url: targetUrl });
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
      if (settings.test_vacancy && settings.test_vacancy.trim() !== '') {
        await sendLog('debug', 'д20 обнаружен дебаг', { url: settings.test_vacancy });
        await openInNewTab(settings.test_vacancy);
        await sendLog('debug', 'д20 открыл вакансию из переменной тест_вакансия', { url: settings.test_vacancy });
        await chrome.storage.local.set({ hhState: 'finished' });
        return;
      }
      await chrome.storage.local.set({ hhState: 'navigate_to_search', hhStateTimestamp: Date.now() });
      await randomDelay();
      const searchUrl = await buildSearchUrl();
      await sendLog('info', 'д7 перейду на поиск', { url: searchUrl });
      window.location.href = searchUrl;
      return;
    }

    if (hhState === 'navigate_to_search') {
      const maxPages = settings.maxPages;
      await chrome.storage.local.set({
        currentPage: 1,
        allVacancies: [],
        maxPages: maxPages,
        hhState: 'processing_pages',
        hhStateTimestamp: Date.now()
      });
      window.location.reload();
      return;
    }

    if (hhState === 'processing_pages') {
      const { currentPage, allVacancies, maxPages } = await chrome.storage.local.get(['currentPage', 'allVacancies', 'maxPages']);
      if (!currentPage) return;
      await waitForElement('body');
      const currentCount = allVacancies ? allVacancies.length : 0;
      const newVacancies = await collectVacancies(currentPage, currentCount);
      const updatedVacancies = [...(allVacancies || []), ...newVacancies];
      const nextPage = currentPage + 1;
      const needMorePages = nextPage <= maxPages;
      let nextUrl = null;
      if (needMorePages) {
        const nextButton = document.querySelector('[data-qa="pager-next"]');
        if (nextButton && nextButton.href) nextUrl = nextButton.href;
      }
      if (nextUrl) {
        await chrome.storage.local.set({ currentPage: nextPage, allVacancies: updatedVacancies });
        await randomDelay();
        await sendLog('info', `д9 переход на ${nextPage} страницу поиска вакансий`, { url: nextUrl });
        window.location.href = nextUrl;
      } else {
        const uniqueMap = new Map();
        for (const vac of updatedVacancies) if (!uniqueMap.has(vac.url)) uniqueMap.set(vac.url, vac);
        const uniqueVacancies = Array.from(uniqueMap.values());
        await sendLog('info', `д10 собрано с ${maxPages} страниц ${updatedVacancies.length} вакансий`, {
          страниц: maxPages,
          всего_до_дедупликации: updatedVacancies.length,
          вакансии_до_дедупликации: updatedVacancies
        });
        await sendLog('info', `д10 всего после удаления дублей ${uniqueVacancies.length} вакансий`, {
          всего_после_дедупликации: uniqueVacancies.length,
          уникальные_вакансии: uniqueVacancies
        });
        await chrome.storage.local.set({
          vacanciesToProcess: uniqueVacancies,
          currentVacancyIndex: 0,
          maxVacanciesToProcess: settings.maxVacanciesToProcess,
          searchUrl: window.location.href,
          enrichedVacancies: [],
          hhState: 'processing_vacancies',
          hhStateTimestamp: Date.now()
        });
        if (uniqueVacancies.length > 0 && settings.maxVacanciesToProcess > 0) {
          const first = uniqueVacancies[0];
          await randomDelay();
          await sendLog('info', `д11 открытие вакансии для детального сбора (1)`, { url: first.url, title: first.title });
          const currentTabId = await getCurrentTabId();
          if (currentTabId) await saveSearchTabId(currentTabId);
          const response = await openInNewTab(first.url);
          if (response && response.tabId) {
            await chrome.storage.local.set({ currentVacancyTabId: response.tabId });
          }
          return;
        } else {
          const { processStartTime } = await chrome.storage.local.get(['processStartTime']);
          const endTime = Date.now();
          const durationMs = endTime - processStartTime;
          const durationSec = Math.floor(durationMs / 1000);
          const minutes = Math.floor(durationSec / 60);
          const seconds = durationSec % 60;
          const durationFormatted = minutes > 0 ? `${minutes} мин ${seconds} сек` : `${seconds} сек`;
          await sendLog('info', 'д999 штатный конец работы', { итоговое_время: durationFormatted, длительность_мс: durationMs });
          await chrome.storage.local.remove(['hhState', 'sessionId', 'hhStateTimestamp', 'processStartTime', 'currentPage', 'allVacancies', 'maxPages', 'vacanciesToProcess', 'currentVacancyIndex', 'maxVacanciesToProcess', 'searchUrl', 'enrichedVacancies']);
        }
      }
      return;
    }

    if (hhState === 'processing_vacancies') {
      const { vacanciesToProcess, currentVacancyIndex, maxVacanciesToProcess, searchUrl, processStartTime, enrichedVacancies } = await chrome.storage.local.get([
        'vacanciesToProcess', 'currentVacancyIndex', 'maxVacanciesToProcess', 'searchUrl', 'processStartTime', 'enrichedVacancies'
      ]);

      if (!vacanciesToProcess || currentVacancyIndex >= vacanciesToProcess.length || currentVacancyIndex >= maxVacanciesToProcess) {
        const finalEnriched = enrichedVacancies || [];
        await sendLog('info', `д12 обогащенных ${finalEnriched.length} вакансий`, { обогащенные_вакансии: finalEnriched });

        let rankedVacancies = [];
        let rankingError = false;
        if (settings.rank_deepseek === 1) {
          try {
            rankedVacancies = await new Promise((resolve, reject) => {
              chrome.runtime.sendMessage({
                type: 'RANK_VACANCIES',
                vacancies: finalEnriched,
                resume: settings.resume_text || '',
                coverLetter: settings.coverLetter || '',
                extraData: settings.extra_data || ''
              }, (response) => {
                if (response && response.success) resolve(response.ranked);
                else reject(new Error(response?.error || 'Ranking failed'));
              });
            });
            await sendLog('info', 'д13 общая инфо с ранжем от дипсик', {
              обогащенные_вакансии_с_рангом: rankedVacancies
            });
          } catch (err) {
            await sendLog('error', `Ошибка ранжирования: ${err.message}`);
            rankingError = true;
          }
        }

        if (settings.rank_deepseek === 1 && rankingError) {
          await chrome.storage.local.set({ hhState: 'error', errorMessage: 'DeepSeek ranking failed', hhStateTimestamp: Date.now() });
          return;
        }

        let vacanciesToSort = rankedVacancies.length ? rankedVacancies : finalEnriched;
        vacanciesToSort.sort((a, b) => {
          const ratingA = a.deepseek_rating ?? -1;
          const ratingB = b.deepseek_rating ?? -1;
          if (ratingA !== ratingB) return ratingB - ratingA;
          return (a.porNum ?? Infinity) - (b.porNum ?? Infinity);
        });
        await sendLog('info', 'д131 отсортированные вакансии', { sorted: vacanciesToSort.map(v => ({ porNum: v.porNum, deepseek_rating: v.deepseek_rating, title: v.title })) });

        const limit = Math.min(vacanciesToSort.length, settings.maxVacanciesToProcess);
        const multipleList = vacanciesToSort.slice(0, limit);
        await chrome.storage.local.set({
          multipleVacanciesList: multipleList,
          currentMultipleIndex: 0,
          hhState: 'process_multiple_vacancies'
        });
        const firstVacancy = multipleList[0];
        await sendLog('info', `д14 открыл вакансию с рейтингом ${firstVacancy.deepseek_rating ?? 'нет'}`, { url: firstVacancy.url, rating: firstVacancy.deepseek_rating });
        await openInNewTab(firstVacancy.url);
        return;
      }

      const currentVacancy = vacanciesToProcess[currentVacancyIndex];
      if (!window.location.href.includes('/vacancy/')) {
        await randomDelay();
        await sendLog('info', `д11 открытие вакансии ${currentVacancyIndex+1} для детального сбора`, { url: currentVacancy.url, title: currentVacancy.title });
        const currentTabId = await getCurrentTabId();
        if (currentTabId) await saveSearchTabId(currentTabId);
        const response = await openInNewTab(currentVacancy.url);
        if (response && response.tabId) {
          await chrome.storage.local.set({ currentVacancyTabId: response.tabId });
        }
        return;
      }
      await waitForElement('[data-qa="vacancy-title"]', 15000);
      await randomDelay();
      const detailedInfo = await collectDetailedInfo();
      const enrichedVacancy = { ...currentVacancy, ...detailedInfo };
      const updatedEnriched = [...(enrichedVacancies || []), enrichedVacancy];
      await chrome.storage.local.set({ enrichedVacancies: updatedEnriched });
      const nextIndex = currentVacancyIndex + 1;
      await chrome.storage.local.set({ currentVacancyIndex: nextIndex });
      await sendLog('info', `д11 собрано детальное инфо вакансии ${currentVacancyIndex+1}`, { url: window.location.href });
      const { currentVacancyTabId } = await chrome.storage.local.get('currentVacancyTabId');
      if (currentVacancyTabId) {
        await closeVacancyTab(currentVacancyTabId);
        await chrome.storage.local.remove('currentVacancyTabId');
      } else {
        await sendLog('error', 'Не найден ID вкладки вакансии, пропускаем закрытие');
      }
      return;
    }

    // ==================== ИСПРАВЛЕННЫЙ БЛОК ОБРАБОТКИ НЕСКОЛЬКИХ ВАКАНСИЙ ====================
    if (hhState === 'process_multiple_vacancies') {
      const { multipleVacanciesList, currentMultipleIndex, searchTabId, searchUrl } = await chrome.storage.local.get([
        'multipleVacanciesList', 'currentMultipleIndex', 'searchTabId', 'searchUrl'
      ]);

      await sendLog('debug', 'process_multiple_vacancies state', {
        listLength: multipleVacanciesList?.length,
        currentIndex: currentMultipleIndex,
        searchTabId: searchTabId,
        currentUrl: window.location.href
      });

      if (!multipleVacanciesList || currentMultipleIndex >= multipleVacanciesList.length) {
        const { processStartTime } = await chrome.storage.local.get(['processStartTime']);
        const endTime = Date.now();
        const durationMs = endTime - processStartTime;
        const durationSec = Math.floor(durationMs / 1000);
        const minutes = Math.floor(durationSec / 60);
        const seconds = durationSec % 60;
        const durationFormatted = minutes > 0 ? `${minutes} мин ${seconds} сек` : `${seconds} сек`;
        await sendLog('info', 'д999 штатный конец работы', { итоговое_время: durationFormatted, длительность_мс: durationMs });
        await chrome.storage.local.remove(['hhState', 'sessionId', 'hhStateTimestamp', 'processStartTime', 'multipleVacanciesList', 'currentMultipleIndex']);
        return;
      }

      const currentVacancy = multipleVacanciesList[currentMultipleIndex];
      const currentUrl = window.location.href;

      // Если мы на странице ответа (vacancy_response), считаем отклик успешным и переходим к следующей вакансии
      if (currentUrl.includes('/applicant/vacancy_response')) {
        await sendLog('info', 'Обнаружена страница ответа, отклик уже отправлен', { url: currentUrl });
        const newIndex = currentMultipleIndex + 1;
        await chrome.storage.local.set({ currentMultipleIndex: newIndex });
        const currentTabId = await getCurrentTabId();
        if (currentTabId) await closeVacancyTab(currentTabId);
        if (searchTabId) {
          chrome.tabs.update(searchTabId, { active: true }, () => {
            chrome.tabs.reload(searchTabId);
          });
        } else if (searchUrl) {
          await openInNewTab(searchUrl);
        } else {
          window.location.reload();
        }
        return;
      }

      // Если мы не на странице этой вакансии – открываем её
      if (!currentUrl.includes(currentVacancy.url)) {
        if (currentMultipleIndex > 0) {
          await sendLog('info', `д25 открываю очередную вакансию`, {
            vacancy: { url: currentVacancy.url, title: currentVacancy.title, index: currentMultipleIndex }
          });
          await openInNewTab(currentVacancy.url);
        } else {
          if (!currentUrl.includes('/vacancy/')) {
            await sendLog('info', `д14 открыл вакансию (повторно)`, { url: currentVacancy.url, index: currentMultipleIndex });
            await openInNewTab(currentVacancy.url);
          }
        }
        return;
      }

      // Находимся на странице вакансии – выполняем отклик
      await waitForElement('[data-qa="vacancy-response-link-top"]', 10000);
      const responseButton = await findResponseButton();
      const buttonText = responseButton.innerText.trim().toLowerCase();
      await sendLog('info', `д30 на кнопке написано=${buttonText}`, { url: window.location.href });

      if (buttonText === 'откликнуться') {
        await sendLog('info', 'д30 буду откликаться, новая', { url: window.location.href });
        responseButton.click();

        // Сначала проверяем, есть ли в URL параметр startedWithQuestion (Д15)
        const hasQuestions = await checkQuestionInUrl();
        if (hasQuestions) {
          await sendLog('info', 'д15 доп вопросы', { url: window.location.href });
          // Увеличиваем индекс и закрываем вкладку, так как страница с вопросами требует ручного вмешательства
          const newIndex = currentMultipleIndex + 1;
          await chrome.storage.local.set({ currentMultipleIndex: newIndex });
          const currentTabId = await getCurrentTabId();
          if (currentTabId) await closeVacancyTab(currentTabId);
          if (searchTabId) {
            chrome.tabs.update(searchTabId, { active: true }, () => {
              chrome.tabs.reload(searchTabId);
            });
          } else if (searchUrl) {
            await openInNewTab(searchUrl);
          } else {
            window.location.reload();
          }
          return;
        }

        // Если вопросов нет, ждём появления модального окна (до 3 секунд)
        let modalAppeared = false;
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 100));
          const modal = document.querySelector('[aria-modal="true"][role="dialog"]');
          if (modal) {
            modalAppeared = true;
            break;
          }
        }

        if (!modalAppeared) {
          // Модальное окно не появилось – считаем, что отклик отправлен (быстрый отклик)
          await sendLog('info', 'д30 отклик отправлен без модального окна (быстрый отклик)', { url: window.location.href });
          const newIndex = currentMultipleIndex + 1;
          await chrome.storage.local.set({ currentMultipleIndex: newIndex });
          const currentTabId = await getCurrentTabId();
          if (currentTabId) await closeVacancyTab(currentTabId);
          if (searchTabId) {
            chrome.tabs.update(searchTabId, { active: true }, () => {
              chrome.tabs.reload(searchTabId);
            });
          } else if (searchUrl) {
            await openInNewTab(searchUrl);
          } else {
            window.location.reload();
          }
          return;
        }

        // Модальное окно появилось – выполняем полную обработку
        await sendLog('info', 'д16 модальное окно, буду определять разновидность', { url: window.location.href });
        await new Promise(resolve => setTimeout(resolve, settings.modalWaitSec * 1000));
        const modalType = await detectModalType();
        if (modalType === 'simple1') {
          await sendLog('info', 'д161 модальное окно вида симпл1', { url: window.location.href });
          await insertCoverLetter(settings.coverLetter);
        } else {
          await sendLog('info', 'д162 модальное окно вида симпл2', { url: window.location.href });
        }
        await processResumeSelection();
        await sendResponse();

        const newIndex = currentMultipleIndex + 1;
        await chrome.storage.local.set({ currentMultipleIndex: newIndex });
        const currentTabId = await getCurrentTabId();
        if (currentTabId) await closeVacancyTab(currentTabId);
        if (searchTabId) {
          chrome.tabs.update(searchTabId, { active: true }, () => {
            chrome.tabs.reload(searchTabId);
          });
        } else if (searchUrl) {
          await openInNewTab(searchUrl);
        } else {
          window.location.reload();
        }
        return;
      } else {
        await sendLog('error', 'д30 на кнопке неизвестная надпись, останов', { url: window.location.href });
        const newIndex = currentMultipleIndex + 1;
        await chrome.storage.local.set({ currentMultipleIndex: newIndex });
        const currentTabId = await getCurrentTabId();
        if (currentTabId) await closeVacancyTab(currentTabId);
        if (searchTabId) {
          chrome.tabs.update(searchTabId, { active: true }, () => {
            chrome.tabs.reload(searchTabId);
          });
        } else if (searchUrl) {
          await openInNewTab(searchUrl);
        } else {
          window.location.reload();
        }
        return;
      }
    }
    // ====================================================================================

  } catch (err) {
    console.error(err);
    if (err.message !== 'STOP_EXTENSION') {
      try {
        await sendLog('error', `Ошибка: ${err.message}`, { stack: err.stack });
      } catch (logErr) {}
    }
    const { processStartTime } = await chrome.storage.local.get(['processStartTime']);
    const endTime = Date.now();
    const durationMs = endTime - processStartTime;
    const durationSec = Math.floor(durationMs / 1000);
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    const durationFormatted = minutes > 0 ? `${minutes} мин ${seconds} сек` : `${seconds} сек`;
    await sendLog('info', 'д999 штатный конец работы (ошибка)', { итоговое_время: durationFormatted, длительность_мс: durationMs });
    await chrome.storage.local.set({ hhState: 'error', errorMessage: err.message, hhStateTimestamp: Date.now() });
  }
})();