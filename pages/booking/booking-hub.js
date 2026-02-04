// pages/booking/booking-hub.js
var util = require('../../utils/util.js')

Page({
  data: {
    userRole: '',
    currentView: '', // 'student' 或 'coach'

    // 学员数据
    studentBookings: [],
    studentActiveStatus: '',
    studentLoading: false,

    // 教练数据
    coachBookings: [],
    coachActiveStatus: '',
    coachLoading: false
  },

  onLoad: function() {
    this.initPage()
  },

  onShow: function() {
    // 每次显示时重新检查角色（支持角色切换）
    var app = getApp()
    var userInfo = wx.getStorageSync('userInfo') || app.globalData.userInfo
    var newUserRole = userInfo && (userInfo.currentRole || userInfo.role) || app.globalData.userRole

    if (newUserRole !== this.data.userRole) {
      // 角色发生变化，重新初始化
      this.setData({ userRole: '' })
      this.initPage()
    } else {
      // 角色没变，刷新数据
      if (this.data.currentView === 'student') {
        this.loadStudentBookings()
      } else if (this.data.currentView === 'coach') {
        this.loadCoachBookings()
      }
    }
  },

  // 初始化页面
  initPage: async function() {
    var app = getApp()
    var userInfo = wx.getStorageSync('userInfo') || app.globalData.userInfo
    var userRole = userInfo && (userInfo.currentRole || userInfo.role) || app.globalData.userRole

    if (!userInfo || !userInfo._openid) {
      wx.navigateTo({
        url: '/pages/login/login'
      })
      return
    }

    this.setData({ userRole: userRole })

    // 根据角色显示不同的视图
    if (userRole === 'student') {
      this.setData({ currentView: 'student' })
      await this.loadStudentBookings()
    } else if (userRole === 'coach' || userRole === 'admin') {
      this.setData({ currentView: 'coach' })
      await this.loadCoachBookings()
    }
  },

  // 加载学员预约数据
  loadStudentBookings: async function() {
    if (this.data.studentLoading) return

    this.setData({ studentLoading: true })

    try {
      var openid = getApp().globalData.userInfo._openid
      var where = { studentId: openid }

      if (this.data.studentActiveStatus) {
        where.status = this.data.studentActiveStatus
      }

      var res = await util.getList('bookings', where, 50)
      var bookingList = res.data || []

      // 按创建时间倒序排列
      bookingList.sort(function(a, b) {
        return new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
      })

      // 格式化数据
      var self = this
      bookingList = await Promise.all(bookingList.map(async function(item) {
        var date = new Date(item.date)
        var dateText = util.formatDateCN(date)
        var dayOfWeek = date.getDay()
        var weekday = ['日', '一', '二', '三', '四', '五', '六'][dayOfWeek]

        // 获取教练信息
        var coachName = '教练'
        var coachAvatar = '/images/avatar.png'

        try {
          var coachRes = await wx.cloud.callFunction({
            name: 'getCoachInfo',
            data: { coachId: item.coachId }
          })

          if (coachRes.result && coachRes.result.success && coachRes.result.data) {
            var coachData = coachRes.result.data
            coachName = coachData.name
            coachAvatar = (coachData.avatarUrl && coachData.avatarUrl.indexOf('cloud://') !== 0)
              ? coachData.avatarUrl
              : '/images/avatar.png'
          }
        } catch (err) {
        }

        // 手动复制对象
        var result = {}
        for (var key in item) {
          result[key] = item[key]
        }
        result.dateText = {
          full: dateText,
          day: date.getDate(),
          month: date.getMonth() + 1,
          weekday: weekday
        }
        result.coachName = coachName
        result.coachAvatar = coachAvatar
        result.statusText = util.getBookingStatusText(item.status)
        result.canCancel = self.canCancelBooking(item)

        return result
      }))

      this.setData({ studentBookings: bookingList })
    } catch (err) {
      util.showError('加载失败，请重试')
    } finally {
      this.setData({ studentLoading: false })
    }
  },

  // 加载教练预约数据
  loadCoachBookings: async function() {
    if (this.data.coachLoading) return

    this.setData({ coachLoading: true })

    try {
      var openid = getApp().globalData.userInfo._openid
      var db = wx.cloud.database()

      // 先获取教练信息
      var coachRes = await db.collection('coaches')
        .where({ _openid: openid })
        .get()

      if (!coachRes.data || coachRes.data.length === 0) {
        this.setData({ coachLoading: false })
        return
      }

      var coachId = coachRes.data[0]._id
      var where = { coachId: coachId }

      if (this.data.coachActiveStatus) {
        where.status = this.data.coachActiveStatus
      }

      var res = await util.getList('bookings', where, 50)
      var bookingList = res.data || []

      // 按创建时间倒序排列，待审核的排在前面
      bookingList.sort(function(a, b) {
        if (a.status === 'pending' && b.status !== 'pending') return -1
        if (a.status !== 'pending' && b.status === 'pending') return 1
        return new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
      })

      // 格式化数据
      bookingList = await Promise.all(bookingList.map(async function(item) {
        var date = new Date(item.date)
        var dateText = util.formatDateCN(date)
        var dayOfWeek = date.getDay()
        var weekday = ['日', '一', '二', '三', '四', '五', '六'][dayOfWeek]

        // 获取学员信息
        var studentName = '学员'
        var studentAvatar = '/images/avatar.png'

        try {
          var studentRes = await wx.cloud.callFunction({
            name: 'getUserInfo',
            data: { openId: item.studentId }
          })

          if (studentRes.result && studentRes.result.success && studentRes.result.data) {
            studentName = studentRes.result.data.nickname || '学员'
            if (studentRes.result.data.avatarUrl) {
              studentAvatar = studentRes.result.data.avatarUrl
            }
          }
        } catch (err) {
        }

        var students = item.students || []

        // 手动复制对象
        var result = {}
        for (var key in item) {
          result[key] = item[key]
        }
        result.dateText = {
          full: dateText,
          day: date.getDate(),
          month: date.getMonth() + 1,
          weekday: weekday
        }
        result.studentName = studentName
        result.studentAvatar = studentAvatar
        result.students = students
        result.statusText = util.getBookingStatusText(item.status)
        result.canConfirm = item.status === 'pending'
        result.canReject = item.status === 'pending'
        result.canComplete = item.status === 'confirmed'

        return result
      }))

      this.setData({ coachBookings: bookingList })
    } catch (err) {
      util.showError('加载失败，请重试')
    } finally {
      this.setData({ coachLoading: false })
    }
  },

  // 判断是否可以取消预约
  canCancelBooking: function(booking) {
    var now = new Date()
    var bookingDate = new Date(booking.date)
    var timeParts = booking.startTime.split(':')
    var hours = Number(timeParts[0])
    var minutes = Number(timeParts[1])
    bookingDate.setHours(hours, minutes, 0, 0)

    var timeDiff = bookingDate.getTime() - now.getTime()
    var hoursDiff = timeDiff / (1000 * 60 * 60)

    if (booking.status === 'pending') return true
    if (booking.status === 'confirmed' && hoursDiff >= 12) return true

    return false
  },

  // 学员：选择状态筛选
  selectStudentStatus: function(e) {
    var status = e.currentTarget.dataset.status
    this.setData({
      studentActiveStatus: status,
      studentBookings: []
    })
    this.loadStudentBookings()
  },

  // 教练：选择状态筛选
  selectCoachStatus: function(e) {
    var status = e.currentTarget.dataset.status
    this.setData({
      coachActiveStatus: status,
      coachBookings: []
    })
    this.loadCoachBookings()
  },

  // 学员：取消预约
  cancelBooking: async function(e) {
    var id = e.currentTarget.dataset.id
    var confirm = await util.showConfirm('确定要取消这个预约吗？')
    if (!confirm) return

    util.showLoading('处理中...')

    try {
      var res = await wx.cloud.callFunction({
        name: 'booking',
        data: {
          action: 'cancel',
          bookingId: id
        }
      })

      if (res.result.success) {
        util.showSuccess(res.result.message || '已取消')
        this.loadStudentBookings()
      } else {
        util.showError(res.result.message || '取消失败')
      }
    } catch (err) {
      util.showError('操作失败，请重试')
    } finally {
      util.hideLoading()
    }
  },

  // 教练：确认预约
  confirmBooking: async function(e) {
    var id = e.currentTarget.dataset.id

    var confirm = await util.showConfirm('确认同意该预约？')
    if (!confirm) return

    util.showLoading('处理中...')

    try {
      var res = await wx.cloud.callFunction({
        name: 'booking',
        data: {
          action: 'confirm',
          bookingId: id
        }
      })

      if (res.result.success) {
        util.showSuccess('已同意')
        this.loadCoachBookings()
      } else {
        util.showError(res.result.message || '操作失败')
      }
    } catch (err) {
      util.showError('操作失败，请重试')
    } finally {
      util.hideLoading()
    }
  },

  // 教练：拒绝预约
  rejectBooking: async function(e) {
    var id = e.currentTarget.dataset.id

    var confirm = await util.showConfirm('确认拒绝该预约？')
    if (!confirm) return

    util.showLoading('处理中...')

    try {
      var res = await wx.cloud.callFunction({
        name: 'booking',
        data: {
          action: 'reject',
          bookingId: id,
          reason: '时间冲突'
        }
      })

      if (res.result.success) {
        util.showSuccess('已拒绝')
        this.loadCoachBookings()
      } else {
        util.showError(res.result.message || '操作失败')
      }
    } catch (err) {
      util.showError('操作失败，请重试')
    } finally {
      util.hideLoading()
    }
  },

  // 教练：完成课程
  completeBooking: async function(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/session/create?id=' + id
    })
  },

  // 学员：去预约
  goToBooking: function() {
    wx.navigateTo({
      url: '/pages/booking/coach-list'
    })
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    if (this.data.currentView === 'student') {
      this.loadStudentBookings()
    } else if (this.data.currentView === 'coach') {
      this.loadCoachBookings()
    }
    setTimeout(function() {
      wx.stopPullDownRefresh()
    }, 1000)
  }
})
