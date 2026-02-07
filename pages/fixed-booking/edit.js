// pages/fixed-booking/edit.js
const util = require('../../utils/util.js')

Page({
  data: {
    bookingId: '',  // 如果有值则是编辑模式
    isEdit: false,
    form: {
      weekday: '',  // 选中的星期几
      startTime: '',
      endTime: '',
      coachId: '',
      venueId: '',  // 球场ID
      validUntil: ''  // 有效期
    },
    // 星期选项（按索引顺序：0=周日, 1=周一, ..., 6=周六）
    weekdayOptions: [
      { value: 0, label: '周日' },
      { value: 1, label: '周一' },
      { value: 2, label: '周二' },
      { value: 3, label: '周三' },
      { value: 4, label: '周四' },
      { value: 5, label: '周五' },
      { value: 6, label: '周六' }
    ],
    coachList: [],
    coachIndex: 0,  // 选中的教练索引
    venueList: [],  // 球馆列表
    venueIndex: 0,  // 选中的球馆索引
    loading: false,
    saving: false,
    // 显示文本（避免WXML中的复杂表达式）
    displayWeekday: '请选择',
    displayCoach: '请选择',
    displayVenue: '请选择'
  },

  onLoad(options) {
    const { id } = options
    if (id) {
      this.setData({
        bookingId: id,
        isEdit: true
      })
      this.loadBookingDetail(id) // 内部会调用loadCoachList
    } else {
      // 默认选中今天，并先加载教练和球馆列表
      const today = new Date().getDay()
      Promise.all([
        this.loadCoachList(),
        this.loadVenueList()
      ]).then(() => {
        this.setData({
          'form.weekday': today
        }, () => {
          this.updateDisplayText()
        })
      })
    }
  },

  // 更新显示文本
  updateDisplayText() {
    const { form, weekdayOptions, coachList, venueList } = this.data

    // 更新星期显示
    let displayWeekday = '请选择'
    if (form.weekday !== '' && form.weekday !== undefined) {
      const found = weekdayOptions.find(item => item.value === form.weekday)
      displayWeekday = found ? found.label : '请选择'
    }

    // 更新教练显示
    let displayCoach = '请选择'
    if (form.coachId) {
      const found = coachList.find(c => c._id === form.coachId)
      displayCoach = found ? (found.name || found.nickname) : '请选择'
    }

    // 更新球馆显示
    let displayVenue = '请选择'
    if (form.venueId) {
      const found = venueList.find(v => v._id === form.venueId)
      displayVenue = found ? found.name : '请选择'
    }

    this.setData({
      displayWeekday,
      displayCoach,
      displayVenue
    })
  },

  // 加载固定预约详情
  async loadBookingDetail(id) {
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getFixedBookings',
        data: { id }
      })

      if (res.result.success) {
        const booking = res.result.data

        // 等待教练和球馆列表加载完成
        await Promise.all([
          this.loadCoachList(),
          this.loadVenueList()
        ])

        // 查找教练在列表中的索引
        let coachIndex = 0
        const { coachList } = this.data
        if (coachList && coachList.length > 0) {
          const foundIndex = coachList.findIndex(c => c._id === booking.coachId)
          if (foundIndex !== -1) {
            coachIndex = foundIndex
          }
        }

        // 查找球馆在列表中的索引
        let venueIndex = 0
        const { venueList } = this.data
        if (venueList && venueList.length > 0 && booking.venueId) {
          const foundIndex = venueList.findIndex(v => v._id === booking.venueId)
          if (foundIndex !== -1) {
            venueIndex = foundIndex
          }
        }

        this.setData({
          'form.weekday': booking.weekday,
          'form.startTime': booking.startTime,
          'form.endTime': booking.endTime,
          'form.coachId': booking.coachId,
          'form.venueId': booking.venueId || '',
          'form.validUntil': booking.validUntil ? booking.validUntil.split('T')[0] : '',
          coachIndex: coachIndex,
          venueIndex: venueIndex
        }, () => {
          this.updateDisplayText()
        })
      }
    } catch (err) {
      console.error('加载详情失败:', err)
      util.showError('加载失败')
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载教练列表
  async loadCoachList() {
    try {
      const res = await util.getList('coaches', { status: 1 }, 100)
      if (res.data) {
        this.setData({
          coachList: res.data
        })
      }
    } catch (err) {
      console.error('加载教练列表失败:', err)
    }
  },

  // 加载球馆列表
  async loadVenueList() {
    try {
      const res = await util.getList('venues', {}, 100)
      if (res.data) {
        this.setData({
          venueList: res.data
        })
      }
    } catch (err) {
      console.error('加载球馆列表失败:', err)
    }
  },

  // 选择星期
  onWeekdayChange(e) {
    this.setData({
      'form.weekday': parseInt(e.detail.value)
    }, () => {
      this.updateDisplayText()
    })
  },

  // 选择开始时间
  onStartTimeChange(e) {
    this.setData({
      'form.startTime': e.detail.value
    })
  },

  // 选择结束时间
  onEndTimeChange(e) {
    this.setData({
      'form.endTime': e.detail.value
    })
  },

  // 选择教练
  onCoachChange(e) {
    const index = parseInt(e.detail.value)
    const coach = this.data.coachList[index]
    if (coach) {
      this.setData({
        'form.coachId': coach._id,
        coachIndex: index
      }, () => {
        this.updateDisplayText()
      })
    }
  },

  // 选择球馆
  onVenueChange(e) {
    const index = parseInt(e.detail.value)
    const venue = this.data.venueList[index]
    if (venue) {
      this.setData({
        'form.venueId': venue._id,
        venueIndex: index
      }, () => {
        this.updateDisplayText()
      })
    }
  },

  // 选择有效期
  onDateChange(e) {
    this.setData({
      'form.validUntil': e.detail.value
    })
  },

  // 返回
  goBack() {
    wx.navigateBack()
  },

  // 保存固定预约
  async save() {
    const { weekday, startTime, endTime, coachId, venueId } = this.data.form

    console.log('=== 保存固定预约 ===', {
      weekday,
      startTime,
      endTime,
      coachId,
      venueId,
      validUntil: this.data.form.validUntil
    })

    // 表单验证
    if (weekday === '' || weekday === undefined || weekday === null) {
      util.showToast('请选择星期')
      return
    }

    if (!startTime) {
      util.showToast('请选择开始时间')
      return
    }

    if (!endTime) {
      util.showToast('请选择结束时间')
      return
    }

    if (startTime >= endTime) {
      util.showToast('结束时间必须晚于开始时间')
      return
    }

    if (!coachId) {
      util.showToast('请选择教练')
      return
    }

    if (!venueId) {
      util.showToast('请选择球馆')
      return
    }

    this.setData({ saving: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'createFixedBooking',
        data: {
          action: this.data.isEdit ? 'update' : 'create',
          bookingId: this.data.bookingId,
          weekday,
          startTime,
          endTime,
          coachId,
          venueId,
          validUntil: this.data.form.validUntil || null
        }
      })

      console.log('云函数返回:', res.result)

      if (res.result.success) {
        util.showSuccess(this.data.isEdit ? '修改成功' : '设置成功')
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        util.showError(res.result.message || '保存失败')
      }
    } catch (err) {
      console.error('保存失败:', err)
      util.showError('保存失败: ' + (err.errMsg || err.message || '未知错误'))
    } finally {
      this.setData({ saving: false })
    }
  }
})
