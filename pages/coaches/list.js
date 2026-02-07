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
      // 清除图片URL缓存，确保强制转换云存储URL
      util.clearCloudURLCache()

      // 使用云函数获取教练列表
      var res = await wx.cloud.callFunction({
        name: 'getCoaches',
        data: { status: 1 }
      })

      var coachList = res.result.success ? (res.result.data || []) : []

      // 批量转换教练头像云存储URL为临时URL
      coachList = await util.processListCloudURLs(coachList, ['cloudAvatarUrl'], '', true)

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

  // 图片加载失败处理 - 备用方案（正常情况下预转换已处理）
  onImageError: function(e) {
    var self = this
    var index = e.currentTarget.dataset.index
    var cloudUrl = e.currentTarget.dataset.cloudurl

    // 尝试重新获取临时URL
    if (cloudUrl) {
      util.processCloudImageURL(cloudUrl, '', false).then(function(tempUrl) {
        var coachList = self.data.coachList
        coachList[index].cloudAvatarUrl = tempUrl
        self.setData({ coachList: coachList })
      }).catch(function() {
        // 失败则使用默认头像
        var coachList = self.data.coachList
        coachList[index].cloudAvatarUrl = ''
        self.setData({ coachList: coachList })
      })
    }
  }
})
