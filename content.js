// content.js - основной скрипт автоматизации HH.ru

const CONFIG = {
  // Минимальная и максимальная задержка между действиями (в миллисекундах)
  minDelay: 2000,
  maxDelay: 4000,
  
  // Текст сопроводительного письма
  coverLetter: `Добрый день.
Мой профессиональный путь в банковской сфере охватывает 14 лет, из которых 10 лет я посвятил работе в Альфа-Банке. За это время я прошел путь от аналитика до руководителя, совмещая углубленную экспертизу в банковских системах и процессах с управленческими задачами. Считаю, что мой опыт и навыки могут принести значимую пользу вашей команде.
С 3-го года работы в Альфа-Банке начал развиваться в роли руководителя:
- Согласовывал техническую документацию аналитиков, проводил регулярные отчетные встречи о работе подразделения перед заказчиком;
- Проводил планирование и декомпозицию задач, выполнял функции TeamLead и TeachLead направления, это позволило явно обозначить меня для остальных подразделений банка единой точкой входа по разным вопросам;
- Руководил интеграцией всех систем направления (например, кредитного скоринга, платформ клиентских профилей, ядра АБС), оптимизировав их взаимодействие с нашим направлением в течение их апгрейда;
- Руководил командами. Например, предложил принять под свое управление смежную команду и согласовал решение с руководством. Это позволило в одной команде сосредоточить экспертизу по смежным системам. Подход сократил трудоемкости по задачам на 20%;
В качестве хобби развиваю навыки в ИТ: 
- Администрирую сервера на FreeBSD (настройка Nginx/Apache, VPN, почтовых сервисов), что помогает лучше понимать задачи DevOps-команд;
- Настраиваю среду для домашних веб-приложений (HTML верстка, DNS, СУБД);
- Разрабатываю небольшие приложения на Python, JS, PHP и C# для личных задач (например, парсинг данных, ввод/хранение/обработка).
Это позволяет мне находить общий язык с техническими специалистами, точнее формулировать требования и предлагать нестандартные решения.
Чем бы не хотел заниматься?
Снижают мою эффективность рутинные действия, поэтому стараюсь их автоматизировать/оптимизировать.
Что отличает меня:
- Ориентация на результат. Не боюсь брать на себя ответственность за сложные задачи. При выстраивании в команде единого подхода к задаче (на результат), получалось избегать срывов графиков проектов;
- Проактивность. Если вижу возможность оптимизации — предлагаю варианты на этапе оценки проекта. Например, в некоторых проектах брали в работу замену Legacy-интеграций на целевые решения. Это позволило сэкономить ресурсы банка на отдельные задачи по приведению к стандарту организации;
- Нетоксичность. Умею работать в команде разных возрастов, ценю обратную связь от коллег и подчинённых, что подтверждается моим карьерным ростом и повышенными годовыми оценками.
Почему именно я?
Ищу вакансию, где смогу применять как экспертизу в банковской сфере, административные, управленческие, так и технические навыки. Готов решать комплексные задачи, где требуется аналитическое мышление, управление процессами/командами, умение вникать в детали и принимать решения при недостатке информации.
Хотелось бы сменить предметную область, т.к. начинает "замыливаться" взгляд. Положительно отношусь к необходимости учиться новому.
Буду рад обсудить, как мой опыт поможет достижению ваших бизнес-целей. 
Спасибо за внимание!
Вихров Денис Валерьевич.
for.vikhrov@mail.ru`
};

function randomDelay() {
  const delay = Math.floor(Math.random() * (CONFIG.maxDelay - CONFIG.minDelay + 1)) + CONFIG.minDelay;
  return new Promise(resolve => setTimeout(resolve, delay));
}

function waitForPageLoad() {
  return new Promise(resolve => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve);
  });
}

function findElementByText(text, tagName) {
  tagName = tagName || '*';
  const elements = document.querySelectorAll(tagName);
  const lowerText = text.toLowerCase();
  for (const el of elements) {
    if (el.textContent.toLowerCase().includes(lowerText)) return el;
  }
  return null;
}

// ============================================================
// ПРАВИЛО ВЫБОРА РЕЗЮМЕ (ПВР1)
// ============================================================

/**
 * Правило выбора резюме (ПВР1)
 * @param {string} vacancyTitle - название вакансии
 * @returns {string} - название резюме для отклика
 */
function selectResumeByRule(vacancyTitle) {
  const title = vacancyTitle.toLowerCase();
  
  // Выбрать резюме "Аналитик", если в названии вакансии есть "аналитик"
  if (title.includes('аналитик')) {
    return 'Аналитик';
  }
  
  // Выбрать резюме "Руководитель проектов", если есть "проект", "менеджер", "Project Manager"
  if (title.includes('проект') || title.includes('менеджер') || title.includes('project manager')) {
    return 'Руководитель проектов';
  }
  
  // Во всех остальных случаях выбрать "Руководитель направления"
  return 'Руководитель направления';
}

// ============================================================
// ОСНОВНОЙ АЛГОРИТМ
// ============================================================

async function startHHAutomation() {
  console.log('=== Начало работы HH Auto Extension ===');
  
  try {
    // Шаг 1: Проверка авторизации на ТЕКУЩЕЙ странице
    await checkLogin();
    
    // Шаг 2: Переход на vidnoe.hh.ru
    await goToVidnoe();
    
    // Шаг 3: Переход к списку резюме
    await goToResumeList();
    
    // Шаг 4: Получение списка резюме
    const resumeNames = await getResumeList();
    console.log('Список резюме:');
    resumeNames.forEach(name => console.log('  - ' + name));
    
    // Шаг 5: Проверка наличия резюме "Аналитик"
    const analystResume = resumeNames.find(name => name.toLowerCase().includes('аналитик'));
    
    if (!analystResume) {
      console.log('резюме =Аналитик= не найдено');
      return;
    }
    
    // Шаг 6: Клик по резюме "Аналитик"
    await clickOnResume('Аналитик');
    console.log('перешел на мое резюме =Аналитик=');
    
    // Шаг 7: Поиск ссылки на вакансии для резюме
    await goToVacanciesForResume();
    
    // Шаг 8: Обработка вакансий (первые 10)
    await processVacancies();
    
    console.log('=== Работа завершена ===');
    
  } catch (error) {
    console.error('Ошибка:', error.message);
  }
}

// Проверка авторизации - ищем элемент навигационного меню
async function checkLogin() {
  console.log('Проверка авторизации...');
  await randomDelay();
  
  // Ищем элемент навигационного меню с атрибутом data-qa="mainmenu_profileAndResumes"
  const profileElement = document.querySelector('[data-qa="mainmenu_profileAndResumes"]');
  
  if (!profileElement) {
    console.log('Не залогинен. Останов');
    throw new Error('Не залогинен');
  }
  
  // Сохраняем ссылку на список резюме
  window.hhResumeLink = profileElement.href;
  
  // Если ссылка пустая, пробуем найти резюме на текущей странице
  if (!window.hhResumeLink) {
    console.log('Ссылка на резюме не найдена в элементе меню, используем прямой URL');
    window.hhResumeLink = 'https://hh.ru/applicant/resumes';
  }
  
  console.log('Авторизация подтверждена. Ссылка на резюме: ' + window.hhResumeLink);
}

async function goToVidnoe() {
  console.log('Переход на vidnoe.hh.ru...');
  await randomDelay();
  
  window.open('https://vidnoe.hh.ru/?hhtmFrom=main', '_blank');
  await randomDelay();
  await waitForPageLoad();
  await randomDelay();
  
  console.log('перешел на начальную страницу');
}

async function goToResumeList() {
  console.log('Переход к списку резюме...');
  console.log('Текущий URL: ' + window.location.href);
  await randomDelay();
  
  // Проверяем, не находимся ли мы уже на странице резюме
  if (window.location.href.includes('/applicant/resumes')) {
    console.log('Уже на странице списка резюме');
    console.log('перешел на список резюме');
    return;
  }
  
  // Используем сохраненную ссылку
  const resumeUrl = window.hhResumeLink || 'https://hh.ru/applicant/resumes';
  console.log('Открываю URL: ' + resumeUrl);
  
  // Открываем в новой вкладке
  const resumeTab = window.open(resumeUrl, '_blank');
  
  if (!resumeTab) {
    // Если заблокировано - переходим в текущей
    console.log('Окно заблокировано, перехожу в текущей вкладке');
    window.location.href = resumeUrl;
    await waitForPageLoad();
    await randomDelay();
    console.log('перешел на список резюме');
    return;
  }
    
  // Сообщаем пользователю что нужно переключиться
  console.log('>>> ПЕРЕКЛЮЧИТЕСЬ НА ВКЛАДКУ С РЕЗЮМЕ И ЗАПУСТИТЕ СКРИПТ СНОВА <<<');
  console.log('После переключения откройте консоль (F12) и вставьте код скрипта');
  
  // Сохраняем состояние для продолжения
  window.hhResumeUrl = resumeUrl;
  window.hhResumeData = [];
  
  throw new Error('Переключитесь на вкладку с резюме');
}
  
// Алгоритм выбора всех резюме (АВВР1) - 2026 год
async function getResumeList() {
  console.log('Получение списка резюме...');
  console.log('Текущий URL: ' + window.location.href);
  await randomDelay();
  
  // Ждём загрузки контента (резюме могут загружаться динамически)
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const resumeData = [];
  
  // Ищем все карточки резюме по атрибуту data-qa, начинающемуся с "resume-card-link-"
  let resumeCards = document.querySelectorAll('[data-qa^="resume-card-link-"]');
  
  console.log('Найдено карточек резюме (data-qa^="resume-card-link-"): ' + resumeCards.length);
  
  // Если не найдено, пробуем другие селекторы
  if (resumeCards.length === 0) {
    console.log('Пробуем альтернативные селекторы...');
    
    // Пробуем найти ссылки на резюме по href
    const resumeLinks = document.querySelectorAll('a[href*="/resume/"]');
    console.log('Найдено ссылок на резюме: ' + resumeLinks.length);
    
    // Пробуем найти контейнеры резюме
    const resumeContainers = document.querySelectorAll('[data-qa*="resume"]');
    console.log('Найдено элементов с resume: ' + resumeContainers.length);
    
    // Пробуем искать по class name
    const byClass = document.querySelectorAll('.resume-card, [class*="resume"]');
    console.log('Найдено по class: ' + byClass.length);
  }
  
  // Функция для извлечения данных из карточки резюме
  function extractResumeData(card) {
    const href = card.href || '';
    if (!href.includes('/resume/')) return null;
    
    // Пробуем разные способы получить должность
    let title = '';
    
    // Способ 1: data-qa="resume-title" -> data-qa="cell-text-content"
    const titleEl = card.querySelector('[data-qa="resume-title"]');
    if (titleEl) {
      const titleContentEl = titleEl.querySelector('[data-qa="cell-text-content"]');
      title = titleContentEl ? titleContentEl.textContent.trim() : '';
    }
    
    // Способ 2: просто текст ссылки
    if (!title) {
      title = card.textContent.trim().split('\n')[0].substring(0, 100);
    }
    
    // Способ 3: ищем заголовок h2/h3
    if (!title) {
      const heading = card.querySelector('h2, h3');
      title = heading ? heading.textContent.trim() : '';
    }
    
    // Описание
    let description = '';
    const descEl = card.querySelector('[data-qa="title-description"]');
    if (descEl) {
      const descContentEl = descEl.querySelector('[data-qa="cell-text-content"]');
      description = descContentEl ? descContentEl.textContent.trim() : '';
    }
    
    return { title, description, href };
  }
  
  resumeCards.forEach(card => {
    const data = extractResumeData(card);
    if (data && data.title && !resumeData.some(r => r.title === data.title)) {
      resumeData.push(data);
    }
  });
  
  // Если не нашли по основному селектору, пробуем искать по ссылкам
  if (resumeData.length === 0) {
    console.log('Ищу резюме по альтернативному методу...');
    const allLinks = document.querySelectorAll('a[href*="/resume/"]');
    
    allLinks.forEach(link => {
      const href = link.href;
      const title = link.textContent.trim().split('\n')[0].substring(0, 100);
      
      if (title && title.length > 2 && !resumeData.some(r => r.title === title)) {
        resumeData.push({ title, description: '', href });
      }
    });
  }
  
  // Сохраняем для использования в clickOnResume
  window.hhResumeData = resumeData;
  
  console.log('Список резюме:');
  resumeData.forEach(r => console.log('  - ' + r.title + ' | ' + r.description));
  
  // Если ни одного резюме не найдено
  if (resumeData.length === 0) {
    console.log('не нашел ни одного резюме на url=' + window.location.href);
    console.log('останов');
    throw new Error('Резюме не найдены');
  }
  
  // Возвращаем массив названий для совместимости
  return resumeData.map(r => r.title);
}

// Клик по резюме - использует данные из getResumeList
async function clickOnResume(resumeName) {
  await randomDelay();
  
  // Используем сохранённые данные резюме
  const resumeData = window.hhResumeData || [];
  
  const found = resumeData.find(r => r.title.toLowerCase().includes(resumeName.toLowerCase()));
  
  if (found) {
    // Переходим в текущей вкладке
    window.location.href = found.href;
    await waitForPageLoad();
    await randomDelay();
    console.log('перешел на мое резюме =Аналитик=');
    return;
  }
    
  // Фолбек: ищем по всем ссылкам, если данные не найдены
  const resumeLinks = document.querySelectorAll('a');
  
  for (const link of resumeLinks) {
    if (link.textContent.toLowerCase().includes(resumeName.toLowerCase())) {
      window.location.href = link.href;
      await waitForPageLoad();
      await randomDelay();
      console.log('перешел на мое резюме =Аналитик=');
      return;
    }
  }
    
  throw new Error('Резюме ' + resumeName + ' не найдено');
}

async function goToVacanciesForResume() {
  console.log('Поиск ссылки на вакансии...');
  await randomDelay();
  
  const allLinks = document.querySelectorAll('a');
  let vacancyLink = null;
  
  for (const link of allLinks) {
    const text = link.textContent.toLowerCase();
    const href = link.href || '';
    
    if (text.includes('подобрали для вас') && text.includes('подходящие вакансии')) {
      vacancyLink = link;
      break;
    }
    
    if (href.includes('/search/vacancy') && href.includes('resume=')) {
      vacancyLink = link;
      break;
    }
  }
  
  if (!vacancyLink) {
    throw new Error('Ссылка на вакансии не найдена');
  }
  
  // Переходим в текущей вкладке
  window.location.href = vacancyLink.href;
  await randomDelay();
  await waitForPageLoad();
  
  console.log('перешел на вакансии для резюме =Аналитик=');
}

async function processVacancies() {
  await randomDelay();
  
  // Находим ссылки на вакансии
  const allLinks = document.querySelectorAll('a');
  const vacancies = [];
  
  for (const link of allLinks) {
    if (vacancies.length >= 10) break;
    const href = link.href || '';
    if (href.includes('/vacancy/') && !href.includes('click') && !href.includes('hot')) {
      const title = link.textContent.trim();
      if (title && title.length > 5) {
        vacancies.push({ href, title });
      }
    }
  }
  
  console.log('Найдено ' + vacancies.length + ' вакансий');
  
  // Обрабатываем каждую вакансию по очереди
  for (const vacancy of vacancies) {
    console.log('Обрабатываю вакансию: ' + vacancy.title);
    
    // Открываем вакансию в новой вкладке
    const newWindow = window.open(vacancy.href, '_blank');
    if (!newWindow) {
      window.location.href = vacancy.href;
    }
    await randomDelay();
    
    // Ждём загрузки
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Обрабатываем текущую страницу вакансии
    await processCurrentVacancy(vacancy.title);
  }
  
  console.log('Все вакансии обработаны');
}

// Обработка вакансии на текущей странице (без chrome.tabs API)
async function processCurrentVacancy(vacancyTitle) {
  try {
    // Правило выбора резюме (ПВР1)
    const selectedResumeName = selectResumeByRule(vacancyTitle);
    console.log('Для вакансии "' + vacancyTitle + '" выбрано резюме: ' + selectedResumeName);
    
    // Текст сопроводительного письма
    const coverLetter = CONFIG.coverLetter;
    
    // Ищем кнопку "откликнуться"
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
      return;
    }
    
    console.log('кнопку =откликнуться= нашел, сейчас буду нажимать');
    respondButton.click();
    
    await new Promise(r => setTimeout(r, 2500));
    
    console.log('после нажатия на =откликнуться= все загружено успешно');
    
    const modal = document.querySelector('[role="dialog"], .modal, .popup');
    const selectResume = document.querySelector('select[name*="resume"], select#resume');
    
    if (selectResume) {
      console.log('открылось модельное');
      
      // if1.1: Проверяем, что в модальном окне нет никаких полей ввода
      const inputs = modal ? modal.querySelectorAll('input, textarea') : [];
      if (inputs.length > 0) {
        console.log('есть непонятные поля ввода');
        return;
      }
      
      // if1: Выбираем резюме в выпадающем списке
      const resumeOptions = selectResume.querySelectorAll('option');
      let selectedOption = null;
      
      // Ищем опцию с выбранным резюме
      for (const option of resumeOptions) {
        const optionText = option.textContent.toLowerCase();
        if (optionText.includes(selectedResumeName.toLowerCase())) {
          selectedOption = option;
          break;
        }
      }
      
      if (selectedOption) {
        selectedOption.selected = true;
        selectResume.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(r => setTimeout(r, 500));
      }
      
      // if1.2: Нажимаем кнопку "Добавить сопроводительное"
      const addLetterBtn = Array.from(modal ? modal.querySelectorAll('button, a, span') : []).find(btn => btn.textContent.toLowerCase().includes('добавить сопроводительн'));
      
      if (addLetterBtn) {
        addLetterBtn.click();
        await new Promise(r => setTimeout(r, 1500));
        
        const newInputs = modal ? modal.querySelectorAll('input, textarea') : [];
        if (newInputs.length !== 1) {
          console.log('есть непонятные поля ввода2');
          return;
        }
        
        // if1.3: Вставляем текст сопроводительного письма
        const textArea = modal.querySelector('textarea');
        if (textArea) {
          textArea.value = coverLetter;
        }
      }
    } else {
      // if2: если после нажатия кнопки "откликнуться" открывается страница с дополнительными вопросами
      const questions = document.querySelectorAll('[data-qa*="question"], .question, .quiz-question');
      console.log('вакансия содержит ' + questions.length + ' дополнительных вопросов');
    }
  } catch (error) {
    console.error('Ошибка при обработке вакансии: ', error.message);
  }
}

// Автозапуск
console.log('HH Auto готов к работе');
startHHAutomation();
