// pages/coaches/schedule.js
const util = require('../../../utils/util.js')

// 星期映射
const DAY_MAP = {
  0: 'sunday', 1: 'monday', 2: 'tuesday',
  3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday'
}

// 星期显示名称
const DAY_NAMES = {
  monday: '周一',
  tuesday: '周二',
  wednesday: '周三',
  thursday: '周四',
  friday: '周五',
  saturday: '周六',
  sunday: '周日'
}

Page({
  data: {
    loading: false,
    saving: false,

    // 每周时段数据
    weeklySlots: {
      monday: [], tuesday: [], wednesday: [],
      thursday: [], friday: [], saturday: [], sunday: []
    },

    // 特殊日期（不可预约）
    unavailableDates: [],

    // UI状态
    showEditModal: false,
    currentDay: null,
    currentDayName: '',
    currentSlots: [],

    // 可选时段（0:00-24:00，24小时制）
    availableHours: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],

    // 默认时段（工作日，8:00-22:00）
    defaultSlots: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],

    // 时段选中状态映射 {hour: true/false}
    slotChecked: {}
  },

  onLoad() {
    this.loadSchedule()
  },

  // 加载时间设置
  async loadSchedule() {
    this.setData({ loading: true })

    try {
      const app = getApp()
      const openid = app.globalData.userInfo._openid

      const res = await wx.cloud.callFunction({
        name: 'manageCoach',
        data: {
          action: 'getByOpenid',
          openid: openid
        }
      })

      if (res.result.success && res.result.data) {
        const coach = res.result.data

        // 如果已有时间设置，使用已有的
        if (coach.schedule && coach.schedule.weeklySlots) {
          this.setData({
            weeklySlots: coach.schedule.weeklySlots,
            unavailableDates: coach.schedule.unavailableDates || []
          })
        } else {
          // 否则使用默认时段
          this.setData({
            weeklySlots: this.getDefaultSlots()
          })
        }
      } else {
        // 加载失败，使用默认时段
        this.setData({
          weeklySlots: this.getDefaultSlots()
        })
      }
    } catch (err) {
      // 使用默认时段
      this.setData({
        weeklySlots: this.getDefaultSlots()
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 获取默认时段
  getDefaultSlots() {
    return {
      monday: [...this.data.defaultSlots],
      tuesday: [...this.data.defaultSlots],
      wednesday: [...this.data.defaultSlots],
      thursday: [...this.data.defaultSlots],
      friday: [...this.data.defaultSlots],
      saturday: [...this.data.defaultSlots],
      sunday: [] // 周日休息
    }
  },

  // 格式化时段显示
  formatSlots(hours) {
    if (!hours || hours.length === 0) {
      return '休息日'
    }

    // 按连续时段分组
    const ranges = []
    let start = hours[0]
    let prev = hours[0]

    for (let i = 1; i < hours.length; i++) {
      if (hours[i] === prev + 1) {
        prev = hours[i]
      } else {
        ranges.push(`${this.formatHour(start)}-${this.formatHour(prev + 1)}`)
        start = hours[i]
        prev = hours[i]
      }
    }
    ranges.push(`${this.formatHour(start)}-${this.formatHour(prev + 1)}`)

    return ranges.join(', ')
  },

  // 格式化小时显示（补零）
  formatHour(hour) {
    return hour.toString().padStart(2, '0')
  },

  // 打开编辑弹窗
  openEditModal(e) {
    const day = e.currentTarget.dataset.day
    const dayName = DAY_NAMES[day]

    // 确保数据是数组并深拷贝
    const slots = this.data.weeklySlots[day] || []

    // 生成选中状态映射
    const slotChecked = {}
    slots.forEach(hour => {
      slotChecked[hour] = true
    })

    this.setData({
      currentDay: day,
      currentDayName: dayName,
      currentSlots: [...slots],  // 深拷贝数组
      slotChecked: slotChecked,
      showEditModal: true
    })
  },

  // 关闭编辑弹窗
  closeEditModal() {
    this.setData({
      showEditModal: false,
      currentDay: null,
      currentSlots: [],
      slotChecked: {}
    })
  },

  // 阻止事件冒泡（防止点击弹窗内部时关闭弹窗）
  stopPropagation() {
    // 空函数，仅用于阻止事件冒泡
  },

  // 勾选/取消时段
  toggleSlot(e) {
    const hour = parseInt(e.currentTarget.dataset.hour)
    const slots = [...(this.data.currentSlots || [])]
    const slotChecked = { ...this.data.slotChecked }
    const index = slots.indexOf(hour)

    if (index > -1) {
      slots.splice(index, 1) // 取消勾选
      slotChecked[hour] = false
    } else {
      slots.push(hour) // 勾选
      slotChecked[hour] = true
    }

    this.setData({
      currentSlots: slots.sort((a, b) => a - b),
      slotChecked: slotChecked
    })
  },

  // 全选/取消全选
  toggleSelectAll() {
    const { currentSlots, availableHours } = this.data

    if (currentSlots.length === availableHours.length) {
      // 取消全选
      const slotChecked = {}
      this.setData({
        currentSlots: [],
        slotChecked: slotChecked
      })
      util.showToast('已取消全选')
    } else {
      // 全选
      const slotChecked = {}
      availableHours.forEach(hour => {
        slotChecked[hour] = true
      })
      this.setData({
        currentSlots: [...availableHours],
        slotChecked: slotChecked
      })
      util.showToast('已全选')
    }
  },

  // 设为休息日
  setAsRestDay() {
    wx.showModal({
      title: '确认设为休息日',
      content: '设为休息日后，学员将无法预约该天的课程',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            currentSlots: [],
            slotChecked: {}
          })
          util.showSuccess('已设为休息日')
        }
      }
    })
  },

  // 保存编辑
  saveEdit() {
    const { currentDay, currentSlots, weeklySlots } = this.data

    // 创建新对象以确保数据更新
    const updatedWeeklySlots = {
      ...weeklySlots,
      [currentDay]: [...(currentSlots || [])]
    }

    this.setData({
      weeklySlots: updatedWeeklySlots,
      showEditModal: false,
      currentDay: null,
      currentSlots: [],
      slotChecked: {}
    })

    util.showSuccess('保存成功')
  },

  // 应用工作日时段
  applyToWeekdays() {
    const mondaySlots = this.data.weeklySlots.monday || []

    wx.showModal({
      title: '确认应用',
      content: '将周一的时段应用到周二至周五',
      success: (res) => {
        if (res.confirm) {
          const weeklySlots = {
            ...this.data.weeklySlots,
            tuesday: [...mondaySlots],
            wednesday: [...mondaySlots],
            thursday: [...mondaySlots],
            friday: [...mondaySlots]
          }

          this.setData({ weeklySlots })
          util.showSuccess('已应用到周一至周五')
        }
      }
    })
  },

  // 复制到全部
  copyToAll(e) {
    // 从事件对象获取要复制的天（优先使用按钮的 data-day）
    const sourceDay = e?.currentTarget?.dataset?.day || this.data.currentDay

    if (!sourceDay) {
      util.showToast('请先选择要复制的一天')
      return
    }

    const { weeklySlots } = this.data
    const slots = weeklySlots[sourceDay] || []

    wx.showModal({
      title: '确认复制',
      content: `将${DAY_NAMES[sourceDay]}的时段复制到所有天`,
      success: (res) => {
        if (res.confirm) {
          const updated = {}
          Object.keys(weeklySlots).forEach(day => {
            updated[day] = [...slots]
          })

          this.setData({ weeklySlots: updated })
          util.showSuccess('已复制到所有天')
        }
      }
    })
  },

  // 添加特殊日期
  addUnavailableDate() {
    // 选择日期
    wx.showModal({
      title: '添加不可预约日期',
      editable: true,
      placeholderText: '格式：YYYY-MM-DD，原因',
      confirmText: '添加',
      success: (res) => {
        if (res.confirm && res.content) {
          // 解析输入
          const parts = res.content.split(/[,，\s]+/)
          const date = parts[0]

          // 验证日期格式
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/
          if (!dateRegex.test(date)) {
            util.showError('日期格式不正确，请使用 YYYY-MM-DD 格式')
            return
          }

          const reason = parts.slice(1).join(' ') || '临时调整'

          // 检查是否已存在
          const exists = this.data.unavailableDates.some(
            item => item.date === date
          )

          if (exists) {
            util.showError('该日期已存在')
            return
          }

          // 添加到列表
          const unavailableDates = [
            ...this.data.unavailableDates,
            { date, reason }
          ].sort((a, b) => a.date.localeCompare(b.date))

          this.setData({ unavailableDates })
          util.showSuccess('添加成功')
        }
      }
    })
  },

  // 删除特殊日期
  removeUnavailableDate(e) {
    const { index, date } = e.currentTarget.dataset

    wx.showModal({
      title: '确认删除',
      content: `确定要删除 ${date} 的不可预约设置吗？`,
      success: (res) => {
        if (res.confirm) {
          const unavailableDates = [...(this.data.unavailableDates || [])]
          unavailableDates.splice(index, 1)

          this.setData({ unavailableDates })
          util.showSuccess('删除成功')
        }
      }
    })
  },

  // 保存设置
  async saveSchedule() {
    if (this.data.saving) return

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中...' })

    try {
      const app = getApp()
      const openid = app.globalData.userInfo._openid

      const res = await wx.cloud.callFunction({
        name: 'manageCoach',
        data: {
          action: 'updateSchedule',
          openid: openid,
          schedule: {
            weeklySlots: this.data.weeklySlots,
            unavailableDates: this.data.unavailableDates
          }
        }
      })

      if (res.result.success) {
        util.showSuccess('保存成功')
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        util.showError(res.result.message || '保存失败')
      }
    } catch (err) {
      util.showError('保存失败')
    } finally {
      wx.hideLoading()
      this.setData({ saving: false })
    }
  }
})
