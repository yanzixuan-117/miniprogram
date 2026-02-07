// pages/booking/select-time.js
var util = require('../../utils/util.js')

Page({
  data: {
    coachId: '',
    coachInfo: null,
    date: '',
    dateText: '',

    // 时间段列表（动态生成）
    timeSlots: [],

    loading: false,

    // 是否所有时段都不可用（用于显示空状态）
    allUnavailable: false
  },

  // 计算安全的头像URL
  getSafeAvatarUrl: function(url) {
    if (!url || !url.trim()) {
      return ''
    }
    // 如果是云存储URL，返回空字符串
    if (url.indexOf('cloud://') !== -1) {
      return ''
    }
    return url
  },

  onLoad: function(options) {
    var coachId = options.coachId
    var date = options.date
    if (coachId && date) {
      this.setData({
        coachId: coachId,
        date: date
      })
      this.generateTimeSlots() // 动态生成时间段
      this.loadCoachInfo()
      this.formatDateText(date)
    } else {
      util.showError('参数错误')
      wx.navigateBack()
    }
  },

  // 动态生成时间段（基于所有球馆的营业时间范围）
  generateTimeSlots: function() {
    var self = this

    // 获取所有球馆的营业时间
    var db = wx.cloud.database()
    db.collection('venues')
      .where({
        status: 1
      })
      .field({
        operatingHours: true
      })
      .get()
      .then(function(venuesRes) {
        // 计算所有球馆的最早开门时间和最晚关门时间
        var minOpenHour = 8  // 默认早上8点
        var maxCloseHour = 22 // 默认晚上10点

        if (venuesRes.data && venuesRes.data.length > 0) {
          var openHours = []
          var closeHours = []

          venuesRes.data.forEach(function(venue) {
            if (venue.operatingHours && venue.operatingHours.open && venue.operatingHours.close) {
              openHours.push(parseInt(venue.operatingHours.open.split(':')[0]))
              closeHours.push(parseInt(venue.operatingHours.close.split(':')[0]))
            }
          })

          if (openHours.length > 0) {
            minOpenHour = Math.min.apply(Math, openHours)
          }
          if (closeHours.length > 0) {
            maxCloseHour = Math.max.apply(Math, closeHours)
          }
        }

        // 生成时间段（从 minOpenHour 到 maxCloseHour-1）
        var timeSlots = []
        for (var hour = minOpenHour; hour < maxCloseHour; hour++) {
          var timeStr = (hour < 10 ? '0' + hour : hour) + ':00'
          var endTimeStr = ((hour + 1) < 10 ? '0' + (hour + 1) : (hour + 1)) + ':00'
          timeSlots.push({
            time: timeStr,
            endTime: endTimeStr,
            available: true
          })
        }

        self.setData({ timeSlots: timeSlots })
      })
      .catch(function(err) {
        // 失败时使用默认时间段 8:00-22:00
        var defaultSlots = []
        for (var hour = 8; hour < 22; hour++) {
          var timeStr = (hour < 10 ? '0' + hour : hour) + ':00'
          var endTimeStr = ((hour + 1) < 10 ? '0' + (hour + 1) : (hour + 1)) + ':00'
          defaultSlots.push({
            time: timeStr,
            endTime: endTimeStr,
            available: true
          })
        }
        self.setData({ timeSlots: defaultSlots })
      })
  },

  // 加载教练信息
  loadCoachInfo: function() {
    var self = this
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
          : ''

        self.setData({
          coachInfo: coachInfo
        })

        // 根据教练时间设置过滤可用时段
        self.filterTimeSlotsBySchedule()
        self.checkBookedSlots()
      } else {
        var message = res.result && res.result.message ? res.result.message : '加载失败'
        util.showError(message)
      }
    }).catch(function(err) {
      util.showError('加载失败')
    }).then(function() {
      util.hideLoading()
    })
  },

  // 格式化日期文本
  formatDateText: function(dateStr) {
    var date = new Date(dateStr)
    this.setData({
      dateText: util.formatDateCN(date)
    })
  },

  // 根据教练时间设置过滤可用时段
  filterTimeSlotsBySchedule: function() {
    var self = this
    var coachInfo = self.data.coachInfo
    var date = self.data.date
    var timeSlots = self.data.timeSlots

    // 如果教练没有设置时间表，使用所有时段（默认行为）
    if (!coachInfo || !coachInfo.schedule) {
      // 即使教练未设置时间表，也需要过滤今天的过期时段
      self.filterTodaySlots()
      return
    }

    var schedule = coachInfo.schedule
    var dateObj = new Date(date)
    var dayOfWeek = dateObj.getDay() // 0-6, 0是周日

    // 星期映射
    var DAY_MAP = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday'
    }

    var dayKey = DAY_MAP[dayOfWeek]
    var availableHours = schedule.weeklySlots && schedule.weeklySlots[dayKey] ? schedule.weeklySlots[dayKey] : []

    // 检查是否是特殊不可预约日期
    var isUnavailableDate = false
    if (schedule.unavailableDates) {
      for (var i = 0; i < schedule.unavailableDates.length; i++) {
        if (schedule.unavailableDates[i].date === date) {
          isUnavailableDate = true
          break
        }
      }
    }

    if (isUnavailableDate) {
      // 将所有时段设为不可用
      var filteredSlots1 = timeSlots.map(function(slot) {
        var newSlot = {}
        for (var key in slot) {
          if (slot.hasOwnProperty(key)) {
            newSlot[key] = slot[key]
          }
        }
        newSlot.available = false
        return newSlot
      })
      self.setData({ timeSlots: filteredSlots1, allUnavailable: true })
      // 即使是特殊日期，也要过滤今天的过期时段（虽然都不可用了）
      self.filterTodaySlots()
      return
    }

    // 如果该天没有设置可用时段（休息日），将所有时段设为不可用
    if (availableHours.length === 0) {
      var filteredSlots2 = timeSlots.map(function(slot) {
        var newSlot = {}
        for (var key in slot) {
          if (slot.hasOwnProperty(key)) {
            newSlot[key] = slot[key]
          }
        }
        newSlot.available = false
        return newSlot
      })
      self.setData({ timeSlots: filteredSlots2, allUnavailable: true })
      // 即使是休息日，也要过滤今天的过期时段（虽然都不可用了）
      self.filterTodaySlots()
      return
    }

    // 过滤出教练设置的可用时段
    var filteredSlots3 = timeSlots.map(function(slot) {
      var hour = parseInt(slot.time.split(':')[0])
      var isAvailable = false
      for (var i = 0; i < availableHours.length; i++) {
        if (availableHours[i] === hour) {
          isAvailable = true
          break
        }
      }
      var newSlot = {}
      for (var key in slot) {
        if (slot.hasOwnProperty(key)) {
          newSlot[key] = slot[key]
        }
      }
      newSlot.available = isAvailable
      return newSlot
    })

    self.setData({ timeSlots: filteredSlots3 })

    // 过滤今天的过期时段
    self.filterTodaySlots()
  },

  // 检查已被预约的时间段（包括待审核和已确认状态，以及固定预约）
  checkBookedSlots: function() {
    var self = this

    // 查询当天该教练的预约记录（pending和confirmed状态都会占用时间）
    var db = wx.cloud.database()
    var _ = db.command

    // 计算选定日期是星期几
    var dateObj = new Date(self.data.date)
    var weekday = dateObj.getDay() // 0-6, 0是周日

    // 并发查询：普通预约 + 固定预约
    Promise.all([
      // 查询普通预约
      db.collection('bookings')
        .where({
          coachId: self.data.coachId,
          date: self.data.date,
          status: _.in(['pending', 'confirmed'])
        })
        .get(),

      // 查询固定预约
      db.collection('fixedBookings')
        .where({
          coachId: self.data.coachId,
          weekday: weekday,
          status: 1
        })
        .get()
    ])
    .then(function(results) {
      var bookingRes = results[0]
      var fixedRes = results[1]

      // 收集已占用的时间段
      var bookedTimes = (bookingRes.data || []).map(function(b) { return b.startTime })

      // 检查固定预约的有效期并添加已占用时间
      var targetDate = new Date(self.data.date)
      var fixedBookedTimes = (fixedRes.data || [])
        .filter(function(fb) {
          // 检查有效期
          if (fb.validUntil) {
            var validUntil = new Date(fb.validUntil)
            if (targetDate > validUntil) {
              return false // 已过期
            }
          }
          return true
        })
        .map(function(fb) { return fb.startTime })

      // 合并已占用时间段
      var allBookedTimes = bookedTimes.concat(fixedBookedTimes)

      // 更新时间段可用状态：只有在教练设置可用 AND 未被预约时才可用
      var timeSlots = self.data.timeSlots.map(function(slot) {
        var isBooked = false
        for (var i = 0; i < allBookedTimes.length; i++) {
          if (allBookedTimes[i] === slot.time) {
            isBooked = true
            break
          }
        }
        var newSlot = {}
        for (var key in slot) {
          if (slot.hasOwnProperty(key)) {
            newSlot[key] = slot[key]
          }
        }
        newSlot.available = slot.available && !isBooked  // 保留教练的设置，再检查是否已预约
        return newSlot
      })

      self.setData({ timeSlots: timeSlots })

      // 过滤今天的时间段（只能预约当前时间1小时后）
      self.filterTodaySlots()
    })
    .catch(function(err) {
      console.error('检查已预约时间段失败:', err)
      // 忽略错误，使用原有时间段
    })
  },

  // 过滤今天的时间段（只能预约当前时间1小时后）
  filterTodaySlots: function() {
    var self = this
    var date = self.data.date
    var timeSlots = self.data.timeSlots

    // 判断选择的日期是否是今天
    var selectedDate = new Date(date)
    var today = new Date()

    // 重置时间为0点进行比较
    selectedDate.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)

    // 如果不是今天，直接返回
    if (selectedDate.getTime() !== today.getTime()) {
      // 计算是否所有时段都不可用
      var allUnavailable1 = timeSlots.length > 0 && timeSlots.every(function(slot) { return !slot.available })
      self.setData({ allUnavailable: allUnavailable1 })
      return
    }

    // 获取当前时间
    var now = new Date()
    var currentHour = now.getHours()
    var currentMinute = now.getMinutes()

    // 计算最小可预约时间（当前时间+1小时）
    var minBookingHour = currentHour + 1

    // 过滤出符合条件的时段
    var filteredSlots = timeSlots.map(function(slot) {
      var slotHour = parseInt(slot.time.split(':')[0])
      var isAvailable = slot.available && slotHour >= minBookingHour

      var newSlot = {}
      for (var key in slot) {
        if (slot.hasOwnProperty(key)) {
          newSlot[key] = slot[key]
        }
      }
      newSlot.available = isAvailable
      return newSlot
    })

    // 计算是否所有时段都不可用
    var allUnavailable2 = filteredSlots.length > 0 && filteredSlots.every(function(slot) { return !slot.available })

    self.setData({ timeSlots: filteredSlots, allUnavailable: allUnavailable2 })
  },

  // 选择时间段
  selectTimeSlot: function(e) {
    var index = e.currentTarget.dataset.index
    var slot = this.data.timeSlots[index]

    if (!slot.available) {
      util.showToast('该时段已被预约')
      return
    }

    // 跳转到确认预约页面
    wx.navigateTo({
      url: '/pages/booking/confirm?coachId=' + this.data.coachId + '&date=' + this.data.date + '&time=' + slot.time + '&endTime=' + slot.endTime
    })
  },

  // 返回上一页
  goBack: function() {
    wx.navigateBack()
  }
})
