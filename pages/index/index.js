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
    pendingBookings: [], // 待审核的预约
    confirmedBookings: [], // 待上课的课程（已确认）
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

      // 对于游客角色，不使用 currentRole（可能是之前切换留下的）
      // 对于其他角色（admin/coach/student），使用 currentRole
      var actualRole = userInfo.role
      var displayRole = actualRole

      // 只有管理员或教练才能使用 currentRole 切换功能
      if (actualRole !== 'guest' && userInfo.currentRole) {
        displayRole = userInfo.currentRole
      }

      this.setData({
        hasLogin: true,
        userRole: actualRole,
        displayRole: displayRole,
        userInfo: userInfo
      })

      this.loadData()
    } else {
      // storage 没有数据，使用 globalData 的值
      var actualRole = app.globalData.userRole
      var displayRole = actualRole

      // 只有管理员或教练才能使用 currentRole 切换功能
      if (actualRole !== 'guest' && app.globalData.displayRole) {
        displayRole = app.globalData.displayRole
      }

      this.setData({
        hasLogin: app.globalData.hasLogin,
        userRole: actualRole,
        displayRole: displayRole,
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
    var actualRole = this.data.userRole

    // 游客、学员都加载学员数据
    if (displayRole === 'student' || actualRole === 'guest') {
      await this.loadStudentData()
    } else if (displayRole === 'coach' || displayRole === 'admin') {
      await this.loadCoachData()
    }
  },

  // 加载学员数据
  loadStudentData: async function() {
    util.showLoading()

    try {
      // 清除图片URL缓存，确保强制转换云存储URL
      util.clearCloudURLCache()

      var openid = getApp().globalData.userInfo._openid
      var today = new Date()
      var todayStr = util.formatDate(today)

      // 加载所有未来的预约（待审核和已确认）
      var db = wx.cloud.database()
      var _ = db.command

      // 1. 加载临时预约
      var bookingsRes = await db.collection('bookings')
        .where({
          studentId: openid,
          date: _.gte(todayStr),
          status: _.in(['pending', 'confirmed'])
        })
        .orderBy('date', 'asc')
        .orderBy('startTime', 'asc')
        .get()

      var allBookings = bookingsRes.data || []

      // 2. 加载固定预约
      var fixedBookingsRes = await db.collection('fixedBookings')
        .where({
          _openid: openid,  // 固定预约使用 _openid 字段
          status: 1
        })
        .get()

      var fixedBookings = fixedBookingsRes.data || []

      // 3. 将固定预约转换为未来的具体预约（未来30天）
      var fixedBookingItems = this.convertFixedBookings(fixedBookings, today)

      // 4. 合并临时预约和固定预约
      var allBookingsCombined = this.mergeAndSortBookings(allBookings, fixedBookingItems)

      // 计算统计数据
      var totalBookings = allBookings.length
      var completedBookingsRes = await db.collection('bookings')
        .where({
          studentId: openid,
          status: 'completed'
        })
        .get()
      var completedBookings = completedBookingsRes.data || []
      var totalHours = completedBookings.length

      // 格式化预约数据（异步）
      var formattedBookings = await this.formatBookings(allBookingsCombined)

      // 分离待审核和待上课的预约
      var pendingBookings = formattedBookings.filter(function(b) {
        return b.status === 'pending'
      })
      // 待上课只显示今天的课程
      var confirmedBookings = formattedBookings.filter(function(b) {
        return b.status === 'confirmed' && b.date === todayStr
      })

      // 加载推荐教练
      var coachesRes = await wx.cloud.callFunction({
        name: 'getCoaches',
        data: { status: 1 }
      })
      var recommendedCoaches = coachesRes.result.success ? (coachesRes.result.data || []).slice(0, 5) : []

      // 批量转换教练头像云存储URL为临时URL
      // util.processListCloudURLs 会直接修改原字段
      recommendedCoaches = await util.processListCloudURLs(recommendedCoaches, ['cloudAvatarUrl'], '', true)
      // 调试日志
      console.log('教练头像转换结果:', recommendedCoaches.map(function(c) {
        return { name: c.name, cloudAvatarUrl: c.cloudAvatarUrl ? c.cloudAvatarUrl.substring(0, 50) + '...' : '' }
      }))

      // 加载热门视频
      var videosRes = await util.getList('videos', { status: 1 }, 6)

      // 批量转换视频封面云存储URL为临时URL
      var videos = videosRes.data || []
      // 默认图片改为空字符串，避免加载不存在的默认图片
      videos = await util.processListCloudURLs(videos, ['thumbnail'], '', true)

      // 格式化视频数据
      var formattedVideos = this.formatVideos(videos)

      this.setData({
        studentStats: {
          bookings: totalBookings,
          hours: totalHours,
          rating: 0 // 评分暂时为0，后续可从评价系统计算
        },
        pendingBookings: pendingBookings,
        confirmedBookings: confirmedBookings,
        recommendedCoaches: recommendedCoaches,
        hotVideos: formattedVideos
      })
        console.log('学员数据加载完成',recommendedCoaches)
    } catch (err) {
      console.error('加载学员数据失败:', err)
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
      var _ = db.command

      var coachRes = await db.collection('coaches')
        .where({ _openid: openid })
        .get()

      if (!coachRes.data || coachRes.data.length === 0) {
        util.showError('教练信息不存在')
        util.hideLoading()
        return
      }

      var coachId = coachRes.data[0]._id
      var todayWeekday = today.getDay()

      // 1. 加载临时预约和固定预约生成的课程
      var bookingsRes = await db.collection('bookings')
        .where({
          coachId: coachId,
          date: _.gte(todayStr),
          status: _.in(['pending', 'confirmed'])
        })
        .orderBy('date', 'asc')
        .orderBy('startTime', 'asc')
        .get()

      var allBookings = bookingsRes.data || []

      // 2. 加载固定预约模板（仅用于今天）
      // 如果 autoCreateBookings 云函数还没生成今天的课程，从模板中补充
      var fixedBookingsRes = await db.collection('fixedBookings')
        .where({
          coachId: coachId,
          weekday: todayWeekday,
          status: 1
        })
        .get()

      var fixedBookings = fixedBookingsRes.data || []

      // 3. 将今天的固定预约转换为课程记录
      var todayFixedBookings = fixedBookings.map(function(fb) {
        return {
          _id: 'fixed_' + fb._id + '_' + todayStr,
          isFixed: true,
          fixedBookingId: fb._id,
          date: todayStr,
          startTime: fb.startTime,
          endTime: fb.endTime,
          coachId: fb.coachId,
          venueId: fb.venueId,
          studentId: fb._openid,
          students: fb.students || [],
          status: 'confirmed',
          source: 'fixed'
        }
      })

      // 4. 合并：只添加不重复的固定预约（bookings中可能已有）
      var existingFixedIds = allBookings
        .filter(function(b) { return b.source === 'fixed' && b.fixedBookingId })
        .map(function(b) { return b.fixedBookingId })

      var additionalFixedBookings = todayFixedBookings.filter(function(fb) {
        return existingFixedIds.indexOf(fb.fixedBookingId) === -1
      })

      var allBookingsCombined = allBookings.concat(additionalFixedBookings)

      // 按日期和时间排序
      allBookingsCombined.sort(function(a, b) {
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date)
        }
        return a.startTime.localeCompare(b.startTime)
      })

      // 格式化数据并获取学员信息
      var formattedBookings = await this.formatCoachBookings(allBookingsCombined)

      // 分离待审核和待上课的预约
      var pendingBookings = formattedBookings.filter(function(b) {
        return b.status === 'pending'
      })
      // 待上课只显示今天的课程
      var confirmedBookings = formattedBookings.filter(function(b) {
        return b.status === 'confirmed' && b.date === todayStr
      })

      // 获取统计信息
      var uniqueStudents = new Set()
      allBookingsCombined.forEach(booking => {
        uniqueStudents.add(booking.studentId)
      })

      this.setData({
        pendingBookings: pendingBookings,
        confirmedBookings: confirmedBookings,
        todayBookings: [],
        coachStats: {
          pendingCount: pendingBookings.length,
          todayCount: allBookingsCombined.filter(b => b.date === todayStr && b.status === 'confirmed').length,
          totalStudents: uniqueStudents.size
        }
      })
    } catch (err) {
      console.error('加载教练数据失败:', err)
      util.showError('加载数据失败')
    } finally {
      util.hideLoading()
    }
  },

  // 将固定预约转换为具体的预约项（未来30天）
  convertFixedBookings: function(fixedBookings, today) {
    var result = []

    // 生成未来30天的日期
    for (var i = 0; i < 30; i++) {
      var date = new Date(today)
      date.setDate(today.getDate() + i)
      var dateStr = this.formatDateStr(date)
      var weekday = date.getDay()

      // 查找该星期几的固定预约
      for (var j = 0; j < fixedBookings.length; j++) {
        var fb = fixedBookings[j]

        // 检查有效期
        if (fb.validUntil) {
          var validUntil = new Date(fb.validUntil)
          if (date > validUntil) {
            continue // 已过期
          }
        }

        // 检查星期几是否匹配
        if (fb.weekday === weekday) {
          result.push({
            _id: 'fixed_' + fb._id + '_' + dateStr,
            isFixed: true,
            fixedBookingId: fb._id,
            date: dateStr,
            startTime: fb.startTime,
            endTime: fb.endTime,
            coachId: fb.coachId,
            coachName: '教练', // 稍后在 formatCoachBookings 中填充
            venueId: fb.venueId,
            venue: '', // 稍后填充
            studentId: fb._openid,
            studentName: '学员', // 稍后在 formatCoachBookings 中填充
            students: fb.students || [],
            status: 'confirmed', // 固定预约默认为已确认状态
            weekday: weekday
          })
        }
      }
    }

    return result
  },

  // 合并并排序预约（按日期和开始时间）
  mergeAndSortBookings: function(bookings, fixedBookingItems) {
    var merged = bookings.concat(fixedBookingItems)

    // 按日期和开始时间排序
    merged.sort(function(a, b) {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date)
      }
      return a.startTime.localeCompare(b.startTime)
    })

    return merged
  },

  // 格式化日期字符串
  formatDateStr: function(date) {
    var year = date.getFullYear()
    var month = String(date.getMonth() + 1).padStart(2, '0')
    var day = String(date.getDate()).padStart(2, '0')
    return year + '-' + month + '-' + day
  },

  // 格式化预约数据（学员端）
  formatBookings: async function(bookings) {
    if (!bookings || bookings.length === 0) return []

    var weekdays = ['日', '一', '二', '三', '四', '五', '六']
    var db = wx.cloud.database()
    var _ = db.command

    // 收集所有唯一的教练ID和球馆ID
    var coachIds = []
    var venueIds = []
    for (var i = 0; i < bookings.length; i++) {
      if (bookings[i].coachId && coachIds.indexOf(bookings[i].coachId) === -1) {
        coachIds.push(bookings[i].coachId)
      }
      if (bookings[i].venueId && venueIds.indexOf(bookings[i].venueId) === -1) {
        venueIds.push(bookings[i].venueId)
      }
    }

    // 批量查询教练信息
    var coachMap = {}
    if (coachIds.length > 0) {
      try {
        var coachesRes = await db.collection('coaches')
          .where({ _id: _.in(coachIds) })
          .field({ _id: true, name: true })
          .get()

        for (var i = 0; i < (coachesRes.data || []).length; i++) {
          var coach = coachesRes.data[i]
          coachMap[coach._id] = coach
        }
      } catch (err) {
        console.error('查询教练信息失败:', err)
      }
    }

    // 批量查询球馆信息
    var venueMap = {}
    if (venueIds.length > 0) {
      try {
        var venuesRes = await db.collection('venues')
          .where({ _id: _.in(venueIds) })
          .field({ _id: true, name: true })
          .get()

        for (var i = 0; i < (venuesRes.data || []).length; i++) {
          var venue = venuesRes.data[i]
          venueMap[venue._id] = venue
        }
      } catch (err) {
        console.error('查询球馆信息失败:', err)
      }
    }

    // 格式化预约数据
    var result = []
    for (var i = 0; i < bookings.length; i++) {
      var item = bookings[i]
      var date = new Date(item.date)

      // 获取教练名称
      var coachInfo = coachMap[item.coachId]
      var coachName = (coachInfo && coachInfo.name) ? coachInfo.name : '教练'

      // 获取球馆名称
      var venueInfo = venueMap[item.venueId]
      var venueName = (venueInfo && venueInfo.name) ? venueInfo.name : ''

      var formattedItem = {}
      for (var key in item) {
        formattedItem[key] = item[key]
      }
      formattedItem.dateText = {
        day: date.getDate(),
        month: date.getMonth() + 1,
        weekday: weekdays[date.getDay()]
      }
      formattedItem.coachName = coachName
      formattedItem.venue = venueName
      formattedItem.statusText = util.getBookingStatusText(item.status)

      result.push(formattedItem)
    }
    return result
  },

  // 格式化预约数据（教练端）
  formatCoachBookings: async function(bookings) {
    if (!bookings || bookings.length === 0) return []

    var weekdays = ['日', '一', '二', '三', '四', '五', '六']
    var db = wx.cloud.database()
    var _ = db.command

    // 收集所有唯一的学员ID和球馆ID
    var studentIds = []
    var venueIds = []
    for (var i = 0; i < bookings.length; i++) {
      if (bookings[i].studentId && studentIds.indexOf(bookings[i].studentId) === -1) {
        studentIds.push(bookings[i].studentId)
      }
      if (bookings[i].venueId && venueIds.indexOf(bookings[i].venueId) === -1) {
        venueIds.push(bookings[i].venueId)
      }
    }

    // 批量查询所有学员信息
    var userMap = {}
    if (studentIds.length > 0) {
      try {
        var usersRes = await db.collection('users')
          .where({ _openid: _.in(studentIds) })
          .field({ _openid: true, nickname: true })
          .get()

        for (var i = 0; i < (usersRes.data || []).length; i++) {
          var user = usersRes.data[i]
          userMap[user._openid] = user
        }
      } catch (err) {
        console.error('查询学员信息失败:', err)
      }
    }

    // 批量查询所有球馆信息
    var venueMap = {}
    if (venueIds.length > 0) {
      try {
        var venuesRes = await db.collection('venues')
          .where({ _id: _.in(venueIds) })
          .field({ _id: true, name: true })
          .get()

        for (var i = 0; i < (venuesRes.data || []).length; i++) {
          var venue = venuesRes.data[i]
          venueMap[venue._id] = venue
        }
      } catch (err) {
        console.error('查询球馆信息失败:', err)
      }
    }

    // 格式化预约数据
    var result = []
    for (var i = 0; i < bookings.length; i++) {
      var item = bookings[i]
      var date = new Date(item.date)

      // 获取学员信息 - 优先使用 students 数组中的第一个姓名
      var studentInfo = userMap[item.studentId]
      var studentName = (studentInfo && studentInfo.nickname) ? studentInfo.nickname : '学员'

      // 如果 users 集合中没有找到，尝试从 students 数组获取姓名
      if ((!studentInfo || !studentInfo.nickname) && item.students && item.students.length > 0) {
        studentName = item.students[0].name || '学员'
      }

      // 获取球馆信息
      var venueInfo = venueMap[item.venueId]
      var venueName = (venueInfo && venueInfo.name) ? venueInfo.name : ''

      // 获取上课人列表
      var students = item.students || []

      var formattedItem = {}
      for (var key in item) {
        formattedItem[key] = item[key]
      }
      formattedItem.dateText = {
        day: date.getDate(),
        month: date.getMonth() + 1,
        weekday: weekdays[date.getDay()]
      }
      formattedItem.studentName = studentName
      formattedItem.venue = venueName
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

  // 检查游客权限限制
  checkGuestRestriction: function() {
    if (this.data.userRole === 'guest') {
      wx.showModal({
        title: '提示',
        content: '您当前是游客身份，无法使用此功能。请联系管理员添加为学员。',
        showCancel: false
      })
      return true
    }
    return false
  },

  // 学员端：跳转到预约页面
  goToBooking: function() {
    // 检查是否是游客
    if (this.checkGuestRestriction()) {
      return
    }

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
    // 检查是否是游客
    if (this.checkGuestRestriction()) {
      return
    }

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
    // 检查是否是游客
    if (this.checkGuestRestriction()) {
      return
    }

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
      url: '/pages/admin/coach-manage'
    })
  },

  // 管理员：跳转到球馆管理
  goToVenueManage: function() {
    wx.navigateTo({
      url: '/pages/admin/venue-manage'
    })
  },

  // 管理员：跳转到学员管理
  goToStudentManage: function() {
    wx.navigateTo({
      url: '/pages/admin/student-manage'
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
      url: '/pages/session/detail?id=' + id
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

  // 图片加载失败处理 - 备用方案（正常情况下预转换已处理）
  onImageError: function (e) {
    var self = this
    var index = e.currentTarget.dataset.index
    var cloudUrl = e.currentTarget.dataset.cloudurl

    // 尝试重新获取临时URL
    if (cloudUrl) {
      util.processCloudImageURL(cloudUrl, '', false).then(function(tempUrl) {
        var recommendedCoaches = self.data.recommendedCoaches
        recommendedCoaches[index].cloudAvatarUrl = tempUrl
        self.setData({ recommendedCoaches: recommendedCoaches })
      }).catch(function() {
        // 失败则使用默认头像
        var recommendedCoaches = self.data.recommendedCoaches
        recommendedCoaches[index].cloudAvatarUrl = ''
        self.setData({ recommendedCoaches: recommendedCoaches })
      })
    }
  }
})
