// pages/index/index.js
var util = require('../../utils/util.js')

Page({
  data: {
    hasLogin: false,
    userRole: null,
    displayRole: null, // 当前显示的角色（管理员可切换）
    userInfo: null,

    // 学员数据
    studentStats: {
      bookings: 0,
      hours: 0,
      rating: 0
    },
    pendingBookings: [],
    recommendedCoaches: [],
    hotVideos: [],

    // 教练数据
    coachStats: {
      pendingCount: 0,
      todayCount: 0,
      totalStudents: 0
    },
    todayBookings: []
  },

  onLoad: function() {
    this.checkLoginStatus()
  },

  onShow: function() {
    // 每次显示时都检查登录状态
    this.checkLoginStatus()

    // 刷新用户头像（确保临时URL有效）
    this.refreshUserInfo()
  },

  // 刷新用户信息（主要是头像）
  refreshUserInfo: async function() {
    var app = getApp()
    var userInfo = app.globalData.userInfo

    if (!userInfo || !app.globalData.hasLogin) {
      return
    }

    // 从 storage 读取最新的 userInfo
    var storageUserInfo = wx.getStorageSync('userInfo')
    if (storageUserInfo && storageUserInfo.avatarUrl) {
      // 检查是否需要刷新头像
      var cloudUrl = storageUserInfo.cloudAvatarUrl

      // 如果没有cloudAvatarUrl，检查avatarUrl是否是云存储URL或临时URL
      if (!cloudUrl) {
        if (storageUserInfo.avatarUrl.startsWith('cloud://')) {
          // avatarUrl是云存储URL，保存为cloudAvatarUrl
          cloudUrl = storageUserInfo.avatarUrl
        } else if (storageUserInfo.avatarUrl.indexOf('?sign=') !== -1) {
          // avatarUrl是临时URL（已过期），需要从数据库重新获取
          // 调用云函数获取最新用户信息
          try {
            var res = await wx.cloud.callFunction({
              name: 'getUserInfo',
              data: { openId: storageUserInfo._openid }
            })

            if (res.result && res.result.success && res.result.data) {
              var newUserInfo = res.result.data
              // 更新本地存储
              app.globalData.userInfo = newUserInfo
              wx.setStorageSync('userInfo', newUserInfo)

              // 重新设置页面数据
              this.setData({
                userInfo: newUserInfo,
                hasLogin: true,
                userRole: newUserInfo.role,
                displayRole: newUserInfo.currentRole || newUserInfo.role
              })
            }
          } catch (err) {
            // 忽略错误
          }
          return
        }
      }

      if (cloudUrl && cloudUrl.startsWith('cloud://')) {
        try {
          // 使用统一的工具函数处理云存储URL
          var processedUrl = await util.processCloudImageURL(cloudUrl)

          // 更新临时URL和cloudAvatarUrl
          storageUserInfo.avatarUrl = processedUrl
          storageUserInfo.cloudAvatarUrl = cloudUrl
          app.globalData.userInfo = storageUserInfo
          wx.setStorageSync('userInfo', storageUserInfo)

          // 重新设置页面数据
          this.setData({
            userInfo: storageUserInfo,
            hasLogin: true,
            userRole: storageUserInfo.role,
            displayRole: storageUserInfo.currentRole || storageUserInfo.role
          })
        } catch (err) {
          // 忽略错误
        }
      }
    }
  },

  // 检查登录状态
  checkLoginStatus: function() {
    var app = getApp()

    // 优先从 storage 读取，确保数据最新
    var userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      // 如果 storage 有数据，更新 app.globalData
      app.setUserInfo(userInfo)

      this.setData({
        hasLogin: true,
        userRole: userInfo.role,
        displayRole: userInfo.currentRole || userInfo.role,
        userInfo: userInfo
      })

      this.loadData()
    } else {
      // storage 没有数据，使用 globalData 的值
      this.setData({
        hasLogin: app.globalData.hasLogin,
        userRole: app.globalData.userRole,
        displayRole: app.globalData.displayRole || app.globalData.userRole,
        userInfo: app.globalData.userInfo
      })

      if (app.globalData.hasLogin) {
        this.loadData()
      }
    }
  },

  // 加载数据
  loadData: async function() {
    // 使用 displayRole 来判断显示哪个视图
    var displayRole = this.data.displayRole || this.data.userRole

    if (displayRole === 'student') {
      await this.loadStudentData()
    } else if (displayRole === 'coach' || displayRole === 'admin') {
      await this.loadCoachData()
    }
  },

  // 加载学员数据
  loadStudentData: async function() {
    util.showLoading()

    try {
      var openid = getApp().globalData.userInfo._openid

      // 加载所有预约（用于统计）
      var allBookingsRes = await util.getList('bookings', {
        studentId: openid
      }, 100)

      // 加载待处理预约
      var pendingBookings = allBookingsRes.data
        ? allBookingsRes.data.filter(item => item.status === 'pending')
        : []

      // 计算统计数据
      var totalBookings = allBookingsRes.data ? allBookingsRes.data.length : 0
      var completedBookings = allBookingsRes.data
        ? allBookingsRes.data.filter(item => item.status === 'completed')
        : []

      // 计算总学习时长（假设每次课程1小时，实际应从sessionRecords计算）
      var totalHours = completedBookings.length

      // 加载推荐教练（使用云函数处理头像）
      var coachesRes = await wx.cloud.callFunction({
        name: 'getCoaches',
        data: { status: 1 }
      })
      var recommendedCoaches = coachesRes.result.success ? (coachesRes.result.data || []).slice(0, 5) : []

      // 加载热门视频
      var videosRes = await util.getList('videos', { status: 1 }, 6)

      // 格式化视频数据
      var formattedVideos = this.formatVideos(videosRes.data || [])

      this.setData({
        studentStats: {
          bookings: totalBookings,
          hours: totalHours,
          rating: 0 // 评分暂时为0，后续可从评价系统计算
        },
        pendingBookings: this.formatBookings(pendingBookings),
        recommendedCoaches: recommendedCoaches,
        hotVideos: formattedVideos
      })
    } catch (err) {
      util.showError('加载数据失败')
    } finally {
      util.hideLoading()
    }
  },

  // 加载教练数据
  loadCoachData: async function() {
    util.showLoading()

    try {
      var openid = getApp().globalData.userInfo._openid
      var today = new Date()
      var todayStr = util.formatDate(today)

      // 先获取教练信息（从 coaches 集合获取 _id）
      var db = wx.cloud.database()
      var coachRes = await db.collection('coaches')
        .where({ _openid: openid })
        .get()

      if (!coachRes.data || coachRes.data.length === 0) {
        util.showError('教练信息不存在')
        util.hideLoading()
        return
      }

      var coachId = coachRes.data[0]._id

      // 加载待审核预约（使用正确的 coachId）
      var pendingRes = await util.getList('bookings', {
        coachId: coachId,
        status: 'pending'
      }, 10)

      // 加载今日已确认的课程（使用正确的 coachId）
      var todayRes = await util.getList('bookings', {
        coachId: coachId,
        status: 'confirmed',
        date: todayStr
      }, 10)

      // 获取统计信息（使用正确的 coachId）
      var allStudents = await db.collection('bookings')
        .where({ coachId: coachId })
        .get()

      var uniqueStudents = new Set()
      allStudents.data.forEach(booking => {
        uniqueStudents.add(booking.studentId)
      })


      // 格式化数据并获取学员信息
      var formattedPending = await this.formatCoachBookings(pendingRes.data || [])
      var formattedToday = await this.formatCoachBookings(todayRes.data || [])

      this.setData({
        pendingBookings: formattedPending,
        todayBookings: formattedToday,
        coachStats: {
          pendingCount: (pendingRes.data && pendingRes.data.length) || 0,
          todayCount: (todayRes.data && todayRes.data.length) || 0,
          totalStudents: uniqueStudents.size
        }
      })
    } catch (err) {
      util.showError('加载数据失败')
    } finally {
      util.hideLoading()
    }
  },

  // 格式化预约数据（学员端）
  formatBookings: function(bookings) {
    return bookings.map(function(item) {
      var date = new Date(item.date)
      var result = {}
      for (var key in item) {
        result[key] = item[key]
      }
      result.dateText = {
        day: date.getDate(),
        month: date.getMonth() + 1
      }
      result.statusText = util.getBookingStatusText(item.status)
      return result
    })
  },

  // 格式化预约数据（教练端）
  formatCoachBookings: async function(bookings) {
    if (!bookings || bookings.length === 0) return []

    var db = wx.cloud.database()
    var _ = db.command

    // 收集所有唯一的学员ID
    var ids = []
    for (var i = 0; i < bookings.length; i++) {
      if (bookings[i].studentId) {
        ids.push(bookings[i].studentId)
      }
    }
    var studentIds = []
    for (i = 0; i < ids.length; i++) {
      var found = false
      for (var j = 0; j < studentIds.length; j++) {
        if (studentIds[j] === ids[i]) {
          found = true
          break
        }
      }
      if (!found) {
        studentIds.push(ids[i])
      }
    }

    // 批量查询所有学员信息（一次查询替代N次查询）
    var userMap = {}
    if (studentIds.length > 0) {
      try {
        var usersRes = await db.collection('users')
          .where({ _openid: _.in(studentIds) })
          .field({ _openid: true, nickname: true })
          .get()

        // 建立openid到用户信息的映射
        for (var i = 0; i < (usersRes.data || []).length; i++) {
          var user = usersRes.data[i]
          userMap[user._openid] = user
        }
      } catch (err) {
      }
    }

    // 格式化预约数据
    var result = []
    for (var i = 0; i < bookings.length; i++) {
      var item = bookings[i]
      var date = new Date(item.date)

      // 从映射中获取学员信息
      var studentInfo = userMap[item.studentId]
      var studentName = (studentInfo && studentInfo.nickname) ? studentInfo.nickname : '学员'

      // 获取上课人列表
      var students = item.students || []

      var formattedItem = {}
      for (var key in item) {
        formattedItem[key] = item[key]
      }
      formattedItem.dateText = {
        day: date.getDate(),
        month: date.getMonth() + 1
      }
      formattedItem.studentName = studentName
      formattedItem.students = students
      formattedItem.statusText = util.getBookingStatusText(item.status)

      result.push(formattedItem)
    }
    return result
  },

  // 格式化视频数据
  formatVideos: function(videos) {
    var self = this
    return videos.map(function(video) {
      var result = {}
      for (var key in video) {
        result[key] = video[key]
      }
      result.durationText = self.formatDuration(video.duration || 0)
      return result
    })
  },

  // 格式化视频时长
  formatDuration: function(seconds) {
    return util.formatDuration(seconds)
  },

  // 跳转到登录页
  goToLogin: function() {
    wx.navigateTo({
      url: '/pages/login/login'
    })
  },

  // 学员端：跳转到预约页面
  goToBooking: function() {
    wx.navigateTo({
      url: '/pages/booking/coach-list'
    })
  },

  // 学员端：查看教练列表
  goToCoaches: function() {
    wx.navigateTo({
      url: '/pages/coaches/list'
    })
  },

  // 学员端：查看教学视频
  goToVideos: function() {
    wx.switchTab({
      url: '/pages/video/list'
    })
  },

  // 学员端：查看我的课程记录
  goToMyRecords: function() {
    wx.navigateTo({
      url: '/pages/session/list'
    })
  },

  // 学员端：查看我的预约
  goToMyBookings: function() {
    wx.switchTab({
      url: '/pages/booking/my-bookings'
    })
  },

  // 学员端：查看教练详情
  viewCoachDetail: function(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/coaches/detail?id=' + id
    })
  },

  // 学员端：查看预约详情
  viewBookingDetail: function(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/booking/detail?id=' + id
    })
  },

  // 学员端：观看视频
  watchVideo: function(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/video/detail?id=' + id
    })
  },

  // 教练端：跳转到预约管理
  goToBookingManage: function() {
    wx.navigateTo({
      url: '/pages/booking/manage'
    })
  },

  // 教练端：跳转到课程记录历史
  goToSessionHistory: function() {
    wx.navigateTo({
      url: '/pages/session/history'
    })
  },

  // 教练端：跳转到上传视频
  goToVideoUpload: function() {
    wx.navigateTo({
      url: '/pages/video/upload'
    })
  },

  // 教练端：跳转到时间设置
  goToSchedule: function() {
    wx.navigateTo({
      url: '/pages/coaches/schedule/schedule'
    })
  },

  // 管理员：跳转到教练管理
  goToCoachManage: function() {
    wx.navigateTo({
      url: '/pages/admin/coach-manage/coach-manage/coach-manage'
    })
  },

  // 管理员：跳转到球馆管理
  goToVenueManage: function() {
    wx.navigateTo({
      url: '/pages/admin/venue-manage/venue-manage/venue-manage'
    })
  },

  // 管理员：跳转到角色切换
  goToRoleSwitch: function() {
    wx.navigateTo({
      url: '/pages/admin/role-switch/role-switch'
    })
  },

  // 教练端：处理预约
  handleBooking: function(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/booking/detail?id=' + id
    })
  },

  // 教练端：同意预约
  approveBooking: async function(e) {
    var id = e.currentTarget.dataset.id

    var confirm = await util.showConfirm('确认同意该预约？')
    if (!confirm) return

    util.showLoading('处理中...')

    try {
      await wx.cloud.callFunction({
        name: 'booking',
        data: {
          action: 'confirm',
          bookingId: id
        }
      })

      util.showSuccess('已同意')
      this.loadCoachData()
    } catch (err) {
      util.showError('操作失败，请重试')
    } finally {
      util.hideLoading()
    }
  },

  // 教练端：拒绝预约
  rejectBooking: async function(e) {
    var id = e.currentTarget.dataset.id

    var reason = await this.promptRejectReason()
    if (!reason) return

    util.showLoading('处理中...')

    try {
      await wx.cloud.callFunction({
        name: 'booking',
        data: {
          action: 'reject',
          bookingId: id,
          reason
        }
      })

      util.showSuccess('已拒绝')
      this.loadCoachData()
    } catch (err) {
      util.showError('操作失败，请重试')
    } finally {
      util.hideLoading()
    }
  },

  // 教练端：输入拒绝原因
  promptRejectReason: function() {
    return new Promise(function(resolve) {
      wx.showModal({
        title: '拒绝原因',
        editable: true,
        placeholderText: '请输入拒绝原因（可选）',
        success: function(res) {
          if (res.confirm) {
            resolve(res.content || '时间冲突')
          } else {
            resolve(null)
          }
        }
      })
    })
  },

  // 教练端：创建课程记录
  createSessionRecord: function(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/session/create?bookingId=' + id
    })
  },

  onPullDownRefresh: function() {
    this.loadData()
    setTimeout(function() {
      wx.stopPullDownRefresh()
    }, 1000)
  },

  // 图片加载失败处理 - 尝试重新获取临时URL
  onImageError: function(e) {
    var self = this
    var index = e.currentTarget.dataset.index
    var cloudUrl = e.currentTarget.dataset.cloudurl
    var type = e.currentTarget.dataset.type

    if (type === 'coach') {
      // 如果有云存储URL，尝试重新获取临时URL
      if (cloudUrl && cloudUrl.startsWith('cloud://')) {
        wx.cloud.getTempFileURL({
          fileList: [cloudUrl]
        }).then(function(res) {
          if (res.fileList && res.fileList[0] && res.fileList[0].status === 0) {
            var tempUrl = res.fileList[0].tempFileURL
            var recommendedCoaches = self.data.recommendedCoaches
            recommendedCoaches[index].avatarUrl = tempUrl
            self.setData({ recommendedCoaches: recommendedCoaches })
          } else {
            // 获取失败，使用默认头像
            var recommendedCoaches = self.data.recommendedCoaches
            recommendedCoaches[index].avatarUrl = '/images/avatar.png'
            self.setData({ recommendedCoaches: recommendedCoaches })
          }
        }).catch(function(err) {
          console.error('重新获取临时URL失败:', err)
          // 失败时使用默认头像
          var recommendedCoaches = self.data.recommendedCoaches
          recommendedCoaches[index].avatarUrl = '/images/avatar.png'
          self.setData({ recommendedCoaches: recommendedCoaches })
        })
      } else {
        // 没有云存储URL，直接使用默认头像
        var recommendedCoaches = self.data.recommendedCoaches
        recommendedCoaches[index].avatarUrl = '/images/avatar.png'
        this.setData({ recommendedCoaches: recommendedCoaches })
      }
    }
  }
})
