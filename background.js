// background.js
const DEFAULT_SETTINGS = {
  minDelaySec: 1,
  maxDelaySec: 5,
  maxPages: 2,
  maxVacanciesToProcess: 20,
  rank_deepseek: 1,
  deepseek_timeout: 60,
  deepseek_refresh: 3,
  deepseek_api_key: 'sk-a24c0f7066c349aa918d1a2ef44347bf',
  test_vacancy: '',
  modalWaitSec: 2,
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
Вихров Денис Валерьевич. for.vikhrov@mail.ru`,
  resume_text: `Вихров Денис
Мужчина
+7 (995) 1141720
for.vikhrov@mail.ru — предпочитаемый способ связи
telegram: @job2d
Git: https://github.com/disuka

Проживает: Москва, м. Царицыно
Гражданство: Россия, есть разрешение на работу: Россия
Не готов к переезду, готов к редким командировкам

Специализации:
Руководитель отдела аналитики
Руководитель проектов
Аналитик
Руководитель проктов
Начальник Отдела
Начальник Управления
Тимлид
Руководитель аналитиков
Архитектор

Формат работы: на месте работодателя, удалённо, гибрид
Желательное время в пути до работы: не имеет значения

Опыт работы — 23 года 4 месяца
Производство бытовой техники
Москва

Электроника, приборостроение, бытовая техника, компьютеры и оргтехника

Бытовая техника, электроника, климатическое оборудование (производство)
Июнь 2024 — настоящее время 2 года

Руководитель управления информационных технологий

Принимал участие в организации/поддержке необходимой инфраструктуре (облачные решения: почта, сайт, бухгалтерия)
Принимал участие в разработке и поддержке процессов производства
Принимал участие в найме сотрудников
Принимал участие в разработке стратегии направления с учетом потребностей рынка

Собственникам не удалось запустить процесс производста, поэтому я не смог реализовать свои навыки и умения

Альфа-Банк (Россия)
Москва, www.alfabank.ru

Финансовый сектор

Банк
Июнь 2013 — Июль 2023 10 лет 2 месяца

старший -> ведущий -> главный системный аналитик -> архитектор направления -> руководитель направления(4 года)

Развитие направлений Центра Поддержки Клиентов и Collection в АЛЬФА-БАНКЕ со стороны ИТ.
Высоконагруженные системы.

старший -> ведущий -> главный системный аналитик -> архитектор направления -> руководитель направления(4 года)

Чем я занимался:
- руководил командой (аналитика, разработка, тестирование): управлял бэклогом задач (Jira), выполнял контроль сроков. 12 человек (2 разработчика, 1 тестировщик, 9 аналитиков);
- команда являлась единой точкой входа для заказчиков, управлял ожиданиями/приоритизацией, решал конфликтные ситуации, находил варианты Win-Win;
- организовал внутри команды обмен экспетизой (звездные карты, отказ от "звездочек"), повышал квалификацию команды (организовывал/согласовывал внешнее/внутреннее обучение, проводил ретро);
- находил и внедрял внтури подразделения оптимальные процессы производства Agile/Waterfall (длины/форматы спринтов, форматы досок, планерок, дробил/увеливал команду, методики Scrum/Kanban);
- проводил собеседования новых сотрудников/оптимизировал команду;
- подготавливал материалы и защищал решения на архитектурном комитете банка;
- проводил встречи 1-1 с сотрудниками/ был наставником;
- анализировал существующие решения в области ИТ (направление - взыскание задолженности);
- анализировал бизнес-процессы в банке, проводил аудит процессов на местах сотрудников, подготавливал рекомендации по оптимизации процессов и ПО;
- команда принимала участие в разработке ПО "Contact" для целей взыскания на основе выкупленного кода иностранной организации, ушедшей с РФ рынка в связи с санкциями;
- руководил созданием Pipeline CI/CD для автоматизации тестирования и внедрения, что способствовало более быстрой и надежной доставке функционала. Jenkins был интегрирован с Git, позволял мониторить процессы сборок и тестов;
- участвовал в тендерных процедурах по выбору поставщика решений;
- оптимизировал внутри направления жизненный цикл ПО;
- разрабатывал/согласовывал/направлял в работу проектную и техническую документацию (BRD/FSD/ТЗ/дорожные карты/BPMN/UML) на модификацию/создание нового функционала (redmine/LotusNotes/SharePoint/Confluence);
- организовывал/проводил/контролировал функциональное/бизнес/интеграционное/нагрузочное тестирование;
- организовывал работы по внедрению разработанных решений (составлял/контролировал планы ОТМ, проводил/планировал ОПЭ, передавал на сопровождение, закрывал задачи);
- выполнял работы по ведению проекта (PM), использовал стандарт ANSI PMI PMBOK;
- в качестве архитектора направления принимал решения о способах интеграции систем на основе требований проекта (файл/Kafka/MQ/WS/ptp/Redis/CDC)
- проводил для заказчика регулярные отчетные встречи о работе направления;
- выполнял функции TeamLead команды: формулировал задачи, контролировал документы, планировал работы, разрабатывал концептуальные/архитектурные схемы (z.B. ОТАР);
- работал с вендорами (ставил задачи, контролировал выполнение, принимал работы, проводил общие коммуникации);
- являясь лидером в экспертизе по направлению Collection, курировал все активности своего направления (порядка 15 проектов), не считая текущей деятельности (дефекты/настройки/пилоты);
- участвовал в разработке/декомпозиции стратегии банка по своему направлению;
- обеспечивал интеграции (дефекты, доработки, внедрения, вывод) ПО Collection с различными внешними системами банка (~20 систем: DWH/ядро/учетные/расчетные);
- работал с веб-сервисами/разрабатывал веб-сервисы/обучал принципам работы: Rest и Soap (WSDL, xsd). SoapUI, Insomnia, микросервисы/монолит;
- IIB(WBI) - модифицировал/создавал компоненты на интеграционной шине банка;
- IVR - ставил задачи/контролировал ход разработки/тестировал/внедрял;
- планировал и закупал оборудование, организовывал ввод новых серверов в промышленную эксплуатацию, управлял балансировкой нагрузки (F5), анализировал производительность кластерных решений (JBoss, Web Access Spere, HP-UX, Red Hat);
- использовал экспертизу SQL для анализа данных (вложенные join, оконные функции, cte) и оптимизации запросов (план запроса, хинты Oracle)
- работал с AS/400 консоль, СУБД IBM DB2, MSSQL, MySql, PostgreSQL, Oracle, MongoDB.
- работал с ПО Debt Manager от компании FICO по взысканию задолженности.

Трудовая деятельность связана с направлением колл центров/кредитным направлением. Оборудование Avaya/Cisco. Системы прогностического обзвона APC (PG-230/PDS) и принятия решений. Знаком с оборудованием MightyCall

Все проектные сроки выдержаны, установленные KPI по итогам года выполнены.
Получал повышенную оценку по результатам года.
Победитель конкурса "Лучший работник". Департамент автоматизации бизнес-процессов в номинации "Команда прорыва" по итогам 4 квартала 2022 года.
Победитель конкурса "Лучший работник IT" Дирекции автоматизаци бизнес процессов в номанации "ЗА ПРОФЕССИОНАЛИЗМ" по итогам 2020 года.
Награжден в категории "Лучший из лучших" по итогам 1 квартала 2017года в командной номинации.
Награжден в категории "Лучший из лучших" в 2016г за участие в проекте "Счетчик контактов", в котором мы изменили процесс взыскания в зависимости от статистики коммуникации с клиентом. Занимал роль куратора.
Награжден в категории "Лучший из лучших" в 2015г за участие в проекте санации стороннего банка, в котором занимал роль куратора\архитектора со стороны ИТ. В данном проекте мы создали новый механизм загрузки портфелей просроченных задолженностей сторонних банков в системы Collection АБ

Прогноз, ЗАО
Москва, www.prognoz.ru

Информационные технологии, системная интеграция, интернет

Системная интеграция, автоматизация технологических и бизнес-процессов предприятия, ИТ-консалтинг
Сентябрь 2012 — Июнь 2013 10 месяцев

Ведущий специалист центра специальных разработок для международных организаций

- анализ бизнес-требований заказчика (АБ «Газпромбанк» (ЗАО)), их уточнение, обработка и систематизация;
- постановка задач на разработку средствами Visual Studio;
- внесение изменений в бизнес-логику ПО "САДКО" - Система АДминистрирования Кредитных Операций (на основе технологии "ПРОГНОЗ" )
- анализ нового функционала на предмет соответствования поставленным задачам;
- исправление ошибок комплекса САДКО;
- установка, администрирование сервера Oracle 10g в объеме, достаточном для работы комплекса;
- установка комплекса, экспорт/импорт схем данных, создание и установка обновлений ПО, анализ ошибок, их исправление, выдача рекомендаций по улучшению процесса;
- трассировка работы комплекса на предмет поиска ошибок эксплуатации

R-Style SoftLab
Москва, www.softlab.ru

Информационные технологии, системная интеграция, интернет

Разработка программного обеспечения
Системная интеграция, автоматизация технологических и бизнес-процессов предприятия, ИТ-консалтинг
Июнь 2009 — Сентябрь 2012 3 года 4 месяца

специалист (Департамент банковского ПО RS-Bank V.6 Отдел внедрения и сопровождения), старший специалист (Департамент банковского ПО RS-Bank Отдел сопровождения)

ОАО «БМВ Банк» - формы рег. отчетности.

Работа по сопровождению финансовой группы Лайф, АБС RS-Bank.
патчи V.6: 2029, 2030

Участники группы:

ОАО АКБ"Пробизнесбанк", Москва, Россия
ЗАО АКБ "Экспресс-Волга" г. Саратов (с филиалами)
ОАО "ВУЗ-банк" г. Екатеринбург
ОАО "Газэнергобанк", г. Калуга
ЗАО Национальный банк сбережений, г. Иваново
ОАО КБ "Пойдём!", г. Москва

Основное направление: рег. отчетность - ф.101, 102, 134, 136, 202, 407, 251, 652-кратко (поиск и устранение ошибок в исходных данных, модификация рассчета форм в соответствии с особенностями бизнес-процессов различных банков), различная внутренняя отчетность: выписки, ОСВ, различные журналы, документы дня и пр.
Комиссии (разовые, периодические, единовременные) - начисление и оплата, отчеты по комиссиям - меньший приоритет перед остальными направлениями.
Бухгалтерия банка, частично РКО.
Начисление резервов, налоговый регистр

Работа с пользователями: сбор, анализ, обработка бизнес-требований с последующей самостоятельной реализацией доработок, либо с целью постановки задачи на разработку.

Работы по внедрению (в рамках группы сопровождения был выполнен переход RS-Bank патча 2029.151 на 2029.154)

Язык RSL (преимущественно написание/модификация различных отчетов, также в меньшей степени бизнес-процессы, z.B. формирование и проведение проводок для операции переноса остатков 706->707, 707 ->708)

Взаимодействие RS-Bank с внешними системами.

Понимание принципов установки/настройки серверов приложений RS-Bank, балансировщика, создание стендов (структуры каталогов и прав доступа к ним). Организация работы в двух и трехзвенной архитектуре.

Знания sql/plsql достаточные для понимания чужого кода и его модификации.
Оптимизация sql с помощью хинтов.
Оформление, перекомпиляция пакетов на БД банка (Oracle).

Первичный анализ состояния сервера Oracle на предмет наличия критичных блокировок, сессии, пользователи, нагрузка (БД RS-Bank)

Установка, настройка, обучение сотрудников, администрирование системы версионности программного кода.

холдинг Индау/ВолСпецСМУ

Строительство, недвижимость, эксплуатация, проектирование

Строительство жилищное
Строительство коммерческих объектов (торговые площади, офисные здания)
Агентские услуги в недвижимости
Архитектура, проектирование
Январь 2000 — Февраль 2007 7 лет 2 месяца

специалист, системный администратор, начальник отдела

-монтаж ЛВС
-обслуживание оргтехники, мелкий ремонт
-настройка операционной системы для пользователя
-разграничение прав доступа на локальном компьютере под управлением ОС Windows
-выбор, закупка и установка оборудования
-выбор, закупка и установка ПО
-выбор, закупка и настройка офисных АТС (Panasonic 816, 1232, в дальнейшем TDA200), монтаж и кроссировка плинтов, организация механизмов регистрации, хранения, выборки необходимой информации о совершенных через АТС вызовах (freebsd + rs232 + mysql + perl + apache + php)
-техническая организация переезда в новые офисы (телефония, ЛВС, прочая оргтехника)
- АД
- монтаж ЛВС в филиалах холдинга и подключение их к виртуальной сети компании
-объединение телефонии филиалов, настройка маршрутизации, сопровождение (Asterisk + freebsd + voip шлюзы + sipnet + АТС)
-корпоративная почта (freebsd + sendmail/kmail)
-корпоративный ftp
-создание, размещение и поддержка сайтов холдинга (apache, php, mysql, ssl)
-выбор, закупка, настройка и сопровождение канального оборудования (cisco 17, 18, 29 серии) для нужд WAN и LAN
-создание корпоративной территориально разнесенной ЛВС (cisco, freebsd + mpd)
-создание клиент-серверных приложений для нужд холдинга с целью использования в территориально разнесенных филиалах (VB + mysql)
-подбор персонала в отдел

Образование

Высшее
Вологодский государственный технический университет, Вологда
2003

Высшее

ЭЭФ, 210100 "Управление и информатика в технических системах", автоматизация

Повышение квалификации, курсы

Использование экспертами методик ANSI PMI PMBOK
2014

АЛЬФА-БАНК

Pega 7: Основной (Pega Business Architect)
2014

Академия Центра Экспертизы ВРМ-решений

AGILE DEVELOPMENT WITH SCRUM
2013

ScrumTrek

AGILE REQUIREMENTS ANAYSIS
2013

ScrumTrek

Бухгалтерский учет. Начальный уровень.
2010

R-Style

Навыки

Знание языков
Русский — Родной
Английский — B2 — Средне-продвинутый
Немецкий — A1 — Начальный
Навыки
Согласование документов; Разработка ПО; Постановка задач разработчикам; Проектная документация; Проектный менеджмент; Аналитические исследования; контакт центры; выбор вендора; ИТ архитектура; Взыскание задолженности; Collection Of Debts; обучение коллег; BRD; FSD; Разработка технических заданий; Отчетность; DB2; Oracle Pl/SQL; ТЗ; PMBOK; Управление командой; SQL; Agile Project Management; Scrum; Agile; Atlassian Jira; Atlassian Confluence; Управление проектами; BPMN; Бизнес-анализ

Дополнительная информация

Обо мне
От Дирекции Розничных Технологий АЛЬФА-БАНКА был ответственным за организацию переезда дирекции в новое здание осенью 2014г.
Принимаю участие в организации досуга коллектива.
Позитивно принимаю изменения различного рода, готов к обучению.`,
  extra_data: `Предпочтительный опыт из резюме находится в разделе Альфа-Банка, используй с большей значимостью, чем опыт из других мест.
Твои ответы должны помочь достичь цели - получить работу.
Используй информацию, что я считаю своими сильными сторонами два направления - руководство командой и аналитика, т.к. с этим я работал много лет и готов эти свои сильные стороны продавать работодателю.
не пиши "спасибо за вопрос"
У меня есть военный билет.
на вопросы типа "Подскажите, пожалуйста, чем Вы занимались в период с июля 2023-го по июнь 2024-го?" нужно отвечать, что это был осознанный перерыв, т.к... и далее сам придумай. Обязательно добавь, что в этот период я не работал и не получал никаких денег за какую-либо работу. ни официально, ни неофициально.
ты - человек, а не сервис, который работает от лица соискателя. Тебя зовут Денис.
В вопросах про большие данные можно использовать то, что я анализировал логи телефонии от контакт-центра Collection. Это таблицы с приростом 10 миллионов строк в сутки`
};

let currentSessionId = null;
let currentSettings = null;
const rankingCache = new Map();

async function restoreSessionId() {
  if (!currentSessionId) {
    const stored = await chrome.storage.local.get('sessionId');
    if (stored.sessionId) {
      currentSessionId = stored.sessionId;
    }
  }
}
restoreSessionId();

function generateSessionId() {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8);
  return `${hours}:${minutes}-${random}`;
}

async function sendLog(level, message, metadata = {}) {
  if (!currentSessionId) {
    const stored = await chrome.storage.local.get('sessionId');
    if (stored.sessionId) {
      currentSessionId = stored.sessionId;
    }
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
      'X-API-Key': settings.apiKey
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

async function migrateSettings() {
  await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  return DEFAULT_SETTINGS;
}

async function stopExtension(tabId) {
  await chrome.storage.local.remove([
    'hhState', 'hhStateTimestamp', 'processStartTime',
    'currentPage', 'allVacancies', 'maxPages',
    'vacanciesToProcess', 'currentVacancyIndex', 'maxVacanciesToProcess',
    'searchUrl', 'enrichedVacancies', 'sessionId',
    'responseVacancyUrl', 'responseVacancyData', 'searchTabId',
    'multipleVacanciesList', 'currentMultipleIndex'
  ]);
  await sendLog('info', 'РАСШИРЕНИЕ ОСТАНОВЛЕНО ПОЛЬЗОВАТЕЛЕМ', {});
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
    await stopExtension(tab.id);
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  const state = await chrome.storage.local.get(['hhState']);
  if (state.hhState && state.hhState !== 'finished' && state.hhState !== 'error') {
    await sendLog('warn', 'Расширение уже работает. Для остановки используйте правый клик по иконке → Остановить HH Auto', {});
    return;
  }
  const healthy = await isLogServerHealthy();
  if (!healthy) {
    console.error('Сервер логирования недоступен, работа остановлена');
    return;
  }
  if (!currentSessionId) {
    currentSessionId = generateSessionId();
    await chrome.storage.local.set({ sessionId: currentSessionId });
  }
  let settings = await migrateSettings();
  currentSettings = settings;

  await sendLog('info', 'д1 начало', { settings });
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutSec * 1000);

  const requestBody = {
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  };
  const bodyString = JSON.stringify(requestBody);

  await sendLog('info', 'д13. буду отправлять в дипсик', {
    url: 'https://api.deepseek.com/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: requestBody
  });

  for (let attempt = 0; attempt <= retries; attempt++) {
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
      if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`);
      const data = await response.json();
      tokensUsed = data.usage;
      
      await sendLog('debug', 'д13 ответ от дипсик (сырой)', data);
      
      const content = data.choices[0].message.content;
      const parsed = extractJsonFromText(content);
      if (parsed) return { result: parsed, tokens: tokensUsed };
      if (attempt < retries) {
        await sendLog('warn', `DeepSeek вернул невалидный JSON, повторная попытка ${attempt+1}`, { content });
        requestBody.messages[0].content = prompt + "\n\nВАЖНО: Верни ТОЛЬКО валидный JSON. Никаких пояснений, только JSON. Начинай с { и заканчивай }.";
        continue;
      }
      throw new Error(`Не удалось извлечь JSON из ответа DeepSeek: ${content}`);
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sendLog('warn', `Ошибка вызова DeepSeek, попытка ${attempt+1}: ${err.message}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  clearTimeout(timeoutId);
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
});