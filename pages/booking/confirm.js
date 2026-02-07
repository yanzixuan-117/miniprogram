// pages/booking/confirm.js
var util = require('../../utils/util.js')

Page({
  data: {
    coachId: '',
    date: '',
    time: '',
    endTime: '',

    coachInfo: null,
    dateText: '',
    timeText: '',

    studentNote: '', // 学员备注
    loading: false,
    submitting: false,

    // 球馆选择
    venues: [],
    selectedVenueIndex: -1, // -1 表示未选择
    selectedVenue: '',
    selectedVenueId: '',
    loadingVenues: true,

    // 上课人列表
    students: [], // [{name: '张三'}]
    showAddStudent: false,
    newStudentName: ''
  },

  // 计算安全的头像URL
  getSafeAvatarUrl: function(url) {
    if (!url || !url.trim()) {
      return ''
    }
    // 如果是云存储URL，返回空字符串
    if (url.indexOf('cloud://') !== -1) {
      return ''
    }
    return url
  },

  onLoad: function(options) {
    var coachId = options.coachId
    var date = options.date
    var time = options.time
    var endTime = options.endTime

    if (coachId && date && time && endTime) {
      this.setData({
        coachId: coachId,
        date: date,
        time: time,
        endTime: endTime,
        timeText: time + '-' + endTime
      })

      this.loadCoachInfo()
      this.loadVenues()
      this.formatDateText(date)
    } else {
      util.showError('参数错误')
      wx.navigateBack()
    }
  },

  // 加载教练信息
  loadCoachInfo: function() {
    var self = this
    util.showLoading()

    wx.cloud.callFunction({
      name: 'getCoachInfo',
      data: {
        coachId: self.data.coachId
      }
    }).then(function(res) {
      if (res.result && res.result.success && res.result.data) {
        var coachData = res.result.data

        // 云函数已经在服务端处理好了头像URL，直接使用
        var coachInfo = {}
        var key = null

        // 手动复制对象
        for (key in coachData) {
          if (coachData.hasOwnProperty(key)) {
            coachInfo[key] = coachData[key]
          }
        }

        // 如果云函数返回的仍是 cloud://，则使用默认图片
        coachInfo.avatarUrl = (coachData.avatarUrl && coachData.avatarUrl.indexOf('cloud://') !== 0)
          ? coachData.avatarUrl
          : ''

        self.setData({
          coachInfo: coachInfo
        })
      } else {
        var message = res.result && res.result.message ? res.result.message : '加载失败'
        util.showError(message)
      }
    }).catch(function(err) {
      util.showError('加载失败')
    }).then(function() {
      util.hideLoading()
    })
  },

  // 格式化日期文本
  formatDateText: function(dateStr) {
    var date = new Date(dateStr)
    this.setData({
      dateText: util.formatDateCN(date)
    })
  },

  // 加载球馆列表
  loadVenues: function() {
    var self = this
    self.setData({ loadingVenues: true })

    wx.cloud.callFunction({
      name: 'getVenues',
      data: {
        date: self.data.date,
        startTime: self.data.time,
        endTime: self.data.endTime
      }
    }).then(function(res) {
      if (res.result && res.result.success && res.result.data) {
        self.setData({
          venues: res.result.data,
          loadingVenues: false
        })
      } else {
        util.showError('获取球馆列表失败')
        self.setData({
          loadingVenues: false
        })
      }
    }).catch(function(err) {
      util.showError('加载球馆列表失败')
      self.setData({
        loadingVenues: false
      })
    })
  },

  // 输入备注
  onNoteInput: function(e) {
    this.setData({
      studentNote: e.detail.value
    })
  },

  // 显示添加上课人弹窗
  showAddStudentModal: function() {
    this.setData({
      showAddStudent: true,
      newStudentName: ''
    })
  },

  // 关闭添加上课人弹窗
  hideAddStudentModal: function() {
    this.setData({
      showAddStudent: false,
      newStudentName: ''
    })
  },

  // 输入上课人姓名
  onStudentNameInput: function(e) {
    this.setData({
      newStudentName: e.detail.value
    })
  },

  // 添加上课人
  addStudent: function() {
    var name = this.data.newStudentName.trim()

    if (!name) {
      util.showToast('请输入姓名')
      return
    }

    // 检查是否重复添加
    var isDuplicate = false
    for (var i = 0; i < this.data.students.length; i++) {
      if (this.data.students[i].name === name) {
        isDuplicate = true
        break
      }
    }

    if (isDuplicate) {
      util.showToast('该姓名已添加')
      return
    }

    // 添加到列表
    var newStudents = []
    for (var i = 0; i < this.data.students.length; i++) {
      newStudents.push(this.data.students[i])
    }
    newStudents.push({ name: name })

    this.setData({
      students: newStudents,
      showAddStudent: false,
      newStudentName: ''
    })

    util.showSuccess('添加成功')
  },

  // 删除上课人
  removeStudent: function(e) {
    var self = this
    var index = e.currentTarget.dataset.index

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这位上课人吗？',
      success: function(res) {
        if (res.confirm) {
          var students = self.data.students.filter(function(_, i) { return i !== index })
          self.setData({ students: students })
          util.showSuccess('删除成功')
        }
      }
    })
  },

  // 选择球馆
  selectVenue: function(e) {
    var index = e.currentTarget.dataset.index
    var venue = this.data.venues[index]

    // 检查球馆是否可用
    if (!venue.available) {
      // 根据不同的不可用原因显示不同的提示
      if (venue.unavailableReason === 'outside_hours') {
        var hours = venue.operatingHoursText || '营业时间'
        util.showToast('该时段不在球馆' + hours + '范围内')
      } else if (venue.unavailableReason === 'already_booked') {
        util.showToast('该球馆该时段已被预约')
      } else {
        util.showToast('该球馆暂不可用')
      }
      return
    }

    this.setData({
      selectedVenueIndex: index,
      selectedVenue: venue.name,
      selectedVenueId: venue._id
    })
  },

  // 提交预约
  submitBooking: function() {
    var self = this

    if (self.data.submitting) return

    // 验证球馆选择
    if (self.data.selectedVenueIndex === -1) {
      util.showToast('请选择球馆')
      return
    }

    // 验证
    if (!self.data.coachInfo) {
      util.showToast('教练信息加载失败')
      return
    }

    self.setData({ submitting: true })

    // 请求订阅消息权限
    wx.requestSubscribeMessage({
      tmplIds: [
        '0zah2JhpFWROpt-yud34i9JIyLdubNoTMf8jo7km9N8',     // 预约已确认
        '5vb0wANKEONrKQ_oTAIFFSTSpXcC8y7y6sGDu2Tp8Ik',      // 预约已拒绝
        'lw0LVJhfyaZwIR0FFVcmMMZjrFBtlOngUrK-BJpnC6Y'      // 预约已完成
      ],
      success: function(res) {
        console.log('订阅消息授权结果:', res)
        // 继续提交预约，无论用户是否授权
        self.doSubmitBooking()
      },
      fail: function(err) {
        console.log('请求订阅消息失败:', err)
        // 用户拒绝或请求失败，仍然继续提交预约
        self.doSubmitBooking()
      }
    })
  },

  // 执行提交预约
  doSubmitBooking: function() {
    var self = this

    util.showLoading('提交中...')

    wx.cloud.callFunction({
      name: 'createBooking',
      data: {
        coachId: self.data.coachId,
        date: self.data.date,
        startTime: self.data.time,
        endTime: self.data.endTime,
        venue: self.data.selectedVenue,
        venueId: self.data.selectedVenueId,
        studentNote: self.data.studentNote,
        students: self.data.students // 添加上课人列表
      }
    }).then(function(res) {
      if (res.result.success) {
        util.showSuccess('预约申请已提交')

        // 延迟跳转到预约中心（tabBar页面）
        setTimeout(function() {
          wx.switchTab({
            url: '/pages/booking/booking-hub'
          })
        }, 1500)
      } else {
        util.showError(res.result.message || '提交失败')
      }
    }).catch(function(err) {
      util.showError('提交失败，请重试')
    }).then(function() {
      util.hideLoading()
      self.setData({ submitting: false })
    })
  },

  // 返回上一页
  goBack: function() {
    wx.navigateBack()
  },

  // 阻止事件冒泡
  stopPropagation: function() {
    // 阻止点击弹窗内容时关闭弹窗
  }
})
