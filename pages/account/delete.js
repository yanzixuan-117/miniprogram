// pages/account/delete.js
var util = require('../../utils/util.js')

Page({
  data: {
    confirmed1: false,
    confirmed2: false,
    confirmed3: false,
    canDelete: false,
    hasData: false,
    stats: {
      bookings: 0,
      sessions: 0,
      favorites: 0
    },
    userInfo: null,
    openid: ''
  },

  onLoad: function() {
    var app = getApp()
    var userInfo = app.globalData.userInfo
    var hasLogin = app.globalData.hasLogin

    if (!hasLogin || !userInfo) {
      util.showError('请先登录')
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    this.setData({
      userInfo: userInfo,
      openid: userInfo._openid
    })

    // 加载用户数据统计
    this.loadUserDataStats()
  },

  // 加载用户数据统计
  loadUserDataStats: async function() {
    var openid = this.data.openid
    var stats = {
      bookings: 0,
      sessions: 0,
      favorites: 0
    }
    var hasData = false

    try {
      // 统计预约记录
      try {
        var bookingsRes = await util.getList('bookings', { studentId: openid }, 100)
        if (bookingsRes.data && bookingsRes.data.length > 0) {
          stats.bookings = bookingsRes.data.length
          hasData = true
        }
      } catch (err) {
        console.error('获取预约记录失败', err)
      }

      // 统计课程记录
      try {
        var sessionsRes = await util.getList('sessions', { studentOpenid: openid }, 100)
        if (sessionsRes.data && sessionsRes.data.length > 0) {
          stats.sessions = sessionsRes.data.length
          hasData = true
        }
      } catch (err) {
        console.error('获取课程记录失败', err)
      }

      // 统计收藏视频
      try {
        var favoritesRes = await util.getList('favorites', { openid: openid }, 100)
        if (favoritesRes.data && favoritesRes.data.length > 0) {
          stats.favorites = favoritesRes.data.length
          hasData = true
        }
      } catch (err) {
        console.error('获取收藏记录失败', err)
      }

      this.setData({
        stats: stats,
        hasData: hasData
      })
    } catch (err) {
      console.error('加载数据统计失败', err)
    }
  },

  // 切换确认选项
  toggleConfirm1: function() {
    this.setData({
      confirmed1: !this.data.confirmed1
    })
    this.checkCanDelete()
  },

  toggleConfirm2: function() {
    this.setData({
      confirmed2: !this.data.confirmed2
    })
    this.checkCanDelete()
  },

  toggleConfirm3: function() {
    this.setData({
      confirmed3: !this.data.confirmed3
    })
    this.checkCanDelete()
  },

  // 检查是否可以删除
  checkCanDelete: function() {
    var canDelete = this.data.confirmed1 && this.data.confirmed2 && this.data.confirmed3
    this.setData({
      canDelete: canDelete
    })
  },

  // 返回
  goBack: function() {
    wx.navigateBack()
  },

  // 确认注销
  handleDelete: async function() {
    if (!this.data.canDelete) {
      return
    }

    // 二次确认
    var confirmed = await util.showConfirm('注销后数据无法恢复，确定要注销账号吗？')
    if (!confirmed) {
      return
    }

    wx.showLoading({
      title: '注销中...',
      mask: true
    })

    try {
      var openid = this.data.openid
      var userInfo = this.data.userInfo

      // 1. 删除用户基本信息
      try {
        await wx.cloud.callFunction({
          name: 'deleteUser',
          data: { openid: openid }
        })
      } catch (err) {
        console.error('删除用户信息失败', err)
        // 即使删除失败也继续执行
      }

      // 2. 删除预约记录
      try {
        var bookingsRes = await util.getList('bookings', { studentId: openid }, 100)
        if (bookingsRes.data && bookingsRes.data.length > 0) {
          for (var i = 0; i < bookingsRes.data.length; i++) {
            await util.deleteDoc('bookings', bookingsRes.data[i]._id)
          }
        }
      } catch (err) {
        console.error('删除预约记录失败', err)
      }

      // 3. 删除课程记录
      try {
        var sessionsRes = await util.getList('sessions', { studentOpenid: openid }, 100)
        if (sessionsRes.data && sessionsRes.data.length > 0) {
          for (var j = 0; j < sessionsRes.data.length; j++) {
            await util.deleteDoc('sessions', sessionsRes.data[j]._id)
          }
        }
      } catch (err) {
        console.error('删除课程记录失败', err)
      }

      // 4. 删除收藏记录
      try {
        var favoritesRes = await util.getList('favorites', { openid: openid }, 100)
        if (favoritesRes.data && favoritesRes.data.length > 0) {
          for (var k = 0; k < favoritesRes.data.length; k++) {
            await util.deleteDoc('favorites', favoritesRes.data[k]._id)
          }
        }
      } catch (err) {
        console.error('删除收藏记录失败', err)
      }

      // 5. 删除教练记录（如果是教练）
      if (userInfo.role === 'coach') {
        try {
          var coachRes = await util.getList('coaches', { _openid: openid }, 1)
          if (coachRes.data && coachRes.data.length > 0) {
            await util.deleteDoc('coaches', coachRes.data[0]._id)
          }
        } catch (err) {
          console.error('删除教练记录失败', err)
        }
      }

      wx.hideLoading()

      // 清除本地缓存
      var app = getApp()
      app.clearUserInfo()

      wx.showModal({
        title: '注销成功',
        content: '您的账号已成功注销',
        showCancel: false,
        success: function(res) {
          if (res.confirm) {
            wx.reLaunch({
              url: '/pages/index/index'
            })
          }
        }
      })
    } catch (err) {
      wx.hideLoading()
      console.error('注销失败', err)
      util.showError('注销失败，请稍后重试')
    }
  }
})
