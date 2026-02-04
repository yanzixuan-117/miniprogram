// pages/video/manage
var util = require('../../utils/util.js')

Page({
  data: {},

  onLoad: function(options) {
    var self = this
    // ========== 登录检查 ==========
    var app = getApp()
    if (!app.globalData.hasLogin) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })

      setTimeout(function() {
        wx.navigateTo({
          url: '/pages/login/login'
        })
      }, 1500)
      return
    }

    // 检查教练权限
    if (!app.isCoachOrAdmin()) {
      wx.showToast({
        title: '需要教练权限',
        icon: 'none'
      })

      setTimeout(function() {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }, 1500)
      return
    }

    // TODO: 加载视频管理数据
  }
})
