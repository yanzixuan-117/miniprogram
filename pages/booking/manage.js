// pages/booking/manage.js
var util = require('../../utils/util.js')

Page({
  data: {
    bookingList: [],
    activeStatus: '',
    loading: false,
    coachInfo: null
  },

  onLoad: function() {
    this.loadCoachInfo()
  },

  onShow: function() {
    // 刷新列表
    if (this.data.coachInfo) {
      this.loadBookings()
    }
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
        db.collection('coaches')
          .where({
            _openid: userInfo._openid
          })
          .get()
          .then(function(res) {
            if (res.data && res.data.length > 0) {
              self.setData({
                coachInfo: res.data[0]
              })
              self.loadBookings()
            }
          })
          .catch(function(err) {
            // 忽略错误
          })
      }
    })
  },

  // 加载预约列表
  loadBookings: function() {
    var self = this

    if (self.data.loading) return

    self.setData({ loading: true })

    wx.getStorageSync({
      key: 'userInfo',
      success: function(res) {
        var userInfo = res.data
        var coachId = self.data.coachInfo._id

        // 查询该教练的预约
        var where = {
          coachId: coachId
        }

        if (self.data.activeStatus) {
          where.status = self.data.activeStatus
        }

        util.getList('bookings', where, 50).then(function(res) {
          var bookingList = res.data || []

          // 按创建时间倒序排列，待审核的排在前面
          bookingList.sort(function(a, b) {
            if (a.status === 'pending' && b.status !== 'pending') return -1
            if (a.status !== 'pending' && b.status === 'pending') return 1
            return new Date(b.createTime) - new Date(a.createTime)
          })

          // 格式化数据
          var promises = bookingList.map(function(item) {
            var date = new Date(item.date)
            var dateText = util.formatDateCN(date)
            var dayOfWeek = date.getDay()
            var weekdays = ['日', '一', '二', '三', '四', '五', '六']
            var weekday = weekdays[dayOfWeek]

            // 获取学员信息
            var studentName = '学员'
            var studentAvatar = ''

            return wx.cloud.callFunction({
              name: 'getUserInfo',
              data: {
                openId: item.studentId
              }
            }).then(function(studentRes) {
              if (studentRes.result && studentRes.result.success && studentRes.result.data) {
                var userData = studentRes.result.data
                studentName = userData.nickname || '学员'
                // 云函数已经在服务端处理好了头像URL，直接使用
                studentAvatar = (userData.avatarUrl && userData.avatarUrl.indexOf('cloud://') !== 0)
                  ? userData.avatarUrl
                  : '/images/avatar.png'
              } else {
                // 忽略
              }

              var students = item.students || []

              var newItem = {}
              var key = null

              // 手动复制对象
              for (key in item) {
                if (item.hasOwnProperty(key)) {
                  newItem[key] = item[key]
                }
              }

              newItem.dateText = {
                full: dateText,
                day: date.getDate(),
                month: date.getMonth() + 1,
                weekday: weekday
              }
              newItem.studentName = studentName
              newItem.studentAvatar = studentAvatar
              newItem.students = students
              newItem.statusText = util.getBookingStatusText(item.status)
              newItem.canConfirm = item.status === 'pending'
              newItem.canReject = item.status === 'pending'
              newItem.canComplete = item.status === 'confirmed'
              newItem.feedback = item.feedback || ''

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

              newItem.dateText = {
                full: dateText,
                day: date.getDate(),
                month: date.getMonth() + 1,
                weekday: weekday
              }
              newItem.studentName = studentName
              newItem.studentAvatar = studentAvatar
              newItem.students = item.students || []
              newItem.statusText = util.getBookingStatusText(item.status)
              newItem.canConfirm = item.status === 'pending'
              newItem.canReject = item.status === 'pending'
              newItem.canComplete = item.status === 'confirmed'
              newItem.feedback = item.feedback || ''

              return newItem
            })
          })

          Promise.all(promises).then(function(formattedList) {
            self.setData({ bookingList: formattedList })
          })
        }).catch(function(err) {
          util.showError('加载失败，请重试')
        }).then(function() {
          self.setData({ loading: false })
        })
      }
    })
  },

  // 选择状态
  selectStatus: function(e) {
    var status = e.currentTarget.dataset.status
    this.setData({
      activeStatus: status,
      bookingList: []
    })
    this.loadBookings()
  },

  // 查看详情/添加课程记录
  viewDetail: function(e) {
    var dataset = e.currentTarget.dataset
    var id = dataset.id
    var status = dataset.status
    var feedback = dataset.feedback

    // 判断是否有反馈（feedback 需要是非空字符串）
    var hasFeedback = feedback && feedback.trim() !== ''

    // 已完成的课程，如果有反馈则查看详情，否则添加反馈
    if (status === 'completed') {
      if (hasFeedback) {
        // 有反馈，跳转到详情页
        wx.navigateTo({
          url: '/pages/session/detail?id=' + id
        })
      } else {
        // 没有反馈，跳转到添加反馈页面
        wx.navigateTo({
          url: '/pages/session/create?id=' + id
        })
      }
    } else {
      // 其他状态，跳转到添加反馈页面
      wx.navigateTo({
        url: '/pages/session/create?id=' + id
      })
    }
  },

  // 确认预约
  confirmBooking: function(e) {
    var self = this
    var id = e.currentTarget.dataset.id

    util.showConfirm('确认接受这个预约吗？').then(function(confirm) {
      if (!confirm) return

      util.showLoading('处理中...')

      wx.cloud.callFunction({
        name: 'booking',
        data: {
          action: 'confirm',
          bookingId: id
        }
      }).then(function(res) {
        if (res.result.success) {
          util.showSuccess('已确认预约')
          self.loadBookings()
        } else {
          util.showError(res.result.message || '操作失败')
        }
      }).catch(function(err) {
        util.showError('操作失败，请重试')
      }).then(function() {
        util.hideLoading()
      })
    })
  },

  // 拒绝预约
  rejectBooking: function(e) {
    var self = this
    var id = e.currentTarget.dataset.id

    // 让用户输入拒绝原因
    wx.showModal({
      title: '拒绝预约',
      content: '请输入拒绝原因（可选）',
      editable: true,
      placeholderText: '如：时间冲突、临时有事等',
      success: function(res) {
        if (res.confirm) {
          var rejectReason = res.content || ''

          util.showLoading('处理中...')

          wx.cloud.callFunction({
            name: 'booking',
            data: {
              action: 'reject',
              bookingId: id,
              rejectReason: rejectReason
            }
          }).then(function(result) {
            if (result.result.success) {
              util.showSuccess('已拒绝预约')
              self.loadBookings()
            } else {
              util.showError(result.result.message || '操作失败')
            }
          }).catch(function(err) {
            util.showError('操作失败，请重试')
          }).then(function() {
            util.hideLoading()
          })
        }
      }
    })
  },

  // 完成预约
  completeBooking: function(e) {
    var self = this
    var id = e.currentTarget.dataset.id

    util.showConfirm('确认课程已完成吗？').then(function(confirm) {
      if (!confirm) return

      util.showLoading('处理中...')

      wx.cloud.callFunction({
        name: 'booking',
        data: {
          action: 'complete',
          bookingId: id
        }
      }).then(function(res) {
        if (res.result.success) {
          util.showSuccess('课程已完成')

          // 提示是否添加课程记录
          setTimeout(function() {
            wx.showModal({
              title: '添加课程记录',
              content: '是否为本次课程添加详细记录？',
              success: function(res) {
                if (res.confirm) {
                  wx.navigateTo({
                    url: '/pages/session/create?bookingId=' + id
                  })
                }
              }
            })
          }, 1500)

          self.loadBookings()
        } else {
          util.showError(res.result.message || '操作失败')
        }
      }).catch(function(err) {
        util.showError('操作失败，请重试')
      }).then(function() {
        util.hideLoading()
      })
    })
  },

  onPullDownRefresh: function() {
    this.loadBookings()
    setTimeout(function() {
      wx.stopPullDownRefresh()
    }, 1000)
  }
})
