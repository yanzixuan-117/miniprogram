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
  }
})
