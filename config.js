// Конфигурация WebApp
const CONFIG = {
    // Автоматическое определение URL сервера
    async getServerUrl() {
        // Если мы в Telegram WebApp, пытаемся получить IP от бота
        if (window.Telegram && window.Telegram.WebApp) {
            try {
                // Пробуем получить IP от бота через несколько известных адресов
                const knownServers = [
                    'http://localhost:5000',
                    'http://92.243.182.46:5000',
                    'https://your-production-domain.com'
                ];
                
                for (const server of knownServers) {
                    try {
                        const response = await fetch(`${server}/server/info`, {
                            method: 'GET',
                            timeout: 3000
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            console.log('🌐 Server info received:', data);
                            return data.server_url;
                        }
                    } catch (e) {
                        console.log(`⚠️ Failed to connect to ${server}:`, e.message);
                        continue;
                    }
                }
                
                // Если не удалось подключиться ни к одному серверу
                console.warn('⚠️ Could not connect to any known server, using fallback');
                return 'http://92.243.182.46:5000';
                
            } catch (error) {
                console.error('❌ Error getting server info:', error);
                return 'http://92.243.182.46:5000';
            }
        }
        
        // Fallback для тестирования
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:5000';
        }
        
        // По умолчанию используем внешний сервер
        return 'http://92.243.182.46:5000';
    },
    
    // URL для API
    async getApiUrl() {
        const serverUrl = await this.getServerUrl();
        return `${serverUrl}/webapp/data`;
    },
    
    // Настройки для разных окружений
    environments: {
        local: {
            serverUrl: 'http://localhost:5000',
            apiUrl: 'http://localhost:5000/webapp/data'
        },
        development: {
            serverUrl: 'http://92.243.182.46:5000',
            apiUrl: 'http://92.243.182.46:5000/webapp/data'
        },
        production: {
            serverUrl: 'https://your-production-domain.com',
            apiUrl: 'https://your-production-domain.com/webapp/data'
        }
    },
    
    // Принудительно использовать определенное окружение
    forceEnvironment: null, // 'local', 'development', 'production' или null для автоопределения
    
    // Получить конфигурацию для текущего окружения
    async getCurrentConfig() {
        if (this.forceEnvironment && this.environments[this.forceEnvironment]) {
            return this.environments[this.forceEnvironment];
        }
        
        const serverUrl = await this.getServerUrl();
        return {
            serverUrl: serverUrl,
            apiUrl: `${serverUrl}/webapp/data`
        };
    }
};

// Экспортируем для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} 