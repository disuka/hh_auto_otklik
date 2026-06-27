// background.js - фоновый скрипт расширения для управления автоматизацией

const CONFIG = {
  minDelay: 2000,
  maxDelay: 4000,
  maxVacancies: 150,
  doneDelay: 12000,
  excludeKeywords: ['разработчик', 'реклам'],
  coverLetter: `Добрый день.
Мой профессиональный путь в сфере информационных технологий охватывает 14 лет, из которых 10 лет я проработал в Альфа-Банке, где прошёл путь от аналитика до руководителя. За это время я получил углублённую экспертизу в построении сложных высоконагруженных систем, управлении командами и автоматизации бизнес-процессов. Считаю, что мой опыт и навыки будут полезны вашей команде.
С третьего года работы начал активно развиваться в роли руководителя:
Согласовывал техническую документацию, проводил регулярные отчётные встречи перед заказчиком.
Выполнял функции TeamLead и TechLead направления, став единой точкой входа для смежных подразделений.
Руководил интеграцией множества систем (учётные системы, платформы клиентских профилей, ядро), оптимизируя их взаимодействие в процессе модернизации.
Управлял командой: предложил и реализовал объединение смежной команды, что позволило сконцентрировать экспертизу и сократить трудоёмкость на 20%.
В качестве хобби развиваю технические навыки:
Администрирую серверы на FreeBSD (Nginx/Apache, VPN, почтовые сервисы), что помогает лучше понимать задачи DevOps.
Настраиваю среду для домашних веб-приложений (HTML, DNS, СУБД).
Пишу небольшие приложения на Python, JS, PHP, C# для автоматизации, парсинга данных и обработки информации.
Активно использую AI-инструменты (KODA, DeepSeek, ChatGPT) для ускорения разработки и изучения новых подходов.
Это позволяет мне находить общий язык с техническими специалистами, точнее формулировать требования и предлагать нестандартные решения.
Чем не хотел бы заниматься? Рутинные действия снижают мою эффективность, поэтому я всегда стремлюсь их автоматизировать.
Что отличает меня:
Ориентация на результат. Беру ответственность за сложные задачи, выстраиваю в команде единый подход, что помогает избегать срывов сроков.
Проактивность. Предлагаю оптимизации на этапе оценки проекта, например, замену устаревших интеграций на целевые решения, что экономит ресурсы компании.
Нетоксичность. Умею работать в командах разного возраста, ценю обратную связь, что подтверждается карьерным ростом и высокими годовыми оценками.
Почему именно я? Ищу вакансию, где смогу применить свой управленческий, архитектурный и технический опыт. Готов решать комплексные задачи, требующие аналитического мышления, управления процессами и командами, умения вникать в детали и принимать решения в условиях неполной информации. Мне интересна смена предметной области — положительно отношусь к необходимости учиться новому.
Буду рад обсудить, как мой опыт поможет достижению ваших бизнес-целей.
В настоящее время проживаю в г. Москва, имею военный билет.
Желаемый уровень заработной платы — 300 000 рублей.
Спасибо за внимание!
Вихров Денис Валерьевич
for.vikhrov@mail.ru
`
};

// Слушатель сообщений от инжектированных скриптов (вкладки вакансий)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[MESSAGE] Получено сообщение: ' + JSON.stringify(message));
  console.log('[MESSAGE] sender.tab.id = ' + (sender.tab ? sender.tab.id : 'undefined'));
  
  if (message.action === 'responseSent') {
    console.log('[MESSAGE] Отклик отправлен, жду ' + CONFIG.doneDelay + 'мс перед закрытием вкладки');
    
    setTimeout(async () => {
      if (sender.tab && sender.tab.id) {
        try {
          await chrome.tabs.remove(sender.tab.id);
          console.log('[MESSAGE] Закрыл вкладку вакансии id=' + sender.tab.id);
        } catch (error) {
          console.log('[MESSAGE] Ошибка при закрытии вкладки: ' + error.message);
        }
      }
    }, CONFIG.doneDelay);
  }
  
  if (message.action === 'closeTab') {
    console.log('[MESSAGE] Закрыть вкладку. Причина: ' + message.reason);
    
    setTimeout(async () => {
      if (sender.tab && sender.tab.id) {
        try {
          await chrome.tabs.remove(sender.tab.id);
          console.log('[MESSAGE] Закрыл вкладку вакансии id=' + sender.tab.id);
        } catch (error) {
          console.log('[MESSAGE] Ошибка при закрытии вкладки: ' + error.message);
        }
      }
    }, 2000);
  }
});

// Случайная задержка
function randomDelay() {
  const delay = Math.floor(Math.random() * (CONFIG.maxDelay - CONFIG.minDelay + 1)) + CONFIG.minDelay;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Ожидание загрузки вкладки
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

// Правило выбора резюме (ПВР1)
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

// Основная функция автоматизации
async function startAutomation() {
  try {
    // Шаг 1: Проверка авторизации
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Текущая вкладка: ' + currentTab.url);
    
    const authResult = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: () => {
        const profileElement = document.querySelector('[data-qa="mainmenu_profileAndResumes"]');
        if (!profileElement) return { success: false };
        return { success: true };
      }
    });
    
    if (!authResult[0].result.success) {
      console.log('Не залогинен. Останов');
      return;
    }
    console.log('Авторизация подтверждена');
    
    // Шаг 2: Переход на vidnoe.hh.ru
    console.log('Переход на vidnoe.hh.ru...');
    await randomDelay();
    
    const vidnoeTab = await chrome.tabs.create({ 
      url: 'https://vidnoe.hh.ru/?hhtmFrom=main', 
      active: true 
    });
    await waitForTabLoad(vidnoeTab.id);
    await randomDelay();
    console.log('перешел на начальную страницу');
    
    // Шаг 3: Переход к списку резюме
    console.log('Переход к списку резюме...');
    await randomDelay();
    
    const resumeUrl = 'https://vidnoe.hh.ru/applicant/resumes';
    const resumeTab = await chrome.tabs.create({ url: resumeUrl, active: true });
    await waitForTabLoad(resumeTab.id);
    await randomDelay();
    console.log('перешел на список резюме');
    
    // Шаг 4: Получение списка резюме
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
    console.log('Список резюме:');
    resumeList.forEach(name => console.log('  - ' + name));
    
    if (resumeList.length === 0) {
      console.log('не нашел ни одного резюме');
      return;
    }
    
    // Обрабатываем каждое резюме
    for (let r = 0; r < resumeList.length; r++) {
      const currentResumeName = resumeList[r];
      console.log('=== Обработка резюме ' + (r+1) + '/' + resumeList.length + ': ' + currentResumeName + ' ===');
      
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
        console.log('Не нашел ссылку на резюме ' + currentResumeName);
        continue;
      }
      
      const currentResumeTab = await chrome.tabs.create({ 
        url: currentResumeUrl, 
        active: true 
      });
      await waitForTabLoad(currentResumeTab.id);
      await randomDelay();
      
      console.log('перешел на мое резюме = ' + currentResumeName + ' =');
      
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
        console.log('Ссылка на вакансии не найдена');
        await chrome.tabs.remove(currentResumeTab.id);
        continue;
      }
      
      const vacancyTab = await chrome.tabs.create({ 
        url: vacancyLink, 
        active: true 
      });
      await waitForTabLoad(vacancyTab.id);
      await randomDelay();
      
      console.log('перешел на вакансии для резюме = ' + currentResumeName + ' =');
    
      // Шаг 7: Получаем список вакансий
      console.log('Получение списка вакансий, лимит: ' + CONFIG.maxVacancies);
      
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
      console.log('Получено вакансий: ' + vacancies.length);
      
      const uniqueVacancies = [];
      const seenHrefs = new Set();
      for (const v of vacancies) {
        if (!seenHrefs.has(v.href)) {
          seenHrefs.add(v.href);
          uniqueVacancies.push(v);
        }
      }
      
      const vacanciesToProcess = uniqueVacancies.slice(0, CONFIG.maxVacancies);
      console.log('Найдено ' + vacanciesToProcess.length + ' уникальных вакансий');
      
      // Обрабатываем каждую вакансию
      for (let i = 0; i < vacanciesToProcess.length; i++) {
        const vacancy = vacanciesToProcess[i];
        
        const titleLower = vacancy.title.toLowerCase();
        const shouldExclude = CONFIG.excludeKeywords.some(keyword => titleLower.includes(keyword.toLowerCase()));
        
        if (shouldExclude) {
          console.log(vacancy.title + ' =пропущено= в соответствии с шаг7 ТЗ');
          continue;
        }
        
        console.log('Обрабатываю вакансию ' + (i+1) + '/' + CONFIG.maxVacancies + ': ' + vacancy.title);
        console.log('URL: ' + vacancy.href);
        
        const selectedResume = selectResumeByRule(vacancy.title);
        console.log('Выбрано резюме: ' + selectedResume);
        
console.log('Создаю вкладку для вакансии');
        const vacancyDetailTab = await chrome.tabs.create({ 
          url: vacancy.href,
          active: false
        });
        console.log('Создана вкладка id=' + vacancyDetailTab.id);
        
        await waitForTabLoad(vacancyDetailTab.id);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Обрабатываем вакансию
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
              console.log('Ошибка: clickResult пустой');
              await chrome.tabs.remove(vacancyDetailTab.id);
              continue;
            }
            
            if (!clickResult[0].result) {
              console.log('Не удалось нажать кнопку "откликнуться", пропускаю вакансию');
              await chrome.tabs.remove(vacancyDetailTab.id);
              continue;
            }
          } catch (injectError) {
            console.log('Ошибка при инжекции скрипта: ' + injectError.message);
            await chrome.tabs.remove(vacancyDetailTab.id);
            continue;
          }
          
          console.log('Жду 5 секунд для проверки перезагрузки страницы...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          let tabInfo;
          try {
            tabInfo = await chrome.tabs.get(vacancyDetailTab.id);
          } catch (error) {
            console.log('Вкладка уже закрыта: ' + error.message);
            continue;
          }
          
          if (tabInfo.url.includes('startedWithQuestion=false')) {
            console.log('вакансия содержит дополнительные вопросы');
            await chrome.tabs.remove(vacancyDetailTab.id);
            console.log('Закрыл вкладку с дополнительными вопросами');
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
                        console.log('Резюме ' + (i+1) + ': ' + resume.title);
                        
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
                
                // Основной таймаут после выбора резюме (увеличен для надежности)
                // Для simple1: 1500мс на выбор резюме + 2000мс на применение = 3500мс
                // Для simple2: резюме уже выбрано, но нужно время на инициализацию
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
            console.log('Ошибка при инжектировании скрипта модального окна: ' + error.message);
            await chrome.tabs.remove(vacancyDetailTab.id);
          }
        } catch (error) {
          console.log('Ошибка при обработке вакансии: ' + error.message);
          try {
            await chrome.tabs.remove(vacancyDetailTab.id);
          } catch (e) {
            console.log('Не удалось закрыть вкладку: ' + e.message);
          }
        }
      }
      
      await chrome.tabs.remove(vacancyTab.id);
      await chrome.tabs.remove(currentResumeTab.id);
      console.log('Закрыл вкладки для резюме = ' + currentResumeName + ' =');
    }
    
    console.log('=== Работа завершена ===');
    
  } catch (error) {
    console.error('Ошибка:', error.message);
    console.error('Стек:', error.stack);
  }
}

// При клике на иконку - запускаем автоматизацию
chrome.action.onClicked.addListener(async (tab) => {
  console.log('=НАЧАЛО=. был клик по иконке');
  await startAutomation();
});
