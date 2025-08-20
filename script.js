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
    
    // Toggle body scroll and page-home class: disable on home, enable otherwise
    if (pageId === 'home') {
        document.body.style.overflow = 'hidden';
        document.body.classList.add('page-home');
        // Initialize feature details on home page
        setTimeout(initFeatureDetails, 100);
    } else {
        document.body.style.overflow = 'auto';
        document.body.classList.remove('page-home');
        // Clear auto-switch interval when leaving home page
        if (autoSwitchInterval) {
            clearInterval(autoSwitchInterval);
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
        email: formData.get('email'),
        message: formData.get('message')
    };
    
    try {
        // Simulate API call (replace with actual endpoint)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Show success message
        showNotification('Сообщение успешно отправлено! Я свяжусь с вами в течение 2 часов.', 'success');
        
        // Reset form
        contactForm.reset();
        
    } catch (error) {
        showNotification('Произошла ошибка при отправке. Попробуйте еще раз.', 'error');
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

// Check if running in Telegram Web App
function initTelegramWebApp() {
    if (window.Telegram && window.Telegram.WebApp) {
        tg = window.Telegram.WebApp;
        
        // Initialize Telegram Web App
        tg.ready();
        
        // Set theme
        if (tg.colorScheme === 'dark') {
            document.body.classList.add('tg-dark-theme');
        }
        
        // Set main button if needed
        tg.MainButton.setText('Связаться');
        tg.MainButton.onClick(() => {
            showPage('contact');
        });
        
        // Show main button on home page
        const homePage = document.getElementById('home');
        if (homePage) {
            const homeObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && entry.target.classList.contains('active')) {
                        tg.MainButton.show();
                    } else {
                        tg.MainButton.hide();
                    }
                });
            });
            homeObserver.observe(homePage);
        }
        
        console.log('Telegram Web App initialized');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initTelegramWebApp);

// Fallback for when Telegram Web App is not available
if (!window.Telegram) {
    console.log('Telegram Web App not available, running in standalone mode');
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