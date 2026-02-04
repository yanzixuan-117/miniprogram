// pages/session/history
var util = require('../../utils/util.js')

Page({
  data: {
    sessionList: [],
    loading: false,
    hasMore: true,
    page: 0,
    pageSize: 20,
    coachId: '', // 教练在coaches集合中的_id

    // 统计数据
    totalSessions: 0,
    totalStudents: 0,
    totalHours: 0,

    // 筛选条件
    filterType: 'all', // all | week | month
    startDate: null,
    endDate: null
  },

  onLoad: function(_options) {
    // 加载教练信息并检查权限
    this.loadCoachInfo()
  },

  // 加载教练信息
  loadCoachInfo: function() {
    var self = this

    wx.getStorageSync({
      key: 'userInfo',
      success: function(res) {
        var userInfo = res.data
        if (!userInfo || !userInfo._openid) {
          wx.navigateTo({
            url: '/pages/login/login'
          })
          return
        }

        var db = wx.cloud.database()

        // 查询教练信息
        db.collection('coaches')
          .where({ _openid: userInfo._openid })
          .get()
          .then(function(coachRes) {
            if (!coachRes.data || coachRes.data.length === 0) {
              util.showError('需要教练权限')
              setTimeout(function() {
                wx.navigateBack()
              }, 1500)
              return
            }

            var coach = coachRes.data[0]
            self.setData({ coachId: coach._id })

            // 加载课程记录
            self.loadSessionList()
            self.loadStatistics()
          })
          .catch(function(err) {
            util.showError('加载失败')
          })
      }
    })
  },

  onShow: function() {
    // 从详情页返回时刷新列表
    var pages = getCurrentPages()
    var currentPage = pages[pages.length - 1]
    if (currentPage._needRefresh) {
      currentPage._needRefresh = false
      this.refresh()
    }
  },

  // 加载课程记录列表
  loadSessionList: function(append) {
    var self = this
    if (typeof append === 'undefined') {
      append = false
    }

    if (self.data.loading) return

    self.setData({ loading: true })

    var coachId = self.data.coachId
    var page = self.data.page
    var pageSize = self.data.pageSize
    var filterType = self.data.filterType
    var startDate = self.data.startDate
    var endDate = self.data.endDate

    if (!coachId) {
      self.setData({ loading: false })
      return
    }

    // 查询课程记录（从bookings集合，只查询已完成的课程）
    var db = wx.cloud.database()
    var _ = db.command

    var query = db.collection('bookings')
      .where({ coachId: coachId, status: 'completed' })

    // 应用日期筛选
    if (startDate && endDate) {
      query = query.where({
        date: _.gte(startDate).and(_.lte(endDate))
      })
    }

    // 分页查询
    query
      .orderBy('date', 'desc')
      .orderBy('createTime', 'desc')
      .skip(page * pageSize)
      .limit(pageSize)
      .get()
      .then(function(result) {
        // 获取学员信息并格式化数据
        return self.enrichStudentInfo(result.data || []).then(function(sessionList) {
          var formattedList = self.formatSessionList(sessionList)

          // 合并或替换数据
          var newList = append ? self.data.sessionList.concat(formattedList) : formattedList

          self.setData({
            sessionList: newList,
            hasMore: result.data.length === pageSize,
            loading: false
          })
        })
      })
      .catch(function(err) {
        util.showError('加载失败')
        self.setData({ loading: false })
      })
  },

  // 加载统计数据
  loadStatistics: function() {
    var self = this
    var coachId = self.data.coachId

    if (!coachId) {
      return
    }

    var db = wx.cloud.database()

    // 获取所有已完成的课程记录
    db.collection('bookings')
      .where({ coachId: coachId, status: 'completed' })
      .get()
      .then(function(allRes) {
        var sessions = allRes.data || []

        // 计算统计数据
        var totalSessions = sessions.length
        var totalHours = sessions.length // 每节课1小时

        // 统计唯一学员数
        var uniqueStudents = {}
        for (var i = 0; i < sessions.length; i++) {
          if (sessions[i].studentId) {
            uniqueStudents[sessions[i].studentId] = true
          }
        }

        var totalStudents = 0
        for (var key in uniqueStudents) {
          if (uniqueStudents.hasOwnProperty(key)) {
            totalStudents++
          }
        }

        self.setData({
          totalSessions: totalSessions,
          totalStudents: totalStudents,
          totalHours: totalHours
        })
      })
      .catch(function(err) {
      })
  },

  // 丰富学员信息
  enrichStudentInfo: function(sessions) {
    var studentIds = sessions.map(function(s) { return s.studentId }).filter(function(id) { return id })

    if (studentIds.length === 0) {
      return Promise.resolve(sessions)
    }

    // 使用云函数批量获取学员信息
    var promises = studentIds.map(function(studentId) {
      return wx.cloud.callFunction({
        name: 'getUserInfo',
        data: { openId: studentId }
      }).then(function(res) {
        if (res.result && res.result.success && res.result.data) {
          return {
            studentId: studentId,
            nickname: res.result.data.nickname || '学员'
          }
        }
        return { studentId: studentId, nickname: '学员' }
      }).catch(function(err) {
        return { studentId: studentId, nickname: '学员' }
      })
    })

    return Promise.all(promises).then(function(results) {
      // 创建学员信息映射
      var studentMap = {}
      results.forEach(function(result) {
        studentMap[result.studentId] = result.nickname
      })

      // 填充学员信息
      return sessions.map(function(session) {
        var newSession = {}
        for (var key in session) {
          if (session.hasOwnProperty(key)) {
            newSession[key] = session[key]
          }
        }
        newSession.studentName = studentMap[session.studentId] || '学员'
        return newSession
      })
    }).catch(function(err) {
      return sessions
    })
  },

  // 格式化课程记录列表
  formatSessionList: function(list) {
    return list.map(function(item) {
      var newItem = {}
      var key = null

      // 手动复制对象
      for (key in item) {
        if (item.hasOwnProperty(key)) {
          newItem[key] = item[key]
        }
      }

      // 映射字段以匹配WXML
      newItem.content = item.feedback || '' // feedback -> content
      newItem.focusPoints = [] // 暂时为空，后续可扩展标签功能
      newItem.duration = 1 // 每节课1小时
      // 使用工具函数格式化日期
      newItem.dateText = util.formatDateText(item.date)

      return newItem
    })
  },

  // 切换筛选条件
  onFilterChange: function(e) {
    var self = this
    var type = e.currentTarget.dataset.type
    if (type === self.data.filterType) return

    var now = new Date()
    var startDate = null
    var endDate = util.formatDate(now)

    switch (type) {
      case 'week':
        // 本周开始（周一）
        var day = now.getDay() || 7
        var weekStart = new Date(now)
        weekStart.setDate(now.getDate() - day + 1)
        startDate = util.formatDate(weekStart)
        break
      case 'month':
        // 本月开始
        var monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        startDate = util.formatDate(monthStart)
        break
      default:
        startDate = null
        endDate = null
    }

    self.setData({
      filterType: type,
      startDate: startDate,
      endDate: endDate,
      page: 0,
      sessionList: []
    })

    self.loadSessionList()
  },

  // 显示搜索
  showSearch: function() {
    wx.showToast({
      title: '搜索功能开发中',
      icon: 'none'
    })
  },

  // 查看详情
  viewDetail: function(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/session/detail?id=' + id
    })
  },

  // 加载更多
  loadMore: function() {
    this.setData({
      page: this.data.page + 1
    })
    this.loadSessionList(true)
  },

  // 刷新
  refresh: function() {
    this.setData({
      page: 0,
      sessionList: []
    })
    this.loadSessionList()
    this.loadStatistics()
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    this.refresh()
    setTimeout(function() {
      wx.stopPullDownRefresh()
    }, 1000)
  }
})
