// pages/coaches/list.js
var util = require('../../utils/util.js')

Page({
  data: {
    coachList: [],
    loading: false,
    searchKeyword: ''
  },

  onLoad: function() {
    this.loadCoachList()
  },

  // 加载教练列表
  loadCoachList: async function() {
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      // 使用云函数获取教练列表（云函数会处理头像URL）
      var res = await wx.cloud.callFunction({
        name: 'getCoaches',
        data: { status: 1 }
      })

      var coachList = res.result.success ? (res.result.data || []) : []

      this.setData({ coachList: coachList })
    } catch (err) {
      util.showError('加载失败，请重试')
    } finally {
      this.setData({ loading: false })
    }
  },

  // 搜索教练
  onSearchInput: function(e) {
    this.setData({
      searchKeyword: e.detail.value
    })
  },

  // 查看教练详情
  viewCoachDetail: function(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/coaches/detail?id=' + id
    })
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    this.loadCoachList()
    setTimeout(function() {
      wx.stopPullDownRefresh()
    }, 1000)
  },

  // 图片加载失败处理 - 尝试重新获取临时URL
  onImageError: function(e) {
    var self = this
    var index = e.currentTarget.dataset.index
    var cloudUrl = e.currentTarget.dataset.cloudurl

    // 如果有云存储URL，尝试重新获取临时URL
    if (cloudUrl && cloudUrl.startsWith('cloud://')) {
      wx.cloud.getTempFileURL({
        fileList: [cloudUrl]
      }).then(function(res) {
        if (res.fileList && res.fileList[0] && res.fileList[0].status === 0) {
          var tempUrl = res.fileList[0].tempFileURL
          var coachList = self.data.coachList
          coachList[index].avatarUrl = tempUrl
          self.setData({ coachList: coachList })
        } else {
          // 获取失败，使用默认头像
          var coachList = self.data.coachList
          coachList[index].avatarUrl = '/images/avatar.png'
          self.setData({ coachList: coachList })
        }
      }).catch(function(err) {
        console.error('重新获取临时URL失败:', err)
        // 失败时使用默认头像
        var coachList = self.data.coachList
        coachList[index].avatarUrl = '/images/avatar.png'
        self.setData({ coachList: coachList })
      })
    } else {
      // 没有云存储URL，直接使用默认头像
      var coachList = this.data.coachList
      coachList[index].avatarUrl = '/images/avatar.png'
      this.setData({ coachList: coachList })
    }
  }
})
