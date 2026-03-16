'use client'

import { useState, useEffect, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ComposedChart, Legend } from 'recharts'

// 数据类型定义
interface Summary {
  total_days: number
  date_range: { start: string; end: string }
  years: number
  model_metrics: { rmse_max: number; rmse_min: number; mae_max: number; mae_min: number }
}

interface MonthlyData {
  [key: string]: { avg_max: number; avg_min: number; std_max: number; std_min: number }
}

interface YearlyData {
  [key: string]: { avg_max: number; avg_min: number }
}

interface TempRangeResult {
  query: { minTemp: number; maxTemp: number }
  periods: Array<{ startDay: number; endDay: number; startMonth: string; endMonth: string }>
  yearlyData: Array<{ day: number; month: string; avgTemp: number; inRange: boolean }>
  totalDays: number
}

interface ClothingResponse {
  clothing: string
  min_temp: number
  max_temp: number
  description: string
  tips: string[]
  suitable_occasions: string[]
  periods?: Array<{ startDay: number; endDay: number; startMonth: string; endMonth: string }>
}

interface CompareItem {
  name: string
  minTemp: number
  maxTemp: number
  color: string
  periods: Array<{ startDay: number; endDay: number; startMonth: string; endMonth: string }>
  yearlyData: Array<{ day: number; avgTemp: number; inRange: boolean }>
  totalDays: number
}

interface ModelData {
  max_temp_params: number[]
  min_temp_params: number[]
}

interface TrainingDataItem {
  date: string
  max_temp: number
  min_temp: number
}

// 预设衣服数据
const PRESET_CLOTHES = [
  { name: '羽绒服', min_temp: -20, max_temp: 5, color: '#1e40af' },
  { name: '棉服', min_temp: -10, max_temp: 10, color: '#1d4ed8' },
  { name: '毛衣', min_temp: 0, max_temp: 15, color: '#6366f1' },
  { name: '卫衣', min_temp: 10, max_temp: 20, color: '#8b5cf6' },
  { name: '薄外套', min_temp: 15, max_temp: 25, color: '#a855f7' },
  { name: 'T恤', min_temp: 20, max_temp: 35, color: '#ec4899' },
  { name: '短袖', min_temp: 25, max_temp: 40, color: '#f43f5e' },
]

const COLORS = ['#1e40af', '#1d4ed8', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#f97316']

// 傅里叶级数函数
function fourierSeries(x: number, params: number[]): number {
  const n = Math.floor((params.length - 1) / 2)
  const a0 = params[0] || 0
  let result = a0

  for (let i = 0; i < n; i++) {
    if (2 * i + 2 < params.length) {
      const a = params[2 * i + 1]
      const b = params[2 * i + 2]
      result += a * Math.cos((2 * Math.PI * (i + 1) * x) / 365.25) +
                b * Math.sin((2 * Math.PI * (i + 1) * x) / 365.25)
    }
  }

  return result
}

// 根据日期获取月份名
function getMonthName(dayOfYear: number): string {
  const date = new Date(2024, 0)
  date.setDate(dayOfYear)
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  return monthNames[date.getMonth()]
}

// 根据温度区间查找全年时间段
function findTemperaturePeriods(
  minTemp: number,
  maxTemp: number,
  modelParams: ModelData
): Array<{ startDay: number; endDay: number; startMonth: string; endMonth: string }> {
  const periods: Array<{ startDay: number; endDay: number; startMonth: string; endMonth: string }> = []
  let inPeriod = false
  let periodStart = 0

  for (let day = 1; day <= 366; day++) {
    const predictedMax = fourierSeries(day, modelParams.max_temp_params)
    const predictedMin = fourierSeries(day, modelParams.min_temp_params)
    const avgTemp = (predictedMax + predictedMin) / 2

    const inRange = avgTemp >= minTemp && avgTemp <= maxTemp

    if (inRange && !inPeriod) {
      inPeriod = true
      periodStart = day
    } else if (!inRange && inPeriod) {
      inPeriod = false
      periods.push({
        startDay: periodStart,
        endDay: day - 1,
        startMonth: getMonthName(periodStart),
        endMonth: getMonthName(day - 1),
      })
    }
  }

  if (inPeriod) {
    periods.push({
      startDay: periodStart,
      endDay: 366,
      startMonth: getMonthName(periodStart),
      endMonth: '12月',
    })
  }

  return periods
}

// 获取一年中的第几天
function getDayOfYear(dateStr: string): number {
  const date = new Date(dateStr)
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  const oneDay = 1000 * 60 * 60 * 24
  return Math.floor(diff / oneDay)
}

export default function Home() {
  // 基础状态
  const [summary, setSummary] = useState<Summary | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null)
  const [yearlyData, setYearlyData] = useState<YearlyData | null>(null)
  const [modelData, setModelData] = useState<ModelData | null>(null)
  const [trainingData, setTrainingData] = useState<TrainingDataItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'predict' | 'history' | 'temprange' | 'clothing' | 'compare'>('overview')

  // 温度预测状态
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [prediction, setPrediction] = useState<{ maxTemp: number; minTemp: number; dayOfYear: number } | null>(null)

  // 历史数据状态
  const [historyData, setHistoryData] = useState<TrainingDataItem[]>([])
  const [selectedYear, setSelectedYear] = useState<string>('2024')

  // 温度区间查询状态
  const [tempRangeMin, setTempRangeMin] = useState<number>(15)
  const [tempRangeMax, setTempRangeMax] = useState<number>(25)
  const [tempRangeResult, setTempRangeResult] = useState<TempRangeResult | null>(null)

  // 衣服问答状态
  const [apiKey, setApiKey] = useState<string>('')
  const [llmProvider, setLlmProvider] = useState<string>('deepseek')
  const [clothingQuestion, setClothingQuestion] = useState<string>('')
  const [clothingResponse, setClothingResponse] = useState<ClothingResponse | null>(null)
  const [llmLoading, setLlmLoading] = useState(false)

  // 对比模式状态
  const [compareItems, setCompareItems] = useState<CompareItem[]>([])
  const [compareResults, setCompareResults] = useState<CompareItem[]>([])
  const [compareMode, setCompareMode] = useState(false)

  // 加载静态数据
  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsRes, modelRes, trainingRes] = await Promise.all([
          fetch('/data/temperature_statistics.json'),
          fetch('/data/temperature_model.json'),
          fetch('/data/beijing_weather_training.json'),
        ])

        const stats = await statsRes.json()
        const model = await modelRes.json()
        const training = await trainingRes.json()

        setMonthlyData(stats.monthly)
        setYearlyData(stats.yearly)
        setModelData(model)
        setTrainingData(training)

        // 计算summary
        const years = Object.keys(stats.yearly).length
        setSummary({
          total_days: training.length,
          date_range: {
            start: training[0]?.date || '1940-01-01',
            end: training[training.length - 1]?.date || '2026-03-10',
          },
          years,
          model_metrics: model.metrics,
        })

        setLoading(false)
      } catch (error) {
        console.error('Failed to load data:', error)
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // 加载历史数据
  useEffect(() => {
    if (activeTab === 'history' && trainingData.length > 0) {
      const filtered = trainingData.filter(item => item.date.startsWith(selectedYear))
      setHistoryData(filtered)
    }
  }, [activeTab, selectedYear, trainingData])

  // 预测温度
  const predictTemperature = useCallback(() => {
    if (!selectedDate || !modelData) return
    const dayOfYear = getDayOfYear(selectedDate)
    const maxTemp = fourierSeries(dayOfYear, modelData.max_temp_params)
    const minTemp = fourierSeries(dayOfYear, modelData.min_temp_params)
    setPrediction({
      maxTemp: Math.round(maxTemp * 10) / 10,
      minTemp: Math.round(minTemp * 10) / 10,
      dayOfYear,
    })
  }, [selectedDate, modelData])

  // 查询温度区间
  const queryTempRange = useCallback(() => {
    if (!modelData) return

    const periods = findTemperaturePeriods(tempRangeMin, tempRangeMax, modelData)

    const yearlyData = []
    for (let day = 1; day <= 366; day++) {
      const predictedMax = fourierSeries(day, modelData.max_temp_params)
      const predictedMin = fourierSeries(day, modelData.min_temp_params)
      const avgTemp = (predictedMax + predictedMin) / 2
      yearlyData.push({
        day,
        month: getMonthName(day),
        avgTemp: Math.round(avgTemp * 10) / 10,
        inRange: avgTemp >= tempRangeMin && avgTemp <= tempRangeMax,
      })
    }

    setTempRangeResult({
      query: { minTemp: tempRangeMin, maxTemp: tempRangeMax },
      periods,
      yearlyData,
      totalDays: yearlyData.filter(d => d.inRange).length,
    })
  }, [tempRangeMin, tempRangeMax, modelData])

  // LLM问答
  const queryLLM = async () => {
    if (!apiKey || !clothingQuestion || !modelData) return
    setLlmLoading(true)
    try {
      const baseUrl = llmProvider === 'deepseek' 
        ? 'https://api.deepseek.com' 
        : llmProvider === 'openai' 
          ? 'https://api.openai.com/v1' 
          : llmProvider === 'moonshot'
            ? 'https://api.moonshot.cn/v1'
            : 'https://api.deepseek.com'
      
      const model = llmProvider === 'deepseek' 
        ? 'deepseek-chat' 
        : llmProvider === 'openai' 
          ? 'gpt-3.5-turbo' 
          : llmProvider === 'moonshot'
            ? 'moonshot-v1-8k'
            : 'deepseek-chat'

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `你是一个服装温度顾问。当用户询问某种衣服适合的温度时，请严格按照以下JSON格式回答，不要添加任何其他内容：
{
  "clothing": "衣服名称",
  "min_temp": 最低适合温度(数字),
  "max_temp": 最高适合温度(数字),
  "description": "简短描述",
  "tips": ["穿搭建议1", "穿搭建议2"],
  "suitable_occasions": ["场合1", "场合2"]
}`
            },
            { role: 'user', content: clothingQuestion },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      })

      if (!response.ok) {
        throw new Error('API调用失败')
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content || ''

      // 解析JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        
        // 计算时间段
        if (parsed.min_temp !== undefined && parsed.max_temp !== undefined) {
          parsed.periods = findTemperaturePeriods(parsed.min_temp, parsed.max_temp, modelData)
        }
        
        setClothingResponse(parsed)
      } else {
        alert('无法解析AI回答')
      }
    } catch (error) {
      console.error('LLM Error:', error)
      alert('查询失败，请检查API Key和网络连接')
    } finally {
      setLlmLoading(false)
    }
  }

  // 添加对比项
  const addCompareItem = (item: { name: string; min_temp: number; max_temp: number; color?: string }) => {
    if (compareItems.find(i => i.name === item.name)) return
    setCompareItems([...compareItems, { 
      ...item, 
      color: item.color || COLORS[compareItems.length % COLORS.length],
      periods: [],
      yearlyData: [],
      totalDays: 0,
    }])
  }

  // 移除对比项
  const removeCompareItem = (name: string) => {
    setCompareItems(compareItems.filter(i => i.name !== name))
  }

  // 执行对比查询
  const executeCompare = useCallback(() => {
    if (compareItems.length === 0 || !modelData) return

    const results = compareItems.map(item => {
      const periods = findTemperaturePeriods(item.minTemp, item.maxTemp, modelData)
      
      const yearlyData = []
      for (let day = 1; day <= 366; day++) {
        const predictedMax = fourierSeries(day, modelData.max_temp_params)
        const predictedMin = fourierSeries(day, modelData.min_temp_params)
        const avgTemp = (predictedMax + predictedMin) / 2
        yearlyData.push({
          day,
          avgTemp: Math.round(avgTemp * 10) / 10,
          inRange: avgTemp >= item.minTemp && avgTemp <= item.maxTemp,
        })
      }

      return {
        ...item,
        periods,
        yearlyData,
        totalDays: yearlyData.filter(d => d.inRange).length,
      }
    })

    setCompareResults(results)
    setCompareMode(true)
  }, [compareItems, modelData])

  // 准备月度图表数据
  const monthlyChartData = monthlyData ? Object.entries(monthlyData).map(([month, data]) => ({
    month: `${month}月`,
    avg_max: Math.round(data.avg_max * 10) / 10,
    avg_min: Math.round(data.avg_min * 10) / 10,
  })) : []

  // 准备年度图表数据
  const yearlyChartData = yearlyData ? Object.entries(yearlyData)
    .filter(([year]) => parseInt(year) >= 1950)
    .map(([year, data]) => ({
      year,
      avg_max: Math.round(data.avg_max * 10) / 10,
      avg_min: Math.round(data.avg_min * 10) / 10,
    })) : []

  // 准备历史数据图表
  const historyChartData = historyData.map(item => ({
    date: item.date.slice(5),
    fullDate: item.date,
    max_temp: item.max_temp,
    min_temp: item.min_temp,
  }))

  // 准备温度区间图表数据
  const tempRangeChartData = tempRangeResult?.yearlyData.map(d => ({
    day: d.day,
    month: d.month,
    avgTemp: d.avgTemp,
    inRange: d.inRange ? d.avgTemp : null,
  })) || []

  // 准备对比图表数据
  const compareChartData = []
  for (let day = 1; day <= 366; day++) {
    const dataPoint: Record<string, number | string> = { day }
    compareResults.forEach(item => {
      const dayData = item.yearlyData.find(d => d.day === day)
      dataPoint[`${item.name}_inRange`] = dayData?.inRange ? (item.minTemp + item.maxTemp) / 2 : null
    })
    compareChartData.push(dataPoint)
  }

  // 年份列表
  const years = []
  for (let y = 2024; y >= 1940; y--) {
    years.push(y.toString())
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 头部 */}
      <header className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-800">
            🌤️ 北京历史温度数据分析与预测系统
          </h1>
          <p className="text-gray-600 mt-2">
            基于1940-2026年共{summary?.total_days?.toLocaleString()}天的历史天气数据 | 
            新增：温度区间查询、衣服温度问答、对比模式
          </p>
        </div>
      </header>

      {/* 导航标签 */}
      <nav className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-4 overflow-x-auto">
            {[
              { key: 'overview', label: '📊 数据概览' },
              { key: 'charts', label: '📈 温度图表' },
              { key: 'predict', label: '🔮 温度预测' },
              { key: 'temprange', label: '🌡️ 温度区间' },
              { key: 'clothing', label: '👕 衣服问答' },
              { key: 'compare', label: '📊 对比模式' },
              { key: 'history', label: '📋 历史数据' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`py-4 px-3 border-b-2 font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 数据概览 */}
        {activeTab === 'overview' && summary && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="text-4xl mb-2">📅</div>
                <div className="text-3xl font-bold text-blue-600">{summary.total_days.toLocaleString()}</div>
                <div className="text-gray-500">总数据天数</div>
              </div>
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="text-4xl mb-2">📆</div>
                <div className="text-3xl font-bold text-green-600">{summary.years}</div>
                <div className="text-gray-500">数据年份</div>
              </div>
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="text-4xl mb-2">🌡️</div>
                <div className="text-3xl font-bold text-red-600">{summary.model_metrics.rmse_max.toFixed(2)}°C</div>
                <div className="text-gray-500">最高温预测误差</div>
              </div>
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="text-4xl mb-2">❄️</div>
                <div className="text-3xl font-bold text-indigo-600">{summary.model_metrics.rmse_min.toFixed(2)}°C</div>
                <div className="text-gray-500">最低温预测误差</div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">🆕 新功能介绍</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-800">🌡️ 温度区间查询</h3>
                  <p className="text-sm text-gray-600 mt-2">输入温度范围，查看北京全年哪些时间段适合该温度</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold text-purple-800">👕 衣服温度问答</h3>
                  <p className="text-sm text-gray-600 mt-2">输入LLM API Key，询问衣服适合的温度，获取可视化结果</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <h3 className="font-semibold text-green-800">📊 对比模式</h3>
                  <p className="text-sm text-gray-600 mt-2">选择多种衣服，可视化对比它们的适用温度范围和时间段</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 温度图表 */}
        {activeTab === 'charts' && (
          <div className="space-y-8">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📊 月度平均温度变化</h2>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis domain={[-15, 40]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="avg_max" stroke="#ef4444" fill="#fecaca" name="平均最高温 (°C)" />
                    <Area type="monotone" dataKey="avg_min" stroke="#3b82f6" fill="#bfdbfe" name="平均最低温 (°C)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📈 年度平均温度变化趋势</h2>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={yearlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" interval={4} />
                    <YAxis domain={[5, 20]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="avg_max" stroke="#ef4444" fill="#fecaca" name="年平均最高温 (°C)" />
                    <Area type="monotone" dataKey="avg_min" stroke="#3b82f6" fill="#bfdbfe" name="年平均最低温 (°C)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* 温度预测 */}
        {activeTab === 'predict' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">🔮 温度预测</h2>
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-gray-700 font-medium mb-2">选择日期</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={predictTemperature}
                  disabled={!selectedDate}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                >
                  预测温度
                </button>
              </div>
            </div>

            {prediction && (
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-6 bg-red-50 rounded-xl">
                    <div className="text-5xl mb-2">🌡️</div>
                    <div className="text-4xl font-bold text-red-600">{prediction.maxTemp}°C</div>
                    <div className="text-gray-600">预测最高温度</div>
                  </div>
                  <div className="text-center p-6 bg-blue-50 rounded-xl">
                    <div className="text-5xl mb-2">❄️</div>
                    <div className="text-4xl font-bold text-blue-600">{prediction.minTemp}°C</div>
                    <div className="text-gray-600">预测最低温度</div>
                  </div>
                  <div className="text-center p-6 bg-gray-50 rounded-xl">
                    <div className="text-5xl mb-2">📅</div>
                    <div className="text-2xl font-bold text-gray-800">{selectedDate}</div>
                    <div className="text-gray-600">一年中第 {prediction.dayOfYear} 天</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 温度区间查询 */}
        {activeTab === 'temprange' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">🌡️ 温度区间查询</h2>
              <p className="text-gray-600 mb-4">输入温度范围，查看北京全年哪些时间段适合该温度</p>
              
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-gray-700 font-medium mb-2">最低温度 (°C)</label>
                  <input
                    type="number"
                    value={tempRangeMin}
                    onChange={(e) => setTempRangeMin(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-gray-700 font-medium mb-2">最高温度 (°C)</label>
                  <input
                    type="number"
                    value={tempRangeMax}
                    onChange={(e) => setTempRangeMax(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={queryTempRange}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  查询时间段
                </button>
              </div>

              <div className="mt-4">
                <label className="block text-gray-700 font-medium mb-2">快速选择</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '寒冷 (-10~0°C)', min: -10, max: 0 },
                    { label: '凉爽 (10~20°C)', min: 10, max: 20 },
                    { label: '舒适 (18~25°C)', min: 18, max: 25 },
                    { label: '温暖 (20~28°C)', min: 20, max: 28 },
                    { label: '炎热 (30~38°C)', min: 30, max: 38 },
                  ].map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => { setTempRangeMin(preset.min); setTempRangeMax(preset.max); }}
                      className="px-3 py-1 bg-gray-100 rounded-full text-sm hover:bg-gray-200"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {tempRangeResult && (
              <>
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">📅 适合的时间段</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tempRangeResult.periods.map((period, index) => (
                      <div key={index} className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="font-semibold text-green-800">
                          {period.startMonth} → {period.endMonth}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          第 {period.startDay} 天 ~ 第 {period.endDay} 天
                        </div>
                        <div className="text-sm text-gray-500">
                          约 {period.endDay - period.startDay + 1} 天
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <span className="font-semibold">总计适合天数：</span>
                    <span className="text-blue-600 font-bold">{tempRangeResult.totalDays} 天</span>
                    <span className="text-gray-500 ml-2">（占全年 {Math.round(tempRangeResult.totalDays / 366 * 100)}%）</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-md p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">📈 全年温度可视化</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={tempRangeChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" interval={30} />
                        <YAxis domain={[-15, 40]} />
                        <Tooltip />
                        <Area type="monotone" dataKey="avgTemp" stroke="#94a3b8" fill="#e2e8f0" name="平均温度" />
                        <Area type="monotone" dataKey="inRange" stroke="#22c55e" fill="#bbf7d0" name="适合温度" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* 衣服温度问答 */}
        {activeTab === 'clothing' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">👕 衣服温度问答</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">LLM 提供商</label>
                  <select
                    value={llmProvider}
                    onChange={(e) => setLlmProvider(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="deepseek">DeepSeek (默认)</option>
                    <option value="openai">OpenAI</option>
                    <option value="moonshot">Moonshot (月之暗面)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="输入您的 API Key"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">询问衣服适合的温度</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={clothingQuestion}
                    onChange={(e) => setClothingQuestion(e.target.value)}
                    placeholder="例如：羽绒服适合什么温度穿？"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={queryLLM}
                    disabled={!apiKey || !clothingQuestion || llmLoading}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300"
                  >
                    {llmLoading ? '查询中...' : '询问'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">快速选择</label>
                <div className="flex flex-wrap gap-2">
                  {['羽绒服适合什么温度穿？', 'T恤适合什么温度穿？', '卫衣适合什么温度穿？', '毛衣适合什么温度穿？'].map(q => (
                    <button
                      key={q}
                      onClick={() => setClothingQuestion(q)}
                      className="px-3 py-1 bg-gray-100 rounded-full text-sm hover:bg-gray-200"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {clothingResponse && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">🤖 AI 回答</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-gray-700">{clothingResponse.clothing}</h4>
                      <p className="text-gray-600 mt-2">{clothingResponse.description}</p>
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {clothingResponse.min_temp}°C ~ {clothingResponse.max_temp}°C
                        </div>
                        <div className="text-gray-500">适合温度范围</div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">穿搭建议</h4>
                      <ul className="space-y-1">
                        {clothingResponse.tips?.map((tip, i) => (
                          <li key={i} className="text-gray-600 text-sm">• {tip}</li>
                        ))}
                      </ul>
                      <h4 className="font-semibold text-gray-700 mt-4 mb-2">适合场合</h4>
                      <div className="flex flex-wrap gap-2">
                        {clothingResponse.suitable_occasions?.map((occ, i) => (
                          <span key={i} className="px-2 py-1 bg-gray-100 rounded text-sm">{occ}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {clothingResponse.periods && clothingResponse.periods.length > 0 && (
                  <div className="bg-white rounded-xl shadow-md p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">📅 适合穿着的时间段</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {clothingResponse.periods.map((period, index) => (
                        <div key={index} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                          <div className="font-semibold text-purple-800">
                            {period.startMonth} → {period.endMonth}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            第 {period.startDay} 天 ~ 第 {period.endDay} 天
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => addCompareItem({
                        name: clothingResponse.clothing,
                        min_temp: clothingResponse.min_temp,
                        max_temp: clothingResponse.max_temp,
                      })}
                      className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      ➕ 添加到对比模式
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 对比模式 */}
        {activeTab === 'compare' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📊 对比模式</h2>
              <p className="text-gray-600 mb-4">选择多种衣服，可视化对比它们的适用温度范围和时间段</p>

              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">快速添加预设衣服</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_CLOTHES.map(item => (
                    <button
                      key={item.name}
                      onClick={() => addCompareItem(item)}
                      disabled={!!compareItems.find(i => i.name === item.name)}
                      className="px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      style={{ 
                        backgroundColor: compareItems.find(i => i.name === item.name) ? '#e5e7eb' : `${item.color}20`,
                        color: item.color,
                        border: `2px solid ${item.color}`
                      }}
                    >
                      {item.name} ({item.min_temp}°C ~ {item.max_temp}°C)
                    </button>
                  ))}
                </div>
              </div>

              {compareItems.length > 0 && (
                <div className="mb-4">
                  <label className="block text-gray-700 font-medium mb-2">已选择 ({compareItems.length})</label>
                  <div className="flex flex-wrap gap-2">
                    {compareItems.map(item => (
                      <div
                        key={item.name}
                        className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                        style={{ backgroundColor: `${item.color}20`, color: item.color }}
                      >
                        {item.name}
                        <button onClick={() => removeCompareItem(item.name)} className="ml-1 hover:opacity-70">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={executeCompare}
                disabled={compareItems.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                开始对比
              </button>
            </div>

            {compareMode && compareResults.length > 0 && (
              <>
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">📅 适用时间段对比</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-4">衣服</th>
                          <th className="text-left py-2 px-4">温度范围</th>
                          <th className="text-left py-2 px-4">适合天数</th>
                          <th className="text-left py-2 px-4">时间段</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compareResults.map(item => (
                          <tr key={item.name} className="border-b">
                            <td className="py-2 px-4">
                              <span className="font-medium" style={{ color: item.color }}>{item.name}</span>
                            </td>
                            <td className="py-2 px-4">{item.minTemp}°C ~ {item.maxTemp}°C</td>
                            <td className="py-2 px-4">{item.totalDays} 天</td>
                            <td className="py-2 px-4">
                              {item.periods.map((p, i) => (
                                <span key={i} className="text-sm">
                                  {p.startMonth}~{p.endMonth}{i < item.periods.length - 1 ? ', ' : ''}
                                </span>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-md p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">📈 全年适用时间可视化</h3>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={compareChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" interval={30} />
                        <YAxis domain={[-25, 45]} />
                        <Tooltip />
                        <Legend />
                        {compareResults.map(item => (
                          <Area
                            key={item.name}
                            type="monotone"
                            dataKey={`${item.name}_inRange`}
                            stroke={item.color}
                            fill={`${item.color}40`}
                            name={item.name}
                          />
                        ))}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-md p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">🌡️ 温度范围对比</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={compareResults.map(item => ({
                          name: item.name,
                          min: item.minTemp,
                          max: item.maxTemp,
                          range: item.maxTemp - item.minTemp,
                          color: item.color,
                        }))}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[-30, 45]} />
                        <YAxis dataKey="name" type="category" width={80} />
                        <Tooltip />
                        <Bar dataKey="min" stackId="temp" fill="transparent" />
                        <Bar dataKey="range" stackId="temp" radius={[4, 4, 4, 4]}>
                          {compareResults.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* 历史数据 */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">📋 历史数据查询</h2>
                <div className="flex items-center gap-4">
                  <label className="text-gray-700">选择年份:</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    {years.map(year => (
                      <option key={year} value={year}>{year}年</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="h-80 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" interval={30} />
                    <YAxis domain={[-20, 45]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="max_temp" stroke="#ef4444" fill="#fecaca" name="最高温度" />
                    <Area type="monotone" dataKey="min_temp" stroke="#3b82f6" fill="#bfdbfe" name="最低温度" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">日期</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">最高温度</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">最低温度</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">温差</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {historyData.slice(0, 30).map((item, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">{item.max_temp}°C</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">{item.min_temp}°C</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{(item.max_temp - item.min_temp).toFixed(1)}°C</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t mt-8">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-500">
          <p>数据来源: Open-Meteo Historical Weather API | 预测模型: 傅里叶级数拟合</p>
        </div>
      </footer>
    </div>
  )
}
