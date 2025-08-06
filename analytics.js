// Система аналитики посещений
class VisitorAnalytics {
    constructor() {
        this.storageKey = 'visitor_analytics';
        this.sessionKey = 'visitor_session';
        this.init();
    }

    init() {
        // Проверяем, новый ли это посетитель
        const isNewVisitor = !this.hasVisited();
        const isNewSession = !this.hasActiveSession();

        if (isNewVisitor || isNewSession) {
            this.recordVisit();
        }

        // Обновляем время последней активности
        this.updateLastActivity();
        
        // Устанавливаем интервал для обновления активности
        setInterval(() => {
            this.updateLastActivity();
        }, 30000); // каждые 30 секунд
    }

    hasVisited() {
        return localStorage.getItem(this.storageKey) !== null;
    }

    hasActiveSession() {
        const sessionData = sessionStorage.getItem(this.sessionKey);
        if (!sessionData) return false;
        
        const session = JSON.parse(sessionData);
        const now = Date.now();
        const sessionTimeout = 30 * 60 * 1000; // 30 минут
        
        return (now - session.lastActivity) < sessionTimeout;
    }

    recordVisit() {
        const now = new Date();
        const timestamp = now.getTime();
        
        // Получаем существующие данные
        let analytics = this.getAnalyticsData();
        
        // Записываем новое посещение
        const visitData = {
            timestamp: timestamp,
            date: now.toISOString().split('T')[0],
            hour: now.getHours(),
            userAgent: navigator.userAgent,
            referrer: document.referrer,
            url: window.location.href
        };

        analytics.visits.push(visitData);
        analytics.totalVisits++;
        analytics.lastVisit = timestamp;

        // Сохраняем данные
        localStorage.setItem(this.storageKey, JSON.stringify(analytics));
        
        // Создаем сессию
        sessionStorage.setItem(this.sessionKey, JSON.stringify({
            startTime: timestamp,
            lastActivity: timestamp
        }));

        // Отправляем данные на сервер (если доступен)
        this.sendToServer(visitData);
    }

    updateLastActivity() {
        const sessionData = sessionStorage.getItem(this.sessionKey);
        if (sessionData) {
            const session = JSON.parse(sessionData);
            session.lastActivity = Date.now();
            sessionStorage.setItem(this.sessionKey, JSON.stringify(session));
        }
    }

    getAnalyticsData() {
        const defaultData = {
            visits: [],
            totalVisits: 0,
            firstVisit: Date.now(),
            lastVisit: null
        };

        const stored = localStorage.getItem(this.storageKey);
        return stored ? JSON.parse(stored) : defaultData;
    }

    getStats(period = 'all') {
        const analytics = this.getAnalyticsData();
        const now = new Date();
        let startDate;

        switch (period) {
            case 'day':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            default:
                startDate = new Date(0);
        }

        const filteredVisits = analytics.visits.filter(visit => 
            new Date(visit.timestamp) >= startDate
        );

        return {
            totalVisits: filteredVisits.length,
            uniqueVisitors: this.getUniqueVisitors(filteredVisits),
            hourlyData: this.getHourlyData(filteredVisits),
            dailyData: this.getDailyData(filteredVisits),
            topPages: this.getTopPages(filteredVisits),
            topReferrers: this.getTopReferrers(filteredVisits)
        };
    }

    getUniqueVisitors(visits) {
        // Простая эмуляция уникальных посетителей по User Agent
        const uniqueAgents = new Set(visits.map(v => v.userAgent));
        return uniqueAgents.size;
    }

    getHourlyData(visits) {
        const hourlyStats = new Array(24).fill(0);
        visits.forEach(visit => {
            hourlyStats[visit.hour]++;
        });
        return hourlyStats;
    }

    getDailyData(visits) {
        const dailyStats = {};
        visits.forEach(visit => {
            const date = visit.date;
            dailyStats[date] = (dailyStats[date] || 0) + 1;
        });
        return dailyStats;
    }

    getTopPages(visits) {
        const pageStats = {};
        visits.forEach(visit => {
            const url = visit.url;
            pageStats[url] = (pageStats[url] || 0) + 1;
        });
        
        return Object.entries(pageStats)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
    }

    getTopReferrers(visits) {
        const referrerStats = {};
        visits.forEach(visit => {
            const referrer = visit.referrer || 'Прямой переход';
            referrerStats[referrer] = (referrerStats[referrer] || 0) + 1;
        });
        
        return Object.entries(referrerStats)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
    }

    sendToServer(visitData) {
        // Попытка отправить данные на сервер
        fetch('/api/analytics/visit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(visitData)
        }).catch(error => {
            console.log('Analytics server not available:', error);
        });
    }

    // Публичные методы для получения статистики
    getDayStats() { return this.getStats('day'); }
    getWeekStats() { return this.getStats('week'); }
    getMonthStats() { return this.getStats('month'); }
    getAllTimeStats() { return this.getStats('all'); }
}

// Инициализация аналитики
const analytics = new VisitorAnalytics();

// Глобальные функции для доступа к статистике
window.getAnalyticsStats = function(period) {
    return analytics.getStats(period);
};

window.analytics = analytics;

