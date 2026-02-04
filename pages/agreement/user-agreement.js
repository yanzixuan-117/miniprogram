// pages/agreement/user-agreement.js
Page({
  data: {
    navbarData: {
      title: '用户协议'
    }
  },

  onLoad: function(options) {
    wx.setNavigationBarTitle({
      title: '用户协议'
    })
  }
})
