#!/usr/bin/env python3
"""
北京历史天气数据获取脚本
使用Open-Meteo API获取从1940年至今的每日最高和最低温度数据
"""

import requests
import json
import time
from datetime import datetime, timedelta
import os

# 北京坐标
BEIJING_LAT = 39.9042
BEIJING_LON = 116.4074

# Open-Meteo API URL
BASE_URL = "https://archive-api.open-meteo.com/v1/archive"

def fetch_weather_data(start_date, end_date):
    """获取指定日期范围的天气数据"""
    params = {
        "latitude": BEIJING_LAT,
        "longitude": BEIJING_LON,
        "start_date": start_date,
        "end_date": end_date,
        "daily": "temperature_2m_max,temperature_2m_min",
        "timezone": "Asia/Shanghai"
    }
    
    try:
        response = requests.get(BASE_URL, params=params, timeout=60)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error fetching data for {start_date} to {end_date}: {e}")
        return None

def fetch_all_data():
    """获取所有历史数据（从1940年开始）"""
    all_data = {
        "dates": [],
        "max_temps": [],
        "min_temps": []
    }
    
    # Open-Meteo提供从1940年开始的数据
    start_year = 1940
    end_year = datetime.now().year
    
    print(f"开始获取北京历史天气数据 ({start_year}-{end_year})...")
    
    # 每年获取一次数据
    for year in range(start_year, end_year + 1):
        start_date = f"{year}-01-01"
        if year == end_year:
            end_date = datetime.now().strftime("%Y-%m-%d")
        else:
            end_date = f"{year}-12-31"
        
        print(f"正在获取 {year} 年数据...")
        data = fetch_weather_data(start_date, end_date)
        
        if data and "daily" in data:
            daily = data["daily"]
            all_data["dates"].extend(daily.get("time", []))
            all_data["max_temps"].extend(daily.get("temperature_2m_max", []))
            all_data["min_temps"].extend(daily.get("temperature_2m_min", []))
            print(f"  获取了 {len(daily.get('time', []))} 天的数据")
        else:
            print(f"  获取 {year} 年数据失败")
        
        # 避免请求过快
        time.sleep(0.5)
    
    return all_data

def save_data(data, filename):
    """保存数据到JSON文件"""
    output_path = f"/home/z/my-project/download/{filename}"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"数据已保存到: {output_path}")

def main():
    # 获取数据
    weather_data = fetch_all_data()
    
    # 统计信息
    print(f"\n数据统计:")
    print(f"  总天数: {len(weather_data['dates'])}")
    print(f"  日期范围: {weather_data['dates'][0]} 到 {weather_data['dates'][-1]}")
    
    # 保存原始数据
    save_data(weather_data, "beijing_weather_raw.json")
    
    # 创建用于训练的数据格式
    training_data = []
    for i, date in enumerate(weather_data['dates']):
        if weather_data['max_temps'][i] is not None and weather_data['min_temps'][i] is not None:
            training_data.append({
                "date": date,
                "max_temp": weather_data['max_temps'][i],
                "min_temp": weather_data['min_temps'][i]
            })
    
    # 保存训练数据
    save_data(training_data, "beijing_weather_training.json")
    
    print(f"\n有效数据条数: {len(training_data)}")
    
    return weather_data, training_data

if __name__ == "__main__":
    main()
