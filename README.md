# 🌤️ 北京历史温度数据分析与预测系统

基于1940-2026年共**31,481天**的历史天气数据，提供温度预测、温度区间查询、衣服温度问答等功能。

---

## 🌐 在线访问

| 平台 | 链接 | 说明 |
|------|------|------|
| **Vercel** | [https://my-project-orpin-five.vercel.app](https://my-project-orpin-five.vercel.app) | 主部署平台 |
| **Cloudflare Pages** | [https://beijing-weather.pages.dev](https://beijing-weather.pages.dev) | 备用部署平台 |

---

## ✨ 功能特性

### 📊 数据概览
- 31,481天历史天气数据（1940-2026年）
- 年度/月度/每日温度统计图表
- 傅里叶级数预测模型（RMSE ≈ 3.8°C）

### 🔮 温度预测
- 输入任意日期，预测该日最高/最低温度
- 基于傅里叶级数拟合算法

### 🌡️ 温度区间查询
- 输入温度范围（如 15°C ~ 25°C）
- 查询北京全年哪些时间段适合该温度
- 显示适合天数和占比

### 👕 衣服温度问答
- 支持 DeepSeek / OpenAI / Moonshot API
- 询问"某种衣服适合什么温度穿"
- AI返回规范化回答 + 时间段可视化

### 📊 对比模式
- 选择多种衣服进行对比
- 可视化对比温度范围和全年时间段

---

## 🛠️ 技术栈

- **前端**: Next.js 16 + React 19 + TypeScript + Tailwind CSS
- **图表**: Recharts
- **数据**: Open-Meteo Historical Weather API
- **模型**: 傅里叶级数拟合（客户端计算）
- **部署**: Vercel + Cloudflare Pages

---

## 📦 本地运行

```bash
# 克隆仓库
git clone https://github.com/a314151/beijing-weather-analysis.git
cd beijing-weather-analysis

# 安装依赖
npm install

# 运行开发服务器
npm run dev

# 访问 http://localhost:3000
```

---

## 📁 项目结构

```
beijing-weather-analysis/
├── src/app/page.tsx          # 前端页面（所有功能）
├── public/data/              # 静态数据文件
│   ├── beijing_weather_training.json   # 历史天气数据
│   ├── temperature_statistics.json     # 温度统计数据
│   └── temperature_model.json          # 预测模型参数
├── public/download/          # 图表图片
├── package.json
├── next.config.ts
└── wrangler.toml             # Cloudflare 配置
```

---

## 📊 数据来源

- **Open-Meteo Historical Weather API**: https://open-meteo.com/en/docs/historical-weather-api
- 提供从1940年至今的历史天气数据

---

## 📄 License

MIT License
