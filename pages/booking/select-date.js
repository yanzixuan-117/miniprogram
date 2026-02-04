// pages/booking/select-date.js
var util = require('../../utils/util.js')

Page({
  data: {
    coachId: '',
    coachInfo: null,

    // 当前显示的月份
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,

    // 日历数据
    calendarDays: [],

    // 选中的日期
    selectedDate: '',
    selectedDateText: '',
    selectedTimestamp: 0,

    // 今天
    todayTimestamp: new Date().setHours(0, 0, 0, 0),

    // 日期范围（未来7天）
    minTimestamp: 0,
    maxTimestamp: 0,

    loading: false
  },

  // 计算安全的头像URL
  getSafeAvatarUrl: function(url) {
    if (!url || !url.trim()) {
      return '/images/avatar.png'
    }
    // 如果是云存储URL，返回默认图片
    if (url.indexOf('cloud://') !== -1) {
      return '/images/avatar.png'
    }
    return url
  },

  onLoad: function(options) {
    var coachId = options.coachId

    if (coachId) {
      this.setData({ coachId: coachId })
      this.initDateRange()
      this.loadCoachInfo()
      this.generateCalendar()
    } else {
      util.showError('教练ID不存在')
      wx.navigateBack()
    }
  },

  // 初始化日期范围
  initDateRange: function() {
    var today = new Date()
    today.setHours(0, 0, 0, 0)

    var maxDate = new Date(today)
    maxDate.setDate(today.getDate() + 7)
    maxDate.setHours(23, 59, 59, 999)

    // 从今天开始可预约（今天只能预约当前时间1小时后的时段）
    var minDate = new Date(today)
    minDate.setHours(0, 0, 0, 0)

    this.setData({
      minTimestamp: minDate.getTime(),
      maxTimestamp: maxDate.getTime()
    })
  },

  // 加载教练信息
  loadCoachInfo: function() {
    var self = this
    self.setData({ loading: true })
    util.showLoading()

    wx.cloud.callFunction({
      name: 'getCoachInfo',
      data: {
        coachId: self.data.coachId
      }
    }).then(function(res) {
      if (res.result && res.result.success && res.result.data) {
        var coachData = res.result.data

        // 云函数已经在服务端处理好了头像URL，直接使用
        var coachInfo = {}
        var key = null

        // 手动复制对象
        for (key in coachData) {
          if (coachData.hasOwnProperty(key)) {
            coachInfo[key] = coachData[key]
          }
        }

        // 如果云函数返回的仍是 cloud://，则使用默认图片
        coachInfo.avatarUrl = (coachData.avatarUrl && coachData.avatarUrl.indexOf('cloud://') !== 0)
          ? coachData.avatarUrl
          : '/images/avatar.png'

        self.setData({ coachInfo: coachInfo })
      } else {
        var message = res.result && res.result.message ? res.result.message : '加载失败'
        util.showError(message)
      }
    }).catch(function(err) {
      util.showError('加载失败')
    }).then(function() {
      self.setData({ loading: false })
      util.hideLoading()
    })
  },

  // 生成日历
  generateCalendar: function() {
    var currentYear = this.data.currentYear
    var currentMonth = this.data.currentMonth
    var minTimestamp = this.data.minTimestamp
    var maxTimestamp = this.data.maxTimestamp
    var todayTimestamp = this.data.todayTimestamp
    var selectedTimestamp = this.data.selectedTimestamp

    // 获取当月第一天和最后一天
    var firstDay = new Date(currentYear, currentMonth - 1, 1)
    var lastDay = new Date(currentYear, currentMonth, 0)

    // 获取第一天是星期几（0-6）
    var firstDayWeek = firstDay.getDay()

    // 计算需要显示的天数（包括前后月份的填充）
    var days = []

    // 前月份的填充
    var prevMonthLastDay = new Date(currentYear, currentMonth - 1, 0)
    for (var i = firstDayWeek - 1; i >= 0; i--) {
      var day = prevMonthLastDay.getDate() - i
      var date = new Date(currentYear, currentMonth - 2, day)
      days.push({
        day: day,
        timestamp: date.getTime(),
        isOtherMonth: true,
        isUnavailable: true,
        isSelected: false,
        isToday: false
      })
    }

    // 当月的天数
    for (var i = 1; i <= lastDay.getDate(); i++) {
      var date = new Date(currentYear, currentMonth - 1, i)
      var timestamp = date.setHours(0, 0, 0, 0)
      var dayOfWeek = date.getDay()
      var isSunday = dayOfWeek === 0

      // 判断是否可用
      var isUnavailable = timestamp < minTimestamp ||
                           timestamp > maxTimestamp ||
                           isSunday

      days.push({
        day: i,
        timestamp: timestamp,
        isOtherMonth: false,
        isUnavailable: isUnavailable,
        isSelected: timestamp === selectedTimestamp,
        isToday: timestamp === todayTimestamp
      })
    }

    // 下月份的填充（补齐到35或42天）
    var remainingDays = days.length % 7 === 0 ? 0 : 7 - (days.length % 7)
    for (var i = 1; i <= remainingDays; i++) {
      var date = new Date(currentYear, currentMonth, i)
      days.push({
        day: i,
        timestamp: date.getTime(),
        isOtherMonth: true,
        isUnavailable: true,
        isSelected: false,
        isToday: false
      })
    }

    this.setData({ calendarDays: days })
  },

  // 选择日期
  selectDate: function(e) {
    var timestamp = e.currentTarget.dataset.timestamp
    var date = new Date(timestamp)
    var dayOfWeek = date.getDay()

    // 检查是否可用
    if (timestamp < this.data.minTimestamp ||
        timestamp > this.data.maxTimestamp ||
        dayOfWeek === 0) {
      util.showToast('该日期不可预约')
      return
    }

    // 格式化日期
    var dateStr = util.formatDate(date)
    var dateText = util.formatDateCN(date)

    this.setData({
      selectedDate: dateStr,
      selectedDateText: dateText,
      selectedTimestamp: timestamp
    })

    // 重新生成日历以更新选中状态
    this.generateCalendar()
  },

  // 上一月
  prevMonth: function() {
    var currentYear = this.data.currentYear
    var currentMonth = this.data.currentMonth
    currentMonth--
    if (currentMonth < 1) {
      currentMonth = 12
      currentYear--
    }
    this.setData({ currentYear: currentYear, currentMonth: currentMonth })
    this.generateCalendar()
  },

  // 下一月
  nextMonth: function() {
    var currentYear = this.data.currentYear
    var currentMonth = this.data.currentMonth
    currentMonth++
    if (currentMonth > 12) {
      currentMonth = 1
      currentYear++
    }
    this.setData({ currentYear: currentYear, currentMonth: currentMonth })
    this.generateCalendar()
  },

  // 前往时间选择页面
  goToTimeSelect: function() {
    if (!this.data.selectedDate) {
      util.showToast('请选择预约日期')
      return
    }

    wx.navigateTo({
      url: '/pages/booking/select-time?coachId=' + this.data.coachId + '&date=' + this.data.selectedDate
    })
  },

  // 返回上一页
  goBack: function() {
    wx.navigateBack()
  }
})
