console.log('main.js loaded');
(async () => {
  console.log('main.js async started');

  // Проверка флага ручного запуска
  const { manualStart } = await chrome.storage.local.get('manualStart');
  if (!manualStart) {
    console.log('Расширение не запущено вручную, пропускаем');
    return;
  }

  // Проверка состояния – если нет hhState или оно завершено, удаляем manualStart и выходим
  const localState = await chrome.storage.local.get(['hhState', 'errorMessage']);
  let hhState = localState.hhState;
  if (!hhState || hhState === 'finished' || hhState === 'error') {
    console.log('Состояние неактивно, удаляем флаг и завершаем');
    await chrome.storage.local.remove('manualStart');
    return;
  }

  console.log('Ручной запуск подтверждён, выполняем');

  let settings, sessionId;
  try {
    const state = await new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'GET_STATE' }, resolve);
    });
    settings = state.settings;
    sessionId = state.sessionId;
  } catch (err) {
    console.error('Ошибка получения состояния:', err);
    await chrome.storage.local.remove('manualStart');
    return;
  }
  if (!settings) {
    console.error('Настройки не загружены');
    await chrome.storage.local.remove('manualStart');
    return;
  }

  // ---- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (без изменений) ----
  async function sendLog(level, message, metadata = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'LOG', level, message, metadata }, (response) => {
        if (response?.success) resolve();
        else reject(new Error(response?.error || 'Log send failed'));
      });
    });
  }

  const randomDelay = () => {
    const min = settings.minDelaySec * 1000;
    const max = settings.maxDelaySec * 1000;
    return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min)));
  };

  async function openInNewTab(url) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'OPEN_NEW_TAB', url }, response => resolve(response));
    });
  }

  async function closeVacancyTab(tabId) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'CLOSE_VACANCY_TAB', tabId }, response => resolve(response));
    });
  }

  async function saveSearchTabId(tabId) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'SAVE_SEARCH_TAB_ID', tabId }, () => resolve());
    });
  }

  async function getCurrentTabId() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB_ID' }, response => resolve(response?.tabId));
    });
  }

  const waitForElement = (selector, timeout = 10000) => {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) { observer.disconnect(); resolve(el); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); reject(new Error(`Element ${selector} not found`)); }, timeout);
    });
  };

  const scrollUntilPagination = async () => {
    let paginationBlock = document.querySelector('[data-qa="pager-block"]');
    let attempts = 0;
    while (attempts < 30) {
      if (paginationBlock && paginationBlock.getBoundingClientRect().bottom <= window.innerHeight) break;
      window.scrollBy(0, window.innerHeight);
      await new Promise(r => setTimeout(r, 1500));
      await randomDelay();
      paginationBlock = document.querySelector('[data-qa="pager-block"]');
      attempts++;
    }
    await randomDelay();
  };

  const parseSalary = (salaryText) => {
    if (!salaryText || salaryText.includes('Уровень дохода не указан')) return 0;
    const match = salaryText.match(/([\d\s]+)\s*₽/);
    return match ? parseInt(match[1].replace(/\s/g, ''), 10) : 0;
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
    if (accentEl) views1 = parseInt(accentEl.textContent.replace(/\s/g, ''), 10) || 0;
    if (positiveEl) views2 = parseInt(positiveEl.textContent.replace(/[^\d]/g, ''), 10) || 0;
    return { views1, views2 };
  };

  const collectResumes = async () => {
    let cards = [];
    try {
      await waitForElement('[data-qa="resume"]', 10000);
      cards = document.querySelectorAll('[data-qa="resume"]');
    } catch { cards = []; }
    const resumes = [];
    for (const card of cards) {
      const titleEl = card.querySelector('[data-qa="resume-title"] [data-qa="cell-text-content"]');
      const salaryEl = card.querySelector('[data-qa="title-description"] [data-qa="cell-text-content"]');
      const linkEl = card.querySelector('a[data-qa^="resume-card-link-"]');
      const { views1, views2 } = parseViews(card);
      resumes.push({
        title: titleEl ? titleEl.textContent.trim() : '',
        resurl: linkEl ? linkEl.href : '',
        salary: salaryEl ? parseSalary(salaryEl.textContent.trim()) : 0,
        views1, views2
      });
    }
    await sendLog('info', `д5 найдено ${resumes.length} резюме`, { resumes });
    return resumes;
  };

  const buildSearchUrl = async () => {
    const searchBtn = await waitForElement('[data-qa="searchVacancy-button"]');
    const form = searchBtn.closest('form');
    if (!form) throw new Error('Form not found');
    const action = form.getAttribute('action') || '';
    const hiddenInputs = form.querySelectorAll('input[type="hidden"]');
    const params = new URLSearchParams();
    hiddenInputs.forEach(input => { if (input.name && input.value) params.append(input.name, input.value); });
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
    } catch { vacancyCards = []; }
    const vacancies = [];
    for (let i = 0; i < vacancyCards.length; i++) {
      const card = vacancyCards[i];
      const porNum = startPorNum + i + 1;
      const titleLink = card.querySelector('[data-qa="serp-item__title"]');
      const companyEl = card.querySelector('[data-qa="vacancy-serp__vacancy-employer-text"]');
      const experienceEl = card.querySelector('[data-qa*="vacancy-serp__vacancy-work-experience"]');
      const salaryEl = card.querySelector('[data-qa="vacancy-serp__vacancy-compensation"]');
      const addressEl = card.querySelector('[data-qa="vacancy-serp__vacancy-address"]');
      const ratingEl = card.querySelector('[data-qa="company-review-rating-value"]');
      const reviewsCountEl = card.querySelector('[data-qa="company-review-rating-reviews-count"]');
      let salary = salaryEl ? salaryEl.textContent.trim() : '';
      if (!salary) {
        const compLabels = card.querySelector('.compensation-labels');
        if (compLabels && compLabels.textContent.includes('₽')) salary = compLabels.textContent.trim();
      }
      let address = addressEl ? addressEl.textContent.trim() : '';
      const metroStations = card.querySelectorAll('.metro-station');
      if (metroStations.length) {
        const metros = Array.from(metroStations).map(m => m.textContent.trim()).join(', ');
        address = address ? `${address}, метро: ${metros}` : `метро: ${metros}`;
      }
      const allText = card.innerText;
      const matchViews = allText.match(/Сейчас смотрят\s+(\d+)\s+челове[кка]?/i);
      const views = matchViews ? matchViews[0] : '';
      vacancies.push({
        porNum,
        url: titleLink ? titleLink.href : '',
        title: titleLink ? titleLink.textContent.trim() : '',
        views,
        salary,
        address,
        company: companyEl ? companyEl.textContent.trim() : '',
        experience: experienceEl ? experienceEl.textContent.trim() : '',
        reviews_count: reviewsCountEl ? reviewsCountEl.textContent.trim() : '',
        employer_rating: ratingEl ? ratingEl.textContent.trim() : ''
      });
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
    const bodyText = document.body.innerText;
    const pubMatch = bodyText.match(/Вакансия опубликована\s+(\d{1,2}\s+\w+\s+\d{4})/);
    const publicationDate = pubMatch ? pubMatch[1] : '';
    const viewersMatch = bodyText.match(/Сейчас эту вакансию смотрят\s+(\d+)\s+челове[кка]?/);
    const currentViewers = viewersMatch ? viewersMatch[1] : '';
    const brandedContent = document.querySelector('.tmpl-hh-wrapper')?.innerText.trim() || '';
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
      address_detail: location,
      extraInfo_detail: extraInfo
    };
  };

  async function findResponseButton() {
    const btn = document.querySelector('a[data-qa="vacancy-response-link-top"]');
    if (!btn) throw new Error('Кнопка отклика не найдена');
    return btn;
  }

  async function detectModalType() {
    await sendLog('debug', 'дусл9 зашел', {});
    const modals = document.querySelectorAll('[aria-modal="true"][role="dialog"]');
    if (modals.length !== 1) {
      await sendLog('error', 'дусл9 модальное-ошибка', { count: modals.length });
      throw new Error(`Найдено модальных окон: ${modals.length}, ожидается ровно 1`);
    }
    const modal = modals[0];
    const titleModal = !!modal.querySelector('[data-qa="title"]');
    const vacancyTitle = !!modal.querySelector('[data-qa="title-description"]');
    const resumeSelect = !!modal.querySelector('[data-qa="resume-title"]');
    const addLetterBtn = !!modal.querySelector('[data-qa="add-cover-letter"]');
    const submitBtn = !!modal.querySelector('[data-qa="vacancy-response-submit-popup"]');
    const foundCount = [titleModal, vacancyTitle, resumeSelect, addLetterBtn, submitBtn].filter(Boolean).length;
    await sendLog('debug', `дусл9 нашел ${foundCount} элементов`, { titleModal, vacancyTitle, resumeSelect, addLetterBtn, submitBtn });
    if (titleModal && vacancyTitle && resumeSelect && addLetterBtn && submitBtn) return 'simple1';
    else return 'simple2';
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
    await new Promise(r => setTimeout(r, 500));
    let textField = modal.querySelector('textarea, [contenteditable="true"]');
    if (!textField) {
      await sendLog('debug', 'д161 нажал кнопку добавления сопровод ', { result: 'д161 поле ввода текста сопроводительного не найдено' });
      throw new Error('Поле ввода сопроводительного письма не найдено');
    }
    await sendLog('debug', 'д161 нажал кнопку добавления сопровод ', { result: 'найдено поле ввода сопроводительного' });
    if (textField.tagName === 'TEXTAREA') {
      textField.value = coverLetterText;
      textField.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (textField.isContentEditable) {
      textField.innerText = coverLetterText;
      textField.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      throw new Error('Неподдерживаемый тип поля');
    }
    await sendLog('info', 'д161, вставил текст сопроводительного', {});
  }

  async function processCoverLetterBlock() {
    const block = document.querySelector('[data-qa="vacancy-response-letter-toggle"]');
    if (!block) {
      await sendLog('debug', 'д20 блок сопроводительного письма не найден, без письма будет');
      return false;
    }
    await sendLog('debug', 'д20 блок с сопроводительным письмом найден, буду нажимать', {});
    block.click();
    await randomDelay();
    let textField = document.querySelector('textarea[data-qa*="letter-input"]');
    if (!textField) {
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 200));
        textField = document.querySelector('textarea[data-qa*="letter-input"]');
        if (textField) break;
      }
    }
    if (textField) {
      textField.value = settings.coverLetter || '';
      textField.dispatchEvent(new Event('input', { bubbles: true }));
      await sendLog('info', 'д20 вставил текст сопроводительного письма', { url: window.location.href });
      return true;
    } else {
      await sendLog('info', 'д20 ошибка вставки сопроводительного письма', { url: window.location.href });
      return false;
    }
  }

  async function processResumeSelection() {
    await sendLog('info', 'д17 начинаю выбор резюме', { url: window.location.href });
    const modal = document.querySelector('[aria-modal="true"][role="dialog"]');
    let resumeElement, vacancyTitle = '';
    if (modal) {
      vacancyTitle = modal.querySelector('[data-qa="title-description"]')?.textContent.trim() || '';
      resumeElement = modal.querySelector('[data-qa="resume-title"]');
    } else {
      resumeElement = document.querySelector('[data-qa="resume-title"]');
      vacancyTitle = document.querySelector('[data-qa="vacancy-title"]')?.textContent.trim() || '';
    }
    if (!resumeElement) {
      await sendLog('error', 'д17 не найден элемент с текущим выбранным резюме', {});
      return;
    }
    if (!vacancyTitle) await sendLog('warn', 'д17 не удалось получить название вакансии', {});
    const currentResumeText = resumeElement.textContent.trim();
    await sendLog('info', 'д17 по умолчанию резюме выбрано', { defaultResume: currentResumeText });
    resumeElement.click();
    await new Promise(r => setTimeout(r, 300));
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
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
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
      .map(el => el.querySelector('[data-qa="cell-text-content"]')?.textContent.trim() || '')
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
    await sendLog('info', 'Д17 резюме из списка:', { resumes: resumeList });
    const vacancyLower = vacancyTitle.toLowerCase();
    let selectedResume = 'Руководитель направления';
    if (vacancyLower.includes('системной аналитики') || vacancyLower.includes('системного анализа') || vacancyLower.includes('аналитиков') || vacancyLower.includes('аналитическ')) {
      selectedResume = 'Руководитель аналитического отдела';
    } else if (vacancyLower.includes('руководитель отдела')) {
      selectedResume = 'Руководитель отдела ИТ';
    } else if (vacancyLower.includes('аналитик')) {
      selectedResume = 'Аналитик';
    } else if (vacancyLower.includes('проект') || vacancyLower.includes('менеджер') || vacancyLower.includes('руководитель проект') || vacancyLower.includes('project manager')) {
      selectedResume = 'Руководитель проектов';
    }
    await sendLog('info', 'д17 выбрал резюме', { vacancy: vacancyTitle, selected: selectedResume });
    let targetItem = null;
    for (const item of dropdownItems) {
      const titleDiv = item.querySelector('[data-qa="cell-text-content"]');
      if (titleDiv && titleDiv.textContent.trim() === selectedResume) {
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

  async function sendResponse(type, isTestVacancy = false) {
    if (isTestVacancy) {
      await sendLog('debug', 'Тестовый режим: остановка в Д18 без отправки отклика');
      const { processStartTime } = await chrome.storage.local.get(['processStartTime']);
      const endTime = Date.now();
      const durationMs = endTime - processStartTime;
      const durationSec = Math.floor(durationMs / 1000);
      const minutes = Math.floor(durationSec / 60);
      const seconds = durationSec % 60;
      const durationFormatted = minutes > 0 ? `${minutes} мин ${seconds} сек` : `${seconds} сек`;
      await sendLog('info', 'д999 штатный конец работы', { итоговое_время: durationFormatted, длительность_мс: durationMs });
      await chrome.storage.local.remove(['hhState', 'sessionId', 'hhStateTimestamp', 'processStartTime', 'multipleVacanciesList', 'currentMultipleIndex', 'manualStart']);
      throw new Error('STOP_EXTENSION');
    }
    const modal = document.querySelector('[aria-modal="true"][role="dialog"]');
    let submitBtn = modal ? modal.querySelector('[data-qa="vacancy-response-submit-popup"]') : null;
    if (!submitBtn) submitBtn = document.querySelector('[data-qa="vacancy-response-submit-popup"]');
    if (!submitBtn) submitBtn = document.querySelector('button[type="submit"], input[type="submit"]');
    if (!submitBtn) {
      await sendLog('error', 'sendResponse: кнопка отклика не найдена', {});
      return;
    }
    submitBtn.click();
    await sendLog('info', `д18 отправил отклик ${type}`, { url: window.location.href });
    await new Promise(r => setTimeout(r, 4000));
  }

  async function processQuestionsPage() {
    await sendLog('info', 'д15 доп вопросы', { url: window.location.href });

    function isInsideLetterBlock(el) {
      return !!el.closest('[data-qa="vacancy-response-letter-toggle"]');
    }

    function getQuestionFromParent(el) {
      let parent = el.parentElement;
      for (let i = 0; i < 10 && parent && parent !== document.body; i++) {
        let text = parent.innerText ? parent.innerText.replace(/\s+/g, ' ').trim() : '';
        if (text.length > 10) {
          let clean = text.replace(/\s*(Да|Нет|Свой вариант|Выбрать|Укажите|Отметьте|Вариант|Полностью|Частично|Да,|Нет,)\s*$/i, '').trim();
          if (clean.length > 5) return clean;
        }
        const labelAttr = parent.getAttribute('aria-label') || parent.getAttribute('data-label');
        if (labelAttr && labelAttr.length > 5) return labelAttr;
        parent = parent.parentElement;
      }
      const siblings = el.parentElement?.children;
      if (siblings) {
        for (const sibling of siblings) {
          if (sibling !== el) {
            const text = sibling.innerText?.trim();
            if (text && text.length > 5 && !/^(Да|Нет|Свой|Вариант|Укажите|Отметьте|Выбрать)/i.test(text)) {
              return text;
            }
          }
        }
      }
      return '';
    }

    const fields = [];

    const textInputs = document.querySelectorAll('input[type="text"], input:not([type]), textarea');
    for (const el of textInputs) {
      if (isInsideLetterBlock(el)) continue;
      let question = getQuestionFromParent(el) || el.placeholder || el.getAttribute('aria-label') || '';
      if (!question) continue;
      const lower = question.toLowerCase();
      if (lower.includes('сгенерировать') || lower.includes('откликнуться') || lower.includes('резюме для отклика') || lower.includes('сопроводительное письмо') || lower.includes('добавить') || lower.includes('письмо')) continue;
      const selector = el.id ? `#${el.id}` : (el.name ? `${el.tagName.toLowerCase()}[name="${el.name}"]` : el.tagName.toLowerCase());
      fields.push({
        type: el.tagName === 'TEXTAREA' ? 'textarea' : 'text',
        question: question,
        selector: selector,
        required: el.required || false,
        currentValue: el.value || ''
      });
    }

    const radioGroups = new Map();
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
      if (!radioGroups.has(radio.name)) radioGroups.set(radio.name, []);
      radioGroups.get(radio.name).push(radio);
    });
    for (const [name, radios] of radioGroups) {
      const firstRadio = radios[0];
      if (isInsideLetterBlock(firstRadio)) continue;
      let question = getQuestionFromParent(firstRadio) || 'Вопрос не определён';
      const lower = question.toLowerCase();
      if (lower.includes('сгенерировать') || lower.includes('откликнуться') || lower.includes('резюме для отклика') || lower.includes('сопроводительное письмо') || lower.includes('добавить') || lower.includes('письмо')) continue;
      const options = radios.map(r => {
        let label = r.closest('label')?.innerText.trim() || r.parentElement.innerText.trim() || r.value;
        return { value: r.value, label: label };
      });
      fields.push({ type: 'radio', question, name, options, selector: `input[name="${name}"]` });
    }

    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (isInsideLetterBlock(cb)) return;
      let question = getQuestionFromParent(cb) || 'Вопрос не определён';
      const lower = question.toLowerCase();
      if (lower.includes('сгенерировать') || lower.includes('откликнуться') || lower.includes('резюме для отклика') || lower.includes('сопроводительное письмо') || lower.includes('добавить') || lower.includes('письмо')) return;
      let label = cb.closest('label')?.innerText.trim() || cb.parentElement.innerText.trim() || cb.value;
      const selector = cb.id ? `#${cb.id}` : (cb.name ? `input[name="${cb.name}"][value="${cb.value}"]` : cb.tagName.toLowerCase());
      fields.push({
        type: 'checkbox',
        question,
        selector,
        label: label,
        checked: cb.checked,
        required: cb.required || false
      });
    });

    document.querySelectorAll('select').forEach(sel => {
      if (isInsideLetterBlock(sel)) return;
      let question = getQuestionFromParent(sel) || 'Вопрос не определён';
      const lower = question.toLowerCase();
      if (lower.includes('сгенерировать') || lower.includes('откликнуться') || lower.includes('резюме для отклика') || lower.includes('сопроводительное письмо') || lower.includes('добавить') || lower.includes('письмо')) return;
      const options = Array.from(sel.options).map(opt => ({ value: opt.value, text: opt.text }));
      const selector = sel.id ? `#${sel.id}` : (sel.name ? `select[name="${sel.name}"]` : 'select');
      fields.push({ type: 'select', question, selector, options, currentValue: sel.value, required: sel.required || false });
    });

    if (fields.length === 0) {
      await sendLog('warn', 'Не найдено полей для заполнения, пропускаем вакансию');
      return false;
    }

    const response = await new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'CALL_LLM', fields, endpoint: settings.localLLMEndpoint }, resolve);
    });

    if (!response || !response.success) {
      if (response?.invalidJson) {
        await sendLog('error', 'д15 непонятный ответ от локальной llm', { request: response.request, responseText: response.content });
      } else {
        await sendLog('error', `д15 Ошибка при вызове локальной LLM: ${response?.error || 'unknown'}`, { request: { fields, endpoint: settings.localLLMEndpoint } });
      }
      return false;
    }

    const llmResponse = response.answers;
    for (let i = 0; i < llmResponse.length && i < fields.length; i++) {
      const ans = llmResponse[i];
      const field = fields[i];
      if (!field) continue;

      if (field.type === 'text' || field.type === 'textarea') {
        const el = document.querySelector(field.selector);
        if (el) { el.value = ans.answer; el.dispatchEvent(new Event('input', { bubbles: true })); }
      } else if (field.type === 'radio') {
        const radioValue = field.options.find(opt => opt.label === ans.answer || opt.value === ans.answer);
        if (radioValue) {
          const radio = document.querySelector(`input[name="${field.name}"][value="${radioValue.value}"]`);
          if (radio) radio.click();
        }
      } else if (field.type === 'checkbox') {
        const answerArray = Array.isArray(ans.answer) ? ans.answer : [ans.answer];
        for (const val of answerArray) {
          let cb = null;
          if (field.selector.includes('[value="')) {
            cb = document.querySelector(field.selector.replace(/\[value="[^"]*"\]/, `[value="${val}"]`));
          } else {
            const allCbs = document.querySelectorAll(field.selector);
            for (const c of allCbs) {
              const labelEl = c.closest('label');
              if (labelEl && labelEl.innerText.trim() === val) {
                cb = c;
                break;
              }
            }
          }
          if (cb && !cb.checked) cb.click();
        }
      } else if (field.type === 'select') {
        const sel = document.querySelector(field.selector);
        if (sel) {
          const option = Array.from(sel.options).find(opt => opt.text === ans.answer || opt.value === ans.answer);
          if (option) { sel.value = option.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
        }
      }
    }

    await sendLog('debug', 'д15 все заполнил успешно (LLM)', { request: { fields, endpoint: settings.localLLMEndpoint }, response: llmResponse });
    return true;
  }

  async function processRankAndRespond(enrichedList) {
    let finalEnriched = enrichedList;
    if (!finalEnriched) {
      const stored = await chrome.storage.local.get('enrichedVacancies');
      finalEnriched = stored.enrichedVacancies || [];
    }
    if (!finalEnriched.length) {
      await sendLog('error', 'Нет обогащённых вакансий для обработки');
      return;
    }
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
          }, response => {
            if (response?.success) resolve(response.ranked);
            else reject(new Error(response?.error || 'Ranking failed'));
          });
        });
        await sendLog('info', 'д13 общая инфо с ранжем от дипсик', { обогащенные_вакансии_с_рангом: rankedVacancies });
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
      hhState: 'process_multiple_vacancies',
      searchUrl: window.location.href
    });
    const firstVacancy = multipleList[0];
    await sendLog('info', `д14 открыл вакансию с рейтингом ${firstVacancy.deepseek_rating ?? 'нет'}`, { url: firstVacancy.url, rating: firstVacancy.deepseek_rating });
    window.location.reload();
  }

  // ========== ОСНОВНАЯ ЛОГИКА ==========
  try {
    if (hhState === 'check_login') {
      const startTime = Date.now();
      await chrome.storage.local.set({ processStartTime: startTime });
      const profileElement = await waitForElement('[data-qa="mainmenu_profileAndResumes"]', 10000);
      if (!profileElement) {
        await sendLog('error', 'д4 не залогинен', { url: window.location.href });
        await chrome.storage.local.set({ hhState: 'error', errorMessage: 'User not logged in', hhStateTimestamp: Date.now() });
        await chrome.storage.local.remove('manualStart');
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
        await chrome.storage.local.remove('manualStart');
      }
      return;
    }

    if (hhState === 'collect_resumes') {
      await collectResumes();
      if (settings.test_vacancy && settings.test_vacancy.trim() !== '') {
        await sendLog('debug', 'д140 обнаружен дебаг', { url: settings.test_vacancy });
        await chrome.storage.local.set({ hhState: 'process_test_vacancy', hhStateTimestamp: Date.now() });
        window.location.href = settings.test_vacancy;
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
      await chrome.storage.local.set({ currentPage: 1, allVacancies: [], maxPages: settings.maxPages, hhState: 'processing_pages', hhStateTimestamp: Date.now() });
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
      let nextUrl = null;
      if (nextPage <= maxPages) {
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
          await sendLog('info', `д11 открытие вакансии для детального сбора`, { url: first.url, title: first.title });
          const currentTabId = await getCurrentTabId();
          if (currentTabId) await saveSearchTabId(currentTabId);
          const response = await openInNewTab(first.url);
          if (response?.tabId) await chrome.storage.local.set({ currentVacancyTabId: response.tabId });
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
          await chrome.storage.local.remove(['hhState', 'sessionId', 'hhStateTimestamp', 'processStartTime', 'currentPage', 'allVacancies', 'maxPages', 'vacanciesToProcess', 'currentVacancyIndex', 'maxVacanciesToProcess', 'searchUrl', 'enrichedVacancies', 'manualStart']);
        }
      }
      return;
    }

    if (hhState === 'process_test_vacancy') {
      await sendLog('debug', 'Вход в process_test_vacancy', { url: window.location.href });
      if (!window.location.href.includes('/vacancy/') && !window.location.href.includes('/applicant/vacancy_response')) {
        await sendLog('debug', 'Выход из process_test_vacancy: не вакансия и не отклик', { url: window.location.href });
        return;
      }
      await waitForElement('[data-qa="vacancy-title"]', 15000).catch(() => {});
      await randomDelay();
      const detailedInfo = await collectDetailedInfo();
      const testVacancy = { porNum: 1, url: window.location.href, title: detailedInfo.title_detail || '', company: detailedInfo.company_detail || '', ...detailedInfo };
      const enrichedVacancies = [testVacancy];
      await chrome.storage.local.set({ enrichedVacancies, searchUrl: window.location.href });
      await processRankAndRespond(enrichedVacancies);
      return;
    }

    if (hhState === 'processing_vacancies') {
      const { vacanciesToProcess, currentVacancyIndex, maxVacanciesToProcess, searchUrl, processStartTime, enrichedVacancies } = await chrome.storage.local.get([
        'vacanciesToProcess', 'currentVacancyIndex', 'maxVacanciesToProcess', 'searchUrl', 'processStartTime', 'enrichedVacancies'
      ]);
      if (!vacanciesToProcess || currentVacancyIndex >= vacanciesToProcess.length || currentVacancyIndex >= maxVacanciesToProcess) {
        const finalEnriched = enrichedVacancies || [];
        await sendLog('info', `д12 обогащенных ${finalEnriched.length} вакансий`, { обогащенные_вакансии: finalEnriched });
        await processRankAndRespond(finalEnriched);
        return;
      }
      const currentVacancy = vacanciesToProcess[currentVacancyIndex];
      if (!window.location.href.includes('/vacancy/')) {
        await randomDelay();
        await sendLog('info', `д11 открытие вакансии ${currentVacancyIndex+1} для детального сбора`, { url: currentVacancy.url, title: currentVacancy.title });
        const currentTabId = await getCurrentTabId();
        if (currentTabId) await saveSearchTabId(currentTabId);
        const response = await openInNewTab(currentVacancy.url);
        if (response?.tabId) await chrome.storage.local.set({ currentVacancyTabId: response.tabId });
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

    if (hhState === 'process_multiple_vacancies') {
      const { multipleVacanciesList, currentMultipleIndex, searchTabId, searchUrl } = await chrome.storage.local.get([
        'multipleVacanciesList', 'currentMultipleIndex', 'searchTabId', 'searchUrl'
      ]);
      if (!multipleVacanciesList || currentMultipleIndex >= multipleVacanciesList.length) {
        const { processStartTime } = await chrome.storage.local.get(['processStartTime']);
        const endTime = Date.now();
        const durationMs = endTime - processStartTime;
        const durationSec = Math.floor(durationMs / 1000);
        const minutes = Math.floor(durationSec / 60);
        const seconds = durationSec % 60;
        const durationFormatted = minutes > 0 ? `${minutes} мин ${seconds} сек` : `${seconds} сек`;
        await sendLog('info', 'д999 штатный конец работы', { итоговое_время: durationFormatted, длительность_мс: durationMs });
        await chrome.storage.local.remove(['hhState', 'sessionId', 'hhStateTimestamp', 'processStartTime', 'multipleVacanciesList', 'currentMultipleIndex', 'manualStart']);
        return;
      }
      const currentVacancy = multipleVacanciesList[currentMultipleIndex];
      const currentUrl = window.location.href;
      const isTestVacancy = settings.test_vacancy && settings.test_vacancy.trim() !== '';

      if (currentUrl.includes('/applicant/vacancy_response')) {
        let questionsProcessed = false;
        const hasQuestions = currentUrl.includes('startedWithQuestion');
        if (hasQuestions) {
          if (settings.useLocalLLM) {
            questionsProcessed = await processQuestionsPage();
            if (!questionsProcessed) {
              await sendLog('error', 'Не удалось обработать страницу с вопросами, останавливаемся');
              await chrome.storage.local.set({ hhState: 'error', errorMessage: 'Failed to process questions', hhStateTimestamp: Date.now() });
              await chrome.storage.local.remove('manualStart');
              return;
            }
          } else {
            await sendLog('info', 'д15 доп вопросы (LLM отключена, пропускаем)', { url: window.location.href });
          }
        } else {
          await sendLog('debug', 'Страница отклика без вопросов, пропускаем Д15', { url: window.location.href });
        }
        await processCoverLetterBlock();
        await processResumeSelection();
        let typeForLog = 'страница';
        const modal = document.querySelector('[aria-modal="true"][role="dialog"]');
        if (modal) {
          const modalType = await detectModalType();
          typeForLog = modalType === 'simple1' ? 'симпл1' : 'симпл2';
        }
        await sendResponse(typeForLog, isTestVacancy);
        const newIndex = currentMultipleIndex + 1;
        await chrome.storage.local.set({ currentMultipleIndex: newIndex });
        const currentTabId = await getCurrentTabId();
        if (currentTabId) await closeVacancyTab(currentTabId);
        if (searchTabId) {
          chrome.tabs.update(searchTabId, { active: true }, () => { chrome.tabs.reload(searchTabId); });
        } else if (searchUrl) {
          await openInNewTab(searchUrl);
        } else {
          window.location.reload();
        }
        return;
      }

      if (!currentUrl.includes(currentVacancy.url)) {
        if (currentMultipleIndex > 0) {
          await sendLog('debug', 'д25 открываю очередную вакансию', { vacancy: currentVacancy });
          await openInNewTab(currentVacancy.url);
        } else {
          if (!currentUrl.includes('/vacancy/')) {
            await sendLog('info', `д14 открыл вакансию с рейтингом ${currentVacancy.deepseek_rating ?? 'нет'}`, { url: currentVacancy.url, rating: currentVacancy.deepseek_rating });
            await openInNewTab(currentVacancy.url);
          }
        }
        return;
      }

      await waitForElement('[data-qa="vacancy-response-link-top"]', 10000);
      const responseButton = await findResponseButton();
      const buttonText = responseButton.innerText.trim().toLowerCase();
      await sendLog('info', `д30 на кнопке написано=${buttonText}`, { url: window.location.href });

      if (buttonText === 'откликнуться') {
        await sendLog('info', 'д30 буду откликаться, новая', { url: window.location.href });
        responseButton.click();
        let waitStart = Date.now();
        let hasQuestions = false, modalAppeared = false;
        while ((Date.now() - waitStart) < settings.waitForResponseSec * 1000) {
          await new Promise(r => setTimeout(r, 200));
          const currentUrlNow = window.location.href;
          if (currentUrlNow.includes('startedWithQuestion')) { hasQuestions = true; break; }
          if (document.querySelector('[aria-modal="true"][role="dialog"]')) { modalAppeared = true; break; }
        }
        if (hasQuestions) {
          if (settings.useLocalLLM) return;
          else {
            await sendLog('info', 'д15 доп вопросы (LLM отключена, пропускаем)', { url: window.location.href });
            const newIndex = currentMultipleIndex + 1;
            await chrome.storage.local.set({ currentMultipleIndex: newIndex });
            const currentTabId = await getCurrentTabId();
            if (currentTabId) await closeVacancyTab(currentTabId);
            if (searchTabId) {
              chrome.tabs.update(searchTabId, { active: true }, () => { chrome.tabs.reload(searchTabId); });
            } else if (searchUrl) {
              await openInNewTab(searchUrl);
            } else {
              window.location.reload();
            }
            return;
          }
        }
        if (modalAppeared) {
          await sendLog('info', 'д16 модальное окно, буду определять разновидность', { url: window.location.href });
          await new Promise(resolve => setTimeout(resolve, settings.modalWaitSec * 1000));
          const modalType = await detectModalType();
          let typeForLog = '';
          if (modalType === 'simple1') {
            typeForLog = 'симпл1';
            await sendLog('info', 'д161 модальное окно вида симпл1', { url: window.location.href });
            await insertCoverLetter(settings.coverLetter);
          } else {
            typeForLog = 'симпл2';
            await sendLog('info', 'д162 модальное окно вида симпл2(предполагаю)', { url: window.location.href });
            const modal = document.querySelector('[aria-modal="true"][role="dialog"]');
            if (modal) {
              const letterInput = modal.querySelector('[data-qa="vacancy-response-popup-form-letter-input"]');
              const resumeSelect = modal.querySelector('[data-qa="resume-title"]');
              const submitBtn = modal.querySelector('[data-qa="vacancy-response-submit-popup"]');
              const foundCount = [!!letterInput, !!resumeSelect, !!submitBtn].filter(Boolean).length;
              await sendLog('debug', `д162 нашел ${foundCount} элементов`, { letterInput: !!letterInput, resumeSelect: !!resumeSelect, submitBtn: !!submitBtn });
              if (letterInput) {
                if (letterInput.tagName === 'TEXTAREA' || letterInput.tagName === 'INPUT') {
                  letterInput.value = settings.coverLetter;
                  letterInput.dispatchEvent(new Event('input', { bubbles: true }));
                } else if (letterInput.isContentEditable) {
                  letterInput.innerText = settings.coverLetter;
                  letterInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
              }
              if (submitBtn && submitBtn.hasAttribute('disabled')) {
                await sendLog('error', 'д165 не разобрался с кнопкой', { url: window.location.href });
                await chrome.storage.local.remove(['hhState', 'sessionId', 'hhStateTimestamp', 'processStartTime', 'multipleVacanciesList', 'currentMultipleIndex', 'manualStart']);
                const { processStartTime } = await chrome.storage.local.get(['processStartTime']);
                const endTime = Date.now();
                const durationMs = endTime - processStartTime;
                const durationSec = Math.floor(durationMs / 1000);
                const minutes = Math.floor(durationSec / 60);
                const seconds = durationSec % 60;
                const durationFormatted = minutes > 0 ? `${minutes} мин ${seconds} сек` : `${seconds} сек`;
                await sendLog('info', 'д999 штатный конец работы', { итоговое_время: durationFormatted, длительность_мс: durationMs });
                return;
              }
              if (submitBtn && submitBtn.hasAttribute('disabled')) submitBtn.removeAttribute('disabled');
            }
          }
          await processResumeSelection();
          await sendResponse(typeForLog, isTestVacancy);
          const newIndex = currentMultipleIndex + 1;
          await chrome.storage.local.set({ currentMultipleIndex: newIndex });
          const currentTabId = await getCurrentTabId();
          if (currentTabId) await closeVacancyTab(currentTabId);
          if (searchTabId) {
            chrome.tabs.update(searchTabId, { active: true }, () => { chrome.tabs.reload(searchTabId); });
          } else if (searchUrl) {
            await openInNewTab(searchUrl);
          } else {
            window.location.reload();
          }
          return;
        }
        await sendLog('debug', 'дусл3 неформат', { url: window.location.href });
        await chrome.storage.local.remove(['hhState', 'sessionId', 'hhStateTimestamp', 'processStartTime', 'multipleVacanciesList', 'currentMultipleIndex', 'manualStart']);
        const { processStartTime } = await chrome.storage.local.get(['processStartTime']);
        const endTime = Date.now();
        const durationMs = endTime - processStartTime;
        const durationSec = Math.floor(durationMs / 1000);
        const minutes = Math.floor(durationSec / 60);
        const seconds = durationSec % 60;
        const durationFormatted = minutes > 0 ? `${minutes} мин ${seconds} сек` : `${seconds} сек`;
        await sendLog('info', 'д999 штатный конец работы', { итоговое_время: durationFormatted, длительность_мс: durationMs });
        return;
      } else {
        await sendLog('error', 'д30 на кнопке неизвестная надпись, останов', { url: window.location.href });
        const newIndex = currentMultipleIndex + 1;
        await chrome.storage.local.set({ currentMultipleIndex: newIndex });
        const currentTabId = await getCurrentTabId();
        if (currentTabId) await closeVacancyTab(currentTabId);
        if (searchTabId) {
          chrome.tabs.update(searchTabId, { active: true }, () => { chrome.tabs.reload(searchTabId); });
        } else if (searchUrl) {
          await openInNewTab(searchUrl);
        } else {
          window.location.reload();
        }
        await chrome.storage.local.remove('manualStart');
        return;
      }
    }

  } catch (err) {
    if (err.message !== 'STOP_EXTENSION') {
      console.error(err);
      try {
        await sendLog('error', `Ошибка: ${err.message}`, { stack: err.stack });
      } catch (logErr) {}
      const { processStartTime } = await chrome.storage.local.get(['processStartTime']);
      const endTime = Date.now();
      const durationMs = endTime - processStartTime;
      const durationSec = Math.floor(durationMs / 1000);
      const minutes = Math.floor(durationSec / 60);
      const seconds = durationSec % 60;
      const durationFormatted = minutes > 0 ? `${minutes} мин ${seconds} сек` : `${seconds} сек`;
      await sendLog('info', 'д999 штатный конец работы', { итоговое_время: durationFormatted, длительность_мс: durationMs });
      await chrome.storage.local.set({ hhState: 'error', errorMessage: err.message, hhStateTimestamp: Date.now() });
      await chrome.storage.local.remove('manualStart');
    }
  }
})();