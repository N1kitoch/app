// DOM Elements
const serviceModal = document.getElementById('serviceModal');
const modalContent = document.getElementById('modalContent');
const closeModal = document.querySelector('.close');
const contactForm = document.getElementById('contactForm');

// Глобальные переменные для страниц и навигации (будут инициализированы после загрузки DOM)
let mobileNavItems;
let pages;

// Page Navigation
function showPage(pageId) {
    // Проверяем, что переменные инициализированы
    if (!pages || !mobileNavItems) {
        pages = document.querySelectorAll('.page');
        mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    }
    
    // Скрываем все страницы
    pages.forEach(page => {
        page.classList.remove('active');
        page.classList.remove('fade-out');
        page.style.display = 'none';
    });
    
    mobileNavItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // Показываем целевую страницу
    const targetPage = document.getElementById(pageId);
    
    if (targetPage) {
        targetPage.classList.add('active');
        targetPage.style.display = 'block';
    }
    
    // Находим и активируем соответствующую кнопку навигации
    let targetNavItem = null;
    
    // Создаем маппинг страниц к индексам кнопок
    const pageToNavIndex = {
        'home': 0,
        'services': 1,
        'contact': 2,
        'about': 3
    };
    
    const navIndex = pageToNavIndex[pageId];
    if (navIndex !== undefined) {
        targetNavItem = mobileNavItems[navIndex];
    }
    
    // Добавляем активный класс к элементу навигации
    if (targetNavItem) {
        targetNavItem.classList.add('active');
    }
    
    // Enable scroll for all pages
    document.body.style.overflow = 'auto';
    document.body.classList.remove('page-home');
    
            // Initialize feature details on home page
        if (pageId === 'home') {
            setTimeout(initFeatureDetails, 100);
            // Main button is always hidden
            // Останавливаем пульсации при переходе на главную
            stopTagPulsing();
        } else {
        // Clear auto-switch interval when leaving home page
        if (autoSwitchInterval) {
            clearInterval(autoSwitchInterval);
        }
        
        // Main button is always hidden
        
        // Auto-fill contact form with Telegram data
        if (pageId === 'contact' && userData) {
            const nameField = document.getElementById('name');
            if (nameField && !nameField.value) {
                nameField.value = `${userData.firstName} ${userData.lastName}`.trim();
            }
            // Initialize contact page animations
            setTimeout(initContactPage, 100);
            // Initialize tag pulsing animations
            setTimeout(initTagPulsing, 500);
        }
        
        // Initialize profile page animations
        if (pageId === 'about') {
            setTimeout(initProfilePage, 100);
        }
        
        // Останавливаем пульсации тегов при переходе на другие страницы
        if (pageId !== 'contact') {
            stopTagPulsing();
        }
    }
    
    // Scroll to top
    window.scrollTo({
        top: 0,
        behavior: 'auto'
    });
    
    // Отслеживаем навигацию (только если функция доступна)
    if (typeof trackPageNavigation === 'function') {
        const previousPage = getCurrentPage();
        setTimeout(() => {
            trackPageNavigation(pageId, previousPage);
        }, 100);
    }
}

// Initialize first page
document.addEventListener('DOMContentLoaded', async function() {
    // Загружаем тексты в первую очередь
    await loadTexts();
    initApp();
    
    // Загружаем тексты блока помощи
    loadHelpSectionTexts();
    
    // Загружаем тексты блока темы
    loadThemeSectionTexts();
    
    // Инициализируем тему
    initTheme();
    
    // Инициализируем кастомный селект
    initCustomSelect();
    
    // Добавляем обработчик для формы сообщения об ошибке
    const errorReportForm = document.getElementById('errorReportForm');
    if (errorReportForm) {
        errorReportForm.addEventListener('submit', handleErrorReport);
    }
});

function createAppOverlay() {
    let overlay = document.getElementById('appOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'appOverlay';
    overlay.innerHTML = `
        <div class="app-overlay-content">
            <div class="spinner"></div>
            <div id="appOverlayText">Подключение к серверу...</div>
            <div id="appOverlayActions" style="margin-top:12px; display:none;"></div>
        </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
}

function showAppOverlay(message) {
    const overlay = createAppOverlay();
    const text = overlay.querySelector('#appOverlayText');
    const actions = overlay.querySelector('#appOverlayActions');
    if (text) text.textContent = message || getText('systemNotifications.server.connecting', 'Подключение к серверу...');
    if (actions) actions.style.display = 'none';
    overlay.style.display = 'flex';
}

function showAppError(message, onRetry) {
    const overlay = createAppOverlay();
    const text = overlay.querySelector('#appOverlayText');
    const actions = overlay.querySelector('#appOverlayActions');
    if (text) text.textContent = message || getText('systemNotifications.server.unavailable', 'Сервер недоступен');
    if (actions) {
        actions.innerHTML = '';
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.textContent = getText('systemNotifications.server.retry', 'Повторить попытку');
        btn.onclick = () => onRetry && onRetry();
        actions.appendChild(btn);
        actions.style.display = '';
    }
    overlay.style.display = 'flex';
}

function hideAppOverlay() {
    const overlay = document.getElementById('appOverlay');
    if (overlay) overlay.style.display = 'none';
}

// Utility: hide any open modals (safety for fresh load or unexpected state)
function hideAllModals(){
  document.querySelectorAll('.modal').forEach(m=>{m.style.display='none';});
  document.body.style.overflow='auto';
}

async function initApp() {
    // Инициализируем глобальные переменные для страниц и навигации
    pages = document.querySelectorAll('.page');
    mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    
    hideAllModals(); // ensure clean state on startup
    try {
        const mode = getLaunchMode?.() || 'unknown';
        const api = getBackendUrl?.() || '';
        console.log('Computed backend URL from ?api=', api || '(none)');
        
        // Показываем загрузку только если есть бэкенд и мы в query режиме
        if (mode === 'query' && api) {
            showAppOverlay('Подключение к серверу...');
            const startTs = Date.now();
            const minDurationMs = 1500; // keep overlay for at least ~1.5s
            
            const ready = await waitForBackendReady(api, 20000);
            if (!ready) {
                showAppError('Сервер недоступен. Проверьте соединение и попробуйте снова.', async () => {
                    showAppOverlay('Повторное подключение...');
                    const ok = await waitForBackendReady(api, 20000);
                    if (ok) {
                        hideAppOverlay();
                        showPage('home');
                    } else {
                        showAppError('Сервер по-прежнему недоступен. Попробуйте позже.');
                    }
                });
                return;
            }
            
            const elapsed = Date.now() - startTs;
            if (elapsed < minDurationMs) {
                await new Promise(r => setTimeout(r, minDurationMs - elapsed));
            }
            hideAppOverlay();
        }
        
        // Proceed to initial page
        showPage('home');
        
        // Обрабатываем диплинки после инициализации
        handleDeeplink();
        
        // Добавляем кнопки диплинков на страницы
        addDeeplinkButtons();
    } catch (e) {
        console.error('initApp failed', e);
        hideAppOverlay();
        showPage('home');
    }
}

// Inject styles for overlay
(function injectOverlayStyles(){
    const s = document.createElement('style');
    s.textContent = `
    #appOverlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: none; align-items: center; justify-content: center; z-index: 99999; }
    #appOverlay .app-overlay-content { background: var(--bg-primary); color: var(--text-primary); padding: 20px 24px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); min-width: 260px; text-align: center; }
    #appOverlay .spinner { width: 28px; height: 28px; border: 3px solid var(--border-color); border-top-color: var(--primary-color, #2563eb); border-radius: 50%; margin: 0 auto 12px auto; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(s);
})();

// Service Modal Functionality
function openServiceModal(serviceType) {
    const serviceData = {
        'ai-managers': {
            title: 'AI-менеджеры и ассистенты',
            description: 'Создаю интеллектуальных помощников, которые автоматически обрабатывают запросы клиентов и повышают эффективность вашего бизнеса.',
            features: [
                'Автоматические ответы на сообщения',
                'Консультации клиентов 24/7',
                'Обработка типовых запросов',
                'Интеграция с мессенджерами',
                'Обучение на ваших данных',
                'Аналитика взаимодействий'
            ],
            technologies: ['OpenAI GPT', 'Claude', 'LangChain', 'Python', 'API интеграции', 'NLP'],
            price: 'от 80,000 ₽',
            duration: '2-4 недели'
        },
        'channel-systems': {
            title: 'Системы ведения каналов',
            description: 'Разрабатываю и подключаю комплексные системы автоматизации для управления социальными каналами и мессенджерами.',
            features: [
                'Автоматические ответы в Директе',
                'Модерация комментариев',
                'Автоматическое создание постов',
                'Управление несколькими каналами',
                'Аналитика и отчеты',
                'Интеграция с CRM'
            ],
            technologies: ['Telegram Bot API', 'VK API', 'Python', 'PostgreSQL', 'Redis', 'Docker'],
            price: 'от 120,000 ₽',
            duration: '3-6 недель'
        },
        'product-manager': {
            title: 'Менеджер продукта',
            description: 'Веду ваш продукт от идеи до реализации, обеспечиваю эффективную коммуникацию с командой и создаю качественные технические задания.',
            features: [
                'Анализ требований и планирование',
                'Коммуникация с разработчиками',
                'Написание технических заданий',
                'Управление сроками и бюджетом',
                'Тестирование и контроль качества',
                'Поддержка после запуска'
            ],
            technologies: ['Jira', 'Confluence', 'Figma', 'Miro', 'Notion', 'Slack'],
            price: 'от 150,000 ₽',
            duration: 'По проекту'
        },
        'other-services': {
            title: 'Другие услуги',
            description: 'Индивидуальные решения под ваши уникальные задачи. Обсудим проект и найдём оптимальное решение.',
            features: [
                'Анализ бизнес-процессов',
                'Консультации по автоматизации',
                'Интеграция различных систем',
                'Обучение персонала',
                'Техническая поддержка',
                'Аудит существующих решений'
            ],
            technologies: ['Индивидуально под проект', 'Современные технологии', 'Гибкие решения'],
            price: 'По договоренности',
            duration: 'По проекту'
        }
    };

    const service = serviceData[serviceType];
    if (service) {
        modalContent.innerHTML = `
          <div class="service-modal">
            <h2 class="service-title">${service.title}</h2>
            <p class="service-description">${service.description}</p>

            <div class="service-details">
              <div class="detail-item">
                <h4>Технологии:</h4>
                <div class="tech-tags">
                  ${service.technologies.map(t=>`<span>${t}</span>`).join('')}
                </div>
              </div>

              <div class="detail-item">
                <h4>Что входит в услугу:</h4>
                <ul class="feature-list">
                  ${service.features.map(f=>`<li>${f}</li>`).join('')}
                </ul>
              </div>
            </div>

            <div class="service-pricing">
              <div class="info-pill"><i class="fas fa-tag"></i><span>${service.price}</span></div>
              <div class="info-pill"><i class="fas fa-clock"></i><span>${service.duration}</span></div>
            </div>

            <div class="modal-actions">
              <button class="btn btn-primary" onclick="contactForService('${service.title}')"><i class="fas fa-paper-plane"></i><span>Заказать</span></button>
              <button id="shareServiceBtn" class="icon-btn small" title="Поделиться"><i class="fas fa-share-alt"></i></button>
            </div>

            <div class="service-reviews">
              ${renderReviews()}
            </div>
          </div>`;

        const shareBtnEl = document.getElementById('shareServiceBtn');
        if (shareBtnEl){
          shareBtnEl.onclick = () => {
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.sendData) {
              window.Telegram.WebApp.sendData(JSON.stringify({ action: 'share_service', serviceId: service.title }));
            } else {
              showNotification('Откройте через Telegram для получения диплинка', 'info');
            }
          };
        }

        // Инициализация звездочек для оценки
        initReviewStars();
        
        // Подсвечиваем кнопку "Услуги" в модальном окне
        const serviceNavItem = document.querySelector('#serviceTopNav .mobile-nav-item:nth-child(2)');
        if (serviceNavItem) {
            serviceNavItem.classList.add('active');
        }
        
        serviceModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

// Close modal
closeModal.addEventListener('click', closeServiceModal);
window.addEventListener('click', (e) => {
    if (e.target === serviceModal) {
        closeServiceModal();
    }
});

function closeServiceModal() {
    serviceModal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Инициализация интерактивных звездочек для оценки
function initReviewStars() {
    const starSelect = document.getElementById('starSelect');
    const reviewText = document.getElementById('reviewText');
    const sendBtn = document.getElementById('sendReviewBtn');
    
    if (!starSelect || !reviewText || !sendBtn) return;
    
    const stars = starSelect.querySelectorAll('i');
    let selectedRating = 0;
    
    // Скрываем поле ввода по умолчанию, кнопка видна но неактивна
    reviewText.style.display = 'none';
    sendBtn.disabled = true;
    
    // Добавляем обработчики для звездочек
    stars.forEach((star, index) => {
        star.addEventListener('click', () => {
            selectedRating = index + 1;
            
            // Подсвечиваем выбранные звезды
            stars.forEach((s, i) => {
                if (i < selectedRating) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
            
            // Показываем поле ввода и активируем кнопку
            reviewText.style.display = 'block';
            reviewText.focus();
            
            // Активируем кнопку после выбора звезды
            sendBtn.disabled = false;
        });
    });
    
    // Убираем проверку текста - кнопка активна после выбора звезды
    
    // Обработчик отправки отзыва
    sendBtn.addEventListener('click', () => {
        const reviewData = {
            rating: selectedRating,
            comment: reviewText.value.trim() || getText('servicesPage.reviews.messages.noComment', 'Без комментария'),
            user: userData ? `@${userData.username || userData.firstName}` : '@гость',
            date: new Date().toLocaleDateString('ru-RU').split('/').reverse().join('.')
        };
        
        // Добавляем отзыв в общую базу
        globalReviews.unshift(reviewData);
        
        // Обновляем отображение отзывов
        const reviewsContainer = document.querySelector('.service-reviews');
        if (reviewsContainer) {
            reviewsContainer.innerHTML = renderReviews();
            // Реинициализируем звездочки для нового HTML
            setTimeout(() => initReviewStars(), 100);
        }
        
        // Показываем уведомление
        showNotification(getText('servicesPage.reviews.messages.success', 'Спасибо за отзыв!'), 'success');
    });
}

// Инициализация кнопки помощи в профиле
function initProfileHelp() {
    const helpBtn = document.getElementById('profileHelpBtn');
    if (!helpBtn) {
        console.log('Кнопка помощи не найдена');
        return;
    }
    
    // Удаляем старые обработчики
    helpBtn.replaceWith(helpBtn.cloneNode(true));
    const newHelpBtn = document.getElementById('profileHelpBtn');
    
    newHelpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Кнопка помощи нажата');
        
        if (!currentUserData) {
            showNotification('Данные пользователя не загружены', 'info');
            return;
        }
        
        const username = currentUserData.username ? `@${currentUserData.username}` : getText('profilePage.userInfo.defaults.username', 'Не указан');
        const userId = currentUserData.id || '—';
        
        const modalContent = `
            <div class="user-info-modal">
                <div class="user-info-header">
                    <h3>${getText('profilePage.userInfo.modal.title', 'Информация о пользователе')}</h3>
                    <button class="modal-close-btn" onclick="closeUserInfoModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="user-info-content">
                    <div class="user-info-item">
                        <span class="user-info-label">${getText('profilePage.userInfo.fields.username', 'Username')}:</span>
                        <span class="user-info-value">${username}</span>
                    </div>
                    <div class="user-info-item">
                        <span class="user-info-label">${getText('profilePage.userInfo.fields.userId', 'ID пользователя')}:</span>
                        <span class="user-info-value">${userId}</span>
                    </div>
                </div>
            </div>
        `;
        
        showUserInfoModal(modalContent);
    });
    
    console.log('Кнопка помощи инициализирована');
}





// Глобальная переменная для хранения интервала пульсаций
let tagPulseInterval = null;

// Функция для случайных пульсаций тегов
function initTagPulsing() {
    // Очищаем предыдущий интервал, если он существует
    if (tagPulseInterval) {
        clearInterval(tagPulseInterval);
        tagPulseInterval = null;
    }
    
    const tagItems = document.querySelectorAll('.tag-item');
    if (tagItems.length === 0) return;
    
    function pulseRandomTag() {
        // Убираем предыдущий класс pulse со всех тегов
        tagItems.forEach(tag => tag.classList.remove('pulse'));
        
        // Выбираем случайный тег
        const randomIndex = Math.floor(Math.random() * tagItems.length);
        const randomTag = tagItems[randomIndex];
        
        // Добавляем класс pulse для анимации
        randomTag.classList.add('pulse');
        
        // Убираем класс через время анимации
        setTimeout(() => {
            randomTag.classList.remove('pulse');
        }, 600);
    }
    
    // Запускаем пульсации каждые 3 секунды
    tagPulseInterval = setInterval(pulseRandomTag, 3000);
    
    // Запускаем первую пульсацию через 2 секунды после загрузки
    setTimeout(pulseRandomTag, 2000);
}

// Функция для остановки пульсаций
function stopTagPulsing() {
    if (tagPulseInterval) {
        clearInterval(tagPulseInterval);
        tagPulseInterval = null;
    }
    // Убираем все классы pulse
    document.querySelectorAll('.tag-item').forEach(tag => tag.classList.remove('pulse'));
}

// Функция для переключения FAQ аккордеона
function toggleFaq(element) {
    const faqItem = element.parentElement;
    const isActive = faqItem.classList.contains('active');
    
    // Закрываем все другие FAQ
    document.querySelectorAll('.faq-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Открываем текущий FAQ, если он был закрыт
    if (!isActive) {
        faqItem.classList.add('active');
    }
}

// Обработчик формы сообщения об ошибке
function handleErrorReport(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const errorType = formData.get('errorType');
    const errorDescription = formData.get('errorDescription');
    
    // Отправляем данные об ошибке
    trackImportantEvent('error_report', {
        type: errorType,
        description: errorDescription,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
    });
    
    // Показываем уведомление
    showNotification(getText('helpSection.errorReport.successMessage', 'Спасибо! Ваше сообщение об ошибке отправлено. Мы исправим проблему в ближайшее время.'), 'success');
    
    // Очищаем форму
    form.reset();
}

// Функция для загрузки текстов блока помощи
function loadHelpSectionTexts() {
    // Загружаем заголовок
    const helpTitle = document.getElementById('helpTitle');
    if (helpTitle) {
        helpTitle.textContent = getText('helpSection.title', 'Помощь');
    }
    
    // Загружаем FAQ
    const faqElements = {
        'faqContactQuestion': 'helpSection.faq.contactSupport.question',
        'faqContactAnswer': 'helpSection.faq.contactSupport.answer',
        'faqErrorQuestion': 'helpSection.faq.reportError.question',
        'faqErrorAnswer': 'helpSection.faq.reportError.answer',
        'faqOrderQuestion': 'helpSection.faq.orderService.question',
        'faqOrderAnswer': 'helpSection.faq.orderService.answer',
        'faqTimeQuestion': 'helpSection.faq.developmentTime.question',
        'faqTimeAnswer': 'helpSection.faq.developmentTime.answer',
        'faqWarrantyQuestion': 'helpSection.faq.warranty.question',
        'faqWarrantyAnswer': 'helpSection.faq.warranty.answer'
    };
    
    Object.entries(faqElements).forEach(([elementId, textPath]) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = getText(textPath, element.textContent);
        }
    });
    
    // Загружаем форму сообщения об ошибке
    const errorElements = {
        'errorReportTitle': 'helpSection.errorReport.title',
        'errorTypeLabel': 'helpSection.errorReport.typeLabel',
        'errorDescriptionLabel': 'helpSection.errorReport.descriptionLabel',
        'errorDescriptionPlaceholder': 'helpSection.errorReport.descriptionPlaceholder',
        'errorSubmitButton': 'helpSection.errorReport.submitButton'
    };
    
    Object.entries(errorElements).forEach(([elementId, textPath]) => {
        const element = document.getElementById(elementId);
        if (element) {
            if (element.tagName === 'TEXTAREA') {
                element.placeholder = getText(textPath, element.placeholder);
            } else {
                element.textContent = getText(textPath, element.textContent);
            }
        }
    });
    
    // Обновляем тексты кастомного селекта
    const selectValue = document.getElementById('selectValue');
    if (selectValue) {
        selectValue.textContent = getText('helpSection.errorReport.typePlaceholder', 'Выберите тип');
        selectValue.classList.add('placeholder');
    }
    
    // Обновляем опции селекта
    const selectOptions = document.querySelectorAll('.select-option');
    const optionTexts = {
        0: 'helpSection.errorReport.typePlaceholder',
        1: 'helpSection.errorReport.types.bug',
        2: 'helpSection.errorReport.types.ui',
        3: 'helpSection.errorReport.types.performance',
        4: 'helpSection.errorReport.types.other'
    };
    
    selectOptions.forEach((option, index) => {
        const textPath = optionTexts[index];
        if (textPath) {
            const text = getText(textPath, option.textContent);
            option.textContent = text;
            option.dataset.text = text;
        }
    });
}

// Функция для загрузки текстов блока темы
function loadThemeSectionTexts() {
    const themeElements = {
        'themeTitle': 'themeSection.title',
        'themeLightTitle': 'themeSection.light.title',
        'themeLightDescription': 'themeSection.light.description',
        'themeDarkTitle': 'themeSection.dark.title',
        'themeDarkDescription': 'themeSection.dark.description',
        'themeAutoTitle': 'themeSection.auto.title',
        'themeAutoDescription': 'themeSection.auto.description'
    };
    
    Object.entries(themeElements).forEach(([elementId, textPath]) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = getText(textPath, element.textContent);
        }
    });
}

// Управление темами
let currentTheme = 'auto';

function selectTheme(theme) {
    currentTheme = theme;
    
    // Сохраняем в localStorage
    localStorage.setItem('appTheme', theme);
    
    // Применяем тему
    applyTheme(theme);
    
    // Показываем уведомление
    const themeNames = {
        'light': 'светлая',
        'dark': 'тёмная'
    };
    showNotification(`Тема изменена на ${themeNames[theme]}`, 'success');
}

function applyTheme(theme) {
    const root = document.documentElement;
    
    if (theme === 'dark') {
        // Тёмная тема
        root.setAttribute('data-theme', 'dark');
        root.style.setProperty('--bg-primary', '#1a1a1a');
        root.style.setProperty('--bg-secondary', '#2d2d2d');
        root.style.setProperty('--bg-accent', '#3a3a3a');
        root.style.setProperty('--text-primary', '#ffffff');
        root.style.setProperty('--text-secondary', '#b0b0b0');
        root.style.setProperty('--text-light', '#808080');
        root.style.setProperty('--border-color', '#404040');
        root.style.setProperty('--shadow', '0 4px 12px rgba(0, 0, 0, 0.3)');
        root.style.setProperty('--shadow-md', '0 8px 24px rgba(0, 0, 0, 0.4)');
        root.style.setProperty('--shadow-sm', '0 1px 2px 0 rgba(0, 0, 0, 0.3)');
        root.style.setProperty('--shadow-lg', '0 10px 15px -3px rgba(0, 0, 0, 0.3)');
        root.style.setProperty('--shadow-xl', '0 20px 25px -5px rgba(0, 0, 0, 0.3)');
    } else if (theme === 'light') {
        // Светлая тема
        root.setAttribute('data-theme', 'light');
        root.style.setProperty('--bg-primary', '#ffffff');
        root.style.setProperty('--bg-secondary', '#f8f9fa');
        root.style.setProperty('--bg-accent', '#f3f4f6');
        root.style.setProperty('--text-primary', '#1f2937');
        root.style.setProperty('--text-secondary', '#6b7280');
        root.style.setProperty('--text-light', '#9ca3af');
        root.style.setProperty('--border-color', '#e5e7eb');
        root.style.setProperty('--shadow', '0 4px 12px rgba(0, 0, 0, 0.1)');
        root.style.setProperty('--shadow-md', '0 8px 24px rgba(0, 0, 0, 0.15)');
        root.style.setProperty('--shadow-sm', '0 1px 2px 0 rgba(0, 0, 0, 0.05)');
        root.style.setProperty('--shadow-lg', '0 10px 15px -3px rgba(0, 0, 0, 0.1)');
        root.style.setProperty('--shadow-xl', '0 20px 25px -5px rgba(0, 0, 0, 0.1)');
    }
    
    // Обновляем активное состояние кнопок темы
    updateThemeButtons();
}

// Функция для обновления активного состояния кнопок темы
function updateThemeButtons() {
    // Получаем сохранённую тему из localStorage
    const savedTheme = localStorage.getItem('appTheme') || 'light';
    
    console.log('🔍 updateThemeButtons: savedTheme =', savedTheme);
    
    // Убираем активное состояние со всех кнопок
    const allOptions = document.querySelectorAll('.theme-option');
    console.log('🔍 Found theme options:', allOptions.length);
    
    allOptions.forEach(option => {
        const theme = option.getAttribute('data-theme');
        option.classList.remove('active');
        console.log('🔍 Removed active from:', theme);
    });
    
    // Добавляем активное состояние к кнопке с сохранённой темой
    const activeOption = document.querySelector(`[data-theme="${savedTheme}"]`);
    if (activeOption) {
        activeOption.classList.add('active');
        console.log('✅ Activated button for saved theme:', savedTheme);
        
        // Проверяем, что класс действительно добавлен
        setTimeout(() => {
            const isActive = activeOption.classList.contains('active');
            console.log('🔍 Button active check:', savedTheme, '=', isActive);
            
            // Проверяем вычисленные стили
            const computedStyle = window.getComputedStyle(activeOption);
            console.log('🔍 Computed background:', computedStyle.background);
            console.log('🔍 Computed border-color:', computedStyle.borderColor);
            console.log('🔍 Computed color:', computedStyle.color);
        }, 100);
    } else {
        console.log('❌ Button not found for saved theme:', savedTheme);
        console.log('🔍 Available buttons:');
        allOptions.forEach(option => {
            console.log('- data-theme:', option.getAttribute('data-theme'));
        });
    }
}



function initTheme() {
    // Проверяем, есть ли сохранённая тема в localStorage
    let savedTheme = localStorage.getItem('appTheme');
    
    // Если тема не сохранена, устанавливаем 'light' по умолчанию
    if (!savedTheme) {
        savedTheme = 'light';
        localStorage.setItem('appTheme', 'light');
    }
    
    // Применяем сохранённую тему
    selectTheme(savedTheme);
}

// Инициализация кастомного селекта
function initCustomSelect() {
    const selectTrigger = document.getElementById('selectTrigger');
    const selectDropdown = document.getElementById('selectDropdown');
    const selectValue = document.getElementById('selectValue');
    const hiddenInput = document.getElementById('errorType');
    
    if (!selectTrigger || !selectDropdown || !selectValue || !hiddenInput) return;
    
    // Обработчик клика по триггеру
    selectTrigger.addEventListener('click', function(e) {
        e.stopPropagation();
        const isActive = selectTrigger.classList.contains('active');
        
        // Закрываем все другие селекты
        document.querySelectorAll('.select-trigger').forEach(trigger => {
            trigger.classList.remove('active');
        });
        document.querySelectorAll('.select-dropdown').forEach(dropdown => {
            dropdown.classList.remove('active');
        });
        
        // Переключаем текущий селект
        if (!isActive) {
            selectTrigger.classList.add('active');
            selectDropdown.classList.add('active');
        }
    });
    
    // Обработчики клика по опциям
    selectDropdown.addEventListener('click', function(e) {
        if (e.target.classList.contains('select-option')) {
            const value = e.target.dataset.value;
            const text = e.target.dataset.text;
            
            // Обновляем отображение
            selectValue.textContent = text;
            if (value === '') {
                selectValue.classList.add('placeholder');
            } else {
                selectValue.classList.remove('placeholder');
            }
            
            // Обновляем скрытое поле
            hiddenInput.value = value;
            
            // Обновляем стили опций
            selectDropdown.querySelectorAll('.select-option').forEach(option => {
                option.classList.remove('selected');
            });
            e.target.classList.add('selected');
            
            // Закрываем дропдаун
            selectTrigger.classList.remove('active');
            selectDropdown.classList.remove('active');
        }
    });
    
    // Закрытие при клике вне селекта
    document.addEventListener('click', function(e) {
        if (!selectTrigger.contains(e.target) && !selectDropdown.contains(e.target)) {
            selectTrigger.classList.remove('active');
            selectDropdown.classList.remove('active');
        }
    });
}

// Contact form for specific service
function contactForService(serviceName) {
    closeServiceModal();
    
    // Увеличиваем счетчик просмотренных услуг
    const currentViewed = parseInt(localStorage.getItem('viewedServices') || '0');
    localStorage.setItem('viewedServices', currentViewed + 1);
    
    // Сразу отправляем данные в бэкенд без перехода на страницу контактов
    const currentUserData = window.userData || userData;
    const userName = currentUserData ? `${currentUserData.firstName} ${currentUserData.lastName}`.trim() : 'Пользователь';
    const message = `Здравствуйте! Меня интересует услуга "${serviceName}". Пожалуйста, свяжитесь со мной для обсуждения деталей проекта.`;
    
    // Отправляем данные через бэкенд
    trackImportantEvent('service_interest', {
        service: serviceName,
        userName: userName,
        message: message
    });
    
    // Показываем уведомление об успешной отправке
    showNotification('Ваш запрос отправлен! Мы свяжемся с вами в ближайшее время.', 'success');
    
    // Отслеживаем интерес к услуге
    trackImportantEvent('service_interest', {
        service: serviceName
    });
}

// Contact Form Submission
contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = contactForm.querySelector('.contact-submit-btn');
    const originalText = submitBtn.querySelector('.btn-text').textContent;
    
    // Show loading state
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    
    // Get form data
    const formData = new FormData(contactForm);
    const data = {
        name: formData.get('name'),
        message: formData.get('message')
    };
    
    try {
        // Отправляем через упрощенную систему
        trackImportantEvent('contact_form', {
            formData: data
        });
        
        // Увеличиваем счетчик отправленных сообщений
        const currentSent = parseInt(localStorage.getItem('sentMessages') || '0');
        localStorage.setItem('sentMessages', currentSent + 1);
        
        // Show success state
        document.getElementById('contactForm').style.display = 'none';
        document.getElementById('contactSuccess').style.display = 'block';
        
        // Animate stats
        animateContactStats();
        
    } catch (error) {
        console.error('Form submission error:', error);
        trackError(error, 'contact');
        showNotification('Ошибка отправки. Попробуйте снова.', 'error');
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
    }
});

// Reset contact form
function resetContactForm() {
    document.getElementById('contactForm').reset();
    document.getElementById('contactForm').style.display = 'block';
    document.getElementById('contactSuccess').style.display = 'none';
}

// Animate contact stats
function animateContactStats() {
    const statNumbers = document.querySelectorAll('.contact-stats .stat-number');
    
    statNumbers.forEach(stat => {
        const target = parseInt(stat.getAttribute('data-target'));
        const duration = 2000; // 2 seconds
        const increment = target / (duration / 16); // 60fps
        let current = 0;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            stat.textContent = Math.floor(current);
        }, 16);
    });
}

// Animate floating elements on contact page
function animateFloatingElements() {
    // Функция больше не используется
    console.log('Floating elements removed from design');
}

// Initialize contact page animations
function initContactPage() {
    if (document.getElementById('contact').classList.contains('active')) {
        animateContactStats();
    }
}

// Show competency details
function showCompetencyDetails(competencyId) {
    // Remove active class from all competency items
    document.querySelectorAll('.competency-modern-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Remove active class from all competency details
    document.querySelectorAll('.competency-detail-modern').forEach(detail => {
        detail.classList.remove('active');
    });
    
    // Add active class to selected competency item
    const selectedItem = document.querySelector(`[onclick*="${competencyId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('active');
    }
    
    // Add active class to selected competency detail
    const selectedDetail = document.getElementById(`${competencyId}-detail`);
    if (selectedDetail) {
        selectedDetail.classList.add('active');
    }
}

// Show project details
function showProjectDetails(projectId) {
    // Remove active class from all project items
    document.querySelectorAll('.project-modern-card').forEach(item => {
        item.classList.remove('active');
    });
    
    // Remove active class from all project details
    document.querySelectorAll('.project-detail-modern').forEach(detail => {
        detail.classList.remove('active');
    });
    
    // Add active class to selected project item
    const selectedItem = document.querySelector(`[onclick*="${projectId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('active');
    }
    
    // Add active class to selected project detail
    const selectedDetail = document.getElementById(`${projectId}-detail`);
    if (selectedDetail) {
        selectedDetail.classList.add('active');
    }
}

// Initialize profile page animations
function initProfilePage() {
    if (document.getElementById('about').classList.contains('active')) {
        animateProfileStats();
        // Инициализируем кнопку помощи при загрузке страницы профиля
        setTimeout(() => {
            if (document.getElementById('profileHelpBtn')) {
                initProfileHelp();
            }
        }, 100);
    }
}

// Animate profile stats
function animateProfileStats() {
    const statNumbers = document.querySelectorAll('.profile-stats-grid .stat-number');
    
    statNumbers.forEach(stat => {
        const text = stat.textContent;
        if (text.includes('+') || text.includes('%')) {
            // For stats with + or %, animate from 0
            const target = parseInt(text.replace(/[^\d]/g, ''));
            const suffix = text.replace(/\d/g, '');
            const duration = 2000;
            const increment = target / (duration / 16);
            let current = 0;
            
            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    current = target;
                    clearInterval(timer);
                }
                stat.textContent = Math.floor(current) + suffix;
            }, 16);
        }
    });
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Add notification styles
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--bg-primary);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 1rem;
        z-index: 3000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 400px;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        color: var(--text-primary);
    }
    
    .notification-success i { color: #10b981; }
    .notification-error i { color: #ef4444; }
    .notification-info i { color: #3b82f6; }
    
    /* Mobile notification styles */
    .notification {
        right: 16px;
        left: 16px;
        max-width: none;
    }
`;
document.head.appendChild(notificationStyles);

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for animation
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll('.service-card, .about-content, .contact-content');
    
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Telegram Web App Integration
let tg = null;
let userData = null;
let appTexts = null;
let DEBUG_MODE = false;
const ADMIN_ID = 585028258; // TODO: optionally sync from bot; for now hardcoded
const BOT_TOKEN = "8117473255:AAHT3Nm6nq7Jz4HRN_8i3rT1eQVWZ5tsdLE"; // Bot token for direct API calls
const logsBuffer = [];
const BACKEND_URL = 'https://server-iyp2.onrender.com';

// Функция для загрузки текстов из JSON файла
async function loadTexts() {
    try {
        const response = await fetch('./texts.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        appTexts = await response.json();
        console.log('Тексты загружены успешно');
        return true;
    } catch (error) {
        console.error('Ошибка загрузки текстов:', error);
        // Fallback - используем базовые тексты
        appTexts = {
            notifications: {
                server: {
                    connecting: "Подключение к серверу...",
                    unavailable: "Сервер недоступен"
                }
            }
        };
        return false;
    }
}

// Функция для получения текста по ключу с поддержкой вложенности
function getText(path, defaultText = '') {
    if (!appTexts) return defaultText;
    
    const keys = path.split('.');
    let current = appTexts;
    
    for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            return defaultText;
        }
    }
    
    return typeof current === 'string' ? current : defaultText;
}

function getBackendUrl() {
    const p = new URLSearchParams(window.location.search);
    const fromParam = p.get('api');
    if (fromParam && /^https?:\/\//i.test(fromParam)) return fromParam.replace(/\/$/, '');
    if (BACKEND_URL && /^https?:\/\//i.test(BACKEND_URL)) return BACKEND_URL.replace(/\/$/, '');
    return '';
}

function getLaunchMode() {
    if (!tg) return 'unknown';
    
    // Use the new launch method detection
    const launchMethod = getAppLaunchMethod();
    
    // Map launch method to mode
    switch (launchMethod) {
        case 'inline':
            return 'keyboard'; // Inline queries work like keyboard mode
        case 'query':
            return 'query';
        case 'keyboard':
            return 'keyboard';
        default:
            // Fallback to old logic
            const hasSendData = typeof tg.sendData === 'function';
            const hasQueryId = !!(tg.initDataUnsafe && tg.initDataUnsafe.query_id);
            if (hasQueryId) return 'query';
            if (hasSendData) return 'keyboard';
            return 'unknown';
    }
}

function appendLog(tag, args) {
    const line = `[${new Date().toISOString()}] ${tag}: ` + args.map(a => {
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' ');
    logsBuffer.push(line);
    const out = document.getElementById('logsOutput');
    if (out) {
        out.textContent += (out.textContent ? '\n' : '') + line;
        out.scrollTop = out.scrollHeight;
    }
}

// Simple on-screen debug console (enabled with ?debug=1)
function initDebugConsole() {
    const params = new URLSearchParams(window.location.search);
    DEBUG_MODE = params.get('debug') === '1';
    if (!DEBUG_MODE) return;
    const wrap = document.createElement('div');
    wrap.id = 'tg-debug-console';
    wrap.style.cssText = 'position:fixed;bottom:16px;right:16px;width:420px;height:240px;overflow:auto;background:rgba(0,0,0,.8);color:#0f0;font:12px/1.4 monospace;z-index:9999;padding:8px;';
    document.body.appendChild(wrap);
    const log = console.log.bind(console);
    const err = console.error.bind(console);
    console.log = (...args) => { log(...args); appendDbg('LOG', args); appendLog('LOG', args); };
    console.error = (...args) => { err(...args); appendDbg('ERR', args); appendLog('ERR', args); };
    function appendDbg(tag, args) {
        const pre = document.createElement('pre');
        pre.style.margin = '0 0 6px';
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.wordBreak = 'break-word';
        pre.textContent = `[${new Date().toISOString()}] ${tag}: ` + args.map(a => safeStringify(a)).join(' ');
        wrap.appendChild(pre);
    }
    function safeStringify(v) {
        try { return typeof v === 'string' ? v : JSON.stringify(v); } catch { return String(v); }
    }
}

document.addEventListener('DOMContentLoaded', initDebugConsole);

// Always capture logs into buffer even without debug UI
(() => {
    const origLog = console.log.bind(console);
    const origErr = console.error.bind(console);
    console.log = (...args) => { origLog(...args); appendLog('LOG', args); };
    console.error = (...args) => { origErr(...args); appendLog('ERR', args); };
})();

function ensureLogsButtonInProfile() {
    if (!userData) return;
    if (String(userData.id) !== String(ADMIN_ID)) return;
    
    // Since we simplified the profile page, we'll add the logs button to the profile card
    const profileCard = document.querySelector('.profile-card');
    if (!profileCard) return;
    if (document.getElementById('openLogsBtn')) return;
    
    const btnWrap = document.createElement('div');
    btnWrap.style.marginTop = '1rem';
    btnWrap.innerHTML = `
        <button id="openLogsBtn" class="btn btn-outline" onclick="showLogsPage()">
            <i class="fas fa-terminal"></i>
            Открыть логи (только админ)
        </button>
    `;
    profileCard.appendChild(btnWrap);
}

function showLogsPage() {
    const logsSection = document.getElementById('logs');
    if (!logsSection) return;
    // reveal logs page
    logsSection.style.display = '';
    showPage('logs');
    const out = document.getElementById('logsOutput');
    if (out) {
        out.textContent = logsBuffer.join('\n');
        out.scrollTop = out.scrollHeight;
    }
}

function clearLogs() {
    logsBuffer.length = 0;
    const out = document.getElementById('logsOutput');
    if (out) out.textContent = '';
    console.log('Logs cleared');
}

function exportLogs() {
    const blob = new Blob([logsBuffer.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${new Date().toISOString().replace(/[:.]/g,'-')}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

async function copyLogs() {
    const out = document.getElementById('logsOutput');
    const text = (logsBuffer && logsBuffer.length ? logsBuffer.join('\n') : (out?.textContent || ''));
    if (!text) {
        showNotification('Нет логов для копирования', 'info');
        return;
    }
    try {
        // Try permissions (may be ignored by some webviews)
        try {
            if (navigator.permissions && navigator.permissions.query) {
                await navigator.permissions.query({ name: 'clipboard-write' });
            }
        } catch {}

        // Preferred path: secure context + Clipboard API
        if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            showNotification('Логи скопированы в буфер обмена', 'success');
            console.log('Logs copied via navigator.clipboard');
            return;
        }

        // Fallback 1: select logsOutput and copy
        if (out) {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(out);
            selection.removeAllRanges();
            selection.addRange(range);
            const ok = document.execCommand('copy');
            selection.removeAllRanges();
            if (ok) {
                showNotification('Логи скопированы в буфер обмена', 'success');
                console.log('Logs copied via selection and execCommand');
                return;
            }
        }

        // Fallback 2: hidden textarea (iOS-friendly)
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        // iOS selection range
        try { ta.setSelectionRange(0, ta.value.length); } catch {}
        const ok2 = document.execCommand('copy');
        ta.remove();
        if (!ok2) throw new Error('execCommand returned false');
        showNotification('Логи скопированы в буфер обмена', 'success');
        console.log('Logs copied via hidden textarea');
    } catch (e) {
        console.error('Failed to copy logs:', e);
        showNotification('Не удалось скопировать логи', 'error');
    }
}
// Check if Telegram Web App API is available and ready
function isTelegramWebAppReady() {
    if (!window.Telegram || !window.Telegram.WebApp) {
        console.log('Telegram Web App API not available');
        return false;
    }
    
    const webApp = window.Telegram.WebApp;
    
    // Check if basic properties are available
    if (typeof webApp.ready !== 'function') {
        console.log('Telegram Web App ready() method not available');
        return false;
    }
    
    // Check if we have any user data
    const hasUserData = webApp.initDataUnsafe?.user || webApp.initData;
    
    console.log('Telegram Web App ready check:', {
        hasReady: typeof webApp.ready === 'function',
        hasUserData: !!hasUserData,
        initDataUnsafe: !!webApp.initDataUnsafe,
        initData: !!webApp.initData
    });
    
    return true;
}

// Check if running in Telegram Web App
function initTelegramWebApp() {
    console.log('initTelegramWebApp called');
    console.log('window.Telegram available:', !!window.Telegram);
    console.log('window.Telegram.WebApp available:', !!(window.Telegram && window.Telegram.WebApp));
    
    if (isTelegramWebAppReady()) {
        console.log('Telegram Web App detected, initializing...');
        tg = window.Telegram.WebApp;
        
        // Initialize Telegram Web App
        try {
            tg.ready();
            console.log('tg.ready() called');
        } catch (e) {
            console.error('Error calling tg.ready():', e);
        }
        
        // Set theme
        try {
            if (tg.colorScheme === 'dark') {
                document.body.classList.add('tg-dark-theme');
                console.log('Dark theme applied');
            } else {
                console.log('Light theme detected');
            }
        } catch (e) {
            console.error('Error setting theme:', e);
        }
        
        // Main Button is completely disabled - no buttons will appear
        try {
            if (tg.MainButton) {
                tg.MainButton.hide();
                tg.MainButton.disable();
                console.log('MainButton disabled and hidden');
            }
        } catch (e) {
            console.error('Error handling MainButton:', e);
        }
        
        // Load user data with retry mechanism
        console.log('Loading user profile...');
        loadUserProfileWithRetry();
        
        // Toggle banner if in query mode without backend
        setTimeout(() => {
            try {
                const mode = getLaunchMode();
                const api = getBackendUrl();
                const banner = document.getElementById('queryModeBanner');
                if (banner) {
                    if (mode === 'query' && !api) {
                        banner.style.display = '';
                    } else {
                        banner.style.display = 'none';
                    }
                }
            } catch (e) {
                console.error('Error handling banner:', e);
            }
        }, 0);
        
        console.log('Telegram Web App initialized successfully');
    } else {
        console.log('Telegram Web App not available, running in standalone mode');
        console.log('Available global objects:', Object.keys(window).filter(key => key.toLowerCase().includes('telegram')));
        
        // Create fallback user data for standalone mode
        window.userData = {
            id: 'standalone',
            firstName: 'Гость',
            lastName: '',
            username: '',
            languageCode: 'ru',
            isPremium: false,
            photoUrl: null
        };
        
        // Update profile display for standalone mode
        setTimeout(async () => {
            await updateProfileDisplay();
        }, 100);
    }
}

// Determine how the app was opened
function getAppLaunchMethod() {
    const urlParams = new URLSearchParams(window.location.search);
    const startParam = urlParams.get('start');
    const startappParam = urlParams.get('startapp');
    
    console.log('Launch parameters:', {
        start: startParam,
        startapp: startappParam,
        hasQueryId: !!(tg?.initDataUnsafe?.query_id),
        hasSendData: typeof tg?.sendData === 'function',
        initDataUnsafe: tg?.initDataUnsafe,
        initData: tg?.initData ? 'present' : 'absent'
    });
    
    if (startParam || startappParam) {
        console.log('Launch method: inline (start/startapp parameter)');
        return 'inline';
    } else if (tg?.initDataUnsafe?.query_id) {
        console.log('Launch method: query (has query_id)');
        return 'query';
    } else if (typeof tg?.sendData === 'function') {
        console.log('Launch method: keyboard (has sendData function)');
        return 'keyboard';
    } else {
        console.log('Launch method: unknown (no clear indicators)');
        return 'unknown';
    }
}

// Retry getting user data with exponential backoff
async function retryGetUserData(maxAttempts = 5, baseDelay = 500) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`Attempt ${attempt}/${maxAttempts} to get user data`);
        
        try {
            // Try to get user data
            if (tg?.initDataUnsafe?.user) {
                console.log('User data found in initDataUnsafe');
                return tg.initDataUnsafe.user;
            }
            
            if (tg?.initData) {
                const parsed = parseUserFromInitData(tg.initData);
                if (parsed) {
                    console.log('User data parsed from initData');
                    return parsed;
                }
            }
            
            // Try getUserData if available
            if (typeof tg?.getUserData === 'function') {
                try {
                    const userData = await tg.getUserData();
                    if (userData && userData.id) {
                        console.log('User data obtained via getUserData');
                        return userData;
                    }
                } catch (e) {
                    console.log('getUserData failed:', e);
                }
            }
            
            // If this is not the last attempt, wait before retrying
            if (attempt < maxAttempts) {
                const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
                console.log(`Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
        } catch (error) {
            console.error(`Error in attempt ${attempt}:`, error);
            if (attempt === maxAttempts) {
                throw error;
            }
        }
    }
    
    console.log('All attempts to get user data failed');
    return null;
}

// Wait for user data to be available
async function waitForUserData(maxWaitTime = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
        // Check if we have user data from any source
        if (tg?.initDataUnsafe?.user || tg?.initData) {
            console.log('User data found during wait');
            return true;
        }
        
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('Timeout waiting for user data');
    return false;
}

// Load user profile with retry mechanism
function loadUserProfileWithRetry(maxRetries = 3, delay = 1000) {
    let retryCount = 0;
    
    function attemptLoad() {
        console.log(`Attempting to load user profile (attempt ${retryCount + 1}/${maxRetries})`);
        
        loadUserProfile().then(() => {
            console.log('User profile loaded successfully');
        }).catch((error) => {
            console.error(`Failed to load user profile (attempt ${retryCount + 1}):`, error);
            retryCount++;
            
            if (retryCount < maxRetries) {
                console.log(`Retrying in ${delay}ms...`);
                setTimeout(attemptLoad, delay);
            } else {
                console.error('Max retries reached, showing error');
                showProfileError();
            }
        });
    }
    
    attemptLoad();
}

function parseUserFromInitData(initData) {
    try {
        if (!initData || typeof initData !== 'string') return null;
        const params = new URLSearchParams(initData);
        const userStr = params.get('user');
        if (!userStr) return null;
        const userObj = JSON.parse(decodeURIComponent(userStr));
        return {
            id: userObj.id,
            firstName: userObj.first_name || '',
            lastName: userObj.last_name || '',
            username: userObj.username || '',
            languageCode: userObj.language_code || 'ru',
            isPremium: !!userObj.is_premium,
            photoUrl: userObj.photo_url || null
        };
    } catch (e) {
        console.error('Failed to parse user from initData:', e);
        return null;
    }
}

async function waitForBackendReady(api, totalMs = 15000) {
    const start = Date.now();
    let attempt = 0;
    while (Date.now() - start < totalMs) {
        attempt++;
        try {
            const res = await fetch(`${api}/health`, { method: 'GET', mode: 'cors', cache: 'no-store' });
            if (res.ok) {
                const j = await res.json().catch(() => null);
                if (j && j.ok === true) {
                    console.log('Backend health OK', j);
                    return true;
                }
            }
            console.log('Health attempt', attempt, 'failed with status', res.status);
        } catch (e) {
            console.log('Health attempt', attempt, 'error', e);
        }
        // backoff: 200ms, 400ms, 800ms, ... max 1600ms
        const delay = Math.min(1600, 200 * Math.pow(2, Math.min(4, attempt)));
        await new Promise(r => setTimeout(r, delay));
    }
    return false;
}

function connectWebSocketIfPossible() {
	try {
		const api = getBackendUrl();
		if (!api || !userData || !userData.id) return;
		const wsUrl = api.replace(/^http/i, 'ws') + `/`;
		const url = new URL(wsUrl);
		url.searchParams.set('user_id', String(userData.id));
		if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
		ws = new WebSocket(url.toString());
		ws.onopen = () => console.log('WS connected');
		ws.onmessage = (ev) => {
			try { handleDataFromBot(ev.data); } catch (e) { console.error('WS message error', e); }
		};
		ws.onclose = () => { console.log('WS closed'); ws = null; };
		ws.onerror = (e) => console.error('WS error', e);
	} catch (e) { console.error('connectWebSocketIfPossible error', e); }
}

function startPollingFallback() {
    let timer = null;
    async function tick() {
        try {
            const api = getBackendUrl();
            if (!api || !userData || !userData.id) return;
            const resp = await fetch(`${api}/poll?user_id=${encodeURIComponent(String(userData.id))}`, { headers: { 'bypass-tunnel-reminder': '1' } });
            if (resp.ok) {
                const json = await resp.json().catch(() => null);
                if (json && json.ok && Array.isArray(json.items)) {
                    for (const item of json.items) {
                        try { handleDataFromBot(JSON.stringify(item)); } catch {}
                    }
                }
            }
        } catch (e) {}
    }
    if (timer) clearInterval(timer);
    timer = setInterval(tick, 2000);
}

// Load user profile from Telegram
async function loadUserProfile() {
    console.log('loadUserProfile started');
    
    if (!tg) {
        console.log('Telegram Web App not available (tg is null)');
        showProfileError();
        return;
    }
    
    try {
        console.log('Getting user data from Telegram...');
        console.log('tg.initDataUnsafe:', tg.initDataUnsafe);
        console.log('tg.initData:', tg.initData);
        
        // Try to get user data with retry mechanism
        let rawUserData = await retryGetUserData(5, 500);
        
        // Try multiple sources for user data
        let userData = null;
        
        // Method 1: Direct user object from initDataUnsafe
        if (tg.initDataUnsafe?.user) {
            console.log('Found user in initDataUnsafe.user');
            const user = tg.initDataUnsafe.user;
            userData = {
                id: user.id,
                firstName: user.first_name || '',
                lastName: user.last_name || '',
                username: user.username || '',
                languageCode: user.language_code || 'ru',
                isPremium: !!user.is_premium,
                photoUrl: user.photo_url || null
            };
        }
        
        // Method 2: Parse from initData string
        if (!userData && tg.initData) {
            console.log('Trying to parse user from initData string');
            const parsed = parseUserFromInitData(tg.initData);
            if (parsed) {
                console.log('Successfully parsed user from initData');
                userData = parsed;
            }
        }
        
        // Method 3: Use raw user data from retry function
        if (!userData && rawUserData) {
            console.log('Using raw user data from retry function');
            if (typeof rawUserData === 'object' && rawUserData.id) {
                userData = {
                    id: rawUserData.id,
                    firstName: rawUserData.first_name || rawUserData.firstName || '',
                    lastName: rawUserData.last_name || rawUserData.lastName || '',
                    username: rawUserData.username || '',
                    languageCode: rawUserData.language_code || rawUserData.languageCode || 'ru',
                    isPremium: !!rawUserData.is_premium || !!rawUserData.isPremium,
                    photoUrl: rawUserData.photo_url || rawUserData.photoUrl || null
                };
            }
        }
        
        // Method 4: Try to get user data via Telegram Web App API
        if (!userData && typeof tg.getUserData === 'function') {
            try {
                console.log('Trying to get user data via getUserData()');
                const userDataResult = await tg.getUserData();
                if (userDataResult && userDataResult.id) {
                    console.log('Got user data via getUserData()');
                    userData = {
                        id: userDataResult.id,
                        firstName: userDataResult.first_name || '',
                        lastName: userDataResult.last_name || '',
                        username: userDataResult.username || '',
                        languageCode: userDataResult.language_code || 'ru',
                        isPremium: !!userDataResult.is_premium,
                        photoUrl: userDataResult.photo_url || null
                    };
                }
            } catch (e) {
                console.log('getUserData() failed:', e);
            }
        }
        
        // Method 5: Try to get user data via Telegram Web App API (alternative method)
        if (!userData && typeof tg.getUserData === 'function') {
            try {
                console.log('Trying alternative getUserData approach');
                const userDataResult = tg.getUserData();
                if (userDataResult && userDataResult.id) {
                    console.log('Got user data via alternative getUserData()');
                    userData = {
                        id: userDataResult.id,
                        firstName: userDataResult.first_name || '',
                        lastName: userDataResult.last_name || '',
                        username: userDataResult.username || '',
                        languageCode: userDataResult.language_code || 'ru',
                        isPremium: !!userDataResult.is_premium,
                        photoUrl: userDataResult.photo_url || null
                    };
                }
            } catch (e) {
                console.log('Alternative getUserData() failed:', e);
            }
        }
        
        // If we still don't have user data, try to create a fallback
        if (!userData) {
            console.log('No user data available, creating fallback profile');
            userData = {
                id: 'unknown',
                firstName: 'Пользователь',
                lastName: 'Telegram',
                username: '',
                languageCode: 'ru',
                isPremium: false,
                photoUrl: null
            };
        }
        
        // Store user data globally
        window.userData = userData;
        console.log('Final user data:', userData);
        
        // Update profile display
        console.log('Updating profile display...');
        await updateProfileDisplay();
        ensureLogsButtonInProfile();
        connectWebSocketIfPossible();
        
        // Просто логируем загрузку профиля, не отправляем в бэкенд
        console.log('Profile loaded successfully');
        
        console.log('loadUserProfile completed successfully');
        
    } catch (error) {
        console.error('Error in loadUserProfile:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        trackError(error, 'about');
        showProfileError();
    }
}

// Get user avatar from Telegram
async function getUserAvatar(userId) {
    try {
        if (!tg || !tg.initDataUnsafe?.user) {
            console.log('Telegram Web App not available for avatar');
            return null;
        }
        
        const user = tg.initDataUnsafe.user;
        if (user.photo_url) {
            console.log('User avatar found:', user.photo_url);
            return user.photo_url;
        }
        
        // Try to get avatar via bot API if we have bot token
        if (BOT_TOKEN && userId) {
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos?user_id=${userId}&limit=1`);
            if (response.ok) {
                const data = await response.json();
                if (data.ok && data.result.photos.length > 0) {
                    const photo = data.result.photos[0][0];
                    const avatarUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${photo.file_id}`;
                    console.log('Avatar obtained via Bot API:', avatarUrl);
                    return avatarUrl;
                }
            }
        }
        
        console.log('No avatar available');
        return null;
    } catch (error) {
        console.error('Error getting user avatar:', error);
        return null;
    }
}

// Get user status (User/Admin) from backend or bot
async function getUserStatus(userId) {
    try {
        // Check if user is admin (hardcoded for now, can be moved to backend)
        if (String(userId) === String(ADMIN_ID)) {
            return {
                isAdmin: true,
                status: 'Администратор',
                icon: 'fas fa-shield-alt'
            };
        }
        
        // Try to get status from backend if available
        const api = getBackendUrl();
        if (api) {
            try {
                const response = await fetch(`${api}/api/user/status?user_id=${userId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        return {
                            isAdmin: data.isAdmin,
                            status: data.isAdmin ? 'Администратор' : 'Пользователь',
                            icon: data.isAdmin ? 'fas fa-shield-alt' : 'fas fa-user'
                        };
                    }
                }
            } catch (e) {
                console.log('Backend status check failed, using default');
            }
        }
        
        // Default status
        return {
            isAdmin: false,
            status: 'Пользователь',
            icon: 'fas fa-user'
        };
    } catch (error) {
        console.error('Error getting user status:', error);
        return {
            isAdmin: false,
            status: 'Пользователь',
            icon: 'fas fa-user'
        };
    }
}

// Update profile display with user data
async function updateProfileDisplay() {
    console.log('updateProfileDisplay called');
    
    // Get userData from global scope or window object
    const currentUserData = window.userData || userData;
    
    if (!currentUserData) {
        console.log('No userData available, skipping update');
        return;
    }
    
    console.log('Updating profile with userData:', currentUserData);
    
    // Update profile elements
    const userNameElement = document.getElementById('userName');
    const userAvatarElement = document.getElementById('userAvatar');
    const userStatusBadge = document.getElementById('userStatusBadge');
    const userLanguageBadge = document.getElementById('userLanguageBadge');
    const userPremiumBadge = document.getElementById('userPremiumBadge');
    const userIdElement = document.getElementById('userId');
    const userUsernameElement = document.getElementById('userUsername');
    
    console.log('Profile elements found:', {
        userNameElement: !!userNameElement,
        userAvatarElement: !!userAvatarElement,
        userStatusBadge: !!userStatusBadge,
        userLanguageBadge: !!userLanguageBadge,
        userPremiumBadge: !!userPremiumBadge,
        userIdElement: !!userIdElement,
        userUsernameElement: !!userUsernameElement
    });
    
    // Update user name
    if (userNameElement) {
        const fullName = `${currentUserData.firstName} ${currentUserData.lastName}`.trim();
        userNameElement.textContent = fullName || 'Пользователь';
        console.log('User name updated:', fullName);
    }
    
    // Update user ID
    if (userIdElement) {
        userIdElement.textContent = currentUserData.id || '—';
        console.log('User ID updated:', currentUserData.id);
    }
    
    // Update username
    if (userUsernameElement) {
        const username = currentUserData.username ? `@${currentUserData.username}` : 'Не указан';
        userUsernameElement.textContent = username;
        console.log('User username updated:', username);
    }
    
    // Update avatar with Telegram photo
    if (userAvatarElement) {
        try {
            const avatarUrl = await getUserAvatar(currentUserData.id);
            if (avatarUrl) {
                userAvatarElement.innerHTML = `
                    <img src="${avatarUrl}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
                    <div class="profile-status">
                        <i class="fas fa-circle"></i>
                    </div>
                `;
                console.log('User avatar updated with Telegram photo');
            } else {
                // Reset to default icon
                userAvatarElement.innerHTML = `
                    <i class="fas fa-user-tie"></i>
                    <div class="profile-status">
                        <i class="fas fa-circle"></i>
                    </div>
                `;
                console.log('User avatar reset to default icon');
            }
        } catch (error) {
            console.error('Error updating avatar:', error);
            // Fallback to default icon
            userAvatarElement.innerHTML = `
                <i class="fas fa-user-tie"></i>
                <div class="profile-status">
                    <i class="fas fa-circle"></i>
                </div>
            `;
        }
    }
    
    // Update status badge (User/Admin) from backend or bot
    if (userStatusBadge) {
        try {
            const userStatus = await getUserStatus(currentUserData.id);
            userStatusBadge.innerHTML = `<i class="${userStatus.icon}"></i> ${userStatus.status}`;
            console.log('User status badge updated:', userStatus.status);
        } catch (error) {
            console.error('Error updating status:', error);
            // Fallback to basic status
            const status = currentUserData.id === '585028258' ? 'Админ' : 'Пользователь';
            const icon = currentUserData.id === '585028258' ? 'fas fa-shield-alt' : 'fas fa-user';
            userStatusBadge.innerHTML = `<i class="${icon}"></i> ${status}`;
        }
    }
    
    // Update language badge
    if (userLanguageBadge) {
        const language = currentUserData.languageCode ? currentUserData.languageCode.toUpperCase() : 'RU';
        userLanguageBadge.innerHTML = `<i class="fas fa-globe"></i> ${language}`;
        console.log('User language badge updated:', language);
    }
    
    // Update premium badge
    if (userPremiumBadge) {
        const premium = currentUserData.isPremium ? 'Премиум' : 'Обычный';
        const icon = currentUserData.isPremium ? 'fas fa-crown' : 'fas fa-user';
        userPremiumBadge.innerHTML = `<i class="${icon}"></i> ${premium}`;
        console.log('User premium badge updated:', premium);
    }
    
    console.log('updateProfileDisplay completed');
    
    // Инициализируем кнопку помощи после обновления профиля
    setTimeout(() => {
        if (document.getElementById('profileHelpBtn')) {
            initProfileHelp();
        }
    }, 100);
}

// Update profile data section
function updateProfileDataSection(currentUserData) {
    const profileDataElement = document.getElementById('profileData');
    if (!profileDataElement) {
        console.log('Profile data element not found');
        return;
    }
    
    if (!currentUserData) {
        console.log('No user data for profile section update');
        return;
    }
    
    profileDataElement.innerHTML = `
        <div class="profile-info-grid">
            <div class="profile-info-item">
                <div class="info-label">
                    <i class="fas fa-id-card"></i>
                    <span>ID пользователя</span>
                </div>
                <div class="info-value">${currentUserData.id}</div>
            </div>
            
            <div class="profile-info-item">
                <div class="info-label">
                    <i class="fas fa-user"></i>
                    <span>Имя</span>
                </div>
                <div class="info-value">${currentUserData.firstName} ${currentUserData.lastName}</div>
            </div>
            
            <div class="profile-info-item">
                <div class="info-label">
                    <i class="fas fa-at"></i>
                    <span>Username</span>
                </div>
                <div class="info-value">${currentUserData.username ? '@' + currentUserData.username : 'Не указан'}</div>
            </div>
            
            <div class="profile-info-item">
                <div class="info-label">
                    <i class="fas fa-globe"></i>
                    <span>Язык</span>
                </div>
                <div class="info-value">${currentUserData.languageCode.toUpperCase()}</div>
            </div>
            
            <div class="profile-info-item">
                <div class="info-label">
                    <i class="fas fa-crown"></i>
                    <span>Статус</span>
                </div>
                <div class="info-value">${currentUserData.isPremium ? 'Premium' : 'Обычный'}</div>
            </div>
        </div>
    `;
    
    console.log('Profile data section updated');
}

// Update activity timeline
function updateActivityTimeline() {
    const lastLoginTime = document.getElementById('lastLoginTime');
    const viewedServices = document.getElementById('viewedServices');
    const sentMessages = document.getElementById('sentMessages');
    
    if (lastLoginTime) {
        const now = new Date();
        const timeString = now.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        lastLoginTime.textContent = timeString;
    }
    
    if (viewedServices) {
        // Получаем количество просмотренных услуг из localStorage или устанавливаем 0
        const viewed = localStorage.getItem('viewedServices') || 0;
        viewedServices.textContent = viewed;
    }
    
    if (sentMessages) {
        // Получаем количество отправленных сообщений из localStorage или устанавливаем 0
        const sent = localStorage.getItem('sentMessages') || 0;
        sentMessages.textContent = sent;
    }
    
    console.log('Activity timeline updated');
}

// Show profile error
function showProfileError() {
    const profileDataElement = document.getElementById('profileData');
    if (profileDataElement) {
        profileDataElement.innerHTML = `
            <div class="profile-error">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Не удалось загрузить профиль</span>
                <button class="btn btn-outline" onclick="loadUserProfile()">
                    <i class="fas fa-redo"></i>
                    Попробовать снова
                </button>
            </div>
        `;
    }
}

// Refresh profile
function refreshProfile() {
    console.log('refreshProfile called');
    
    // Clear any existing user data
    window.userData = null;
    
    // Reload user profile
    loadUserProfileWithRetry(2, 500);
    
    // Show notification
    showNotification('Профиль обновляется...', 'info');
}

// Edit profile (placeholder for future functionality)
function editProfile() {
    showNotification('Функция редактирования профиля будет доступна в следующем обновлении', 'info');
    
    // В будущем здесь можно добавить модальное окно для редактирования
    // Например, изменение имени, аватара и других данных
}

// Send user data to bot (updated to use new system)
async function sendUserDataToBot(userData) {
    // Просто логируем, не отправляем в бэкенд
    console.log('User data loaded:', userData);
    return true;
}

// Универсальная функция отправки всех событий через бэкенд
async function sendEventToBackend(eventType, eventData = {}, options = {}) {
    // Используем упрощенную систему
    trackImportantEvent(eventType, eventData);
    return true;
}

// Fallback функция для отправки событий
async function sendEventFallback(eventType, eventData, userData) {
    console.log(`🔄 Используем fallback для события ${eventType}`);
    
    const payload = {
        type: eventType,
        userData: userData,
        timestamp: new Date().toISOString(),
        ...eventData
    };

    // Используем старую функцию sendDataToBot, но НЕ tg.sendData()
    return await sendDataToBot(payload);
}

// Упрощенная функция для отслеживания важных событий
function trackImportantEvent(eventType, eventData = {}) {
    // Отслеживаем только важные события, чтобы не нагружать систему
    const importantEvents = [
        'contact_form',
        'service_interest',
        'order_submit',
        'payment_request',
        'support_request'
    ];
    
    if (!importantEvents.includes(eventType)) {
        console.log(`📊 Событие ${eventType} пропущено (не важное)`);
        return;
    }
    
    console.log(`📤 Отправка важного события ${eventType}:`, eventData);
    
    if (!tg) {
        console.log('Telegram Web App не доступен');
        return;
    }

    const currentUserData = window.userData || userData;
    const api = getBackendUrl();
    
    if (!api) {
        console.log('Бэкенд URL не найден');
        return;
    }

    // Отправляем только важные события
    fetch(`${api}/api/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: eventType,
            data: eventData,
            userData: currentUserData,
            queryId: tg.initDataUnsafe?.query_id || null
        })
    }).then(response => response.json())
    .then(result => {
        if (result.success) {
            console.log(`✅ Важное событие ${eventType} отправлено`);
            // Показываем уведомление только для важных событий
            const message = getNotificationMessage(eventType);
            if (message) {
                showNotification(message, 'success');
            }
        } else {
            console.error(`❌ Ошибка отправки события ${eventType}:`, result);
        }
    }).catch(error => {
        console.error(`❌ Ошибка отправки события ${eventType}:`, error);
    });
}

// Упрощенная функция для отслеживания навигации (только логирование)
function trackPageNavigation(pageId, previousPage = null) {
    console.log(`🧭 Навигация: ${previousPage} → ${pageId}`);
    // Не отправляем в бэкенд, только логируем
}

// Упрощенная функция для отслеживания кликов (только логирование)
function trackButtonClick(buttonName, page = null) {
    console.log(`🔘 Клик: ${buttonName} на странице ${page}`);
    // Не отправляем в бэкенд, только логируем
}

// Упрощенная функция для отслеживания форм
function trackFormSubmit(formType, formData) {
    const isImportant = ['contact_form', 'order_submit', 'support_request'].includes(formType);
    if (isImportant) {
        trackImportantEvent(formType, { formData: formData });
    } else {
        console.log(`📝 Форма ${formType} отправлена (не важная)`);
    }
}

// Упрощенная функция для отслеживания ошибок (только логирование)
function trackError(error, page = null) {
    console.error(`⚠️ Ошибка на странице ${page}:`, error);
    // Не отправляем в бэкенд, только логируем
}

// Упрощенная функция для аналитических событий (только логирование)
function trackAnalyticsEvent(event, category = null, value = null) {
    console.log(`📊 Аналитика: ${event} (${category}: ${value})`);
    // Не отправляем в бэкенд, только логируем
}

// Функция для получения текущей страницы
function getCurrentPage() {
    const activePage = document.querySelector('.page.active');
    return activePage ? activePage.id : 'unknown';
}

// Обновляем функцию sendDataToBot для использования новой системы
async function sendDataToBot(data) {
    console.log('sendDataToBot called with:', data);
    
    // Если это уже событие, отправляем через новую систему
    if (data.type && data.type !== 'unknown') {
        trackImportantEvent(data.type, data);
        return true;
    }
    
    // Fallback для старых вызовов
    if (!tg) {
        console.log('Telegram Web App not available (tg is null)');
        return false;
    }

    const mode = getLaunchMode();
    console.log('Launch mode:', mode);
    console.log('tg.sendData available:', typeof tg.sendData === 'function');
    console.log('tg.initDataUnsafe.query_id:', tg.initDataUnsafe?.query_id);

    // НЕ используем tg.sendData для обычных событий, чтобы Mini App не закрывался
    // tg.sendData() закрывает Mini App, поэтому используем только бэкенд

    // First try: use backend if available
    const api = getBackendUrl();
    if (api) {
        try {
            const ready = await waitForBackendReady(api, 5000);
            if (ready) {
                console.log('Sending data to backend for answerWebAppQuery:', { api, data });
                const resp = await fetch(`${api}/webapp-data`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        initData: tg.initData, 
                        payload: data, 
                        queryId: tg.initDataUnsafe?.query_id || null 
                    })
                });
                const json = await resp.json().catch(() => ({}));
                if (!resp.ok || json.ok === false) {
                    console.error('Backend returned error', json);
                    showNotification('Сервер отклонил запрос. Попробуйте позже.', 'error');
                    return false;
                }
                console.log('Backend accepted data successfully:', json);
                
                if (json.sentToAdmin) {
                    showNotification('Данные отправлены администратору!', 'success');
                } else {
                    showNotification('Данные получены сервером!', 'success');
                }
                return true;
            } else {
                showNotification('Сервер не отвечает. Проверьте подключение.', 'error');
            }
        } catch (e) {
            console.error('Failed to call backend:', e);
            showNotification('Ошибка соединения с сервером.', 'error');
        }
    }

    // Second try: send directly to Telegram Bot API (fallback)
    try {
        const message = `📱 Данные из Mini App:\n\n` +
            `Тип: ${data.type || 'unknown'}\n` +
            `Пользователь: ${data.userData?.firstName || 'Неизвестно'} ${data.userData?.lastName || ''}\n` +
            `ID: ${data.userData?.id || '—'}\n` +
            `Username: @${data.userData?.username || '—'}\n\n` +
            `Сообщение:\n${data.message || data.formData?.message || '—'}\n\n` +
            `Время: ${new Date().toLocaleString('ru-RU')}`;

        const botApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        const response = await fetch(botApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: ADMIN_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });

        if (response.ok) {
            console.log('Data sent to admin via Bot API');
            showNotification('Данные успешно отправлены!', 'success');
            return true;
        } else {
            const errText = await response.text();
            console.error('Bot API error response:', errText);
        }
    } catch (e) {
        console.error('Failed to send via Bot API:', e);
    }

    showNotification('Не удалось отправить данные. Проверьте интернет и попробуйте снова.', 'error');
    return false;
}

// Handle data from bot
function handleDataFromBot(data) {
    try {
        const parsedData = JSON.parse(data);
        console.log('Received data from bot:', parsedData);
        
        // Handle different types of data
        switch (parsedData.type) {
            case 'profile_update':
                if (parsedData.userData) {
                    userData = { ...userData, ...parsedData.userData };
                    updateProfileDisplay();
                }
                break;
            case 'notification':
                if (parsedData.message) {
                    showNotification(parsedData.message, parsedData.level || 'info');
                }
                break;
            case 'page_navigation':
                if (parsedData.page) {
                    showPage(parsedData.page);
                }
                break;
            default:
                console.log('Unknown data type from bot:', parsedData.type);
        }
        
    } catch (error) {
        console.error('Error parsing data from bot:', error);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initTelegramWebApp);

// Глобальный обработчик ошибок для отслеживания
window.addEventListener('error', (event) => {
    console.error('Global error caught:', event.error);
    trackError(event.error, getCurrentPage());
});

// Обработчик необработанных промисов
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    trackError(event.reason, getCurrentPage());
});

// Инициализация системы отслеживания (упрощенная)
function initTrackingSystem() {
    console.log('🚀 Инициализация упрощенной системы отслеживания...');
    
    // Отслеживаем только базовую информацию
    console.log('📊 Система отслеживания готова');
}

// Инициализируем систему отслеживания после загрузки
setTimeout(initTrackingSystem, 2000);

// After init, set up WS or polling
setTimeout(() => {
    connectWebSocketIfPossible();
    startPollingFallback();
}, 1500);

// Add Telegram Web App specific styles
const tgStyles = document.createElement('style');
tgStyles.textContent = `
    .tg-dark-theme {
        --bg-primary: #1f2937;
        --bg-secondary: #111827;
        --bg-accent: #374151;
        --text-primary: #f9fafb;
        --text-secondary: #d1d5db;
        --text-light: #9ca3af;
        --border-color: #374151;
    }
    
    .tg-dark-theme .mobile-nav {
        background: rgba(31, 41, 55, 0.95);
        border-top-color: #374151;
    }
    
    .tg-dark-theme .service-card,
    .tg-dark-theme .profile-card {
        background: #374151;
        color: #f9fafb;
    }
    
    .tg-dark-theme .modal-content {
        background: #374151;
        color: #f9fafb;
    }
`;
document.head.appendChild(tgStyles);

// Performance optimization: Lazy load images and defer non-critical operations
document.addEventListener('DOMContentLoaded', () => {
    // Add loading="lazy" to images if any are added later
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        img.loading = 'lazy';
    });
    
    // Preload critical resources
    const preloadLinks = [
        { rel: 'preload', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap', as: 'style' },
        { rel: 'preload', href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css', as: 'style' }
    ];
    
    preloadLinks.forEach(link => {
        const linkElement = document.createElement('link');
        Object.assign(linkElement, link);
        document.head.appendChild(linkElement);
    });
});

// Add service modal styles
const modalStyles = document.createElement('style');
modalStyles.textContent = `
    .service-modal h2 {
        color: var(--text-primary);
        margin-bottom: 1rem;
        text-align: center;
    }
    
    .service-description {
        text-align: center;
        margin-bottom: 2rem;
        color: var(--text-secondary);
        font-size: 1.125rem;
    }
    
    .service-details {
        margin-bottom: 2rem;
    }
    
    .detail-item {
        margin-bottom: 1.5rem;
    }
    
    .detail-item h4 {
        color: var(--text-primary);
        margin-bottom: 0.75rem;
        font-size: 1.125rem;
    }
    
    .detail-item ul {
        list-style: none;
        padding-left: 0;
    }
    
    .detail-item li {
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--border-color);
        color: var(--text-secondary);
    }
    
    .detail-item li:last-child {
        border-bottom: none;
    }
    
    .tech-tags {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    
    .tech-tags span {
        background: var(--primary-color);
        color: white;
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        font-size: 0.875rem;
        font-weight: 500;
    }
    
    .price {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--primary-color);
    }
    
    .modal-actions {
        display: flex;
        gap: 1rem;
        justify-content: center;
        flex-wrap: wrap;
    }
    
    /* Mobile modal actions */
    .modal-actions {
        flex-direction: column;
    }
    
    .modal-actions .btn {
        width: 100%;
    }
`;
document.head.appendChild(modalStyles); 

// Interactive Feature Details
let currentFeatureIndex = 0;
let autoSwitchInterval;
const features = ['ai-solutions', 'quick-start', 'growth'];

function selectFeature(featureId) {
    // Remove active class from all cards and details
    document.querySelectorAll('.floating-card').forEach(card => {
        card.classList.remove('active');
    });
    
    document.querySelectorAll('.feature-detail').forEach(detail => {
        detail.classList.remove('active');
    });
    
    // Add active class to selected card and detail
    const selectedCard = document.querySelector(`[onclick*="${featureId}"]`);
    const selectedDetail = document.getElementById(`${featureId}-detail`);
    
    if (selectedCard) {
        selectedCard.classList.add('active');
    }
    
    if (selectedDetail) {
        selectedDetail.classList.add('active');
    }
    
    // Update current index for auto-switching
    currentFeatureIndex = features.indexOf(featureId);
    
    // Reset auto-switch timer
    resetAutoSwitch();
}

function nextFeature() {
    currentFeatureIndex = (currentFeatureIndex + 1) % features.length;
    selectFeature(features[currentFeatureIndex]);
}

function resetAutoSwitch() {
    if (autoSwitchInterval) {
        clearInterval(autoSwitchInterval);
    }
    
    // Start auto-switching after 5 seconds
    autoSwitchInterval = setInterval(() => {
        nextFeature();
    }, 5000);
}

// Initialize feature details on home page load
function initFeatureDetails() {
    if (document.getElementById('home').classList.contains('active')) {
        selectFeature('ai-solutions');
        resetAutoSwitch();
    }
} 

function getBotUsernameFromUrl() {
    try {
        const p = new URLSearchParams(window.location.search);
        const b = p.get('bot');
        return b && /^\w{5,}$/.test(b) ? b : '';
    } catch { return ''; }
}

function tryRecoverByReopen() {
    const bot = getBotUsernameFromUrl();
    if (!bot) return false;
    const link = `https://t.me/${bot}/app?startapp=open`;
    console.log('Reopening via universal link to refresh api:', link);
    try {
        if (window.Telegram && window.Telegram.WebApp && typeof window.Telegram.WebApp.openTelegramLink === 'function') {
            window.Telegram.WebApp.openTelegramLink(link);
            return true;
        }
        // Fallback hard redirect
        window.location.href = link;
        return true;
    } catch (e) {
        console.error('Failed to reopen via universal link', e);
        return false;
    }
}

// Tag Modal Functionality
function openTagModal(tagType) {
    const tagData = {
        'product-manager': {
            title: 'Product Manager',
            description: 'Веду продукты от идеи до запуска. Анализирую рынок, создаю дорожные карты, координирую команды разработчиков и дизайнеров. Включаю UX анализ и консультации по мобильным приложениям.',
            details: [
                'Анализ требований и планирование',
                'Создание технических заданий',
                'UX/UI консультации',
                'Мобильные приложения',
                'A/B тестирование и аналитика',
                'Коммуникация с заказчиками'
            ],
            icon: 'fas fa-project-diagram'
        },
        'automation': {
            title: 'Автоматизация',
            description: 'Создаю системы автоматизации для бизнес-процессов. От простых ботов до сложных интеграций с CRM и ERP системами.',
            details: [
                'Telegram боты и чат-боты',
                'Автоматизация рутинных задач',
                'Интеграция различных сервисов',
                'Аналитика и отчеты',
                'Масштабирование решений'
            ],
            icon: 'fas fa-cogs'
        },

        'ai-expert': {
            title: 'AI Эксперт',
            description: 'Интегрирую искусственный интеллект в бизнес-процессы. Создаю умных помощников, чат-ботов и системы автоматизации.',
            details: [
                'OpenAI GPT интеграции',
                'Обработка естественного языка',
                'Машинное обучение',
                'Автоматизация ответов',
                'Персонализация контента'
            ],
            icon: 'fas fa-robot'
        },

        'analytics': {
            title: 'Аналитика',
            description: 'Настраиваю системы аналитики и создаю дашборды для отслеживания ключевых метрик бизнеса. Включаю UX анализ и пользовательские исследования.',
            details: [
                'Настройка Google Analytics',
                'Создание дашбордов',
                'UX анализ и исследования',
                'Отслеживание конверсии',
                'A/B тестирование',
                'Отчеты и рекомендации'
            ],
            icon: 'fas fa-chart-line'
        },
        'no-code': {
            title: 'No-Code',
            description: 'Создаю решения без написания кода. Использую современные платформы для быстрой разработки и прототипирования.',
            details: [
                'Webflow и Bubble',
                'Zapier интеграции',
                'Airtable автоматизация',
                'Make (Integromat)',
                'Быстрое прототипирование'
            ],
            icon: 'fas fa-code'
        },
        'startups': {
            title: 'Стартапы',
            description: 'Помогаю стартапам с MVP, стратегией развития и автоматизацией процессов. Опыт работы с проектами на разных стадиях.',
            details: [
                'MVP разработка',
                'Стратегия развития',
                'Автоматизация процессов',
                'Аналитика и метрики',
                'Масштабирование'
            ],
            icon: 'fas fa-rocket'
        }
    };

    const tag = tagData[tagType];
    if (tag) {
        const modalContent = document.getElementById('tagModalContent');
        modalContent.innerHTML = `
            <div class="tag-modal">
                <div class="tag-modal-header">
                    <div class="tag-modal-icon">
                        <i class="${tag.icon}"></i>
                    </div>
                    <h3>${tag.title}</h3>
                </div>
                <p class="tag-modal-description">${tag.description}</p>
                <div class="tag-modal-details">
                    <h4>Что включает:</h4>
                    <ul>
                        ${tag.details.map(detail => `<li>${detail}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
        
        document.getElementById('tagModal').style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

// Close tag modal
function closeTagModal() {
    document.getElementById('tagModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Randomize tag order on page load
function randomizeTags() {
    const authorBadges = document.querySelector('.author-badges');
    if (authorBadges) {
        const badges = Array.from(authorBadges.children);
        
        // Fisher-Yates shuffle algorithm
        for (let i = badges.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            authorBadges.appendChild(badges[j]);
        }
    }
}

// Initialize tag modal functionality
document.addEventListener('DOMContentLoaded', function() {
    // Close modal when clicking on close button or outside modal
    const tagModal = document.getElementById('tagModal');
    const closeBtn = tagModal.querySelector('.close');
    
    closeBtn.addEventListener('click', closeTagModal);
    
    tagModal.addEventListener('click', function(e) {
        if (e.target === tagModal) {
            closeTagModal();
        }
    });
    
    // Randomize tags when page loads
    if (document.getElementById('contact').classList.contains('active')) {
        randomizeTags();
    }
});

// Функция для обработки диплинков
function handleDeeplink() {
    const urlParams = new URLSearchParams(window.location.search);
    const startParam = urlParams.get('start');
    
    if (startParam) {
        // Обрабатываем диплинк
        console.log('Deeplink detected:', startParam);
        
        // Переходим на соответствующую страницу
        switch (startParam.toLowerCase()) {
            case 'services':
            case 'услуги':
                showPage('services');
                break;
            case 'about':
            case 'о-нас':
            case 'about-us':
                showPage('about');
                break;
            case 'contact':
            case 'контакты':
                showPage('contact');
                break;
            case 'projects':
            case 'проекты':
                showPage('about'); // Проекты находятся на странице about
                // Прокручиваем к секции проектов
                setTimeout(() => {
                    const projectsSection = document.querySelector('.projects-section');
                    if (projectsSection) {
                        projectsSection.scrollIntoView({ behavior: 'smooth' });
                    }
                }, 500);
                break;
            case 'home':
            case 'главная':
            default:
                showPage('home');
                break;
        }
        
        // Убираем параметр из URL без перезагрузки страницы
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
    }
}

// Функция для создания диплинка
function createDeeplink(page, section = '') {
    // Получаем username бота из Telegram Web App или используем fallback
    let botUsername = 'your_bot_username'; // fallback
    
    if (window.Telegram && window.Telegram.WebApp) {
        const webApp = window.Telegram.WebApp;
        if (webApp.initDataUnsafe && webApp.initDataUnsafe.user) {
            // Пытаемся получить username из данных пользователя
            const user = webApp.initDataUnsafe.user;
            if (user.username) {
                botUsername = user.username;
            }
        }
        
        // Альтернативный способ - из URL бота
        if (webApp.initData) {
            try {
                const initData = new URLSearchParams(webApp.initData);
                const userData = initData.get('user');
                if (userData) {
                    const user = JSON.parse(decodeURIComponent(userData));
                    if (user.username) {
                        botUsername = user.username;
                    }
                }
            } catch (e) {
                console.log('Could not parse user data from initData');
            }
        }
    }
    
    // Если не удалось получить username, используем fallback
    if (botUsername === 'your_bot_username') {
        // Можно заменить на реальный username бота
        botUsername = 'n1kitoch_bot'; // Замените на реальный username
    }
    
    const path = section ? `${page}/${section}` : page;
    return `https://t.me/${botUsername}?start=${path}`;
}

// Функция для копирования диплинка в буфер обмена
async function copyDeeplink(page, section = '') {
    const deeplink = createDeeplink(page, section);
    
    try {
        await navigator.clipboard.writeText(deeplink);
        showNotification('🔗 Диплинк скопирован в буфер обмена!', 'success');
    } catch (err) {
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea');
        textArea.value = deeplink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('🔗 Диплинк скопирован в буфер обмена!', 'success');
    }
}

// Функция для добавления кнопок диплинков
function addDeeplinkButtons() {
    // Добавляем кнопки на страницу о нас
    const aboutSection = document.querySelector('.about');
    if (aboutSection) {
        const deeplinkButton = document.createElement('button');
        deeplinkButton.className = 'btn btn-outline deeplink-btn';
        deeplinkButton.innerHTML = '🔗 Поделиться ссылкой';
        deeplinkButton.onclick = () => copyDeeplink('about');
        
        // Вставляем кнопку после заголовка секции
        const sectionHeader = aboutSection.querySelector('.section-header');
        if (sectionHeader) {
            sectionHeader.appendChild(deeplinkButton);
        }
    }
    
    // Добавляем кнопки на страницу контактов
    const contactSection = document.querySelector('.contact');
    if (contactSection) {
        const deeplinkButton = document.createElement('button');
        deeplinkButton.className = 'btn btn-outline deeplink-btn';
        deeplinkButton.innerHTML = '🔗 Поделиться ссылкой';
        deeplinkButton.onclick = () => copyDeeplink('contact');
        
        // Вставляем кнопку после заголовка секции
        const sectionHeader = contactSection.querySelector('.section-header');
        if (sectionHeader) {
            sectionHeader.appendChild(deeplinkButton);
        }
    }
}

async function updateAuthorAvatar() {
  const userAvatar = document.querySelector('.author-avatar#userAvatar');
  if (!userAvatar) return;
  const currentUserData = window.userData || userData;
  if (currentUserData && currentUserData.photoUrl) {
    userAvatar.innerHTML = `<img src="${currentUserData.photoUrl}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
  } else {
    userAvatar.innerHTML = `<i class="fas fa-user-tie"></i>`;
  }
}
// После updateProfileDisplay и после загрузки профиля вызывать updateAuthorAvatar
const origUpdateProfileDisplay = updateProfileDisplay;
updateProfileDisplay = async function() {
  await origUpdateProfileDisplay.apply(this, arguments);
  await updateAuthorAvatar();
};

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
function renderAuthorBadges() {
  const badges = [
    {cls: 'badge-primary', icon: 'fas fa-project-diagram', text: 'Product Manager', tag: 'product-manager'},
    {cls: 'badge-secondary', icon: 'fas fa-cogs', text: 'Автоматизация', tag: 'automation'},
    {cls: 'badge-accent', icon: 'fas fa-users', text: 'UX Аналитик', tag: 'ux-analyst'},
    {cls: 'badge-success', icon: 'fas fa-robot', text: 'AI Эксперт', tag: 'ai-expert'},
    {cls: 'badge-info', icon: 'fas fa-mobile-alt', text: 'Mobile Apps', tag: 'mobile-apps'},
    {cls: 'badge-warning', icon: 'fas fa-chart-line', text: 'Аналитика', tag: 'analytics'},
    {cls: 'badge-dark', icon: 'fas fa-code', text: 'No-Code', tag: 'no-code'},
    {cls: 'badge-light', icon: 'fas fa-lightbulb', text: 'Стартапы', tag: 'startups'}
  ];
  const shuffled = shuffleArray([...badges]);
  const container = document.querySelector('.author-badges');
  if (container) {
    container.innerHTML = '';
    shuffled.forEach(badge => {
      const btn = document.createElement('button');
      btn.className = `badge ${badge.cls}`;
      btn.onclick = () => openTagModal(badge.tag);
      btn.innerHTML = `<i class="${badge.icon}"></i> ${badge.text}`;
      container.appendChild(btn);
    });
  }
}
// При открытии страницы 'Автор' вызывать renderAuthorBadges
const origShowPage = showPage;
showPage = function(pageId) {
  origShowPage.apply(this, arguments);
  if (pageId === 'contact') {
    renderAuthorBadges();
    // Показываем стикер-подсказку для тегов
    setTimeout(() => {
      showStickyHint();
    }, 1000);
  }
};

// Функции для стикер-подсказки тегов
function showStickyHint() {
    const hint = document.getElementById('stickyHint');
    if (!hint) return;
    
    // Для тестов показываем каждый раз
    // const hintShown = localStorage.getItem('stickyHintShown');
    // if (hintShown) {
    //     hint.style.display = 'none';
    //     return;
    // }
    
    hint.style.display = 'block';
    hint.style.animation = 'stickyBounce 0.8s ease-out';
}

function closeStickyHint() {
    const hint = document.getElementById('stickyHint');
    if (hint) {
        hint.style.display = 'none';
        // Сохраняем, что подсказка была показана
        localStorage.setItem('stickyHintShown', 'true');
    }
}

// Общая база отзывов для всех услуг
const globalReviews = [
  {user:'@alex',rating:5,comment:'Отличный ассистент, сэкономил кучу времени!',date:'12.11.23'},
  {user:'@maria',rating:4,comment:'Хорошо, но пришлось пару раз донастроить.',date:'02.12.23'},
  {user:'@ivan',rating:5,comment:'Вау, реально отвечает за меня ночью 👍',date:'28.12.23'},
  {user:'@stas',rating:5,comment:'Автопостинг работает как часы!',date:'05.01.24'},
  {user:'@katya',rating:5,comment:'Быстрая настройка, все работает стабильно',date:'15.01.24'},
  {user:'@denis',rating:4,comment:'Качественная работа, рекомендую!',date:'22.01.24'}
];

function renderReviews(){
  // Используем общую базу отзывов для всех услуг
  const reviews = globalReviews;
  const avg=reviews.length?(reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1):"-";
  const starsAvg=Array(5).fill(0).map((_,i)=>`<i class="fas fa-star${reviews.length&&i+1<=Math.round(avg)?'':'-o'}"></i>`).join('');
  const listHtml=reviews.map(r=>`<div class="review-card"><div class="review-head"><span class="review-user">${r.user}</span><span class="review-date">${r.date}</span></div><div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div><p>${r.comment}</p></div>`).join('');
  const listSection= reviews.length?`<div class="reviews-list scrollable">${listHtml}</div>`:'<p class="no-reviews">Пока нет отзывов</p>';

  // star selector html
  const starSelHtml=Array(5).fill(0).map((_,i)=>`<i data-val="${i+1}" class="fas fa-star"></i>`).join('');

  return `<div class="review-tile"><div class="reviews-summary"><span class="avg">${avg}</span>${starsAvg}<span class="count">(${reviews.length})</span></div>${listSection}
  <div class="leave-review-area">
    <div class="review-invite-text">Оставьте свой отзыв</div>
    <div class="star-select" id="starSelect">${starSelHtml}</div>
    <textarea id="reviewText" placeholder="${getText('servicesPage.reviews.form.placeholder', 'Ваш отзыв...')}"></textarea>
    <button class="btn btn-primary btn-send" id="sendReviewBtn" disabled>${getText('servicesPage.reviews.form.submitButton', 'Отправить')}</button>
  </div></div>`;
}

