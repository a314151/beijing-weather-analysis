#!/usr/bin/env python3
"""
北京温度预测模型训练脚本
使用傅里叶级数拟合温度曲线，捕捉季节性变化
"""

import json
import numpy as np
from scipy.optimize import curve_fit
from datetime import datetime
import os

# 数据路径
DATA_PATH = "/home/z/my-project/download/beijing_weather_training.json"
OUTPUT_DIR = "/home/z/my-project/download"

def load_data():
    """加载天气数据"""
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data

def fourier_series(x, *params):
    """傅里叶级数函数"""
    n = len(params) // 2
    a0 = params[0] if len(params) > 0 else 0
    result = a0
    
    for i in range(n):
        if 2*i + 2 < len(params):
            a = params[2*i + 1]
            b = params[2*i + 2]
            result += a * np.cos(2 * np.pi * (i + 1) * x / 365.25) + \
                     b * np.sin(2 * np.pi * (i + 1) * x / 365.25)
    
    return result

def train_model(data):
    """训练温度预测模型"""
    print("准备训练数据...")
    
    # 提取特征和目标
    X = []  # day_of_year
    y_max = []  # 最高温度
    y_min = []  # 最低温度
    
    for item in data:
        date = datetime.strptime(item['date'], '%Y-%m-%d')
        day_of_year = date.timetuple().tm_yday
        X.append(day_of_year)
        y_max.append(item['max_temp'])
        y_min.append(item['min_temp'])
    
    X = np.array(X)
    y_max = np.array(y_max)
    y_min = np.array(y_min)
    
    # 移除NaN值
    valid_max = ~np.isnan(y_max)
    valid_min = ~np.isnan(y_min)
    
    X_max = X[valid_max]
    y_max = y_max[valid_max]
    X_min = X[valid_min]
    y_min = y_min[valid_min]
    
    print(f"有效最高温度数据: {len(y_max)} 条")
    print(f"有效最低温度数据: {len(y_min)} 条")
    
    # 使用傅里叶级数拟合（4阶，共9个参数）
    n_harmonics = 4
    
    # 初始参数猜测
    initial_params = [10.0]  # a0
    for i in range(n_harmonics):
        initial_params.extend([10.0, 10.0])  # a_i, b_i
    
    print("\n训练最高温度模型...")
    try:
        popt_max, pcov_max = curve_fit(
            fourier_series, X_max, y_max, 
            p0=initial_params,
            maxfev=10000
        )
        print("最高温度模型训练成功!")
    except Exception as e:
        print(f"最高温度模型训练失败: {e}")
        popt_max = initial_params
    
    print("\n训练最低温度模型...")
    try:
        popt_min, pcov_min = curve_fit(
            fourier_series, X_min, y_min,
            p0=initial_params,
            maxfev=10000
        )
        print("最低温度模型训练成功!")
    except Exception as e:
        print(f"最低温度模型训练失败: {e}")
        popt_min = initial_params
    
    # 计算模型误差
    y_max_pred = fourier_series(X_max, *popt_max)
    y_min_pred = fourier_series(X_min, *popt_min)
    
    rmse_max = np.sqrt(np.mean((y_max - y_max_pred) ** 2))
    rmse_min = np.sqrt(np.mean((y_min - y_min_pred) ** 2))
    mae_max = np.mean(np.abs(y_max - y_max_pred))
    mae_min = np.mean(np.abs(y_min - y_min_pred))
    
    print(f"\n模型评估:")
    print(f"  最高温度 RMSE: {rmse_max:.2f}°C, MAE: {mae_max:.2f}°C")
    print(f"  最低温度 RMSE: {rmse_min:.2f}°C, MAE: {mae_min:.2f}°C")
    
    # 保存模型参数
    model_params = {
        'max_temp_params': popt_max.tolist(),
        'min_temp_params': popt_min.tolist(),
        'n_harmonics': n_harmonics,
        'metrics': {
            'rmse_max': rmse_max,
            'rmse_min': rmse_min,
            'mae_max': mae_max,
            'mae_min': mae_min
        },
        'training_info': {
            'total_samples': len(data),
            'valid_max_samples': len(y_max),
            'valid_min_samples': len(y_min),
            'date_range': f"{data[0]['date']} to {data[-1]['date']}"
        }
    }
    
    output_path = os.path.join(OUTPUT_DIR, 'temperature_model.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(model_params, f, ensure_ascii=False, indent=2)
    print(f"\n模型参数已保存: {output_path}")
    
    return popt_max, popt_min, model_params

def predict_temperature(day_of_year, params_max, params_min):
    """预测指定日期的温度"""
    max_temp = fourier_series(day_of_year, *params_max)
    min_temp = fourier_series(day_of_year, *params_min)
    return max_temp, min_temp

def test_predictions(popt_max, popt_min):
    """测试预测功能"""
    print("\n测试预测功能:")
    test_dates = [
        (1, "1月1日"),
        (32, "2月1日"),
        (60, "3月1日"),
        (91, "4月1日"),
        (121, "5月1日"),
        (152, "6月1日"),
        (182, "7月1日"),
        (213, "8月1日"),
        (244, "9月1日"),
        (274, "10月1日"),
        (305, "11月1日"),
        (335, "12月1日"),
    ]
    
    for day, name in test_dates:
        max_temp, min_temp = predict_temperature(day, popt_max, popt_min)
        print(f"  {name}: 最高 {max_temp:.1f}°C, 最低 {min_temp:.1f}°C")

def main():
    print("=" * 50)
    print("北京温度预测模型训练")
    print("=" * 50)
    
    data = load_data()
    print(f"加载 {len(data)} 条数据")
    
    popt_max, popt_min, model_params = train_model(data)
    
    test_predictions(popt_max, popt_min)
    
    print("\n" + "=" * 50)
    print("模型训练完成!")
    print("=" * 50)
    
    return model_params

if __name__ == "__main__":
    main()
