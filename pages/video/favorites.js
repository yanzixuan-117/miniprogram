// pages/video/favorites
var util = require('../../utils/util.js')

Page({
  data: {
    favoritesList: []
  },

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

    // TODO: 加载收藏列表
  }
})
