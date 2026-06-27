// background.js
const DEFAULT_SETTINGS = {
  minDelaySec: 3,
  maxDelaySec: 9,
  maxPages: 1,
  maxVacanciesToProcess: 23,
  rank_deepseek: 0,
  deepseek_timeout: 60,
  deepseek_refresh: 3,
  test_vacancy: 'https://vidnoe.hh.ru/vacancy/133953200?hhtmFrom=vacancy_response',
  modalWaitSec: 2,
  waitForResponseSec: 10,
  logUrl: 'http://localhost:8000/api/v1/logs',
  healthUrl: 'http://localhost:8000/health',
  logApiKey: 'secret-key-for-hh-browser',
  project: 'my-bot',
  token_dlya_get_config: 'token_dlya_rasshirennia',
  useLocalLLM: true,
  localLLMEndpoint: 'http://localhost:5001/v1/completions',
  localLLMModel: 'T-lite-it-2.1'
};

let currentSessionId = null;
let currentSettings = null;
let rankingCache = new Map();

function generateSessionId() {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8);
  return `${hours}:${minutes}-${random}`;
}

async function sendLog(level, message, metadata = {}) {
  if (!currentSessionId) {
    currentSessionId = generateSessionId();
    await chrome.storage.local.set({ sessionId: currentSessionId });
  }
  const settings = currentSettings || DEFAULT_SETTINGS;
  const logData = {
    project: settings.project,
    level,
    message,
    timestamp: new Date().toISOString(),
    metadata: {
      sessionId: currentSessionId,
      ...metadata
    }
  };
  const response = await fetch(settings.logUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': settings.logApiKey
    },
    body: JSON.stringify(logData)
  });
  if (response.status !== 201) {
    throw new Error(`Log server responded with ${response.status}`);
  }
}

async function isLogServerHealthy() {
  try {
    const response = await fetch(DEFAULT_SETTINGS.healthUrl);
    return response.ok;
  } catch {
    return false;
  }
}

async function getConfigViaHttp() {
  const token = DEFAULT_SETTINGS.token_dlya_get_config;
  const baseUrl = 'http://localhost:8080/get-value';
  const keys = [
    { key: 'resume', field: 'resume_text' },
    { key: 'soprovod_pismo', field: 'coverLetter' },
    { key: 'dop_info', field: 'extra_data' },
    { key: 'deepseek_api_key', field: 'deepseek_api_key' }
  ];
  const result = {};
  for (const item of keys) {
    const url = `${baseUrl}?project=disa_hh_browser_rashirenie&key_name=${item.key}`;
    try {
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status !== 200) {
        const responseText = await response.text();
        await sendLog('error', `Ошибка получения параметра ${item.key}: HTTP ${response.status}`, {
          requestUrl: url,
          responseStatus: response.status,
          responseBody: responseText.substring(0, 500),
          hint: 'просьба проверить урлы: http://localhost:8080/health и http://localhost:8080/ready'
        });
        throw new Error(`HTTP ${response.status} for ${item.key}`);
      }
      const data = await response.json();
      if (data && typeof data === 'object' && 'value' in data) {
        result[item.field] = data.value;
      } else {
        await sendLog('warn', `Параметр ${item.key} не содержит поля "value", использую как есть`, { data });
        result[item.field] = typeof data === 'string' ? data : JSON.stringify(data);
      }
    } catch (err) {
      throw new Error(`Не удалось получить конфигурацию: ${err.message}`);
    }
  }
  return result;
}

async function migrateSettings() {
  const existing = await chrome.storage.local.get('settings');
  if (!existing.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  return DEFAULT_SETTINGS;
}

async function stopExtension(tabId, shouldLog = true) {
  await chrome.storage.local.remove([
    'hhState', 'hhStateTimestamp', 'processStartTime',
    'currentPage', 'allVacancies', 'maxPages',
    'vacanciesToProcess', 'currentVacancyIndex', 'maxVacanciesToProcess',
    'searchUrl', 'enrichedVacancies', 'sessionId',
    'responseVacancyUrl', 'responseVacancyData', 'searchTabId',
    'multipleVacanciesList', 'currentMultipleIndex'
  ]);
  if (shouldLog) {
    await sendLog('info', 'РАСШИРЕНИЕ ОСТАНОВЛЕНО ПОЛЬЗОВАТЕЛЕМ', {});
  }
  if (tabId) {
    chrome.tabs.reload(tabId);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "stop_hh_auto",
    title: "Остановить HH Auto",
    contexts: ["action"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "stop_hh_auto") {
    await stopExtension(tab.id, true);
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  // Устанавливаем флаг ручного запуска (без временной метки)
  await chrome.storage.local.set({ manualStart: true });
  await stopExtension(tab.id, false);
  currentSessionId = generateSessionId();
  await chrome.storage.local.set({ sessionId: currentSessionId });
  const healthy = await isLogServerHealthy();
  if (!healthy) {
    console.error('Сервер логирования недоступен, работа остановлена');
    return;
  }
  let settings = await migrateSettings();
  let config;
  try {
    config = await getConfigViaHttp();
  } catch (err) {
    await sendLog('error', `д0: ${err.message}`, {});
    return;
  }
  currentSettings = { ...settings, ...config };
  await chrome.storage.local.set({ settings: currentSettings });
  await sendLog('info', 'д1 начало', { settings: currentSettings });
  await chrome.storage.local.set({
    hhState: 'check_login',
    hhStateTimestamp: Date.now(),
    processStartTime: Date.now()
  });
  chrome.tabs.reload(tab.id);
});

function extractJsonFromText(text) {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = text.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonCandidate);
    } catch (e) {}
  }
  const regex = /\{[\s\S]*\}/;
  const match = text.match(regex);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (e) {}
  }
  return null;
}

function prepareVacanciesForRanking(vacancies) {
  return vacancies.map(vac => ({
    url: vac.url,
    title: vac.title || vac.title_detail || '',
    company: vac.company || vac.company_detail || '',
    fullDescription: vac.fullDescription_detail || ''
  }));
}

async function callDeepSeekWithRetry(prompt, apiKey, timeoutSec, retries) {
  let lastError = null;
  let tokensUsed = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutSec * 1000);

    const requestBody = {
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    };
    const bodyString = JSON.stringify(requestBody);
    const requestSizeKB = (bodyString.length / 1024).toFixed(2);
    const startTime = Date.now();

    await sendLog('info', 'д13. буду отправлять в дипсик', {
      url: 'https://api.deepseek.com/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: requestBody,
      attempt: attempt + 1,
      request_size_kb: requestSizeKB
    });

    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: bodyString,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

      if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`);
      const data = await response.json();
      tokensUsed = data.usage;

      await sendLog('debug', 'д13 ответ от дипсик (сырой)', {
        ...data,
        elapsed_seconds: elapsedSec
      });

      const content = data.choices[0].message.content;
      const parsed = extractJsonFromText(content);
      if (parsed) return { result: parsed, tokens: tokensUsed };

      if (attempt < retries) {
        await sendLog('warn', `DeepSeek вернул невалидный JSON, повторная попытка ${attempt+1}`, { content });
        prompt = prompt + "\n\nВАЖНО: Верни ТОЛЬКО валидный JSON. Никаких пояснений, только JSON. Начинай с { и заканчивай }.";
        continue;
      }
      throw new Error(`Не удалось извлечь JSON из ответа DeepSeek: ${content}`);
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      if (attempt < retries) {
        await sendLog('warn', `Ошибка вызова DeepSeek, попытка ${attempt+1}: ${err.message}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  await sendLog('error', 'д13 дипсик не отвечает', { error: lastError?.message });
  throw lastError;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LOG') {
    sendLog(message.level, message.message, message.metadata)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'GET_STATE') {
    (async () => {
      let sessionId = currentSessionId;
      if (!sessionId) {
        const stored = await chrome.storage.local.get('sessionId');
        sessionId = stored.sessionId || null;
      }
      const stored = await chrome.storage.local.get(['settings', 'hhState']);
      sendResponse({
        settings: stored.settings || currentSettings,
        sessionId: sessionId,
        hhState: stored.hhState || null
      });
    })();
    return true;
  }

  if (message.type === 'SAVE_SEARCH_URL') {
    chrome.storage.local.set({ searchUrl: message.url });
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'GET_CURRENT_TAB_ID') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        sendResponse({ tabId: tabs[0].id });
      } else {
        sendResponse({ tabId: null });
      }
    });
    return true;
  }

  if (message.type === 'OPEN_NEW_TAB') {
    chrome.tabs.create({ url: message.url, active: true }, (tab) => {
      sendResponse({ success: true, tabId: tab.id });
    });
    return true;
  }

  if (message.type === 'CLOSE_VACANCY_TAB') {
    const vacancyTabId = message.tabId;
    if (vacancyTabId) {
      chrome.tabs.remove(vacancyTabId, async () => {
        setTimeout(async () => {
          const { searchTabId } = await chrome.storage.local.get('searchTabId');
          if (searchTabId) {
            chrome.tabs.reload(searchTabId);
          } else {
            const { searchUrl } = await chrome.storage.local.get('searchUrl');
            if (searchUrl) {
              const tabs = await chrome.tabs.query({ url: searchUrl });
              if (tabs.length > 0) {
                chrome.tabs.reload(tabs[0].id);
              }
            }
          }
        }, 1000);
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: false, error: 'No tabId provided' });
    }
    return true;
  }

  if (message.type === 'SAVE_SEARCH_TAB_ID') {
    chrome.storage.local.set({ searchTabId: message.tabId });
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'RANK_VACANCIES') {
    (async () => {
      try {
        const settings = currentSettings || await migrateSettings();
        if (!settings.deepseek_api_key || settings.rank_deepseek !== 1) {
          sendResponse({ success: false, error: 'DeepSeek ranking disabled or no API key' });
          return;
        }
        const { vacancies, resume, coverLetter, extraData } = message;

        const cleanedVacancies = prepareVacanciesForRanking(vacancies);

        const prompt = `Ты — эксперт по найму ИТ-специалистов. Проанализируй следующие вакансии и определи, насколько они подходят кандидату.

Резюме кандидата:
${resume}

Сопроводительное письмо:
${coverLetter}

Дополнительные данные о кандидате:
${extraData}

Вакансии (в формате JSON):
${JSON.stringify(cleanedVacancies, null, 2)}

Задача: для каждой вакансии присвой рейтинг от 0 до 100 (0 — не подходит, 100 — идеально подходит) и напиши краткое обоснование (до 1000 символов). Верни результат в формате JSON, где ключи — URL вакансий, а значение — объект с полями "deepseek_rating" и "reason". Не включай в ответ ничего, кроме JSON.`;

        await sendLog('info', 'д13. буду отправлять в дипсик (контекст)', {
          vacancies_count: vacancies.length,
          vacancies_urls: vacancies.map(v => v.url),
          resume_length: resume.length,
          coverLetter_length: coverLetter.length,
          extraData_length: extraData.length,
          prompt_length: prompt.length,
          prompt: prompt
        });

        const cacheHits = [];
        const cacheMisses = [];
        const vacanciesToRank = [];
        for (const vac of vacancies) {
          const cached = rankingCache.get(vac.url);
          if (cached) {
            cacheHits.push({ url: vac.url, rating: cached.rating, reason: cached.reason });
          } else {
            cacheMisses.push(vac.url);
            vacanciesToRank.push(vac);
          }
        }

        let deepseekResult = {};
        for (const hit of cacheHits) {
          deepseekResult[hit.url] = { deepseek_rating: hit.rating, reason: hit.reason };
        }

        if (vacanciesToRank.length > 0) {
          const cleanedToRank = prepareVacanciesForRanking(vacanciesToRank);
          const promptForNew = `Ты — эксперт по найму ИТ-специалистов. Проанализируй следующие вакансии и определи, насколько они подходят кандидату.

Резюме кандидата:
${resume}

Сопроводительное письмо:
${coverLetter}

Дополнительные данные о кандидате:
${extraData}

Вакансии (в формате JSON):
${JSON.stringify(cleanedToRank, null, 2)}

Задача: для каждой вакансии присвой рейтинг от 0 до 100 (0 — не подходит, 100 — идеально подходит) и напиши краткое обоснование (до 1000 символов). Верни результат в формате JSON, где ключи — URL вакансий, а значение — объект с полями "deepseek_rating" и "reason". Не включай в ответ ничего, кроме JSON.`;
          const { result } = await callDeepSeekWithRetry(promptForNew, settings.deepseek_api_key, settings.deepseek_timeout, settings.deepseek_refresh);
          for (const [url, value] of Object.entries(result)) {
            const rating = typeof value === 'object' ? (value.deepseek_rating ?? value.my_rating ?? value.rating ?? 0) : value;
            const reason = typeof value === 'object' ? (value.reason ?? '') : '';
            rankingCache.set(url, { rating: rating, reason: reason });
            deepseekResult[url] = { deepseek_rating: rating, reason: reason };
          }
        }

        const finalRanked = vacancies.map(vac => ({
          ...vac,
          deepseek_rating: deepseekResult[vac.url]?.deepseek_rating ?? 0,
          reason: deepseekResult[vac.url]?.reason ?? ''
        }));

        sendResponse({ success: true, ranked: finalRanked });
      } catch (err) {
        await sendLog('error', `Ошибка ранжирования: ${err.message}`);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'CALL_LLM') {
    (async () => {
      try {
        const { fields, endpoint } = message;
        const resume_text = currentSettings?.resume_text || '';
        const coverLetter = currentSettings?.coverLetter || '';
        const extra_data = currentSettings?.extra_data || '';

        const prompt = `Ответь на вопросы, используя только данные из резюме, сопроводительного письма и доп. информации. Верни JSON-массив.

Пример правильного ответа:
[{"question": "Укажите зарплатные ожидания", "answer": "300000"}]

Резюме:
${resume_text}

Письмо:
${coverLetter}

Доп.инфо:
${extra_data}

Вопросы:
${JSON.stringify(fields, null, 2)}

JSON-массив:`;

        await sendLog('debug', 'д15 отправка в локальную llm', {
          endpoint,
          fieldsCount: fields.length,
          promptLength: prompt.length,
          prompt: prompt
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt,
            max_tokens: 512,
            temperature: 0.0,
            top_p: 0.0,
            stop: ['<|im_end|>']
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        let content = data.choices[0].text;

        await sendLog('debug', 'д15 ответ от local llm', {
          content: content
        });

        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const answers = JSON.parse(jsonMatch[0]);
            await sendLog('info', 'LLM успешно сформировала ответы', { answersCount: answers.length });
            sendResponse({ success: true, answers });
          } catch (e) {
            sendResponse({
              success: false,
              invalidJson: true,
              content: content,
              request: { fields, resume_text, coverLetter, extra_data, endpoint, prompt }
            });
          }
        } else {
          sendResponse({
            success: false,
            invalidJson: true,
            content: content,
            request: { fields, resume_text, coverLetter, extra_data, endpoint, prompt }
          });
        }
      } catch (err) {
        await sendLog('error', `д15 Ошибка при вызове локальной LLM: ${err.message}`);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});