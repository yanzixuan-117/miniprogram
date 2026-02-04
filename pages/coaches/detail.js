// pages/coaches/detail.js
var util = require('../../utils/util.js')

Page({
  data: {
    coachId: '',
    coachInfo: null,
    loading: false
  },

  onLoad: function(options) {
    var id = options.id
    if (id) {
      this.setData({ coachId: id })
      this.loadCoachDetail()
    } else {
      util.showError('参数错误')
      wx.navigateBack()
    }
  },

  // 加载教练详情
  loadCoachDetail: function() {
    var self = this
    self.setData({ loading: true })

    wx.cloud.callFunction({
      name: 'getCoachInfo',
      data: {
        coachId: self.data.coachId
      }
    }).then(function(res) {

      if (res.result && res.result.success && res.result.data) {
        var coachData = res.result.data

        // 云函数已经在服务端处理好了头像URL
        self.setData({
          coachInfo: coachData
        })
      } else {
        var message = res.result && res.result.message ? res.result.message : '教练不存在'
        util.showError(message)
        wx.navigateBack()
      }
    }).catch(function(err) {
      util.showError('加载失败')
    }).then(function() {
      self.setData({ loading: false })
    })
  },

  // 立即预约
  bookNow: function() {
    wx.navigateTo({
      url: '/pages/booking/select-date?coachId=' + this.data.coachId
    })
  }
})
