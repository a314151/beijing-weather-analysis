#!/usr/bin/env python3
"""
北京历史天气数据处理、图表生成和模型训练脚本
"""

import json
import numpy as np
import matplotlib.pyplot as plt
from datetime import datetime
import os

# 设置中文字体
plt.rcParams['font.sans-serif'] = ['SimHei']
plt.rcParams['axes.unicode_minus'] = False

# 数据路径
DATA_PATH = "/home/z/my-project/download/beijing_weather_training.json"
OUTPUT_DIR = "/home/z/my-project/download"

def load_data():
    """加载天气数据"""
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data

def process_data(data):
    """处理数据，提取特征"""
    processed = []
    for item in data:
        date = datetime.strptime(item['date'], '%Y-%m-%d')
        day_of_year = date.timetuple().tm_yday  # 一年中的第几天 (1-366)
        month = date.month
        day = date.day
        year = date.year
        
        processed.append({
            'date': item['date'],
            'year': year,
            'month': month,
            'day': day,
            'day_of_year': day_of_year,
            'max_temp': item['max_temp'],
            'min_temp': item['min_temp']
        })
    
    return processed

def calculate_monthly_averages(data):
    """计算每月平均温度"""
    monthly_data = {}
    for item in data:
        key = item['month']
        if key not in monthly_data:
            monthly_data[key] = {'max_temps': [], 'min_temps': []}
        monthly_data[key]['max_temps'].append(item['max_temp'])
        monthly_data[key]['min_temps'].append(item['min_temp'])
    
    monthly_avg = {}
    for month, temps in monthly_data.items():
        monthly_avg[month] = {
            'avg_max': np.mean(temps['max_temps']),
            'avg_min': np.mean(temps['min_temps']),
            'std_max': np.std(temps['max_temps']),
            'std_min': np.std(temps['min_temps'])
        }
    
    return monthly_avg

def calculate_yearly_averages(data):
    """计算每年平均温度"""
    yearly_data = {}
    for item in data:
        key = item['year']
        if key not in yearly_data:
            yearly_data[key] = {'max_temps': [], 'min_temps': []}
        yearly_data[key]['max_temps'].append(item['max_temp'])
        yearly_data[key]['min_temps'].append(item['min_temp'])
    
    yearly_avg = {}
    for year, temps in yearly_data.items():
        yearly_avg[year] = {
            'avg_max': np.mean(temps['max_temps']),
            'avg_min': np.mean(temps['min_temps'])
        }
    
    return yearly_avg

def calculate_daily_averages(data):
    """计算每一天（按day_of_year）的平均温度"""
    daily_data = {}
    for item in data:
        key = item['day_of_year']
        if key not in daily_data:
            daily_data[key] = {'max_temps': [], 'min_temps': []}
        daily_data[key]['max_temps'].append(item['max_temp'])
        daily_data[key]['min_temps'].append(item['min_temp'])
    
    daily_avg = {}
    for day, temps in daily_data.items():
        daily_avg[day] = {
            'avg_max': np.mean(temps['max_temps']),
            'avg_min': np.mean(temps['min_temps']),
            'std_max': np.std(temps['max_temps']),
            'std_min': np.std(temps['min_temps'])
        }
    
    return daily_avg

def plot_yearly_temperature(yearly_avg):
    """绘制年度温度变化图"""
    years = sorted(yearly_avg.keys())
    avg_max = [yearly_avg[y]['avg_max'] for y in years]
    avg_min = [yearly_avg[y]['avg_min'] for y in years]
    
    plt.figure(figsize=(16, 8))
    plt.plot(years, avg_max, 'r-', label='年平均最高温度', linewidth=2)
    plt.plot(years, avg_min, 'b-', label='年平均最低温度', linewidth=2)
    plt.fill_between(years, avg_min, avg_max, alpha=0.3, color='gray')
    
    plt.xlabel('年份', fontsize=14)
    plt.ylabel('温度 (°C)', fontsize=14)
    plt.title('北京年度平均温度变化 (1940-2026)', fontsize=16)
    plt.legend(fontsize=12)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    
    output_path = os.path.join(OUTPUT_DIR, 'yearly_temperature.png')
    plt.savefig(output_path, dpi=150)
    plt.close()
    print(f"年度温度图已保存: {output_path}")

def plot_monthly_temperature(monthly_avg):
    """绘制月度温度变化图"""
    months = sorted(monthly_avg.keys())
    avg_max = [monthly_avg[m]['avg_max'] for m in months]
    avg_min = [monthly_avg[m]['avg_min'] for m in months]
    std_max = [monthly_avg[m]['std_max'] for m in months]
    std_min = [monthly_avg[m]['std_min'] for m in months]
    
    month_names = ['1月', '2月', '3月', '4月', '5月', '6月', 
                   '7月', '8月', '9月', '10月', '11月', '12月']
    
    plt.figure(figsize=(14, 8))
    
    # 绘制误差带
    plt.fill_between(months, 
                     [avg_max[i] - std_max[i] for i in range(len(months))],
                     [avg_max[i] + std_max[i] for i in range(len(months))],
                     alpha=0.2, color='red')
    plt.fill_between(months, 
                     [avg_min[i] - std_min[i] for i in range(len(months))],
                     [avg_min[i] + std_min[i] for i in range(len(months))],
                     alpha=0.2, color='blue')
    
    plt.plot(months, avg_max, 'r-o', label='月平均最高温度', linewidth=2, markersize=8)
    plt.plot(months, avg_min, 'b-o', label='月平均最低温度', linewidth=2, markersize=8)
    
    plt.xlabel('月份', fontsize=14)
    plt.ylabel('温度 (°C)', fontsize=14)
    plt.title('北京月度平均温度变化 (1940-2026)', fontsize=16)
    plt.xticks(months, month_names, fontsize=12)
    plt.legend(fontsize=12)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    
    output_path = os.path.join(OUTPUT_DIR, 'monthly_temperature.png')
    plt.savefig(output_path, dpi=150)
    plt.close()
    print(f"月度温度图已保存: {output_path}")

def plot_daily_temperature(daily_avg):
    """绘制每日平均温度变化图（按一年中的天数）"""
    days = sorted(daily_avg.keys())
    avg_max = [daily_avg[d]['avg_max'] for d in days]
    avg_min = [daily_avg[d]['avg_min'] for d in days]
    std_max = [daily_avg[d]['std_max'] for d in days]
    std_min = [daily_avg[d]['std_min'] for d in days]
    
    plt.figure(figsize=(18, 8))
    
    # 绘制误差带
    plt.fill_between(days, 
                     [avg_max[i] - std_max[i] for i in range(len(days))],
                     [avg_max[i] + std_max[i] for i in range(len(days))],
                     alpha=0.2, color='red')
    plt.fill_between(days, 
                     [avg_min[i] - std_min[i] for i in range(len(days))],
                     [avg_min[i] + std_min[i] for i in range(len(days))],
                     alpha=0.2, color='blue')
    
    plt.plot(days, avg_max, 'r-', label='日平均最高温度', linewidth=1.5, alpha=0.8)
    plt.plot(days, avg_min, 'b-', label='日平均最低温度', linewidth=1.5, alpha=0.8)
    
    # 添加月份标记
    month_starts = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]
    month_names = ['1月', '2月', '3月', '4月', '5月', '6月', 
                   '7月', '8月', '9月', '10月', '11月', '12月']
    plt.xticks(month_starts, month_names, fontsize=12)
    
    plt.xlabel('月份', fontsize=14)
    plt.ylabel('温度 (°C)', fontsize=14)
    plt.title('北京每日平均温度变化曲线 (1940-2026年数据平均)', fontsize=16)
    plt.legend(fontsize=12)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    
    output_path = os.path.join(OUTPUT_DIR, 'daily_temperature.png')
    plt.savefig(output_path, dpi=150)
    plt.close()
    print(f"每日温度图已保存: {output_path}")

def plot_recent_years(data):
    """绘制最近几年的温度变化图"""
    recent_years = [2020, 2021, 2022, 2023, 2024]
    
    plt.figure(figsize=(18, 10))
    
    colors = plt.cm.viridis(np.linspace(0, 1, len(recent_years)))
    
    for i, year in enumerate(recent_years):
        year_data = [item for item in data if item['year'] == year]
        if year_data:
            year_data.sort(key=lambda x: x['day_of_year'])
            days = [item['day_of_year'] for item in year_data]
            max_temps = [item['max_temp'] for item in year_data]
            min_temps = [item['min_temp'] for item in year_data]
            
            plt.plot(days, max_temps, '-', color=colors[i], linewidth=1.5, 
                    label=f'{year}年最高温', alpha=0.8)
            plt.plot(days, min_temps, '--', color=colors[i], linewidth=1.5, 
                    label=f'{year}年最低温', alpha=0.8)
    
    month_starts = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]
    month_names = ['1月', '2月', '3月', '4月', '5月', '6月', 
                   '7月', '8月', '9月', '10月', '11月', '12月']
    plt.xticks(month_starts, month_names, fontsize=12)
    
    plt.xlabel('月份', fontsize=14)
    plt.ylabel('温度 (°C)', fontsize=14)
    plt.title('北京近年温度变化对比 (2020-2024)', fontsize=16)
    plt.legend(fontsize=10, ncol=2)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    
    output_path = os.path.join(OUTPUT_DIR, 'recent_years_temperature.png')
    plt.savefig(output_path, dpi=150)
    plt.close()
    print(f"近年温度图已保存: {output_path}")

def save_statistics(monthly_avg, yearly_avg, daily_avg):
    """保存统计数据"""
    stats = {
        'monthly': {str(k): v for k, v in monthly_avg.items()},
        'yearly': {str(k): v for k, v in yearly_avg.items()},
        'daily': {str(k): v for k, v in daily_avg.items()}
    }
    
    output_path = os.path.join(OUTPUT_DIR, 'temperature_statistics.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    print(f"统计数据已保存: {output_path}")

def main():
    print("加载天气数据...")
    data = load_data()
    print(f"共加载 {len(data)} 条数据")
    
    print("\n处理数据...")
    processed_data = process_data(data)
    
    print("\n计算统计数据...")
    monthly_avg = calculate_monthly_averages(processed_data)
    yearly_avg = calculate_yearly_averages(processed_data)
    daily_avg = calculate_daily_averages(processed_data)
    
    print("\n生成图表...")
    plot_yearly_temperature(yearly_avg)
    plot_monthly_temperature(monthly_avg)
    plot_daily_temperature(daily_avg)
    plot_recent_years(processed_data)
    
    print("\n保存统计数据...")
    save_statistics(monthly_avg, yearly_avg, daily_avg)
    
    print("\n数据处理完成!")
    return processed_data, monthly_avg, yearly_avg, daily_avg

if __name__ == "__main__":
    main()
