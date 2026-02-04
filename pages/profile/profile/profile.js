// pages/profile/profile.js
const app = getApp()

Page({
  data: {
    userInfo: null,
    roleText: '',
    roleIcon: '',
    createTime: ''
  },

  onLoad(options) {
    // 检查登录状态
    if (!app.globalData.hasLogin || !app.globalData.userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    this.initUserInfo()
  },

  onShow() {
    // 页面显示时刷新用户信息（从编辑页返回时需要）
    if (app.globalData.hasLogin && app.globalData.userInfo) {
      this.initUserInfo()
    }
  },

  // 初始化用户信息
  initUserInfo() {
    const userInfo = app.globalData.userInfo

    // 设置角色文本和图标
    let roleText = '学员'
    let roleIcon = '🎾'
    if (userInfo.role === 'coach') {
      roleText = '教练'
      roleIcon = '🏆'
    } else if (userInfo.role === 'admin') {
      roleText = '管理员'
      roleIcon = '⭐'
    }

    // 格式化创建时间
    let createTime = '未知'
    if (userInfo.createTime) {
      createTime = this.formatDate(userInfo.createTime)
    }

    this.setData({
      userInfo: userInfo,
      roleText: roleText,
      roleIcon: roleIcon,
      createTime: createTime
    })
  },

  // 跳转到编辑页面
  goToEdit() {
    wx.navigateTo({
      url: '/pages/profile/edit/edit'
    })
  },

  // 格式化日期
  formatDate(dateStr) {
    if (!dateStr) return ''

    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  }
})
