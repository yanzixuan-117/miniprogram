// pages/session/detail.js
var util = require('../../utils/util.js')

Page({
  data: {
    sessionId: '',
    session: null,
    loading: true,
    error: '',

    // 用户角色信息
    userRole: '', // 'student' | 'coach' | 'admin'
    isOwner: false, // 当前用户是否是该预约的相关方（学员或教练）
    canConfirm: false, // 教练是否可以审核
    canComplete: false // 教练是否可以完成课程
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

    // 获取当前用户信息
    var userInfo = wx.getStorageSync('userInfo')
    var app = getApp()
    if (!userInfo && app.globalData.userInfo) {
      userInfo = app.globalData.userInfo
    }

    if (!userInfo || !userInfo._openid) {
      self.setData({
        loading: false,
        error: '请先登录'
      })
      return
    }

    var userRole = userInfo.currentRole || userInfo.role || 'student'
    var userOpenid = userInfo._openid

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

        // 判断用户权限
        var isOwner = false
        var canConfirm = false
        var canComplete = false

        if (userRole === 'coach' || userRole === 'admin') {
          // 教练可以审核自己的课程
          isOwner = true
          canConfirm = booking.status === 'pending'
          canComplete = booking.status === 'confirmed'
        } else if (userRole === 'student') {
          // 学员可以取消自己的预约
          isOwner = booking.studentId === userOpenid
        }

        // 获取教练信息和学员信息
        var coachInfo = null
        var studentInfo = null

        var promises = []

        // 获取教练信息
        if (booking.coachId) {
          promises.push(wx.cloud.callFunction({
            name: 'getCoachInfo',
            data: { coachId: booking.coachId }
          }).then(function(coachRes) {
            if (coachRes.result && coachRes.result.success && coachRes.result.data) {
              coachInfo = coachRes.result.data
            }
          }))
        }

        // 获取学员信息
        if (booking.studentId) {
          promises.push(wx.cloud.callFunction({
            name: 'getUserInfo',
            data: { openId: booking.studentId }
          }).then(function(studentRes) {
            if (studentRes.result && studentRes.result.success && studentRes.result.data) {
              studentInfo = studentRes.result.data
            }
          }))
        }

        Promise.all(promises).then(async function() {
          // 格式化数据
          var session = self.formatSessionData(booking, coachInfo, studentInfo)

          // 预转换课程照片云存储URL为临时URL
          if (session.photos && session.photos.length > 0) {
            session.photos = await util.processCloudImageURLs(session.photos, '', true)
          }

          // 预转换教练和学员头像
          if (coachInfo && coachInfo.cloudAvatarUrl) {
            coachInfo.cloudAvatarUrl = await util.processCloudImageURL(coachInfo.cloudAvatarUrl, '', true)
            session.coachAvatar = coachInfo.cloudAvatarUrl
          }
          if (studentInfo && studentInfo.cloudAvatarUrl) {
            studentInfo.cloudAvatarUrl = await util.processCloudImageURL(studentInfo.cloudAvatarUrl, '', true)
            session.studentAvatar = studentInfo.cloudAvatarUrl
          }

          self.setData({
            session: session,
            userRole: userRole,
            isOwner: isOwner,
            canConfirm: canConfirm,
            canComplete: canComplete,
            loading: false
          })
        })
      })
      .catch(function(err) {
        self.setData({
          loading: false,
          error: '加载失败，请重试'
        })
      })
  },

  // 格式化课程数据
  formatSessionData: function(booking, coachInfo, studentInfo) {
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

    var result = {
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
      coachAvatar: (coachInfo && coachInfo.cloudAvatarUrl) ? coachInfo.cloudAvatarUrl :
        (coachInfo && coachInfo.avatarUrl) ? coachInfo.avatarUrl : '',
      coachSpecialty: coachInfo && coachInfo.specialty ? coachInfo.specialty : [],

      // 学员信息
      studentId: booking.studentId,
      studentName: studentInfo && studentInfo.nickname ? studentInfo.nickname : '学员',
      studentAvatar: (studentInfo && studentInfo.cloudAvatarUrl) ? studentInfo.cloudAvatarUrl :
        (studentInfo && studentInfo.avatarUrl) ? studentInfo.avatarUrl : '',

      // 上课人列表
      students: booking.students || []
    }

    return result
  },

  // 取消预约（学员）
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

  // 教练：同意预约
  confirmBooking: function() {
    var self = this
    wx.showModal({
      title: '确认同意',
      content: '确认接受这个预约吗？',
      success: function(res) {
        if (res.confirm) {
          util.showLoading('处理中...')

          wx.cloud.callFunction({
            name: 'booking',
            data: {
              action: 'confirm',
              bookingId: self.data.sessionId
            }
          }).then(function() {
            util.hideLoading()
            util.showSuccess('已同意预约')

            // 刷新页面
            setTimeout(function() {
              self.loadSessionDetail()
            }, 1500)
          }).catch(function(err) {
            util.hideLoading()
            util.showError('操作失败，请重试')
          })
        }
      }
    })
  },

  // 教练：拒绝预约
  rejectBooking: function() {
    var self = this
    wx.showModal({
      title: '拒绝预约',
      content: '请输入拒绝原因（可选）',
      editable: true,
      placeholderText: '如：时间冲突、临时有事等',
      success: function(res) {
        if (res.confirm) {
          var rejectReason = res.content || ''

          util.showLoading('处理中...')

          wx.cloud.callFunction({
            name: 'booking',
            data: {
              action: 'reject',
              bookingId: self.data.sessionId,
              rejectReason: rejectReason
            }
          }).then(function() {
            util.hideLoading()
            util.showSuccess('已拒绝预约')

            // 返回上一页
            setTimeout(function() {
              wx.navigateBack()
            }, 1500)
          }).catch(function(err) {
            util.hideLoading()
            util.showError('操作失败，请重试')
          })
        }
      }
    })
  },

  // 教练：完成课程
  completeBooking: function() {
    var self = this
    wx.showModal({
      title: '完成课程',
      content: '确认课程已完成吗？',
      success: function(res) {
        if (res.confirm) {
          util.showLoading('处理中...')

          wx.cloud.callFunction({
            name: 'booking',
            data: {
              action: 'complete',
              bookingId: self.data.sessionId
            }
          }).then(function() {
            util.hideLoading()
            util.showSuccess('课程已完成')

            // 刷新页面
            setTimeout(function() {
              self.loadSessionDetail()
            }, 1500)
          }).catch(function(err) {
            util.hideLoading()
            util.showError('操作失败，请重试')
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
