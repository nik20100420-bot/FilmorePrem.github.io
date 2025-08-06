from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
from datetime import datetime, timedelta
import sqlite3

app = Flask(__name__)
CORS(app)  # Разрешаем CORS для всех доменов

# Инициализация базы данных
def init_db():
    conn = sqlite3.connect('analytics.db')
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS visits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            date TEXT NOT NULL,
            hour INTEGER NOT NULL,
            user_agent TEXT,
            referrer TEXT,
            url TEXT,
            ip_address TEXT
        )
    ''')
    
    conn.commit()
    conn.close()

# Инициализируем БД при запуске
init_db()

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('.', filename)

@app.route('/api/analytics/visit', methods=['POST'])
def record_visit():
    try:
        data = request.get_json()
        
        # Получаем IP адрес
        ip_address = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR', ''))
        
        # Сохраняем в базу данных
        conn = sqlite3.connect('analytics.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO visits (timestamp, date, hour, user_agent, referrer, url, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            data.get('timestamp'),
            data.get('date'),
            data.get('hour'),
            data.get('userAgent', ''),
            data.get('referrer', ''),
            data.get('url', ''),
            ip_address
        ))
        
        conn.commit()
        conn.close()
        
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/analytics/stats/<period>')
def get_stats(period):
    try:
        conn = sqlite3.connect('analytics.db')
        cursor = conn.cursor()
        
        # Определяем временной диапазон
        now = datetime.now()
        if period == 'day':
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == 'week':
            start_date = now - timedelta(days=7)
        elif period == 'month':
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:  # all
            start_date = datetime(1970, 1, 1)
        
        start_timestamp = int(start_date.timestamp() * 1000)
        
        # Получаем общую статистику
        cursor.execute('''
            SELECT COUNT(*) as total_visits,
                   COUNT(DISTINCT ip_address) as unique_visitors
            FROM visits 
            WHERE timestamp >= ?
        ''', (start_timestamp,))
        
        stats = cursor.fetchone()
        total_visits = stats[0] if stats else 0
        unique_visitors = stats[1] if stats else 0
        
        # Получаем данные по часам
        cursor.execute('''
            SELECT hour, COUNT(*) as count
            FROM visits 
            WHERE timestamp >= ?
            GROUP BY hour
            ORDER BY hour
        ''', (start_timestamp,))
        
        hourly_data = [0] * 24
        for row in cursor.fetchall():
            hourly_data[row[0]] = row[1]
        
        # Получаем данные по дням
        cursor.execute('''
            SELECT date, COUNT(*) as count
            FROM visits 
            WHERE timestamp >= ?
            GROUP BY date
            ORDER BY date
        ''', (start_timestamp,))
        
        daily_data = {}
        for row in cursor.fetchall():
            daily_data[row[0]] = row[1]
        
        # Получаем топ страниц
        cursor.execute('''
            SELECT url, COUNT(*) as count
            FROM visits 
            WHERE timestamp >= ?
            GROUP BY url
            ORDER BY count DESC
            LIMIT 10
        ''', (start_timestamp,))
        
        top_pages = cursor.fetchall()
        
        # Получаем топ источников
        cursor.execute('''
            SELECT CASE 
                WHEN referrer = '' OR referrer IS NULL THEN 'Прямой переход'
                ELSE referrer 
            END as ref, COUNT(*) as count
            FROM visits 
            WHERE timestamp >= ?
            GROUP BY ref
            ORDER BY count DESC
            LIMIT 10
        ''', (start_timestamp,))
        
        top_referrers = cursor.fetchall()
        
        conn.close()
        
        return jsonify({
            'totalVisits': total_visits,
            'uniqueVisitors': unique_visitors,
            'hourlyData': hourly_data,
            'dailyData': daily_data,
            'topPages': top_pages,
            'topReferrers': top_referrers
        })
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

