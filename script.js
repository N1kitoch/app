// DOM Elements
const serviceModal = document.getElementById('serviceModal');
const modalContent = document.getElementById('modalContent');
const closeModal = document.querySelector('.close');
const contactForm = document.getElementById('contactForm');
const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
const pages = document.querySelectorAll('.page');

// Page Navigation
function showPage(pageId) {
    // Remove active class from all pages and nav items
    pages.forEach(page => {
        page.classList.remove('active');
        page.classList.remove('fade-out');
    });
    
    mobileNavItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to target page and nav item
    const targetPage = document.getElementById(pageId);
    const targetNavItem = document.querySelector(`[onclick*="${pageId}"]`);
    
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
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
        }
    }
    
    // Scroll to top
    window.scrollTo({
        top: 0,
        behavior: 'auto'
    });
}

// Initialize first page
document.addEventListener('DOMContentLoaded', () => {
    showPage('home');
});

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
            description: 'Ведю ваш продукт от идеи до реализации, обеспечиваю эффективную коммуникацию с командой и создаю качественные технические задания.',
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
            description: 'Индивидуальные решения под ваши уникальные задачи. Обсудим проект и найдем оптимальное решение.',
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
                <h2>${service.title}</h2>
                <p class="service-description">${service.description}</p>
                
                <div class="service-details">
                    <div class="detail-item">
                        <h4>Что входит в услугу:</h4>
                        <ul>
                            ${service.features.map(feature => `<li>${feature}</li>`).join('')}
                        </ul>
                    </div>
                    
                    <div class="detail-item">
                        <h4>Технологии:</h4>
                        <div class="tech-tags">
                            ${service.technologies.map(tech => `<span>${tech}</span>`).join('')}
                        </div>
                    </div>
                    
                    <div class="detail-item">
                        <h4>Стоимость:</h4>
                        <p class="price">${service.price}</p>
                    </div>
                    
                    <div class="detail-item">
                        <h4>Сроки:</h4>
                        <p>${service.duration}</p>
                    </div>
                </div>
                
                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="contactForService('${service.title}')">
                        <i class="fas fa-paper-plane"></i>
                        Заказать услугу
                    </button>
                    <button class="btn btn-secondary" onclick="closeServiceModal()">
                        Закрыть
                    </button>
                </div>
            </div>
        `;
        
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

// Contact form for specific service
function contactForService(serviceName) {
    closeServiceModal();
    showPage('contact');
    
    // Pre-fill the message field
    const messageField = document.getElementById('message');
    if (messageField) {
        messageField.value = `Здравствуйте! Меня интересует услуга "${serviceName}". Пожалуйста, свяжитесь со мной для обсуждения деталей проекта.`;
    }
    
    // Send service interest to bot if available
    if (tg && userData) {
        const serviceData = {
            type: 'service_interest',
            service: serviceName,
            userData: userData,
            timestamp: new Date().toISOString()
        };
        
        console.log('Sending service interest:', serviceData);
        sendDataToBot(serviceData).then(sent => {
            if (sent) {
                console.log('Service interest sent to bot');
            } else {
                console.log('Failed to send service interest to bot');
            }
        });
    }
}

// Contact Form Submission
contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    // Show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
    
    // Get form data
    const formData = new FormData(contactForm);
    const data = {
        name: formData.get('name'),
        message: formData.get('message')
    };
    
    try {
        // Send data to bot if available
        if (tg && userData) {
            const botData = {
                type: 'contact_form',
                formData: data,
                userData: userData,
                timestamp: new Date().toISOString()
            };
            
            console.log('Sending contact form data:', botData);
            const sentToBot = await sendDataToBot(botData);
            if (sentToBot) {
                showNotification('Сообщение отправлено в Telegram!', 'success');
            } else {
                showNotification('Сообщение отправлено через форму!', 'success');
            }
        } else {
            // Fallback: simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        showNotification('Сообщение успешно отправлено! Я свяжусь с вами в течение 2 часов.', 'success');
        }
        
        // Reset form
        contactForm.reset();
        
    } catch (error) {
        showNotification('Произошла ошибка при отправке. Попробуйте еще раз.', 'error');
        console.error('Form submission error:', error);
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

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
        background: white;
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
    }
    
    .notification-success i { color: #10b981; }
    .notification-error i { color: #ef4444; }
    .notification-info i { color: #3b82f6; }
    
    @media (max-width: 768px) {
        .notification {
            right: 16px;
            left: 16px;
            max-width: none;
        }
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
let DEBUG_MODE = false;
const ADMIN_ID = 585028258; // TODO: optionally sync from bot; for now hardcoded
const logsBuffer = [];
const BACKEND_URL = '';

function getBackendUrl() {
    const p = new URLSearchParams(window.location.search);
    const fromParam = p.get('api');
    if (fromParam && /^https?:\/\//i.test(fromParam)) return fromParam.replace(/\/$/, '');
    if (BACKEND_URL && /^https?:\/\//i.test(BACKEND_URL)) return BACKEND_URL.replace(/\/$/, '');
    return '';
}

function getLaunchMode() {
    if (!tg) return 'unknown';
    const hasSendData = typeof tg.sendData === 'function';
    const hasQueryId = !!(tg.initDataUnsafe && tg.initDataUnsafe.query_id);
    if (hasQueryId) return 'query';
    if (hasSendData) return 'keyboard';
    return 'unknown';
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
    wrap.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:35%;overflow:auto;background:rgba(0,0,0,.8);color:#0f0;font:12px/1.4 monospace;z-index:9999;padding:8px;';
    document.body.appendChild(wrap);
    const log = console.log.bind(console);
    const err = console.error.bind(console);
    console.log = (...args) => { log(...args); appendDbg('LOG', args); appendLog('LOG', args); };
    console.error = (...args) => { err(...args); appendDbg('ERR', args); appendLog('ERR', args); };
    function appendDbg(tag, args) {
        const pre = document.createElement('pre');
        pre.style.margin = '0 0 6px';
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
    const profileDataEl = document.getElementById('profileData');
    if (!profileDataEl) return;
    if (document.getElementById('openLogsBtn')) return;
    const btnWrap = document.createElement('div');
    btnWrap.style.marginTop = '12px';
    btnWrap.innerHTML = `
        <button id="openLogsBtn" class="btn btn-outline" style="margin-top:8px;" onclick="showLogsPage()">
            <i class="fas fa-terminal"></i>
            Открыть логи (только админ)
        </button>
    `;
    profileDataEl.parentElement.insertBefore(btnWrap, profileDataEl.nextSibling);
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
// Check if running in Telegram Web App
function initTelegramWebApp() {
    console.log('initTelegramWebApp called');
    console.log('window.Telegram available:', !!window.Telegram);
    console.log('window.Telegram.WebApp available:', !!(window.Telegram && window.Telegram.WebApp));
    
    if (window.Telegram && window.Telegram.WebApp) {
        console.log('Telegram Web App detected, initializing...');
        tg = window.Telegram.WebApp;
        
        // Initialize Telegram Web App
        tg.ready();
        console.log('tg.ready() called');
        
        // Set theme
        if (tg.colorScheme === 'dark') {
            document.body.classList.add('tg-dark-theme');
            console.log('Dark theme applied');
        } else {
            console.log('Light theme detected');
        }
        
        // Main Button is completely disabled - no buttons will appear
        if (tg.MainButton) {
            tg.MainButton.hide();
            tg.MainButton.disable();
            console.log('MainButton disabled and hidden');
        }
        
        // Load user data
        console.log('Loading user profile...');
        loadUserProfile();
        // Toggle banner if in query mode without backend
        setTimeout(() => {
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
        }, 0);
        
        console.log('Telegram Web App initialized successfully');
    } else {
        console.log('Telegram Web App not available, running in standalone mode');
        console.log('Available global objects:', Object.keys(window).filter(key => key.toLowerCase().includes('telegram')));
    }
}

// Load user profile from Telegram
async function loadUserProfile() {
    console.log('loadUserProfile started');
    
    if (!tg) {
        console.log('Telegram Web App not available (tg is null)');
        return;
    }
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('loadUserProfile timeout after 10 seconds')), 10000);
    });
    
    try {
        console.log('Getting user data from Telegram...');
        // Get user data from Telegram
        const initData = tg.initData;
        const user = tg.initDataUnsafe?.user;
        
        console.log('initData:', initData);
        console.log('user object:', user);
        console.log('tg.initDataUnsafe:', tg.initDataUnsafe);
        
        if (user) {
            console.log('User data found, processing...');
            userData = {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                username: user.username,
                languageCode: user.language_code,
                isPremium: user.is_premium || false,
                photoUrl: user.photo_url || null
            };
            
            console.log('User data processed:', userData);
            
            // Update profile display
            console.log('Updating profile display...');
            updateProfileDisplay();
            ensureLogsButtonInProfile();
            
            // Send user data to bot
            console.log('Sending user data to bot...');
            await sendUserDataToBot(userData);
            
            // Do not auto-send profile via tg.sendData here to avoid closing the app unexpectedly.
            // Use explicit user actions (form submit, service interest, etc.) to send data.
            
            console.log('loadUserProfile completed successfully');
        } else {
            console.log('No user data found, trying fallback...');
            // Fallback: try to get data from URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            const userId = urlParams.get('user_id');
            const userName = urlParams.get('user_name');
            
            console.log('URL params - userId:', userId, 'userName:', userName);
            
            if (userId && userName) {
                userData = {
                    id: userId,
                    firstName: userName,
                    lastName: '',
                    username: urlParams.get('username') || '',
                    languageCode: urlParams.get('lang') || 'ru',
                    isPremium: false,
                    photoUrl: null
                };
                console.log('Fallback user data created:', userData);
                updateProfileDisplay();
                ensureLogsButtonInProfile();
            } else {
                console.log('No fallback data available');
                // Create test user data for development
                userData = {
                    id: 'test_user',
                    firstName: 'Тестовый',
                    lastName: 'Пользователь',
                    username: 'testuser',
                    languageCode: 'ru',
                    isPremium: false,
                    photoUrl: null
                };
                console.log('Test user data created:', userData);
                updateProfileDisplay();
                ensureLogsButtonInProfile();
            }
        }
        
    } catch (error) {
        console.error('Error in loadUserProfile:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        showProfileError();
    }
}

// Update profile display with user data
function updateProfileDisplay() {
    console.log('updateProfileDisplay called with userData:', userData);
    
    if (!userData) {
        console.log('No userData available, skipping update');
        return;
    }
    
    // Update profile card
    const userNameElement = document.getElementById('userName');
    const userStatusElement = document.getElementById('userStatus');
    const userAvatarElement = document.getElementById('userAvatar');
    
    console.log('Profile elements found:', {
        userNameElement: !!userNameElement,
        userStatusElement: !!userStatusElement,
        userAvatarElement: !!userAvatarElement
    });
    
    if (userNameElement) {
        userNameElement.textContent = `${userData.firstName} ${userData.lastName}`.trim();
        console.log('User name updated');
    }
    
    if (userStatusElement) {
        userStatusElement.textContent = userData.isPremium ? 'Premium пользователь' : 'Пользователь';
        console.log('User status updated');
    }
    
    if (userAvatarElement && userData.photoUrl) {
        userAvatarElement.innerHTML = `<img src="${userData.photoUrl}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        console.log('User avatar updated');
    }
    
    // Update profile data section
    console.log('Updating profile data section...');
    updateProfileDataSection();
    
    console.log('updateProfileDisplay completed');
}

// Update profile data section
function updateProfileDataSection() {
    const profileDataElement = document.getElementById('profileData');
    if (!profileDataElement || !userData) return;
    
    profileDataElement.innerHTML = `
        <div class="profile-info-grid">
            <div class="profile-info-item">
                <div class="info-label">
                    <i class="fas fa-id-card"></i>
                    <span>ID пользователя</span>
                </div>
                <div class="info-value">${userData.id}</div>
            </div>
            
            <div class="profile-info-item">
                <div class="info-label">
                    <i class="fas fa-user"></i>
                    <span>Имя</span>
                </div>
                <div class="info-value">${userData.firstName} ${userData.lastName}</div>
            </div>
            
            <div class="profile-info-item">
                <div class="info-label">
                    <i class="fas fa-at"></i>
                    <span>Username</span>
                </div>
                <div class="info-value">${userData.username ? '@' + userData.username : 'Не указан'}</div>
            </div>
            
            <div class="profile-info-item">
                <div class="info-label">
                    <i class="fas fa-globe"></i>
                    <span>Язык</span>
                </div>
                <div class="info-value">${userData.languageCode.toUpperCase()}</div>
            </div>
            
            <div class="profile-info-item">
                <div class="info-label">
                    <i class="fas fa-crown"></i>
                    <span>Статус</span>
                </div>
                <div class="info-value">${userData.isPremium ? 'Premium' : 'Обычный'}</div>
            </div>
        </div>
        
        <div class="profile-actions">
            <button class="btn btn-primary" onclick="refreshProfile()">
                <i class="fas fa-sync-alt"></i>
                Обновить профиль
            </button>
            <button class="btn btn-outline" onclick="editProfile()">
                <i class="fas fa-edit"></i>
                Редактировать
            </button>
        </div>
    `;
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
    loadUserProfile();
}

// Edit profile (placeholder for future functionality)
function editProfile() {
    showNotification('Функция редактирования профиля будет доступна в следующем обновлении', 'info');
}

// Send user data to bot
async function sendUserDataToBot(userData) {
    console.log('[sendUserDataToBot] called with:', userData);
    // Do NOT auto-send via sendData here to avoid closing app unexpectedly.
    return false;
}

// Send data from webapp to bot
async function sendDataToBot(data) {
    console.log('sendDataToBot called with:', data);
    
    if (!tg) {
        console.log('Telegram Web App not available (tg is null)');
        return false;
    }
    
    const mode = getLaunchMode();
    console.log('Launch mode detected:', mode);
    
    if (mode === 'keyboard') {
        if (!tg.sendData) {
            console.log('tg.sendData not available in keyboard mode');
            return false;
        }
        try {
            console.log('Sending data to bot via tg.sendData:', data);
            const dataString = JSON.stringify(data);
            tg.sendData(dataString);
            console.log('Data sent to bot successfully via tg.sendData()');
            return true;
        } catch (error) {
            console.error('Error sending data to bot (sendData):', error);
            return false;
        }
    }
    
    if (mode === 'query') {
        const api = getBackendUrl();
        if (!api) {
            console.log('Backend URL not configured. Cannot use answerWebAppQuery flow.');
            showNotification('Невозможно отправить сейчас. Откройте мини‑апп из кнопки клавиатуры или добавьте параметр ?api=...', 'error');
            return false;
        }
        try {
            console.log('Sending data to backend for answerWebAppQuery:', { api, data });
            const resp = await fetch(`${api}/webapp-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: tg.initData, payload: data })
            });
            const json = await resp.json().catch(() => ({}));
            if (!resp.ok || json.ok === false) {
                console.error('Backend returned error', json);
                showNotification('Сервер отклонил запрос. Попробуйте позже или откройте через клавиатуру.', 'error');
                return false;
            }
            console.log('Backend accepted data successfully');
            // In this flow, Telegram закроет мини‑апп после answerWebAppQuery на стороне сервера
            return true;
        } catch (e) {
            console.error('Failed to call backend:', e);
            showNotification('Не удалось связаться с сервером. Откройте через клавиатуру или повторите позже.', 'error');
            return false;
        }
    }
    
    console.log('Unknown launch mode. Falling back to notification.');
    showNotification('Режим запуска не поддерживает отправку. Откройте через кнопку клавиатуры бота.', 'error');
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

// Fallback for when Telegram Web App is not available
if (!window.Telegram) {
    console.log('Telegram Web App not available, running in standalone mode');
    
    // Simulate user data for testing
    setTimeout(() => {
        userData = {
            id: '12345',
            firstName: 'Тестовый',
            lastName: 'Пользователь',
            username: 'testuser',
            languageCode: 'ru',
            isPremium: false,
            photoUrl: null
        };
        updateProfileDisplay();
        
        // Show test mode notification
        showNotification('Режим тестирования: Telegram Web App недоступен', 'info');
        
        // Add test buttons for development
        addTestButtons();
    }, 1000);
}

// Add test buttons for development
function addTestButtons() {
    const testContainer = document.createElement('div');
    testContainer.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 15px;
        border-radius: 10px;
        z-index: 10000;
        font-family: monospace;
        font-size: 12px;
    `;
    
    testContainer.innerHTML = `
        <div style="margin-bottom: 10px;"><strong>🧪 Тестовый режим</strong></div>
        <button onclick="testContactForm()" style="margin: 5px; padding: 5px 10px;">📝 Тест формы</button>
        <button onclick="testServiceInterest()" style="margin: 5px; padding: 5px 10px;">🎯 Тест услуги</button>
        <button onclick="testProfileUpdate()" style="margin: 5px; padding: 5px 10px;">👤 Тест профиля</button>
    `;
    
    document.body.appendChild(testContainer);
}

// Test functions
function testContactForm() {
    console.log('Testing contact form submission...');
    const testData = {
        type: 'contact_form',
        formData: {
            name: 'Тестовый пользователь',
            message: 'Это тестовое сообщение'
        },
        userData: userData,
        timestamp: new Date().toISOString()
    };
    
    console.log('Test data:', testData);
    showNotification('Тестовые данные отправлены в консоль', 'success');
}

function testServiceInterest() {
    console.log('Testing service interest...');
    const testData = {
        type: 'service_interest',
        service: 'ai-managers',
        userData: userData,
        timestamp: new Date().toISOString()
    };
    
    console.log('Test data:', testData);
    showNotification('Тестовые данные отправлены в консоль', 'success');
}

function testProfileUpdate() {
    console.log('Testing profile update...');
    const testData = {
        type: 'user_data',
        userData: userData,
        timestamp: new Date().toISOString()
    };
    
    console.log('Test data:', testData);
    showNotification('Тестовые данные отправлены в консоль', 'success');
}

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
    
    @media (max-width: 768px) {
        .modal-actions {
            flex-direction: column;
        }
        
        .modal-actions .btn {
            width: 100%;
        }
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