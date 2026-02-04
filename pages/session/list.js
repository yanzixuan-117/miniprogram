// pages/session/list.js
var util = require('../../utils/util.js')

Page({
  data: {
    sessionList: [],
    loading: false,
    activeStatus: '', // ''=全部, 'completed'='已完成', 'pending'='待完成'
    hasMore: true,
    userRole: ''
  },

  onLoad: function() {
    var app = getApp()
    this.setData({ userRole: app.globalData.userRole })
    this.loadSessions()
  },

  onShow: function() {
    // 刷新列表
    if (this.data.sessionList.length > 0) {
      this.loadSessions()
    }
  },

  // 加载课程记录
  loadSessions: function() {
    var self = this

    if (self.data.loading) return

    self.setData({ loading: true })

    var app = getApp()
    var userInfo = wx.getStorageSync('userInfo') || app.globalData.userInfo

    if (!userInfo || !userInfo._openid) {
      wx.navigateTo({
        url: '/pages/login/login'
      })
      return
    }

    var openid = userInfo._openid
    var db = wx.cloud.database()

    // 构建查询条件
    var where = {}

    if (self.data.userRole === 'student') {
      // 学员查看自己的课程记录
      where.studentId = openid
    } else if (self.data.userRole === 'coach') {
      // 教练查看自己教授的课程记录
      where.coachId = openid
    }

    // 如果选择了状态筛选
    if (self.data.activeStatus) {
      where.status = self.data.activeStatus
    }

    db.collection('bookings')
      .where(where)
      .orderBy('createTime', 'desc')
      .limit(50)
      .get()
      .then(function(res) {
        var sessionList = res.data || []

        // 格式化数据
        var promises = sessionList.map(function(item) {
          var date = new Date(item.date)
          var dateText = util.formatDateCN(date)
          var dayOfWeek = date.getDay()

          // 获取教练信息
          var coachName = '教练'
          var coachAvatar = '/images/avatar.png'

          return wx.cloud.callFunction({
            name: 'getCoachInfo',
            data: {
              coachId: item.coachId
            }
          }).then(function(coachRes) {
            if (coachRes.result && coachRes.result.success && coachRes.result.data) {
              var coachData = coachRes.result.data
              coachName = coachData.name
              coachAvatar = (coachData.avatarUrl && coachData.avatarUrl.indexOf('cloud://') !== 0)
                ? coachData.avatarUrl
                : '/images/avatar.png'
            }

            var newItem = {}
            var key = null

            // 手动复制对象
            for (key in item) {
              if (item.hasOwnProperty(key)) {
                newItem[key] = item[key]
              }
            }

            newItem.coachName = coachName
            newItem.coachAvatar = coachAvatar
            newItem.dateText = {
              full: dateText,
              day: date.getDate(),
              month: date.getMonth() + 1,
              weekday: ['日', '一', '二', '三', '四', '五', '六'][dayOfWeek]
            }

            return newItem
          }).catch(function(err) {

            var newItem = {}
            var key = null

            // 手动复制对象
            for (key in item) {
              if (item.hasOwnProperty(key)) {
                newItem[key] = item[key]
              }
            }

            newItem.coachName = coachName
            newItem.coachAvatar = coachAvatar
            newItem.dateText = {
              full: dateText,
              day: date.getDate(),
              month: date.getMonth() + 1,
              weekday: ['日', '一', '二', '三', '四', '五', '六'][dayOfWeek]
            }

            return newItem
          })
        })

        Promise.all(promises).then(function(formattedList) {
          self.setData({ sessionList: formattedList })
        })
      })
      .catch(function(err) {
        util.showError('加载失败，请重试')
      })
      .then(function() {
        self.setData({ loading: false })
      })
  },

  // 选择状态
  selectStatus: function(e) {
    var status = e.currentTarget.dataset.status || ''
    this.setData({
      activeStatus: status,
      sessionList: []
    })
    this.loadSessions()
  },

  // 查看详情
  viewDetail: function(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/session/detail?id=' + id
    })
  },

  // 添加课程记录（教练专用）
  addSession: function() {
    wx.navigateTo({
      url: '/pages/session/create'
    })
  },

  onPullDownRefresh: function() {
    this.loadSessions()
    setTimeout(function() {
      wx.stopPullDownRefresh()
    }, 1000)
  }
})
