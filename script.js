// DOM Elements
let serviceModal;
let modalContent;
const closeModal = document.querySelector('.close');
const contactForm = document.getElementById('contactForm');

// Глобальные переменные для страниц и навигации (будут инициализированы после загрузки DOM)
let mobileNavItems;
let pages;

// ===== СИСТЕМА УМНОГО КЭШИРОВАНИЯ =====

// Ключи для localStorage
const CACHE_KEYS = {
    reviews: 'app_cache_reviews_v1',
    requests: 'app_cache_requests_v1',
    stats: 'app_cache_stats_v1',
    averageRating: 'app_cache_rating_v1'
};

// Настройки кэширования
const CACHE_CONFIG = {
    reviews: {
        keepInCache: 30, // дней
        loadMoreButton: true,
        maxItems: 1000
    },
    requests: {
        keepInCache: 30, // дней
        loadMoreButton: false,
        maxItems: 1000
    },
    chatMessages: {
        keepInCache: 7, // дней
        loadMoreButton: true,
        maxItems: 1000
    },
    stats: {
        keepInCache: 1, // день
        loadMoreButton: false,
        maxItems: 100
    },
    averageRating: {
        keepInCache: 30, // дней
        loadMoreButton: false,
        maxItems: 1
    }
};

// Глобальные флаги для кнопок "Загрузить еще"
window.hasMoreReviews = false;
window.hasMoreChatMessages = false;

// Глобальные переменные для данных
let globalOrders = [];
let globalChatMessages = [];

// Reviews pagination
let reviewsPage = 0;
let reviewsPerPage = 25;
let allReviews = [];
let hasMoreReviews = false;

// Глобальный кэш данных в памяти
window.dataCache = {
    reviews: {
        data: [],
        lastUpdate: 0,
        updateInterval: 30 * 60 * 1000 // 30 минут
    },
    requests: {
        data: [],
        lastUpdate: 0,
        updateInterval: 30 * 1000 // 30 секунд для заказов
    },
    chatMessages: {
        data: {},
        lastUpdate: 0,
        updateInterval: 10 * 1000 // 10 секунд для чата
    },
    stats: {
        data: {},
        lastUpdate: 0,
        updateInterval: 5 * 60 * 1000 // 5 минут
    },
    averageRating: {
        data: null,
        lastUpdate: 0,
        updateInterval: 30 * 60 * 1000 // 30 минут
    }
};

// ===== ФУНКЦИИ ДЛЯ LOCALSTORAGE =====

// Сохранение данных в localStorage
function saveToCache(dataType, data) {
    try {
        const config = CACHE_CONFIG[dataType];
        const now = Date.now();
        const cutoffDate = now - (config.keepInCache * 24 * 60 * 60 * 1000);
        
        // Фильтруем данные по дате
        let filteredData = data;
        if (Array.isArray(data)) {
            filteredData = data.filter(item => {
                const itemDate = new Date(item.timestamp || item.date || item.review_date).getTime();
                return itemDate > cutoffDate;
            });
        }
        
        const cacheData = {
            data: filteredData,
            lastUpdate: now,
            totalCount: Array.isArray(data) ? data.length : 1,
            hasMoreData: Array.isArray(data) ? data.length > filteredData.length : false
        };
        
        localStorage.setItem(CACHE_KEYS[dataType], JSON.stringify(cacheData));
        console.log(`💾 Кэш ${dataType} сохранен: ${filteredData.length} из ${data.length} записей`);
        
        // Обновляем флаги для кнопок "Загрузить еще"
        if (dataType === 'reviews') {
            window.hasMoreReviews = cacheData.hasMoreData;
        }
        
    } catch (error) {
        console.warn(`⚠️ Ошибка сохранения в localStorage:`, error);
    }
}

// Загрузка данных из localStorage
function loadFromCache(dataType) {
    try {
        const cached = localStorage.getItem(CACHE_KEYS[dataType]);
        if (cached) {
            const cacheData = JSON.parse(cached);
            const timeSinceUpdate = Date.now() - cacheData.lastUpdate;
            const config = CACHE_CONFIG[dataType];
            
            // Проверяем актуальность кэша
            if (timeSinceUpdate < config.keepInCache * 24 * 60 * 60 * 1000) {
                console.log(`📦 Загружен кэш ${dataType} из localStorage: ${cacheData.data.length} записей`);
                
                // Обновляем кэш в памяти
                if (window.dataCache && window.dataCache[dataType]) {
                    window.dataCache[dataType].data = cacheData.data;
                    window.dataCache[dataType].lastUpdate = cacheData.lastUpdate;
                }
                
                // Обновляем флаги
                if (dataType === 'reviews') {
                    window.hasMoreReviews = cacheData.hasMoreData;
                }
                
                return cacheData.data;
            } else {
                console.log(`⏰ Кэш ${dataType} устарел, требуется обновление`);
            }
        }
    } catch (error) {
        console.warn(`⚠️ Ошибка загрузки из localStorage:`, error);
    }
    return null;
}

// ===== ФУНКЦИИ ДЛЯ INDEXEDDB =====

// Инициализация IndexedDB
function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('AppCacheDB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Создаем хранилище для чата
            if (!db.objectStoreNames.contains('chatMessages')) {
                const store = db.createObjectStore('chatMessages', { keyPath: 'id' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

// Сохранение чата в IndexedDB
async function saveChatToIndexedDB(messages) {
    try {
        const db = await initIndexedDB();
        const transaction = db.transaction(['chatMessages'], 'readwrite');
        const store = transaction.objectStore('chatMessages');
        
        // Очищаем старые данные
        await store.clear();
        
        // Сохраняем новые (ограничиваем количество)
        const limitedMessages = messages.slice(-CACHE_CONFIG.chatMessages.maxItems);
        
        for (const message of limitedMessages) {
            await store.add({
                id: message.id || Date.now() + Math.random(),
                ...message,
                timestamp: Date.now()
            });
        }
        
        console.log(`💾 ${limitedMessages.length} сообщений сохранено в IndexedDB`);
        window.hasMoreChatMessages = messages.length > limitedMessages.length;
        
    } catch (error) {
        console.error('❌ Ошибка сохранения в IndexedDB:', error);
    }
}

// Загрузка чата из IndexedDB
async function loadChatFromIndexedDB() {
    try {
        const db = await initIndexedDB();
        const transaction = db.transaction(['chatMessages'], 'readonly');
        const store = transaction.objectStore('chatMessages');
        const request = store.getAll();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const messages = request.result.sort((a, b) => a.timestamp - b.timestamp);
                console.log(`📦 Загружено ${messages.length} сообщений из IndexedDB`);
                resolve(messages);
            };
            request.onerror = () => reject(request.error);
        });
        
    } catch (error) {
        console.error('❌ Ошибка загрузки из IndexedDB:', error);
        return [];
    }
}

// ===== ФУНКЦИИ ЗАГРУЗКИ ДАННЫХ =====

// Загрузка данных (бэкенд возвращает только последние записи)
async function loadDataFromBackend(dataType, limit = 50) {
    console.log(`🔍 loadDataFromBackend: ${dataType}, limit: ${limit}`);
    try {
        const response = await fetch(`${BACKEND_URL}/api/frontend/data/${dataType}`);
        
        if (response.ok) {
            const result = await response.json();
            const allData = result.success ? result.data : [];
            console.log(`📦 Получены данные ${dataType}: ${allData.length} записей`);
            
            // Для отзывов и заказов возвращаем все данные, для остальных - ограниченное количество
            let paginatedData;
            if (dataType === 'reviews' || dataType === 'requests') {
                paginatedData = allData; // Все отзывы и заказы
            } else {
                paginatedData = allData.slice(-limit); // Ограниченное количество
            }
            
            return {
                data: paginatedData,
                total: allData.length,
                hasMore: dataType === 'reviews' ? false : allData.length > limit
            };
        }
    } catch (error) {
        console.error(`❌ Ошибка загрузки ${dataType}:`, error);
    }
    
    return { data: [], total: 0, hasMore: false };
}

// Умная загрузка данных с fallback
async function loadDataWithFallback(dataType, forceUpdate = false) {
    console.log(`🔍 loadDataWithFallback: ${dataType}, forceUpdate: ${forceUpdate}`);
    
    // 1. Показываем кэшированные данные сразу (кроме отзывов)
    let cachedData = null;
    
    if (dataType === 'chatMessages') {
        cachedData = await loadChatFromIndexedDB();
    } else if (dataType !== 'reviews') {
        // Для отзывов не показываем кэшированные данные, всегда обновляем
        cachedData = loadFromCache(dataType);
    }
    
    if (cachedData && !forceUpdate && dataType !== 'reviews' && dataType !== 'requests') {
        console.log(`📦 Показываем кэшированные ${dataType}: ${cachedData.length} записей`);
        displayData(dataType, cachedData);
    }
    
    // Для заказов загружаем из кэша, если есть данные
    if (dataType === 'requests' && cachedData && !forceUpdate) {
        console.log(`📦 Показываем кэшированные заказы: ${cachedData.length} заказов`);
        displayData(dataType, cachedData);
    }
    
    // 2. Пытаемся обновить данные
    try {
        if (dataType === 'chatMessages') {
            await updateChatIncrementally();
        } else {
            await updateDataWithFullReplace(dataType);
        }
    } catch (error) {
        console.warn(`⚠️ Не удалось обновить ${dataType}, используем кэш`);
    }
}

// Полная замена данных (для отзывов, статистики)
async function updateDataWithFullReplace(dataType) {
    try {
        // Для отзывов и заказов получаем все данные, для остальных - ограниченное количество
        const limit = (dataType === 'reviews' || dataType === 'requests') ? 1000 : 100;
        const result = await loadDataFromBackend(dataType, limit);
        
        if (result.data.length > 0) {
            // Для отзывов и заказов очищаем кэш перед сохранением новых данных
            if (dataType === 'reviews' || dataType === 'requests') {
                // Очищаем кэш
                localStorage.removeItem(CACHE_KEYS[dataType]);
                if (window.dataCache && window.dataCache[dataType]) {
                    window.dataCache[dataType].data = [];
                }
                console.log(`🧹 Кэш ${dataType} очищен перед обновлением`);
            }
            
            // Сохраняем в соответствующий кэш
            if (dataType === 'chatMessages') {
                await saveChatToIndexedDB(result.data);
            } else {
                saveToCache(dataType, result.data);
            }
            
            // Обновляем кэш в памяти
            if (window.dataCache && window.dataCache[dataType]) {
                window.dataCache[dataType].data = result.data;
                window.dataCache[dataType].lastUpdate = Date.now();
            }
            
            // Обновляем отображение
            displayData(dataType, result.data);
            
            console.log(`✅ ${dataType} обновлены: ${result.data.length} записей`);
        }
        
    } catch (error) {
        console.error(`❌ Ошибка обновления ${dataType}:`, error);
    }
}

// Инкрементальное обновление чата
async function updateChatIncrementally() {
    try {
        const cachedMessages = await loadChatFromIndexedDB();
        const lastMessageId = cachedMessages.length > 0 ? 
            Math.max(...cachedMessages.map(m => m.id)) : 0;
        
        // Запрашиваем все сообщения
        const result = await loadDataFromBackend('chatMessages', 50);
        
        if (result.data.length > 0) {
            // Фильтруем только новые сообщения
            const newMessages = result.data.filter(msg => msg.id > lastMessageId);
            
            if (newMessages.length > 0) {
                // Добавляем новые сообщения
                const allMessages = [...cachedMessages, ...newMessages];
                
                // Сохраняем обновленный список
                await saveChatToIndexedDB(allMessages);
                
                // Обновляем отображение
                displayData('chatMessages', allMessages);
                
                console.log(`✅ Добавлено ${newMessages.length} новых сообщений`);
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка обновления чата:', error);
    }
}

// Отображение данных
function displayData(dataType, data) {
    switch (dataType) {
        case 'reviews':
            // Обрабатываем данные отзывов из БД в формат для фронтенда
            globalReviews = data.map(review => {
                // Формируем имя пользователя
                let userName;
                if (review.username) {
                    userName = `@${review.username}`;
                } else if (review.first_name) {
                    userName = review.first_name;
                } else {
                    userName = 'Пользователь';
                }
                
                return {
                    user: userName,
                    rating: review.rating,
                    comment: review.comment,
                    date: review.review_date || new Date(review.timestamp).toLocaleDateString('ru-RU')
                };
            });
            updateReviewsDisplay();
            break;
        case 'requests':
            // Обрабатываем данные заказов из БД в формат для фронтенда
            // Фильтруем только заказы текущего пользователя
            const currentUserData = window.userData || userData;
            const currentUserId = currentUserData?.id;
            

            
            console.log('🔍 Обработка заказов:', {
                totalOrders: data.length,
                currentUserData: currentUserData,
                currentUserId: currentUserId,
                currentUserIdType: typeof currentUserId,
                windowUserData: window.userData,
                localUserData: userData,
                firstOrder: data[0] ? { id: data[0].id, user_id: data[0].user_id, user_id_type: typeof data[0].user_id } : null,
                ordersWithUnknown: data.filter(order => String(order.user_id || '') === 'unknown').length
            });
            
            // Фильтрация заказов по пользователю - простое совпадение ID
            let userOrders = [];
            let targetUserId = currentUserId;
            
            // Если ID пользователя не определен, используем 'unknown'
            if (!targetUserId || targetUserId === 'undefined' || targetUserId === 'null' || targetUserId === '') {
                targetUserId = 'unknown';
                console.log(`🔍 ID пользователя не определен, используем 'unknown'`);
            }
            
            userOrders = data.filter(order => {
                const orderUserId = String(order.user_id || '');
                const targetUserIdStr = String(targetUserId || '');
                return orderUserId === targetUserIdStr;
            });
            console.log(`🔍 Фильтрация заказов: найдено ${userOrders.length} заказов для пользователя ${targetUserId}`);
            

            
            // Обрабатываем каждый заказ
            userOrders.forEach(order => {
                // Формируем имя пользователя
                let userName;
                if (order.username) {
                    userName = `@${order.username}`;
                } else if (order.first_name) {
                    userName = order.first_name;
                } else {
                    userName = 'Пользователь';
                }
                
                // Преобразуем статус в читаемый вид
                let statusText, statusClass;
                switch (order.status) {
                    case 'pending':
                        statusText = 'Ожидает';
                        statusClass = 'status-pending';
                        break;
                    case 'active':
                        statusText = 'Активный';
                        statusClass = 'status-active';
                        break;
                    case 'completed':
                        statusText = 'Завершен';
                        statusClass = 'status-completed';
                        break;
                    case 'cancelled':
                        statusText = 'Отменен';
                        statusClass = 'status-cancelled';
                        break;
                    default:
                        statusText = 'Неизвестно';
                        statusClass = 'status-unknown';
                }
                
                const processedOrder = {
                    id: order.id,
                    user: userName,
                    service: order.service_name,
                    message: order.message,
                    status: statusText,
                    statusClass: statusClass,
                    date: new Date(order.timestamp).toLocaleDateString('ru-RU')
                };
                
                // Проверяем, существует ли заказ с таким ID
                const existingOrderIndex = globalOrders.findIndex(existingOrder => existingOrder.id === order.id);
                
                if (existingOrderIndex !== -1) {
                    // Заказ существует - обновляем его данные
                    const oldStatus = globalOrders[existingOrderIndex].status;
                    globalOrders[existingOrderIndex] = processedOrder;
                    
                    // Логируем изменение статуса
                    if (oldStatus !== processedOrder.status) {
                        console.log(`📦 Обновлен статус заказа #${order.id}: ${oldStatus} → ${processedOrder.status}`);
                    } else {
                        console.log(`📦 Обновлен заказ #${order.id}`);
                    }
                } else {
                    // Новый заказ - добавляем его
                    globalOrders.push(processedOrder);
                    console.log(`📦 Добавлен новый заказ #${order.id}`);
                }
            });
            
            // Сортируем по дате (новые сверху)
            globalOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Сохраняем заказы в кэш
            if (window.dataCache && window.dataCache.requests) {
                window.dataCache.requests.data = globalOrders;
                window.dataCache.requests.lastUpdate = Date.now();
                console.log(`💾 Заказы сохранены в кэш: ${globalOrders.length} заказов`);
            }
            
            // Сохраняем заказы в localStorage для персистентности
            saveToCache('requests', globalOrders);
            
            updateOrdersDisplay();
            break;

        case 'chatMessages':
            globalChatMessages = data;
            updateChatDisplay();
            break;
        case 'stats':
            updateStatsDisplay(data);
            break;
        case 'averageRating':
            updateRatingDisplay(data);
            break;
    }
}

// Функции обновления отображения
function updateReviewsDisplay() {
    const reviewsContainer = document.querySelector('.reviews-container');
    if (reviewsContainer) {
        reviewsContainer.innerHTML = renderReviews();
        initReviewStars();
    }
}

function updateOrdersDisplay() {
    const ordersContainer = document.getElementById('ordersContainer');
    const ordersEmptyState = document.getElementById('ordersEmptyState');
    const ordersList = document.getElementById('ordersList');
    const ordersHeaderTitle = document.getElementById('ordersHeaderTitle');
    
    if (!ordersContainer || !ordersEmptyState || !ordersList || !ordersHeaderTitle) {
        console.error('Не найдены элементы для отображения заказов');
        return;
    }
    
    const orders = globalOrders || [];
    console.log('🔍 updateOrdersDisplay:', {
        ordersLength: orders.length,
        globalOrders: globalOrders,
        ordersContainer: !!ordersContainer,
        ordersEmptyState: !!ordersEmptyState
    });
    
    if (orders.length === 0) {
        // Показываем пустое состояние
        ordersEmptyState.style.display = 'block';
        ordersContainer.style.display = 'none';
    } else {
        // Показываем заказы
        ordersEmptyState.style.display = 'none';
        ordersContainer.style.display = 'block';
        
        // Обновляем заголовок с количеством заказов
        ordersHeaderTitle.textContent = `Мои заказы (${orders.length})`;
        
        // Обновляем список заказов
        ordersList.innerHTML = renderOrders();
    }
}

function updateChatDisplay() {
    const chatContainer = document.querySelector('.chat-messages');
    if (chatContainer) {
        // Обновляем отображение чата
        renderChatMessages();
        // Прокручиваем к последнему сообщению
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

function updateStatsDisplay(stats) {
    // Обновляем отображение статистики
    const statsElements = document.querySelectorAll('[data-stat]');
    statsElements.forEach(element => {
        const statKey = element.getAttribute('data-stat');
        if (stats[statKey] !== undefined) {
            element.textContent = stats[statKey];
        }
    });
}

function updateRatingDisplay(ratingData) {
    // Обновляем отображение средней оценки
    const ratingElements = document.querySelectorAll('[data-rating]');
    ratingElements.forEach(element => {
        const ratingKey = element.getAttribute('data-rating');
        if (ratingData && ratingData[ratingKey] !== undefined) {
            element.textContent = ratingData[ratingKey];
        }
    });
}

// Функция для скрытия кнопки "Загрузить еще" в чате
function hideLoadMoreChatButton() {
    const button = document.getElementById('loadMoreChatBtn');
    if (button) {
        button.style.display = 'none';
    }
}

// ===== ФУНКЦИИ "ЗАГРУЗИТЬ ЕЩЕ" =====

// Загрузка старых отзывов
async function loadMoreReviews() {
    const button = document.getElementById('loadMoreReviews');
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';
    }
    
    try {
        // Загружаем все отзывы с бэкенда
        const result = await loadDataFromBackend('reviews', 1000);
        
        if (result.data.length > 0) {
            // Преобразуем отзывы
            const allReviews = result.data.map(review => {
                // Формируем имя пользователя
                let userName;
                if (review.username) {
                    userName = `@${review.username}`;
                } else if (review.first_name) {
                    userName = review.first_name;
                } else {
                    userName = 'Пользователь';
                }
                
                return {
                    user: userName,
                    rating: review.rating,
                    comment: review.comment,
                    date: review.review_date || new Date(review.timestamp).toLocaleDateString('ru-RU')
                };
            });
            
            // Заменяем текущие отзывы на все
            globalReviews = allReviews;
            
            // Обновляем отображение
            updateReviewsDisplay();
            
            console.log(`✅ Загружено ${allReviews.length} отзывов`);
            
            // Скрываем кнопку, так как загрузили все
            window.hasMoreReviews = false;
            updateReviewsDisplay();
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки старых отзывов:', error);
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-history"></i> Загрузить более старые отзывы';
        }
    }
}

// Загрузка старых сообщений чата
async function loadMoreChatMessages() {
    const button = document.getElementById('loadMoreChatBtn');
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';
    
    try {
        // Загружаем все сообщения с бэкенда
        const result = await loadDataFromBackend('chatMessages', 1000);
        
        if (result.data.length > 0) {
            // Заменяем текущие сообщения на все
            globalChatMessages = result.data;
            
            // Обновляем отображение
            updateChatDisplay();
            
            console.log(`✅ Загружено ${result.data.length} сообщений`);
            
            // Скрываем кнопку, так как загрузили все
            window.hasMoreChatMessages = false;
            hideLoadMoreChatButton();
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки старых сообщений:', error);
    } finally {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-chevron-up"></i> Загрузить старые сообщения';
    }
}

// ===== ОЧИСТКА КЭША =====

// Автоматическая очистка старых данных
function cleanupOldData() {
    const now = Date.now();
    
    // Очистка localStorage
    Object.keys(CACHE_KEYS).forEach(key => {
        try {
            const cached = localStorage.getItem(CACHE_KEYS[key]);
            if (cached) {
                const cacheData = JSON.parse(cached);
                const config = CACHE_CONFIG[key];
                const maxAge = config.keepInCache * 24 * 60 * 60 * 1000;
                
                if (now - cacheData.lastUpdate > maxAge) {
                    localStorage.removeItem(CACHE_KEYS[key]);
                    console.log(`🧹 Удален устаревший кэш ${key}`);
                }
            }
        } catch (error) {
            console.warn(`⚠️ Ошибка очистки кэша ${key}:`, error);
        }
    });
    
    // Очистка IndexedDB
    cleanupIndexedDB();
}

// Очистка IndexedDB от старых сообщений
async function cleanupIndexedDB() {
    try {
        const db = await initIndexedDB();
        const transaction = db.transaction(['chatMessages'], 'readwrite');
        const store = transaction.objectStore('chatMessages');
        const index = store.index('timestamp');
        
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const range = IDBKeyRange.upperBound(weekAgo);
        
        await index.delete(range);
        console.log('🧹 Удалены старые сообщения из IndexedDB');
    } catch (error) {
        console.error('❌ Ошибка очистки IndexedDB:', error);
    }
}

// ===== ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ КЭШИРОВАНИЯ =====

// Загрузка всех данных при инициализации
async function loadAllDataWithCache() {
    console.log('🔄 Загрузка данных с кэшированием...');
    
    await Promise.all([
        loadDataWithFallback('reviews'),
        loadDataWithFallback('requests'),
        loadDataWithFallback('chatMessages'),
        loadDataWithFallback('chat_orders'),
        loadDataWithFallback('stats'),
        loadDataWithFallback('averageRating')
    ]);
    
    console.log('✅ Загрузка данных завершена');
    
    // Запускаем периодическое обновление
    startPeriodicUpdates();
    
    // Запускаем периодическую очистку
    setInterval(cleanupOldData, 24 * 60 * 60 * 1000); // Раз в день
}

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
    
    // Прокручиваем страницу вверх при переходе
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
    
            // Home page initialization
        if (pageId === 'home') {
            // Main button is always hidden
            // Останавливаем пульсации при переходе на главную
            stopTagPulsing();
        } else {
        // Clear auto-switch interval when leaving home page
        if (typeof autoSwitchInterval !== 'undefined' && autoSwitchInterval) {
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
        
        // При переходе на страницы используем данные из кэша
        if (pageId === 'reviews-page') {
            // Обновляем отображение отзывов из кэша
            setTimeout(() => {
                updateReviewsPage();
            }, 100);
        }
        
        // При переходе на страницу заказов обновляем отображение
        if (pageId === 'orders-page') {
            // Обновляем отображение заказов
            setTimeout(() => {
                updateOrdersDisplay();
            }, 500);
        }
        
        if (pageId === 'chat-page') {
            // Загружаем данные чата и обновляем отображение
            setTimeout(() => {
                loadChatOrdersFromDB(true);
                if (currentChat) {
                    loadChatMessages(currentChat);
                }
            }, 500);
        }
        
        // Initialize services page
        if (pageId === 'services') {
            console.log('Initializing services page');
            setTimeout(() => {
                console.log('Loading service cards...');
                loadServiceCards();
            }, 100);
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
    
    // Handle responsive tags after page change
    setTimeout(handleResponsiveTags, 100);
    
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
    // Инициализируем userData для standalone режима в самом начале
    if (!window.userData && !window.tg) {
        // В standalone режиме не устанавливаем конкретного пользователя
        // Пользователь должен быть определен через Telegram Web App
        console.log('🔧 DOMContentLoaded: standalone режим, пользователь не определен');
    }
    
    // Инициализируем элементы модального окна
    serviceModal = document.getElementById('serviceModal');
    modalContent = document.getElementById('modalContent');
    
    // Делаем функции доступными глобально
    window.openServiceModal = openServiceModal;
    window.closeServiceModal = closeServiceModal;
    window.contactForService = contactForService;
    window.openOrderDetails = openOrderDetails;
    window.closeOrderModal = closeOrderModal;
    
    console.log('🔧 Функции заказов добавлены в window:', {
      openOrderDetails: typeof window.openOrderDetails,
      closeOrderModal: typeof window.closeOrderModal
    });
    
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
    
    // Тестовый вызов загрузки услуг
    setTimeout(() => {
        console.log('Testing service cards loading...');
        loadServiceCards();
    }, 1000);
    
    // Загружаем данные из БД с новой системой кэширования
    setTimeout(async () => {
        console.log('Loading data from database with caching...');
        await loadAllDataWithCache();
    }, 1500);
    
    // Очищаем интервалы при закрытии страницы
    window.addEventListener('beforeunload', () => {
        stopPeriodicUpdates();
    });
    
    // Добавляем отладочные функции в глобальную область
    window.debugData = {
        forceUpdate: forceUpdateAllData,
        getCacheInfo: getCacheInfo,
        startUpdates: startPeriodicUpdates,
        stopUpdates: stopPeriodicUpdates
    };
    
    console.log('🔧 Отладочные функции доступны: window.debugData');
    console.log('📊 Информация о кэше:', getCacheInfo());
    
    // Удален тестовый код автоматического переключения категорий
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
    
    // Инициализируем userData для standalone режима
    if (!window.userData && !window.tg) {
        console.log('🔧 initApp: standalone режим, пользователь не определен');
    }
    
    // Обработка страницы контактов перенесена в основную функцию showPage
    
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
        
        // Handle responsive tags after page is shown
        setTimeout(handleResponsiveTags, 100);
        
        // Инициализация завершена
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

// Service Categories Filtering
function initServiceCategories() {
    console.log('initServiceCategories called');
    const categoryTabs = document.querySelectorAll('.category-tab');
    const serviceCards = document.querySelectorAll('.service-compact-card');
    
    console.log('categoryTabs found:', categoryTabs.length);
    console.log('serviceCards found:', serviceCards.length);
    
    if (serviceCards.length === 0) {
        console.error('No service cards found! Categories will not work.');
        return;
    }
    
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const category = tab.getAttribute('data-category');
            console.log('Category clicked:', category);
            
            // Update active tab
            categoryTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Filter services
            let visibleCount = 0;
            serviceCards.forEach(card => {
                const cardCategory = card.getAttribute('data-category');
                console.log(`Card category: ${cardCategory}, filter: ${category}`);
                
                if (category === 'all' || cardCategory === category) {
                    card.style.display = 'block';
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                    visibleCount++;
                } else {
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(10px)';
                    setTimeout(() => {
                        card.style.display = 'none';
                    }, 200);
                }
            });
            
            console.log(`Filtered to ${visibleCount} visible cards`);
        });
    });
    
    console.log('Service categories initialized successfully');
}

// Show contact form with scroll to form
function showContactForm() {
    showPage('feedback-page');
}

// Load service cards from JSON
function loadServiceCards() {
    console.log('loadServiceCards called');
    const servicesGrid = document.querySelector('.services-compact-grid');
    if (!servicesGrid) {
        console.error('services-compact-grid not found');
        return;
    }
    console.log('servicesGrid found:', servicesGrid);
    
    // Get services data from JSON
    const servicesData = {
        'aiTelegram': {
            title: 'AI-ассистенты для Telegram',
            description: 'Интеллектуальные помощники для автоматизации коммуникации',
            price: 'от 50,000₽',
            button: 'Подробнее'
        },
        'channelAutomation': {
            title: 'Автоматизация каналов',
            description: 'Системы для автоматического ведения Telegram-каналов',
            price: 'от 75,000₽',
            button: 'Подробнее'
        },
        'onboardingSystems': {
            title: 'Системы онбординга',
            description: 'Автоматизированные системы адаптации новых пользователей',
            price: 'от 60,000₽',
            button: 'Подробнее'
        },
        'socialManagement': {
            title: 'Ведение социальных каналов',
            description: 'Организация работы в соцсетях с фокусом на процессах',
            price: 'от 60,000₽/мес',
            button: 'Подробнее'
        },
        'productSupport': {
            title: 'Продуктовое сопровождение',
            description: 'Ведение продукта "под ключ" от идеи до реализации',
            price: 'от 150,000₽/мес',
            button: 'Подробнее'
        },
        'noCodeWebsites': {
            title: 'Сайты и веб-приложения',
            description: 'No-code разработка с vibe-coding подходом',
            price: 'от 40,000₽',
            button: 'Подробнее'
        },
        'customDevelopment': {
            title: 'Индивидуальная разработка',
            description: 'Уникальные решения под специфические задачи',
            price: 'Договорная',
            button: 'Подробнее'
        },
        'telegramBots': {
            title: 'Создание Telegram ботов',
            description: 'Разработка функциональных ботов для бизнеса и личного использования',
            price: 'от 35,000₽',
            button: 'Подробнее'
        },
        'projectManager': {
            title: 'Проектный менеджер',
            description: 'Управление проектами от старта до финиша с фокусом на сроках, бюджете и качестве',
            price: 'от 150,000₽/мес',
            button: 'Подробнее'
        }
    };
    
    const serviceCards = [
        { id: 'ai-telegram', category: 'ai', icon: 'fas fa-robot', dataKey: 'aiTelegram' },
        { id: 'channel-automation', category: 'ai', icon: 'fas fa-broadcast-tower', dataKey: 'channelAutomation' },
        { id: 'onboarding-systems', category: 'ai', icon: 'fas fa-user-graduate', dataKey: 'onboardingSystems' },
        { id: 'social-management', category: 'social', icon: 'fas fa-users', dataKey: 'socialManagement' },
        { id: 'product-support', category: 'professions', icon: 'fas fa-project-diagram', dataKey: 'productSupport' },
        { id: 'project-manager', category: 'professions', icon: 'fas fa-tasks', dataKey: 'projectManager' },
        { id: 'no-code-websites', category: 'development', icon: 'fas fa-code', dataKey: 'noCodeWebsites' },
        { id: 'telegram-bots', category: 'development', icon: 'fas fa-paper-plane', dataKey: 'telegramBots' },
        { id: 'custom-development', category: 'development', icon: 'fas fa-cogs', dataKey: 'customDevelopment' }
    ];
    
    console.log('servicesData:', servicesData);
    console.log('serviceCards:', serviceCards);
    
    const htmlContent = serviceCards.map(service => {
        const serviceData = servicesData[service.dataKey];
        console.log(`Service ${service.dataKey}:`, serviceData);
        if (!serviceData) {
            console.error(`No data found for service: ${service.dataKey}`);
            return '';
        }
        
        return `
            <div class="service-compact-card" data-category="${service.category}" onclick="openServiceModal('${service.id}')">
                <div class="service-compact-header">
                    <div class="service-compact-icon">
                        <i class="${service.icon}"></i>
                    </div>
                    <div class="service-compact-info">
                        <div class="service-compact-title-row">
                            <h3>${serviceData.title}</h3>
                        </div>
                        <p>${serviceData.description}</p>
                    </div>
                </div>
                <div class="service-compact-actions">
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openServiceModal('${service.id}')">
                        <i class="fas fa-info-circle"></i>
                        <span>${serviceData.button}</span>
                    </button>
                    <div class="service-compact-price-new">
                        <span>${serviceData.price}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    console.log('Generated HTML:', htmlContent);
    servicesGrid.innerHTML = htmlContent;
    console.log('Services grid innerHTML set');
    
    // Initialize categories after cards are loaded
    setTimeout(() => {
        initServiceCategories();
    }, 100);
}

// Get modal data from static object
function getModalData(serviceKey) {
    const modalData = {
        'aiTelegram': {
            title: 'AI-ассистенты для Telegram',
            description: 'Создаю интеллектуальных помощников для автоматизации коммуникации в Telegram. От простых автоответов до сложных систем обработки запросов.',
            features: [
                'Автоматические ответы на частые вопросы',
                'Обработка заявок и запросов',
                'Интеграция с CRM и другими системами',
                'Аналитика и отчеты',
                'Персонализация ответов',
                '24/7 доступность'
            ],
            technologies: ['OpenAI GPT', 'Telegram Bot API', 'Python', 'Node.js'],
            price: 'от 50,000₽',
            duration: '2-3 недели'
        },
        'channelAutomation': {
            title: 'Автоматизация каналов',
            description: 'Системы для автоматического ведения Telegram-каналов с умной модерацией и аналитикой.',
            features: [
                'Автоматический постинг контента',
                'Умная модерация комментариев',
                'Аналитика активности подписчиков',
                'Интеграция с внешними источниками',
                'Планировщик публикаций',
                'Отчеты по эффективности'
            ],
            technologies: ['Telegram API', 'Python', 'Базы данных', 'Аналитика'],
            price: 'от 75,000₽',
            duration: '3-4 недели'
        },
        'onboardingSystems': {
            title: 'Системы онбординга',
            description: 'Автоматизированные системы адаптации новых пользователей и сотрудников.',
            features: [
                'Интерактивные обучающие материалы',
                'Прогресс-трекинг',
                'Автоматические напоминания',
                'Тестирование и оценка',
                'Персонализация обучения',
                'Интеграция с HR-системами'
            ],
            technologies: ['LMS', 'API интеграции', 'Аналитика', 'Базы данных'],
            price: 'от 60,000₽',
            duration: '4-6 недель'
        },
        'socialManagement': {
            title: 'Ведение социальных каналов',
            description: 'Организация работы в социальных сетях с фокусом на процессах и автоматизации.',
            features: [
                'Стратегическое планирование контента',
                'Автоматизация рутинных задач',
                'Аналитика и отчетность',
                'Управление командой',
                'Интеграция с CRM',
                'A/B тестирование'
            ],
            technologies: ['Социальные API', 'Аналитика', 'Автоматизация', 'CRM'],
            price: 'от 60,000₽/мес',
            duration: 'Постоянно'
        },
        'productSupport': {
            title: 'Продуктовое сопровождение',
            description: 'Ведение продукта "под ключ" от идеи до реализации с полным контролем процессов.',
            features: [
                'Анализ требований и планирование',
                'Создание технических заданий',
                'Координация команды разработчиков',
                'Контроль качества и сроков',
                'UX/UI консультации',
                'Поддержка после запуска'
            ],
            technologies: ['Agile', 'Scrum', 'Jira', 'Figma', 'Аналитика'],
            price: 'от 150,000₽/мес',
            duration: 'По проекту'
        },
        'projectManager': {
            title: 'Проектный менеджер',
            description: 'Профессиональное управление проектами с акцентом на достижение целей в рамках бюджета и сроков.',
            features: [
                'Планирование и контроль сроков проекта',
                'Управление бюджетом и ресурсами',
                'Координация команды и подрядчиков',
                'Контроль качества и соответствия требованиям',
                'Управление рисками и изменениями',
                'Отчетность и коммуникация с заказчиком'
            ],
            technologies: ['Agile', 'Scrum', 'Kanban', 'Jira', 'Trello', 'Notion'],
            price: 'от 150,000₽/мес',
            duration: 'По проекту'
        },
        'noCodeWebsites': {
            title: 'Сайты и веб-приложения',
            description: 'No-code разработка с vibe-coding подходом для быстрого создания современных веб-решений.',
            features: [
                'Создание лендингов и сайтов',
                'Веб-приложения без кода',
                'Интеграция с внешними сервисами',
                'Адаптивный дизайн',
                'SEO-оптимизация',
                'Техническая поддержка'
            ],
            technologies: ['Webflow', 'Bubble', 'Zapier', 'Airtable', 'API'],
            price: 'от 40,000₽',
            duration: '1-2 недели'
        },
        'telegramBots': {
            title: 'Создание Telegram ботов',
            description: 'Разработка функциональных Telegram ботов для автоматизации бизнес-процессов.',
            features: [
                'Разработка ботов под ваши задачи',
                'Интеграция с внешними API',
                'Автоматизация рутинных процессов',
                'Система уведомлений и оповещений',
                'Аналитика и отчеты',
                'Техническая поддержка и доработки'
            ],
            technologies: ['Telegram Bot API', 'Python', 'Базы данных'],
            price: 'от 35,000₽',
            duration: '2-4 недели'
        },
        'customDevelopment': {
            title: 'Индивидуальная разработка',
            description: 'Уникальные технические решения под специфические задачи вашего бизнеса.',
            features: [
                'Анализ требований и проектирование',
                'Разработка уникальных решений',
                'Интеграция с существующими системами',
                'Автоматизация бизнес-процессов',
                'Тестирование и внедрение',
                'Поддержка и развитие'
            ],
            technologies: ['Python', 'JavaScript', 'API', 'Базы данных', 'Облачные сервисы'],
            price: 'Договорная',
            duration: 'По проекту'
        }
    };
    
    return modalData[serviceKey];
}

// Service Modal Functionality
function openServiceModal(serviceType) {
    console.log('openServiceModal called with:', serviceType);
    
    // Проверяем, что модальное окно существует
    if (!serviceModal) {
        serviceModal = document.getElementById('serviceModal');
    if (!serviceModal) {
        console.error('serviceModal element not found');
        return;
        }
    }
    
    if (!modalContent) {
        modalContent = document.getElementById('modalContent');
    if (!modalContent) {
        console.error('modalContent element not found');
        return;
        }
    }
    
    // Map service IDs to JSON keys
    const serviceIdToKey = {
        'ai-telegram': 'aiTelegram',
        'channel-automation': 'channelAutomation',
        'social-management': 'socialManagement',
        'product-support': 'productSupport',
        'project-manager': 'projectManager',
        'custom-development': 'customDevelopment',
        'no-code-websites': 'noCodeWebsites',
        'onboarding-systems': 'onboardingSystems',
        'telegram-bots': 'telegramBots'
    };
    
    const serviceKey = serviceIdToKey[serviceType];
    console.log('serviceKey:', serviceKey);
    if (!serviceKey) {
        console.error('No serviceKey found for:', serviceType);
        return;
    }
    
    // Get data from static object
    const modalData = getModalData(serviceKey);
    console.log('modalData:', modalData);
    if (!modalData) {
        console.error('No modalData found for key:', serviceKey);
        return;
    }
    
    if (modalData) {
        try {
        modalContent.innerHTML = `
          <div class="service-modal">
            <h2 class="service-title">${modalData.title}</h2>
            <p class="service-description">${modalData.description}</p>

            <div class="service-details">
              <div class="detail-item">
                <h4>Технологии:</h4>
                <div class="tech-tags">
                  ${modalData.technologies.map(t=>`<span>${t}</span>`).join('')}
                </div>
              </div>

              <div class="detail-item">
                <h4>Что входит в услугу:</h4>
                <ul class="feature-list">
                  ${modalData.features.map(f=>`<li>${f}</li>`).join('')}
                </ul>
              </div>
            </div>

            <div class="service-pricing">
              <div class="info-pill"><i class="fas fa-tag"></i><span>${modalData.price}</span></div>
              <div class="info-pill"><i class="fas fa-clock"></i><span>${modalData.duration}</span></div>
            </div>

            <div class="modal-actions">
              <button class="btn btn-primary" onclick="contactForService('${modalData.title}')"><i class="fas fa-paper-plane"></i><span>Заказать</span></button>
            </div>

            <div class="service-reviews">
              ${renderReviews()}
            </div>
          </div>`;

        // Инициализация звездочек для оценки
        initReviewStars();
        
        // Подсвечиваем кнопку "Услуги" в модальном окне
        const serviceNavItem = document.querySelector('#serviceTopNav .mobile-nav-item:nth-child(2)');
        if (serviceNavItem) {
            serviceNavItem.classList.add('active');
        }
        
        console.log('Opening modal...');
        serviceModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        console.log('Modal opened successfully');
        } catch (error) {
            console.error('Error opening modal:', error);
            alert('Ошибка при открытии модального окна: ' + error.message);
        }
    } else {
        console.error('modalData is falsy');
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
    if (serviceModal) {
    serviceModal.style.display = 'none';
    document.body.style.overflow = 'auto';
    }
}

// Инициализация интерактивных звездочек для оценки
function initReviewStars() {
    try {
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
        const currentUserData = window.userData || userData;
        console.log('📝 Отправка отзыва, userData:', currentUserData);
        
        const reviewData = {
            rating: selectedRating,
            comment: reviewText.value.trim() || getText('servicesPage.reviews.messages.noComment', 'Без комментария'),
            user: currentUserData ? `@${currentUserData.username || currentUserData.firstName}` : '@гость',
            date: new Date().toLocaleDateString('ru-RU').split('/').reverse().join('.')
        };
        
        console.log('📝 Данные отзыва:', reviewData);
        
        // Отправляем отзыв в бэкенд
        trackImportantEvent('review_submit', {
            rating: selectedRating,
            comment: reviewData.comment,
            user: reviewData.user,
            date: reviewData.date
        });
        
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
    } catch (error) {
        console.error('Error in initReviewStars:', error);
    }
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

// Функция для загрузки текстов блока действий профиля
function loadProfileActionsTexts() {
    const profileActionElements = {
        'profileActionsTitle': 'profilePage.profileActions.title',
        'profileActionHelp': 'profilePage.profileActions.buttons.help',
        'profileActionFeedback': 'profilePage.profileActions.buttons.feedback',
        'profileActionOrders': 'profilePage.profileActions.buttons.orders',
        'profileActionChat': 'profilePage.profileActions.buttons.chat',
        'profileActionReviews': 'profilePage.profileActions.buttons.reviews'
    };
    
    Object.entries(profileActionElements).forEach(([elementId, textPath]) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = getText(textPath, element.textContent);
        }
    });
}

// Функция для загрузки текстов страницы помощи
function loadHelpPageTexts() {
    const helpPageElements = {
        'helpPageTitle': 'helpPage.title'
    };
    
    Object.entries(helpPageElements).forEach(([elementId, textPath]) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = getText(textPath, element.textContent);
        }
    });
}

// Функция для загрузки текстов страницы обратной связи
function loadFeedbackPageTexts() {
    const feedbackPageElements = {
        'feedbackPageTitle': 'feedbackPage.title',
        'feedbackFormTitle': 'feedbackPage.form.title',
        'feedbackNameLabel': 'feedbackPage.form.nameLabel',
        'feedbackNamePlaceholder': 'feedbackPage.form.namePlaceholder',
        'feedbackSubjectLabel': 'feedbackPage.form.subjectLabel',
        'feedbackSubjectPlaceholder': 'feedbackPage.form.subjectPlaceholder',
        'feedbackMessageLabel': 'feedbackPage.form.messageLabel',
        'feedbackMessagePlaceholder': 'feedbackPage.form.messagePlaceholder',
        'feedbackSubmitButton': 'feedbackPage.form.submitButton'
    };
    
    Object.entries(feedbackPageElements).forEach(([elementId, textPath]) => {
        const element = document.getElementById(elementId);
        if (element) {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = getText(textPath, element.placeholder);
            } else {
                element.textContent = getText(textPath, element.textContent);
            }
        }
    });
}

// Функция для загрузки текстов страницы заказов
function loadOrdersPageTexts() {
    const ordersPageElements = {
        'ordersPageTitle': 'ordersPage.title',
        'ordersEmptyTitle': 'ordersPage.emptyState.title',
        'ordersEmptyDescription': 'ordersPage.emptyState.description',
        'ordersEmptyButton': 'ordersPage.emptyState.button'
    };
    
    Object.entries(ordersPageElements).forEach(([elementId, textPath]) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = getText(textPath, element.textContent);
        }
    });
}

// Функция для загрузки текстов страницы чата
function loadChatPageTexts() {
    console.log('loadChatPageTexts called');
    
    const chatPageElements = {
        'chatPageTitle': 'chatPage.title',
        'chatContactName': 'chatPage.contact.name',
        'chatContactTitle': 'chatPage.contact.title',
        'chatContactStatus': 'chatPage.contact.status',
        'chatTelegramButton': 'chatPage.buttons.telegram',
        'chatCopyLinkButton': 'chatPage.buttons.copyLink',
        'chatFeaturesTitle': 'chatPage.features.title',
        'chatFeature1': 'chatPage.features.consultation',
        'chatFeature2': 'chatPage.features.support',
        'chatFeature3': 'chatPage.features.requirements',
        'chatFeature4': 'chatPage.features.updates'
    };
    
    Object.entries(chatPageElements).forEach(([elementId, textPath]) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = getText(textPath, element.textContent);
        }
    });
    
    console.log('About to call updateChatInputArea');
    // Update input area for current chat
    updateChatInputArea(currentChat);
    
    // Загружаем теги заказов
    loadOrderTags();
}

// Функция для загрузки текстов страницы отзывов
function loadReviewsPageTexts() {
    const reviewsPageElements = {
        'reviewsPageTitle': 'reviewsPage.title',
        'reviewsHeaderTitle': 'reviewsPage.header.title',
        'reviewsHeaderDescription': 'reviewsPage.header.description',
        'reviewsAddButton': 'reviewsPage.addButton'
    };
    
    Object.entries(reviewsPageElements).forEach(([elementId, textPath]) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = getText(textPath, element.textContent);
        }
    });
    
    // Загружаем отзывы
    loadReviewsForPage();
}

// Функция для загрузки отзывов на страницу отзывов
function loadReviewsForPage() {
    const reviewsContainer = document.getElementById('reviewsContainer');
    if (!reviewsContainer) return;
    
    const reviews = globalReviews;
    
    // Используем среднюю оценку из БД, если она есть
    let avg = "-";
    let totalReviews = reviews.length;
    let lastUpdated = null;
    
    if (window.averageRating && window.averageRating.rating > 0) {
        avg = window.averageRating.rating.toFixed(1);
        totalReviews = window.averageRating.totalReviews;
        lastUpdated = window.averageRating.lastUpdated;
    } else if (reviews.length > 0) {
        // Fallback: вычисляем среднюю оценку из отзывов на странице
        avg = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);
    }
    
    // Создаем HTML для отзывов
    const reviewsHtml = reviews.map(review => {
        // Определяем, есть ли у пользователя юзернейм
        const hasUsername = review.user.startsWith('@');
        
        return `
            <div class="review-card">
                <div class="review-header">
                    <div class="review-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="review-info">
                        <h4 data-has-username="${hasUsername}">${review.user}</h4>
                        <div class="review-stars">
                            ${'<i class="fas fa-star"></i>'.repeat(review.rating)}${'<i class="far fa-star"></i>'.repeat(5 - review.rating)}
                        </div>
                    </div>
                </div>
                <p class="review-text">${review.comment}</p>
                <div class="review-date">${review.date}</div>
            </div>
        `;
    }).join('');
    
    // Добавляем статистику и отзывы
    reviewsContainer.innerHTML = `
        <div class="reviews-summary">
            <div class="reviews-stats">
                <div class="avg-rating">
                    <span class="avg-number">${avg}</span>
                    <div class="avg-stars">
                        ${'<i class="fas fa-star"></i>'.repeat(Math.round(avg))}${'<i class="far fa-star"></i>'.repeat(5 - Math.round(avg))}
                    </div>
                    <span class="reviews-count">(${totalReviews} отзывов)</span>
                </div>
            </div>
        </div>
        <div class="reviews-grid">
            ${reviewsHtml}
        </div>
    `;
}

// Управление темами
let currentTheme = 'auto';

function selectTheme(theme, showNotification = true) {
    currentTheme = theme;
    
    // Сохраняем в localStorage
    localStorage.setItem('appTheme', theme);
    
    // Применяем тему
    applyTheme(theme);
    
    // Показываем уведомление только если это требуется
    if (showNotification) {
        const themeNames = {
            'light': 'светлая',
            'dark': 'тёмная'
        };
        showNotification(`Тема изменена на ${themeNames[theme]}`, 'success');
    }
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
    
    // Применяем сохранённую тему без показа уведомления
    selectTheme(savedTheme, false);
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
    
    // Получаем данные пользователя
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
}

// Функция для автозаполнения формы обратной связи
function fillFeedbackForm(serviceName = null) {
    const nameField = document.getElementById('feedbackName');
    const subjectField = document.getElementById('feedbackSubject');
    const messageField = document.getElementById('feedbackMessage');
    
    // Автозаполняем имя пользователя
    if (nameField) {
        const currentUserData = window.userData || userData;
        if (currentUserData && currentUserData.firstName) {
            const fullName = `${currentUserData.firstName} ${currentUserData.lastName || ''}`.trim();
            nameField.value = fullName;
        }
    }
    
    // Автозаполняем тему и сообщение если передана услуга
    if (serviceName) {
        if (subjectField) {
            subjectField.value = `Заказ услуги: ${serviceName}`;
        }
        
        if (messageField) {
            messageField.value = `Здравствуйте! Меня интересует услуга "${serviceName}". Пожалуйста, свяжитесь со мной для обсуждения деталей проекта.`;
        }
    }
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
    const statNumbers = document.querySelectorAll('.stats-section .stat-number');
    
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
        // Загружаем тексты для действий профиля
        loadProfileActionsTexts();
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
    if (!appTexts) {
        console.error('appTexts is null');
        return defaultText;
    }
    
    const keys = path.split('.');
    let current = appTexts;
    
    for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            console.error(`Key not found: ${key} in path: ${path}`);
            return defaultText;
        }
    }
    
    console.log(`getText(${path}) returned:`, current);
    // Возвращаем объект или строку в зависимости от типа
    return current;
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
        
        // Set up safe area for Telegram Mini App
        try {
            // Set viewport to cover safe area
            if (tg.viewportStableHeight) {
                document.documentElement.style.setProperty('--tg-viewport-height', `${tg.viewportStableHeight}px`);
                console.log('Viewport height set to:', tg.viewportStableHeight);
            }
            
            // Set safe area insets if available
            if (tg.safeAreaInsets) {
                const insets = tg.safeAreaInsets;
                document.documentElement.style.setProperty('--safe-area-inset-top', `${insets.top}px`);
                document.documentElement.style.setProperty('--safe-area-inset-bottom', `${insets.bottom}px`);
                document.documentElement.style.setProperty('--safe-area-inset-left', `${insets.left}px`);
                document.documentElement.style.setProperty('--safe-area-inset-right', `${insets.right}px`);
                console.log('Safe area insets set:', insets);
            }
            
            // Listen for viewport changes
            if (typeof tg.onEvent === 'function') {
                tg.onEvent('viewportChanged', () => {
                    console.log('Viewport changed, updating safe area...');
                    if (tg.viewportStableHeight) {
                        document.documentElement.style.setProperty('--tg-viewport-height', `${tg.viewportStableHeight}px`);
                    }
                    if (tg.safeAreaInsets) {
                        const insets = tg.safeAreaInsets;
                        document.documentElement.style.setProperty('--safe-area-inset-top', `${insets.top}px`);
                        document.documentElement.style.setProperty('--safe-area-inset-bottom', `${insets.bottom}px`);
                        document.documentElement.style.setProperty('--safe-area-inset-left', `${insets.left}px`);
                        document.documentElement.style.setProperty('--safe-area-inset-right', `${insets.right}px`);
                    }
                });
                console.log('Viewport change listener added');
            }
        } catch (e) {
            console.error('Error setting up safe area:', e);
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
        
        // Set default safe area values for standalone mode
        document.documentElement.style.setProperty('--safe-area-inset-top', '20px');
        document.documentElement.style.setProperty('--safe-area-inset-bottom', '0px');
        document.documentElement.style.setProperty('--safe-area-inset-left', '0px');
        document.documentElement.style.setProperty('--safe-area-inset-right', '0px');
        console.log('Available global objects:', Object.keys(window).filter(key => key.toLowerCase().includes('telegram')));
        
        // В standalone режиме не устанавливаем конкретного пользователя
        console.log('🔧 Standalone режим: пользователь не определен');
        
        // Update profile display for standalone mode
        setTimeout(async () => {
            await updateProfileDisplay();
            initDebugButton(); // Инициализируем отладочную кнопку
        }, 100);
    }
}

// Determine how the app was opened
function getAppLaunchMethod() {
    console.log('Launch parameters:', {
        hasQueryId: !!(tg?.initDataUnsafe?.query_id),
        hasSendData: typeof tg?.sendData === 'function',
        initDataUnsafe: tg?.initDataUnsafe,
        initData: tg?.initData ? 'present' : 'absent'
    });
    
    if (tg?.initDataUnsafe?.query_id) {
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

// Function to update safe area insets
function updateSafeAreaInsets() {
    if (tg && tg.safeAreaInsets) {
        const insets = tg.safeAreaInsets;
        document.documentElement.style.setProperty('--safe-area-inset-top', `${insets.top}px`);
        document.documentElement.style.setProperty('--safe-area-inset-bottom', `${insets.bottom}px`);
        document.documentElement.style.setProperty('--safe-area-inset-left', `${insets.left}px`);
        document.documentElement.style.setProperty('--safe-area-inset-right', `${insets.right}px`);
        console.log('Safe area insets updated:', insets);
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
        
        // Инициализируем отладочную кнопку
        initDebugButton();
        
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
                    <img src="${avatarUrl}" alt="Avatar">
                `;
                console.log('User avatar updated with Telegram photo');
            } else {
                // Reset to default icon
                userAvatarElement.innerHTML = `
                    <i class="fas fa-user-tie"></i>
                `;
                console.log('User avatar reset to default icon');
            }
        } catch (error) {
            console.error('Error updating avatar:', error);
            // Fallback to default icon
            userAvatarElement.innerHTML = `
                <i class="fas fa-user-tie"></i>
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
        'review_submit',
        'error_report',
        'order_submit',
        'payment_request',
        'support_request',
        'chat_message'
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
    const isImportant = ['contact_form', 'order_submit', 'support_request', 'error_report'].includes(formType);
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

// Function to handle responsive tag hiding
function handleResponsiveTags() {
    const featureDetails = document.querySelectorAll('.feature-detail');
    
    featureDetails.forEach(detail => {
        const highlights = detail.querySelector('.feature-highlights');
        const tags = highlights?.querySelectorAll('span');
        const text = detail.querySelector('p');
        
        if (!highlights || !tags || !text) return;
        
        // Check if text is being cut off
        const textRect = text.getBoundingClientRect();
        const highlightsRect = highlights.getBoundingClientRect();
        const detailRect = detail.getBoundingClientRect();
        
        // If highlights overlap with text area, hide tags progressively
        if (highlightsRect.top < textRect.bottom + 10) {
            // Hide tags from right to left
            for (let i = tags.length - 1; i >= 0; i--) {
                tags[i].style.display = 'none';
                
                // Check if there's enough space now
                const newHighlightsRect = highlights.getBoundingClientRect();
                if (newHighlightsRect.top >= textRect.bottom + 5) {
                    break;
                }
            }
        } else {
            // Show all tags if there's enough space
            tags.forEach(tag => {
                tag.style.display = 'inline-block';
            });
        }
    });
}

// Call on load and resize
window.addEventListener('resize', handleResponsiveTags);
window.addEventListener('load', handleResponsiveTags);

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

// Home page functionality - removed old feature details

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


// Функции перенесены выше для корректной работы

// Общая база отзывов для всех услуг (будет заполняться данными из БД)
let globalReviews = [];

// Глобальный кэш данных
window.dataCache = {
    reviews: {
        data: [],
        lastUpdate: 0,
        updateInterval: 30 * 60 * 1000 // 30 минут
    },
    chatMessages: {
        data: {},
        lastUpdate: 0,
        updateInterval: 10 * 1000 // 10 секунд для чата
    },
    stats: {
        data: {},
        lastUpdate: 0,
        updateInterval: 5 * 60 * 1000 // 5 минут
    },
    averageRating: {
        data: null,
        lastUpdate: 0,
        updateInterval: 30 * 60 * 1000 // 30 минут
    }
};

// Функции для получения данных из БД через бэкенд (обновленная версия)
async function fetchDataFromDB(dataType, limit = 50, forceUpdate = false) {
    // Используем новую систему кэширования
    return await loadDataWithFallback(dataType, forceUpdate);
}

async function fetchStatsFromDB(forceUpdate = false) {
    const cache = window.dataCache.stats;
    const now = Date.now();
    
    // Всегда очищаем кэш статистики перед получением новых данных
    if (window.dataCache.stats) {
        window.dataCache.stats.data = {};
        window.dataCache.stats.lastUpdate = 0;
        console.log('🧹 Кэш статистики очищен перед получением новых данных');
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/frontend/stats`);
        if (response.ok) {
            const result = await response.json();
            const stats = result.success ? result.stats : {};
            
            // Обновляем кэш свежими данными
            window.dataCache.stats.data = stats;
            window.dataCache.stats.lastUpdate = now;
            
            console.log('✅ Получена свежая статистика');
            return stats;
        } else {
            console.error('❌ Ошибка получения статистики:', response.status);
            return {};
        }
    } catch (error) {
        console.error('❌ Ошибка запроса статистики:', error);
        return {};
    }
}

// Функция для загрузки отзывов из БД
async function loadReviewsFromDB(forceUpdate = false) {
    try {
        const reviewsData = await fetchDataFromDB('reviews', 100, forceUpdate);
        
        if (reviewsData.length > 0) {
            // Преобразуем данные из БД в формат для фронтенда
            globalReviews = reviewsData.map(review => {
                // Формируем имя пользователя
                let userName;
                if (review.username) {
                    userName = `@${review.username}`;
                } else if (review.first_name) {
                    userName = review.first_name;
                } else {
                    userName = 'Пользователь';
                }
                
                return {
                    user: userName,
                    rating: review.rating,
                    comment: review.comment,
                    date: review.review_date || new Date(review.timestamp).toLocaleDateString('ru-RU')
                };
            });
            
            console.log(`✅ Загружено ${globalReviews.length} отзывов из БД`);
            
            // Обновляем кэш отзывов
            if (window.dataCache.reviews) {
                window.dataCache.reviews.data = globalReviews;
                window.dataCache.reviews.lastUpdate = Date.now();
            }
            
            // Загружаем среднюю оценку
            await loadAverageRating(forceUpdate);
            
            // Обновляем отображение отзывов на всех страницах
            updateReviewsDisplay();
        } else {
            console.log('📭 Отзывов в БД пока нет');
            globalReviews = [];
            updateReviewsDisplay();
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки отзывов из БД:', error);
        globalReviews = [];
        updateReviewsDisplay();
    }
}

// Функция для загрузки средней оценки
async function loadAverageRating(forceUpdate = false) {
    try {
        const averageRatingData = await fetchDataFromDB('average_rating', 1, forceUpdate);
        
        if (averageRatingData.length > 0) {
            const ratingData = averageRatingData[0];
            window.averageRating = {
                rating: ratingData.average_rating || 0,
                totalReviews: ratingData.total_reviews || 0,
                lastUpdated: ratingData.last_updated || new Date().toISOString()
            };
            
            console.log(`⭐ Средняя оценка: ${window.averageRating.rating}/5 (${window.averageRating.totalReviews} отзывов)`);
            
            // Обновляем кэш
            if (window.dataCache.averageRating) {
                window.dataCache.averageRating.data = window.averageRating;
                window.dataCache.averageRating.lastUpdate = Date.now();
            }
        } else {
            window.averageRating = { rating: 0, totalReviews: 0, lastUpdated: new Date().toISOString() };
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки средней оценки:', error);
        window.averageRating = { rating: 0, totalReviews: 0, lastUpdated: new Date().toISOString() };
    }
}

// Функция для загрузки сообщений чата из БД
async function loadChatMessagesFromDB(forceUpdate = false) {
    try {
        const chatData = await fetchDataFromDB('chat_messages', 50, forceUpdate);
        
        if (chatData.length > 0) {
            // Группируем сообщения по заказам
            const groupedMessages = {};
            
            chatData.forEach(msg => {
                const orderId = msg.order_id;
                if (!groupedMessages[orderId]) {
                    groupedMessages[orderId] = [];
                }
                
                groupedMessages[orderId].push({
                    text: msg.message,
                    isAdmin: false, // Все сообщения от пользователей
                    timestamp: msg.timestamp
                });
            });
            
            // Обновляем глобальные данные чата
            window.chatData = groupedMessages;
            
            // Обновляем кэш чата
            if (window.dataCache.chatMessages) {
                window.dataCache.chatMessages.data = groupedMessages;
                window.dataCache.chatMessages.lastUpdate = Date.now();
            }
            
            console.log(`✅ Загружено ${chatData.length} сообщений чата из БД`);
            
            // Обновляем отображение чата если он открыт
            if (currentChat) {
                loadChatMessages(currentChat);
            }
        } else {
            console.log('📭 Сообщений чата в БД пока нет, используем кэш');
            // Используем данные из кэша если они есть
            if (window.dataCache.chatMessages && Object.keys(window.dataCache.chatMessages.data).length > 0) {
                window.chatData = window.dataCache.chatMessages.data;
                if (currentChat) {
                    loadChatMessages(currentChat);
                }
            }
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки сообщений чата из БД:', error);
        // При ошибке используем кэш если он есть
        if (window.dataCache.chatMessages && Object.keys(window.dataCache.chatMessages.data).length > 0) {
            console.log('📦 Используем кэшированные сообщения чата при ошибке');
            window.chatData = window.dataCache.chatMessages.data;
            if (currentChat) {
                loadChatMessages(currentChat);
            }
        }
    }
}

// Функция для загрузки заказов для чата
async function loadChatOrdersFromDB(forceUpdate = false) {
    try {
        const chatOrdersData = await fetchDataFromDB('chat_orders', 100, forceUpdate);
        
        if (chatOrdersData.length > 0) {
            // Создаем объект с заказами для чата
            const chatOrders = {};
            
            chatOrdersData.forEach(order => {
                chatOrders[order.id] = {
                    id: order.id,
                    service: order.service_name,
                    status: order.status,
                    date: new Date(order.timestamp).toLocaleDateString('ru-RU'),
                    message: order.message
                };
            });
            
            // Обновляем глобальные данные заказов для чата
            window.chatOrders = chatOrders;
            
            // Обновляем кэш заказов для чата
            if (window.dataCache.chatOrders) {
                window.dataCache.chatOrders.data = chatOrders;
                window.dataCache.chatOrders.lastUpdate = Date.now();
            }
            
            console.log(`✅ Загружено ${chatOrdersData.length} заказов для чата из БД`);
            
            // Обновляем отображение тегов заказов если чат открыт
            if (document.getElementById('chat-page') && document.getElementById('chat-page').classList.contains('active')) {
                updateChatOrderTags();
            }
        } else {
            console.log('📭 Заказов для чата в БД пока нет, используем кэш');
            // Используем данные из кэша если они есть
            if (window.dataCache.chatOrders && Object.keys(window.dataCache.chatOrders.data).length > 0) {
                window.chatOrders = window.dataCache.chatOrders.data;
                if (document.getElementById('chat-page') && document.getElementById('chat-page').classList.contains('active')) {
                    updateChatOrderTags();
                }
            }
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки заказов для чата из БД:', error);
        // При ошибке используем кэш если он есть
        if (window.dataCache.chatOrders && Object.keys(window.dataCache.chatOrders.data).length > 0) {
            console.log('📦 Используем кэшированные заказы для чата при ошибке');
            window.chatOrders = window.dataCache.chatOrders.data;
            if (document.getElementById('chat-page') && document.getElementById('chat-page').classList.contains('active')) {
                updateChatOrderTags();
            }
        }
    }
}

// Функция для обновления отображения отзывов
function updateReviewsDisplay() {
    // Обновляем отзывы на странице отзывов
    if (document.getElementById('reviews-page') && document.getElementById('reviews-page').classList.contains('active')) {
        updateReviewsPage();
    }
    
    // Обновляем отзывы в модальных окнах услуг
    const activeModal = document.querySelector('.modal.active');
    if (activeModal && activeModal.querySelector('.reviews-list')) {
        const reviewsHtml = renderReviews();
        const reviewsContainer = activeModal.querySelector('.reviews-list').parentElement;
        if (reviewsContainer) {
            reviewsContainer.innerHTML = reviewsHtml;
        }
    }
}

// Функция для обновления тегов заказов в чате
function updateChatOrderTags() {
    const orderTags = document.getElementById('orderTags');
    if (!orderTags) return;
    
    const chatOrders = window.chatOrders || {};
    const orderIds = Object.keys(chatOrders);
    
    if (orderIds.length === 0) {
        orderTags.innerHTML = '<div class="no-orders">Заказов пока нет</div>';
        return;
    }
    
    // Сортируем заказы: активные сначала, затем завершенные
    const sortedOrders = orderIds.sort((a, b) => {
        const orderA = chatOrders[a];
        const orderB = chatOrders[b];
        
        // Приоритет: активные > завершенные > отмененные
        const statusPriority = {
            'active': 3,
            'pending': 2,
            'completed': 1,
            'cancelled': 0
        };
        
        const priorityA = statusPriority[orderA.status] || 0;
        const priorityB = statusPriority[orderB.status] || 0;
        
        if (priorityA !== priorityB) {
            return priorityB - priorityA;
        }
        
        // Если статусы одинаковые, сортируем по дате (новые сначала)
        return parseInt(b) - parseInt(a);
    });
    
    const tagsHtml = sortedOrders.map(orderId => {
        const order = chatOrders[orderId];
        const isActive = orderId === currentChat;
        
        const statusIcon = {
            'active': 'fas fa-tag',
            'pending': 'fas fa-clock',
            'completed': 'fas fa-check-circle',
            'cancelled': 'fas fa-times-circle'
        };
        
        return `
            <div class="order-tag ${isActive ? 'active' : ''}" data-order="${orderId}" onclick="switchChat('${orderId}')">
                <i class="${statusIcon[order.status] || 'fas fa-tag'}"></i>
                <span>Заказ #${orderId}</span>
                <span class="order-status ${order.status}"></span>
            </div>
        `;
    }).join('');
    
    orderTags.innerHTML = tagsHtml;
    
    // Устанавливаем первый заказ как активный если нет текущего
    if (!currentChat && sortedOrders.length > 0) {
        currentChat = sortedOrders[0];
        loadChatMessages(currentChat);
    }
}

// Функция для обновления страницы отзывов
function updateReviewsPage() {
    try {
        // Инициализируем все отзывы
        allReviews = globalReviews || [];
        
        // Сбрасываем пагинацию
        reviewsPage = 0;
        
        // Показываем индикатор загрузки
        const loadingIndicator = document.getElementById('reviewsLoading');
        const reviewsContainer = document.getElementById('reviewsContainer');
        
        if (loadingIndicator) loadingIndicator.style.display = 'flex';
        if (reviewsContainer) reviewsContainer.innerHTML = '';
        
        // Имитируем задержку загрузки
        setTimeout(() => {
            // Скрываем индикатор загрузки
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            
            // Рендерим отзывы
            if (reviewsContainer) {
                if (allReviews.length === 0) {
                    reviewsContainer.innerHTML = `
                        <div class="reviews-empty">
                            <i class="fas fa-star"></i>
                            <h3>Пока нет отзывов</h3>
                            <p>Будьте первым, кто оставит отзыв!</p>
                        </div>
                    `;
                } else {
                    reviewsContainer.innerHTML = renderReviewsPage();
                }
            }
            
            // Инициализируем звезды для добавления отзыва
            initReviewsPageStars();
        }, 500);
        
    } catch (error) {
        console.error('Error in updateReviewsPage:', error);
        
        const reviewsContainer = document.getElementById('reviewsContainer');
        if (reviewsContainer) {
            reviewsContainer.innerHTML = `
                <div class="reviews-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Ошибка загрузки</h3>
                    <p>Не удалось загрузить отзывы</p>
                </div>
            `;
        }
    }
}

// Переменные для интервалов обновления
let reviewsUpdateInterval;
let chatUpdateInterval;

// Функция для загрузки всех данных при инициализации
async function loadAllDataFromDB() {
    console.log('🔄 Загрузка данных из БД...');
    
    // Используем новую систему кэширования
    await loadAllDataWithCache();
}

// Функция для запуска периодического обновления
function startPeriodicUpdates() {
    // Очищаем существующие интервалы
    if (reviewsUpdateInterval) clearInterval(reviewsUpdateInterval);
    if (chatUpdateInterval) clearInterval(chatUpdateInterval);
    
    // Обновление отзывов каждые 30 минут
    reviewsUpdateInterval = setInterval(() => {
        console.log('🔄 Периодическое обновление отзывов...');
        loadReviewsFromDB(true);
    }, 30 * 60 * 1000); // 30 минут
    
    // Обновление чата каждые 10 секунд
    chatUpdateInterval = setInterval(() => {
        console.log('🔄 Периодическое обновление чата...');
        loadChatMessagesFromDB(true);
        loadChatOrdersFromDB(true);
    }, 10 * 1000); // 10 секунд
    
    // Обновление заказов каждые 30 секунд
    ordersUpdateInterval = setInterval(() => {
        console.log('🔄 Периодическое обновление заказов...');
        loadDataWithFallback('requests', true);
    }, 30 * 1000); // 30 секунд
    
    console.log('⏰ Периодическое обновление запущено');
}

// Функция для остановки периодического обновления
function stopPeriodicUpdates() {
    if (reviewsUpdateInterval) {
        clearInterval(reviewsUpdateInterval);
        reviewsUpdateInterval = null;
    }
    if (chatUpdateInterval) {
        clearInterval(chatUpdateInterval);
        chatUpdateInterval = null;
    }
    if (ordersUpdateInterval) {
        clearInterval(ordersUpdateInterval);
        ordersUpdateInterval = null;
    }
    console.log('⏹️ Периодическое обновление остановлено');
}

// Функция для принудительного обновления всех данных
async function forceUpdateAllData() {
    console.log('🔄 Принудительное обновление всех данных...');
    
    await Promise.all([
        loadReviewsFromDB(true),
        loadDataWithFallback('requests', true),
        loadChatMessagesFromDB(true),
        loadChatOrdersFromDB(true)
    ]);
    
    console.log('✅ Принудительное обновление завершено');
}

// Функция для получения информации о кэше
function getCacheInfo() {
    const now = Date.now();
    const info = {};
    
    // Информация о кэше в памяти
    Object.keys(window.dataCache).forEach(key => {
        const cache = window.dataCache[key];
        const timeSinceUpdate = now - cache.lastUpdate;
        const minutesSinceUpdate = Math.floor(timeSinceUpdate / (1000 * 60));
        
        info[key] = {
            lastUpdate: new Date(cache.lastUpdate).toLocaleString('ru-RU'),
            minutesSinceUpdate,
            dataCount: Array.isArray(cache.data) ? cache.data.length : Object.keys(cache.data).length,
            updateInterval: Math.floor(cache.updateInterval / (1000 * 60)) + ' мин',
            hasMoreData: key === 'reviews' ? window.hasMoreReviews : 
                        key === 'chatMessages' ? window.hasMoreChatMessages : false
        };
    });
    
    // Информация о localStorage
    Object.keys(CACHE_KEYS).forEach(key => {
        try {
            const cached = localStorage.getItem(CACHE_KEYS[key]);
            if (cached) {
                const cacheData = JSON.parse(cached);
                const timeSinceUpdate = now - cacheData.lastUpdate;
                const minutesSinceUpdate = Math.floor(timeSinceUpdate / (1000 * 60));
                
                info[`${key}_localStorage`] = {
                    lastUpdate: new Date(cacheData.lastUpdate).toLocaleString('ru-RU'),
                    minutesSinceUpdate,
                    dataCount: Array.isArray(cacheData.data) ? cacheData.data.length : 1,
                    totalCount: cacheData.totalCount,
                    hasMoreData: cacheData.hasMoreData
                };
            }
        } catch (error) {
            info[`${key}_localStorage`] = { error: 'Ошибка чтения' };
        }
    });
    
    return info;
}

function renderReviews(){
  try {
  // Используем общую базу отзывов для всех услуг
    const reviews = globalReviews || [];
  const avg=reviews.length?(reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1):"-";
  const starsAvg=Array(5).fill(0).map((_,i)=>`<i class="fas fa-star${reviews.length&&i+1<=Math.round(avg)?'':'-o'}"></i>`).join('');
  const listHtml=reviews.map(r=>{
    // Определяем, есть ли у пользователя юзернейм
      const hasUsername = r.user && r.user.startsWith('@');
    const userClass = hasUsername ? 'review-user' : 'review-user no-username';
    
      return `<div class="review-card"><div class="review-head"><span class="${userClass}" data-has-username="${hasUsername}">${r.user}</span><span class="review-date">${r.date || ''}</span></div><div class="review-stars">${'★'.repeat(r.rating || 0)}${'☆'.repeat(5-(r.rating || 0))}</div><p>${r.comment || ''}</p></div>`;
  }).join('');
    
    // Кнопка "Загрузить еще" (если есть старые данные)
    const loadMoreButton = window.hasMoreReviews ? `
      <div class="load-more-container">
        <button id="loadMoreReviews" class="btn btn-secondary load-more-btn" onclick="loadMoreReviews()">
          <i class="fas fa-history"></i>
          Загрузить более старые отзывы
        </button>
      </div>
    ` : '';
    
    const listSection= reviews.length?`<div class="reviews-list scrollable">${listHtml}</div>${loadMoreButton}`:'<p class="no-reviews">Пока нет отзывов</p>';

  // star selector html
  const starSelHtml=Array(5).fill(0).map((_,i)=>`<i data-val="${i+1}" class="fas fa-star"></i>`).join('');

  return `<div class="review-tile"><div class="reviews-summary"><span class="avg">${avg}</span>${starsAvg}<span class="count">(${reviews.length})</span></div>${listSection}
  <div class="leave-review-area">
    <div class="review-invite-text">Оставьте свой отзыв</div>
    <div class="star-select" id="starSelect">${starSelHtml}</div>
    <textarea id="reviewText" placeholder="${getText('servicesPage.reviews.form.placeholder', 'Ваш отзыв...')}"></textarea>
    <button class="btn btn-primary btn-send" id="sendReviewBtn" disabled>${getText('servicesPage.reviews.form.submitButton', 'Отправить')}</button>
  </div></div>`;
  } catch (error) {
    console.error('Error in renderReviews:', error);
    return '<div class="review-tile"><p class="no-reviews">Ошибка загрузки отзывов</p></div>';
  }
}

// Новая функция для рендеринга отзывов на странице отзывов
function renderReviewsPage() {
  try {
    const reviews = allReviews || [];
    const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "0.0";
    
    // Обновляем статистику в одну строку
    document.getElementById('totalReviews').textContent = `(${reviews.length})`;
    document.getElementById('averageRating').textContent = avg;
    
    // Обновляем звезды в статистике
    const avgStars = document.getElementById('avgStars');
    if (avgStars) {
      const avgNum = Math.round(parseFloat(avg));
      avgStars.innerHTML = Array(5).fill(0).map((_, i) => 
        `<i class="fas fa-star${i < avgNum ? '' : '-o'}"></i>`
      ).join('');
    }
    
    // Получаем отзывы для текущей страницы
    const startIndex = reviewsPage * reviewsPerPage;
    const endIndex = startIndex + reviewsPerPage;
    const currentReviews = reviews.slice(startIndex, endIndex);
    
    // Проверяем, есть ли еще отзывы
    hasMoreReviews = endIndex < reviews.length;
    
    // Рендерим отзывы в стиле карточек услуг
    const reviewsHtml = currentReviews.map(review => {
      const hasUsername = review.user && review.user.startsWith('@');
      const userName = review.user || 'Анонимный пользователь';
      const userInitial = userName.charAt(0).toUpperCase();
      
      return `
        <div class="review-card">
          <div class="review-header">
            <div class="review-avatar">
              ${userInitial}
            </div>
            <div class="review-info">
              <h4 data-has-username="${hasUsername}">${userName}</h4>
              <p class="review-date">${review.date || ''}</p>
            </div>
          </div>
          <div class="review-stars">
            ${'★'.repeat(review.rating || 0)}${'☆'.repeat(5 - (review.rating || 0))}
          </div>
          <p class="review-text">${review.comment || ''}</p>
        </div>
      `;
    }).join('');
    
    // Показываем или скрываем кнопку "Загрузить еще"
    const loadMoreSection = document.getElementById('loadMoreSection');
    if (loadMoreSection) {
      loadMoreSection.style.display = hasMoreReviews ? 'block' : 'none';
    }
    
    return reviewsHtml;
  } catch (error) {
    console.error('Error in renderReviewsPage:', error);
    return '<div class="reviews-empty"><i class="fas fa-exclamation-triangle"></i><h3>Ошибка загрузки</h3><p>Не удалось загрузить отзывы</p></div>';
  }
}

// Функция для загрузки дополнительных отзывов
function loadMoreReviews() {
  try {
    if (!hasMoreReviews) return;
    
    // Показываем индикатор загрузки
    const loadMoreBtn = document.querySelector('.load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Загрузка...</span>';
      loadMoreBtn.disabled = true;
    }
    
    // Увеличиваем номер страницы
    reviewsPage++;
    
    // Получаем новые отзывы
    const startIndex = reviewsPage * reviewsPerPage;
    const endIndex = startIndex + reviewsPerPage;
    const newReviews = allReviews.slice(startIndex, endIndex);
    
    // Проверяем, есть ли еще отзывы
    hasMoreReviews = endIndex < allReviews.length;
    
    // Рендерим новые отзывы в стиле карточек услуг
    const newReviewsHtml = newReviews.map(review => {
      const hasUsername = review.user && review.user.startsWith('@');
      const userName = review.user || 'Анонимный пользователь';
      const userInitial = userName.charAt(0).toUpperCase();
      
      return `
        <div class="review-card">
          <div class="review-header">
            <div class="review-avatar">
              ${userInitial}
            </div>
            <div class="review-info">
              <h4 data-has-username="${hasUsername}">${userName}</h4>
              <p class="review-date">${review.date || ''}</p>
            </div>
          </div>
          <div class="review-stars">
            ${'★'.repeat(review.rating || 0)}${'☆'.repeat(5 - (review.rating || 0))}
          </div>
          <p class="review-text">${review.comment || ''}</p>
        </div>
      `;
    }).join('');
    
    // Добавляем новые отзывы к существующим
    const reviewsContainer = document.getElementById('reviewsContainer');
    if (reviewsContainer) {
      reviewsContainer.insertAdjacentHTML('beforeend', newReviewsHtml);
    }
    
    // Обновляем кнопку "Загрузить еще"
    if (loadMoreBtn) {
      if (hasMoreReviews) {
        loadMoreBtn.innerHTML = '<i class="fas fa-chevron-down"></i><span>Загрузить еще</span>';
        loadMoreBtn.disabled = false;
      } else {
        loadMoreBtn.style.display = 'none';
      }
    }
    
    // Показываем или скрываем секцию "Загрузить еще"
    const loadMoreSection = document.getElementById('loadMoreSection');
    if (loadMoreSection) {
      loadMoreSection.style.display = hasMoreReviews ? 'block' : 'none';
    }
    
  } catch (error) {
    console.error('Error in loadMoreReviews:', error);
    
    // Восстанавливаем кнопку в случае ошибки
    const loadMoreBtn = document.querySelector('.load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.innerHTML = '<i class="fas fa-chevron-down"></i><span>Загрузить еще</span>';
      loadMoreBtn.disabled = false;
    }
  }
}

function renderOrders(){
  try {
    const orders = globalOrders || [];
    
    if (orders.length === 0) {
      return '';
    }
    
    const listHtml = orders.map(order => {
      return `
        <div class="order-card order-card-${order.statusClass.replace('status-', '')}" onclick="openOrderDetails(${order.id})">
          <div class="order-header">
            <span class="order-id">Заказ #${order.id}</span>
            <span class="order-date">${order.date}</span>
          </div>
          <div class="order-content">
            <div class="order-service">
              <strong>Услуга:</strong> ${order.service || 'Не указана'}
            </div>
            <div class="order-message">
              <strong>Сообщение:</strong> ${order.message || 'Нет сообщения'}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    return listHtml;
  } catch (error) {
    console.error('Error in renderOrders:', error);
    return '<div class="orders-tile"><p class="no-orders">Ошибка загрузки заказов</p></div>';
  }
}

function openOrderDetails(orderId) {
  try {
    const order = globalOrders.find(o => o.id == orderId); // Используем == для сравнения строки и числа
    
    if (!order) {
      console.error('Заказ не найден:', orderId);
      return;
    }
    
    // Проверяем, что модальное окно существует
    const orderModal = document.getElementById('orderModal');
    const orderModalContent = document.getElementById('orderModalContent');
    
    if (!orderModal || !orderModalContent) {
      console.error('orderModal или orderModalContent не найдены');
      return;
    }
    
    // Заполняем содержимое модального окна
    orderModalContent.innerHTML = `
      <div class="service-modal">
        <h2 class="service-title">
          <i class="fas fa-shopping-cart"></i>
          Заказ #${order.id}
        </h2>
        
        <div class="service-details">
          <div class="detail-item">
            <h4>Информация о заказе:</h4>
            <div class="order-info">
              <div class="info-row">
                <span class="info-label">Номер заказа:</span>
                <span class="info-value">#${order.id}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Услуга:</span>
                <span class="info-value">${order.service || 'Не указана'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Дата заказа:</span>
                <span class="info-value">${order.date}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Статус:</span>
                <span class="order-status ${order.statusClass}">${order.status}</span>
              </div>
            </div>
          </div>
          
          <div class="detail-item">
            <h4>Ваше сообщение:</h4>
            <div class="order-message">
              ${order.message || 'Нет сообщения'}
            </div>
          </div>
        </div>
        
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="openChatForOrder(${order.id})">
            <i class="fas fa-comments"></i>
            <span>Открыть чат</span>
          </button>
          <button class="btn btn-primary" onclick="closeOrderModal()">
            <i class="fas fa-check"></i>
            <span>Понятно</span>
          </button>
        </div>
      </div>
    `;
    
    // Открываем модальное окно
    orderModal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
  } catch (error) {
    console.error('Error in openOrderDetails:', error);
  }
}

function closeOrderModal() {
  const orderModal = document.getElementById('orderModal');
  if (orderModal) {
    orderModal.style.display = 'none';
  }
  // Восстанавливаем прокрутку страницы
  document.body.style.overflow = 'auto';
}

function openChatForOrder(orderId) {
  // Закрываем модальное окно заказа
  closeOrderModal();
  
  // Переходим на страницу чата
  showPage('chat-page');
  
  // Устанавливаем текущий чат
  currentChat = orderId.toString();
  
  // Загружаем данные чата если еще не загружены
  if (!window.chatOrders) {
    loadChatOrdersFromDB(true);
  } else {
    // Обновляем теги заказов и переключаемся на нужный
    updateChatOrderTags();
  }
  
  console.log(`💬 Открываем чат для заказа #${orderId}`);
}

// Carousel functionality
let currentSlide = 0;
let carouselInterval;
const slideDuration = 4000; // 4 seconds per slide

function initCarousel() {
    const slides = document.querySelectorAll('.carousel-slide');
    const indicators = document.querySelectorAll('.indicator');
    
    if (slides.length === 0) return;
    
    // Stop any existing carousel
    stopCarousel();
    
    // Reset all slides to initial state and position them correctly
    slides.forEach((slide, index) => {
        slide.classList.remove('active', 'prev', 'next');
        if (index === 0) {
            slide.classList.add('active');
        } else {
            slide.classList.add('next');
        }
    });
    
    // Reset all indicators
    indicators.forEach(indicator => {
        indicator.classList.remove('active');
    });
    
    // Set first slide as active
    slides[0].classList.add('active');
    indicators[0].classList.add('active');
    currentSlide = 0;
    
    // Start auto-rotation with a small delay
    setTimeout(() => {
    startCarousel();
    }, 1000);
    
    // Indicators are now just visual - no click functionality
    // indicators.forEach((indicator, index) => {
    //     indicator.addEventListener('click', () => {
    //         goToSlide(index);
    //     });
    // });
}

function startCarousel() {
    if (carouselInterval) {
        clearInterval(carouselInterval);
    }
    
    carouselInterval = setInterval(() => {
        nextSlide();
    }, slideDuration);
}

function stopCarousel() {
    if (carouselInterval) {
        clearInterval(carouselInterval);
        carouselInterval = null;
    }
}

function nextSlide() {
    const slides = document.querySelectorAll('.carousel-slide');
    const indicators = document.querySelectorAll('.indicator');
    
    if (slides.length === 0) return;
    
    const nextSlideIndex = (currentSlide + 1) % slides.length;
    
    // Remove active class from current slide and indicator
    slides[currentSlide].classList.remove('active');
    indicators[currentSlide].classList.remove('active');
    
    // Add prev class to current slide (it will animate to the left)
    slides[currentSlide].classList.add('prev');
    
    // Move to next slide
    currentSlide = nextSlideIndex;
    
    // Add active class to new slide and indicator
    slides[currentSlide].classList.remove('prev', 'next');
    slides[currentSlide].classList.add('active');
    indicators[currentSlide].classList.add('active');
    
    // Prepare the next slide in the sequence to come from the right
    const nextNextIndex = (currentSlide + 1) % slides.length;
    slides[nextNextIndex].classList.add('next');
}

function goToSlide(slideIndex) {
    const slides = document.querySelectorAll('.carousel-slide');
    const indicators = document.querySelectorAll('.indicator');
    
    if (slideIndex < 0 || slideIndex >= slides.length) return;
    
    // Don't do anything if clicking on the same slide
    if (slideIndex === currentSlide) return;
    
    // Determine direction for proper animation
    const isNext = slideIndex > currentSlide || (currentSlide === slides.length - 1 && slideIndex === 0);
    
    if (isNext) {
        // Prepare next slide to come from the right
        slides[slideIndex].classList.add('next');
        slides[slideIndex].offsetHeight; // Force reflow
    }
    
    // Remove active class from current slide and indicator
    slides[currentSlide].classList.remove('active');
    indicators[currentSlide].classList.remove('active');
    
    // Add prev class to current slide (it will animate to the left)
    slides[currentSlide].classList.add('prev');
    
    // Set new current slide
    currentSlide = slideIndex;
    
    // Add active class to new slide and indicator
    slides[currentSlide].classList.remove('prev', 'next');
    slides[currentSlide].classList.add('active');
    indicators[currentSlide].classList.add('active');
    
    // Restart auto-rotation
    startCarousel();
}

// Initialize carousel when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize carousel if we're on home page
    if (document.getElementById('home').classList.contains('active')) {
        setTimeout(initCarousel, 500);
    }
});

// Re-initialize carousel when switching to home page
const originalShowPage = showPage;
showPage = function(pageId) {
    originalShowPage(pageId);
    
    if (pageId === 'home') {
        setTimeout(initCarousel, 500);
    } else {
        stopCarousel();
    }
    
    // Load texts for new pages
    if (pageId === 'help-page') {
        setTimeout(loadHelpPageTexts, 100);
    } else if (pageId === 'feedback-page') {
        setTimeout(loadFeedbackPageTexts, 100);
        // Автозаполняем имя пользователя при загрузке страницы
        setTimeout(() => {
            fillFeedbackForm();
        }, 300);
    } else if (pageId === 'orders-page') {
        setTimeout(loadOrdersPageTexts, 100);
    } else if (pageId === 'chat-page') {
        setTimeout(loadChatPageTexts, 300);
        // Инициализируем чат
        setTimeout(() => {
            loadChatMessages(currentChat);
        }, 400);
    } else if (pageId === 'reviews-page') {
        setTimeout(loadReviewsPageTexts, 100);
    }
};

// Profile Actions Functions
function showProfileAction(action) {
    switch(action) {
        case 'help':
            // Переходим на страницу помощи
            showPage('help-page');
            break;
            
        case 'feedback':
            // Переходим на страницу обратной связи
            showPage('feedback-page');
            break;
            
        case 'orders':
            // Переходим на страницу заказов
            showPage('orders-page');
            break;
            
        case 'chat':
            // Переходим на страницу чата
            showPage('chat-page');
            // Загружаем данные чата при переходе
            loadChatOrdersFromDB(true);
            break;
            
        case 'reviews':
            // Переходим на страницу отзывов
            showPage('reviews-page');
            break;
            
        default:
            console.log('Unknown profile action:', action);
    }
}

// Chat data (будет заполняться данными из БД)
const chatData = {};

let currentChat = null;

// Chat page functions
function switchChat(chatId) {
    currentChat = chatId;
    
    // Update active tag
    document.querySelectorAll('.order-tag').forEach(tag => {
        tag.classList.remove('active');
    });
    const activeTag = document.querySelector(`[data-order="${chatId}"]`);
    if (activeTag) {
        activeTag.classList.add('active');
    }
    
    // Load messages
    loadChatMessages(chatId);
    
    // Update input area based on order status (по умолчанию активный)
    updateChatInputArea(chatId);
}

function loadChatMessages(chatId) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    // Получаем сообщения из БД для этого чата
    const dbMessages = window.chatData && window.chatData[chatId] ? window.chatData[chatId] : [];
    
    if (dbMessages.length === 0) {
        chatMessages.innerHTML = '<div class="no-messages">Сообщений пока нет</div>';
        return;
    }
    
    const messagesHtml = dbMessages.map((dbMsg, index) => {
        return `
            <div class="message ${dbMsg.isAdmin ? 'message-admin' : 'message-user'}">
                <div class="message-content">
                    <div class="message-text">${dbMsg.text}</div>
                    <div class="message-time">${new Date(dbMsg.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            </div>
        `;
    }).join('');
    
    chatMessages.innerHTML = messagesHtml;
    
    // Scroll to bottom
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);
}

function sendMessage() {
    const messageInput = document.getElementById('chatMessageInput');
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    // Отправляем сообщение в бекенд
    trackImportantEvent('chat_message', {
        orderId: currentChat,
        message: message,
        timestamp: new Date().toISOString()
    });
    
    // Clear input
    messageInput.value = '';
    
    // Обновляем отображение сообщений из кэша
    loadChatMessages(currentChat);
    
    // Simulate admin response after 2 seconds
    setTimeout(() => {
        // Отправляем ответ администратора в БД
        trackImportantEvent('chat_message', {
            orderId: currentChat,
            message: 'Получил ваше сообщение! Отвечу в ближайшее время.',
            timestamp: new Date().toISOString(),
            isAdmin: true
        });
        
        // Обновляем отображение
        loadChatMessages(currentChat);
    }, 2000);
}

function updateChatInputArea(chatId) {
    const inputWrapper = document.getElementById('chatInputWrapper');
    const reviewWrapper = document.getElementById('chatReviewWrapper');
    const messageInput = document.getElementById('chatMessageInput');
    
    if (!inputWrapper || !reviewWrapper || !messageInput) return;
    
    // По умолчанию показываем поле ввода для всех заказов
    inputWrapper.style.display = 'flex';
    reviewWrapper.style.display = 'none';
    messageInput.disabled = false;
}

function loadOrderTags() {
    console.log('loadOrderTags called');
    
    // Wait a bit more to ensure DOM is ready
    setTimeout(() => {
        const orderTags = document.getElementById('orderTags');
        if (!orderTags) {
            console.error('orderTags element not found');
            return;
        }
        
        // Используем данные из БД
        const dbChatData = window.chatData || {};
        console.log('dbChatData:', dbChatData);
        console.log('currentChat:', currentChat);
        
        if (Object.keys(dbChatData).length === 0) {
            orderTags.innerHTML = '<div class="no-orders">Заказов пока нет</div>';
            return;
        }
        
        // Sort orders: active first, then completed
        const sortedOrders = Object.keys(dbChatData).sort((a, b) => {
            // По умолчанию считаем все заказы активными
            return parseInt(a) - parseInt(b);
        });
        
        console.log('sortedOrders:', sortedOrders);
        
        const tagsHtml = sortedOrders.map(orderId => {
            const isActive = orderId === currentChat;
            // По умолчанию все заказы активные
            const status = 'active';
            const statusIcon = {
                'active': 'fas fa-tag',
                'completed': 'fas fa-check-circle'
            };
            
            return `
                <div class="order-tag ${isActive ? 'active' : ''}" data-order="${orderId}" onclick="switchChat('${orderId}')">
                    <i class="${statusIcon[status]}"></i>
                    <span>Заказ #${orderId}</span>
                    <span class="order-status ${status}"></span>
                </div>
            `;
        }).join('');
        
        console.log('tagsHtml:', tagsHtml);
        orderTags.innerHTML = tagsHtml;
        
        // Устанавливаем первый заказ как активный если нет текущего
        if (!currentChat && sortedOrders.length > 0) {
            currentChat = sortedOrders[0];
            loadChatMessages(currentChat);
        }
    }, 100);
}

function openTelegramChat() {
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.openTelegramLink('https://t.me/sukhorukov_nikita');
    } else {
        window.open('https://t.me/sukhorukov_nikita', '_blank');
    }
}

function copyTelegramLink() {
    const link = 'https://t.me/sukhorukov_nikita';
    navigator.clipboard.writeText(link).then(() => {
        showNotification('Ссылка скопирована в буфер обмена!', 'success');
    }).catch(() => {
        showNotification('Не удалось скопировать ссылку', 'error');
    });
}

// Feedback form handler
document.addEventListener('DOMContentLoaded', function() {
    const feedbackForm = document.getElementById('feedbackForm');
    if (feedbackForm) {
        feedbackForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(feedbackForm);
            const data = {
                name: formData.get('feedbackName'),
                subject: formData.get('feedbackSubject'),
                message: formData.get('feedbackMessage')
            };
            
            // Отправляем данные в бекенд
            trackImportantEvent('support_request', {
                formData: data,
                source: 'feedback_page'
            });
            
            showNotification('Сообщение отправлено! Мы свяжемся с вами в ближайшее время.', 'success');
            feedbackForm.reset();
            
            // Автозаполняем имя снова после сброса формы
            setTimeout(() => {
                fillFeedbackForm();
            }, 100);
        });
    }
    
    // Chat message input handler
    const chatMessageInput = document.getElementById('chatMessageInput');
    if (chatMessageInput) {
        chatMessageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Auto-resize textarea
        chatMessageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        });
    }
});

// ===== ФУНКЦИИ ДЛЯ ОТЛАДОЧНОЙ СТРАНИЦЫ =====

// Показывать кнопку отладки только для администратора
function checkAdminAndShowDebugButton() {
    const adminIds = ['585028258']; // ID администраторов
    const currentUserId = window.userData?.id;
    
    if (adminIds.includes(String(currentUserId))) {
        const debugBtn = document.getElementById('adminDebugBtn');
        if (debugBtn) {
            debugBtn.style.display = 'flex';
            console.log('🔧 Кнопка отладки показана для администратора:', currentUserId);
        }
    }
}

// Показать страницу отладки
function showAdminDebug() {
    showPage('admin-debug-page');
    refreshDebugInfo();
}

// Обновить отладочную информацию
async function refreshDebugInfo() {
    console.log('🔧 Обновление отладочной информации...');
    
    // Информация о пользователе
    updateUserDebugInfo();
    
    // Системная информация
    updateSystemDebugInfo();
    
    // Информация о кэше
    updateCacheDebugInfo();
    
    // Информация о заказах
    updateOrdersDebugInfo();
    
    // Информация о бэкенде
    await updateBackendDebugInfo();
}

// Обновить информацию о пользователе
function updateUserDebugInfo() {
    const userInfo = document.getElementById('debugUserInfo');
    if (!userInfo) return;
    
    const userData = window.userData || {};
    const tg = window.tg;
    
    const info = {
        'ID пользователя': userData.id || 'Не определен',
        'Имя': userData.firstName || 'Не определено',
        'Фамилия': userData.lastName || 'Не определена',
        'Username': userData.username || 'Не определен',
        'Язык': userData.languageCode || 'Не определен',
        'Premium': userData.isPremium ? 'Да' : 'Нет',
        'Telegram Web App': tg ? 'Доступен' : 'Недоступен',
        'Режим запуска': getLaunchMode?.() || 'Неизвестен',
        'Backend URL': getBackendUrl?.() || 'Не настроен'
    };
    
    userInfo.innerHTML = formatDebugInfo(info);
}

// Обновить системную информацию
function updateSystemDebugInfo() {
    const systemInfo = document.getElementById('debugSystemInfo');
    if (!systemInfo) return;
    
    const info = {
        'User Agent': navigator.userAgent,
        'Платформа': navigator.platform,
        'Язык браузера': navigator.language,
        'Cookies включены': navigator.cookieEnabled ? 'Да' : 'Нет',
        'LocalStorage доступен': typeof(Storage) !== 'undefined' ? 'Да' : 'Нет',
        'IndexedDB доступен': 'indexedDB' in window ? 'Да' : 'Нет',
        'Время загрузки': new Date().toLocaleString('ru-RU'),
        'Размер экрана': `${screen.width}x${screen.height}`,
        'Размер окна': `${window.innerWidth}x${window.innerHeight}`,
        'Тема': document.body.classList.contains('tg-dark-theme') ? 'Темная' : 'Светлая'
    };
    
    systemInfo.innerHTML = formatDebugInfo(info);
}

// Обновить информацию о кэше
function updateCacheDebugInfo() {
    const cacheInfo = document.getElementById('debugCacheInfo');
    if (!cacheInfo) return;
    
    const cacheData = {};
    
    // Информация о кэше в памяти
    if (window.dataCache) {
        Object.keys(window.dataCache).forEach(key => {
            const cache = window.dataCache[key];
            cacheData[`Кэш ${key}`] = {
                'Количество записей': Array.isArray(cache.data) ? cache.data.length : 'N/A',
                'Последнее обновление': cache.lastUpdate ? new Date(cache.lastUpdate).toLocaleString('ru-RU') : 'Никогда',
                'Интервал обновления': cache.updateInterval ? `${cache.updateInterval / 1000} сек` : 'N/A'
            };
        });
    }
    
    // Информация о localStorage
    const localStorageInfo = {};
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('cache_')) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                localStorageInfo[key] = {
                    'Размер': `${JSON.stringify(data).length} байт`,
                    'Записей': Array.isArray(data.data) ? data.data.length : 'N/A',
                    'Обновлен': data.lastUpdate ? new Date(data.lastUpdate).toLocaleString('ru-RU') : 'Никогда'
                };
            } catch (e) {
                localStorageInfo[key] = 'Ошибка парсинга';
            }
        }
    });
    
    if (Object.keys(localStorageInfo).length > 0) {
        cacheData['localStorage'] = localStorageInfo;
    }
    
    cacheInfo.innerHTML = formatDebugInfo(cacheData);
}

// Обновить информацию о заказах
function updateOrdersDebugInfo() {
    const ordersInfo = document.getElementById('debugOrdersInfo');
    if (!ordersInfo) return;
    
    const info = {
        'Всего заказов в памяти': globalOrders ? globalOrders.length : 0,
        'Заказы в кэше': window.dataCache?.requests?.data?.length || 0,
        'Пользователь определен': window.userData?.id ? 'Да' : 'Нет',
        'ID пользователя': window.userData?.id || 'Не определен',
        'Фильтрация активна': window.userData?.id && window.userData.id !== 'unknown' ? 'Да' : 'Нет'
    };
    
    // Добавляем информацию о первых 3 заказах
    if (globalOrders && globalOrders.length > 0) {
        const sampleOrders = globalOrders.slice(0, 3).map(order => ({
            'ID': order.id,
            'Услуга': order.service,
            'Статус': order.status,
            'Дата': order.date
        }));
        info['Примеры заказов'] = sampleOrders;
    }
    
    ordersInfo.innerHTML = formatDebugInfo(info);
}

// Обновить информацию о бэкенде
async function updateBackendDebugInfo() {
    const backendInfo = document.getElementById('debugBackendInfo');
    if (!backendInfo) return;
    
    const info = {
        'Backend URL': getBackendUrl?.() || 'Не настроен',
        'Статус подключения': 'Проверяется...'
    };
    
    backendInfo.innerHTML = formatDebugInfo(info);
    
    // Проверяем доступность бэкенда
    try {
        const backendUrl = getBackendUrl?.();
        if (backendUrl) {
            const response = await fetch(`${backendUrl}/health`, { 
                method: 'GET', 
                mode: 'cors', 
                cache: 'no-store',
                timeout: 5000
            });
            
            if (response.ok) {
                const healthData = await response.json().catch(() => ({}));
                info['Статус подключения'] = 'Онлайн';
                info['Время ответа'] = `${response.headers.get('x-response-time') || 'N/A'}`;
                info['Версия API'] = healthData.version || 'N/A';
            } else {
                info['Статус подключения'] = `Ошибка ${response.status}`;
            }
        } else {
            info['Статус подключения'] = 'URL не настроен';
        }
    } catch (error) {
        info['Статус подключения'] = `Ошибка: ${error.message}`;
    }
    
    backendInfo.innerHTML = formatDebugInfo(info);
}

// Форматировать отладочную информацию
function formatDebugInfo(data, level = 0) {
    let html = '';
    
    Object.keys(data).forEach(key => {
        const value = data[key];
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            html += `<div class="debug-item" style="margin-left: ${level * 20}px;">`;
            html += `<div class="debug-label">${key}:</div>`;
            html += formatDebugInfo(value, level + 1);
            html += '</div>';
        } else {
            html += `<div class="debug-item" style="margin-left: ${level * 20}px;">`;
            html += `<div class="debug-label">${key}:</div>`;
            html += `<div class="debug-value">${formatValue(value)}</div>`;
            html += '</div>';
        }
    });
    
    return html;
}

// Форматировать значение для отображения
function formatValue(value) {
    if (value === null || value === undefined) {
        return '<em>null</em>';
    }
    
    if (typeof value === 'boolean') {
        return value ? '✅ Да' : '❌ Нет';
    }
    
    if (typeof value === 'number') {
        return value.toString();
    }
    
    if (Array.isArray(value)) {
        return value.length === 0 ? '<em>Пустой массив</em>' : `[${value.length} элементов]`;
    }
    
    return String(value);
}

// Экспорт отладочных данных
function exportDebugData() {
    const debugData = {
        timestamp: new Date().toISOString(),
        userData: window.userData,
        systemInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenSize: `${screen.width}x${screen.height}`,
            windowSize: `${window.innerWidth}x${window.innerHeight}`
        },
        cacheInfo: window.dataCache,
        ordersInfo: {
            globalOrders: globalOrders,
            ordersCount: globalOrders ? globalOrders.length : 0
        },
        backendInfo: {
            url: getBackendUrl?.(),
            mode: getLaunchMode?.()
        }
    };
    
    const dataStr = JSON.stringify(debugData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `debug-data-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotification('Отладочные данные экспортированы!', 'success');
}

// Очистить весь кэш
function clearAllCache() {
    if (confirm('Вы уверены, что хотите очистить весь кэш? Это может повлиять на работу приложения.')) {
        // Очищаем localStorage
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('cache_')) {
                localStorage.removeItem(key);
            }
        });
        
        // Очищаем кэш в памяти
        if (window.dataCache) {
            Object.keys(window.dataCache).forEach(key => {
                if (window.dataCache[key] && window.dataCache[key].data) {
                    window.dataCache[key].data = Array.isArray(window.dataCache[key].data) ? [] : {};
                    window.dataCache[key].lastUpdate = 0;
                }
            });
        }
        
        // Очищаем глобальные переменные
        globalOrders = [];
        globalChatMessages = [];
        
        showNotification('Кэш очищен!', 'success');
        refreshDebugInfo();
    }
}

// Инициализация отладочной кнопки при загрузке профиля
function initDebugButton() {
    setTimeout(() => {
        checkAdminAndShowDebugButton();
    }, 1000);
}

// Инициализация звезд для добавления отзыва на странице отзывов
function initReviewsPageStars() {
    try {
        const starSelect = document.getElementById('starSelect');
        const reviewText = document.getElementById('reviewText');
        const sendBtn = document.getElementById('sendReviewBtn');
        
        if (!starSelect || !reviewText || !sendBtn) return;
        
        const stars = starSelect.querySelectorAll('i');
        let selectedRating = 0;
        
        // Скрываем поле ввода по умолчанию, кнопка видна но неактивна
        reviewText.style.display = 'none';
        sendBtn.style.display = 'none';
        sendBtn.disabled = true;
        
        // Удаляем старые обработчики
        stars.forEach(star => {
            star.classList.remove('active');
            star.replaceWith(star.cloneNode(true));
        });
        
        // Получаем новые элементы звезд
        const newStars = starSelect.querySelectorAll('i');
        
        // Добавляем обработчики для звездочек
        newStars.forEach((star, index) => {
            star.addEventListener('click', () => {
                selectedRating = index + 1;
                
                // Подсвечиваем выбранные звезды
                newStars.forEach((s, i) => {
                    if (i < selectedRating) {
                        s.classList.add('active');
                    } else {
                        s.classList.remove('active');
                    }
                });
                
                // Показываем поле ввода и кнопку
                reviewText.style.display = 'block';
                sendBtn.style.display = 'block';
                reviewText.focus();
                
                // Активируем кнопку после выбора звезды
                sendBtn.disabled = false;
            });
        });
        
        // Обработчик отправки отзыва
        sendBtn.addEventListener('click', () => {
            const currentUserData = window.userData || userData;
            console.log('📝 Отправка отзыва с страницы отзывов, userData:', currentUserData);
            
            const reviewData = {
                rating: selectedRating,
                comment: reviewText.value.trim() || 'Без комментария',
                user: currentUserData ? `@${currentUserData.username || currentUserData.firstName}` : '@гость',
                date: new Date().toLocaleDateString('ru-RU').split('/').reverse().join('.')
            };
            
            console.log('📝 Данные отзыва:', reviewData);
            
            // Отправляем отзыв в бэкенд
            trackImportantEvent('review_submit', {
                rating: selectedRating,
                comment: reviewData.comment,
                user: reviewData.user,
                date: reviewData.date
            });
            
            // Добавляем отзыв в общую базу
            globalReviews.unshift(reviewData);
            
            // Обновляем отображение отзывов
            updateReviewsPage();
            
            // Очищаем форму
            reviewText.value = '';
            reviewText.style.display = 'none';
            sendBtn.style.display = 'none';
            sendBtn.disabled = true;
            selectedRating = 0;
            
            // Сбрасываем звезды
            newStars.forEach(star => star.classList.remove('active'));
            
            // Показываем уведомление
            showNotification('Спасибо за отзыв!', 'success');
        });
    } catch (error) {
        console.error('Error in initReviewsPageStars:', error);
    }
}


