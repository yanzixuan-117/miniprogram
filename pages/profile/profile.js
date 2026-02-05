// pages/profile/profile.js
var util = require('../../utils/util.js')

Page({
  data: {
    hasLogin: false,
    userInfo: null,
    roleText: '',
    isCoach: false,
    isAdmin: false,
    isStudent: false,
    canViewAdmin: false,    // 是否显示管理员功能（当前为管理员模式）
    canViewCoach: false,    // 是否显示教练功能（当前为教练模式）
    canViewStudent: false,  // 是否显示学员功能（当前为学员模式）
    createTimeText: '',
    currentRole: 'admin', // 管理员当前选择的角色
    stats: {
      totalStudents: 0,
      totalSessions: 0,
      rating: 0,
      totalBookings: 0,
      completedSessions: 0,
      favoriteVideos: 0
    }
  },

  onLoad: function() {
    this.loadUserInfo()
  },

  onShow: function() {
    this.loadUserInfo()
    if (this.data.hasLogin) {
      this.loadUserStats()

      // 刷新用户头像（确保临时URL有效）
      this.refreshUserInfo()
    }
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
                userInfo: newUserInfo
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
            userInfo: storageUserInfo
          })

        } catch (err) {
        }
      }
    }
  },

  // 加载用户信息
  loadUserInfo: function() {
    var app = getApp()
    var userInfo = app.globalData.userInfo
    var hasLogin = app.globalData.hasLogin

    if (!hasLogin || !userInfo) {
      this.setData({
        hasLogin: false,
        userInfo: null
      })
      return
    }

    var isAdmin = userInfo.role === 'admin'
    var createTimeText = userInfo.createTime ? util.formatDateCN(new Date(userInfo.createTime)) : '未知'

    // 当前显示角色（管理员可以切换，普通用户使用实际角色）
    var currentRole = isAdmin ? (userInfo.currentRole || 'admin') : userInfo.role

    // 精确的权限分类：根据当前显示角色决定显示哪些功能
    // 管理员：角色切换、教练管理
    // 教练：预约管理
    // 学员：预约课程
    var isCoach = userInfo.role === 'coach'  // 实际角色是否是教练
    var isStudent = userInfo.role === 'student'  // 实际角色是否是学员

    // 基于当前显示角色的功能权限
    var canViewAdmin = isAdmin && currentRole === 'admin'      // 管理员模式：显示管理员功能
    var canViewCoach = currentRole === 'coach'                 // 教练模式：显示教练功能
    var canViewStudent = currentRole === 'student'             // 学员模式：显示学员功能

    this.setData({
      hasLogin: true,
      userInfo: userInfo,
      roleText: util.getRoleText(currentRole),
      isCoach: isCoach,
      isAdmin: isAdmin,
      isStudent: isStudent,
      canViewAdmin: canViewAdmin,
      canViewCoach: canViewCoach,
      canViewStudent: canViewStudent,
      createTimeText: createTimeText,
      currentRole: currentRole
    })

    // 加载统计数据
    this.loadUserStats()
  },

  // 加载用户统计数据
  loadUserStats: async function() {
    var userInfo = this.data.userInfo
    var canViewCoach = this.data.canViewCoach
    var canViewStudent = this.data.canViewStudent

    if (!userInfo) return

    try {
      // 根据当前显示角色加载对应统计数据
      if (canViewCoach) {
        // 教练模式：加载教练统计数据
        try {
          var openid = userInfo._openid
          var coachRes = await util.getList('coaches', { _openid: openid }, 1)

          if (coachRes.data && coachRes.data.length > 0) {
            var coach = coachRes.data[0]
            // 手动合并 stats 对象
            var newStats = {}
            for (var key in this.data.stats) {
              newStats[key] = this.data.stats[key]
            }
            newStats.totalStudents = coach.reviewCount || 0
            newStats.totalSessions = 0
            newStats.rating = coach.rating || 5.0

            this.setData({
              stats: newStats
            })
          }
        } catch (err) {
        }
      } else if (canViewStudent) {
        // 学员模式：加载学员统计数据
        try {
          var openid = userInfo._openid

          // 统计预约数量
          var bookingsRes = await util.getList('bookings', { studentId: openid }, 100)
          var totalBookings = bookingsRes.data ? bookingsRes.data.length : 0
          var completedBookings = []
          if (bookingsRes.data) {
            for (var i = 0; i < bookingsRes.data.length; i++) {
              if (bookingsRes.data[i].status === 'completed') {
                completedBookings.push(bookingsRes.data[i])
              }
            }
          }
          var completedSessions = completedBookings.length

          // 手动合并 stats 对象
          var newStats = {}
          for (var key in this.data.stats) {
            newStats[key] = this.data.stats[key]
          }
          newStats.totalBookings = totalBookings
          newStats.completedSessions = completedSessions
          newStats.favoriteVideos = 0

          this.setData({
            stats: newStats
          })
        } catch (err) {
          // 设置默认值
          var newStats = {}
          for (var key in this.data.stats) {
            newStats[key] = this.data.stats[key]
          }
          newStats.totalBookings = 0
          newStats.completedSessions = 0
          newStats.favoriteVideos = 0

          this.setData({
            stats: newStats
          })
        }
      }
      // 管理员模式不显示统计数据
    } catch (err) {
    }
  },

  // 跳转到登录
  goToLogin: function() {
    wx.navigateTo({
      url: '/pages/login/login'
    })
  },

  // 编辑资料
  editProfile: function() {
    wx.navigateTo({
      url: '/pages/profile/edit'
    })
  },

  // 时间设置
  goToSchedule: function() {
    wx.navigateTo({
      url: '/pages/coaches/schedule'
    })
  },

  // 教练资料
  goToCoachProfile: function() {
    wx.navigateTo({
      url: '/pages/coaches/profile/profile'
    })
  },

  // 视频管理
  goToVideoManage: function() {
    wx.navigateTo({
      url: '/pages/video/manage'
    })
  },

  // 管理员功能
  goToAdminManage: function() {
    wx.navigateTo({
      url: '/pages/admin/manage'
    })
  },

  // 切换角色
  switchRole: function(e) {
    var role = e.currentTarget.dataset.role
    var app = getApp()

    // 如果点击的是当前角色，不处理
    if (this.data.currentRole === role) {
      util.showToast('当前已是该角色')
      return
    }

    // 震动反馈
    wx.vibrateShort()

    if (app.switchAdminRole(role)) {
      // 更新用户信息（app.setUserInfo 会更新 globalData 和 storage）
      var userInfo = app.globalData.userInfo
      userInfo.currentRole = role
      app.setUserInfo(userInfo)

      var roleNames = {
        admin: '管理员',
        coach: '教练',
        student: '学员'
      }

      util.showSuccess('已切换至' + roleNames[role] + '模式')

      // 重新加载用户信息以更新权限标识（canViewAdmin, canViewCoach, canViewStudent）
      this.loadUserInfo()
    } else {
      util.showError('切换失败')
    }
  },

  // 我的预约
  goToMyBookings: function() {
    wx.switchTab({
      url: '/pages/booking/my-bookings'
    })
  },

  // 我的课程记录
  goToMyRecords: function() {
    wx.navigateTo({
      url: '/pages/session/list'
    })
  },

  // 我的收藏
  goToFavorites: function() {
    wx.navigateTo({
      url: '/pages/video/favorites'
    })
  },

  // 教学历史
  goToSessionHistory: function() {
    wx.navigateTo({
      url: '/pages/session/history'
    })
  },

  // 设置
  goToSettings: function() {
    wx.showToast({
      title: '设置功能开发中',
      icon: 'none'
    })
  },

  // 关于我们
  goToAbout: function() {
    wx.showModal({
      title: '关于挥拍GO',
      content: '挥拍GO是一款专业的网球教练教学管理平台\n\n版本：v0.1.0\n\n功能特色：\n- 在线预约课程\n- 课程记录与反馈\n- 教学视频学习',
      showCancel: false
    })
  },

  // 账号注销
  goToAccountDelete: function() {
    wx.navigateTo({
      url: '/pages/account/delete'
    })
  },

  // 退出登录
  handleLogout: async function() {
    var confirm = await util.showConfirm('确定要退出登录吗？')

    if (!confirm) return

    var app = getApp()
    app.clearUserInfo()

    util.showSuccess('已退出登录')

    // 清空数据
    this.setData({
      hasLogin: false,
      userInfo: null,
      roleText: '',
      isCoach: false,
      isStudent: false,
      canViewAdmin: false,
      canViewCoach: false,
      canViewStudent: false,
      stats: {
        totalStudents: 0,
        totalSessions: 0,
        rating: 0,
        totalBookings: 0,
        completedSessions: 0,
        favoriteVideos: 0
      }
    })

    setTimeout(function() {
      wx.reLaunch({
        url: '/pages/index/index'
      })
    }, 1000)
  },

  // 复制 OpenID
  copyOpenId: function() {
    var openid = this.data.userInfo && this.data.userInfo._openid
    if (!openid) {
      util.showToast('OpenID不存在')
      return
    }

    wx.setClipboardData({
      data: openid,
      success: function() {
        util.showSuccess('OpenID已复制')
      },
      fail: function() {
        util.showError('复制失败')
      }
    })
  }
})
