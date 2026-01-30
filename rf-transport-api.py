#!/usr/bin/env python3
from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import calendar

app = Flask(__name__)
CORS(app)

DB_CONFIG = {
    'host': 'localhost',
    'port': 5433,
    'dbname': 'postgres',
    'user': 'postgres',
    'password': '5+NMkUPabjFbh5vGZtWx5ea0QAX2NSR3G1k0sfAedms='
}

def get_db():
    return psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)

@app.route('/stats')
def stats():
    month = request.args.get('month', datetime.now().strftime('%Y-%m'))
    year, mon = map(int, month.split('-'))
    start_date = f"{month}-01"
    end_date = f"{month}-{calendar.monthrange(year, mon)[1]}"
    
    try:
        conn = get_db()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT COUNT(*) as total, 
                   COUNT(DISTINCT vehicle_number) as vehicles,
                   COUNT(DISTINCT contractor_name) as contractors,
                   COALESCE(SUM(amount), 0) as sum
            FROM contracts
            WHERE date >= %s AND date <= %s
        """, (start_date, end_date))
        contracts = dict(cur.fetchone())
        
        cur.execute("""
            SELECT COUNT(*) as total,
                   COUNT(DISTINCT vehicle_number) as vehicles, 
                   COUNT(DISTINCT driver_name) as drivers,
                   COALESCE(SUM(mileage), 0) as total_km,
                   COALESCE(SUM(driver_accruals), 0) as total_salary
            FROM driver_reports
            WHERE date_from >= %s AND date_to <= %s
        """, (start_date, end_date))
        reports = dict(cur.fetchone())
        
        conn.close()
        return jsonify({'ok': True, 'month': month, 'contracts': contracts, 'driver_reports': reports})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/contracts')
def contracts_list():
    month = request.args.get('month', datetime.now().strftime('%Y-%m'))
    limit = min(int(request.args.get('limit', 100)), 500)
    year, mon = map(int, month.split('-'))
    start_date = f"{month}-01"
    end_date = f"{month}-{calendar.monthrange(year, mon)[1]}"
    
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, number as contract_number, date as contract_date, contractor_name,
                   vehicle_number, route as route_name, amount as total_sum
            FROM contracts
            WHERE date >= %s AND date <= %s
            ORDER BY date DESC
            LIMIT %s
        """, (start_date, end_date, limit))
        data = [dict(r) for r in cur.fetchall()]
        conn.close()
        return jsonify({'ok': True, 'month': month, 'data': data})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/vehicles')
def vehicles():
    month = request.args.get('month', datetime.now().strftime('%Y-%m'))
    year, mon = map(int, month.split('-'))
    start_date = f"{month}-01"
    end_date = f"{month}-{calendar.monthrange(year, mon)[1]}"
    
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT vehicle_number, COUNT(*) as trip_count, COALESCE(SUM(amount), 0) as total_revenue
            FROM contracts
            WHERE vehicle_number IS NOT NULL AND date >= %s AND date <= %s
            GROUP BY vehicle_number
            ORDER BY total_revenue DESC
            LIMIT 50
        """, (start_date, end_date))
        data = [dict(r) for r in cur.fetchall()]
        conn.close()
        return jsonify({'ok': True, 'month': month, 'data': data})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/drivers')
def drivers():
    month = request.args.get('month', datetime.now().strftime('%Y-%m'))
    year, mon = map(int, month.split('-'))
    start_date = f"{month}-01"
    end_date = f"{month}-{calendar.monthrange(year, mon)[1]}"
    
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT driver_name, COUNT(*) as report_count, 
                   COALESCE(SUM(mileage), 0) as total_km,
                   COALESCE(SUM(driver_accruals), 0) as total_salary
            FROM driver_reports
            WHERE driver_name IS NOT NULL AND date_from >= %s AND date_to <= %s
            GROUP BY driver_name
            ORDER BY total_salary DESC
            LIMIT 50
        """, (start_date, end_date))
        data = [dict(r) for r in cur.fetchall()]
        conn.close()
        return jsonify({'ok': True, 'month': month, 'data': data})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=3002)
