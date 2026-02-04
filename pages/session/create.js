// pages/session/create.js
var util = require('../../utils/util.js')

Page({
  data: {
    bookingId: '',
    booking: null,
    feedback: '',
    status: 'completed', // completed 或 cancelled
    photos: [],
    loading: true,
    submitting: false,
    error: ''
  },

  onLoad: function(options) {
    var id = options.id

    if (id) {
      this.setData({ bookingId: id })
      this.loadBookingDetail()
    } else {
      this.setData({
        loading: false,
        error: '缺少课程ID'
      })
    }
  },

  // 加载课程详情
  loadBookingDetail: function() {
    var self = this
    self.setData({ loading: true })

    var db = wx.cloud.database()

    // 查询课程详情
    db.collection('bookings')
      .doc(self.data.bookingId)
      .get()
      .then(function(res) {
        if (!res.data) {
          self.setData({
            loading: false,
            error: '课程不存在'
          })
          return
        }

        var booking = res.data

        // 获取学员信息
        var studentName = '学员'
        if (booking.studentId) {
          return db.collection('users')
            .where({ _openid: booking.studentId })
            .field({
              nickname: true
            })
            .get()
            .then(function(userRes) {
              if (userRes.data && userRes.data.length > 0) {
                studentName = userRes.data[0].nickname
              }

              // 格式化数据
              var bookingData = self.formatBookingData(booking, studentName)

              self.setData({
                booking: bookingData,
                feedback: bookingData.feedback || '',
                photos: bookingData.photos || [],
                loading: false
              })
            })
            .catch(function(err) {

              // 格式化数据
              var bookingData = self.formatBookingData(booking, studentName)

              self.setData({
                booking: bookingData,
                feedback: bookingData.feedback || '',
                photos: bookingData.photos || [],
                loading: false
              })
            })
        } else {
          // 格式化数据
          var bookingData = self.formatBookingData(booking, studentName)

          self.setData({
            booking: bookingData,
            feedback: bookingData.feedback || '',
            photos: bookingData.photos || [],
            loading: false
          })
        }
      })
      .catch(function(err) {
        self.setData({
          loading: false,
          error: '加载失败，请重试'
        })
      })
  },

  // 格式化课程数据
  formatBookingData: function(booking, studentName) {
    // 格式化日期
    var date = new Date(booking.date)
    var dateText = util.formatDateCN(date)

    // 获取上课人列表
    var students = booking.students || []

    return {
      _id: booking._id,
      dateText: dateText,
      startTime: booking.startTime,
      endTime: booking.endTime,
      venue: booking.venue,
      studentNote: booking.studentNote,
      coachNote: booking.coachNote,
      studentName: studentName,
      students: students, // 上课人列表
      feedback: booking.feedback || '',
      photos: booking.photos || []
    }
  },

  // 输入反馈
  onFeedbackInput: function(e) {
    this.setData({
      feedback: e.detail.value
    })
  },

  // 选择状态
  selectStatus: function(e) {
    var self = this
    var status = e.currentTarget.dataset.status

    if (status === 'cancelled') {
      wx.showModal({
        title: '确认取消',
        content: '取消后不可恢复，确定要将课程标记为已取消吗？',
        confirmText: '确定取消',
        confirmColor: '#ff4d4f',
        success: function(res) {
          if (res.confirm) {
            self.setData({ status: status })
          }
        }
      })
    } else {
      this.setData({ status: status })
    }
  },

  // 选择照片
  choosePhoto: function() {
    var self = this
    var remainingCount = 9 - this.data.photos.length

    wx.chooseMedia({
      count: remainingCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function(res) {
        var tempFiles = res.tempFiles.map(function(file) { return file.tempFilePath })

        // 上传照片到云存储
        self.uploadPhotos(tempFiles)
      }
    })
  },

  // 上传照片到云存储
  uploadPhotos: function(tempFilePaths) {
    var self = this
    wx.showLoading({ title: '上传中...' })

    var uploadPromises = tempFilePaths.map(function(filePath) {
      return new Promise(function(resolve, reject) {
        var cloudPath = 'session-photos/' + Date.now() + '-' + Math.random().toString(36).substr(2, 9) + '.jpg'

        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: filePath,
          success: function(res) {
            resolve(res.fileID)
          },
          fail: function(err) {
            reject(err)
          }
        })
      })
    })

    Promise.all(uploadPromises).then(function(cloudUrls) {
      var newPhotos = []
      for (var i = 0; i < self.data.photos.length; i++) {
        newPhotos.push(self.data.photos[i])
      }
      for (var j = 0; j < cloudUrls.length; j++) {
        newPhotos.push(cloudUrls[j])
      }

      self.setData({
        photos: newPhotos
      })

      wx.hideLoading()
      util.showSuccess('成功上传 ' + cloudUrls.length + ' 张照片')
    }).catch(function(err) {
      wx.hideLoading()
      util.showError('上传照片失败')
    })
  },

  // 删除照片
  deletePhoto: function(e) {
    var self = this
    var index = e.currentTarget.dataset.index

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这张照片吗？',
      success: function(res) {
        if (res.confirm) {
          var photos = []
          for (var i = 0; i < self.data.photos.length; i++) {
            photos.push(self.data.photos[i])
          }
          photos.splice(index, 1)
          self.setData({ photos: photos })
        }
      }
    })
  },

  // 提交记录
  submitRecord: function() {
    var self = this

    if (self.data.submitting) return

    // 验证反馈内容
    if (!self.data.feedback.trim()) {
      util.showToast('请填写课程反馈')
      return
    }

    self.setData({ submitting: true })
    wx.showLoading({ title: '提交中...' })

    wx.cloud.callFunction({
      name: 'booking',
      data: {
        action: 'updateRecord',
        bookingId: self.data.bookingId,
        feedback: self.data.feedback,
        status: self.data.status,
        photos: self.data.photos
      }
    }).then(function(res) {
      if (res.result.success) {
        util.hideLoading()
        util.showSuccess('提交成功')

        setTimeout(function() {
          wx.navigateBack()
        }, 1500)
      } else {
        util.hideLoading()
        util.showError(res.result.message || '提交失败')
      }
    }).catch(function(err) {
      wx.hideLoading()
      util.showError('提交失败，请重试')
    }).then(function() {
      self.setData({ submitting: false })
    })
  },

  // 返回上一页
  goBack: function() {
    wx.navigateBack()
  }
})
