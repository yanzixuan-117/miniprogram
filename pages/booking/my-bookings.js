// pages/booking/my-bookings.js
var util = require('../../utils/util.js')

Page({
  data: {
    bookingList: [],
    activeStatus: '',
    loading: false,
    userRole: ''
  },

  onLoad: function() {
    var app = getApp()
    var userInfo = wx.getStorageSync('userInfo') || app.globalData.userInfo
    var userRole = userInfo && (userInfo.currentRole || userInfo.role) || app.globalData.userRole

    this.setData({ userRole: userRole })
    this.loadBookings()
  },

  onShow: function() {
    // 每次显示时刷新列表
    if (this.data.bookingList.length > 0) {
      this.loadBookings()
    }
  },

  // 加载预约列表（仅学员视角）
  loadBookings: async function() {
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      var app = getApp()
      var userInfo = wx.getStorageSync('userInfo') || app.globalData.userInfo

      if (!userInfo || !userInfo._openid) {
        wx.navigateTo({
          url: '/pages/login/login'
        })
        return
      }

      var openid = userInfo._openid

      // 学员查看自己的预约
      var where = {
        studentId: openid
      }

      if (this.data.activeStatus) {
        where.status = this.data.activeStatus
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
        // 使用工具函数格式化日期
        var dateText = util.formatDateText(item.date)

        // 获取教练信息
        var coachName = '教练'
        var coachAvatar = '/images/avatar.png'

        try {
          var coachRes = await wx.cloud.callFunction({
            name: 'getCoachInfo',
            data: {
              coachId: item.coachId
            }
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
        // 直接使用工具函数返回的dateText对象
        result.dateText = dateText
        result.coachName = coachName
        result.coachAvatar = coachAvatar
        result.displayAvatar = coachAvatar
        result.displayRole = 'student'
        result.statusText = util.getBookingStatusText(item.status)
        result.canCancel = self.canCancelBooking(item)

        return result
      }))

      this.setData({ bookingList: bookingList })
    } catch (err) {
      util.showError('加载失败，请重试')
    } finally {
      this.setData({ loading: false })
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

    // 待审核状态可以随时取消
    if (booking.status === 'pending') return true

    // 已确认状态，需要提前12小时以上才能取消
    if (booking.status === 'confirmed' && hoursDiff >= 12) return true

    return false
  },

  // 选择状态
  selectStatus: function(e) {
    var status = e.currentTarget.dataset.status
    this.setData({
      activeStatus: status,
      bookingList: []
    })
    this.loadBookings()
  },

  // 查看详情
  viewDetail: function(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/session/detail?id=' + id
    })
  },

  // 取消预约
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
        this.loadBookings()
      } else {
        util.showError(res.result.message || '取消失败')
      }
    } catch (err) {
      util.showError('操作失败，请重试')
    } finally {
      util.hideLoading()
    }
  },

  // 去预约
  goToBooking: function() {
    wx.navigateTo({
      url: '/pages/booking/coach-list'
    })
  },

  onPullDownRefresh: function() {
    this.loadBookings()
    setTimeout(function() {
      wx.stopPullDownRefresh()
    }, 1000)
  }
})
