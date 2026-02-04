// pages/test-avatar/test-avatar.js
Page({
  data: {
    userInfo: null,
    hasAvatar: false,
    avatarUrlLength: 0,
    isDefaultNickname: false
  },

  onLoad() {
    this.loadUserInfo()
  },

  loadUserInfo() {
    const app = getApp()
    const userInfo = app.globalData.userInfo

    if (!userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    const hasAvatar = !!userInfo.avatarUrl
    const avatarUrlLength = userInfo.avatarUrl?.length || 0
    const isDefaultNickname = userInfo.nickname === '微信用户' || !userInfo.nickname

    this.setData({
      userInfo,
      hasAvatar,
      avatarUrlLength,
      isDefaultNickname
    })

  }
})
