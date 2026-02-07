// pages/booking/select-booking.js
const util = require('../../utils/util.js')

Page({
  data: {
    // 选择的数据
    venueId: '',       // 选中的球馆ID
    coachId: '',       // 选中的教练ID
    date: '',          // 选中的日期
    startTime: '',     // 选中的开始时间
    endTime: '',       // 选中的结束时间

    // 列表数据
    venueList: [],     // 球馆列表
    coachList: [],     // 教练列表
    timeSlots: [],     // 可选时间段

    // 索引
    venueIndex: -1,
    coachIndex: -1,
    timeIndex: -1,

    // 显示文本
    displayVenue: '请选择球馆',
    displayCoach: '请选择教练',
    displayDate: '请选择日期',
    displayTime: '请选择时间',

    // 加载状态
    loading: false,
    loadingSlots: false,
    submitting: false,

    // 日历数据
    calendarDays: [],  // 日历日期数组
    currentMonth: '',  // 当前月份

    // 最小日期（今天）
    minDate: '',
    maxDate: ''        // 最大日期（30天后）
  },

  onLoad() {
    const today = new Date()
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + 30)

    this.setData({
      minDate: this.formatDateStr(today),
      maxDate: this.formatDateStr(maxDate)
    })

    this.loadVenueList()
    this.loadCoachList()
    this.generateCalendar()
  },

  // 格式化日期字符串
  formatDateStr(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 加载球馆列表
  async loadVenueList() {
    try {
      const res = await util.getList('venues', { status: 1 }, 100)
      if (res.data) {
        this.setData({ venueList: res.data })
      }
    } catch (err) {
      console.error('加载球馆列表失败:', err)
    }
  },

  // 加载教练列表
  async loadCoachList() {
    try {
      const res = await util.getList('coaches', { status: 1 }, 100)
      if (res.data) {
        this.setData({ coachList: res.data })
      }
    } catch (err) {
      console.error('加载教练列表失败:', err)
    }
  },

  // 生成日历（未来30天）
  generateCalendar() {
    const days = []
    const today = new Date()
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']

    // 获取今天是星期几（0-6，0是周日）
    const todayWeekday = today.getDay()

    // 添加空白占位符，使第一天对齐到正确的星期列
    // 例如：周三是第4列（索引3），需要添加3个空白格
    for (let i = 0; i < todayWeekday; i++) {
      days.push({
        isEmpty: true
      })
    }

    // 添加30天的日期
    for (let i = 0; i < 30; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)

      const dateStr = this.formatDateStr(date)
      const weekday = date.getDay()
      const dayNum = date.getDate()

      days.push({
        date: dateStr,
        day: dayNum,
        weekday: weekdays[weekday],
        weekdayNum: weekday,
        isToday: i === 0,
        month: date.getMonth() + 1
      })
    }

    // 设置当前月份
    const firstDay = days.find(d => !d.isEmpty)
    if (firstDay) {
      this.setData({
        calendarDays: days,
        currentMonth: `${firstDay.month}月`
      })
    }
  },

  // 选择球馆
  onVenueChange(e) {
    const index = parseInt(e.detail.value)
    const venue = this.data.venueList[index]
    if (venue) {
      this.setData({
        venueId: venue._id,
        venueIndex: index,
        displayVenue: venue.name
      }, () => {
        this.loadAvailableSlots()
      })
    }
  },

  // 选择教练
  onCoachChange(e) {
    const index = parseInt(e.detail.value)
    const coach = this.data.coachList[index]
    if (coach) {
      this.setData({
        coachId: coach._id,
        coachIndex: index,
        displayCoach: coach.name || coach.nickname
      }, () => {
        this.loadAvailableSlots()
      })
    }
  },

  // 选择日期（日历点击）
  onDateSelect(e) {
    const date = e.currentTarget.dataset.date
    const selectedDay = this.data.calendarDays.find(d => d.date === date)

    if (selectedDay) {
      const weekdayText = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][selectedDay.weekdayNum]
      this.setData({
        date: date,
        displayDate: `${selectedDay.month}月${selectedDay.day}日 周${weekdayText}`
      }, () => {
        this.loadAvailableSlots()
      })
    }
  },

  // 选择时间
  onTimeChange(e) {
    const index = parseInt(e.detail.value)
    const slot = this.data.timeSlots[index]

    if (slot && slot.available) {
      this.setData({
        startTime: slot.time,
        endTime: slot.endTime,
        timeIndex: index,
        displayTime: `${slot.time}-${slot.endTime}`
      })
    }
  },

  // 加载可选时间段（根据球馆、教练、日期动态变化）
  async loadAvailableSlots() {
    const { venueId, coachId, date } = this.data

    if (!date) {
      this.setData({ timeSlots: [] })
      return
    }

    this.setData({ loadingSlots: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getAvailableSlots',
        data: {
          venueId: venueId || null,
          coachId: coachId || null,
          date: date
        }
      })

      if (res.result && res.result.success) {
        this.setData({
          timeSlots: res.result.data.slots || []
        })
      } else {
        this.setData({ timeSlots: [] })
      }
    } catch (err) {
      console.error('加载可选时间段失败:', err)
      this.setData({ timeSlots: [] })
    } finally {
      this.setData({ loadingSlots: false })
    }
  },

  // 提交预约
  async submitBooking() {
    const { venueId, coachId, date, startTime, endTime } = this.data

    // 验证
    if (!venueId) {
      util.showToast('请选择球馆')
      return
    }

    if (!coachId) {
      util.showToast('请选择教练')
      return
    }

    if (!date) {
      util.showToast('请选择日期')
      return
    }

    if (!startTime) {
      util.showToast('请选择时间')
      return
    }

    // 获取球馆名称
    const venue = this.data.venueList.find(v => v._id === venueId)
    const venueName = venue ? venue.name : ''

    this.setData({ submitting: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'createBooking',
        data: {
          coachId: coachId,
          date: date,
          startTime: startTime,
          endTime: endTime,
          venue: venueName,
          venueId: venueId
        }
      })

      if (res.result && res.result.success) {
        util.showSuccess('预约申请已提交')

        // 跳转到我的预约页面
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/booking/my-bookings'
          })
        }, 1500)
      } else {
        util.showError(res.result?.message || '预约失败')
      }
    } catch (err) {
      console.error('预约失败:', err)
      util.showError('预约失败')
    } finally {
      this.setData({ submitting: false })
    }
  }
})
