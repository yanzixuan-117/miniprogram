// pages/session/detail.js
var util = require('../../utils/util.js')

Page({
  data: {
    sessionId: '',
    session: null,
    loading: true,
    error: ''
  },

  onLoad: function(options) {
    var id = options.id

    if (id) {
      this.setData({ sessionId: id })
      this.loadSessionDetail()
    } else {
      this.setData({
        loading: false,
        error: '缺少课程ID'
      })
    }
  },

  // 加载课程详情
  loadSessionDetail: function() {
    var self = this
    self.setData({ loading: true })

    var db = wx.cloud.database()

    // 查询课程详情
    db.collection('bookings')
      .doc(self.data.sessionId)
      .get()
      .then(function(res) {
        if (!res.data) {
          self.setData({
            loading: false,
            error: '课程不存在'
          })
          return
        }

        var booking = res.data

        // 获取教练信息
        var coachInfo = null
        if (booking.coachId) {
          return wx.cloud.callFunction({
            name: 'getCoachInfo',
            data: { coachId: booking.coachId }
          }).then(function(coachRes) {
            if (coachRes.result && coachRes.result.success && coachRes.result.data) {
              coachInfo = coachRes.result.data
            }

            // 格式化数据
            var session = self.formatSessionData(booking, coachInfo)

            self.setData({
              session: session,
              loading: false
            })
          })
        } else {
          // 格式化数据
          var session = self.formatSessionData(booking, coachInfo)

          self.setData({
            session: session,
            loading: false
          })
        }
      })
      .catch(function(err) {
        self.setData({
          loading: false,
          error: '加载失败，请重试'
        })
      })
  },

  // 格式化课程数据
  formatSessionData: function(booking, coachInfo) {
    // 使用工具函数格式化日期
    var dateText = util.formatDateText(booking.date)

    // 格式化状态文本
    var statusMap = {
      pending: '待审核',
      confirmed: '已确认',
      completed: '已完成',
      cancelled: '已取消'
    }

    // 使用工具函数格式化创建时间
    var createTimeText = util.formatCreateTime(booking.createTime, 'absolute')

    return {
      _id: booking._id,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      venue: booking.venue,
      venueId: booking.venueId,
      studentNote: booking.studentNote,
      coachNote: booking.coachNote,
      feedback: booking.feedback || '',
      photos: booking.photos || [],
      status: booking.status,
      statusText: statusMap[booking.status] || booking.status,
      dateText: dateText,
      createTime: booking.createTime,
      createTimeText: createTimeText,

      // 教练信息
      coachId: booking.coachId,
      coachName: coachInfo && coachInfo.name ? coachInfo.name : '教练',
      coachAvatar: (coachInfo && coachInfo.avatarUrl && coachInfo.avatarUrl.indexOf('cloud://') !== 0)
        ? coachInfo.avatarUrl
        : '/images/avatar.png',
      coachSpecialty: coachInfo && coachInfo.specialty ? coachInfo.specialty : []
    }
  },

  // 取消预约
  cancelSession: function() {
    var self = this
    wx.showModal({
      title: '确认取消',
      content: '确定要取消这次预约吗？',
      confirmText: '确定取消',
      confirmColor: '#ff4d4f',
      success: function(res) {
        if (res.confirm) {
          util.showLoading('处理中...')

          wx.cloud.callFunction({
            name: 'booking',
            data: {
              action: 'cancel',
              bookingId: self.data.sessionId
            }
          }).then(function() {
            util.hideLoading()
            util.showSuccess('已取消预约')

            // 刷新页面
            setTimeout(function() {
              self.loadSessionDetail()
            }, 1500)
          }).catch(function(err) {
            util.hideLoading()
            util.showError('取消失败，请重试')
          })
        }
      }
    })
  },

  // 预览图片
  previewImage: function(e) {
    var url = e.currentTarget.dataset.url
    var urls = e.currentTarget.dataset.urls
    wx.previewImage({
      current: url,
      urls: urls
    })
  },

  // 返回上一页
  goBack: function() {
    wx.navigateBack()
  }
})
